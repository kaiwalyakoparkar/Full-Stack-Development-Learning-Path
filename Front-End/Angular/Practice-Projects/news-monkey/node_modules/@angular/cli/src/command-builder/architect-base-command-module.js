"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArchitectBaseCommandModule = void 0;
const architect_1 = require("@angular-devkit/architect");
const node_1 = require("@angular-devkit/architect/node");
const core_1 = require("@angular-devkit/core");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const analytics_1 = require("../analytics/analytics");
const error_1 = require("../utilities/error");
const prompt_1 = require("../utilities/prompt");
const tty_1 = require("../utilities/tty");
const command_module_1 = require("./command-module");
const json_schema_1 = require("./utilities/json-schema");
class ArchitectBaseCommandModule extends command_module_1.CommandModule {
    constructor() {
        super(...arguments);
        this.scope = command_module_1.CommandScope.In;
        this.shouldReportAnalytics = false;
    }
    async runSingleTarget(target, options) {
        const architectHost = await this.getArchitectHost();
        let builderName;
        try {
            builderName = await architectHost.getBuilderNameForTarget(target);
        }
        catch (e) {
            (0, error_1.assertIsError)(e);
            return this.onMissingTarget(e.message);
        }
        await this.reportAnalytics({
            ...(await architectHost.getOptionsForTarget(target)),
            ...options,
        });
        const { logger } = this.context;
        const run = await this.getArchitect().scheduleTarget(target, options, {
            logger,
            analytics: (0, analytics_1.isPackageNameSafeForAnalytics)(builderName) ? await this.getAnalytics() : undefined,
        });
        const { error, success } = await run.output.toPromise();
        await run.stop();
        if (error) {
            logger.error(error);
        }
        return success ? 0 : 1;
    }
    getArchitectHost() {
        if (this._architectHost) {
            return this._architectHost;
        }
        const workspace = this.getWorkspaceOrThrow();
        return (this._architectHost = new node_1.WorkspaceNodeModulesArchitectHost(workspace, workspace.basePath));
    }
    getArchitect() {
        if (this._architect) {
            return this._architect;
        }
        const registry = new core_1.json.schema.CoreSchemaRegistry();
        registry.addPostTransform(core_1.json.schema.transforms.addUndefinedDefaults);
        registry.useXDeprecatedProvider((msg) => this.context.logger.warn(msg));
        const architectHost = this.getArchitectHost();
        return (this._architect = new architect_1.Architect(architectHost, registry));
    }
    async getArchitectTargetOptions(target) {
        const architectHost = this.getArchitectHost();
        let builderConf;
        try {
            builderConf = await architectHost.getBuilderNameForTarget(target);
        }
        catch {
            return [];
        }
        let builderDesc;
        try {
            builderDesc = await architectHost.resolveBuilder(builderConf);
        }
        catch (e) {
            (0, error_1.assertIsError)(e);
            if (e.code === 'MODULE_NOT_FOUND') {
                this.warnOnMissingNodeModules();
                throw new command_module_1.CommandModuleError(`Could not find the '${builderConf}' builder's node package.`);
            }
            throw e;
        }
        return (0, json_schema_1.parseJsonSchemaToOptions)(new core_1.json.schema.CoreSchemaRegistry(), builderDesc.optionSchema, true);
    }
    warnOnMissingNodeModules() {
        var _a;
        const basePath = (_a = this.context.workspace) === null || _a === void 0 ? void 0 : _a.basePath;
        if (!basePath) {
            return;
        }
        // Check for a `node_modules` directory (npm, yarn non-PnP, etc.)
        if ((0, fs_1.existsSync)((0, path_1.resolve)(basePath, 'node_modules'))) {
            return;
        }
        // Check for yarn PnP files
        if ((0, fs_1.existsSync)((0, path_1.resolve)(basePath, '.pnp.js')) ||
            (0, fs_1.existsSync)((0, path_1.resolve)(basePath, '.pnp.cjs')) ||
            (0, fs_1.existsSync)((0, path_1.resolve)(basePath, '.pnp.mjs'))) {
            return;
        }
        this.context.logger.warn(`Node packages may not be installed. Try installing with '${this.context.packageManager.name} install'.`);
    }
    getArchitectTarget() {
        return this.commandName;
    }
    async onMissingTarget(defaultMessage) {
        const { logger } = this.context;
        const choices = this.missingTargetChoices;
        if (!(choices === null || choices === void 0 ? void 0 : choices.length)) {
            logger.error(defaultMessage);
            return 1;
        }
        const missingTargetMessage = `Cannot find "${this.getArchitectTarget()}" target for the specified project.\n` +
            `You can add a package that implements these capabilities.\n\n` +
            `For example:\n` +
            choices.map(({ name, value }) => `  ${name}: ng add ${value}`).join('\n') +
            '\n';
        if ((0, tty_1.isTTY)()) {
            // Use prompts to ask the user if they'd like to install a package.
            logger.warn(missingTargetMessage);
            const packageToInstall = await this.getMissingTargetPackageToInstall(choices);
            if (packageToInstall) {
                // Example run: `ng add @angular-eslint/schematics`.
                const binPath = (0, path_1.resolve)(__dirname, '../../bin/ng.js');
                const { error } = (0, child_process_1.spawnSync)(process.execPath, [binPath, 'add', packageToInstall], {
                    stdio: 'inherit',
                });
                if (error) {
                    throw error;
                }
            }
        }
        else {
            // Non TTY display error message.
            logger.error(missingTargetMessage);
        }
        return 1;
    }
    async getMissingTargetPackageToInstall(choices) {
        if (choices.length === 1) {
            // Single choice
            const { name, value } = choices[0];
            if (await (0, prompt_1.askConfirmation)(`Would you like to add ${name} now?`, true, false)) {
                return value;
            }
            return null;
        }
        // Multiple choice
        return (0, prompt_1.askQuestion)(`Would you like to add a package with "${this.getArchitectTarget()}" capabilities now?`, [
            {
                name: 'No',
                value: null,
            },
            ...choices,
        ], 0, null);
    }
}
exports.ArchitectBaseCommandModule = ArchitectBaseCommandModule;

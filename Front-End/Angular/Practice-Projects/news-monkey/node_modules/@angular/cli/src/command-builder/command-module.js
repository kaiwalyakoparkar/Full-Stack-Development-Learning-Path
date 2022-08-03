"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandModuleError = exports.CommandModule = exports.CommandScope = void 0;
const core_1 = require("@angular-devkit/core");
const fs_1 = require("fs");
const path = __importStar(require("path"));
const helpers_1 = require("yargs/helpers");
const analytics_1 = require("../analytics/analytics");
const completion_1 = require("../utilities/completion");
const memoize_1 = require("../utilities/memoize");
var CommandScope;
(function (CommandScope) {
    /** Command can only run inside an Angular workspace. */
    CommandScope[CommandScope["In"] = 0] = "In";
    /** Command can only run outside an Angular workspace. */
    CommandScope[CommandScope["Out"] = 1] = "Out";
    /** Command can run inside and outside an Angular workspace. */
    CommandScope[CommandScope["Both"] = 2] = "Both";
})(CommandScope = exports.CommandScope || (exports.CommandScope = {}));
class CommandModule {
    constructor(context) {
        this.context = context;
        this.shouldReportAnalytics = true;
        this.scope = CommandScope.Both;
        this.optionsWithAnalytics = new Map();
    }
    /**
     * Description object which contains the long command descroption.
     * This is used to generate JSON help wich is used in AIO.
     *
     * `false` will result in a hidden command.
     */
    get fullDescribe() {
        return this.describe === false
            ? false
            : {
                describe: this.describe,
                ...(this.longDescriptionPath
                    ? {
                        longDescriptionRelativePath: path
                            .relative(path.join(__dirname, '../../../../'), this.longDescriptionPath)
                            .replace(/\\/g, path.posix.sep),
                        longDescription: (0, fs_1.readFileSync)(this.longDescriptionPath, 'utf8').replace(/\r\n/g, '\n'),
                    }
                    : {}),
            };
    }
    get commandName() {
        return this.command.split(' ', 1)[0];
    }
    async handler(args) {
        const { _, $0, ...options } = args;
        // Camelize options as yargs will return the object in kebab-case when camel casing is disabled.
        const camelCasedOptions = {};
        for (const [key, value] of Object.entries(options)) {
            camelCasedOptions[helpers_1.Parser.camelCase(key)] = value;
        }
        // Set up autocompletion if appropriate.
        const autocompletionExitCode = await (0, completion_1.considerSettingUpAutocompletion)(this.commandName, this.context.logger);
        if (autocompletionExitCode !== undefined) {
            process.exitCode = autocompletionExitCode;
            return;
        }
        // Gather and report analytics.
        const analytics = await this.getAnalytics();
        if (this.shouldReportAnalytics) {
            await this.reportAnalytics(camelCasedOptions);
        }
        let exitCode;
        try {
            // Run and time command.
            const startTime = Date.now();
            exitCode = await this.run(camelCasedOptions);
            const endTime = Date.now();
            analytics.timing(this.commandName, 'duration', endTime - startTime);
            await analytics.flush();
        }
        catch (e) {
            if (e instanceof core_1.schema.SchemaValidationException) {
                this.context.logger.fatal(`Error: ${e.message}`);
                exitCode = 1;
            }
            else {
                throw e;
            }
        }
        finally {
            if (typeof exitCode === 'number' && exitCode > 0) {
                process.exitCode = exitCode;
            }
        }
    }
    async reportAnalytics(options, paths = [], dimensions = []) {
        for (const [name, ua] of this.optionsWithAnalytics) {
            const value = options[name];
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                dimensions[ua] = value;
            }
        }
        const analytics = await this.getAnalytics();
        analytics.pageview('/command/' + [this.commandName, ...paths].join('/'), {
            dimensions,
            metrics: [],
        });
    }
    getAnalytics() {
        return (0, analytics_1.createAnalytics)(!!this.context.workspace, 
        // Don't prompt for `ng update` and `ng analytics` commands.
        ['update', 'analytics'].includes(this.commandName));
    }
    /**
     * Adds schema options to a command also this keeps track of options that are required for analytics.
     * **Note:** This method should be called from the command bundler method.
     */
    addSchemaOptionsToCommand(localYargs, options) {
        const booleanOptionsWithNoPrefix = new Set();
        for (const option of options) {
            const { default: defaultVal, positional, deprecated, description, alias, userAnalytics, type, hidden, name, choices, } = option;
            const sharedOptions = {
                alias,
                hidden,
                description,
                deprecated,
                choices,
                // This should only be done when `--help` is used otherwise default will override options set in angular.json.
                ...(this.context.args.options.help ? { default: defaultVal } : {}),
            };
            let dashedName = core_1.strings.dasherize(name);
            // Handle options which have been defined in the schema with `no` prefix.
            if (type === 'boolean' && dashedName.startsWith('no-')) {
                dashedName = dashedName.slice(3);
                booleanOptionsWithNoPrefix.add(dashedName);
            }
            if (positional === undefined) {
                localYargs = localYargs.option(dashedName, {
                    type,
                    ...sharedOptions,
                });
            }
            else {
                localYargs = localYargs.positional(dashedName, {
                    type: type === 'array' || type === 'count' ? 'string' : type,
                    ...sharedOptions,
                });
            }
            // Record option of analytics.
            if (userAnalytics !== undefined) {
                this.optionsWithAnalytics.set(name, userAnalytics);
            }
        }
        // Handle options which have been defined in the schema with `no` prefix.
        if (booleanOptionsWithNoPrefix.size) {
            localYargs.middleware((options) => {
                for (const key of booleanOptionsWithNoPrefix) {
                    if (key in options) {
                        options[`no-${key}`] = !options[key];
                        delete options[key];
                    }
                }
            }, false);
        }
        return localYargs;
    }
    getWorkspaceOrThrow() {
        const { workspace } = this.context;
        if (!workspace) {
            throw new CommandModuleError('A workspace is required for this command.');
        }
        return workspace;
    }
}
__decorate([
    memoize_1.memoize
], CommandModule.prototype, "getAnalytics", null);
exports.CommandModule = CommandModule;
/**
 * Creates an known command module error.
 * This is used so during executation we can filter between known validation error and real non handled errors.
 */
class CommandModuleError extends Error {
}
exports.CommandModuleError = CommandModuleError;

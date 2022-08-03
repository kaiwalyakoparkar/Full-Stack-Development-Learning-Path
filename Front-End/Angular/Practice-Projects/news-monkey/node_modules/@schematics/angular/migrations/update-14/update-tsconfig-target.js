"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const json_file_1 = require("../../utility/json-file");
const workspace_1 = require("../../utility/workspace");
const workspace_models_1 = require("../../utility/workspace-models");
/** Migration to update tsconfig compilation target option to es2020. */
function default_1() {
    return async (host) => {
        var _a, _b;
        /** Builders for which the migration will run. */
        const supportedBuilders = [workspace_models_1.Builders.Karma, workspace_models_1.Builders.NgPackagr, workspace_models_1.Builders.Browser];
        /** Compilation targets values that should not be amended. */
        const skipTargets = ['es2020', 'es2021', 'es2022', 'esnext'];
        const uniqueTsConfigs = new Set(['/tsconfig.json']);
        // Find all tsconfig files which are refereced by the builders.
        const workspace = await (0, workspace_1.getWorkspace)(host);
        for (const project of workspace.projects.values()) {
            for (const target of project.targets.values()) {
                if (!supportedBuilders.includes(target.builder)) {
                    // Unknown builder.
                    continue;
                }
                // Update all other known CLI builders that use a tsconfig.
                const allOptions = [(_a = target.options) !== null && _a !== void 0 ? _a : {}, ...Object.values((_b = target.configurations) !== null && _b !== void 0 ? _b : {})];
                for (const opt of allOptions) {
                    if (typeof (opt === null || opt === void 0 ? void 0 : opt.tsConfig) === 'string') {
                        uniqueTsConfigs.add(opt.tsConfig);
                    }
                }
            }
        }
        // Modify tsconfig files
        const targetJsonPath = ['compilerOptions', 'target'];
        for (const tsConfigPath of uniqueTsConfigs) {
            const json = new json_file_1.JSONFile(host, tsConfigPath);
            const target = json.get(targetJsonPath);
            // Update compilation target when it's current set lower than es2020.
            if (typeof target === 'string' && !skipTargets.includes(target.toLowerCase())) {
                json.modify(targetJsonPath, 'es2020');
            }
        }
    };
}
exports.default = default_1;

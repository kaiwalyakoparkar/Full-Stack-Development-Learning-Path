"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@angular-devkit/core");
const workspace_1 = require("../../utility/workspace");
/** Migration to replace 'defaultCollection' option in angular.json. */
function default_1() {
    return (0, workspace_1.updateWorkspace)((workspace) => {
        // workspace level
        replaceDefaultCollection(workspace.extensions['cli']);
        // Project level
        for (const project of workspace.projects.values()) {
            replaceDefaultCollection(project.extensions['cli']);
        }
    });
}
exports.default = default_1;
function replaceDefaultCollection(cliExtension) {
    if (cliExtension && (0, core_1.isJsonObject)(cliExtension) && cliExtension['defaultCollection']) {
        // If `schematicsCollection` defined `defaultCollection` is ignored hence no need to warn.
        if (!cliExtension['schematicCollections']) {
            cliExtension['schematicCollections'] = [cliExtension['defaultCollection']];
        }
        delete cliExtension['defaultCollection'];
    }
}

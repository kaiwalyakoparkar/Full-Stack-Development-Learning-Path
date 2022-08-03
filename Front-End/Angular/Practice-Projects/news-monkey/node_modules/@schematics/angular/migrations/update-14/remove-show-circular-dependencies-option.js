"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const workspace_1 = require("../../utility/workspace");
/** Migration to remove 'showCircularDependencies' option from browser and server builders. */
function default_1() {
    return (0, workspace_1.updateWorkspace)((workspace) => {
        for (const project of workspace.projects.values()) {
            for (const target of project.targets.values()) {
                if (target.builder === '@angular-devkit/build-angular:server' ||
                    target.builder === '@angular-devkit/build-angular:browser') {
                    for (const [, options] of (0, workspace_1.allTargetOptions)(target)) {
                        delete options.showCircularDependencies;
                    }
                }
            }
        }
    });
}
exports.default = default_1;

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
/** Migration to remove 'defaultProject' option from angular.json. */
function default_1() {
    return (0, workspace_1.updateWorkspace)((workspace) => {
        delete workspace.extensions['defaultProject'];
    });
}
exports.default = default_1;

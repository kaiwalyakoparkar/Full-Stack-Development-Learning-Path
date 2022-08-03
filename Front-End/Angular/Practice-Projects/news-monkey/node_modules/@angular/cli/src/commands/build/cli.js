"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuildCommandModule = void 0;
const path_1 = require("path");
const architect_command_module_1 = require("../../command-builder/architect-command-module");
class BuildCommandModule extends architect_command_module_1.ArchitectCommandModule {
    constructor() {
        super(...arguments);
        this.multiTarget = false;
        this.command = 'build [project]';
        this.aliases = ['b'];
        this.describe = 'Compiles an Angular application or library into an output directory named dist/ at the given output path.';
        this.longDescriptionPath = (0, path_1.join)(__dirname, 'long-description.md');
    }
}
exports.BuildCommandModule = BuildCommandModule;

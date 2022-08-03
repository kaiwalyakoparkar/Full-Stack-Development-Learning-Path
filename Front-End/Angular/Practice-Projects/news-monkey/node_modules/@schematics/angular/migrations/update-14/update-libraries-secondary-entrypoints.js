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
function* visitPackageJsonFiles(directory, includedInLookup = false) {
    if (includedInLookup) {
        for (const path of directory.subfiles) {
            if (path !== 'package.json') {
                continue;
            }
            yield (0, core_1.join)(directory.path, path);
        }
    }
    for (const path of directory.subdirs) {
        if (path === 'node_modules' || path.startsWith('.')) {
            continue;
        }
        yield* visitPackageJsonFiles(directory.dir(path), true);
    }
}
/** Migration to remove secondary entrypoints 'package.json' files and migrate ng-packagr configurations. */
function default_1() {
    return async (tree) => {
        const workspace = await (0, workspace_1.getWorkspace)(tree);
        for (const project of workspace.projects.values()) {
            if (project.extensions['projectType'] !== 'library' ||
                ![...project.targets.values()].some(({ builder }) => builder === '@angular-devkit/build-angular:ng-packagr')) {
                // Project is not a library or doesn't use ng-packagr, skip.
                continue;
            }
            for (const path of visitPackageJsonFiles(tree.getDir(project.root))) {
                const json = tree.readJson(path);
                if ((0, core_1.isJsonObject)(json) && json['ngPackage']) {
                    // Migrate ng-packagr config to an ng-packagr config file.
                    const configFilePath = (0, core_1.join)((0, core_1.dirname)((0, core_1.normalize)(path)), 'ng-package.json');
                    tree.create(configFilePath, JSON.stringify(json['ngPackage'], undefined, 2));
                }
                // Delete package.json as it is no longer needed in APF 14.
                tree.delete(path);
            }
        }
    };
}
exports.default = default_1;

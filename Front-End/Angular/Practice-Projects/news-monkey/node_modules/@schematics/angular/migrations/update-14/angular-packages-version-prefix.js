"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const tasks_1 = require("@angular-devkit/schematics/tasks");
const dependencies_1 = require("../../utility/dependencies");
const json_file_1 = require("../../utility/json-file");
const PACKAGES_REGEXP = /^@(?:angular|nguniversal|schematics|angular-devkit)\/|^ng-packagr$/;
/**
 * This migrations updates Angular packages 'dependencies' and 'devDependencies' version prefix to '^' instead of '~'.
 *
 * @example
 * **Before**
 * ```json
 * dependencies: {
 *   "@angular/animations": "~13.1.0",
 *   "@angular/common": "~13.1.0"
 * }
 * ```
 *
 * **After**
 * ```json
 * dependencies: {
 *   "@angular/animations": "^13.1.0",
 *   "@angular/common": "^13.1.0"
 * }
 * ```
 */
function default_1() {
    return (tree, context) => {
        const json = new json_file_1.JSONFile(tree, '/package.json');
        updateVersionPrefixToTilde(json, dependencies_1.NodeDependencyType.Default);
        updateVersionPrefixToTilde(json, dependencies_1.NodeDependencyType.Dev);
        context.addTask(new tasks_1.NodePackageInstallTask());
    };
}
exports.default = default_1;
function updateVersionPrefixToTilde(json, dependencyType) {
    const dependencyTypePath = [dependencyType];
    const dependencies = json.get(dependencyTypePath);
    if (!dependencies || typeof dependencies !== 'object') {
        return;
    }
    const updatedDependencies = new Map();
    for (const [name, version] of Object.entries(dependencies)) {
        if (typeof version === 'string' && version.charAt(0) === '~' && PACKAGES_REGEXP.test(name)) {
            updatedDependencies.set(name, `^${version.substring(1)}`);
        }
    }
    if (updatedDependencies.size) {
        json.modify(dependencyTypePath, {
            ...dependencies,
            ...Object.fromEntries(updatedDependencies),
        });
    }
}

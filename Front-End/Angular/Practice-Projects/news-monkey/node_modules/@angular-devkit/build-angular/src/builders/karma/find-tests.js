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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findTests = void 0;
const fs_1 = require("fs");
const glob_1 = __importStar(require("glob"));
const path_1 = require("path");
const util_1 = require("util");
const globPromise = (0, util_1.promisify)(glob_1.default);
// go through all patterns and find unique list of files
async function findTests(patterns, workspaceRoot, projectSourceRoot) {
    const matchingTestsPromises = patterns.map((pattern) => findMatchingTests(pattern, workspaceRoot, projectSourceRoot));
    const files = await Promise.all(matchingTestsPromises);
    // Unique file names
    return [...new Set(files.flat())];
}
exports.findTests = findTests;
const normalizePath = (path) => path.replace(/\\/g, '/');
async function findMatchingTests(pattern, workspaceRoot, projectSourceRoot) {
    // normalize pattern, glob lib only accepts forward slashes
    let normalizedPattern = normalizePath(pattern);
    const relativeProjectRoot = normalizePath((0, path_1.relative)(workspaceRoot, projectSourceRoot) + '/');
    // remove relativeProjectRoot to support relative paths from root
    // such paths are easy to get when running scripts via IDEs
    if (normalizedPattern.startsWith(relativeProjectRoot)) {
        normalizedPattern = normalizedPattern.substring(relativeProjectRoot.length);
    }
    // special logic when pattern does not look like a glob
    if (!(0, glob_1.hasMagic)(normalizedPattern)) {
        if (await isDirectory((0, path_1.join)(projectSourceRoot, normalizedPattern))) {
            normalizedPattern = `${normalizedPattern}/**/*.spec.@(ts|tsx)`;
        }
        else {
            // see if matching spec file exists
            const fileExt = (0, path_1.extname)(normalizedPattern);
            // Replace extension to `.spec.ext`. Example: `src/app/app.component.ts`-> `src/app/app.component.spec.ts`
            const potentialSpec = (0, path_1.join)((0, path_1.dirname)(normalizedPattern), `${(0, path_1.basename)(normalizedPattern, fileExt)}.spec${fileExt}`);
            if (await exists((0, path_1.join)(projectSourceRoot, potentialSpec))) {
                return [normalizePath(potentialSpec)];
            }
        }
    }
    return globPromise(normalizedPattern, {
        cwd: projectSourceRoot,
        root: projectSourceRoot,
        nomount: true,
    });
}
async function isDirectory(path) {
    try {
        const stats = await fs_1.promises.stat(path);
        return stats.isDirectory();
    }
    catch {
        return false;
    }
}
async function exists(path) {
    try {
        await fs_1.promises.access(path, fs_1.constants.F_OK);
        return true;
    }
    catch {
        return false;
    }
}

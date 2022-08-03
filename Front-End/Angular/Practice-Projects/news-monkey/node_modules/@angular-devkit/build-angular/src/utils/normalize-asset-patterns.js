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
exports.normalizeAssetPatterns = exports.MissingAssetSourceRootException = void 0;
const core_1 = require("@angular-devkit/core");
const fs_1 = require("fs");
const path = __importStar(require("path"));
class MissingAssetSourceRootException extends core_1.BaseException {
    constructor(path) {
        super(`The ${path} asset path must start with the project source root.`);
    }
}
exports.MissingAssetSourceRootException = MissingAssetSourceRootException;
function normalizeAssetPatterns(assetPatterns, workspaceRoot, projectRoot, projectSourceRoot) {
    if (assetPatterns.length === 0) {
        return [];
    }
    // When sourceRoot is not available, we default to ${projectRoot}/src.
    const sourceRoot = projectSourceRoot || path.join(projectRoot, 'src');
    const resolvedSourceRoot = path.resolve(workspaceRoot, sourceRoot);
    return assetPatterns.map((assetPattern) => {
        // Normalize string asset patterns to objects.
        if (typeof assetPattern === 'string') {
            const assetPath = path.normalize(assetPattern);
            const resolvedAssetPath = path.resolve(workspaceRoot, assetPath);
            // Check if the string asset is within sourceRoot.
            if (!resolvedAssetPath.startsWith(resolvedSourceRoot)) {
                throw new MissingAssetSourceRootException(assetPattern);
            }
            let glob, input;
            let isDirectory = false;
            try {
                isDirectory = (0, fs_1.statSync)(resolvedAssetPath).isDirectory();
            }
            catch {
                isDirectory = true;
            }
            if (isDirectory) {
                // Folders get a recursive star glob.
                glob = '**/*';
                // Input directory is their original path.
                input = assetPath;
            }
            else {
                // Files are their own glob.
                glob = path.basename(assetPath);
                // Input directory is their original dirname.
                input = path.dirname(assetPath);
            }
            // Output directory for both is the relative path from source root to input.
            const output = path.relative(resolvedSourceRoot, path.resolve(workspaceRoot, input));
            // Return the asset pattern in object format.
            return { glob, input, output };
        }
        else {
            // It's already an AssetPatternObject, no need to convert.
            return assetPattern;
        }
    });
}
exports.normalizeAssetPatterns = normalizeAssetPatterns;

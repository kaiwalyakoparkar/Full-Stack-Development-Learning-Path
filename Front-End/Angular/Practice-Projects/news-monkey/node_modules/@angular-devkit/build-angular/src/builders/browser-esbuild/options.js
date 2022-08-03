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
exports.normalizeOptions = void 0;
const path = __importStar(require("path"));
const utils_1 = require("../../utils");
const schema_1 = require("../browser/schema");
/**
 * Normalize the user provided options by creating full paths for all path based options
 * and converting multi-form options into a single form that can be directly used
 * by the build process.
 *
 * @param context The context for current builder execution.
 * @param projectName The name of the project for the current execution.
 * @param options An object containing the options to use for the build.
 * @returns An object containing normalized options required to perform the build.
 */
async function normalizeOptions(context, projectName, options) {
    var _a, _b, _c, _d;
    const workspaceRoot = context.workspaceRoot;
    const projectMetadata = await context.getProjectMetadata(projectName);
    const projectRoot = path.join(workspaceRoot, (_a = projectMetadata.root) !== null && _a !== void 0 ? _a : '');
    const projectSourceRoot = path.join(workspaceRoot, (_b = projectMetadata.sourceRoot) !== null && _b !== void 0 ? _b : 'src');
    // Normalize options
    const mainEntryPoint = path.join(workspaceRoot, options.main);
    const polyfillsEntryPoint = options.polyfills && path.join(workspaceRoot, options.polyfills);
    const tsconfig = path.join(workspaceRoot, options.tsConfig);
    const outputPath = path.join(workspaceRoot, options.outputPath);
    const optimizationOptions = (0, utils_1.normalizeOptimization)(options.optimization);
    const sourcemapOptions = (0, utils_1.normalizeSourceMaps)((_c = options.sourceMap) !== null && _c !== void 0 ? _c : false);
    const assets = ((_d = options.assets) === null || _d === void 0 ? void 0 : _d.length)
        ? (0, utils_1.normalizeAssetPatterns)(options.assets, workspaceRoot, projectRoot, projectSourceRoot)
        : undefined;
    const outputNames = {
        bundles: options.outputHashing === schema_1.OutputHashing.All || options.outputHashing === schema_1.OutputHashing.Bundles
            ? '[name].[hash]'
            : '[name]',
        media: options.outputHashing === schema_1.OutputHashing.All || options.outputHashing === schema_1.OutputHashing.Media
            ? '[name].[hash]'
            : '[name]',
    };
    if (options.resourcesOutputPath) {
        outputNames.media = path.join(options.resourcesOutputPath, outputNames.media);
    }
    return {
        workspaceRoot,
        mainEntryPoint,
        polyfillsEntryPoint,
        optimizationOptions,
        outputPath,
        sourcemapOptions,
        tsconfig,
        projectRoot,
        assets,
        outputNames,
    };
}
exports.normalizeOptions = normalizeOptions;

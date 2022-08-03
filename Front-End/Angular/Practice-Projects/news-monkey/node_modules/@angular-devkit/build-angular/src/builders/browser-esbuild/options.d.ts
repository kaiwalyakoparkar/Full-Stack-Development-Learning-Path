/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BuilderContext } from '@angular-devkit/architect';
import { Schema as BrowserBuilderOptions } from '../browser/schema';
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
export declare function normalizeOptions(context: BuilderContext, projectName: string, options: BrowserBuilderOptions): Promise<{
    workspaceRoot: string;
    mainEntryPoint: string;
    polyfillsEntryPoint: string | undefined;
    optimizationOptions: import("../../utils").NormalizedOptimizationOptions;
    outputPath: string;
    sourcemapOptions: import("../browser/schema").SourceMapClass;
    tsconfig: string;
    projectRoot: string;
    assets: import("../browser/schema").AssetPatternClass[] | undefined;
    outputNames: {
        bundles: string;
        media: string;
    };
}>;

/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import type { OutputFile } from 'esbuild';
export interface BundleStylesheetOptions {
    workspaceRoot: string;
    optimization: boolean;
    preserveSymlinks?: boolean;
    sourcemap: boolean | 'external' | 'inline';
    outputNames?: {
        bundles?: string;
        media?: string;
    };
    includePaths?: string[];
}
/**
 * Bundle a stylesheet that exists as a file on the filesystem.
 *
 * @param filename The path to the file to bundle.
 * @param options The stylesheet bundling options to use.
 * @returns The bundle result object.
 */
export declare function bundleStylesheetFile(filename: string, options: BundleStylesheetOptions): Promise<{
    errors: import("esbuild").Message[];
    warnings: import("esbuild").Message[];
    contents: string;
    map: string | undefined;
    path: string | undefined;
    resourceFiles: OutputFile[];
}>;
/**
 * Bundle stylesheet text data from a string.
 *
 * @param data The string content of a stylesheet to bundle.
 * @param dataOptions The options to use to resolve references and name output of the stylesheet data.
 * @param bundleOptions  The stylesheet bundling options to use.
 * @returns The bundle result object.
 */
export declare function bundleStylesheetText(data: string, dataOptions: {
    resolvePath: string;
    virtualName?: string;
}, bundleOptions: BundleStylesheetOptions): Promise<{
    errors: import("esbuild").Message[];
    warnings: import("esbuild").Message[];
    contents: string;
    map: string | undefined;
    path: string | undefined;
    resourceFiles: OutputFile[];
}>;

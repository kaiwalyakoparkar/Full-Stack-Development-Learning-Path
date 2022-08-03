/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import type { ObjectPattern } from 'copy-webpack-plugin';
import { ScriptTarget } from 'typescript';
import type { Configuration, WebpackOptionsNormalized } from 'webpack';
import { AssetPatternClass, OutputHashing, ScriptElement, StyleElement } from '../../builders/browser/schema';
import { WebpackConfigOptions } from '../../utils/build-options';
export interface HashFormat {
    chunk: string;
    extract: string;
    file: string;
    script: string;
}
export declare type WebpackStatsOptions = Exclude<Configuration['stats'], string | boolean | undefined>;
export declare function getOutputHashFormat(outputHashing?: OutputHashing, length?: number): HashFormat;
export declare type NormalizedEntryPoint = Required<Exclude<ScriptElement | StyleElement, string>>;
export declare function normalizeExtraEntryPoints(extraEntryPoints: (ScriptElement | StyleElement)[], defaultBundleName: string): NormalizedEntryPoint[];
export declare function assetNameTemplateFactory(hashFormat: HashFormat): (resourcePath: string) => string;
export declare function getInstrumentationExcludedPaths(root: string, excludedPaths: string[]): Set<string>;
export declare function getCacheSettings(wco: WebpackConfigOptions, angularVersion: string): WebpackOptionsNormalized['cache'];
export declare function globalScriptsByBundleName(root: string, scripts: ScriptElement[]): {
    bundleName: string;
    inject: boolean;
    paths: string[];
}[];
export declare function assetPatterns(root: string, assets: AssetPatternClass[]): ObjectPattern[];
export declare function externalizePackages(context: string, request: string | undefined, callback: (error?: Error, result?: string) => void): void;
export declare function getStatsOptions(verbose?: boolean): WebpackStatsOptions;
export declare function getMainFieldsAndConditionNames(target: ScriptTarget, platformServer: boolean): Pick<WebpackOptionsNormalized['resolve'], 'mainFields' | 'conditionNames'>;

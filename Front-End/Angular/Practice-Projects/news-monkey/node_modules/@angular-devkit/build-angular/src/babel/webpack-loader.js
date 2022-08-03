"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requiresLinking = void 0;
const babel_loader_1 = require("babel-loader");
const typescript_1 = require("typescript");
const load_esm_1 = require("../utils/load-esm");
const package_version_1 = require("../utils/package-version");
/**
 * Cached instance of the compiler-cli linker's needsLinking function.
 */
let needsLinking;
/**
 * Cached instance of the compiler-cli linker's Babel plugin factory function.
 */
let linkerPluginCreator;
/**
 * Cached instance of the localize Babel plugins factory functions.
 */
let i18nPluginCreators;
async function requiresLinking(path, source) {
    // @angular/core and @angular/compiler will cause false positives
    // Also, TypeScript files do not require linking
    if (/[\\/]@angular[\\/](?:compiler|core)|\.tsx?$/.test(path)) {
        return false;
    }
    if (!needsLinking) {
        // Load ESM `@angular/compiler-cli/linker` using the TypeScript dynamic import workaround.
        // Once TypeScript provides support for keeping the dynamic import this workaround can be
        // changed to a direct dynamic import.
        const linkerModule = await (0, load_esm_1.loadEsmModule)('@angular/compiler-cli/linker');
        needsLinking = linkerModule.needsLinking;
    }
    return needsLinking(path, source);
}
exports.requiresLinking = requiresLinking;
// eslint-disable-next-line max-lines-per-function
exports.default = (0, babel_loader_1.custom)(() => {
    const baseOptions = Object.freeze({
        babelrc: false,
        configFile: false,
        compact: false,
        cacheCompression: false,
        sourceType: 'unambiguous',
        inputSourceMap: false,
    });
    return {
        async customOptions(options, { source, map }) {
            var _a, _b, _c;
            const { i18n, scriptTarget, aot, optimize, instrumentCode, supportedBrowsers, ...rawOptions } = options;
            // Must process file if plugins are added
            let shouldProcess = Array.isArray(rawOptions.plugins) && rawOptions.plugins.length > 0;
            const customOptions = {
                forceAsyncTransformation: false,
                forcePresetEnv: false,
                angularLinker: undefined,
                i18n: undefined,
                instrumentCode: undefined,
                supportedBrowsers,
            };
            // Analyze file for linking
            if (await requiresLinking(this.resourcePath, source)) {
                // Load ESM `@angular/compiler-cli/linker/babel` using the TypeScript dynamic import workaround.
                // Once TypeScript provides support for keeping the dynamic import this workaround can be
                // changed to a direct dynamic import.
                linkerPluginCreator !== null && linkerPluginCreator !== void 0 ? linkerPluginCreator : (linkerPluginCreator = (await (0, load_esm_1.loadEsmModule)('@angular/compiler-cli/linker/babel')).createEs2015LinkerPlugin);
                customOptions.angularLinker = {
                    shouldLink: true,
                    jitMode: aot !== true,
                    linkerPluginCreator,
                };
                shouldProcess = true;
            }
            // Analyze for ES target processing
            const esTarget = scriptTarget;
            const isJsFile = /\.[cm]?js$/.test(this.resourcePath);
            // The below should be dropped when we no longer support ES5 TypeScript output.
            if (esTarget === typescript_1.ScriptTarget.ES5) {
                // This is needed because when target is ES5 we change the TypeScript target to ES2015
                // because it simplifies build-optimization passes.
                // @see https://github.com/angular/angular-cli/blob/22af6520834171d01413d4c7e4a9f13fb752252e/packages/angular_devkit/build_angular/src/webpack/plugins/typescript.ts#L51-L56
                customOptions.forcePresetEnv = true;
                // Comparable behavior to tsconfig target of ES5
                customOptions.supportedBrowsers = ['IE 9'];
            }
            else if (isJsFile && ((_a = customOptions.supportedBrowsers) === null || _a === void 0 ? void 0 : _a.length)) {
                // Applications code ES version can be controlled using TypeScript's `target` option.
                // However, this doesn't effect libraries and hence we use preset-env to downlevel ES fetaures
                // based on the supported browsers in browserlist.
                customOptions.forcePresetEnv = true;
            }
            if ((esTarget !== undefined && esTarget >= typescript_1.ScriptTarget.ES2017) || isJsFile) {
                // Application code (TS files) will only contain native async if target is ES2017+.
                // However, third-party libraries can regardless of the target option.
                // APF packages with code in [f]esm2015 directories is downlevelled to ES2015 and
                // will not have native async.
                customOptions.forceAsyncTransformation =
                    !/[\\/][_f]?esm2015[\\/]/.test(this.resourcePath) && source.includes('async');
            }
            shouldProcess || (shouldProcess = customOptions.forceAsyncTransformation || customOptions.forcePresetEnv || false);
            // Analyze for i18n inlining
            if (i18n &&
                !/[\\/]@angular[\\/](?:compiler|localize)/.test(this.resourcePath) &&
                source.includes('$localize')) {
                // Load the i18n plugin creators from the new `@angular/localize/tools` entry point.
                // This may fail during the transition to ESM due to the entry point not yet existing.
                // During the transition, this will always attempt to load the entry point for each file.
                // This will only occur during prerelease and will be automatically corrected once the new
                // entry point exists.
                if (i18nPluginCreators === undefined) {
                    // Load ESM `@angular/localize/tools` using the TypeScript dynamic import workaround.
                    // Once TypeScript provides support for keeping the dynamic import this workaround can be
                    // changed to a direct dynamic import.
                    i18nPluginCreators = await (0, load_esm_1.loadEsmModule)('@angular/localize/tools');
                }
                customOptions.i18n = {
                    ...i18n,
                    pluginCreators: i18nPluginCreators,
                };
                // Add translation files as dependencies of the file to support rebuilds
                // Except for `@angular/core` which needs locale injection but has no translations
                if (customOptions.i18n.translationFiles &&
                    !/[\\/]@angular[\\/]core/.test(this.resourcePath)) {
                    for (const file of customOptions.i18n.translationFiles) {
                        this.addDependency(file);
                    }
                }
                shouldProcess = true;
            }
            if (optimize) {
                const angularPackage = /[\\/]node_modules[\\/]@angular[\\/]/.test(this.resourcePath);
                customOptions.optimize = {
                    // Angular packages provide additional tested side effects guarantees and can use
                    // otherwise unsafe optimizations.
                    looseEnums: angularPackage,
                    pureTopLevel: angularPackage,
                    // JavaScript modules that are marked as side effect free are considered to have
                    // no decorators that contain non-local effects.
                    wrapDecorators: !!((_c = (_b = this._module) === null || _b === void 0 ? void 0 : _b.factoryMeta) === null || _c === void 0 ? void 0 : _c.sideEffectFree),
                };
                shouldProcess = true;
            }
            if (instrumentCode &&
                !instrumentCode.excludedPaths.has(this.resourcePath) &&
                !/\.(e2e|spec)\.tsx?$|[\\/]node_modules[\\/]/.test(this.resourcePath) &&
                this.resourcePath.startsWith(instrumentCode.includedBasePath)) {
                // `babel-plugin-istanbul` has it's own includes but we do the below so that we avoid running the the loader.
                customOptions.instrumentCode = {
                    includedBasePath: instrumentCode.includedBasePath,
                    inputSourceMap: map,
                };
                shouldProcess = true;
            }
            // Add provided loader options to default base options
            const loaderOptions = {
                ...baseOptions,
                ...rawOptions,
                cacheIdentifier: JSON.stringify({
                    buildAngular: package_version_1.VERSION,
                    customOptions,
                    baseOptions,
                    rawOptions,
                }),
            };
            // Skip babel processing if no actions are needed
            if (!shouldProcess) {
                // Force the current file to be ignored
                loaderOptions.ignore = [() => true];
            }
            return { custom: customOptions, loader: loaderOptions };
        },
        config(configuration, { customOptions }) {
            var _a;
            return {
                ...configuration.options,
                // Using `false` disables babel from attempting to locate sourcemaps or process any inline maps.
                // The babel types do not include the false option even though it is valid
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                inputSourceMap: (_a = configuration.options.inputSourceMap) !== null && _a !== void 0 ? _a : false,
                presets: [
                    ...(configuration.options.presets || []),
                    [
                        require('./presets/application').default,
                        {
                            ...customOptions,
                            diagnosticReporter: (type, message) => {
                                switch (type) {
                                    case 'error':
                                        this.emitError(message);
                                        break;
                                    case 'info':
                                    // Webpack does not currently have an informational diagnostic
                                    case 'warning':
                                        this.emitWarning(message);
                                        break;
                                }
                            },
                        },
                    ],
                ],
            };
        },
    };
});

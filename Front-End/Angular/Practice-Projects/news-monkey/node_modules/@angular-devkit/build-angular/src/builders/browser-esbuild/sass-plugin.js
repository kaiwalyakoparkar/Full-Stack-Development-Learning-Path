"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSassPlugin = void 0;
const sass_service_1 = require("../../sass/sass-service");
function createSassPlugin(options) {
    return {
        name: 'angular-sass',
        setup(build) {
            let sass;
            build.onStart(() => {
                sass = new sass_service_1.SassWorkerImplementation();
            });
            build.onEnd(() => {
                sass === null || sass === void 0 ? void 0 : sass.close();
            });
            build.onLoad({ filter: /\.s[ac]ss$/ }, async (args) => {
                const result = await new Promise((resolve, reject) => {
                    sass.render({
                        file: args.path,
                        includePaths: options.includePaths,
                        indentedSyntax: args.path.endsWith('.sass'),
                        outputStyle: 'expanded',
                        sourceMap: options.sourcemap,
                        sourceMapContents: options.sourcemap,
                        sourceMapEmbed: options.sourcemap,
                        quietDeps: true,
                    }, (error, result) => {
                        if (error) {
                            reject(error);
                        }
                        if (result) {
                            resolve(result);
                        }
                    });
                });
                return {
                    contents: result.css,
                    loader: 'css',
                    watchFiles: result.stats.includedFiles,
                };
            });
        },
    };
}
exports.createSassPlugin = createSassPlugin;

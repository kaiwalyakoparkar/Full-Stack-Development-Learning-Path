"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logMessages = exports.bundle = exports.isEsBuildFailure = void 0;
const esbuild_1 = require("esbuild");
/**
 * Determines if an unknown value is an esbuild BuildFailure error object thrown by esbuild.
 * @param value A potential esbuild BuildFailure error object.
 * @returns `true` if the object is determined to be a BuildFailure object; otherwise, `false`.
 */
function isEsBuildFailure(value) {
    return !!value && typeof value === 'object' && 'errors' in value && 'warnings' in value;
}
exports.isEsBuildFailure = isEsBuildFailure;
/**
 * Executes the esbuild build function and normalizes the build result in the event of a
 * build failure that results in no output being generated.
 * All builds use the `write` option with a value of `false` to allow for the output files
 * build result array to be populated.
 *
 * @param options The esbuild options object to use when building.
 * @returns If output files are generated, the full esbuild BuildResult; if not, the
 * warnings and errors for the attempted build.
 */
async function bundle(options) {
    try {
        return await (0, esbuild_1.build)({
            ...options,
            write: false,
        });
    }
    catch (failure) {
        // Build failures will throw an exception which contains errors/warnings
        if (isEsBuildFailure(failure)) {
            return failure;
        }
        else {
            throw failure;
        }
    }
}
exports.bundle = bundle;
async function logMessages(context, { errors, warnings }) {
    if (warnings.length) {
        const warningMessages = await (0, esbuild_1.formatMessages)(warnings, { kind: 'warning', color: true });
        context.logger.warn(warningMessages.join('\n'));
    }
    if (errors.length) {
        const errorMessages = await (0, esbuild_1.formatMessages)(errors, { kind: 'error', color: true });
        context.logger.error(errorMessages.join('\n'));
    }
}
exports.logMessages = logMessages;

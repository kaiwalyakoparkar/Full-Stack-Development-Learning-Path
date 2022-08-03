/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Rule } from '@angular-devkit/schematics';
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
export default function (): Rule;

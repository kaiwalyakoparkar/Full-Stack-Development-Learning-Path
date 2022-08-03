/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <amd-module name="@angular/compiler-cli/src/ngtsc/partial_evaluator/src/synthetic" />
/**
 * A value produced which originated in a `ForeignFunctionResolver` and doesn't come from the
 * template itself.
 *
 * Synthetic values cannot be further evaluated, and attempts to do so produce `DynamicValue`s
 * instead.
 */
export declare class SyntheticValue<T> {
    readonly value: T;
    constructor(value: T);
}

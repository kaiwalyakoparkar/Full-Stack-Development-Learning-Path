/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { EventEmitter, ɵRuntimeError as RuntimeError } from '@angular/core';
import { asyncValidatorsDroppedWithOptsWarning, missingControlError, missingControlValueError, noControlsError } from '../directives/reactive_errors';
import { addValidators, composeAsyncValidators, composeValidators, hasValidator, removeValidators, toObservable } from '../validators';
const NG_DEV_MODE = typeof ngDevMode === 'undefined' || !!ngDevMode;
/**
 * Reports that a control is valid, meaning that no errors exist in the input value.
 *
 * @see `status`
 */
export const VALID = 'VALID';
/**
 * Reports that a control is invalid, meaning that an error exists in the input value.
 *
 * @see `status`
 */
export const INVALID = 'INVALID';
/**
 * Reports that a control is pending, meaning that that async validation is occurring and
 * errors are not yet available for the input value.
 *
 * @see `markAsPending`
 * @see `status`
 */
export const PENDING = 'PENDING';
/**
 * Reports that a control is disabled, meaning that the control is exempt from ancestor
 * calculations of validity or value.
 *
 * @see `markAsDisabled`
 * @see `status`
 */
export const DISABLED = 'DISABLED';
/**
 * Gets validators from either an options object or given validators.
 */
export function pickValidators(validatorOrOpts) {
    return (isOptionsObj(validatorOrOpts) ? validatorOrOpts.validators : validatorOrOpts) || null;
}
/**
 * Creates validator function by combining provided validators.
 */
function coerceToValidator(validator) {
    return Array.isArray(validator) ? composeValidators(validator) : validator || null;
}
/**
 * Gets async validators from either an options object or given validators.
 */
export function pickAsyncValidators(asyncValidator, validatorOrOpts) {
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
        if (isOptionsObj(validatorOrOpts) && asyncValidator) {
            console.warn(asyncValidatorsDroppedWithOptsWarning);
        }
    }
    return (isOptionsObj(validatorOrOpts) ? validatorOrOpts.asyncValidators : asyncValidator) || null;
}
/**
 * Creates async validator function by combining provided async validators.
 */
function coerceToAsyncValidator(asyncValidator) {
    return Array.isArray(asyncValidator) ? composeAsyncValidators(asyncValidator) :
        asyncValidator || null;
}
export function isOptionsObj(validatorOrOpts) {
    return validatorOrOpts != null && !Array.isArray(validatorOrOpts) &&
        typeof validatorOrOpts === 'object';
}
export function assertControlPresent(parent, isGroup, key) {
    const controls = parent.controls;
    const collection = isGroup ? Object.keys(controls) : controls;
    if (!collection.length) {
        throw new RuntimeError(1000 /* RuntimeErrorCode.NO_CONTROLS */, NG_DEV_MODE ? noControlsError(isGroup) : '');
    }
    if (!controls[key]) {
        throw new RuntimeError(1001 /* RuntimeErrorCode.MISSING_CONTROL */, NG_DEV_MODE ? missingControlError(isGroup, key) : '');
    }
}
export function assertAllValuesPresent(control, isGroup, value) {
    control._forEachChild((_, key) => {
        if (value[key] === undefined) {
            throw new RuntimeError(1002 /* RuntimeErrorCode.MISSING_CONTROL_VALUE */, NG_DEV_MODE ? missingControlValueError(isGroup, key) : '');
        }
    });
}
// clang-format on
/**
 * This is the base class for `FormControl`, `FormGroup`, and `FormArray`.
 *
 * It provides some of the shared behavior that all controls and groups of controls have, like
 * running validators, calculating status, and resetting state. It also defines the properties
 * that are shared between all sub-classes, like `value`, `valid`, and `dirty`. It shouldn't be
 * instantiated directly.
 *
 * The first type parameter TValue represents the value type of the control (`control.value`).
 * The optional type parameter TRawValue  represents the raw value type (`control.getRawValue()`).
 *
 * @see [Forms Guide](/guide/forms)
 * @see [Reactive Forms Guide](/guide/reactive-forms)
 * @see [Dynamic Forms Guide](/guide/dynamic-form)
 *
 * @publicApi
 */
export class AbstractControl {
    /**
     * Initialize the AbstractControl instance.
     *
     * @param validators The function or array of functions that is used to determine the validity of
     *     this control synchronously.
     * @param asyncValidators The function or array of functions that is used to determine validity of
     *     this control asynchronously.
     */
    constructor(validators, asyncValidators) {
        /** @internal */
        this._pendingDirty = false;
        /**
         * Indicates that a control has its own pending asynchronous validation in progress.
         *
         * @internal
         */
        this._hasOwnPendingAsyncValidator = false;
        /** @internal */
        this._pendingTouched = false;
        /** @internal */
        this._onCollectionChange = () => { };
        this._parent = null;
        /**
         * A control is `pristine` if the user has not yet changed
         * the value in the UI.
         *
         * @returns True if the user has not yet changed the value in the UI; compare `dirty`.
         * Programmatic changes to a control's value do not mark it dirty.
         */
        this.pristine = true;
        /**
         * True if the control is marked as `touched`.
         *
         * A control is marked `touched` once the user has triggered
         * a `blur` event on it.
         */
        this.touched = false;
        /** @internal */
        this._onDisabledChange = [];
        this._rawValidators = validators;
        this._rawAsyncValidators = asyncValidators;
        this._composedValidatorFn = coerceToValidator(this._rawValidators);
        this._composedAsyncValidatorFn = coerceToAsyncValidator(this._rawAsyncValidators);
    }
    /**
     * Returns the function that is used to determine the validity of this control synchronously.
     * If multiple validators have been added, this will be a single composed function.
     * See `Validators.compose()` for additional information.
     */
    get validator() {
        return this._composedValidatorFn;
    }
    set validator(validatorFn) {
        this._rawValidators = this._composedValidatorFn = validatorFn;
    }
    /**
     * Returns the function that is used to determine the validity of this control asynchronously.
     * If multiple validators have been added, this will be a single composed function.
     * See `Validators.compose()` for additional information.
     */
    get asyncValidator() {
        return this._composedAsyncValidatorFn;
    }
    set asyncValidator(asyncValidatorFn) {
        this._rawAsyncValidators = this._composedAsyncValidatorFn = asyncValidatorFn;
    }
    /**
     * The parent control.
     */
    get parent() {
        return this._parent;
    }
    /**
     * A control is `valid` when its `status` is `VALID`.
     *
     * @see {@link AbstractControl.status}
     *
     * @returns True if the control has passed all of its validation tests,
     * false otherwise.
     */
    get valid() {
        return this.status === VALID;
    }
    /**
     * A control is `invalid` when its `status` is `INVALID`.
     *
     * @see {@link AbstractControl.status}
     *
     * @returns True if this control has failed one or more of its validation checks,
     * false otherwise.
     */
    get invalid() {
        return this.status === INVALID;
    }
    /**
     * A control is `pending` when its `status` is `PENDING`.
     *
     * @see {@link AbstractControl.status}
     *
     * @returns True if this control is in the process of conducting a validation check,
     * false otherwise.
     */
    get pending() {
        return this.status == PENDING;
    }
    /**
     * A control is `disabled` when its `status` is `DISABLED`.
     *
     * Disabled controls are exempt from validation checks and
     * are not included in the aggregate value of their ancestor
     * controls.
     *
     * @see {@link AbstractControl.status}
     *
     * @returns True if the control is disabled, false otherwise.
     */
    get disabled() {
        return this.status === DISABLED;
    }
    /**
     * A control is `enabled` as long as its `status` is not `DISABLED`.
     *
     * @returns True if the control has any status other than 'DISABLED',
     * false if the status is 'DISABLED'.
     *
     * @see {@link AbstractControl.status}
     *
     */
    get enabled() {
        return this.status !== DISABLED;
    }
    /**
     * A control is `dirty` if the user has changed the value
     * in the UI.
     *
     * @returns True if the user has changed the value of this control in the UI; compare `pristine`.
     * Programmatic changes to a control's value do not mark it dirty.
     */
    get dirty() {
        return !this.pristine;
    }
    /**
     * True if the control has not been marked as touched
     *
     * A control is `untouched` if the user has not yet triggered
     * a `blur` event on it.
     */
    get untouched() {
        return !this.touched;
    }
    /**
     * Reports the update strategy of the `AbstractControl` (meaning
     * the event on which the control updates itself).
     * Possible values: `'change'` | `'blur'` | `'submit'`
     * Default value: `'change'`
     */
    get updateOn() {
        return this._updateOn ? this._updateOn : (this.parent ? this.parent.updateOn : 'change');
    }
    /**
     * Sets the synchronous validators that are active on this control.  Calling
     * this overwrites any existing synchronous validators.
     *
     * When you add or remove a validator at run time, you must call
     * `updateValueAndValidity()` for the new validation to take effect.
     *
     * If you want to add a new validator without affecting existing ones, consider
     * using `addValidators()` method instead.
     */
    setValidators(validators) {
        this._rawValidators = validators;
        this._composedValidatorFn = coerceToValidator(validators);
    }
    /**
     * Sets the asynchronous validators that are active on this control. Calling this
     * overwrites any existing asynchronous validators.
     *
     * When you add or remove a validator at run time, you must call
     * `updateValueAndValidity()` for the new validation to take effect.
     *
     * If you want to add a new validator without affecting existing ones, consider
     * using `addAsyncValidators()` method instead.
     */
    setAsyncValidators(validators) {
        this._rawAsyncValidators = validators;
        this._composedAsyncValidatorFn = coerceToAsyncValidator(validators);
    }
    /**
     * Add a synchronous validator or validators to this control, without affecting other validators.
     *
     * When you add or remove a validator at run time, you must call
     * `updateValueAndValidity()` for the new validation to take effect.
     *
     * Adding a validator that already exists will have no effect. If duplicate validator functions
     * are present in the `validators` array, only the first instance would be added to a form
     * control.
     *
     * @param validators The new validator function or functions to add to this control.
     */
    addValidators(validators) {
        this.setValidators(addValidators(validators, this._rawValidators));
    }
    /**
     * Add an asynchronous validator or validators to this control, without affecting other
     * validators.
     *
     * When you add or remove a validator at run time, you must call
     * `updateValueAndValidity()` for the new validation to take effect.
     *
     * Adding a validator that already exists will have no effect.
     *
     * @param validators The new asynchronous validator function or functions to add to this control.
     */
    addAsyncValidators(validators) {
        this.setAsyncValidators(addValidators(validators, this._rawAsyncValidators));
    }
    /**
     * Remove a synchronous validator from this control, without affecting other validators.
     * Validators are compared by function reference; you must pass a reference to the exact same
     * validator function as the one that was originally set. If a provided validator is not found,
     * it is ignored.
     *
     * @usageNotes
     *
     * ### Reference to a ValidatorFn
     *
     * ```
     * // Reference to the RequiredValidator
     * const ctrl = new FormControl<string | null>('', Validators.required);
     * ctrl.removeValidators(Validators.required);
     *
     * // Reference to anonymous function inside MinValidator
     * const minValidator = Validators.min(3);
     * const ctrl = new FormControl<string | null>('', minValidator);
     * expect(ctrl.hasValidator(minValidator)).toEqual(true)
     * expect(ctrl.hasValidator(Validators.min(3)).toEqual(false)
     *
     * ctrl.removeValidators(minValidator);
     * ```
     *
     * When you add or remove a validator at run time, you must call
     * `updateValueAndValidity()` for the new validation to take effect.
     *
     * @param validators The validator or validators to remove.
     */
    removeValidators(validators) {
        this.setValidators(removeValidators(validators, this._rawValidators));
    }
    /**
     * Remove an asynchronous validator from this control, without affecting other validators.
     * Validators are compared by function reference; you must pass a reference to the exact same
     * validator function as the one that was originally set. If a provided validator is not found, it
     * is ignored.
     *
     * When you add or remove a validator at run time, you must call
     * `updateValueAndValidity()` for the new validation to take effect.
     *
     * @param validators The asynchronous validator or validators to remove.
     */
    removeAsyncValidators(validators) {
        this.setAsyncValidators(removeValidators(validators, this._rawAsyncValidators));
    }
    /**
     * Check whether a synchronous validator function is present on this control. The provided
     * validator must be a reference to the exact same function that was provided.
     *
     * @usageNotes
     *
     * ### Reference to a ValidatorFn
     *
     * ```
     * // Reference to the RequiredValidator
     * const ctrl = new FormControl<number | null>(0, Validators.required);
     * expect(ctrl.hasValidator(Validators.required)).toEqual(true)
     *
     * // Reference to anonymous function inside MinValidator
     * const minValidator = Validators.min(3);
     * const ctrl = new FormControl<number | null>(0, minValidator);
     * expect(ctrl.hasValidator(minValidator)).toEqual(true)
     * expect(ctrl.hasValidator(Validators.min(3)).toEqual(false)
     * ```
     *
     * @param validator The validator to check for presence. Compared by function reference.
     * @returns Whether the provided validator was found on this control.
     */
    hasValidator(validator) {
        return hasValidator(this._rawValidators, validator);
    }
    /**
     * Check whether an asynchronous validator function is present on this control. The provided
     * validator must be a reference to the exact same function that was provided.
     *
     * @param validator The asynchronous validator to check for presence. Compared by function
     *     reference.
     * @returns Whether the provided asynchronous validator was found on this control.
     */
    hasAsyncValidator(validator) {
        return hasValidator(this._rawAsyncValidators, validator);
    }
    /**
     * Empties out the synchronous validator list.
     *
     * When you add or remove a validator at run time, you must call
     * `updateValueAndValidity()` for the new validation to take effect.
     *
     */
    clearValidators() {
        this.validator = null;
    }
    /**
     * Empties out the async validator list.
     *
     * When you add or remove a validator at run time, you must call
     * `updateValueAndValidity()` for the new validation to take effect.
     *
     */
    clearAsyncValidators() {
        this.asyncValidator = null;
    }
    /**
     * Marks the control as `touched`. A control is touched by focus and
     * blur events that do not change the value.
     *
     * @see `markAsUntouched()`
     * @see `markAsDirty()`
     * @see `markAsPristine()`
     *
     * @param opts Configuration options that determine how the control propagates changes
     * and emits events after marking is applied.
     * * `onlySelf`: When true, mark only this control. When false or not supplied,
     * marks all direct ancestors. Default is false.
     */
    markAsTouched(opts = {}) {
        this.touched = true;
        if (this._parent && !opts.onlySelf) {
            this._parent.markAsTouched(opts);
        }
    }
    /**
     * Marks the control and all its descendant controls as `touched`.
     * @see `markAsTouched()`
     */
    markAllAsTouched() {
        this.markAsTouched({ onlySelf: true });
        this._forEachChild((control) => control.markAllAsTouched());
    }
    /**
     * Marks the control as `untouched`.
     *
     * If the control has any children, also marks all children as `untouched`
     * and recalculates the `touched` status of all parent controls.
     *
     * @see `markAsTouched()`
     * @see `markAsDirty()`
     * @see `markAsPristine()`
     *
     * @param opts Configuration options that determine how the control propagates changes
     * and emits events after the marking is applied.
     * * `onlySelf`: When true, mark only this control. When false or not supplied,
     * marks all direct ancestors. Default is false.
     */
    markAsUntouched(opts = {}) {
        this.touched = false;
        this._pendingTouched = false;
        this._forEachChild((control) => {
            control.markAsUntouched({ onlySelf: true });
        });
        if (this._parent && !opts.onlySelf) {
            this._parent._updateTouched(opts);
        }
    }
    /**
     * Marks the control as `dirty`. A control becomes dirty when
     * the control's value is changed through the UI; compare `markAsTouched`.
     *
     * @see `markAsTouched()`
     * @see `markAsUntouched()`
     * @see `markAsPristine()`
     *
     * @param opts Configuration options that determine how the control propagates changes
     * and emits events after marking is applied.
     * * `onlySelf`: When true, mark only this control. When false or not supplied,
     * marks all direct ancestors. Default is false.
     */
    markAsDirty(opts = {}) {
        this.pristine = false;
        if (this._parent && !opts.onlySelf) {
            this._parent.markAsDirty(opts);
        }
    }
    /**
     * Marks the control as `pristine`.
     *
     * If the control has any children, marks all children as `pristine`,
     * and recalculates the `pristine` status of all parent
     * controls.
     *
     * @see `markAsTouched()`
     * @see `markAsUntouched()`
     * @see `markAsDirty()`
     *
     * @param opts Configuration options that determine how the control emits events after
     * marking is applied.
     * * `onlySelf`: When true, mark only this control. When false or not supplied,
     * marks all direct ancestors. Default is false.
     */
    markAsPristine(opts = {}) {
        this.pristine = true;
        this._pendingDirty = false;
        this._forEachChild((control) => {
            control.markAsPristine({ onlySelf: true });
        });
        if (this._parent && !opts.onlySelf) {
            this._parent._updatePristine(opts);
        }
    }
    /**
     * Marks the control as `pending`.
     *
     * A control is pending while the control performs async validation.
     *
     * @see {@link AbstractControl.status}
     *
     * @param opts Configuration options that determine how the control propagates changes and
     * emits events after marking is applied.
     * * `onlySelf`: When true, mark only this control. When false or not supplied,
     * marks all direct ancestors. Default is false.
     * * `emitEvent`: When true or not supplied (the default), the `statusChanges`
     * observable emits an event with the latest status the control is marked pending.
     * When false, no events are emitted.
     *
     */
    markAsPending(opts = {}) {
        this.status = PENDING;
        if (opts.emitEvent !== false) {
            this.statusChanges.emit(this.status);
        }
        if (this._parent && !opts.onlySelf) {
            this._parent.markAsPending(opts);
        }
    }
    /**
     * Disables the control. This means the control is exempt from validation checks and
     * excluded from the aggregate value of any parent. Its status is `DISABLED`.
     *
     * If the control has children, all children are also disabled.
     *
     * @see {@link AbstractControl.status}
     *
     * @param opts Configuration options that determine how the control propagates
     * changes and emits events after the control is disabled.
     * * `onlySelf`: When true, mark only this control. When false or not supplied,
     * marks all direct ancestors. Default is false.
     * * `emitEvent`: When true or not supplied (the default), both the `statusChanges` and
     * `valueChanges`
     * observables emit events with the latest status and value when the control is disabled.
     * When false, no events are emitted.
     */
    disable(opts = {}) {
        // If parent has been marked artificially dirty we don't want to re-calculate the
        // parent's dirtiness based on the children.
        const skipPristineCheck = this._parentMarkedDirty(opts.onlySelf);
        this.status = DISABLED;
        this.errors = null;
        this._forEachChild((control) => {
            control.disable({ ...opts, onlySelf: true });
        });
        this._updateValue();
        if (opts.emitEvent !== false) {
            this.valueChanges.emit(this.value);
            this.statusChanges.emit(this.status);
        }
        this._updateAncestors({ ...opts, skipPristineCheck });
        this._onDisabledChange.forEach((changeFn) => changeFn(true));
    }
    /**
     * Enables the control. This means the control is included in validation checks and
     * the aggregate value of its parent. Its status recalculates based on its value and
     * its validators.
     *
     * By default, if the control has children, all children are enabled.
     *
     * @see {@link AbstractControl.status}
     *
     * @param opts Configure options that control how the control propagates changes and
     * emits events when marked as untouched
     * * `onlySelf`: When true, mark only this control. When false or not supplied,
     * marks all direct ancestors. Default is false.
     * * `emitEvent`: When true or not supplied (the default), both the `statusChanges` and
     * `valueChanges`
     * observables emit events with the latest status and value when the control is enabled.
     * When false, no events are emitted.
     */
    enable(opts = {}) {
        // If parent has been marked artificially dirty we don't want to re-calculate the
        // parent's dirtiness based on the children.
        const skipPristineCheck = this._parentMarkedDirty(opts.onlySelf);
        this.status = VALID;
        this._forEachChild((control) => {
            control.enable({ ...opts, onlySelf: true });
        });
        this.updateValueAndValidity({ onlySelf: true, emitEvent: opts.emitEvent });
        this._updateAncestors({ ...opts, skipPristineCheck });
        this._onDisabledChange.forEach((changeFn) => changeFn(false));
    }
    _updateAncestors(opts) {
        if (this._parent && !opts.onlySelf) {
            this._parent.updateValueAndValidity(opts);
            if (!opts.skipPristineCheck) {
                this._parent._updatePristine();
            }
            this._parent._updateTouched();
        }
    }
    /**
     * Sets the parent of the control
     *
     * @param parent The new parent.
     */
    setParent(parent) {
        this._parent = parent;
    }
    /**
     * The raw value of this control. For most control implementations, the raw value will include
     * disabled children.
     */
    getRawValue() {
        return this.value;
    }
    /**
     * Recalculates the value and validation status of the control.
     *
     * By default, it also updates the value and validity of its ancestors.
     *
     * @param opts Configuration options determine how the control propagates changes and emits events
     * after updates and validity checks are applied.
     * * `onlySelf`: When true, only update this control. When false or not supplied,
     * update all direct ancestors. Default is false.
     * * `emitEvent`: When true or not supplied (the default), both the `statusChanges` and
     * `valueChanges`
     * observables emit events with the latest status and value when the control is updated.
     * When false, no events are emitted.
     */
    updateValueAndValidity(opts = {}) {
        this._setInitialStatus();
        this._updateValue();
        if (this.enabled) {
            this._cancelExistingSubscription();
            this.errors = this._runValidator();
            this.status = this._calculateStatus();
            if (this.status === VALID || this.status === PENDING) {
                this._runAsyncValidator(opts.emitEvent);
            }
        }
        if (opts.emitEvent !== false) {
            this.valueChanges.emit(this.value);
            this.statusChanges.emit(this.status);
        }
        if (this._parent && !opts.onlySelf) {
            this._parent.updateValueAndValidity(opts);
        }
    }
    /** @internal */
    _updateTreeValidity(opts = { emitEvent: true }) {
        this._forEachChild((ctrl) => ctrl._updateTreeValidity(opts));
        this.updateValueAndValidity({ onlySelf: true, emitEvent: opts.emitEvent });
    }
    _setInitialStatus() {
        this.status = this._allControlsDisabled() ? DISABLED : VALID;
    }
    _runValidator() {
        return this.validator ? this.validator(this) : null;
    }
    _runAsyncValidator(emitEvent) {
        if (this.asyncValidator) {
            this.status = PENDING;
            this._hasOwnPendingAsyncValidator = true;
            const obs = toObservable(this.asyncValidator(this));
            this._asyncValidationSubscription = obs.subscribe((errors) => {
                this._hasOwnPendingAsyncValidator = false;
                // This will trigger the recalculation of the validation status, which depends on
                // the state of the asynchronous validation (whether it is in progress or not). So, it is
                // necessary that we have updated the `_hasOwnPendingAsyncValidator` boolean flag first.
                this.setErrors(errors, { emitEvent });
            });
        }
    }
    _cancelExistingSubscription() {
        if (this._asyncValidationSubscription) {
            this._asyncValidationSubscription.unsubscribe();
            this._hasOwnPendingAsyncValidator = false;
        }
    }
    /**
     * Sets errors on a form control when running validations manually, rather than automatically.
     *
     * Calling `setErrors` also updates the validity of the parent control.
     *
     * @usageNotes
     *
     * ### Manually set the errors for a control
     *
     * ```
     * const login = new FormControl('someLogin');
     * login.setErrors({
     *   notUnique: true
     * });
     *
     * expect(login.valid).toEqual(false);
     * expect(login.errors).toEqual({ notUnique: true });
     *
     * login.setValue('someOtherLogin');
     *
     * expect(login.valid).toEqual(true);
     * ```
     */
    setErrors(errors, opts = {}) {
        this.errors = errors;
        this._updateControlsErrors(opts.emitEvent !== false);
    }
    /**
     * Retrieves a child control given the control's name or path.
     *
     * @param path A dot-delimited string or array of string/number values that define the path to the
     * control. If a string is provided, passing it as a string literal will result in improved type
     * information. Likewise, if an array is provided, passing it `as const` will cause improved type
     * information to be available.
     *
     * @usageNotes
     * ### Retrieve a nested control
     *
     * For example, to get a `name` control nested within a `person` sub-group:
     *
     * * `this.form.get('person.name');`
     *
     * -OR-
     *
     * * `this.form.get(['person', 'name'] as const);` // `as const` gives improved typings
     *
     * ### Retrieve a control in a FormArray
     *
     * When accessing an element inside a FormArray, you can use an element index.
     * For example, to get a `price` control from the first element in an `items` array you can use:
     *
     * * `this.form.get('items.0.price');`
     *
     * -OR-
     *
     * * `this.form.get(['items', 0, 'price']);`
     */
    get(path) {
        let currPath = path;
        if (currPath == null)
            return null;
        if (!Array.isArray(currPath))
            currPath = currPath.split('.');
        if (currPath.length === 0)
            return null;
        return currPath.reduce((control, name) => control && control._find(name), this);
    }
    /**
     * @description
     * Reports error data for the control with the given path.
     *
     * @param errorCode The code of the error to check
     * @param path A list of control names that designates how to move from the current control
     * to the control that should be queried for errors.
     *
     * @usageNotes
     * For example, for the following `FormGroup`:
     *
     * ```
     * form = new FormGroup({
     *   address: new FormGroup({ street: new FormControl() })
     * });
     * ```
     *
     * The path to the 'street' control from the root form would be 'address' -> 'street'.
     *
     * It can be provided to this method in one of two formats:
     *
     * 1. An array of string control names, e.g. `['address', 'street']`
     * 1. A period-delimited list of control names in one string, e.g. `'address.street'`
     *
     * @returns error data for that particular error. If the control or error is not present,
     * null is returned.
     */
    getError(errorCode, path) {
        const control = path ? this.get(path) : this;
        return control && control.errors ? control.errors[errorCode] : null;
    }
    /**
     * @description
     * Reports whether the control with the given path has the error specified.
     *
     * @param errorCode The code of the error to check
     * @param path A list of control names that designates how to move from the current control
     * to the control that should be queried for errors.
     *
     * @usageNotes
     * For example, for the following `FormGroup`:
     *
     * ```
     * form = new FormGroup({
     *   address: new FormGroup({ street: new FormControl() })
     * });
     * ```
     *
     * The path to the 'street' control from the root form would be 'address' -> 'street'.
     *
     * It can be provided to this method in one of two formats:
     *
     * 1. An array of string control names, e.g. `['address', 'street']`
     * 1. A period-delimited list of control names in one string, e.g. `'address.street'`
     *
     * If no path is given, this method checks for the error on the current control.
     *
     * @returns whether the given error is present in the control at the given path.
     *
     * If the control is not present, false is returned.
     */
    hasError(errorCode, path) {
        return !!this.getError(errorCode, path);
    }
    /**
     * Retrieves the top-level ancestor of this control.
     */
    get root() {
        let x = this;
        while (x._parent) {
            x = x._parent;
        }
        return x;
    }
    /** @internal */
    _updateControlsErrors(emitEvent) {
        this.status = this._calculateStatus();
        if (emitEvent) {
            this.statusChanges.emit(this.status);
        }
        if (this._parent) {
            this._parent._updateControlsErrors(emitEvent);
        }
    }
    /** @internal */
    _initObservables() {
        this.valueChanges = new EventEmitter();
        this.statusChanges = new EventEmitter();
    }
    _calculateStatus() {
        if (this._allControlsDisabled())
            return DISABLED;
        if (this.errors)
            return INVALID;
        if (this._hasOwnPendingAsyncValidator || this._anyControlsHaveStatus(PENDING))
            return PENDING;
        if (this._anyControlsHaveStatus(INVALID))
            return INVALID;
        return VALID;
    }
    /** @internal */
    _anyControlsHaveStatus(status) {
        return this._anyControls((control) => control.status === status);
    }
    /** @internal */
    _anyControlsDirty() {
        return this._anyControls((control) => control.dirty);
    }
    /** @internal */
    _anyControlsTouched() {
        return this._anyControls((control) => control.touched);
    }
    /** @internal */
    _updatePristine(opts = {}) {
        this.pristine = !this._anyControlsDirty();
        if (this._parent && !opts.onlySelf) {
            this._parent._updatePristine(opts);
        }
    }
    /** @internal */
    _updateTouched(opts = {}) {
        this.touched = this._anyControlsTouched();
        if (this._parent && !opts.onlySelf) {
            this._parent._updateTouched(opts);
        }
    }
    /** @internal */
    _registerOnCollectionChange(fn) {
        this._onCollectionChange = fn;
    }
    /** @internal */
    _setUpdateStrategy(opts) {
        if (isOptionsObj(opts) && opts.updateOn != null) {
            this._updateOn = opts.updateOn;
        }
    }
    /**
     * Check to see if parent has been marked artificially dirty.
     *
     * @internal
     */
    _parentMarkedDirty(onlySelf) {
        const parentDirty = this._parent && this._parent.dirty;
        return !onlySelf && !!parentDirty && !this._parent._anyControlsDirty();
    }
    /** @internal */
    _find(name) {
        return null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWJzdHJhY3RfbW9kZWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9mb3Jtcy9zcmMvbW9kZWwvYWJzdHJhY3RfbW9kZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFlBQVksRUFBRSxhQUFhLElBQUksWUFBWSxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRzFFLE9BQU8sRUFBQyxxQ0FBcUMsRUFBRSxtQkFBbUIsRUFBRSx3QkFBd0IsRUFBRSxlQUFlLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUlwSixPQUFPLEVBQUMsYUFBYSxFQUFFLHNCQUFzQixFQUFFLGlCQUFpQixFQUFFLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSxZQUFZLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFFckksTUFBTSxXQUFXLEdBQUcsT0FBTyxTQUFTLEtBQUssV0FBVyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFFcEU7Ozs7R0FJRztBQUNILE1BQU0sQ0FBQyxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUM7QUFFN0I7Ozs7R0FJRztBQUNILE1BQU0sQ0FBQyxNQUFNLE9BQU8sR0FBRyxTQUFTLENBQUM7QUFFakM7Ozs7OztHQU1HO0FBQ0gsTUFBTSxDQUFDLE1BQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQztBQUVqQzs7Ozs7O0dBTUc7QUFDSCxNQUFNLENBQUMsTUFBTSxRQUFRLEdBQUcsVUFBVSxDQUFDO0FBbUJuQzs7R0FFRztBQUNILE1BQU0sVUFBVSxjQUFjLENBQUMsZUFDSTtJQUNqQyxPQUFPLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUMsSUFBSSxJQUFJLENBQUM7QUFDaEcsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxpQkFBaUIsQ0FBQyxTQUF5QztJQUNsRSxP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QyxJQUE0RDtRQUM3RSxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsUUFBUSxJQUFJLElBQUksRUFBRTtZQUMvQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxRQUFTLENBQUM7U0FDakM7SUFDSCxDQUFDO0lBQ0Q7Ozs7T0FJRztJQUNLLGtCQUFrQixDQUFDLFFBQWtCO1FBQzNDLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7UUFDdkQsT0FBTyxDQUFDLFFBQVEsSUFBSSxDQUFDLENBQUMsV0FBVyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQVEsQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO0lBQzFFLENBQUM7SUFFRCxnQkFBZ0I7SUFDaEIsS0FBSyxDQUFDLElBQW1CO1FBQ3ZCLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7RXZlbnRFbWl0dGVyLCDJtVJ1bnRpbWVFcnJvciBhcyBSdW50aW1lRXJyb3J9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHtPYnNlcnZhYmxlfSBmcm9tICdyeGpzJztcblxuaW1wb3J0IHthc3luY1ZhbGlkYXRvcnNEcm9wcGVkV2l0aE9wdHNXYXJuaW5nLCBtaXNzaW5nQ29udHJvbEVycm9yLCBtaXNzaW5nQ29udHJvbFZhbHVlRXJyb3IsIG5vQ29udHJvbHNFcnJvcn0gZnJvbSAnLi4vZGlyZWN0aXZlcy9yZWFjdGl2ZV9lcnJvcnMnO1xuaW1wb3J0IHtBc3luY1ZhbGlkYXRvckZuLCBWYWxpZGF0aW9uRXJyb3JzLCBWYWxpZGF0b3JGbn0gZnJvbSAnLi4vZGlyZWN0aXZlcy92YWxpZGF0b3JzJztcbmltcG9ydCB7UnVudGltZUVycm9yQ29kZX0gZnJvbSAnLi4vZXJyb3JzJztcbmltcG9ydCB7Rm9ybUFycmF5LCBGb3JtR3JvdXB9IGZyb20gJy4uL2Zvcm1zJztcbmltcG9ydCB7YWRkVmFsaWRhdG9ycywgY29tcG9zZUFzeW5jVmFsaWRhdG9ycywgY29tcG9zZVZhbGlkYXRvcnMsIGhhc1ZhbGlkYXRvciwgcmVtb3ZlVmFsaWRhdG9ycywgdG9PYnNlcnZhYmxlfSBmcm9tICcuLi92YWxpZGF0b3JzJztcblxuY29uc3QgTkdfREVWX01PREUgPSB0eXBlb2YgbmdEZXZNb2RlID09PSAndW5kZWZpbmVkJyB8fCAhIW5nRGV2TW9kZTtcblxuLyoqXG4gKiBSZXBvcnRzIHRoYXQgYSBjb250cm9sIGlzIHZhbGlkLCBtZWFuaW5nIHRoYXQgbm8gZXJyb3JzIGV4aXN0IGluIHRoZSBpbnB1dCB2YWx1ZS5cbiAqXG4gKiBAc2VlIGBzdGF0dXNgXG4gKi9cbmV4cG9ydCBjb25zdCBWQUxJRCA9ICdWQUxJRCc7XG5cbi8qKlxuICogUmVwb3J0cyB0aGF0IGEgY29udHJvbCBpcyBpbnZhbGlkLCBtZWFuaW5nIHRoYXQgYW4gZXJyb3IgZXhpc3RzIGluIHRoZSBpbnB1dCB2YWx1ZS5cbiAqXG4gKiBAc2VlIGBzdGF0dXNgXG4gKi9cbmV4cG9ydCBjb25zdCBJTlZBTElEID0gJ0lOVkFMSUQnO1xuXG4vKipcbiAqIFJlcG9ydHMgdGhhdCBhIGNvbnRyb2wgaXMgcGVuZGluZywgbWVhbmluZyB0aGF0IHRoYXQgYXN5bmMgdmFsaWRhdGlvbiBpcyBvY2N1cnJpbmcgYW5kXG4gKiBlcnJvcnMgYXJlIG5vdCB5ZXQgYXZhaWxhYmxlIGZvciB0aGUgaW5wdXQgdmFsdWUuXG4gKlxuICogQHNlZSBgbWFya0FzUGVuZGluZ2BcbiAqIEBzZWUgYHN0YXR1c2BcbiAqL1xuZXhwb3J0IGNvbnN0IFBFTkRJTkcgPSAnUEVORElORyc7XG5cbi8qKlxuICogUmVwb3J0cyB0aGF0IGEgY29udHJvbCBpcyBkaXNhYmxlZCwgbWVhbmluZyB0aGF0IHRoZSBjb250cm9sIGlzIGV4ZW1wdCBmcm9tIGFuY2VzdG9yXG4gKiBjYWxjdWxhdGlvbnMgb2YgdmFsaWRpdHkgb3IgdmFsdWUuXG4gKlxuICogQHNlZSBgbWFya0FzRGlzYWJsZWRgXG4gKiBAc2VlIGBzdGF0dXNgXG4gKi9cbmV4cG9ydCBjb25zdCBESVNBQkxFRCA9ICdESVNBQkxFRCc7XG5cbi8qKlxuICogQSBmb3JtIGNhbiBoYXZlIHNldmVyYWwgZGlmZmVyZW50IHN0YXR1c2VzLiBFYWNoXG4gKiBwb3NzaWJsZSBzdGF0dXMgaXMgcmV0dXJuZWQgYXMgYSBzdHJpbmcgbGl0ZXJhbC5cbiAqXG4gKiAqICoqVkFMSUQqKjogUmVwb3J0cyB0aGF0IGEgY29udHJvbCBpcyB2YWxpZCwgbWVhbmluZyB0aGF0IG5vIGVycm9ycyBleGlzdCBpbiB0aGUgaW5wdXRcbiAqIHZhbHVlLlxuICogKiAqKklOVkFMSUQqKjogUmVwb3J0cyB0aGF0IGEgY29udHJvbCBpcyBpbnZhbGlkLCBtZWFuaW5nIHRoYXQgYW4gZXJyb3IgZXhpc3RzIGluIHRoZSBpbnB1dFxuICogdmFsdWUuXG4gKiAqICoqUEVORElORyoqOiBSZXBvcnRzIHRoYXQgYSBjb250cm9sIGlzIHBlbmRpbmcsIG1lYW5pbmcgdGhhdCB0aGF0IGFzeW5jIHZhbGlkYXRpb24gaXNcbiAqIG9jY3VycmluZyBhbmQgZXJyb3JzIGFyZSBub3QgeWV0IGF2YWlsYWJsZSBmb3IgdGhlIGlucHV0IHZhbHVlLlxuICogKiAqKkRJU0FCTEVEKio6IFJlcG9ydHMgdGhhdCBhIGNvbnRyb2wgaXNcbiAqIGRpc2FibGVkLCBtZWFuaW5nIHRoYXQgdGhlIGNvbnRyb2wgaXMgZXhlbXB0IGZyb20gYW5jZXN0b3IgY2FsY3VsYXRpb25zIG9mIHZhbGlkaXR5IG9yIHZhbHVlLlxuICpcbiAqIEBwdWJsaWNBcGlcbiAqL1xuZXhwb3J0IHR5cGUgRm9ybUNvbnRyb2xTdGF0dXMgPSAnVkFMSUQnfCdJTlZBTElEJ3wnUEVORElORyd8J0RJU0FCTEVEJztcblxuLyoqXG4gKiBHZXRzIHZhbGlkYXRvcnMgZnJvbSBlaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgZ2l2ZW4gdmFsaWRhdG9ycy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBpY2tWYWxpZGF0b3JzKHZhbGlkYXRvck9yT3B0cz86IFZhbGlkYXRvckZufFZhbGlkYXRvckZuW118QWJzdHJhY3RDb250cm9sT3B0aW9uc3xcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsKTogVmFsaWRhdG9yRm58VmFsaWRhdG9yRm5bXXxudWxsIHtcbiAgcmV0dXJuIChpc09wdGlvbnNPYmoodmFsaWRhdG9yT3JPcHRzKSA/IHZhbGlkYXRvck9yT3B0cy52YWxpZGF0b3JzIDogdmFsaWRhdG9yT3JPcHRzKSB8fCBudWxsO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgdmFsaWRhdG9yIGZ1bmN0aW9uIGJ5IGNvbWJpbmluZyBwcm92aWRlZCB2YWxpZGF0b3JzLlxuICovXG5mdW5jdGlvbiBjb2VyY2VUb1ZhbGlkYXRvcih2YWxpZGF0b3I6IFZhbGlkYXRvckZufFZhbGlkYXRvckZuW118bnVsbCk6IFZhbGlkYXRvckZufG51bGwge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheSh2YWxpZGF0b3IpID8gY29tcG9zZVZhbGlkYXRvcnModmFsaWRhdG9yKSA6IHZhbGlkYXRvciB8fCBudWxsO1xufVxuXG4vKipcbiAqIEdldHMgYXN5bmMgdmFsaWRhdG9ycyBmcm9tIGVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBnaXZlbiB2YWxpZGF0b3JzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGlja0FzeW5jVmFsaWRhdG9ycyhcbiAgICBhc3luY1ZhbGlkYXRvcj86IEFzeW5jVmFsaWRhdG9yRm58QXN5bmNWYWxpZGF0b3JGbltdfG51bGwsXG4gICAgdmFsaWRhdG9yT3JPcHRzPzogVmFsaWRhdG9yRm58VmFsaWRhdG9yRm5bXXxBYnN0cmFjdENvbnRyb2xPcHRpb25zfG51bGwpOiBBc3luY1ZhbGlkYXRvckZufFxuICAgIEFzeW5jVmFsaWRhdG9yRm5bXXxudWxsIHtcbiAgaWYgKHR5cGVvZiBuZ0Rldk1vZGUgPT09ICd1bmRlZmluZWQnIHx8IG5nRGV2TW9kZSkge1xuICAgIGlmIChpc09wdGlvbnNPYmoodmFsaWRhdG9yT3JPcHRzKSAmJiBhc3luY1ZhbGlkYXRvcikge1xuICAgICAgY29uc29sZS53YXJuKGFzeW5jVmFsaWRhdG9yc0Ryb3BwZWRXaXRoT3B0c1dhcm5pbmcpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gKGlzT3B0aW9uc09iaih2YWxpZGF0b3JPck9wdHMpID8gdmFsaWRhdG9yT3JPcHRzLmFzeW5jVmFsaWRhdG9ycyA6IGFzeW5jVmFsaWRhdG9yKSB8fCBudWxsO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYXN5bmMgdmFsaWRhdG9yIGZ1bmN0aW9uIGJ5IGNvbWJpbmluZyBwcm92aWRlZCBhc3luYyB2YWxpZGF0b3JzLlxuICovXG5mdW5jdGlvbiBjb2VyY2VUb0FzeW5jVmFsaWRhdG9yKGFzeW5jVmFsaWRhdG9yPzogQXN5bmNWYWxpZGF0b3JGbnxBc3luY1ZhbGlkYXRvckZuW118XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bGwpOiBBc3luY1ZhbGlkYXRvckZufG51bGwge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheShhc3luY1ZhbGlkYXRvcikgPyBjb21wb3NlQXN5bmNWYWxpZGF0b3JzKGFzeW5jVmFsaWRhdG9yKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzeW5jVmFsaWRhdG9yIHx8IG51bGw7XG59XG5cbmV4cG9ydCB0eXBlIEZvcm1Ib29rcyA9ICdjaGFuZ2UnfCdibHVyJ3wnc3VibWl0JztcblxuLyoqXG4gKiBJbnRlcmZhY2UgZm9yIG9wdGlvbnMgcHJvdmlkZWQgdG8gYW4gYEFic3RyYWN0Q29udHJvbGAuXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgaW50ZXJmYWNlIEFic3RyYWN0Q29udHJvbE9wdGlvbnMge1xuICAvKipcbiAgICogQGRlc2NyaXB0aW9uXG4gICAqIFRoZSBsaXN0IG9mIHZhbGlkYXRvcnMgYXBwbGllZCB0byBhIGNvbnRyb2wuXG4gICAqL1xuICB2YWxpZGF0b3JzPzogVmFsaWRhdG9yRm58VmFsaWRhdG9yRm5bXXxudWxsO1xuICAvKipcbiAgICogQGRlc2NyaXB0aW9uXG4gICAqIFRoZSBsaXN0IG9mIGFzeW5jIHZhbGlkYXRvcnMgYXBwbGllZCB0byBjb250cm9sLlxuICAgKi9cbiAgYXN5bmNWYWxpZGF0b3JzPzogQXN5bmNWYWxpZGF0b3JGbnxBc3luY1ZhbGlkYXRvckZuW118bnVsbDtcbiAgLyoqXG4gICAqIEBkZXNjcmlwdGlvblxuICAgKiBUaGUgZXZlbnQgbmFtZSBmb3IgY29udHJvbCB0byB1cGRhdGUgdXBvbi5cbiAgICovXG4gIHVwZGF0ZU9uPzogJ2NoYW5nZSd8J2JsdXInfCdzdWJtaXQnO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNPcHRpb25zT2JqKHZhbGlkYXRvck9yT3B0cz86IFZhbGlkYXRvckZufFZhbGlkYXRvckZuW118QWJzdHJhY3RDb250cm9sT3B0aW9uc3xcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCk6IHZhbGlkYXRvck9yT3B0cyBpcyBBYnN0cmFjdENvbnRyb2xPcHRpb25zIHtcbiAgcmV0dXJuIHZhbGlkYXRvck9yT3B0cyAhPSBudWxsICYmICFBcnJheS5pc0FycmF5KHZhbGlkYXRvck9yT3B0cykgJiZcbiAgICAgIHR5cGVvZiB2YWxpZGF0b3JPck9wdHMgPT09ICdvYmplY3QnO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0Q29udHJvbFByZXNlbnQocGFyZW50OiBhbnksIGlzR3JvdXA6IGJvb2xlYW4sIGtleTogc3RyaW5nfG51bWJlcik6IHZvaWQge1xuICBjb25zdCBjb250cm9scyA9IHBhcmVudC5jb250cm9scyBhcyB7W2tleTogc3RyaW5nfG51bWJlcl06IHVua25vd259O1xuICBjb25zdCBjb2xsZWN0aW9uID0gaXNHcm91cCA/IE9iamVjdC5rZXlzKGNvbnRyb2xzKSA6IGNvbnRyb2xzO1xuICBpZiAoIWNvbGxlY3Rpb24ubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJ1bnRpbWVFcnJvcihcbiAgICAgICAgUnVudGltZUVycm9yQ29kZS5OT19DT05UUk9MUywgTkdfREVWX01PREUgPyBub0NvbnRyb2xzRXJyb3IoaXNHcm91cCkgOiAnJyk7XG4gIH1cbiAgaWYgKCFjb250cm9sc1trZXldKSB7XG4gICAgdGhyb3cgbmV3IFJ1bnRpbWVFcnJvcihcbiAgICAgICAgUnVudGltZUVycm9yQ29kZS5NSVNTSU5HX0NPTlRST0wsIE5HX0RFVl9NT0RFID8gbWlzc2luZ0NvbnRyb2xFcnJvcihpc0dyb3VwLCBrZXkpIDogJycpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRBbGxWYWx1ZXNQcmVzZW50KGNvbnRyb2w6IGFueSwgaXNHcm91cDogYm9vbGVhbiwgdmFsdWU6IGFueSk6IHZvaWQge1xuICBjb250cm9sLl9mb3JFYWNoQ2hpbGQoKF86IHVua25vd24sIGtleTogc3RyaW5nfG51bWJlcikgPT4ge1xuICAgIGlmICh2YWx1ZVtrZXldID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBSdW50aW1lRXJyb3IoXG4gICAgICAgICAgUnVudGltZUVycm9yQ29kZS5NSVNTSU5HX0NPTlRST0xfVkFMVUUsXG4gICAgICAgICAgTkdfREVWX01PREUgPyBtaXNzaW5nQ29udHJvbFZhbHVlRXJyb3IoaXNHcm91cCwga2V5KSA6ICcnKTtcbiAgICB9XG4gIH0pO1xufVxuXG4vLyBJc0FueSBjaGVja3MgaWYgVCBpcyBgYW55YCwgYnkgY2hlY2tpbmcgYSBjb25kaXRpb24gdGhhdCBjb3VsZG4ndCBwb3NzaWJseSBiZSB0cnVlIG90aGVyd2lzZS5cbmV4cG9ydCB0eXBlIMm1SXNBbnk8VCwgWSwgTj4gPSAwIGV4dGVuZHMoMSZUKSA/IFkgOiBOO1xuXG4vKipcbiAqIGBUeXBlZE9yVW50eXBlZGAgYWxsb3dzIG9uZSBvZiB0d28gZGlmZmVyZW50IHR5cGVzIHRvIGJlIHNlbGVjdGVkLCBkZXBlbmRpbmcgb24gd2hldGhlciB0aGUgRm9ybXNcbiAqIGNsYXNzIGl0J3MgYXBwbGllZCB0byBpcyB0eXBlZCBvciBub3QuXG4gKlxuICogVGhpcyBpcyBmb3IgaW50ZXJuYWwgQW5ndWxhciB1c2FnZSB0byBzdXBwb3J0IHR5cGVkIGZvcm1zOyBkbyBub3QgZGlyZWN0bHkgdXNlIGl0LlxuICovXG5leHBvcnQgdHlwZSDJtVR5cGVkT3JVbnR5cGVkPFQsIFR5cGVkLCBVbnR5cGVkPiA9IMm1SXNBbnk8VCwgVW50eXBlZCwgVHlwZWQ+O1xuXG4vKipcbiAqIFZhbHVlIGdpdmVzIHRoZSB2YWx1ZSB0eXBlIGNvcnJlc3BvbmRpbmcgdG8gYSBjb250cm9sIHR5cGUuXG4gKlxuICogTm90ZSB0aGF0IHRoZSByZXN1bHRpbmcgdHlwZSB3aWxsIGZvbGxvdyB0aGUgc2FtZSBydWxlcyBhcyBgLnZhbHVlYCBvbiB5b3VyIGNvbnRyb2wsIGdyb3VwLCBvclxuICogYXJyYXksIGluY2x1ZGluZyBgdW5kZWZpbmVkYCBmb3IgZWFjaCBncm91cCBlbGVtZW50IHdoaWNoIG1pZ2h0IGJlIGRpc2FibGVkLlxuICpcbiAqIElmIHlvdSBhcmUgdHJ5aW5nIHRvIGV4dHJhY3QgYSB2YWx1ZSB0eXBlIGZvciBhIGRhdGEgbW9kZWwsIHlvdSBwcm9iYWJseSB3YW50IHtAbGluayBSYXdWYWx1ZX0sXG4gKiB3aGljaCB3aWxsIG5vdCBoYXZlIGB1bmRlZmluZWRgIGluIGdyb3VwIGtleXMuXG4gKlxuICogQHVzYWdlTm90ZXNcbiAqXG4gKiAjIyMgYEZvcm1Db250cm9sYCB2YWx1ZSB0eXBlXG4gKlxuICogWW91IGNhbiBleHRyYWN0IHRoZSB2YWx1ZSB0eXBlIG9mIGEgc2luZ2xlIGNvbnRyb2w6XG4gKlxuICogYGBgdHNcbiAqIHR5cGUgTmFtZUNvbnRyb2wgPSBGb3JtQ29udHJvbDxzdHJpbmc+O1xuICogdHlwZSBOYW1lVmFsdWUgPSBWYWx1ZTxOYW1lQ29udHJvbD47XG4gKiBgYGBcbiAqXG4gKiBUaGUgcmVzdWx0aW5nIHR5cGUgaXMgYHN0cmluZ2AuXG4gKlxuICogIyMjIGBGb3JtR3JvdXBgIHZhbHVlIHR5cGVcbiAqXG4gKiBJbWFnaW5lIHlvdSBoYXZlIGFuIGludGVyZmFjZSBkZWZpbmluZyB0aGUgY29udHJvbHMgaW4geW91ciBncm91cC4gWW91IGNhbiBleHRyYWN0IHRoZSBzaGFwZSBvZlxuICogdGhlIHZhbHVlcyBhcyBmb2xsb3dzOlxuICpcbiAqIGBgYHRzXG4gKiBpbnRlcmZhY2UgUGFydHlGb3JtQ29udHJvbHMge1xuICogICBhZGRyZXNzOiBGb3JtQ29udHJvbDxzdHJpbmc+O1xuICogfVxuICpcbiAqIC8vIFZhbHVlIG9wZXJhdGVzIG9uIGNvbnRyb2xzOyB0aGUgb2JqZWN0IG11c3QgYmUgd3JhcHBlZCBpbiBhIEZvcm1Hcm91cC5cbiAqIHR5cGUgUGFydHlGb3JtVmFsdWVzID0gVmFsdWU8Rm9ybUdyb3VwPFBhcnR5Rm9ybUNvbnRyb2xzPj47XG4gKiBgYGBcbiAqXG4gKiBUaGUgcmVzdWx0aW5nIHR5cGUgaXMgYHthZGRyZXNzOiBzdHJpbmd8dW5kZWZpbmVkfWAuXG4gKlxuICogIyMjIGBGb3JtQXJyYXlgIHZhbHVlIHR5cGVcbiAqXG4gKiBZb3UgY2FuIGV4dHJhY3QgdmFsdWVzIGZyb20gRm9ybUFycmF5cyBhcyB3ZWxsOlxuICpcbiAqIGBgYHRzXG4gKiB0eXBlIEd1ZXN0TmFtZXNDb250cm9scyA9IEZvcm1BcnJheTxGb3JtQ29udHJvbDxzdHJpbmc+PjtcbiAqXG4gKiB0eXBlIE5hbWVzVmFsdWVzID0gVmFsdWU8R3Vlc3ROYW1lc0NvbnRyb2xzPjtcbiAqIGBgYFxuICpcbiAqIFRoZSByZXN1bHRpbmcgdHlwZSBpcyBgc3RyaW5nW11gLlxuICpcbiAqICoqSW50ZXJuYWw6IG5vdCBmb3IgcHVibGljIHVzZS4qKlxuICovXG5leHBvcnQgdHlwZSDJtVZhbHVlPFQgZXh0ZW5kcyBBYnN0cmFjdENvbnRyb2x8dW5kZWZpbmVkPiA9XG4gICAgVCBleHRlbmRzIEFic3RyYWN0Q29udHJvbDxhbnksIGFueT4/IFRbJ3ZhbHVlJ10gOiBuZXZlcjtcblxuLyoqXG4gKiBSYXdWYWx1ZSBnaXZlcyB0aGUgcmF3IHZhbHVlIHR5cGUgY29ycmVzcG9uZGluZyB0byBhIGNvbnRyb2wgdHlwZS5cbiAqXG4gKiBOb3RlIHRoYXQgdGhlIHJlc3VsdGluZyB0eXBlIHdpbGwgZm9sbG93IHRoZSBzYW1lIHJ1bGVzIGFzIGAuZ2V0UmF3VmFsdWUoKWAgb24geW91ciBjb250cm9sLFxuICogZ3JvdXAsIG9yIGFycmF5LiBUaGlzIG1lYW5zIHRoYXQgYWxsIGNvbnRyb2xzIGluc2lkZSBhIGdyb3VwIHdpbGwgYmUgcmVxdWlyZWQsIG5vdCBvcHRpb25hbCxcbiAqIHJlZ2FyZGxlc3Mgb2YgdGhlaXIgZGlzYWJsZWQgc3RhdGUuXG4gKlxuICogWW91IG1heSBhbHNvIHdpc2ggdG8gdXNlIHtAbGluayDJtVZhbHVlfSwgd2hpY2ggd2lsbCBoYXZlIGB1bmRlZmluZWRgIGluIGdyb3VwIGtleXMgKHdoaWNoIGNhbiBiZVxuICogZGlzYWJsZWQpLlxuICpcbiAqIEB1c2FnZU5vdGVzXG4gKlxuICogIyMjIGBGb3JtR3JvdXBgIHJhdyB2YWx1ZSB0eXBlXG4gKlxuICogSW1hZ2luZSB5b3UgaGF2ZSBhbiBpbnRlcmZhY2UgZGVmaW5pbmcgdGhlIGNvbnRyb2xzIGluIHlvdXIgZ3JvdXAuIFlvdSBjYW4gZXh0cmFjdCB0aGUgc2hhcGUgb2ZcbiAqIHRoZSByYXcgdmFsdWVzIGFzIGZvbGxvd3M6XG4gKlxuICogYGBgdHNcbiAqIGludGVyZmFjZSBQYXJ0eUZvcm1Db250cm9scyB7XG4gKiAgIGFkZHJlc3M6IEZvcm1Db250cm9sPHN0cmluZz47XG4gKiB9XG4gKlxuICogLy8gUmF3VmFsdWUgb3BlcmF0ZXMgb24gY29udHJvbHM7IHRoZSBvYmplY3QgbXVzdCBiZSB3cmFwcGVkIGluIGEgRm9ybUdyb3VwLlxuICogdHlwZSBQYXJ0eUZvcm1WYWx1ZXMgPSBSYXdWYWx1ZTxGb3JtR3JvdXA8UGFydHlGb3JtQ29udHJvbHM+PjtcbiAqIGBgYFxuICpcbiAqIFRoZSByZXN1bHRpbmcgdHlwZSBpcyBge2FkZHJlc3M6IHN0cmluZ31gLiAoTm90ZSB0aGUgYWJzZW5jZSBvZiBgdW5kZWZpbmVkYC4pXG4gKlxuICogICoqSW50ZXJuYWw6IG5vdCBmb3IgcHVibGljIHVzZS4qKlxuICovXG5leHBvcnQgdHlwZSDJtVJhd1ZhbHVlPFQgZXh0ZW5kcyBBYnN0cmFjdENvbnRyb2x8dW5kZWZpbmVkPiA9IFQgZXh0ZW5kcyBBYnN0cmFjdENvbnRyb2w8YW55LCBhbnk+P1xuICAgIChUWydzZXRWYWx1ZSddIGV4dGVuZHMoKHY6IGluZmVyIFIpID0+IHZvaWQpID8gUiA6IG5ldmVyKSA6XG4gICAgbmV2ZXI7XG5cbi8vIERpc2FibGUgY2xhbmctZm9ybWF0IHRvIHByb2R1Y2UgY2xlYXJlciBmb3JtYXR0aW5nIGZvciB0aGVzZSBtdWx0aWxpbmUgdHlwZXMuXG4vLyBjbGFuZy1mb3JtYXQgb2ZmXG5cbi8qKlxuICogVG9rZW5pemUgc3BsaXRzIGEgc3RyaW5nIGxpdGVyYWwgUyBieSBhIGRlbGltaXRlciBELlxuICovXG5leHBvcnQgdHlwZSDJtVRva2VuaXplPFMgZXh0ZW5kcyBzdHJpbmcsIEQgZXh0ZW5kcyBzdHJpbmc+ID1cbiAgc3RyaW5nIGV4dGVuZHMgUyA/IHN0cmluZ1tdIDogLyogUyBtdXN0IGJlIGEgbGl0ZXJhbCAqL1xuICAgIFMgZXh0ZW5kcyBgJHtpbmZlciBUfSR7RH0ke2luZmVyIFV9YCA/IFtULCAuLi7JtVRva2VuaXplPFUsIEQ+XSA6XG4gICAgICBbU10gLyogQmFzZSBjYXNlICovXG4gIDtcblxuLyoqXG4gKiBDb2VyY2VTdHJBcnJUb051bUFyciBhY2NlcHRzIGFuIGFycmF5IG9mIHN0cmluZ3MsIGFuZCBjb252ZXJ0cyBhbnkgbnVtZXJpYyBzdHJpbmcgdG8gYSBudW1iZXIuXG4gKi9cbmV4cG9ydCB0eXBlIMm1Q29lcmNlU3RyQXJyVG9OdW1BcnI8Uz4gPVxuLy8gRXh0cmFjdCB0aGUgaGVhZCBvZiB0aGUgYXJyYXkuXG4gIFMgZXh0ZW5kcyBbaW5mZXIgSGVhZCwgLi4uaW5mZXIgVGFpbF0gP1xuICAgIC8vIFVzaW5nIGEgdGVtcGxhdGUgbGl0ZXJhbCB0eXBlLCBjb2VyY2UgdGhlIGhlYWQgdG8gYG51bWJlcmAgaWYgcG9zc2libGUuXG4gICAgLy8gVGhlbiwgcmVjdXJzZSBvbiB0aGUgdGFpbC5cbiAgICBIZWFkIGV4dGVuZHMgYCR7bnVtYmVyfWAgP1xuICAgICAgW251bWJlciwgLi4uybVDb2VyY2VTdHJBcnJUb051bUFycjxUYWlsPl0gOlxuICAgICAgW0hlYWQsIC4uLsm1Q29lcmNlU3RyQXJyVG9OdW1BcnI8VGFpbD5dIDpcbiAgICBbXTtcblxuLyoqXG4gKiBOYXZpZ2F0ZSB0YWtlcyBhIHR5cGUgVCBhbmQgYW4gYXJyYXkgSywgYW5kIHJldHVybnMgdGhlIHR5cGUgb2YgVFtLWzBdXVtLWzFdXVtLWzJdXS4uLlxuICovXG5leHBvcnQgdHlwZSDJtU5hdmlnYXRlPFQsIEsgZXh0ZW5kcyhBcnJheTxzdHJpbmd8bnVtYmVyPik+ID1cbiAgVCBleHRlbmRzIG9iamVjdCA/IC8qIFQgbXVzdCBiZSBpbmRleGFibGUgKG9iamVjdCBvciBhcnJheSkgKi9cbiAgICAoSyBleHRlbmRzIFtpbmZlciBIZWFkLCAuLi5pbmZlciBUYWlsXSA/IC8qIFNwbGl0IEsgaW50byBoZWFkIGFuZCB0YWlsICovXG4gICAgICAoSGVhZCBleHRlbmRzIGtleW9mIFQgPyAvKiBoZWFkKEspIG11c3QgaW5kZXggVCAqL1xuICAgICAgICAoVGFpbCBleHRlbmRzKHN0cmluZ3xudW1iZXIpW10gPyAvKiB0YWlsKEspIG11c3QgYmUgYW4gYXJyYXkgKi9cbiAgICAgICAgICBbXSBleHRlbmRzIFRhaWwgPyBUW0hlYWRdIDogLyogYmFzZSBjYXNlOiBLIGNhbiBiZSBzcGxpdCwgYnV0IFRhaWwgaXMgZW1wdHkgKi9cbiAgICAgICAgICAgICjJtU5hdmlnYXRlPFRbSGVhZF0sIFRhaWw+KSAvKiBleHBsb3JlIFRbaGVhZChLKV0gYnkgdGFpbChLKSAqLyA6XG4gICAgICAgICAgYW55KSAvKiB0YWlsKEspIHdhcyBub3QgYW4gYXJyYXksIGdpdmUgdXAgKi8gOlxuICAgICAgICBuZXZlcikgLyogaGVhZChLKSBkb2VzIG5vdCBpbmRleCBULCBnaXZlIHVwICovIDpcbiAgICAgIGFueSkgLyogSyBjYW5ub3QgYmUgc3BsaXQsIGdpdmUgdXAgKi8gOlxuICAgIGFueSAvKiBUIGlzIG5vdCBpbmRleGFibGUsIGdpdmUgdXAgKi9cbiAgO1xuXG4vKipcbiAqIMm1V3JpdGVhYmxlIHJlbW92ZXMgcmVhZG9ubHkgZnJvbSBhbGwga2V5cy5cbiAqL1xuZXhwb3J0IHR5cGUgybVXcml0ZWFibGU8VD4gPSB7XG4gIC1yZWFkb25seVtQIGluIGtleW9mIFRdOiBUW1BdXG59O1xuXG4vKipcbiAqIEdldFByb3BlcnR5IHRha2VzIGEgdHlwZSBUIGFuZCBzb21lIHByb3BlcnR5IG5hbWVzIG9yIGluZGljZXMgSy5cbiAqIElmIEsgaXMgYSBkb3Qtc2VwYXJhdGVkIHN0cmluZywgaXQgaXMgdG9rZW5pemVkIGludG8gYW4gYXJyYXkgYmVmb3JlIHByb2NlZWRpbmcuXG4gKiBUaGVuLCB0aGUgdHlwZSBvZiB0aGUgbmVzdGVkIHByb3BlcnR5IGF0IEsgaXMgY29tcHV0ZWQ6IFRbS1swXV1bS1sxXV1bS1syXV0uLi5cbiAqIFRoaXMgd29ya3Mgd2l0aCBib3RoIG9iamVjdHMsIHdoaWNoIGFyZSBpbmRleGVkIGJ5IHByb3BlcnR5IG5hbWUsIGFuZCBhcnJheXMsIHdoaWNoIGFyZSBpbmRleGVkXG4gKiBudW1lcmljYWxseS5cbiAqXG4gKiBGb3IgaW50ZXJuYWwgdXNlIG9ubHkuXG4gKi9cbmV4cG9ydCB0eXBlIMm1R2V0UHJvcGVydHk8VCwgSz4gPVxuICAgIC8vIEsgaXMgYSBzdHJpbmdcbiAgICBLIGV4dGVuZHMgc3RyaW5nID8gybVHZXRQcm9wZXJ0eTxULCDJtUNvZXJjZVN0ckFyclRvTnVtQXJyPMm1VG9rZW5pemU8SywgJy4nPj4+IDpcbiAgICAvLyBJcyBpcyBhbiBhcnJheVxuICAgIMm1V3JpdGVhYmxlPEs+IGV4dGVuZHMgQXJyYXk8c3RyaW5nfG51bWJlcj4gPyDJtU5hdmlnYXRlPFQsIMm1V3JpdGVhYmxlPEs+PiA6XG4gICAgLy8gRmFsbCB0aHJvdWdoIHBlcm1pc3NpdmVseSBpZiB3ZSBjYW4ndCBjYWxjdWxhdGUgdGhlIHR5cGUgb2YgSy5cbiAgICBhbnk7XG5cbi8vIGNsYW5nLWZvcm1hdCBvblxuXG4vKipcbiAqIFRoaXMgaXMgdGhlIGJhc2UgY2xhc3MgZm9yIGBGb3JtQ29udHJvbGAsIGBGb3JtR3JvdXBgLCBhbmQgYEZvcm1BcnJheWAuXG4gKlxuICogSXQgcHJvdmlkZXMgc29tZSBvZiB0aGUgc2hhcmVkIGJlaGF2aW9yIHRoYXQgYWxsIGNvbnRyb2xzIGFuZCBncm91cHMgb2YgY29udHJvbHMgaGF2ZSwgbGlrZVxuICogcnVubmluZyB2YWxpZGF0b3JzLCBjYWxjdWxhdGluZyBzdGF0dXMsIGFuZCByZXNldHRpbmcgc3RhdGUuIEl0IGFsc28gZGVmaW5lcyB0aGUgcHJvcGVydGllc1xuICogdGhhdCBhcmUgc2hhcmVkIGJldHdlZW4gYWxsIHN1Yi1jbGFzc2VzLCBsaWtlIGB2YWx1ZWAsIGB2YWxpZGAsIGFuZCBgZGlydHlgLiBJdCBzaG91bGRuJ3QgYmVcbiAqIGluc3RhbnRpYXRlZCBkaXJlY3RseS5cbiAqXG4gKiBUaGUgZmlyc3QgdHlwZSBwYXJhbWV0ZXIgVFZhbHVlIHJlcHJlc2VudHMgdGhlIHZhbHVlIHR5cGUgb2YgdGhlIGNvbnRyb2wgKGBjb250cm9sLnZhbHVlYCkuXG4gKiBUaGUgb3B0aW9uYWwgdHlwZSBwYXJhbWV0ZXIgVFJhd1ZhbHVlICByZXByZXNlbnRzIHRoZSByYXcgdmFsdWUgdHlwZSAoYGNvbnRyb2wuZ2V0UmF3VmFsdWUoKWApLlxuICpcbiAqIEBzZWUgW0Zvcm1zIEd1aWRlXSgvZ3VpZGUvZm9ybXMpXG4gKiBAc2VlIFtSZWFjdGl2ZSBGb3JtcyBHdWlkZV0oL2d1aWRlL3JlYWN0aXZlLWZvcm1zKVxuICogQHNlZSBbRHluYW1pYyBGb3JtcyBHdWlkZV0oL2d1aWRlL2R5bmFtaWMtZm9ybSlcbiAqXG4gKiBAcHVibGljQXBpXG4gKi9cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBBYnN0cmFjdENvbnRyb2w8VFZhbHVlID0gYW55LCBUUmF3VmFsdWUgZXh0ZW5kcyBUVmFsdWUgPSBUVmFsdWU+IHtcbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfcGVuZGluZ0RpcnR5ID0gZmFsc2U7XG5cbiAgLyoqXG4gICAqIEluZGljYXRlcyB0aGF0IGEgY29udHJvbCBoYXMgaXRzIG93biBwZW5kaW5nIGFzeW5jaHJvbm91cyB2YWxpZGF0aW9uIGluIHByb2dyZXNzLlxuICAgKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIF9oYXNPd25QZW5kaW5nQXN5bmNWYWxpZGF0b3IgPSBmYWxzZTtcblxuICAvKiogQGludGVybmFsICovXG4gIF9wZW5kaW5nVG91Y2hlZCA9IGZhbHNlO1xuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX29uQ29sbGVjdGlvbkNoYW5nZSA9ICgpID0+IHt9O1xuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX3VwZGF0ZU9uPzogRm9ybUhvb2tzO1xuXG4gIHByaXZhdGUgX3BhcmVudDogRm9ybUdyb3VwfEZvcm1BcnJheXxudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBfYXN5bmNWYWxpZGF0aW9uU3Vic2NyaXB0aW9uOiBhbnk7XG5cbiAgLyoqXG4gICAqIENvbnRhaW5zIHRoZSByZXN1bHQgb2YgbWVyZ2luZyBzeW5jaHJvbm91cyB2YWxpZGF0b3JzIGludG8gYSBzaW5nbGUgdmFsaWRhdG9yIGZ1bmN0aW9uXG4gICAqIChjb21iaW5lZCB1c2luZyBgVmFsaWRhdG9ycy5jb21wb3NlYCkuXG4gICAqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgcHJpdmF0ZSBfY29tcG9zZWRWYWxpZGF0b3JGbjogVmFsaWRhdG9yRm58bnVsbDtcblxuICAvKipcbiAgICogQ29udGFpbnMgdGhlIHJlc3VsdCBvZiBtZXJnaW5nIGFzeW5jaHJvbm91cyB2YWxpZGF0b3JzIGludG8gYSBzaW5nbGUgdmFsaWRhdG9yIGZ1bmN0aW9uXG4gICAqIChjb21iaW5lZCB1c2luZyBgVmFsaWRhdG9ycy5jb21wb3NlQXN5bmNgKS5cbiAgICpcbiAgICogQGludGVybmFsXG4gICAqL1xuICBwcml2YXRlIF9jb21wb3NlZEFzeW5jVmFsaWRhdG9yRm46IEFzeW5jVmFsaWRhdG9yRm58bnVsbDtcblxuICAvKipcbiAgICogU3luY2hyb25vdXMgdmFsaWRhdG9ycyBhcyB0aGV5IHdlcmUgcHJvdmlkZWQ6XG4gICAqICAtIGluIGBBYnN0cmFjdENvbnRyb2xgIGNvbnN0cnVjdG9yXG4gICAqICAtIGFzIGFuIGFyZ3VtZW50IHdoaWxlIGNhbGxpbmcgYHNldFZhbGlkYXRvcnNgIGZ1bmN0aW9uXG4gICAqICAtIHdoaWxlIGNhbGxpbmcgdGhlIHNldHRlciBvbiB0aGUgYHZhbGlkYXRvcmAgZmllbGQgKGUuZy4gYGNvbnRyb2wudmFsaWRhdG9yID0gdmFsaWRhdG9yRm5gKVxuICAgKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIHByaXZhdGUgX3Jhd1ZhbGlkYXRvcnM6IFZhbGlkYXRvckZufFZhbGlkYXRvckZuW118bnVsbDtcblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIHZhbGlkYXRvcnMgYXMgdGhleSB3ZXJlIHByb3ZpZGVkOlxuICAgKiAgLSBpbiBgQWJzdHJhY3RDb250cm9sYCBjb25zdHJ1Y3RvclxuICAgKiAgLSBhcyBhbiBhcmd1bWVudCB3aGlsZSBjYWxsaW5nIGBzZXRBc3luY1ZhbGlkYXRvcnNgIGZ1bmN0aW9uXG4gICAqICAtIHdoaWxlIGNhbGxpbmcgdGhlIHNldHRlciBvbiB0aGUgYGFzeW5jVmFsaWRhdG9yYCBmaWVsZCAoZS5nLiBgY29udHJvbC5hc3luY1ZhbGlkYXRvciA9XG4gICAqIGFzeW5jVmFsaWRhdG9yRm5gKVxuICAgKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIHByaXZhdGUgX3Jhd0FzeW5jVmFsaWRhdG9yczogQXN5bmNWYWxpZGF0b3JGbnxBc3luY1ZhbGlkYXRvckZuW118bnVsbDtcblxuICAvKipcbiAgICogVGhlIGN1cnJlbnQgdmFsdWUgb2YgdGhlIGNvbnRyb2wuXG4gICAqXG4gICAqICogRm9yIGEgYEZvcm1Db250cm9sYCwgdGhlIGN1cnJlbnQgdmFsdWUuXG4gICAqICogRm9yIGFuIGVuYWJsZWQgYEZvcm1Hcm91cGAsIHRoZSB2YWx1ZXMgb2YgZW5hYmxlZCBjb250cm9scyBhcyBhbiBvYmplY3RcbiAgICogd2l0aCBhIGtleS12YWx1ZSBwYWlyIGZvciBlYWNoIG1lbWJlciBvZiB0aGUgZ3JvdXAuXG4gICAqICogRm9yIGEgZGlzYWJsZWQgYEZvcm1Hcm91cGAsIHRoZSB2YWx1ZXMgb2YgYWxsIGNvbnRyb2xzIGFzIGFuIG9iamVjdFxuICAgKiB3aXRoIGEga2V5LXZhbHVlIHBhaXIgZm9yIGVhY2ggbWVtYmVyIG9mIHRoZSBncm91cC5cbiAgICogKiBGb3IgYSBgRm9ybUFycmF5YCwgdGhlIHZhbHVlcyBvZiBlbmFibGVkIGNvbnRyb2xzIGFzIGFuIGFycmF5LlxuICAgKlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IHZhbHVlITogVFZhbHVlO1xuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplIHRoZSBBYnN0cmFjdENvbnRyb2wgaW5zdGFuY2UuXG4gICAqXG4gICAqIEBwYXJhbSB2YWxpZGF0b3JzIFRoZSBmdW5jdGlvbiBvciBhcnJheSBvZiBmdW5jdGlvbnMgdGhhdCBpcyB1c2VkIHRvIGRldGVybWluZSB0aGUgdmFsaWRpdHkgb2ZcbiAgICogICAgIHRoaXMgY29udHJvbCBzeW5jaHJvbm91c2x5LlxuICAgKiBAcGFyYW0gYXN5bmNWYWxpZGF0b3JzIFRoZSBmdW5jdGlvbiBvciBhcnJheSBvZiBmdW5jdGlvbnMgdGhhdCBpcyB1c2VkIHRvIGRldGVybWluZSB2YWxpZGl0eSBvZlxuICAgKiAgICAgdGhpcyBjb250cm9sIGFzeW5jaHJvbm91c2x5LlxuICAgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgICB2YWxpZGF0b3JzOiBWYWxpZGF0b3JGbnxWYWxpZGF0b3JGbltdfG51bGwsXG4gICAgICBhc3luY1ZhbGlkYXRvcnM6IEFzeW5jVmFsaWRhdG9yRm58QXN5bmNWYWxpZGF0b3JGbltdfG51bGwpIHtcbiAgICB0aGlzLl9yYXdWYWxpZGF0b3JzID0gdmFsaWRhdG9ycztcbiAgICB0aGlzLl9yYXdBc3luY1ZhbGlkYXRvcnMgPSBhc3luY1ZhbGlkYXRvcnM7XG4gICAgdGhpcy5fY29tcG9zZWRWYWxpZGF0b3JGbiA9IGNvZXJjZVRvVmFsaWRhdG9yKHRoaXMuX3Jhd1ZhbGlkYXRvcnMpO1xuICAgIHRoaXMuX2NvbXBvc2VkQXN5bmNWYWxpZGF0b3JGbiA9IGNvZXJjZVRvQXN5bmNWYWxpZGF0b3IodGhpcy5fcmF3QXN5bmNWYWxpZGF0b3JzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBmdW5jdGlvbiB0aGF0IGlzIHVzZWQgdG8gZGV0ZXJtaW5lIHRoZSB2YWxpZGl0eSBvZiB0aGlzIGNvbnRyb2wgc3luY2hyb25vdXNseS5cbiAgICogSWYgbXVsdGlwbGUgdmFsaWRhdG9ycyBoYXZlIGJlZW4gYWRkZWQsIHRoaXMgd2lsbCBiZSBhIHNpbmdsZSBjb21wb3NlZCBmdW5jdGlvbi5cbiAgICogU2VlIGBWYWxpZGF0b3JzLmNvbXBvc2UoKWAgZm9yIGFkZGl0aW9uYWwgaW5mb3JtYXRpb24uXG4gICAqL1xuICBnZXQgdmFsaWRhdG9yKCk6IFZhbGlkYXRvckZufG51bGwge1xuICAgIHJldHVybiB0aGlzLl9jb21wb3NlZFZhbGlkYXRvckZuO1xuICB9XG4gIHNldCB2YWxpZGF0b3IodmFsaWRhdG9yRm46IFZhbGlkYXRvckZufG51bGwpIHtcbiAgICB0aGlzLl9yYXdWYWxpZGF0b3JzID0gdGhpcy5fY29tcG9zZWRWYWxpZGF0b3JGbiA9IHZhbGlkYXRvckZuO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIGZ1bmN0aW9uIHRoYXQgaXMgdXNlZCB0byBkZXRlcm1pbmUgdGhlIHZhbGlkaXR5IG9mIHRoaXMgY29udHJvbCBhc3luY2hyb25vdXNseS5cbiAgICogSWYgbXVsdGlwbGUgdmFsaWRhdG9ycyBoYXZlIGJlZW4gYWRkZWQsIHRoaXMgd2lsbCBiZSBhIHNpbmdsZSBjb21wb3NlZCBmdW5jdGlvbi5cbiAgICogU2VlIGBWYWxpZGF0b3JzLmNvbXBvc2UoKWAgZm9yIGFkZGl0aW9uYWwgaW5mb3JtYXRpb24uXG4gICAqL1xuICBnZXQgYXN5bmNWYWxpZGF0b3IoKTogQXN5bmNWYWxpZGF0b3JGbnxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5fY29tcG9zZWRBc3luY1ZhbGlkYXRvckZuO1xuICB9XG4gIHNldCBhc3luY1ZhbGlkYXRvcihhc3luY1ZhbGlkYXRvckZuOiBBc3luY1ZhbGlkYXRvckZufG51bGwpIHtcbiAgICB0aGlzLl9yYXdBc3luY1ZhbGlkYXRvcnMgPSB0aGlzLl9jb21wb3NlZEFzeW5jVmFsaWRhdG9yRm4gPSBhc3luY1ZhbGlkYXRvckZuO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBwYXJlbnQgY29udHJvbC5cbiAgICovXG4gIGdldCBwYXJlbnQoKTogRm9ybUdyb3VwfEZvcm1BcnJheXxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5fcGFyZW50O1xuICB9XG5cbiAgLyoqXG4gICAqIFRoZSB2YWxpZGF0aW9uIHN0YXR1cyBvZiB0aGUgY29udHJvbC5cbiAgICpcbiAgICogQHNlZSBgRm9ybUNvbnRyb2xTdGF0dXNgXG4gICAqXG4gICAqIFRoZXNlIHN0YXR1cyB2YWx1ZXMgYXJlIG11dHVhbGx5IGV4Y2x1c2l2ZSwgc28gYSBjb250cm9sIGNhbm5vdCBiZVxuICAgKiBib3RoIHZhbGlkIEFORCBpbnZhbGlkIG9yIGludmFsaWQgQU5EIGRpc2FibGVkLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IHN0YXR1cyE6IEZvcm1Db250cm9sU3RhdHVzO1xuXG4gIC8qKlxuICAgKiBBIGNvbnRyb2wgaXMgYHZhbGlkYCB3aGVuIGl0cyBgc3RhdHVzYCBpcyBgVkFMSURgLlxuICAgKlxuICAgKiBAc2VlIHtAbGluayBBYnN0cmFjdENvbnRyb2wuc3RhdHVzfVxuICAgKlxuICAgKiBAcmV0dXJucyBUcnVlIGlmIHRoZSBjb250cm9sIGhhcyBwYXNzZWQgYWxsIG9mIGl0cyB2YWxpZGF0aW9uIHRlc3RzLFxuICAgKiBmYWxzZSBvdGhlcndpc2UuXG4gICAqL1xuICBnZXQgdmFsaWQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdHVzID09PSBWQUxJRDtcbiAgfVxuXG4gIC8qKlxuICAgKiBBIGNvbnRyb2wgaXMgYGludmFsaWRgIHdoZW4gaXRzIGBzdGF0dXNgIGlzIGBJTlZBTElEYC5cbiAgICpcbiAgICogQHNlZSB7QGxpbmsgQWJzdHJhY3RDb250cm9sLnN0YXR1c31cbiAgICpcbiAgICogQHJldHVybnMgVHJ1ZSBpZiB0aGlzIGNvbnRyb2wgaGFzIGZhaWxlZCBvbmUgb3IgbW9yZSBvZiBpdHMgdmFsaWRhdGlvbiBjaGVja3MsXG4gICAqIGZhbHNlIG90aGVyd2lzZS5cbiAgICovXG4gIGdldCBpbnZhbGlkKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnN0YXR1cyA9PT0gSU5WQUxJRDtcbiAgfVxuXG4gIC8qKlxuICAgKiBBIGNvbnRyb2wgaXMgYHBlbmRpbmdgIHdoZW4gaXRzIGBzdGF0dXNgIGlzIGBQRU5ESU5HYC5cbiAgICpcbiAgICogQHNlZSB7QGxpbmsgQWJzdHJhY3RDb250cm9sLnN0YXR1c31cbiAgICpcbiAgICogQHJldHVybnMgVHJ1ZSBpZiB0aGlzIGNvbnRyb2wgaXMgaW4gdGhlIHByb2Nlc3Mgb2YgY29uZHVjdGluZyBhIHZhbGlkYXRpb24gY2hlY2ssXG4gICAqIGZhbHNlIG90aGVyd2lzZS5cbiAgICovXG4gIGdldCBwZW5kaW5nKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnN0YXR1cyA9PSBQRU5ESU5HO1xuICB9XG5cbiAgLyoqXG4gICAqIEEgY29udHJvbCBpcyBgZGlzYWJsZWRgIHdoZW4gaXRzIGBzdGF0dXNgIGlzIGBESVNBQkxFRGAuXG4gICAqXG4gICAqIERpc2FibGVkIGNvbnRyb2xzIGFyZSBleGVtcHQgZnJvbSB2YWxpZGF0aW9uIGNoZWNrcyBhbmRcbiAgICogYXJlIG5vdCBpbmNsdWRlZCBpbiB0aGUgYWdncmVnYXRlIHZhbHVlIG9mIHRoZWlyIGFuY2VzdG9yXG4gICAqIGNvbnRyb2xzLlxuICAgKlxuICAgKiBAc2VlIHtAbGluayBBYnN0cmFjdENvbnRyb2wuc3RhdHVzfVxuICAgKlxuICAgKiBAcmV0dXJucyBUcnVlIGlmIHRoZSBjb250cm9sIGlzIGRpc2FibGVkLCBmYWxzZSBvdGhlcndpc2UuXG4gICAqL1xuICBnZXQgZGlzYWJsZWQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdHVzID09PSBESVNBQkxFRDtcbiAgfVxuXG4gIC8qKlxuICAgKiBBIGNvbnRyb2wgaXMgYGVuYWJsZWRgIGFzIGxvbmcgYXMgaXRzIGBzdGF0dXNgIGlzIG5vdCBgRElTQUJMRURgLlxuICAgKlxuICAgKiBAcmV0dXJucyBUcnVlIGlmIHRoZSBjb250cm9sIGhhcyBhbnkgc3RhdHVzIG90aGVyIHRoYW4gJ0RJU0FCTEVEJyxcbiAgICogZmFsc2UgaWYgdGhlIHN0YXR1cyBpcyAnRElTQUJMRUQnLlxuICAgKlxuICAgKiBAc2VlIHtAbGluayBBYnN0cmFjdENvbnRyb2wuc3RhdHVzfVxuICAgKlxuICAgKi9cbiAgZ2V0IGVuYWJsZWQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdHVzICE9PSBESVNBQkxFRDtcbiAgfVxuXG4gIC8qKlxuICAgKiBBbiBvYmplY3QgY29udGFpbmluZyBhbnkgZXJyb3JzIGdlbmVyYXRlZCBieSBmYWlsaW5nIHZhbGlkYXRpb24sXG4gICAqIG9yIG51bGwgaWYgdGhlcmUgYXJlIG5vIGVycm9ycy5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBlcnJvcnMhOiBWYWxpZGF0aW9uRXJyb3JzfG51bGw7XG5cbiAgLyoqXG4gICAqIEEgY29udHJvbCBpcyBgcHJpc3RpbmVgIGlmIHRoZSB1c2VyIGhhcyBub3QgeWV0IGNoYW5nZWRcbiAgICogdGhlIHZhbHVlIGluIHRoZSBVSS5cbiAgICpcbiAgICogQHJldHVybnMgVHJ1ZSBpZiB0aGUgdXNlciBoYXMgbm90IHlldCBjaGFuZ2VkIHRoZSB2YWx1ZSBpbiB0aGUgVUk7IGNvbXBhcmUgYGRpcnR5YC5cbiAgICogUHJvZ3JhbW1hdGljIGNoYW5nZXMgdG8gYSBjb250cm9sJ3MgdmFsdWUgZG8gbm90IG1hcmsgaXQgZGlydHkuXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgcHJpc3RpbmU6IGJvb2xlYW4gPSB0cnVlO1xuXG4gIC8qKlxuICAgKiBBIGNvbnRyb2wgaXMgYGRpcnR5YCBpZiB0aGUgdXNlciBoYXMgY2hhbmdlZCB0aGUgdmFsdWVcbiAgICogaW4gdGhlIFVJLlxuICAgKlxuICAgKiBAcmV0dXJucyBUcnVlIGlmIHRoZSB1c2VyIGhhcyBjaGFuZ2VkIHRoZSB2YWx1ZSBvZiB0aGlzIGNvbnRyb2wgaW4gdGhlIFVJOyBjb21wYXJlIGBwcmlzdGluZWAuXG4gICAqIFByb2dyYW1tYXRpYyBjaGFuZ2VzIHRvIGEgY29udHJvbCdzIHZhbHVlIGRvIG5vdCBtYXJrIGl0IGRpcnR5LlxuICAgKi9cbiAgZ2V0IGRpcnR5KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiAhdGhpcy5wcmlzdGluZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUcnVlIGlmIHRoZSBjb250cm9sIGlzIG1hcmtlZCBhcyBgdG91Y2hlZGAuXG4gICAqXG4gICAqIEEgY29udHJvbCBpcyBtYXJrZWQgYHRvdWNoZWRgIG9uY2UgdGhlIHVzZXIgaGFzIHRyaWdnZXJlZFxuICAgKiBhIGBibHVyYCBldmVudCBvbiBpdC5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSB0b3VjaGVkOiBib29sZWFuID0gZmFsc2U7XG5cbiAgLyoqXG4gICAqIFRydWUgaWYgdGhlIGNvbnRyb2wgaGFzIG5vdCBiZWVuIG1hcmtlZCBhcyB0b3VjaGVkXG4gICAqXG4gICAqIEEgY29udHJvbCBpcyBgdW50b3VjaGVkYCBpZiB0aGUgdXNlciBoYXMgbm90IHlldCB0cmlnZ2VyZWRcbiAgICogYSBgYmx1cmAgZXZlbnQgb24gaXQuXG4gICAqL1xuICBnZXQgdW50b3VjaGVkKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiAhdGhpcy50b3VjaGVkO1xuICB9XG5cbiAgLyoqXG4gICAqIEEgbXVsdGljYXN0aW5nIG9ic2VydmFibGUgdGhhdCBlbWl0cyBhbiBldmVudCBldmVyeSB0aW1lIHRoZSB2YWx1ZSBvZiB0aGUgY29udHJvbCBjaGFuZ2VzLCBpblxuICAgKiB0aGUgVUkgb3IgcHJvZ3JhbW1hdGljYWxseS4gSXQgYWxzbyBlbWl0cyBhbiBldmVudCBlYWNoIHRpbWUgeW91IGNhbGwgZW5hYmxlKCkgb3IgZGlzYWJsZSgpXG4gICAqIHdpdGhvdXQgcGFzc2luZyBhbG9uZyB7ZW1pdEV2ZW50OiBmYWxzZX0gYXMgYSBmdW5jdGlvbiBhcmd1bWVudC5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSB2YWx1ZUNoYW5nZXMhOiBPYnNlcnZhYmxlPFRWYWx1ZT47XG5cbiAgLyoqXG4gICAqIEEgbXVsdGljYXN0aW5nIG9ic2VydmFibGUgdGhhdCBlbWl0cyBhbiBldmVudCBldmVyeSB0aW1lIHRoZSB2YWxpZGF0aW9uIGBzdGF0dXNgIG9mIHRoZSBjb250cm9sXG4gICAqIHJlY2FsY3VsYXRlcy5cbiAgICpcbiAgICogQHNlZSBgRm9ybUNvbnRyb2xTdGF0dXNgXG4gICAqIEBzZWUge0BsaW5rIEFic3RyYWN0Q29udHJvbC5zdGF0dXN9XG4gICAqXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgc3RhdHVzQ2hhbmdlcyE6IE9ic2VydmFibGU8Rm9ybUNvbnRyb2xTdGF0dXM+O1xuXG4gIC8qKlxuICAgKiBSZXBvcnRzIHRoZSB1cGRhdGUgc3RyYXRlZ3kgb2YgdGhlIGBBYnN0cmFjdENvbnRyb2xgIChtZWFuaW5nXG4gICAqIHRoZSBldmVudCBvbiB3aGljaCB0aGUgY29udHJvbCB1cGRhdGVzIGl0c2VsZikuXG4gICAqIFBvc3NpYmxlIHZhbHVlczogYCdjaGFuZ2UnYCB8IGAnYmx1cidgIHwgYCdzdWJtaXQnYFxuICAgKiBEZWZhdWx0IHZhbHVlOiBgJ2NoYW5nZSdgXG4gICAqL1xuICBnZXQgdXBkYXRlT24oKTogRm9ybUhvb2tzIHtcbiAgICByZXR1cm4gdGhpcy5fdXBkYXRlT24gPyB0aGlzLl91cGRhdGVPbiA6ICh0aGlzLnBhcmVudCA/IHRoaXMucGFyZW50LnVwZGF0ZU9uIDogJ2NoYW5nZScpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIHN5bmNocm9ub3VzIHZhbGlkYXRvcnMgdGhhdCBhcmUgYWN0aXZlIG9uIHRoaXMgY29udHJvbC4gIENhbGxpbmdcbiAgICogdGhpcyBvdmVyd3JpdGVzIGFueSBleGlzdGluZyBzeW5jaHJvbm91cyB2YWxpZGF0b3JzLlxuICAgKlxuICAgKiBXaGVuIHlvdSBhZGQgb3IgcmVtb3ZlIGEgdmFsaWRhdG9yIGF0IHJ1biB0aW1lLCB5b3UgbXVzdCBjYWxsXG4gICAqIGB1cGRhdGVWYWx1ZUFuZFZhbGlkaXR5KClgIGZvciB0aGUgbmV3IHZhbGlkYXRpb24gdG8gdGFrZSBlZmZlY3QuXG4gICAqXG4gICAqIElmIHlvdSB3YW50IHRvIGFkZCBhIG5ldyB2YWxpZGF0b3Igd2l0aG91dCBhZmZlY3RpbmcgZXhpc3Rpbmcgb25lcywgY29uc2lkZXJcbiAgICogdXNpbmcgYGFkZFZhbGlkYXRvcnMoKWAgbWV0aG9kIGluc3RlYWQuXG4gICAqL1xuICBzZXRWYWxpZGF0b3JzKHZhbGlkYXRvcnM6IFZhbGlkYXRvckZufFZhbGlkYXRvckZuW118bnVsbCk6IHZvaWQge1xuICAgIHRoaXMuX3Jhd1ZhbGlkYXRvcnMgPSB2YWxpZGF0b3JzO1xuICAgIHRoaXMuX2NvbXBvc2VkVmFsaWRhdG9yRm4gPSBjb2VyY2VUb1ZhbGlkYXRvcih2YWxpZGF0b3JzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBhc3luY2hyb25vdXMgdmFsaWRhdG9ycyB0aGF0IGFyZSBhY3RpdmUgb24gdGhpcyBjb250cm9sLiBDYWxsaW5nIHRoaXNcbiAgICogb3ZlcndyaXRlcyBhbnkgZXhpc3RpbmcgYXN5bmNocm9ub3VzIHZhbGlkYXRvcnMuXG4gICAqXG4gICAqIFdoZW4geW91IGFkZCBvciByZW1vdmUgYSB2YWxpZGF0b3IgYXQgcnVuIHRpbWUsIHlvdSBtdXN0IGNhbGxcbiAgICogYHVwZGF0ZVZhbHVlQW5kVmFsaWRpdHkoKWAgZm9yIHRoZSBuZXcgdmFsaWRhdGlvbiB0byB0YWtlIGVmZmVjdC5cbiAgICpcbiAgICogSWYgeW91IHdhbnQgdG8gYWRkIGEgbmV3IHZhbGlkYXRvciB3aXRob3V0IGFmZmVjdGluZyBleGlzdGluZyBvbmVzLCBjb25zaWRlclxuICAgKiB1c2luZyBgYWRkQXN5bmNWYWxpZGF0b3JzKClgIG1ldGhvZCBpbnN0ZWFkLlxuICAgKi9cbiAgc2V0QXN5bmNWYWxpZGF0b3JzKHZhbGlkYXRvcnM6IEFzeW5jVmFsaWRhdG9yRm58QXN5bmNWYWxpZGF0b3JGbltdfG51bGwpOiB2b2lkIHtcbiAgICB0aGlzLl9yYXdBc3luY1ZhbGlkYXRvcnMgPSB2YWxpZGF0b3JzO1xuICAgIHRoaXMuX2NvbXBvc2VkQXN5bmNWYWxpZGF0b3JGbiA9IGNvZXJjZVRvQXN5bmNWYWxpZGF0b3IodmFsaWRhdG9ycyk7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGEgc3luY2hyb25vdXMgdmFsaWRhdG9yIG9yIHZhbGlkYXRvcnMgdG8gdGhpcyBjb250cm9sLCB3aXRob3V0IGFmZmVjdGluZyBvdGhlciB2YWxpZGF0b3JzLlxuICAgKlxuICAgKiBXaGVuIHlvdSBhZGQgb3IgcmVtb3ZlIGEgdmFsaWRhdG9yIGF0IHJ1biB0aW1lLCB5b3UgbXVzdCBjYWxsXG4gICAqIGB1cGRhdGVWYWx1ZUFuZFZhbGlkaXR5KClgIGZvciB0aGUgbmV3IHZhbGlkYXRpb24gdG8gdGFrZSBlZmZlY3QuXG4gICAqXG4gICAqIEFkZGluZyBhIHZhbGlkYXRvciB0aGF0IGFscmVhZHkgZXhpc3RzIHdpbGwgaGF2ZSBubyBlZmZlY3QuIElmIGR1cGxpY2F0ZSB2YWxpZGF0b3IgZnVuY3Rpb25zXG4gICAqIGFyZSBwcmVzZW50IGluIHRoZSBgdmFsaWRhdG9yc2AgYXJyYXksIG9ubHkgdGhlIGZpcnN0IGluc3RhbmNlIHdvdWxkIGJlIGFkZGVkIHRvIGEgZm9ybVxuICAgKiBjb250cm9sLlxuICAgKlxuICAgKiBAcGFyYW0gdmFsaWRhdG9ycyBUaGUgbmV3IHZhbGlkYXRvciBmdW5jdGlvbiBvciBmdW5jdGlvbnMgdG8gYWRkIHRvIHRoaXMgY29udHJvbC5cbiAgICovXG4gIGFkZFZhbGlkYXRvcnModmFsaWRhdG9yczogVmFsaWRhdG9yRm58VmFsaWRhdG9yRm5bXSk6IHZvaWQge1xuICAgIHRoaXMuc2V0VmFsaWRhdG9ycyhhZGRWYWxpZGF0b3JzKHZhbGlkYXRvcnMsIHRoaXMuX3Jhd1ZhbGlkYXRvcnMpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYW4gYXN5bmNocm9ub3VzIHZhbGlkYXRvciBvciB2YWxpZGF0b3JzIHRvIHRoaXMgY29udHJvbCwgd2l0aG91dCBhZmZlY3Rpbmcgb3RoZXJcbiAgICogdmFsaWRhdG9ycy5cbiAgICpcbiAgICogV2hlbiB5b3UgYWRkIG9yIHJlbW92ZSBhIHZhbGlkYXRvciBhdCBydW4gdGltZSwgeW91IG11c3QgY2FsbFxuICAgKiBgdXBkYXRlVmFsdWVBbmRWYWxpZGl0eSgpYCBmb3IgdGhlIG5ldyB2YWxpZGF0aW9uIHRvIHRha2UgZWZmZWN0LlxuICAgKlxuICAgKiBBZGRpbmcgYSB2YWxpZGF0b3IgdGhhdCBhbHJlYWR5IGV4aXN0cyB3aWxsIGhhdmUgbm8gZWZmZWN0LlxuICAgKlxuICAgKiBAcGFyYW0gdmFsaWRhdG9ycyBUaGUgbmV3IGFzeW5jaHJvbm91cyB2YWxpZGF0b3IgZnVuY3Rpb24gb3IgZnVuY3Rpb25zIHRvIGFkZCB0byB0aGlzIGNvbnRyb2wuXG4gICAqL1xuICBhZGRBc3luY1ZhbGlkYXRvcnModmFsaWRhdG9yczogQXN5bmNWYWxpZGF0b3JGbnxBc3luY1ZhbGlkYXRvckZuW10pOiB2b2lkIHtcbiAgICB0aGlzLnNldEFzeW5jVmFsaWRhdG9ycyhhZGRWYWxpZGF0b3JzKHZhbGlkYXRvcnMsIHRoaXMuX3Jhd0FzeW5jVmFsaWRhdG9ycykpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhIHN5bmNocm9ub3VzIHZhbGlkYXRvciBmcm9tIHRoaXMgY29udHJvbCwgd2l0aG91dCBhZmZlY3Rpbmcgb3RoZXIgdmFsaWRhdG9ycy5cbiAgICogVmFsaWRhdG9ycyBhcmUgY29tcGFyZWQgYnkgZnVuY3Rpb24gcmVmZXJlbmNlOyB5b3UgbXVzdCBwYXNzIGEgcmVmZXJlbmNlIHRvIHRoZSBleGFjdCBzYW1lXG4gICAqIHZhbGlkYXRvciBmdW5jdGlvbiBhcyB0aGUgb25lIHRoYXQgd2FzIG9yaWdpbmFsbHkgc2V0LiBJZiBhIHByb3ZpZGVkIHZhbGlkYXRvciBpcyBub3QgZm91bmQsXG4gICAqIGl0IGlzIGlnbm9yZWQuXG4gICAqXG4gICAqIEB1c2FnZU5vdGVzXG4gICAqXG4gICAqICMjIyBSZWZlcmVuY2UgdG8gYSBWYWxpZGF0b3JGblxuICAgKlxuICAgKiBgYGBcbiAgICogLy8gUmVmZXJlbmNlIHRvIHRoZSBSZXF1aXJlZFZhbGlkYXRvclxuICAgKiBjb25zdCBjdHJsID0gbmV3IEZvcm1Db250cm9sPHN0cmluZyB8IG51bGw+KCcnLCBWYWxpZGF0b3JzLnJlcXVpcmVkKTtcbiAgICogY3RybC5yZW1vdmVWYWxpZGF0b3JzKFZhbGlkYXRvcnMucmVxdWlyZWQpO1xuICAgKlxuICAgKiAvLyBSZWZlcmVuY2UgdG8gYW5vbnltb3VzIGZ1bmN0aW9uIGluc2lkZSBNaW5WYWxpZGF0b3JcbiAgICogY29uc3QgbWluVmFsaWRhdG9yID0gVmFsaWRhdG9ycy5taW4oMyk7XG4gICAqIGNvbnN0IGN0cmwgPSBuZXcgRm9ybUNvbnRyb2w8c3RyaW5nIHwgbnVsbD4oJycsIG1pblZhbGlkYXRvcik7XG4gICAqIGV4cGVjdChjdHJsLmhhc1ZhbGlkYXRvcihtaW5WYWxpZGF0b3IpKS50b0VxdWFsKHRydWUpXG4gICAqIGV4cGVjdChjdHJsLmhhc1ZhbGlkYXRvcihWYWxpZGF0b3JzLm1pbigzKSkudG9FcXVhbChmYWxzZSlcbiAgICpcbiAgICogY3RybC5yZW1vdmVWYWxpZGF0b3JzKG1pblZhbGlkYXRvcik7XG4gICAqIGBgYFxuICAgKlxuICAgKiBXaGVuIHlvdSBhZGQgb3IgcmVtb3ZlIGEgdmFsaWRhdG9yIGF0IHJ1biB0aW1lLCB5b3UgbXVzdCBjYWxsXG4gICAqIGB1cGRhdGVWYWx1ZUFuZFZhbGlkaXR5KClgIGZvciB0aGUgbmV3IHZhbGlkYXRpb24gdG8gdGFrZSBlZmZlY3QuXG4gICAqXG4gICAqIEBwYXJhbSB2YWxpZGF0b3JzIFRoZSB2YWxpZGF0b3Igb3IgdmFsaWRhdG9ycyB0byByZW1vdmUuXG4gICAqL1xuICByZW1vdmVWYWxpZGF0b3JzKHZhbGlkYXRvcnM6IFZhbGlkYXRvckZufFZhbGlkYXRvckZuW10pOiB2b2lkIHtcbiAgICB0aGlzLnNldFZhbGlkYXRvcnMocmVtb3ZlVmFsaWRhdG9ycyh2YWxpZGF0b3JzLCB0aGlzLl9yYXdWYWxpZGF0b3JzKSk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFuIGFzeW5jaHJvbm91cyB2YWxpZGF0b3IgZnJvbSB0aGlzIGNvbnRyb2wsIHdpdGhvdXQgYWZmZWN0aW5nIG90aGVyIHZhbGlkYXRvcnMuXG4gICAqIFZhbGlkYXRvcnMgYXJlIGNvbXBhcmVkIGJ5IGZ1bmN0aW9uIHJlZmVyZW5jZTsgeW91IG11c3QgcGFzcyBhIHJlZmVyZW5jZSB0byB0aGUgZXhhY3Qgc2FtZVxuICAgKiB2YWxpZGF0b3IgZnVuY3Rpb24gYXMgdGhlIG9uZSB0aGF0IHdhcyBvcmlnaW5hbGx5IHNldC4gSWYgYSBwcm92aWRlZCB2YWxpZGF0b3IgaXMgbm90IGZvdW5kLCBpdFxuICAgKiBpcyBpZ25vcmVkLlxuICAgKlxuICAgKiBXaGVuIHlvdSBhZGQgb3IgcmVtb3ZlIGEgdmFsaWRhdG9yIGF0IHJ1biB0aW1lLCB5b3UgbXVzdCBjYWxsXG4gICAqIGB1cGRhdGVWYWx1ZUFuZFZhbGlkaXR5KClgIGZvciB0aGUgbmV3IHZhbGlkYXRpb24gdG8gdGFrZSBlZmZlY3QuXG4gICAqXG4gICAqIEBwYXJhbSB2YWxpZGF0b3JzIFRoZSBhc3luY2hyb25vdXMgdmFsaWRhdG9yIG9yIHZhbGlkYXRvcnMgdG8gcmVtb3ZlLlxuICAgKi9cbiAgcmVtb3ZlQXN5bmNWYWxpZGF0b3JzKHZhbGlkYXRvcnM6IEFzeW5jVmFsaWRhdG9yRm58QXN5bmNWYWxpZGF0b3JGbltdKTogdm9pZCB7XG4gICAgdGhpcy5zZXRBc3luY1ZhbGlkYXRvcnMocmVtb3ZlVmFsaWRhdG9ycyh2YWxpZGF0b3JzLCB0aGlzLl9yYXdBc3luY1ZhbGlkYXRvcnMpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayB3aGV0aGVyIGEgc3luY2hyb25vdXMgdmFsaWRhdG9yIGZ1bmN0aW9uIGlzIHByZXNlbnQgb24gdGhpcyBjb250cm9sLiBUaGUgcHJvdmlkZWRcbiAgICogdmFsaWRhdG9yIG11c3QgYmUgYSByZWZlcmVuY2UgdG8gdGhlIGV4YWN0IHNhbWUgZnVuY3Rpb24gdGhhdCB3YXMgcHJvdmlkZWQuXG4gICAqXG4gICAqIEB1c2FnZU5vdGVzXG4gICAqXG4gICAqICMjIyBSZWZlcmVuY2UgdG8gYSBWYWxpZGF0b3JGblxuICAgKlxuICAgKiBgYGBcbiAgICogLy8gUmVmZXJlbmNlIHRvIHRoZSBSZXF1aXJlZFZhbGlkYXRvclxuICAgKiBjb25zdCBjdHJsID0gbmV3IEZvcm1Db250cm9sPG51bWJlciB8IG51bGw+KDAsIFZhbGlkYXRvcnMucmVxdWlyZWQpO1xuICAgKiBleHBlY3QoY3RybC5oYXNWYWxpZGF0b3IoVmFsaWRhdG9ycy5yZXF1aXJlZCkpLnRvRXF1YWwodHJ1ZSlcbiAgICpcbiAgICogLy8gUmVmZXJlbmNlIHRvIGFub255bW91cyBmdW5jdGlvbiBpbnNpZGUgTWluVmFsaWRhdG9yXG4gICAqIGNvbnN0IG1pblZhbGlkYXRvciA9IFZhbGlkYXRvcnMubWluKDMpO1xuICAgKiBjb25zdCBjdHJsID0gbmV3IEZvcm1Db250cm9sPG51bWJlciB8IG51bGw+KDAsIG1pblZhbGlkYXRvcik7XG4gICAqIGV4cGVjdChjdHJsLmhhc1ZhbGlkYXRvcihtaW5WYWxpZGF0b3IpKS50b0VxdWFsKHRydWUpXG4gICAqIGV4cGVjdChjdHJsLmhhc1ZhbGlkYXRvcihWYWxpZGF0b3JzLm1pbigzKSkudG9FcXVhbChmYWxzZSlcbiAgICogYGBgXG4gICAqXG4gICAqIEBwYXJhbSB2YWxpZGF0b3IgVGhlIHZhbGlkYXRvciB0byBjaGVjayBmb3IgcHJlc2VuY2UuIENvbXBhcmVkIGJ5IGZ1bmN0aW9uIHJlZmVyZW5jZS5cbiAgICogQHJldHVybnMgV2hldGhlciB0aGUgcHJvdmlkZWQgdmFsaWRhdG9yIHdhcyBmb3VuZCBvbiB0aGlzIGNvbnRyb2wuXG4gICAqL1xuICBoYXNWYWxpZGF0b3IodmFsaWRhdG9yOiBWYWxpZGF0b3JGbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBoYXNWYWxpZGF0b3IodGhpcy5fcmF3VmFsaWRhdG9ycywgdmFsaWRhdG9yKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayB3aGV0aGVyIGFuIGFzeW5jaHJvbm91cyB2YWxpZGF0b3IgZnVuY3Rpb24gaXMgcHJlc2VudCBvbiB0aGlzIGNvbnRyb2wuIFRoZSBwcm92aWRlZFxuICAgKiB2YWxpZGF0b3IgbXVzdCBiZSBhIHJlZmVyZW5jZSB0byB0aGUgZXhhY3Qgc2FtZSBmdW5jdGlvbiB0aGF0IHdhcyBwcm92aWRlZC5cbiAgICpcbiAgICogQHBhcmFtIHZhbGlkYXRvciBUaGUgYXN5bmNocm9ub3VzIHZhbGlkYXRvciB0byBjaGVjayBmb3IgcHJlc2VuY2UuIENvbXBhcmVkIGJ5IGZ1bmN0aW9uXG4gICAqICAgICByZWZlcmVuY2UuXG4gICAqIEByZXR1cm5zIFdoZXRoZXIgdGhlIHByb3ZpZGVkIGFzeW5jaHJvbm91cyB2YWxpZGF0b3Igd2FzIGZvdW5kIG9uIHRoaXMgY29udHJvbC5cbiAgICovXG4gIGhhc0FzeW5jVmFsaWRhdG9yKHZhbGlkYXRvcjogQXN5bmNWYWxpZGF0b3JGbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBoYXNWYWxpZGF0b3IodGhpcy5fcmF3QXN5bmNWYWxpZGF0b3JzLCB2YWxpZGF0b3IpO1xuICB9XG5cbiAgLyoqXG4gICAqIEVtcHRpZXMgb3V0IHRoZSBzeW5jaHJvbm91cyB2YWxpZGF0b3IgbGlzdC5cbiAgICpcbiAgICogV2hlbiB5b3UgYWRkIG9yIHJlbW92ZSBhIHZhbGlkYXRvciBhdCBydW4gdGltZSwgeW91IG11c3QgY2FsbFxuICAgKiBgdXBkYXRlVmFsdWVBbmRWYWxpZGl0eSgpYCBmb3IgdGhlIG5ldyB2YWxpZGF0aW9uIHRvIHRha2UgZWZmZWN0LlxuICAgKlxuICAgKi9cbiAgY2xlYXJWYWxpZGF0b3JzKCk6IHZvaWQge1xuICAgIHRoaXMudmFsaWRhdG9yID0gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBFbXB0aWVzIG91dCB0aGUgYXN5bmMgdmFsaWRhdG9yIGxpc3QuXG4gICAqXG4gICAqIFdoZW4geW91IGFkZCBvciByZW1vdmUgYSB2YWxpZGF0b3IgYXQgcnVuIHRpbWUsIHlvdSBtdXN0IGNhbGxcbiAgICogYHVwZGF0ZVZhbHVlQW5kVmFsaWRpdHkoKWAgZm9yIHRoZSBuZXcgdmFsaWRhdGlvbiB0byB0YWtlIGVmZmVjdC5cbiAgICpcbiAgICovXG4gIGNsZWFyQXN5bmNWYWxpZGF0b3JzKCk6IHZvaWQge1xuICAgIHRoaXMuYXN5bmNWYWxpZGF0b3IgPSBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIE1hcmtzIHRoZSBjb250cm9sIGFzIGB0b3VjaGVkYC4gQSBjb250cm9sIGlzIHRvdWNoZWQgYnkgZm9jdXMgYW5kXG4gICAqIGJsdXIgZXZlbnRzIHRoYXQgZG8gbm90IGNoYW5nZSB0aGUgdmFsdWUuXG4gICAqXG4gICAqIEBzZWUgYG1hcmtBc1VudG91Y2hlZCgpYFxuICAgKiBAc2VlIGBtYXJrQXNEaXJ0eSgpYFxuICAgKiBAc2VlIGBtYXJrQXNQcmlzdGluZSgpYFxuICAgKlxuICAgKiBAcGFyYW0gb3B0cyBDb25maWd1cmF0aW9uIG9wdGlvbnMgdGhhdCBkZXRlcm1pbmUgaG93IHRoZSBjb250cm9sIHByb3BhZ2F0ZXMgY2hhbmdlc1xuICAgKiBhbmQgZW1pdHMgZXZlbnRzIGFmdGVyIG1hcmtpbmcgaXMgYXBwbGllZC5cbiAgICogKiBgb25seVNlbGZgOiBXaGVuIHRydWUsIG1hcmsgb25seSB0aGlzIGNvbnRyb2wuIFdoZW4gZmFsc2Ugb3Igbm90IHN1cHBsaWVkLFxuICAgKiBtYXJrcyBhbGwgZGlyZWN0IGFuY2VzdG9ycy4gRGVmYXVsdCBpcyBmYWxzZS5cbiAgICovXG4gIG1hcmtBc1RvdWNoZWQob3B0czoge29ubHlTZWxmPzogYm9vbGVhbn0gPSB7fSk6IHZvaWQge1xuICAgICh0aGlzIGFzIHt0b3VjaGVkOiBib29sZWFufSkudG91Y2hlZCA9IHRydWU7XG5cbiAgICBpZiAodGhpcy5fcGFyZW50ICYmICFvcHRzLm9ubHlTZWxmKSB7XG4gICAgICB0aGlzLl9wYXJlbnQubWFya0FzVG91Y2hlZChvcHRzKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTWFya3MgdGhlIGNvbnRyb2wgYW5kIGFsbCBpdHMgZGVzY2VuZGFudCBjb250cm9scyBhcyBgdG91Y2hlZGAuXG4gICAqIEBzZWUgYG1hcmtBc1RvdWNoZWQoKWBcbiAgICovXG4gIG1hcmtBbGxBc1RvdWNoZWQoKTogdm9pZCB7XG4gICAgdGhpcy5tYXJrQXNUb3VjaGVkKHtvbmx5U2VsZjogdHJ1ZX0pO1xuXG4gICAgdGhpcy5fZm9yRWFjaENoaWxkKChjb250cm9sOiBBYnN0cmFjdENvbnRyb2wpID0+IGNvbnRyb2wubWFya0FsbEFzVG91Y2hlZCgpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBNYXJrcyB0aGUgY29udHJvbCBhcyBgdW50b3VjaGVkYC5cbiAgICpcbiAgICogSWYgdGhlIGNvbnRyb2wgaGFzIGFueSBjaGlsZHJlbiwgYWxzbyBtYXJrcyBhbGwgY2hpbGRyZW4gYXMgYHVudG91Y2hlZGBcbiAgICogYW5kIHJlY2FsY3VsYXRlcyB0aGUgYHRvdWNoZWRgIHN0YXR1cyBvZiBhbGwgcGFyZW50IGNvbnRyb2xzLlxuICAgKlxuICAgKiBAc2VlIGBtYXJrQXNUb3VjaGVkKClgXG4gICAqIEBzZWUgYG1hcmtBc0RpcnR5KClgXG4gICAqIEBzZWUgYG1hcmtBc1ByaXN0aW5lKClgXG4gICAqXG4gICAqIEBwYXJhbSBvcHRzIENvbmZpZ3VyYXRpb24gb3B0aW9ucyB0aGF0IGRldGVybWluZSBob3cgdGhlIGNvbnRyb2wgcHJvcGFnYXRlcyBjaGFuZ2VzXG4gICAqIGFuZCBlbWl0cyBldmVudHMgYWZ0ZXIgdGhlIG1hcmtpbmcgaXMgYXBwbGllZC5cbiAgICogKiBgb25seVNlbGZgOiBXaGVuIHRydWUsIG1hcmsgb25seSB0aGlzIGNvbnRyb2wuIFdoZW4gZmFsc2Ugb3Igbm90IHN1cHBsaWVkLFxuICAgKiBtYXJrcyBhbGwgZGlyZWN0IGFuY2VzdG9ycy4gRGVmYXVsdCBpcyBmYWxzZS5cbiAgICovXG4gIG1hcmtBc1VudG91Y2hlZChvcHRzOiB7b25seVNlbGY/OiBib29sZWFufSA9IHt9KTogdm9pZCB7XG4gICAgKHRoaXMgYXMge3RvdWNoZWQ6IGJvb2xlYW59KS50b3VjaGVkID0gZmFsc2U7XG4gICAgdGhpcy5fcGVuZGluZ1RvdWNoZWQgPSBmYWxzZTtcblxuICAgIHRoaXMuX2ZvckVhY2hDaGlsZCgoY29udHJvbDogQWJzdHJhY3RDb250cm9sKSA9PiB7XG4gICAgICBjb250cm9sLm1hcmtBc1VudG91Y2hlZCh7b25seVNlbGY6IHRydWV9KTtcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLl9wYXJlbnQgJiYgIW9wdHMub25seVNlbGYpIHtcbiAgICAgIHRoaXMuX3BhcmVudC5fdXBkYXRlVG91Y2hlZChvcHRzKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTWFya3MgdGhlIGNvbnRyb2wgYXMgYGRpcnR5YC4gQSBjb250cm9sIGJlY29tZXMgZGlydHkgd2hlblxuICAgKiB0aGUgY29udHJvbCdzIHZhbHVlIGlzIGNoYW5nZWQgdGhyb3VnaCB0aGUgVUk7IGNvbXBhcmUgYG1hcmtBc1RvdWNoZWRgLlxuICAgKlxuICAgKiBAc2VlIGBtYXJrQXNUb3VjaGVkKClgXG4gICAqIEBzZWUgYG1hcmtBc1VudG91Y2hlZCgpYFxuICAgKiBAc2VlIGBtYXJrQXNQcmlzdGluZSgpYFxuICAgKlxuICAgKiBAcGFyYW0gb3B0cyBDb25maWd1cmF0aW9uIG9wdGlvbnMgdGhhdCBkZXRlcm1pbmUgaG93IHRoZSBjb250cm9sIHByb3BhZ2F0ZXMgY2hhbmdlc1xuICAgKiBhbmQgZW1pdHMgZXZlbnRzIGFmdGVyIG1hcmtpbmcgaXMgYXBwbGllZC5cbiAgICogKiBgb25seVNlbGZgOiBXaGVuIHRydWUsIG1hcmsgb25seSB0aGlzIGNvbnRyb2wuIFdoZW4gZmFsc2Ugb3Igbm90IHN1cHBsaWVkLFxuICAgKiBtYXJrcyBhbGwgZGlyZWN0IGFuY2VzdG9ycy4gRGVmYXVsdCBpcyBmYWxzZS5cbiAgICovXG4gIG1hcmtBc0RpcnR5KG9wdHM6IHtvbmx5U2VsZj86IGJvb2xlYW59ID0ge30pOiB2b2lkIHtcbiAgICAodGhpcyBhcyB7cHJpc3RpbmU6IGJvb2xlYW59KS5wcmlzdGluZSA9IGZhbHNlO1xuXG4gICAgaWYgKHRoaXMuX3BhcmVudCAmJiAhb3B0cy5vbmx5U2VsZikge1xuICAgICAgdGhpcy5fcGFyZW50Lm1hcmtBc0RpcnR5KG9wdHMpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBNYXJrcyB0aGUgY29udHJvbCBhcyBgcHJpc3RpbmVgLlxuICAgKlxuICAgKiBJZiB0aGUgY29udHJvbCBoYXMgYW55IGNoaWxkcmVuLCBtYXJrcyBhbGwgY2hpbGRyZW4gYXMgYHByaXN0aW5lYCxcbiAgICogYW5kIHJlY2FsY3VsYXRlcyB0aGUgYHByaXN0aW5lYCBzdGF0dXMgb2YgYWxsIHBhcmVudFxuICAgKiBjb250cm9scy5cbiAgICpcbiAgICogQHNlZSBgbWFya0FzVG91Y2hlZCgpYFxuICAgKiBAc2VlIGBtYXJrQXNVbnRvdWNoZWQoKWBcbiAgICogQHNlZSBgbWFya0FzRGlydHkoKWBcbiAgICpcbiAgICogQHBhcmFtIG9wdHMgQ29uZmlndXJhdGlvbiBvcHRpb25zIHRoYXQgZGV0ZXJtaW5lIGhvdyB0aGUgY29udHJvbCBlbWl0cyBldmVudHMgYWZ0ZXJcbiAgICogbWFya2luZyBpcyBhcHBsaWVkLlxuICAgKiAqIGBvbmx5U2VsZmA6IFdoZW4gdHJ1ZSwgbWFyayBvbmx5IHRoaXMgY29udHJvbC4gV2hlbiBmYWxzZSBvciBub3Qgc3VwcGxpZWQsXG4gICAqIG1hcmtzIGFsbCBkaXJlY3QgYW5jZXN0b3JzLiBEZWZhdWx0IGlzIGZhbHNlLlxuICAgKi9cbiAgbWFya0FzUHJpc3RpbmUob3B0czoge29ubHlTZWxmPzogYm9vbGVhbn0gPSB7fSk6IHZvaWQge1xuICAgICh0aGlzIGFzIHtwcmlzdGluZTogYm9vbGVhbn0pLnByaXN0aW5lID0gdHJ1ZTtcbiAgICB0aGlzLl9wZW5kaW5nRGlydHkgPSBmYWxzZTtcblxuICAgIHRoaXMuX2ZvckVhY2hDaGlsZCgoY29udHJvbDogQWJzdHJhY3RDb250cm9sKSA9PiB7XG4gICAgICBjb250cm9sLm1hcmtBc1ByaXN0aW5lKHtvbmx5U2VsZjogdHJ1ZX0pO1xuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMuX3BhcmVudCAmJiAhb3B0cy5vbmx5U2VsZikge1xuICAgICAgdGhpcy5fcGFyZW50Ll91cGRhdGVQcmlzdGluZShvcHRzKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTWFya3MgdGhlIGNvbnRyb2wgYXMgYHBlbmRpbmdgLlxuICAgKlxuICAgKiBBIGNvbnRyb2wgaXMgcGVuZGluZyB3aGlsZSB0aGUgY29udHJvbCBwZXJmb3JtcyBhc3luYyB2YWxpZGF0aW9uLlxuICAgKlxuICAgKiBAc2VlIHtAbGluayBBYnN0cmFjdENvbnRyb2wuc3RhdHVzfVxuICAgKlxuICAgKiBAcGFyYW0gb3B0cyBDb25maWd1cmF0aW9uIG9wdGlvbnMgdGhhdCBkZXRlcm1pbmUgaG93IHRoZSBjb250cm9sIHByb3BhZ2F0ZXMgY2hhbmdlcyBhbmRcbiAgICogZW1pdHMgZXZlbnRzIGFmdGVyIG1hcmtpbmcgaXMgYXBwbGllZC5cbiAgICogKiBgb25seVNlbGZgOiBXaGVuIHRydWUsIG1hcmsgb25seSB0aGlzIGNvbnRyb2wuIFdoZW4gZmFsc2Ugb3Igbm90IHN1cHBsaWVkLFxuICAgKiBtYXJrcyBhbGwgZGlyZWN0IGFuY2VzdG9ycy4gRGVmYXVsdCBpcyBmYWxzZS5cbiAgICogKiBgZW1pdEV2ZW50YDogV2hlbiB0cnVlIG9yIG5vdCBzdXBwbGllZCAodGhlIGRlZmF1bHQpLCB0aGUgYHN0YXR1c0NoYW5nZXNgXG4gICAqIG9ic2VydmFibGUgZW1pdHMgYW4gZXZlbnQgd2l0aCB0aGUgbGF0ZXN0IHN0YXR1cyB0aGUgY29udHJvbCBpcyBtYXJrZWQgcGVuZGluZy5cbiAgICogV2hlbiBmYWxzZSwgbm8gZXZlbnRzIGFyZSBlbWl0dGVkLlxuICAgKlxuICAgKi9cbiAgbWFya0FzUGVuZGluZyhvcHRzOiB7b25seVNlbGY/OiBib29sZWFuLCBlbWl0RXZlbnQ/OiBib29sZWFufSA9IHt9KTogdm9pZCB7XG4gICAgKHRoaXMgYXMge3N0YXR1czogRm9ybUNvbnRyb2xTdGF0dXN9KS5zdGF0dXMgPSBQRU5ESU5HO1xuXG4gICAgaWYgKG9wdHMuZW1pdEV2ZW50ICE9PSBmYWxzZSkge1xuICAgICAgKHRoaXMuc3RhdHVzQ2hhbmdlcyBhcyBFdmVudEVtaXR0ZXI8Rm9ybUNvbnRyb2xTdGF0dXM+KS5lbWl0KHRoaXMuc3RhdHVzKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fcGFyZW50ICYmICFvcHRzLm9ubHlTZWxmKSB7XG4gICAgICB0aGlzLl9wYXJlbnQubWFya0FzUGVuZGluZyhvcHRzKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGlzYWJsZXMgdGhlIGNvbnRyb2wuIFRoaXMgbWVhbnMgdGhlIGNvbnRyb2wgaXMgZXhlbXB0IGZyb20gdmFsaWRhdGlvbiBjaGVja3MgYW5kXG4gICAqIGV4Y2x1ZGVkIGZyb20gdGhlIGFnZ3JlZ2F0ZSB2YWx1ZSBvZiBhbnkgcGFyZW50LiBJdHMgc3RhdHVzIGlzIGBESVNBQkxFRGAuXG4gICAqXG4gICAqIElmIHRoZSBjb250cm9sIGhhcyBjaGlsZHJlbiwgYWxsIGNoaWxkcmVuIGFyZSBhbHNvIGRpc2FibGVkLlxuICAgKlxuICAgKiBAc2VlIHtAbGluayBBYnN0cmFjdENvbnRyb2wuc3RhdHVzfVxuICAgKlxuICAgKiBAcGFyYW0gb3B0cyBDb25maWd1cmF0aW9uIG9wdGlvbnMgdGhhdCBkZXRlcm1pbmUgaG93IHRoZSBjb250cm9sIHByb3BhZ2F0ZXNcbiAgICogY2hhbmdlcyBhbmQgZW1pdHMgZXZlbnRzIGFmdGVyIHRoZSBjb250cm9sIGlzIGRpc2FibGVkLlxuICAgKiAqIGBvbmx5U2VsZmA6IFdoZW4gdHJ1ZSwgbWFyayBvbmx5IHRoaXMgY29udHJvbC4gV2hlbiBmYWxzZSBvciBub3Qgc3VwcGxpZWQsXG4gICAqIG1hcmtzIGFsbCBkaXJlY3QgYW5jZXN0b3JzLiBEZWZhdWx0IGlzIGZhbHNlLlxuICAgKiAqIGBlbWl0RXZlbnRgOiBXaGVuIHRydWUgb3Igbm90IHN1cHBsaWVkICh0aGUgZGVmYXVsdCksIGJvdGggdGhlIGBzdGF0dXNDaGFuZ2VzYCBhbmRcbiAgICogYHZhbHVlQ2hhbmdlc2BcbiAgICogb2JzZXJ2YWJsZXMgZW1pdCBldmVudHMgd2l0aCB0aGUgbGF0ZXN0IHN0YXR1cyBhbmQgdmFsdWUgd2hlbiB0aGUgY29udHJvbCBpcyBkaXNhYmxlZC5cbiAgICogV2hlbiBmYWxzZSwgbm8gZXZlbnRzIGFyZSBlbWl0dGVkLlxuICAgKi9cbiAgZGlzYWJsZShvcHRzOiB7b25seVNlbGY/OiBib29sZWFuLCBlbWl0RXZlbnQ/OiBib29sZWFufSA9IHt9KTogdm9pZCB7XG4gICAgLy8gSWYgcGFyZW50IGhhcyBiZWVuIG1hcmtlZCBhcnRpZmljaWFsbHkgZGlydHkgd2UgZG9uJ3Qgd2FudCB0byByZS1jYWxjdWxhdGUgdGhlXG4gICAgLy8gcGFyZW50J3MgZGlydGluZXNzIGJhc2VkIG9uIHRoZSBjaGlsZHJlbi5cbiAgICBjb25zdCBza2lwUHJpc3RpbmVDaGVjayA9IHRoaXMuX3BhcmVudE1hcmtlZERpcnR5KG9wdHMub25seVNlbGYpO1xuXG4gICAgKHRoaXMgYXMge3N0YXR1czogRm9ybUNvbnRyb2xTdGF0dXN9KS5zdGF0dXMgPSBESVNBQkxFRDtcbiAgICAodGhpcyBhcyB7ZXJyb3JzOiBWYWxpZGF0aW9uRXJyb3JzIHwgbnVsbH0pLmVycm9ycyA9IG51bGw7XG4gICAgdGhpcy5fZm9yRWFjaENoaWxkKChjb250cm9sOiBBYnN0cmFjdENvbnRyb2wpID0+IHtcbiAgICAgIGNvbnRyb2wuZGlzYWJsZSh7Li4ub3B0cywgb25seVNlbGY6IHRydWV9KTtcbiAgICB9KTtcbiAgICB0aGlzLl91cGRhdGVWYWx1ZSgpO1xuXG4gICAgaWYgKG9wdHMuZW1pdEV2ZW50ICE9PSBmYWxzZSkge1xuICAgICAgKHRoaXMudmFsdWVDaGFuZ2VzIGFzIEV2ZW50RW1pdHRlcjxUVmFsdWU+KS5lbWl0KHRoaXMudmFsdWUpO1xuICAgICAgKHRoaXMuc3RhdHVzQ2hhbmdlcyBhcyBFdmVudEVtaXR0ZXI8Rm9ybUNvbnRyb2xTdGF0dXM+KS5lbWl0KHRoaXMuc3RhdHVzKTtcbiAgICB9XG5cbiAgICB0aGlzLl91cGRhdGVBbmNlc3RvcnMoey4uLm9wdHMsIHNraXBQcmlzdGluZUNoZWNrfSk7XG4gICAgdGhpcy5fb25EaXNhYmxlZENoYW5nZS5mb3JFYWNoKChjaGFuZ2VGbikgPT4gY2hhbmdlRm4odHJ1ZSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEVuYWJsZXMgdGhlIGNvbnRyb2wuIFRoaXMgbWVhbnMgdGhlIGNvbnRyb2wgaXMgaW5jbHVkZWQgaW4gdmFsaWRhdGlvbiBjaGVja3MgYW5kXG4gICAqIHRoZSBhZ2dyZWdhdGUgdmFsdWUgb2YgaXRzIHBhcmVudC4gSXRzIHN0YXR1cyByZWNhbGN1bGF0ZXMgYmFzZWQgb24gaXRzIHZhbHVlIGFuZFxuICAgKiBpdHMgdmFsaWRhdG9ycy5cbiAgICpcbiAgICogQnkgZGVmYXVsdCwgaWYgdGhlIGNvbnRyb2wgaGFzIGNoaWxkcmVuLCBhbGwgY2hpbGRyZW4gYXJlIGVuYWJsZWQuXG4gICAqXG4gICAqIEBzZWUge0BsaW5rIEFic3RyYWN0Q29udHJvbC5zdGF0dXN9XG4gICAqXG4gICAqIEBwYXJhbSBvcHRzIENvbmZpZ3VyZSBvcHRpb25zIHRoYXQgY29udHJvbCBob3cgdGhlIGNvbnRyb2wgcHJvcGFnYXRlcyBjaGFuZ2VzIGFuZFxuICAgKiBlbWl0cyBldmVudHMgd2hlbiBtYXJrZWQgYXMgdW50b3VjaGVkXG4gICAqICogYG9ubHlTZWxmYDogV2hlbiB0cnVlLCBtYXJrIG9ubHkgdGhpcyBjb250cm9sLiBXaGVuIGZhbHNlIG9yIG5vdCBzdXBwbGllZCxcbiAgICogbWFya3MgYWxsIGRpcmVjdCBhbmNlc3RvcnMuIERlZmF1bHQgaXMgZmFsc2UuXG4gICAqICogYGVtaXRFdmVudGA6IFdoZW4gdHJ1ZSBvciBub3Qgc3VwcGxpZWQgKHRoZSBkZWZhdWx0KSwgYm90aCB0aGUgYHN0YXR1c0NoYW5nZXNgIGFuZFxuICAgKiBgdmFsdWVDaGFuZ2VzYFxuICAgKiBvYnNlcnZhYmxlcyBlbWl0IGV2ZW50cyB3aXRoIHRoZSBsYXRlc3Qgc3RhdHVzIGFuZCB2YWx1ZSB3aGVuIHRoZSBjb250cm9sIGlzIGVuYWJsZWQuXG4gICAqIFdoZW4gZmFsc2UsIG5vIGV2ZW50cyBhcmUgZW1pdHRlZC5cbiAgICovXG4gIGVuYWJsZShvcHRzOiB7b25seVNlbGY/OiBib29sZWFuLCBlbWl0RXZlbnQ/OiBib29sZWFufSA9IHt9KTogdm9pZCB7XG4gICAgLy8gSWYgcGFyZW50IGhhcyBiZWVuIG1hcmtlZCBhcnRpZmljaWFsbHkgZGlydHkgd2UgZG9uJ3Qgd2FudCB0byByZS1jYWxjdWxhdGUgdGhlXG4gICAgLy8gcGFyZW50J3MgZGlydGluZXNzIGJhc2VkIG9uIHRoZSBjaGlsZHJlbi5cbiAgICBjb25zdCBza2lwUHJpc3RpbmVDaGVjayA9IHRoaXMuX3BhcmVudE1hcmtlZERpcnR5KG9wdHMub25seVNlbGYpO1xuXG4gICAgKHRoaXMgYXMge3N0YXR1czogRm9ybUNvbnRyb2xTdGF0dXN9KS5zdGF0dXMgPSBWQUxJRDtcbiAgICB0aGlzLl9mb3JFYWNoQ2hpbGQoKGNvbnRyb2w6IEFic3RyYWN0Q29udHJvbCkgPT4ge1xuICAgICAgY29udHJvbC5lbmFibGUoey4uLm9wdHMsIG9ubHlTZWxmOiB0cnVlfSk7XG4gICAgfSk7XG4gICAgdGhpcy51cGRhdGVWYWx1ZUFuZFZhbGlkaXR5KHtvbmx5U2VsZjogdHJ1ZSwgZW1pdEV2ZW50OiBvcHRzLmVtaXRFdmVudH0pO1xuXG4gICAgdGhpcy5fdXBkYXRlQW5jZXN0b3JzKHsuLi5vcHRzLCBza2lwUHJpc3RpbmVDaGVja30pO1xuICAgIHRoaXMuX29uRGlzYWJsZWRDaGFuZ2UuZm9yRWFjaCgoY2hhbmdlRm4pID0+IGNoYW5nZUZuKGZhbHNlKSk7XG4gIH1cblxuICBwcml2YXRlIF91cGRhdGVBbmNlc3RvcnMoXG4gICAgICBvcHRzOiB7b25seVNlbGY/OiBib29sZWFuLCBlbWl0RXZlbnQ/OiBib29sZWFuLCBza2lwUHJpc3RpbmVDaGVjaz86IGJvb2xlYW59KTogdm9pZCB7XG4gICAgaWYgKHRoaXMuX3BhcmVudCAmJiAhb3B0cy5vbmx5U2VsZikge1xuICAgICAgdGhpcy5fcGFyZW50LnVwZGF0ZVZhbHVlQW5kVmFsaWRpdHkob3B0cyk7XG4gICAgICBpZiAoIW9wdHMuc2tpcFByaXN0aW5lQ2hlY2spIHtcbiAgICAgICAgdGhpcy5fcGFyZW50Ll91cGRhdGVQcmlzdGluZSgpO1xuICAgICAgfVxuICAgICAgdGhpcy5fcGFyZW50Ll91cGRhdGVUb3VjaGVkKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIHBhcmVudCBvZiB0aGUgY29udHJvbFxuICAgKlxuICAgKiBAcGFyYW0gcGFyZW50IFRoZSBuZXcgcGFyZW50LlxuICAgKi9cbiAgc2V0UGFyZW50KHBhcmVudDogRm9ybUdyb3VwfEZvcm1BcnJheXxudWxsKTogdm9pZCB7XG4gICAgdGhpcy5fcGFyZW50ID0gcGFyZW50O1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIHZhbHVlIG9mIHRoZSBjb250cm9sLiBBYnN0cmFjdCBtZXRob2QgKGltcGxlbWVudGVkIGluIHN1Yi1jbGFzc2VzKS5cbiAgICovXG4gIGFic3RyYWN0IHNldFZhbHVlKHZhbHVlOiBUUmF3VmFsdWUsIG9wdGlvbnM/OiBPYmplY3QpOiB2b2lkO1xuXG4gIC8qKlxuICAgKiBQYXRjaGVzIHRoZSB2YWx1ZSBvZiB0aGUgY29udHJvbC4gQWJzdHJhY3QgbWV0aG9kIChpbXBsZW1lbnRlZCBpbiBzdWItY2xhc3NlcykuXG4gICAqL1xuICBhYnN0cmFjdCBwYXRjaFZhbHVlKHZhbHVlOiBUVmFsdWUsIG9wdGlvbnM/OiBPYmplY3QpOiB2b2lkO1xuXG4gIC8qKlxuICAgKiBSZXNldHMgdGhlIGNvbnRyb2wuIEFic3RyYWN0IG1ldGhvZCAoaW1wbGVtZW50ZWQgaW4gc3ViLWNsYXNzZXMpLlxuICAgKi9cbiAgYWJzdHJhY3QgcmVzZXQodmFsdWU/OiBUVmFsdWUsIG9wdGlvbnM/OiBPYmplY3QpOiB2b2lkO1xuXG4gIC8qKlxuICAgKiBUaGUgcmF3IHZhbHVlIG9mIHRoaXMgY29udHJvbC4gRm9yIG1vc3QgY29udHJvbCBpbXBsZW1lbnRhdGlvbnMsIHRoZSByYXcgdmFsdWUgd2lsbCBpbmNsdWRlXG4gICAqIGRpc2FibGVkIGNoaWxkcmVuLlxuICAgKi9cbiAgZ2V0UmF3VmFsdWUoKTogYW55IHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWNhbGN1bGF0ZXMgdGhlIHZhbHVlIGFuZCB2YWxpZGF0aW9uIHN0YXR1cyBvZiB0aGUgY29udHJvbC5cbiAgICpcbiAgICogQnkgZGVmYXVsdCwgaXQgYWxzbyB1cGRhdGVzIHRoZSB2YWx1ZSBhbmQgdmFsaWRpdHkgb2YgaXRzIGFuY2VzdG9ycy5cbiAgICpcbiAgICogQHBhcmFtIG9wdHMgQ29uZmlndXJhdGlvbiBvcHRpb25zIGRldGVybWluZSBob3cgdGhlIGNvbnRyb2wgcHJvcGFnYXRlcyBjaGFuZ2VzIGFuZCBlbWl0cyBldmVudHNcbiAgICogYWZ0ZXIgdXBkYXRlcyBhbmQgdmFsaWRpdHkgY2hlY2tzIGFyZSBhcHBsaWVkLlxuICAgKiAqIGBvbmx5U2VsZmA6IFdoZW4gdHJ1ZSwgb25seSB1cGRhdGUgdGhpcyBjb250cm9sLiBXaGVuIGZhbHNlIG9yIG5vdCBzdXBwbGllZCxcbiAgICogdXBkYXRlIGFsbCBkaXJlY3QgYW5jZXN0b3JzLiBEZWZhdWx0IGlzIGZhbHNlLlxuICAgKiAqIGBlbWl0RXZlbnRgOiBXaGVuIHRydWUgb3Igbm90IHN1cHBsaWVkICh0aGUgZGVmYXVsdCksIGJvdGggdGhlIGBzdGF0dXNDaGFuZ2VzYCBhbmRcbiAgICogYHZhbHVlQ2hhbmdlc2BcbiAgICogb2JzZXJ2YWJsZXMgZW1pdCBldmVudHMgd2l0aCB0aGUgbGF0ZXN0IHN0YXR1cyBhbmQgdmFsdWUgd2hlbiB0aGUgY29udHJvbCBpcyB1cGRhdGVkLlxuICAgKiBXaGVuIGZhbHNlLCBubyBldmVudHMgYXJlIGVtaXR0ZWQuXG4gICAqL1xuICB1cGRhdGVWYWx1ZUFuZFZhbGlkaXR5KG9wdHM6IHtvbmx5U2VsZj86IGJvb2xlYW4sIGVtaXRFdmVudD86IGJvb2xlYW59ID0ge30pOiB2b2lkIHtcbiAgICB0aGlzLl9zZXRJbml0aWFsU3RhdHVzKCk7XG4gICAgdGhpcy5fdXBkYXRlVmFsdWUoKTtcblxuICAgIGlmICh0aGlzLmVuYWJsZWQpIHtcbiAgICAgIHRoaXMuX2NhbmNlbEV4aXN0aW5nU3Vic2NyaXB0aW9uKCk7XG4gICAgICAodGhpcyBhcyB7ZXJyb3JzOiBWYWxpZGF0aW9uRXJyb3JzIHwgbnVsbH0pLmVycm9ycyA9IHRoaXMuX3J1blZhbGlkYXRvcigpO1xuICAgICAgKHRoaXMgYXMge3N0YXR1czogRm9ybUNvbnRyb2xTdGF0dXN9KS5zdGF0dXMgPSB0aGlzLl9jYWxjdWxhdGVTdGF0dXMoKTtcblxuICAgICAgaWYgKHRoaXMuc3RhdHVzID09PSBWQUxJRCB8fCB0aGlzLnN0YXR1cyA9PT0gUEVORElORykge1xuICAgICAgICB0aGlzLl9ydW5Bc3luY1ZhbGlkYXRvcihvcHRzLmVtaXRFdmVudCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG9wdHMuZW1pdEV2ZW50ICE9PSBmYWxzZSkge1xuICAgICAgKHRoaXMudmFsdWVDaGFuZ2VzIGFzIEV2ZW50RW1pdHRlcjxUVmFsdWU+KS5lbWl0KHRoaXMudmFsdWUpO1xuICAgICAgKHRoaXMuc3RhdHVzQ2hhbmdlcyBhcyBFdmVudEVtaXR0ZXI8Rm9ybUNvbnRyb2xTdGF0dXM+KS5lbWl0KHRoaXMuc3RhdHVzKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fcGFyZW50ICYmICFvcHRzLm9ubHlTZWxmKSB7XG4gICAgICB0aGlzLl9wYXJlbnQudXBkYXRlVmFsdWVBbmRWYWxpZGl0eShvcHRzKTtcbiAgICB9XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF91cGRhdGVUcmVlVmFsaWRpdHkob3B0czoge2VtaXRFdmVudD86IGJvb2xlYW59ID0ge2VtaXRFdmVudDogdHJ1ZX0pOiB2b2lkIHtcbiAgICB0aGlzLl9mb3JFYWNoQ2hpbGQoKGN0cmw6IEFic3RyYWN0Q29udHJvbCkgPT4gY3RybC5fdXBkYXRlVHJlZVZhbGlkaXR5KG9wdHMpKTtcbiAgICB0aGlzLnVwZGF0ZVZhbHVlQW5kVmFsaWRpdHkoe29ubHlTZWxmOiB0cnVlLCBlbWl0RXZlbnQ6IG9wdHMuZW1pdEV2ZW50fSk7XG4gIH1cblxuICBwcml2YXRlIF9zZXRJbml0aWFsU3RhdHVzKCkge1xuICAgICh0aGlzIGFzIHtzdGF0dXM6IEZvcm1Db250cm9sU3RhdHVzfSkuc3RhdHVzID0gdGhpcy5fYWxsQ29udHJvbHNEaXNhYmxlZCgpID8gRElTQUJMRUQgOiBWQUxJRDtcbiAgfVxuXG4gIHByaXZhdGUgX3J1blZhbGlkYXRvcigpOiBWYWxpZGF0aW9uRXJyb3JzfG51bGwge1xuICAgIHJldHVybiB0aGlzLnZhbGlkYXRvciA/IHRoaXMudmFsaWRhdG9yKHRoaXMpIDogbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgX3J1bkFzeW5jVmFsaWRhdG9yKGVtaXRFdmVudD86IGJvb2xlYW4pOiB2b2lkIHtcbiAgICBpZiAodGhpcy5hc3luY1ZhbGlkYXRvcikge1xuICAgICAgKHRoaXMgYXMge3N0YXR1czogRm9ybUNvbnRyb2xTdGF0dXN9KS5zdGF0dXMgPSBQRU5ESU5HO1xuICAgICAgdGhpcy5faGFzT3duUGVuZGluZ0FzeW5jVmFsaWRhdG9yID0gdHJ1ZTtcbiAgICAgIGNvbnN0IG9icyA9IHRvT2JzZXJ2YWJsZSh0aGlzLmFzeW5jVmFsaWRhdG9yKHRoaXMpKTtcbiAgICAgIHRoaXMuX2FzeW5jVmFsaWRhdGlvblN1YnNjcmlwdGlvbiA9IG9icy5zdWJzY3JpYmUoKGVycm9yczogVmFsaWRhdGlvbkVycm9yc3xudWxsKSA9PiB7XG4gICAgICAgIHRoaXMuX2hhc093blBlbmRpbmdBc3luY1ZhbGlkYXRvciA9IGZhbHNlO1xuICAgICAgICAvLyBUaGlzIHdpbGwgdHJpZ2dlciB0aGUgcmVjYWxjdWxhdGlvbiBvZiB0aGUgdmFsaWRhdGlvbiBzdGF0dXMsIHdoaWNoIGRlcGVuZHMgb25cbiAgICAgICAgLy8gdGhlIHN0YXRlIG9mIHRoZSBhc3luY2hyb25vdXMgdmFsaWRhdGlvbiAod2hldGhlciBpdCBpcyBpbiBwcm9ncmVzcyBvciBub3QpLiBTbywgaXQgaXNcbiAgICAgICAgLy8gbmVjZXNzYXJ5IHRoYXQgd2UgaGF2ZSB1cGRhdGVkIHRoZSBgX2hhc093blBlbmRpbmdBc3luY1ZhbGlkYXRvcmAgYm9vbGVhbiBmbGFnIGZpcnN0LlxuICAgICAgICB0aGlzLnNldEVycm9ycyhlcnJvcnMsIHtlbWl0RXZlbnR9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NhbmNlbEV4aXN0aW5nU3Vic2NyaXB0aW9uKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLl9hc3luY1ZhbGlkYXRpb25TdWJzY3JpcHRpb24pIHtcbiAgICAgIHRoaXMuX2FzeW5jVmFsaWRhdGlvblN1YnNjcmlwdGlvbi51bnN1YnNjcmliZSgpO1xuICAgICAgdGhpcy5faGFzT3duUGVuZGluZ0FzeW5jVmFsaWRhdG9yID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgZXJyb3JzIG9uIGEgZm9ybSBjb250cm9sIHdoZW4gcnVubmluZyB2YWxpZGF0aW9ucyBtYW51YWxseSwgcmF0aGVyIHRoYW4gYXV0b21hdGljYWxseS5cbiAgICpcbiAgICogQ2FsbGluZyBgc2V0RXJyb3JzYCBhbHNvIHVwZGF0ZXMgdGhlIHZhbGlkaXR5IG9mIHRoZSBwYXJlbnQgY29udHJvbC5cbiAgICpcbiAgICogQHVzYWdlTm90ZXNcbiAgICpcbiAgICogIyMjIE1hbnVhbGx5IHNldCB0aGUgZXJyb3JzIGZvciBhIGNvbnRyb2xcbiAgICpcbiAgICogYGBgXG4gICAqIGNvbnN0IGxvZ2luID0gbmV3IEZvcm1Db250cm9sKCdzb21lTG9naW4nKTtcbiAgICogbG9naW4uc2V0RXJyb3JzKHtcbiAgICogICBub3RVbmlxdWU6IHRydWVcbiAgICogfSk7XG4gICAqXG4gICAqIGV4cGVjdChsb2dpbi52YWxpZCkudG9FcXVhbChmYWxzZSk7XG4gICAqIGV4cGVjdChsb2dpbi5lcnJvcnMpLnRvRXF1YWwoeyBub3RVbmlxdWU6IHRydWUgfSk7XG4gICAqXG4gICAqIGxvZ2luLnNldFZhbHVlKCdzb21lT3RoZXJMb2dpbicpO1xuICAgKlxuICAgKiBleHBlY3QobG9naW4udmFsaWQpLnRvRXF1YWwodHJ1ZSk7XG4gICAqIGBgYFxuICAgKi9cbiAgc2V0RXJyb3JzKGVycm9yczogVmFsaWRhdGlvbkVycm9yc3xudWxsLCBvcHRzOiB7ZW1pdEV2ZW50PzogYm9vbGVhbn0gPSB7fSk6IHZvaWQge1xuICAgICh0aGlzIGFzIHtlcnJvcnM6IFZhbGlkYXRpb25FcnJvcnMgfCBudWxsfSkuZXJyb3JzID0gZXJyb3JzO1xuICAgIHRoaXMuX3VwZGF0ZUNvbnRyb2xzRXJyb3JzKG9wdHMuZW1pdEV2ZW50ICE9PSBmYWxzZSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmVzIGEgY2hpbGQgY29udHJvbCBnaXZlbiB0aGUgY29udHJvbCdzIG5hbWUgb3IgcGF0aC5cbiAgICpcbiAgICogVGhpcyBzaWduYXR1cmUgZm9yIGdldCBzdXBwb3J0cyBzdHJpbmdzIGFuZCBgY29uc3RgIGFycmF5cyAoYC5nZXQoWydmb28nLCAnYmFyJ10gYXMgY29uc3QpYCkuXG4gICAqL1xuICBnZXQ8UCBleHRlbmRzIHN0cmluZ3wocmVhZG9ubHkoc3RyaW5nfG51bWJlcilbXSk+KHBhdGg6IFApOlxuICAgICAgQWJzdHJhY3RDb250cm9sPMm1R2V0UHJvcGVydHk8VFJhd1ZhbHVlLCBQPj58bnVsbDtcblxuICAvKipcbiAgICogUmV0cmlldmVzIGEgY2hpbGQgY29udHJvbCBnaXZlbiB0aGUgY29udHJvbCdzIG5hbWUgb3IgcGF0aC5cbiAgICpcbiAgICogVGhpcyBzaWduYXR1cmUgZm9yIGBnZXRgIHN1cHBvcnRzIG5vbi1jb25zdCAobXV0YWJsZSkgYXJyYXlzLiBJbmZlcnJlZCB0eXBlXG4gICAqIGluZm9ybWF0aW9uIHdpbGwgbm90IGJlIGFzIHJvYnVzdCwgc28gcHJlZmVyIHRvIHBhc3MgYSBgcmVhZG9ubHlgIGFycmF5IGlmIHBvc3NpYmxlLlxuICAgKi9cbiAgZ2V0PFAgZXh0ZW5kcyBzdHJpbmd8QXJyYXk8c3RyaW5nfG51bWJlcj4+KHBhdGg6IFApOlxuICAgICAgQWJzdHJhY3RDb250cm9sPMm1R2V0UHJvcGVydHk8VFJhd1ZhbHVlLCBQPj58bnVsbDtcblxuICAvKipcbiAgICogUmV0cmlldmVzIGEgY2hpbGQgY29udHJvbCBnaXZlbiB0aGUgY29udHJvbCdzIG5hbWUgb3IgcGF0aC5cbiAgICpcbiAgICogQHBhcmFtIHBhdGggQSBkb3QtZGVsaW1pdGVkIHN0cmluZyBvciBhcnJheSBvZiBzdHJpbmcvbnVtYmVyIHZhbHVlcyB0aGF0IGRlZmluZSB0aGUgcGF0aCB0byB0aGVcbiAgICogY29udHJvbC4gSWYgYSBzdHJpbmcgaXMgcHJvdmlkZWQsIHBhc3NpbmcgaXQgYXMgYSBzdHJpbmcgbGl0ZXJhbCB3aWxsIHJlc3VsdCBpbiBpbXByb3ZlZCB0eXBlXG4gICAqIGluZm9ybWF0aW9uLiBMaWtld2lzZSwgaWYgYW4gYXJyYXkgaXMgcHJvdmlkZWQsIHBhc3NpbmcgaXQgYGFzIGNvbnN0YCB3aWxsIGNhdXNlIGltcHJvdmVkIHR5cGVcbiAgICogaW5mb3JtYXRpb24gdG8gYmUgYXZhaWxhYmxlLlxuICAgKlxuICAgKiBAdXNhZ2VOb3Rlc1xuICAgKiAjIyMgUmV0cmlldmUgYSBuZXN0ZWQgY29udHJvbFxuICAgKlxuICAgKiBGb3IgZXhhbXBsZSwgdG8gZ2V0IGEgYG5hbWVgIGNvbnRyb2wgbmVzdGVkIHdpdGhpbiBhIGBwZXJzb25gIHN1Yi1ncm91cDpcbiAgICpcbiAgICogKiBgdGhpcy5mb3JtLmdldCgncGVyc29uLm5hbWUnKTtgXG4gICAqXG4gICAqIC1PUi1cbiAgICpcbiAgICogKiBgdGhpcy5mb3JtLmdldChbJ3BlcnNvbicsICduYW1lJ10gYXMgY29uc3QpO2AgLy8gYGFzIGNvbnN0YCBnaXZlcyBpbXByb3ZlZCB0eXBpbmdzXG4gICAqXG4gICAqICMjIyBSZXRyaWV2ZSBhIGNvbnRyb2wgaW4gYSBGb3JtQXJyYXlcbiAgICpcbiAgICogV2hlbiBhY2Nlc3NpbmcgYW4gZWxlbWVudCBpbnNpZGUgYSBGb3JtQXJyYXksIHlvdSBjYW4gdXNlIGFuIGVsZW1lbnQgaW5kZXguXG4gICAqIEZvciBleGFtcGxlLCB0byBnZXQgYSBgcHJpY2VgIGNvbnRyb2wgZnJvbSB0aGUgZmlyc3QgZWxlbWVudCBpbiBhbiBgaXRlbXNgIGFycmF5IHlvdSBjYW4gdXNlOlxuICAgKlxuICAgKiAqIGB0aGlzLmZvcm0uZ2V0KCdpdGVtcy4wLnByaWNlJyk7YFxuICAgKlxuICAgKiAtT1ItXG4gICAqXG4gICAqICogYHRoaXMuZm9ybS5nZXQoWydpdGVtcycsIDAsICdwcmljZSddKTtgXG4gICAqL1xuICBnZXQ8UCBleHRlbmRzIHN0cmluZ3woKHN0cmluZyB8IG51bWJlcilbXSk+KHBhdGg6IFApOlxuICAgICAgQWJzdHJhY3RDb250cm9sPMm1R2V0UHJvcGVydHk8VFJhd1ZhbHVlLCBQPj58bnVsbCB7XG4gICAgbGV0IGN1cnJQYXRoOiBBcnJheTxzdHJpbmd8bnVtYmVyPnxzdHJpbmcgPSBwYXRoO1xuICAgIGlmIChjdXJyUGF0aCA9PSBudWxsKSByZXR1cm4gbnVsbDtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoY3VyclBhdGgpKSBjdXJyUGF0aCA9IGN1cnJQYXRoLnNwbGl0KCcuJyk7XG4gICAgaWYgKGN1cnJQYXRoLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGw7XG4gICAgcmV0dXJuIGN1cnJQYXRoLnJlZHVjZShcbiAgICAgICAgKGNvbnRyb2w6IEFic3RyYWN0Q29udHJvbHxudWxsLCBuYW1lKSA9PiBjb250cm9sICYmIGNvbnRyb2wuX2ZpbmQobmFtZSksIHRoaXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBkZXNjcmlwdGlvblxuICAgKiBSZXBvcnRzIGVycm9yIGRhdGEgZm9yIHRoZSBjb250cm9sIHdpdGggdGhlIGdpdmVuIHBhdGguXG4gICAqXG4gICAqIEBwYXJhbSBlcnJvckNvZGUgVGhlIGNvZGUgb2YgdGhlIGVycm9yIHRvIGNoZWNrXG4gICAqIEBwYXJhbSBwYXRoIEEgbGlzdCBvZiBjb250cm9sIG5hbWVzIHRoYXQgZGVzaWduYXRlcyBob3cgdG8gbW92ZSBmcm9tIHRoZSBjdXJyZW50IGNvbnRyb2xcbiAgICogdG8gdGhlIGNvbnRyb2wgdGhhdCBzaG91bGQgYmUgcXVlcmllZCBmb3IgZXJyb3JzLlxuICAgKlxuICAgKiBAdXNhZ2VOb3Rlc1xuICAgKiBGb3IgZXhhbXBsZSwgZm9yIHRoZSBmb2xsb3dpbmcgYEZvcm1Hcm91cGA6XG4gICAqXG4gICAqIGBgYFxuICAgKiBmb3JtID0gbmV3IEZvcm1Hcm91cCh7XG4gICAqICAgYWRkcmVzczogbmV3IEZvcm1Hcm91cCh7IHN0cmVldDogbmV3IEZvcm1Db250cm9sKCkgfSlcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBUaGUgcGF0aCB0byB0aGUgJ3N0cmVldCcgY29udHJvbCBmcm9tIHRoZSByb290IGZvcm0gd291bGQgYmUgJ2FkZHJlc3MnIC0+ICdzdHJlZXQnLlxuICAgKlxuICAgKiBJdCBjYW4gYmUgcHJvdmlkZWQgdG8gdGhpcyBtZXRob2QgaW4gb25lIG9mIHR3byBmb3JtYXRzOlxuICAgKlxuICAgKiAxLiBBbiBhcnJheSBvZiBzdHJpbmcgY29udHJvbCBuYW1lcywgZS5nLiBgWydhZGRyZXNzJywgJ3N0cmVldCddYFxuICAgKiAxLiBBIHBlcmlvZC1kZWxpbWl0ZWQgbGlzdCBvZiBjb250cm9sIG5hbWVzIGluIG9uZSBzdHJpbmcsIGUuZy4gYCdhZGRyZXNzLnN0cmVldCdgXG4gICAqXG4gICAqIEByZXR1cm5zIGVycm9yIGRhdGEgZm9yIHRoYXQgcGFydGljdWxhciBlcnJvci4gSWYgdGhlIGNvbnRyb2wgb3IgZXJyb3IgaXMgbm90IHByZXNlbnQsXG4gICAqIG51bGwgaXMgcmV0dXJuZWQuXG4gICAqL1xuICBnZXRFcnJvcihlcnJvckNvZGU6IHN0cmluZywgcGF0aD86IEFycmF5PHN0cmluZ3xudW1iZXI+fHN0cmluZyk6IGFueSB7XG4gICAgY29uc3QgY29udHJvbCA9IHBhdGggPyB0aGlzLmdldChwYXRoKSA6IHRoaXM7XG4gICAgcmV0dXJuIGNvbnRyb2wgJiYgY29udHJvbC5lcnJvcnMgPyBjb250cm9sLmVycm9yc1tlcnJvckNvZGVdIDogbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBAZGVzY3JpcHRpb25cbiAgICogUmVwb3J0cyB3aGV0aGVyIHRoZSBjb250cm9sIHdpdGggdGhlIGdpdmVuIHBhdGggaGFzIHRoZSBlcnJvciBzcGVjaWZpZWQuXG4gICAqXG4gICAqIEBwYXJhbSBlcnJvckNvZGUgVGhlIGNvZGUgb2YgdGhlIGVycm9yIHRvIGNoZWNrXG4gICAqIEBwYXJhbSBwYXRoIEEgbGlzdCBvZiBjb250cm9sIG5hbWVzIHRoYXQgZGVzaWduYXRlcyBob3cgdG8gbW92ZSBmcm9tIHRoZSBjdXJyZW50IGNvbnRyb2xcbiAgICogdG8gdGhlIGNvbnRyb2wgdGhhdCBzaG91bGQgYmUgcXVlcmllZCBmb3IgZXJyb3JzLlxuICAgKlxuICAgKiBAdXNhZ2VOb3Rlc1xuICAgKiBGb3IgZXhhbXBsZSwgZm9yIHRoZSBmb2xsb3dpbmcgYEZvcm1Hcm91cGA6XG4gICAqXG4gICAqIGBgYFxuICAgKiBmb3JtID0gbmV3IEZvcm1Hcm91cCh7XG4gICAqICAgYWRkcmVzczogbmV3IEZvcm1Hcm91cCh7IHN0cmVldDogbmV3IEZvcm1Db250cm9sKCkgfSlcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBUaGUgcGF0aCB0byB0aGUgJ3N0cmVldCcgY29udHJvbCBmcm9tIHRoZSByb290IGZvcm0gd291bGQgYmUgJ2FkZHJlc3MnIC0+ICdzdHJlZXQnLlxuICAgKlxuICAgKiBJdCBjYW4gYmUgcHJvdmlkZWQgdG8gdGhpcyBtZXRob2QgaW4gb25lIG9mIHR3byBmb3JtYXRzOlxuICAgKlxuICAgKiAxLiBBbiBhcnJheSBvZiBzdHJpbmcgY29udHJvbCBuYW1lcywgZS5nLiBgWydhZGRyZXNzJywgJ3N0cmVldCddYFxuICAgKiAxLiBBIHBlcmlvZC1kZWxpbWl0ZWQgbGlzdCBvZiBjb250cm9sIG5hbWVzIGluIG9uZSBzdHJpbmcsIGUuZy4gYCdhZGRyZXNzLnN0cmVldCdgXG4gICAqXG4gICAqIElmIG5vIHBhdGggaXMgZ2l2ZW4sIHRoaXMgbWV0aG9kIGNoZWNrcyBmb3IgdGhlIGVycm9yIG9uIHRoZSBjdXJyZW50IGNvbnRyb2wuXG4gICAqXG4gICAqIEByZXR1cm5zIHdoZXRoZXIgdGhlIGdpdmVuIGVycm9yIGlzIHByZXNlbnQgaW4gdGhlIGNvbnRyb2wgYXQgdGhlIGdpdmVuIHBhdGguXG4gICAqXG4gICAqIElmIHRoZSBjb250cm9sIGlzIG5vdCBwcmVzZW50LCBmYWxzZSBpcyByZXR1cm5lZC5cbiAgICovXG4gIGhhc0Vycm9yKGVycm9yQ29kZTogc3RyaW5nLCBwYXRoPzogQXJyYXk8c3RyaW5nfG51bWJlcj58c3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuICEhdGhpcy5nZXRFcnJvcihlcnJvckNvZGUsIHBhdGgpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlcyB0aGUgdG9wLWxldmVsIGFuY2VzdG9yIG9mIHRoaXMgY29udHJvbC5cbiAgICovXG4gIGdldCByb290KCk6IEFic3RyYWN0Q29udHJvbCB7XG4gICAgbGV0IHg6IEFic3RyYWN0Q29udHJvbCA9IHRoaXM7XG5cbiAgICB3aGlsZSAoeC5fcGFyZW50KSB7XG4gICAgICB4ID0geC5fcGFyZW50O1xuICAgIH1cblxuICAgIHJldHVybiB4O1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfdXBkYXRlQ29udHJvbHNFcnJvcnMoZW1pdEV2ZW50OiBib29sZWFuKTogdm9pZCB7XG4gICAgKHRoaXMgYXMge3N0YXR1czogRm9ybUNvbnRyb2xTdGF0dXN9KS5zdGF0dXMgPSB0aGlzLl9jYWxjdWxhdGVTdGF0dXMoKTtcblxuICAgIGlmIChlbWl0RXZlbnQpIHtcbiAgICAgICh0aGlzLnN0YXR1c0NoYW5nZXMgYXMgRXZlbnRFbWl0dGVyPEZvcm1Db250cm9sU3RhdHVzPikuZW1pdCh0aGlzLnN0YXR1cyk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX3BhcmVudCkge1xuICAgICAgdGhpcy5fcGFyZW50Ll91cGRhdGVDb250cm9sc0Vycm9ycyhlbWl0RXZlbnQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX2luaXRPYnNlcnZhYmxlcygpIHtcbiAgICAodGhpcyBhcyB7dmFsdWVDaGFuZ2VzOiBPYnNlcnZhYmxlPFRWYWx1ZT59KS52YWx1ZUNoYW5nZXMgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XG4gICAgKHRoaXMgYXMge3N0YXR1c0NoYW5nZXM6IE9ic2VydmFibGU8Rm9ybUNvbnRyb2xTdGF0dXM+fSkuc3RhdHVzQ2hhbmdlcyA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcbiAgfVxuXG5cbiAgcHJpdmF0ZSBfY2FsY3VsYXRlU3RhdHVzKCk6IEZvcm1Db250cm9sU3RhdHVzIHtcbiAgICBpZiAodGhpcy5fYWxsQ29udHJvbHNEaXNhYmxlZCgpKSByZXR1cm4gRElTQUJMRUQ7XG4gICAgaWYgKHRoaXMuZXJyb3JzKSByZXR1cm4gSU5WQUxJRDtcbiAgICBpZiAodGhpcy5faGFzT3duUGVuZGluZ0FzeW5jVmFsaWRhdG9yIHx8IHRoaXMuX2FueUNvbnRyb2xzSGF2ZVN0YXR1cyhQRU5ESU5HKSkgcmV0dXJuIFBFTkRJTkc7XG4gICAgaWYgKHRoaXMuX2FueUNvbnRyb2xzSGF2ZVN0YXR1cyhJTlZBTElEKSkgcmV0dXJuIElOVkFMSUQ7XG4gICAgcmV0dXJuIFZBTElEO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBhYnN0cmFjdCBfdXBkYXRlVmFsdWUoKTogdm9pZDtcblxuICAvKiogQGludGVybmFsICovXG4gIGFic3RyYWN0IF9mb3JFYWNoQ2hpbGQoY2I6IChjOiBBYnN0cmFjdENvbnRyb2wpID0+IHZvaWQpOiB2b2lkO1xuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgYWJzdHJhY3QgX2FueUNvbnRyb2xzKGNvbmRpdGlvbjogKGM6IEFic3RyYWN0Q29udHJvbCkgPT4gYm9vbGVhbik6IGJvb2xlYW47XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBhYnN0cmFjdCBfYWxsQ29udHJvbHNEaXNhYmxlZCgpOiBib29sZWFuO1xuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgYWJzdHJhY3QgX3N5bmNQZW5kaW5nQ29udHJvbHMoKTogYm9vbGVhbjtcblxuICAvKiogQGludGVybmFsICovXG4gIF9hbnlDb250cm9sc0hhdmVTdGF0dXMoc3RhdHVzOiBGb3JtQ29udHJvbFN0YXR1cyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLl9hbnlDb250cm9scygoY29udHJvbDogQWJzdHJhY3RDb250cm9sKSA9PiBjb250cm9sLnN0YXR1cyA9PT0gc3RhdHVzKTtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX2FueUNvbnRyb2xzRGlydHkoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuX2FueUNvbnRyb2xzKChjb250cm9sOiBBYnN0cmFjdENvbnRyb2wpID0+IGNvbnRyb2wuZGlydHkpO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfYW55Q29udHJvbHNUb3VjaGVkKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLl9hbnlDb250cm9scygoY29udHJvbDogQWJzdHJhY3RDb250cm9sKSA9PiBjb250cm9sLnRvdWNoZWQpO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfdXBkYXRlUHJpc3RpbmUob3B0czoge29ubHlTZWxmPzogYm9vbGVhbn0gPSB7fSk6IHZvaWQge1xuICAgICh0aGlzIGFzIHtwcmlzdGluZTogYm9vbGVhbn0pLnByaXN0aW5lID0gIXRoaXMuX2FueUNvbnRyb2xzRGlydHkoKTtcblxuICAgIGlmICh0aGlzLl9wYXJlbnQgJiYgIW9wdHMub25seVNlbGYpIHtcbiAgICAgIHRoaXMuX3BhcmVudC5fdXBkYXRlUHJpc3RpbmUob3B0cyk7XG4gICAgfVxuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfdXBkYXRlVG91Y2hlZChvcHRzOiB7b25seVNlbGY/OiBib29sZWFufSA9IHt9KTogdm9pZCB7XG4gICAgKHRoaXMgYXMge3RvdWNoZWQ6IGJvb2xlYW59KS50b3VjaGVkID0gdGhpcy5fYW55Q29udHJvbHNUb3VjaGVkKCk7XG5cbiAgICBpZiAodGhpcy5fcGFyZW50ICYmICFvcHRzLm9ubHlTZWxmKSB7XG4gICAgICB0aGlzLl9wYXJlbnQuX3VwZGF0ZVRvdWNoZWQob3B0cyk7XG4gICAgfVxuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfb25EaXNhYmxlZENoYW5nZTogQXJyYXk8KGlzRGlzYWJsZWQ6IGJvb2xlYW4pID0+IHZvaWQ+ID0gW107XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfcmVnaXN0ZXJPbkNvbGxlY3Rpb25DaGFuZ2UoZm46ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl9vbkNvbGxlY3Rpb25DaGFuZ2UgPSBmbjtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX3NldFVwZGF0ZVN0cmF0ZWd5KG9wdHM/OiBWYWxpZGF0b3JGbnxWYWxpZGF0b3JGbltdfEFic3RyYWN0Q29udHJvbE9wdGlvbnN8bnVsbCk6IHZvaWQge1xuICAgIGlmIChpc09wdGlvbnNPYmoob3B0cykgJiYgb3B0cy51cGRhdGVPbiAhPSBudWxsKSB7XG4gICAgICB0aGlzLl91cGRhdGVPbiA9IG9wdHMudXBkYXRlT24hO1xuICAgIH1cbiAgfVxuICAvKipcbiAgICogQ2hlY2sgdG8gc2VlIGlmIHBhcmVudCBoYXMgYmVlbiBtYXJrZWQgYXJ0aWZpY2lhbGx5IGRpcnR5LlxuICAgKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIHByaXZhdGUgX3BhcmVudE1hcmtlZERpcnR5KG9ubHlTZWxmPzogYm9vbGVhbik6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHBhcmVudERpcnR5ID0gdGhpcy5fcGFyZW50ICYmIHRoaXMuX3BhcmVudC5kaXJ0eTtcbiAgICByZXR1cm4gIW9ubHlTZWxmICYmICEhcGFyZW50RGlydHkgJiYgIXRoaXMuX3BhcmVudCEuX2FueUNvbnRyb2xzRGlydHkoKTtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX2ZpbmQobmFtZTogc3RyaW5nfG51bWJlcik6IEFic3RyYWN0Q29udHJvbHxudWxsIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuIl19
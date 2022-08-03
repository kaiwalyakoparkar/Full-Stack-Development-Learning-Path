/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ɵRuntimeError as RuntimeError } from '@angular/core';
import { getControlAsyncValidators, getControlValidators, mergeValidators } from '../validators';
import { BuiltInControlValueAccessor } from './control_value_accessor';
import { DefaultValueAccessor } from './default_value_accessor';
import { ngModelWarning } from './reactive_errors';
export function controlPath(name, parent) {
    return [...parent.path, name];
}
/**
 * Links a Form control and a Form directive by setting up callbacks (such as `onChange`) on both
 * instances. This function is typically invoked when form directive is being initialized.
 *
 * @param control Form control instance that should be linked.
 * @param dir Directive that should be linked with a given control.
 */
export function setUpControl(control, dir) {
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
        if (!control)
            _throwError(dir, 'Cannot find control with');
        if (!dir.valueAccessor)
            _throwError(dir, 'No value accessor for form control with');
    }
    setUpValidators(control, dir);
    dir.valueAccessor.writeValue(control.value);
    if (control.disabled) {
        dir.valueAccessor.setDisabledState?.(true);
    }
    setUpViewChangePipeline(control, dir);
    setUpModelChangePipeline(control, dir);
    setUpBlurPipeline(control, dir);
    setUpDisabledChangeHandler(control, dir);
}
/**
 * Reverts configuration performed by the `setUpControl` control function.
 * Effectively disconnects form control with a given form directive.
 * This function is typically invoked when corresponding form directive is being destroyed.
 *
 * @param control Form control which should be cleaned up.
 * @param dir Directive that should be disconnected from a given control.
 * @param validateControlPresenceOnChange Flag that indicates whether onChange handler should
 *     contain asserts to verify that it's not called once directive is destroyed. We need this flag
 *     to avoid potentially breaking changes caused by better control cleanup introduced in #39235.
 */
export function cleanUpControl(control, dir, validateControlPresenceOnChange = true) {
    const noop = () => {
        if (validateControlPresenceOnChange && (typeof ngDevMode === 'undefined' || ngDevMode)) {
            _noControlError(dir);
        }
    };
    // The `valueAccessor` field is typically defined on FromControl and FormControlName directive
    // instances and there is a logic in `selectValueAccessor` function that throws if it's not the
    // case. We still check the presence of `valueAccessor` before invoking its methods to make sure
    // that cleanup works correctly if app code or tests are setup to ignore the error thrown from
    // `selectValueAccessor`. See https://github.com/angular/angular/issues/40521.
    if (dir.valueAccessor) {
        dir.valueAccessor.registerOnChange(noop);
        dir.valueAccessor.registerOnTouched(noop);
    }
    cleanUpValidators(control, dir);
    if (control) {
        dir._invokeOnDestroyCallbacks();
        control._registerOnCollectionChange(() => { });
    }
}
function registerOnValidatorChange(validators, onChange) {
    validators.forEach((validator) => {
        if (validator.registerOnValidatorChange)
            validator.registerOnValidatorChange(onChange);
    });
}
/**
 * Sets up disabled change handler function on a given form control if ControlValueAccessor
 * associated with a given directive instance supports the `setDisabledState` call.
 *
 * @param control Form control where disabled change handler should be setup.
 * @param dir Corresponding directive instance associated with this control.
 */
export function setUpDisabledChangeHandler(control, dir) {
    if (dir.valueAccessor.setDisabledState) {
        const onDisabledChange = (isDisabled) => {
            dir.valueAccessor.setDisabledState(isDisabled);
        };
        control.registerOnDisabledChange(onDisabledChange);
        // Register a callback function to cleanup disabled change handler
        // from a control instance when a directive is destroyed.
        dir._registerOnDestroy(() => {
            control._unregisterOnDisabledChange(onDisabledChange);
        });
    }
}
/**
 * Sets up sync and async directive validators on provided form control.
 * This function merges validators from the directive into the validators of the control.
 *
 * @param control Form control where directive validators should be setup.
 * @param dir Directive instance that contains validators to be setup.
 */
export function setUpValidators(control, dir) {
    const validators = getControlValidators(control);
    if (dir.validator !== null) {
        control.setValidators(mergeValidators(validators, dir.validator));
    }
    else if (typeof validators === 'function') {
        // If sync validators are represented by a single validator function, we force the
        // `Validators.compose` call to happen by executing the `setValidators` function with
        // an array that contains that function. We need this to avoid possible discrepancies in
        // validators behavior, so sync validators are always processed by the `Validators.compose`.
        // Note: we should consider moving this logic inside the `setValidators` function itself, so we
        // have consistent behavior on AbstractControl API level. The same applies to the async
        // validators logic below.
        control.setValidators([validators]);
    }
    const asyncValidators = getControlAsyncValidators(control);
    if (dir.asyncValidator !== null) {
        control.setAsyncValidators(mergeValidators(asyncValidators, dir.asyncValidator));
    }
    else if (typeof asyncValidators === 'function') {
        control.setAsyncValidators([asyncValidators]);
    }
    // Re-run validation when validator binding changes, e.g. minlength=3 -> minlength=4
    const onValidatorChange = () => control.updateValueAndValidity();
    registerOnValidatorChange(dir._rawValidators, onValidatorChange);
    registerOnValidatorChange(dir._rawAsyncValidators, onValidatorChange);
}
/**
 * Cleans up sync and async directive validators on provided form control.
 * This function reverts the setup performed by the `setUpValidators` function, i.e.
 * removes directive-specific validators from a given control instance.
 *
 * @param control Form control from where directive validators should be removed.
 * @param dir Directive instance that contains validators to be removed.
 * @returns true if a control was updated as a result of this action.
 */
export function cleanUpValidators(control, dir) {
    let isControlUpdated = false;
    if (control !== null) {
        if (dir.validator !== null) {
            const validators = getControlValidators(control);
            if (Array.isArray(validators) && validators.length > 0) {
                // Filter out directive validator function.
                const updatedValidators = validators.filter((validator) => validator !== dir.validator);
                if (updatedValidators.length !== validators.length) {
                    isControlUpdated = true;
                    control.setValidators(updatedValidators);
                }
            }
        }
        if (dir.asyncValidator !== null) {
            const asyncValidators = getControlAsyncValidators(control);
            if (Array.isArray(asyncValidators) && asyncValidators.length > 0) {
                // Filter out directive async validator function.
                const updatedAsyncValidators = asyncValidators.filter((asyncValidator) => asyncValidator !== dir.asyncValidator);
                if (updatedAsyncValidators.length !== asyncValidators.length) {
                    isControlUpdated = true;
                    control.setAsyncValidators(updatedAsyncValidators);
                }
            }
        }
    }
    // Clear onValidatorChange callbacks by providing a noop function.
    const noop = () => { };
    registerOnValidatorChange(dir._rawValidators, noop);
    registerOnValidatorChange(dir._rawAsyncValidators, noop);
    return isControlUpdated;
}
function setUpViewChangePipeline(control, dir) {
    dir.valueAccessor.registerOnChange((newValue) => {
        control._pendingValue = newValue;
        control._pendingChange = true;
        control._pendingDirty = true;
        if (control.updateOn === 'change')
            updateControl(control, dir);
    });
}
function setUpBlurPipeline(control, dir) {
    dir.valueAccessor.registerOnTouched(() => {
        control._pendingTouched = true;
        if (control.updateOn === 'blur' && control._pendingChange)
            updateControl(control, dir);
        if (control.updateOn !== 'submit')
            control.markAsTouched();
    });
}
function updateControl(control, dir) {
    if (control._pendingDirty)
        control.markAsDirty();
    control.setValue(control._pendingValue, { emitModelToViewChange: false });
    dir.viewToModelUpdate(control._pendingValue);
    control._pendingChange = false;
}
function setUpModelChangePipeline(control, dir) {
    const onChange = (newValue, emitModelEvent) => {
        // control -> view
        dir.valueAccessor.writeValue(newValue);
        // control -> ngModel
        if (emitModelEvent)
            dir.viewToModelUpdate(newValue);
    };
    control.registerOnChange(onChange);
    // Register a callback function to cleanup onChange handler
    // from a control instance when a directive is destroyed.
    dir._registerOnDestroy(() => {
        control._unregisterOnChange(onChange);
    });
}
/**
 * Links a FormGroup or FormArray instance and corresponding Form directive by setting up validators
 * present in the view.
 *
 * @param control FormGroup or FormArray instance that should be linked.
 * @param dir Directive that provides view validators.
 */
export function setUpFormContainer(control, dir) {
    if (control == null && (typeof ngDevMode === 'undefined' || ngDevMode))
        _throwError(dir, 'Cannot find control with');
    setUpValidators(control, dir);
}
/**
 * Reverts the setup performed by the `setUpFormContainer` function.
 *
 * @param control FormGroup or FormArray instance that should be cleaned up.
 * @param dir Directive that provided view validators.
 * @returns true if a control was updated as a result of this action.
 */
export function cleanUpFormContainer(control, dir) {
    return cleanUpValidators(control, dir);
}
function _noControlError(dir) {
    return _throwError(dir, 'There is no FormControl instance attached to form control element with');
}
function _throwError(dir, message) {
    const messageEnd = _describeControlLocation(dir);
    throw new Error(`${message} ${messageEnd}`);
}
function _describeControlLocation(dir) {
    const path = dir.path;
    if (path && path.length > 1)
        return `path: '${path.join(' -> ')}'`;
    if (path?.[0])
        return `name: '${path}'`;
    return 'unspecified name attribute';
}
function _throwInvalidValueAccessorError(dir) {
    const loc = _describeControlLocation(dir);
    throw new RuntimeError(1200 /* RuntimeErrorCode.NG_VALUE_ACCESSOR_NOT_PROVIDED */, `Value accessor was not provided as an array for form control with ${loc}. ` +
        `Check that the \`NG_VALUE_ACCESSOR\` token is configured as a \`multi: true\` provider.`);
}
export function isPropertyUpdated(changes, viewModel) {
    if (!changes.hasOwnProperty('model'))
        return false;
    const change = changes['model'];
    if (change.isFirstChange())
        return true;
    return !Object.is(viewModel, change.currentValue);
}
export function isBuiltInAccessor(valueAccessor) {
    // Check if a given value accessor is an instance of a class that directly extends
    // `BuiltInControlValueAccessor` one.
    return Object.getPrototypeOf(valueAccessor.constructor) === BuiltInControlValueAccessor;
}
export function syncPendingControls(form, directives) {
    form._syncPendingControls();
    directives.forEach((dir) => {
        const control = dir.control;
        if (control.updateOn === 'submit' && control._pendingChange) {
            dir.viewToModelUpdate(control._pendingValue);
            control._pendingChange = false;
        }
    });
}
// TODO: vsavkin remove it once https://github.com/angular/angular/issues/3011 is implemented
export function selectValueAccessor(dir, valueAccessors) {
    if (!valueAccessors)
        return null;
    if (!Array.isArray(valueAccessors) && (typeof ngDevMode === 'undefined' || ngDevMode))
        _throwInvalidValueAccessorError(dir);
    let defaultAccessor = undefined;
    let builtinAccessor = undefined;
    let customAccessor = undefined;
    valueAccessors.forEach((v) => {
        if (v.constructor === DefaultValueAccessor) {
            defaultAccessor = v;
        }
        else if (isBuiltInAccessor(v)) {
            if (builtinAccessor && (typeof ngDevMode === 'undefined' || ngDevMode))
                _throwError(dir, 'More than one built-in value accessor matches form control with');
            builtinAccessor = v;
        }
        else {
            if (customAccessor && (typeof ngDevMode === 'undefined' || ngDevMode))
                _throwError(dir, 'More than one custom value accessor matches form control with');
            customAccessor = v;
        }
    });
    if (customAccessor)
        return customAccessor;
    if (builtinAccessor)
        return builtinAccessor;
    if (defaultAccessor)
        return defaultAccessor;
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
        _throwError(dir, 'No valid value accessor for form control with');
    }
    return null;
}
export function removeListItem(list, el) {
    const index = list.indexOf(el);
    if (index > -1)
        list.splice(index, 1);
}
// TODO(kara): remove after deprecation period
export function _ngModelWarning(name, type, instance, warningConfig) {
    if (warningConfig === 'never')
        return;
    if (((warningConfig === null || warningConfig === 'once') && !type._ngModelWarningSentOnce) ||
        (warningConfig === 'always' && !instance._ngModelWarningSent)) {
        console.warn(ngModelWarning(name));
        type._ngModelWarningSentOnce = true;
        instance._ngModelWarningSent = true;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhcmVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvZm9ybXMvc3JjL2RpcmVjdGl2ZXMvc2hhcmVkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxhQUFhLElBQUksWUFBWSxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBTzVELE9BQU8sRUFBQyx5QkFBeUIsRUFBRSxvQkFBb0IsRUFBRSxlQUFlLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFLL0YsT0FBTyxFQUFDLDJCQUEyQixFQUF1QixNQUFNLDBCQUEwQixDQUFDO0FBQzNGLE9BQU8sRUFBQyxvQkFBb0IsRUFBQyxNQUFNLDBCQUEwQixDQUFDO0FBRzlELE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUdqRCxNQUFNLFVBQVUsV0FBVyxDQUFDLElBQWlCLEVBQUUsTUFBd0I7SUFDckUsT0FBTyxDQUFDLEdBQUcsTUFBTSxDQUFDLElBQUssRUFBRSxJQUFLLENBQUMsQ0FBQztBQUNsQyxDQUFDO0FBRUQ7Ozs7OztHQU1HO0FBQ0gsTUFBTSxVQUFVLFlBQVksQ0FBQyxPQUFvQixFQUFFLEdBQWM7SUFDL0QsSUFBSSxPQUFPLFNBQVMsS0FBSyxXQUFXLElBQUksU0FBUyxFQUFFO1FBQ2pELElBQUksQ0FBQyxPQUFPO1lBQUUsV0FBVyxDQUFDLEdBQUcsRUFBRSwwQkFBMEIsQ0FBQyxDQUFDO1FBQzNELElBQUksQ0FBQyxHQUFHLENBQUMsYUFBYTtZQUFFLFdBQVcsQ0FBQyxHQUFHLEVBQUUseUNBQXlDLENBQUMsQ0FBQztLQUNyRjtJQUVELGVBQWUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFFOUIsR0FBRyxDQUFDLGFBQWMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBRTdDLElBQUksT0FBTyxDQUFDLFFBQVEsRUFBRTtRQUNw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SSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ25DLElBQUksQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLENBQUM7UUFDcEMsUUFBUSxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQztLQUNyQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHvJtVJ1bnRpbWVFcnJvciBhcyBSdW50aW1lRXJyb3J9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuXG5pbXBvcnQge1J1bnRpbWVFcnJvckNvZGV9IGZyb20gJy4uL2Vycm9ycyc7XG5pbXBvcnQge0Fic3RyYWN0Q29udHJvbH0gZnJvbSAnLi4vbW9kZWwvYWJzdHJhY3RfbW9kZWwnO1xuaW1wb3J0IHtGb3JtQXJyYXl9IGZyb20gJy4uL21vZGVsL2Zvcm1fYXJyYXknO1xuaW1wb3J0IHtGb3JtQ29udHJvbH0gZnJvbSAnLi4vbW9kZWwvZm9ybV9jb250cm9sJztcbmltcG9ydCB7Rm9ybUdyb3VwfSBmcm9tICcuLi9tb2RlbC9mb3JtX2dyb3VwJztcbmltcG9ydCB7Z2V0Q29udHJvbEFzeW5jVmFsaWRhdG9ycywgZ2V0Q29udHJvbFZhbGlkYXRvcnMsIG1lcmdlVmFsaWRhdG9yc30gZnJvbSAnLi4vdmFsaWRhdG9ycyc7XG5cbmltcG9ydCB7QWJzdHJhY3RDb250cm9sRGlyZWN0aXZlfSBmcm9tICcuL2Fic3RyYWN0X2NvbnRyb2xfZGlyZWN0aXZlJztcbmltcG9ydCB7QWJzdHJhY3RGb3JtR3JvdXBEaXJlY3RpdmV9IGZyb20gJy4vYWJzdHJhY3RfZm9ybV9ncm91cF9kaXJlY3RpdmUnO1xuaW1wb3J0IHtDb250cm9sQ29udGFpbmVyfSBmcm9tICcuL2NvbnRyb2xfY29udGFpbmVyJztcbmltcG9ydCB7QnVpbHRJbkNvbnRyb2xWYWx1ZUFjY2Vzc29yLCBDb250cm9sVmFsdWVBY2Nlc3Nvcn0gZnJvbSAnLi9jb250cm9sX3ZhbHVlX2FjY2Vzc29yJztcbmltcG9ydCB7RGVmYXVsdFZhbHVlQWNjZXNzb3J9IGZyb20gJy4vZGVmYXVsdF92YWx1ZV9hY2Nlc3Nvcic7XG5pbXBvcnQge05nQ29udHJvbH0gZnJvbSAnLi9uZ19jb250cm9sJztcbmltcG9ydCB7Rm9ybUFycmF5TmFtZX0gZnJvbSAnLi9yZWFjdGl2ZV9kaXJlY3RpdmVzL2Zvcm1fZ3JvdXBfbmFtZSc7XG5pbXBvcnQge25nTW9kZWxXYXJuaW5nfSBmcm9tICcuL3JlYWN0aXZlX2Vycm9ycyc7XG5pbXBvcnQge0FzeW5jVmFsaWRhdG9yRm4sIFZhbGlkYXRvciwgVmFsaWRhdG9yRm59IGZyb20gJy4vdmFsaWRhdG9ycyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjb250cm9sUGF0aChuYW1lOiBzdHJpbmd8bnVsbCwgcGFyZW50OiBDb250cm9sQ29udGFpbmVyKTogc3RyaW5nW10ge1xuICByZXR1cm4gWy4uLnBhcmVudC5wYXRoISwgbmFtZSFdO1xufVxuXG4vKipcbiAqIExpbmtzIGEgRm9ybSBjb250cm9sIGFuZCBhIEZvcm0gZGlyZWN0aXZlIGJ5IHNldHRpbmcgdXAgY2FsbGJhY2tzIChzdWNoIGFzIGBvbkNoYW5nZWApIG9uIGJvdGhcbiAqIGluc3RhbmNlcy4gVGhpcyBmdW5jdGlvbiBpcyB0eXBpY2FsbHkgaW52b2tlZCB3aGVuIGZvcm0gZGlyZWN0aXZlIGlzIGJlaW5nIGluaXRpYWxpemVkLlxuICpcbiAqIEBwYXJhbSBjb250cm9sIEZvcm0gY29udHJvbCBpbnN0YW5jZSB0aGF0IHNob3VsZCBiZSBsaW5rZWQuXG4gKiBAcGFyYW0gZGlyIERpcmVjdGl2ZSB0aGF0IHNob3VsZCBiZSBsaW5rZWQgd2l0aCBhIGdpdmVuIGNvbnRyb2wuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXRVcENvbnRyb2woY29udHJvbDogRm9ybUNvbnRyb2wsIGRpcjogTmdDb250cm9sKTogdm9pZCB7XG4gIGlmICh0eXBlb2YgbmdEZXZNb2RlID09PSAndW5kZWZpbmVkJyB8fCBuZ0Rldk1vZGUpIHtcbiAgICBpZiAoIWNvbnRyb2wpIF90aHJvd0Vycm9yKGRpciwgJ0Nhbm5vdCBmaW5kIGNvbnRyb2wgd2l0aCcpO1xuICAgIGlmICghZGlyLnZhbHVlQWNjZXNzb3IpIF90aHJvd0Vycm9yKGRpciwgJ05vIHZhbHVlIGFjY2Vzc29yIGZvciBmb3JtIGNvbnRyb2wgd2l0aCcpO1xuICB9XG5cbiAgc2V0VXBWYWxpZGF0b3JzKGNvbnRyb2wsIGRpcik7XG5cbiAgZGlyLnZhbHVlQWNjZXNzb3IhLndyaXRlVmFsdWUoY29udHJvbC52YWx1ZSk7XG5cbiAgaWYgKGNvbnRyb2wuZGlzYWJsZWQpIHtcbiAgICBkaXIudmFsdWVBY2Nlc3NvciEuc2V0RGlzYWJsZWRTdGF0ZT8uKHRydWUpO1xuICB9XG5cbiAgc2V0VXBWaWV3Q2hhbmdlUGlwZWxpbmUoY29udHJvbCwgZGlyKTtcbiAgc2V0VXBNb2RlbENoYW5nZVBpcGVsaW5lKGNvbnRyb2wsIGRpcik7XG5cbiAgc2V0VXBCbHVyUGlwZWxpbmUoY29udHJvbCwgZGlyKTtcblxuICBzZXRVcERpc2FibGVkQ2hhbmdlSGFuZGxlcihjb250cm9sLCBkaXIpO1xufVxuXG4vKipcbiAqIFJldmVydHMgY29uZmlndXJhdGlvbiBwZXJmb3JtZWQgYnkgdGhlIGBzZXRVcENvbnRyb2xgIGNvbnRyb2wgZnVuY3Rpb24uXG4gKiBFZmZlY3RpdmVseSBkaXNjb25uZWN0cyBmb3JtIGNvbnRyb2wgd2l0aCBhIGdpdmVuIGZvcm0gZGlyZWN0aXZlLlxuICogVGhpcyBmdW5jdGlvbiBpcyB0eXBpY2FsbHkgaW52b2tlZCB3aGVuIGNvcnJlc3BvbmRpbmcgZm9ybSBkaXJlY3RpdmUgaXMgYmVpbmcgZGVzdHJveWVkLlxuICpcbiAqIEBwYXJhbSBjb250cm9sIEZvcm0gY29udHJvbCB3aGljaCBzaG91bGQgYmUgY2xlYW5lZCB1cC5cbiAqIEBwYXJhbSBkaXIgRGlyZWN0aXZlIHRoYXQgc2hvdWxkIGJlIGRpc2Nvbm5lY3RlZCBmcm9tIGEgZ2l2ZW4gY29udHJvbC5cbiAqIEBwYXJhbSB2YWxpZGF0ZUNvbnRyb2xQcmVzZW5jZU9uQ2hhbmdlIEZsYWcgdGhhdCBpbmRpY2F0ZXMgd2hldGhlciBvbkNoYW5nZSBoYW5kbGVyIHNob3VsZFxuICogICAgIGNvbnRhaW4gYXNzZXJ0cyB0byB2ZXJpZnkgdGhhdCBpdCdzIG5vdCBjYWxsZWQgb25jZSBkaXJlY3RpdmUgaXMgZGVzdHJveWVkLiBXZSBuZWVkIHRoaXMgZmxhZ1xuICogICAgIHRvIGF2b2lkIHBvdGVudGlhbGx5IGJyZWFraW5nIGNoYW5nZXMgY2F1c2VkIGJ5IGJldHRlciBjb250cm9sIGNsZWFudXAgaW50cm9kdWNlZCBpbiAjMzkyMzUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjbGVhblVwQ29udHJvbChcbiAgICBjb250cm9sOiBGb3JtQ29udHJvbHxudWxsLCBkaXI6IE5nQ29udHJvbCxcbiAgICB2YWxpZGF0ZUNvbnRyb2xQcmVzZW5jZU9uQ2hhbmdlOiBib29sZWFuID0gdHJ1ZSk6IHZvaWQge1xuICBjb25zdCBub29wID0gKCkgPT4ge1xuICAgIGlmICh2YWxpZGF0ZUNvbnRyb2xQcmVzZW5jZU9uQ2hhbmdlICYmICh0eXBlb2YgbmdEZXZNb2RlID09PSAndW5kZWZpbmVkJyB8fCBuZ0Rldk1vZGUpKSB7XG4gICAgICBfbm9Db250cm9sRXJyb3IoZGlyKTtcbiAgICB9XG4gIH07XG5cbiAgLy8gVGhlIGB2YWx1ZUFjY2Vzc29yYCBmaWVsZCBpcyB0eXBpY2FsbHkgZGVmaW5lZCBvbiBGcm9tQ29udHJvbCBhbmQgRm9ybUNvbnRyb2xOYW1lIGRpcmVjdGl2ZVxuICAvLyBpbnN0YW5jZXMgYW5kIHRoZXJlIGlzIGEgbG9naWMgaW4gYHNlbGVjdFZhbHVlQWNjZXNzb3JgIGZ1bmN0aW9uIHRoYXQgdGhyb3dzIGlmIGl0J3Mgbm90IHRoZVxuICAvLyBjYXNlLiBXZSBzdGlsbCBjaGVjayB0aGUgcHJlc2VuY2Ugb2YgYHZhbHVlQWNjZXNzb3JgIGJlZm9yZSBpbnZva2luZyBpdHMgbWV0aG9kcyB0byBtYWtlIHN1cmVcbiAgLy8gdGhhdCBjbGVhbnVwIHdvcmtzIGNvcnJlY3RseSBpZiBhcHAgY29kZSBvciB0ZXN0cyBhcmUgc2V0dXAgdG8gaWdub3JlIHRoZSBlcnJvciB0aHJvd24gZnJvbVxuICAvLyBgc2VsZWN0VmFsdWVBY2Nlc3NvcmAuIFNlZSBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyL2lzc3Vlcy80MDUyMS5cbiAgaWYgKGRpci52YWx1ZUFjY2Vzc29yKSB7XG4gICAgZGlyLnZhbHVlQWNjZXNzb3IucmVnaXN0ZXJPbkNoYW5nZShub29wKTtcbiAgICBkaXIudmFsdWVBY2Nlc3Nvci5yZWdpc3Rlck9uVG91Y2hlZChub29wKTtcbiAgfVxuXG4gIGNsZWFuVXBWYWxpZGF0b3JzKGNvbnRyb2wsIGRpcik7XG5cbiAgaWYgKGNvbnRyb2wpIHtcbiAgICBkaXIuX2ludm9rZU9uRGVzdHJveUNhbGxiYWNrcygpO1xuICAgIGNvbnRyb2wuX3JlZ2lzdGVyT25Db2xsZWN0aW9uQ2hhbmdlKCgpID0+IHt9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZWdpc3Rlck9uVmFsaWRhdG9yQ2hhbmdlPFY+KHZhbGlkYXRvcnM6IChWfFZhbGlkYXRvcilbXSwgb25DaGFuZ2U6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgdmFsaWRhdG9ycy5mb3JFYWNoKCh2YWxpZGF0b3I6IFZ8VmFsaWRhdG9yKSA9PiB7XG4gICAgaWYgKCg8VmFsaWRhdG9yPnZhbGlkYXRvcikucmVnaXN0ZXJPblZhbGlkYXRvckNoYW5nZSlcbiAgICAgICg8VmFsaWRhdG9yPnZhbGlkYXRvcikucmVnaXN0ZXJPblZhbGlkYXRvckNoYW5nZSEob25DaGFuZ2UpO1xuICB9KTtcbn1cblxuLyoqXG4gKiBTZXRzIHVwIGRpc2FibGVkIGNoYW5nZSBoYW5kbGVyIGZ1bmN0aW9uIG9uIGEgZ2l2ZW4gZm9ybSBjb250cm9sIGlmIENvbnRyb2xWYWx1ZUFjY2Vzc29yXG4gKiBhc3NvY2lhdGVkIHdpdGggYSBnaXZlbiBkaXJlY3RpdmUgaW5zdGFuY2Ugc3VwcG9ydHMgdGhlIGBzZXREaXNhYmxlZFN0YXRlYCBjYWxsLlxuICpcbiAqIEBwYXJhbSBjb250cm9sIEZvcm0gY29udHJvbCB3aGVyZSBkaXNhYmxlZCBjaGFuZ2UgaGFuZGxlciBzaG91bGQgYmUgc2V0dXAuXG4gKiBAcGFyYW0gZGlyIENvcnJlc3BvbmRpbmcgZGlyZWN0aXZlIGluc3RhbmNlIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGNvbnRyb2wuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXRVcERpc2FibGVkQ2hhbmdlSGFuZGxlcihjb250cm9sOiBGb3JtQ29udHJvbCwgZGlyOiBOZ0NvbnRyb2wpOiB2b2lkIHtcbiAgaWYgKGRpci52YWx1ZUFjY2Vzc29yIS5zZXREaXNhYmxlZFN0YXRlKSB7XG4gICAgY29uc3Qgb25EaXNhYmxlZENoYW5nZSA9IChpc0Rpc2FibGVkOiBib29sZWFuKSA9PiB7XG4gICAgICBkaXIudmFsdWVBY2Nlc3NvciEuc2V0RGlzYWJsZWRTdGF0ZSEoaXNEaXNhYmxlZCk7XG4gICAgfTtcbiAgICBjb250cm9sLnJlZ2lzdGVyT25EaXNhYmxlZENoYW5nZShvbkRpc2FibGVkQ2hhbmdlKTtcblxuICAgIC8vIFJlZ2lzdGVyIGEgY2FsbGJhY2sgZnVuY3Rpb24gdG8gY2xlYW51cCBkaXNhYmxlZCBjaGFuZ2UgaGFuZGxlclxuICAgIC8vIGZyb20gYSBjb250cm9sIGluc3RhbmNlIHdoZW4gYSBkaXJlY3RpdmUgaXMgZGVzdHJveWVkLlxuICAgIGRpci5fcmVnaXN0ZXJPbkRlc3Ryb3koKCkgPT4ge1xuICAgICAgY29udHJvbC5fdW5yZWdpc3Rlck9uRGlzYWJsZWRDaGFuZ2Uob25EaXNhYmxlZENoYW5nZSk7XG4gICAgfSk7XG4gIH1cbn1cblxuLyoqXG4gKiBTZXRzIHVwIHN5bmMgYW5kIGFzeW5jIGRpcmVjdGl2ZSB2YWxpZGF0b3JzIG9uIHByb3ZpZGVkIGZvcm0gY29udHJvbC5cbiAqIFRoaXMgZnVuY3Rpb24gbWVyZ2VzIHZhbGlkYXRvcnMgZnJvbSB0aGUgZGlyZWN0aXZlIGludG8gdGhlIHZhbGlkYXRvcnMgb2YgdGhlIGNvbnRyb2wuXG4gKlxuICogQHBhcmFtIGNvbnRyb2wgRm9ybSBjb250cm9sIHdoZXJlIGRpcmVjdGl2ZSB2YWxpZGF0b3JzIHNob3VsZCBiZSBzZXR1cC5cbiAqIEBwYXJhbSBkaXIgRGlyZWN0aXZlIGluc3RhbmNlIHRoYXQgY29udGFpbnMgdmFsaWRhdG9ycyB0byBiZSBzZXR1cC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNldFVwVmFsaWRhdG9ycyhjb250cm9sOiBBYnN0cmFjdENvbnRyb2wsIGRpcjogQWJzdHJhY3RDb250cm9sRGlyZWN0aXZlKTogdm9pZCB7XG4gIGNvbnN0IHZhbGlkYXRvcnMgPSBnZXRDb250cm9sVmFsaWRhdG9ycyhjb250cm9sKTtcbiAgaWYgKGRpci52YWxpZGF0b3IgIT09IG51bGwpIHtcbiAgICBjb250cm9sLnNldFZhbGlkYXRvcnMobWVyZ2VWYWxpZGF0b3JzPFZhbGlkYXRvckZuPih2YWxpZGF0b3JzLCBkaXIudmFsaWRhdG9yKSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIHZhbGlkYXRvcnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAvLyBJZiBzeW5jIHZhbGlkYXRvcnMgYXJlIHJlcHJlc2VudGVkIGJ5IGEgc2luZ2xlIHZhbGlkYXRvciBmdW5jdGlvbiwgd2UgZm9yY2UgdGhlXG4gICAgLy8gYFZhbGlkYXRvcnMuY29tcG9zZWAgY2FsbCB0byBoYXBwZW4gYnkgZXhlY3V0aW5nIHRoZSBgc2V0VmFsaWRhdG9yc2AgZnVuY3Rpb24gd2l0aFxuICAgIC8vIGFuIGFycmF5IHRoYXQgY29udGFpbnMgdGhhdCBmdW5jdGlvbi4gV2UgbmVlZCB0aGlzIHRvIGF2b2lkIHBvc3NpYmxlIGRpc2NyZXBhbmNpZXMgaW5cbiAgICAvLyB2YWxpZGF0b3JzIGJlaGF2aW9yLCBzbyBzeW5jIHZhbGlkYXRvcnMgYXJlIGFsd2F5cyBwcm9jZXNzZWQgYnkgdGhlIGBWYWxpZGF0b3JzLmNvbXBvc2VgLlxuICAgIC8vIE5vdGU6IHdlIHNob3VsZCBjb25zaWRlciBtb3ZpbmcgdGhpcyBsb2dpYyBpbnNpZGUgdGhlIGBzZXRWYWxpZGF0b3JzYCBmdW5jdGlvbiBpdHNlbGYsIHNvIHdlXG4gICAgLy8gaGF2ZSBjb25zaXN0ZW50IGJlaGF2aW9yIG9uIEFic3RyYWN0Q29udHJvbCBBUEkgbGV2ZWwuIFRoZSBzYW1lIGFwcGxpZXMgdG8gdGhlIGFzeW5jXG4gICAgLy8gdmFsaWRhdG9ycyBsb2dpYyBiZWxvdy5cbiAgICBjb250cm9sLnNldFZhbGlkYXRvcnMoW3ZhbGlkYXRvcnNdKTtcbiAgfVxuXG4gIGNvbnN0IGFzeW5jVmFsaWRhdG9ycyA9IGdldENvbnRyb2xBc3luY1ZhbGlkYXRvcnMoY29udHJvbCk7XG4gIGlmIChkaXIuYXN5bmNWYWxpZGF0b3IgIT09IG51bGwpIHtcbiAgICBjb250cm9sLnNldEFzeW5jVmFsaWRhdG9ycyhcbiAgICAgICAgbWVyZ2VWYWxpZGF0b3JzPEFzeW5jVmFsaWRhdG9yRm4+KGFzeW5jVmFsaWRhdG9ycywgZGlyLmFzeW5jVmFsaWRhdG9yKSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGFzeW5jVmFsaWRhdG9ycyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNvbnRyb2wuc2V0QXN5bmNWYWxpZGF0b3JzKFthc3luY1ZhbGlkYXRvcnNdKTtcbiAgfVxuXG4gIC8vIFJlLXJ1biB2YWxpZGF0aW9uIHdoZW4gdmFsaWRhdG9yIGJpbmRpbmcgY2hhbmdlcywgZS5nLiBtaW5sZW5ndGg9MyAtPiBtaW5sZW5ndGg9NFxuICBjb25zdCBvblZhbGlkYXRvckNoYW5nZSA9ICgpID0+IGNvbnRyb2wudXBkYXRlVmFsdWVBbmRWYWxpZGl0eSgpO1xuICByZWdpc3Rlck9uVmFsaWRhdG9yQ2hhbmdlPFZhbGlkYXRvckZuPihkaXIuX3Jhd1ZhbGlkYXRvcnMsIG9uVmFsaWRhdG9yQ2hhbmdlKTtcbiAgcmVnaXN0ZXJPblZhbGlkYXRvckNoYW5nZTxBc3luY1ZhbGlkYXRvckZuPihkaXIuX3Jhd0FzeW5jVmFsaWRhdG9ycywgb25WYWxpZGF0b3JDaGFuZ2UpO1xufVxuXG4vKipcbiAqIENsZWFucyB1cCBzeW5jIGFuZCBhc3luYyBkaXJlY3RpdmUgdmFsaWRhdG9ycyBvbiBwcm92aWRlZCBmb3JtIGNvbnRyb2wuXG4gKiBUaGlzIGZ1bmN0aW9uIHJldmVydHMgdGhlIHNldHVwIHBlcmZvcm1lZCBieSB0aGUgYHNldFVwVmFsaWRhdG9yc2AgZnVuY3Rpb24sIGkuZS5cbiAqIHJlbW92ZXMgZGlyZWN0aXZlLXNwZWNpZmljIHZhbGlkYXRvcnMgZnJvbSBhIGdpdmVuIGNvbnRyb2wgaW5zdGFuY2UuXG4gKlxuICogQHBhcmFtIGNvbnRyb2wgRm9ybSBjb250cm9sIGZyb20gd2hlcmUgZGlyZWN0aXZlIHZhbGlkYXRvcnMgc2hvdWxkIGJlIHJlbW92ZWQuXG4gKiBAcGFyYW0gZGlyIERpcmVjdGl2ZSBpbnN0YW5jZSB0aGF0IGNvbnRhaW5zIHZhbGlkYXRvcnMgdG8gYmUgcmVtb3ZlZC5cbiAqIEByZXR1cm5zIHRydWUgaWYgYSBjb250cm9sIHdhcyB1cGRhdGVkIGFzIGEgcmVzdWx0IG9mIHRoaXMgYWN0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY2xlYW5VcFZhbGlkYXRvcnMoXG4gICAgY29udHJvbDogQWJzdHJhY3RDb250cm9sfG51bGwsIGRpcjogQWJzdHJhY3RDb250cm9sRGlyZWN0aXZlKTogYm9vbGVhbiB7XG4gIGxldCBpc0NvbnRyb2xVcGRhdGVkID0gZmFsc2U7XG4gIGlmIChjb250cm9sICE9PSBudWxsKSB7XG4gICAgaWYgKGRpci52YWxpZGF0b3IgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IHZhbGlkYXRvcnMgPSBnZXRDb250cm9sVmFsaWRhdG9ycyhjb250cm9sKTtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbGlkYXRvcnMpICYmIHZhbGlkYXRvcnMubGVuZ3RoID4gMCkge1xuICAgICAgICAvLyBGaWx0ZXIgb3V0IGRpcmVjdGl2ZSB2YWxpZGF0b3IgZnVuY3Rpb24uXG4gICAgICAgIGNvbnN0IHVwZGF0ZWRWYWxpZGF0b3JzID0gdmFsaWRhdG9ycy5maWx0ZXIoKHZhbGlkYXRvcikgPT4gdmFsaWRhdG9yICE9PSBkaXIudmFsaWRhdG9yKTtcbiAgICAgICAgaWYgKHVwZGF0ZWRWYWxpZGF0b3JzLmxlbmd0aCAhPT0gdmFsaWRhdG9ycy5sZW5ndGgpIHtcbiAgICAgICAgICBpc0NvbnRyb2xVcGRhdGVkID0gdHJ1ZTtcbiAgICAgICAgICBjb250cm9sLnNldFZhbGlkYXRvcnModXBkYXRlZFZhbGlkYXRvcnMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGRpci5hc3luY1ZhbGlkYXRvciAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgYXN5bmNWYWxpZGF0b3JzID0gZ2V0Q29udHJvbEFzeW5jVmFsaWRhdG9ycyhjb250cm9sKTtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGFzeW5jVmFsaWRhdG9ycykgJiYgYXN5bmNWYWxpZGF0b3JzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgLy8gRmlsdGVyIG91dCBkaXJlY3RpdmUgYXN5bmMgdmFsaWRhdG9yIGZ1bmN0aW9uLlxuICAgICAgICBjb25zdCB1cGRhdGVkQXN5bmNWYWxpZGF0b3JzID1cbiAgICAgICAgICAgIGFzeW5jVmFsaWRhdG9ycy5maWx0ZXIoKGFzeW5jVmFsaWRhdG9yKSA9PiBhc3luY1ZhbGlkYXRvciAhPT0gZGlyLmFzeW5jVmFsaWRhdG9yKTtcbiAgICAgICAgaWYgKHVwZGF0ZWRBc3luY1ZhbGlkYXRvcnMubGVuZ3RoICE9PSBhc3luY1ZhbGlkYXRvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgaXNDb250cm9sVXBkYXRlZCA9IHRydWU7XG4gICAgICAgICAgY29udHJvbC5zZXRBc3luY1ZhbGlkYXRvcnModXBkYXRlZEFzeW5jVmFsaWRhdG9ycyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBDbGVhciBvblZhbGlkYXRvckNoYW5nZSBjYWxsYmFja3MgYnkgcHJvdmlkaW5nIGEgbm9vcCBmdW5jdGlvbi5cbiAgY29uc3Qgbm9vcCA9ICgpID0+IHt9O1xuICByZWdpc3Rlck9uVmFsaWRhdG9yQ2hhbmdlPFZhbGlkYXRvckZuPihkaXIuX3Jhd1ZhbGlkYXRvcnMsIG5vb3ApO1xuICByZWdpc3Rlck9uVmFsaWRhdG9yQ2hhbmdlPEFzeW5jVmFsaWRhdG9yRm4+KGRpci5fcmF3QXN5bmNWYWxpZGF0b3JzLCBub29wKTtcblxuICByZXR1cm4gaXNDb250cm9sVXBkYXRlZDtcbn1cblxuZnVuY3Rpb24gc2V0VXBWaWV3Q2hhbmdlUGlwZWxpbmUoY29udHJvbDogRm9ybUNvbnRyb2wsIGRpcjogTmdDb250cm9sKTogdm9pZCB7XG4gIGRpci52YWx1ZUFjY2Vzc29yIS5yZWdpc3Rlck9uQ2hhbmdlKChuZXdWYWx1ZTogYW55KSA9PiB7XG4gICAgY29udHJvbC5fcGVuZGluZ1ZhbHVlID0gbmV3VmFsdWU7XG4gICAgY29udHJvbC5fcGVuZGluZ0NoYW5nZSA9IHRydWU7XG4gICAgY29udHJvbC5fcGVuZGluZ0RpcnR5ID0gdHJ1ZTtcblxuICAgIGlmIChjb250cm9sLnVwZGF0ZU9uID09PSAnY2hhbmdlJykgdXBkYXRlQ29udHJvbChjb250cm9sLCBkaXIpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gc2V0VXBCbHVyUGlwZWxpbmUoY29udHJvbDogRm9ybUNvbnRyb2wsIGRpcjogTmdDb250cm9sKTogdm9pZCB7XG4gIGRpci52YWx1ZUFjY2Vzc29yIS5yZWdpc3Rlck9uVG91Y2hlZCgoKSA9PiB7XG4gICAgY29udHJvbC5fcGVuZGluZ1RvdWNoZWQgPSB0cnVlO1xuXG4gICAgaWYgKGNvbnRyb2wudXBkYXRlT24gPT09ICdibHVyJyAmJiBjb250cm9sLl9wZW5kaW5nQ2hhbmdlKSB1cGRhdGVDb250cm9sKGNvbnRyb2wsIGRpcik7XG4gICAgaWYgKGNvbnRyb2wudXBkYXRlT24gIT09ICdzdWJtaXQnKSBjb250cm9sLm1hcmtBc1RvdWNoZWQoKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUNvbnRyb2woY29udHJvbDogRm9ybUNvbnRyb2wsIGRpcjogTmdDb250cm9sKTogdm9pZCB7XG4gIGlmIChjb250cm9sLl9wZW5kaW5nRGlydHkpIGNvbnRyb2wubWFya0FzRGlydHkoKTtcbiAgY29udHJvbC5zZXRWYWx1ZShjb250cm9sLl9wZW5kaW5nVmFsdWUsIHtlbWl0TW9kZWxUb1ZpZXdDaGFuZ2U6IGZhbHNlfSk7XG4gIGRpci52aWV3VG9Nb2RlbFVwZGF0ZShjb250cm9sLl9wZW5kaW5nVmFsdWUpO1xuICBjb250cm9sLl9wZW5kaW5nQ2hhbmdlID0gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIHNldFVwTW9kZWxDaGFuZ2VQaXBlbGluZShjb250cm9sOiBGb3JtQ29udHJvbCwgZGlyOiBOZ0NvbnRyb2wpOiB2b2lkIHtcbiAgY29uc3Qgb25DaGFuZ2UgPSAobmV3VmFsdWU/OiBhbnksIGVtaXRNb2RlbEV2ZW50PzogYm9vbGVhbikgPT4ge1xuICAgIC8vIGNvbnRyb2wgLT4gdmlld1xuICAgIGRpci52YWx1ZUFjY2Vzc29yIS53cml0ZVZhbHVlKG5ld1ZhbHVlKTtcblxuICAgIC8vIGNvbnRyb2wgLT4gbmdNb2RlbFxuICAgIGlmIChlbWl0TW9kZWxFdmVudCkgZGlyLnZpZXdUb01vZGVsVXBkYXRlKG5ld1ZhbHVlKTtcbiAgfTtcbiAgY29udHJvbC5yZWdpc3Rlck9uQ2hhbmdlKG9uQ2hhbmdlKTtcblxuICAvLyBSZWdpc3RlciBhIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIGNsZWFudXAgb25DaGFuZ2UgaGFuZGxlclxuICAvLyBmcm9tIGEgY29udHJvbCBpbnN0YW5jZSB3aGVuIGEgZGlyZWN0aXZlIGlzIGRlc3Ryb3llZC5cbiAgZGlyLl9yZWdpc3Rlck9uRGVzdHJveSgoKSA9PiB7XG4gICAgY29udHJvbC5fdW5yZWdpc3Rlck9uQ2hhbmdlKG9uQ2hhbmdlKTtcbiAgfSk7XG59XG5cbi8qKlxuICogTGlua3MgYSBGb3JtR3JvdXAgb3IgRm9ybUFycmF5IGluc3RhbmNlIGFuZCBjb3JyZXNwb25kaW5nIEZvcm0gZGlyZWN0aXZlIGJ5IHNldHRpbmcgdXAgdmFsaWRhdG9yc1xuICogcHJlc2VudCBpbiB0aGUgdmlldy5cbiAqXG4gKiBAcGFyYW0gY29udHJvbCBGb3JtR3JvdXAgb3IgRm9ybUFycmF5IGluc3RhbmNlIHRoYXQgc2hvdWxkIGJlIGxpbmtlZC5cbiAqIEBwYXJhbSBkaXIgRGlyZWN0aXZlIHRoYXQgcHJvdmlkZXMgdmlldyB2YWxpZGF0b3JzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0VXBGb3JtQ29udGFpbmVyKFxuICAgIGNvbnRyb2w6IEZvcm1Hcm91cHxGb3JtQXJyYXksIGRpcjogQWJzdHJhY3RGb3JtR3JvdXBEaXJlY3RpdmV8Rm9ybUFycmF5TmFtZSkge1xuICBpZiAoY29udHJvbCA9PSBudWxsICYmICh0eXBlb2YgbmdEZXZNb2RlID09PSAndW5kZWZpbmVkJyB8fCBuZ0Rldk1vZGUpKVxuICAgIF90aHJvd0Vycm9yKGRpciwgJ0Nhbm5vdCBmaW5kIGNvbnRyb2wgd2l0aCcpO1xuICBzZXRVcFZhbGlkYXRvcnMoY29udHJvbCwgZGlyKTtcbn1cblxuLyoqXG4gKiBSZXZlcnRzIHRoZSBzZXR1cCBwZXJmb3JtZWQgYnkgdGhlIGBzZXRVcEZvcm1Db250YWluZXJgIGZ1bmN0aW9uLlxuICpcbiAqIEBwYXJhbSBjb250cm9sIEZvcm1Hcm91cCBvciBGb3JtQXJyYXkgaW5zdGFuY2UgdGhhdCBzaG91bGQgYmUgY2xlYW5lZCB1cC5cbiAqIEBwYXJhbSBkaXIgRGlyZWN0aXZlIHRoYXQgcHJvdmlkZWQgdmlldyB2YWxpZGF0b3JzLlxuICogQHJldHVybnMgdHJ1ZSBpZiBhIGNvbnRyb2wgd2FzIHVwZGF0ZWQgYXMgYSByZXN1bHQgb2YgdGhpcyBhY3Rpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjbGVhblVwRm9ybUNvbnRhaW5lcihcbiAgICBjb250cm9sOiBGb3JtR3JvdXB8Rm9ybUFycmF5LCBkaXI6IEFic3RyYWN0Rm9ybUdyb3VwRGlyZWN0aXZlfEZvcm1BcnJheU5hbWUpOiBib29sZWFuIHtcbiAgcmV0dXJuIGNsZWFuVXBWYWxpZGF0b3JzKGNvbnRyb2wsIGRpcik7XG59XG5cbmZ1bmN0aW9uIF9ub0NvbnRyb2xFcnJvcihkaXI6IE5nQ29udHJvbCkge1xuICByZXR1cm4gX3Rocm93RXJyb3IoZGlyLCAnVGhlcmUgaXMgbm8gRm9ybUNvbnRyb2wgaW5zdGFuY2UgYXR0YWNoZWQgdG8gZm9ybSBjb250cm9sIGVsZW1lbnQgd2l0aCcpO1xufVxuXG5mdW5jdGlvbiBfdGhyb3dFcnJvcihkaXI6IEFic3RyYWN0Q29udHJvbERpcmVjdGl2ZSwgbWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IG1lc3NhZ2VFbmQgPSBfZGVzY3JpYmVDb250cm9sTG9jYXRpb24oZGlyKTtcbiAgdGhyb3cgbmV3IEVycm9yKGAke21lc3NhZ2V9ICR7bWVzc2FnZUVuZH1gKTtcbn1cblxuZnVuY3Rpb24gX2Rlc2NyaWJlQ29udHJvbExvY2F0aW9uKGRpcjogQWJzdHJhY3RDb250cm9sRGlyZWN0aXZlKTogc3RyaW5nIHtcbiAgY29uc3QgcGF0aCA9IGRpci5wYXRoO1xuICBpZiAocGF0aCAmJiBwYXRoLmxlbmd0aCA+IDEpIHJldHVybiBgcGF0aDogJyR7cGF0aC5qb2luKCcgLT4gJyl9J2A7XG4gIGlmIChwYXRoPy5bMF0pIHJldHVybiBgbmFtZTogJyR7cGF0aH0nYDtcbiAgcmV0dXJuICd1bnNwZWNpZmllZCBuYW1lIGF0dHJpYnV0ZSc7XG59XG5cbmZ1bmN0aW9uIF90aHJvd0ludmFsaWRWYWx1ZUFjY2Vzc29yRXJyb3IoZGlyOiBBYnN0cmFjdENvbnRyb2xEaXJlY3RpdmUpIHtcbiAgY29uc3QgbG9jID0gX2Rlc2NyaWJlQ29udHJvbExvY2F0aW9uKGRpcik7XG4gIHRocm93IG5ldyBSdW50aW1lRXJyb3IoXG4gICAgICBSdW50aW1lRXJyb3JDb2RlLk5HX1ZBTFVFX0FDQ0VTU09SX05PVF9QUk9WSURFRCxcbiAgICAgIGBWYWx1ZSBhY2Nlc3NvciB3YXMgbm90IHByb3ZpZGVkIGFzIGFuIGFycmF5IGZvciBmb3JtIGNvbnRyb2wgd2l0aCAke2xvY30uIGAgK1xuICAgICAgICAgIGBDaGVjayB0aGF0IHRoZSBcXGBOR19WQUxVRV9BQ0NFU1NPUlxcYCB0b2tlbiBpcyBjb25maWd1cmVkIGFzIGEgXFxgbXVsdGk6IHRydWVcXGAgcHJvdmlkZXIuYCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1Byb3BlcnR5VXBkYXRlZChjaGFuZ2VzOiB7W2tleTogc3RyaW5nXTogYW55fSwgdmlld01vZGVsOiBhbnkpOiBib29sZWFuIHtcbiAgaWYgKCFjaGFuZ2VzLmhhc093blByb3BlcnR5KCdtb2RlbCcpKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IGNoYW5nZSA9IGNoYW5nZXNbJ21vZGVsJ107XG5cbiAgaWYgKGNoYW5nZS5pc0ZpcnN0Q2hhbmdlKCkpIHJldHVybiB0cnVlO1xuICByZXR1cm4gIU9iamVjdC5pcyh2aWV3TW9kZWwsIGNoYW5nZS5jdXJyZW50VmFsdWUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNCdWlsdEluQWNjZXNzb3IodmFsdWVBY2Nlc3NvcjogQ29udHJvbFZhbHVlQWNjZXNzb3IpOiBib29sZWFuIHtcbiAgLy8gQ2hlY2sgaWYgYSBnaXZlbiB2YWx1ZSBhY2Nlc3NvciBpcyBhbiBpbnN0YW5jZSBvZiBhIGNsYXNzIHRoYXQgZGlyZWN0bHkgZXh0ZW5kc1xuICAvLyBgQnVpbHRJbkNvbnRyb2xWYWx1ZUFjY2Vzc29yYCBvbmUuXG4gIHJldHVybiBPYmplY3QuZ2V0UHJvdG90eXBlT2YodmFsdWVBY2Nlc3Nvci5jb25zdHJ1Y3RvcikgPT09IEJ1aWx0SW5Db250cm9sVmFsdWVBY2Nlc3Nvcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN5bmNQZW5kaW5nQ29udHJvbHMoZm9ybTogRm9ybUdyb3VwLCBkaXJlY3RpdmVzOiBTZXQ8TmdDb250cm9sPnxOZ0NvbnRyb2xbXSk6IHZvaWQge1xuICBmb3JtLl9zeW5jUGVuZGluZ0NvbnRyb2xzKCk7XG4gIGRpcmVjdGl2ZXMuZm9yRWFjaCgoZGlyOiBOZ0NvbnRyb2wpID0+IHtcbiAgICBjb25zdCBjb250cm9sID0gZGlyLmNvbnRyb2wgYXMgRm9ybUNvbnRyb2w7XG4gICAgaWYgKGNvbnRyb2wudXBkYXRlT24gPT09ICdzdWJtaXQnICYmIGNvbnRyb2wuX3BlbmRpbmdDaGFuZ2UpIHtcbiAgICAgIGRpci52aWV3VG9Nb2RlbFVwZGF0ZShjb250cm9sLl9wZW5kaW5nVmFsdWUpO1xuICAgICAgY29udHJvbC5fcGVuZGluZ0NoYW5nZSA9IGZhbHNlO1xuICAgIH1cbiAgfSk7XG59XG5cbi8vIFRPRE86IHZzYXZraW4gcmVtb3ZlIGl0IG9uY2UgaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9pc3N1ZXMvMzAxMSBpcyBpbXBsZW1lbnRlZFxuZXhwb3J0IGZ1bmN0aW9uIHNlbGVjdFZhbHVlQWNjZXNzb3IoXG4gICAgZGlyOiBOZ0NvbnRyb2wsIHZhbHVlQWNjZXNzb3JzOiBDb250cm9sVmFsdWVBY2Nlc3NvcltdKTogQ29udHJvbFZhbHVlQWNjZXNzb3J8bnVsbCB7XG4gIGlmICghdmFsdWVBY2Nlc3NvcnMpIHJldHVybiBudWxsO1xuXG4gIGlmICghQXJyYXkuaXNBcnJheSh2YWx1ZUFjY2Vzc29ycykgJiYgKHR5cGVvZiBuZ0Rldk1vZGUgPT09ICd1bmRlZmluZWQnIHx8IG5nRGV2TW9kZSkpXG4gICAgX3Rocm93SW52YWxpZFZhbHVlQWNjZXNzb3JFcnJvcihkaXIpO1xuXG4gIGxldCBkZWZhdWx0QWNjZXNzb3I6IENvbnRyb2xWYWx1ZUFjY2Vzc29yfHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgbGV0IGJ1aWx0aW5BY2Nlc3NvcjogQ29udHJvbFZhbHVlQWNjZXNzb3J8dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICBsZXQgY3VzdG9tQWNjZXNzb3I6IENvbnRyb2xWYWx1ZUFjY2Vzc29yfHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuICB2YWx1ZUFjY2Vzc29ycy5mb3JFYWNoKCh2OiBDb250cm9sVmFsdWVBY2Nlc3NvcikgPT4ge1xuICAgIGlmICh2LmNvbnN0cnVjdG9yID09PSBEZWZhdWx0VmFsdWVBY2Nlc3Nvcikge1xuICAgICAgZGVmYXVsdEFjY2Vzc29yID0gdjtcbiAgICB9IGVsc2UgaWYgKGlzQnVpbHRJbkFjY2Vzc29yKHYpKSB7XG4gICAgICBpZiAoYnVpbHRpbkFjY2Vzc29yICYmICh0eXBlb2YgbmdEZXZNb2RlID09PSAndW5kZWZpbmVkJyB8fCBuZ0Rldk1vZGUpKVxuICAgICAgICBfdGhyb3dFcnJvcihkaXIsICdNb3JlIHRoYW4gb25lIGJ1aWx0LWluIHZhbHVlIGFjY2Vzc29yIG1hdGNoZXMgZm9ybSBjb250cm9sIHdpdGgnKTtcbiAgICAgIGJ1aWx0aW5BY2Nlc3NvciA9IHY7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChjdXN0b21BY2Nlc3NvciAmJiAodHlwZW9mIG5nRGV2TW9kZSA9PT0gJ3VuZGVmaW5lZCcgfHwgbmdEZXZNb2RlKSlcbiAgICAgICAgX3Rocm93RXJyb3IoZGlyLCAnTW9yZSB0aGFuIG9uZSBjdXN0b20gdmFsdWUgYWNjZXNzb3IgbWF0Y2hlcyBmb3JtIGNvbnRyb2wgd2l0aCcpO1xuICAgICAgY3VzdG9tQWNjZXNzb3IgPSB2O1xuICAgIH1cbiAgfSk7XG5cbiAgaWYgKGN1c3RvbUFjY2Vzc29yKSByZXR1cm4gY3VzdG9tQWNjZXNzb3I7XG4gIGlmIChidWlsdGluQWNjZXNzb3IpIHJldHVybiBidWlsdGluQWNjZXNzb3I7XG4gIGlmIChkZWZhdWx0QWNjZXNzb3IpIHJldHVybiBkZWZhdWx0QWNjZXNzb3I7XG5cbiAgaWYgKHR5cGVvZiBuZ0Rldk1vZGUgPT09ICd1bmRlZmluZWQnIHx8IG5nRGV2TW9kZSkge1xuICAgIF90aHJvd0Vycm9yKGRpciwgJ05vIHZhbGlkIHZhbHVlIGFjY2Vzc29yIGZvciBmb3JtIGNvbnRyb2wgd2l0aCcpO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlTGlzdEl0ZW08VD4obGlzdDogVFtdLCBlbDogVCk6IHZvaWQge1xuICBjb25zdCBpbmRleCA9IGxpc3QuaW5kZXhPZihlbCk7XG4gIGlmIChpbmRleCA+IC0xKSBsaXN0LnNwbGljZShpbmRleCwgMSk7XG59XG5cbi8vIFRPRE8oa2FyYSk6IHJlbW92ZSBhZnRlciBkZXByZWNhdGlvbiBwZXJpb2RcbmV4cG9ydCBmdW5jdGlvbiBfbmdNb2RlbFdhcm5pbmcoXG4gICAgbmFtZTogc3RyaW5nLCB0eXBlOiB7X25nTW9kZWxXYXJuaW5nU2VudE9uY2U6IGJvb2xlYW59LFxuICAgIGluc3RhbmNlOiB7X25nTW9kZWxXYXJuaW5nU2VudDogYm9vbGVhbn0sIHdhcm5pbmdDb25maWc6IHN0cmluZ3xudWxsKSB7XG4gIGlmICh3YXJuaW5nQ29uZmlnID09PSAnbmV2ZXInKSByZXR1cm47XG5cbiAgaWYgKCgod2FybmluZ0NvbmZpZyA9PT0gbnVsbCB8fCB3YXJuaW5nQ29uZmlnID09PSAnb25jZScpICYmICF0eXBlLl9uZ01vZGVsV2FybmluZ1NlbnRPbmNlKSB8fFxuICAgICAgKHdhcm5pbmdDb25maWcgPT09ICdhbHdheXMnICYmICFpbnN0YW5jZS5fbmdNb2RlbFdhcm5pbmdTZW50KSkge1xuICAgIGNvbnNvbGUud2FybihuZ01vZGVsV2FybmluZyhuYW1lKSk7XG4gICAgdHlwZS5fbmdNb2RlbFdhcm5pbmdTZW50T25jZSA9IHRydWU7XG4gICAgaW5zdGFuY2UuX25nTW9kZWxXYXJuaW5nU2VudCA9IHRydWU7XG4gIH1cbn1cbiJdfQ==
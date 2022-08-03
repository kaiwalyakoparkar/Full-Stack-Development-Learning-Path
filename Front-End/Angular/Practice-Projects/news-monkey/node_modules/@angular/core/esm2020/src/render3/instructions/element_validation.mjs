/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { formatRuntimeError, RuntimeError } from '../../errors';
import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '../../metadata/schema';
import { throwError } from '../../util/assert';
import { getComponentDef } from '../definition';
import { CONTEXT, DECLARATION_COMPONENT_VIEW } from '../interfaces/view';
import { isAnimationProp } from '../util/attrs_utils';
let shouldThrowErrorOnUnknownElement = false;
/**
 * Sets a strict mode for JIT-compiled components to throw an error on unknown elements,
 * instead of just logging the error.
 * (for AOT-compiled ones this check happens at build time).
 */
export function ɵsetUnknownElementStrictMode(shouldThrow) {
    shouldThrowErrorOnUnknownElement = shouldThrow;
}
/**
 * Gets the current value of the strict mode.
 */
export function ɵgetUnknownElementStrictMode() {
    return shouldThrowErrorOnUnknownElement;
}
let shouldThrowErrorOnUnknownProperty = false;
/**
 * Sets a strict mode for JIT-compiled components to throw an error on unknown properties,
 * instead of just logging the error.
 * (for AOT-compiled ones this check happens at build time).
 */
export function ɵsetUnknownPropertyStrictMode(shouldThrow) {
    shouldThrowErrorOnUnknownProperty = shouldThrow;
}
/**
 * Gets the current value of the strict mode.
 */
export function ɵgetUnknownPropertyStrictMode() {
    return shouldThrowErrorOnUnknownProperty;
}
/**
 * Validates that the element is known at runtime and produces
 * an error if it's not the case.
 * This check is relevant for JIT-compiled components (for AOT-compiled
 * ones this check happens at build time).
 *
 * The element is considered known if either:
 * - it's a known HTML element
 * - it's a known custom element
 * - the element matches any directive
 * - the element is allowed by one of the schemas
 *
 * @param element Element to validate
 * @param lView An `LView` that represents a current component that is being rendered
 * @param tagName Name of the tag to check
 * @param schemas Array of schemas
 * @param hasDirectives Boolean indicating that the element matches any directive
 */
export function validateElementIsKnown(element, lView, tagName, schemas, hasDirectives) {
    // If `schemas` is set to `null`, that's an indication that this Component was compiled in AOT
    // mode where this check happens at compile time. In JIT mode, `schemas` is always present and
    // defined as an array (as an empty array in case `schemas` field is not defined) and we should
    // execute the check below.
    if (schemas === null)
        return;
    // If the element matches any directive, it's considered as valid.
    if (!hasDirectives && tagName !== null) {
        // The element is unknown if it's an instance of HTMLUnknownElement, or it isn't registered
        // as a custom element. Note that unknown elements with a dash in their name won't be instances
        // of HTMLUnknownElement in browsers that support web components.
        const isUnknown = 
        // Note that we can't check for `typeof HTMLUnknownElement === 'function'`,
        // because while most browsers return 'function', IE returns 'object'.
        (typeof HTMLUnknownElement !== 'undefined' && HTMLUnknownElement &&
            element instanceof HTMLUnknownElement) ||
            (typeof customElements !== 'undefined' && tagName.indexOf('-') > -1 &&
                !customElements.get(tagName));
        if (isUnknown && !matchingSchemas(schemas, tagName)) {
            const isHostStandalone = isHostComponentStandalone(lView);
            const templateLocation = getTemplateLocationDetails(lView);
            const schemas = `'${isHostStandalone ? '@Component' : '@NgModule'}.schemas'`;
            let message = `'${tagName}' is not a known element${templateLocation}:\n`;
            message += `1. If '${tagName}' is an Angular component, then verify that it is ${isHostStandalone ? 'included in the \'@Component.imports\' of this component' :
                'a part of an @NgModule where this component is declared'}.\n`;
            if (tagName && tagName.indexOf('-') > -1) {
                message +=
                    `2. If '${tagName}' is a Web Component then add 'CUSTOM_ELEMENTS_SCHEMA' to the ${schemas} of this component to suppress this message.`;
            }
            else {
                message +=
                    `2. To allow any element add 'NO_ERRORS_SCHEMA' to the ${schemas} of this component.`;
            }
            if (shouldThrowErrorOnUnknownElement) {
                throw new RuntimeError(304 /* RuntimeErrorCode.UNKNOWN_ELEMENT */, message);
            }
            else {
                console.error(formatRuntimeError(304 /* RuntimeErrorCode.UNKNOWN_ELEMENT */, message));
            }
        }
    }
}
/**
 * Validates that the property of the element is known at runtime and returns
 * false if it's not the case.
 * This check is relevant for JIT-compiled components (for AOT-compiled
 * ones this check happens at build time).
 *
 * The property is considered known if either:
 * - it's a known property of the element
 * - the element is allowed by one of the schemas
 * - the property is used for animations
 *
 * @param element Element to validate
 * @param propName Name of the property to check
 * @param tagName Name of the tag hosting the property
 * @param schemas Array of schemas
 */
export function isPropertyValid(element, propName, tagName, schemas) {
    // If `schemas` is set to `null`, that's an indication that this Component was compiled in AOT
    // mode where this check happens at compile time. In JIT mode, `schemas` is always present and
    // defined as an array (as an empty array in case `schemas` field is not defined) and we should
    // execute the check below.
    if (schemas === null)
        return true;
    // The property is considered valid if the element matches the schema, it exists on the element,
    // or it is synthetic, and we are in a browser context (web worker nodes should be skipped).
    if (matchingSchemas(schemas, tagName) || propName in element || isAnimationProp(propName)) {
        return true;
    }
    // Note: `typeof Node` returns 'function' in most browsers, but on IE it is 'object' so we
    // need to account for both here, while being careful with `typeof null` also returning 'object'.
    return typeof Node === 'undefined' || Node === null || !(element instanceof Node);
}
/**
 * Logs or throws an error that a property is not supported on an element.
 *
 * @param propName Name of the invalid property
 * @param tagName Name of the tag hosting the property
 * @param nodeType Type of the node hosting the property
 * @param lView An `LView` that represents a current component
 */
export function handleUnknownPropertyError(propName, tagName, nodeType, lView) {
    // Special-case a situation when a structural directive is applied to
    // an `<ng-template>` element, for example: `<ng-template *ngIf="true">`.
    // In this case the compiler generates the `ɵɵtemplate` instruction with
    // the `null` as the tagName. The directive matching logic at runtime relies
    // on this effect (see `isInlineTemplate`), thus using the 'ng-template' as
    // a default value of the `tNode.value` is not feasible at this moment.
    if (!tagName && nodeType === 4 /* TNodeType.Container */) {
        tagName = 'ng-template';
    }
    const isHostStandalone = isHostComponentStandalone(lView);
    const templateLocation = getTemplateLocationDetails(lView);
    let message = `Can't bind to '${propName}' since it isn't a known property of '${tagName}'${templateLocation}.`;
    const schemas = `'${isHostStandalone ? '@Component' : '@NgModule'}.schemas'`;
    const importLocation = isHostStandalone ?
        'included in the \'@Component.imports\' of this component' :
        'a part of an @NgModule where this component is declared';
    if (KNOWN_CONTROL_FLOW_DIRECTIVES.has(propName)) {
        // Most likely this is a control flow directive (such as `*ngIf`) used in
        // a template, but the `CommonModule` is not imported.
        message += `\nIf the '${propName}' is an Angular control flow directive, ` +
            `please make sure that the 'CommonModule' is ${importLocation}.`;
    }
    else {
        // May be an Angular component, which is not imported/declared?
        message += `\n1. If '${tagName}' is an Angular component and it has the ` +
            `'${propName}' input, then verify that it is ${importLocation}.`;
        // May be a Web Component?
        if (tagName && tagName.indexOf('-') > -1) {
            message += `\n2. If '${tagName}' is a Web Component then add 'CUSTOM_ELEMENTS_SCHEMA' ` +
                `to the ${schemas} of this component to suppress this message.`;
            message += `\n3. To allow any property add 'NO_ERRORS_SCHEMA' to ` +
                `the ${schemas} of this component.`;
        }
        else {
            // If it's expected, the error can be suppressed by the `NO_ERRORS_SCHEMA` schema.
            message += `\n2. To allow any property add 'NO_ERRORS_SCHEMA' to ` +
                `the ${schemas} of this component.`;
        }
    }
    reportUnknownPropertyError(message);
}
export function reportUnknownPropertyError(message) {
    if (shouldThrowErrorOnUnknownProperty) {
        throw new RuntimeError(303 /* RuntimeErrorCode.UNKNOWN_BINDING */, message);
    }
    else {
        console.error(formatRuntimeError(303 /* RuntimeErrorCode.UNKNOWN_BINDING */, message));
    }
}
/**
 * WARNING: this is a **dev-mode only** function (thus should always be guarded by the `ngDevMode`)
 * and must **not** be used in production bundles. The function makes megamorphic reads, which might
 * be too slow for production mode and also it relies on the constructor function being available.
 *
 * Gets a reference to the host component def (where a current component is declared).
 *
 * @param lView An `LView` that represents a current component that is being rendered.
 */
function getDeclarationComponentDef(lView) {
    !ngDevMode && throwError('Must never be called in production mode');
    const declarationLView = lView[DECLARATION_COMPONENT_VIEW];
    const context = declarationLView[CONTEXT];
    // Unable to obtain a context.
    if (!context)
        return null;
    return context.constructor ? getComponentDef(context.constructor) : null;
}
/**
 * WARNING: this is a **dev-mode only** function (thus should always be guarded by the `ngDevMode`)
 * and must **not** be used in production bundles. The function makes megamorphic reads, which might
 * be too slow for production mode.
 *
 * Checks if the current component is declared inside of a standalone component template.
 *
 * @param lView An `LView` that represents a current component that is being rendered.
 */
export function isHostComponentStandalone(lView) {
    !ngDevMode && throwError('Must never be called in production mode');
    const componentDef = getDeclarationComponentDef(lView);
    // Treat host component as non-standalone if we can't obtain the def.
    return !!componentDef?.standalone;
}
/**
 * WARNING: this is a **dev-mode only** function (thus should always be guarded by the `ngDevMode`)
 * and must **not** be used in production bundles. The function makes megamorphic reads, which might
 * be too slow for production mode.
 *
 * Constructs a string describing the location of the host component template. The function is used
 * in dev mode to produce error messages.
 *
 * @param lView An `LView` that represents a current component that is being rendered.
 */
function getTemplateLocationDetails(lView) {
    !ngDevMode && throwError('Must never be called in production mode');
    const hostComponentDef = getDeclarationComponentDef(lView);
    const componentClassName = hostComponentDef?.type?.name;
    return componentClassName ? ` (used in the '${componentClassName}' component template)` : '';
}
/**
 * The set of known control flow directives.
 * We use this set to produce a more precises error message with a note
 * that the `CommonModule` should also be included.
 */
export const KNOWN_CONTROL_FLOW_DIRECTIVES = new Set(['ngIf', 'ngFor', 'ngSwitch', 'ngSwitchCase', 'ngSwitchDefault']);
/**
 * Returns true if the tag name is allowed by specified schemas.
 * @param schemas Array of schemas
 * @param tagName Name of the tag
 */
export function matchingSchemas(schemas, tagName) {
    if (schemas !== null) {
        for (let i = 0; i < schemas.length; i++) {
            const schema = schemas[i];
            if (schema === NO_ERRORS_SCHEMA ||
                schema === CUSTOM_ELEMENTS_SCHEMA && tagName && tagName.indexOf('-') > -1) {
                return true;
            }
        }
    }
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWxlbWVudF92YWxpZGF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvcmVuZGVyMy9pbnN0cnVjdGlvbnMvZWxlbWVudF92YWxpZGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxrQkFBa0IsRUFBRSxZQUFZLEVBQW1CLE1BQU0sY0FBYyxDQUFDO0FBRWhGLE9BQU8sRUFBQyxzQkFBc0IsRUFBRSxnQkFBZ0IsRUFBaUIsTUFBTSx1QkFBdUIsQ0FBQztBQUMvRixPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDN0MsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUk5QyxPQUFPLEVBQUMsT0FBTyxFQUFFLDBCQUEwQixFQUFRLE1BQU0sb0JBQW9CLENBQUM7QUFDOUUsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBRXBELElBQUksZ0NBQWdDLEdBQUcsS0FBSyxDQUFDO0FBRTdDOzs7O0dBSUc7QUFDSCxNQUFNLFVBQVUsNEJBQTRCLENBQUMsV0FBb0I7SUFDL0QsZ0NBQWdDLEdBQUcsV0FBVyxDQUFDO0FBQ2pELENBQUM7QUFFRDs7R0FFRztBQUNILE1BQU0sVUFBVSw0QkFBNEI7SUFDMUMsT0FBTyxnQ0FBZ0MsQ0FBQztBQUMxQyxDQUFDO0FBRUQsSUFBSSxpQ0FBaUMsR0FBRyxLQUFLLENBQUM7QUFFOUM7Ozs7R0FJRztBQUNILE1BQU0sVUFBVSw2QkFBNkIsQ0FBQyxXQUFvQjtJQUNoRSxpQ0FBaUMsR0FBRyxXQUFXLENBQUM7QUFDbEQsQ0FBQztBQUVEOztHQUVHO0FBQ0gsTUFBTSxVQUFVLDZCQUE2QjtJQUMzQyxPQUFPLGlDQUFpQyxDQUFDO0FBQzNDLENBQUM7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FpQkc7QUFDSCxNQUFNLFVB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QUMsS0FBWTtJQUM5QyxDQUFDLFNBQVMsSUFBSSxVQUFVLENBQUMseUNBQXlDLENBQUMsQ0FBQztJQUVwRSxNQUFNLGdCQUFnQixHQUFHLDBCQUEwQixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzNELE1BQU0sa0JBQWtCLEdBQUcsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztJQUN4RCxPQUFPLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxrQkFBa0Isa0JBQWtCLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFDL0YsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSCxNQUFNLENBQUMsTUFBTSw2QkFBNkIsR0FDdEMsSUFBSSxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO0FBRTlFOzs7O0dBSUc7QUFDSCxNQUFNLFVBQVUsZUFBZSxDQUFDLE9BQThCLEVBQUUsT0FBb0I7SUFDbEYsSUFBSSxPQUFPLEtBQUssSUFBSSxFQUFFO1FBQ3BCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ3ZDLE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMxQixJQUFJLE1BQU0sS0FBSyxnQkFBZ0I7Z0JBQzNCLE1BQU0sS0FBSyxzQkFBc0IsSUFBSSxPQUFPLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRTtnQkFDN0UsT0FBTyxJQUFJLENBQUM7YUFDYjtTQUNGO0tBQ0Y7SUFFRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtmb3JtYXRSdW50aW1lRXJyb3IsIFJ1bnRpbWVFcnJvciwgUnVudGltZUVycm9yQ29kZX0gZnJvbSAnLi4vLi4vZXJyb3JzJztcbmltcG9ydCB7VHlwZX0gZnJvbSAnLi4vLi4vaW50ZXJmYWNlL3R5cGUnO1xuaW1wb3J0IHtDVVNUT01fRUxFTUVOVFNfU0NIRU1BLCBOT19FUlJPUlNfU0NIRU1BLCBTY2hlbWFNZXRhZGF0YX0gZnJvbSAnLi4vLi4vbWV0YWRhdGEvc2NoZW1hJztcbmltcG9ydCB7dGhyb3dFcnJvcn0gZnJvbSAnLi4vLi4vdXRpbC9hc3NlcnQnO1xuaW1wb3J0IHtnZXRDb21wb25lbnREZWZ9IGZyb20gJy4uL2RlZmluaXRpb24nO1xuaW1wb3J0IHtDb21wb25lbnREZWZ9IGZyb20gJy4uL2ludGVyZmFjZXMvZGVmaW5pdGlvbic7XG5pbXBvcnQge1ROb2RlVHlwZX0gZnJvbSAnLi4vaW50ZXJmYWNlcy9ub2RlJztcbmltcG9ydCB7UkNvbW1lbnQsIFJFbGVtZW50fSBmcm9tICcuLi9pbnRlcmZhY2VzL3JlbmRlcmVyX2RvbSc7XG5pbXBvcnQge0NPTlRFWFQsIERFQ0xBUkFUSU9OX0NPTVBPTkVOVF9WSUVXLCBMVmlld30gZnJvbSAnLi4vaW50ZXJmYWNlcy92aWV3JztcbmltcG9ydCB7aXNBbmltYXRpb25Qcm9wfSBmcm9tICcuLi91dGlsL2F0dHJzX3V0aWxzJztcblxubGV0IHNob3VsZFRocm93RXJyb3JPblVua25vd25FbGVtZW50ID0gZmFsc2U7XG5cbi8qKlxuICogU2V0cyBhIHN0cmljdCBtb2RlIGZvciBKSVQtY29tcGlsZWQgY29tcG9uZW50cyB0byB0aHJvdyBhbiBlcnJvciBvbiB1bmtub3duIGVsZW1lbnRzLFxuICogaW5zdGVhZCBvZiBqdXN0IGxvZ2dpbmcgdGhlIGVycm9yLlxuICogKGZvciBBT1QtY29tcGlsZWQgb25lcyB0aGlzIGNoZWNrIGhhcHBlbnMgYXQgYnVpbGQgdGltZSkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiDJtXNldFVua25vd25FbGVtZW50U3RyaWN0TW9kZShzaG91bGRUaHJvdzogYm9vbGVhbikge1xuICBzaG91bGRUaHJvd0Vycm9yT25Vbmtub3duRWxlbWVudCA9IHNob3VsZFRocm93O1xufVxuXG4vKipcbiAqIEdldHMgdGhlIGN1cnJlbnQgdmFsdWUgb2YgdGhlIHN0cmljdCBtb2RlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gybVnZXRVbmtub3duRWxlbWVudFN0cmljdE1vZGUoKSB7XG4gIHJldHVybiBzaG91bGRUaHJvd0Vycm9yT25Vbmtub3duRWxlbWVudDtcbn1cblxubGV0IHNob3VsZFRocm93RXJyb3JPblVua25vd25Qcm9wZXJ0eSA9IGZhbHNlO1xuXG4vKipcbiAqIFNldHMgYSBzdHJpY3QgbW9kZSBmb3IgSklULWNvbXBpbGVkIGNvbXBvbmVudHMgdG8gdGhyb3cgYW4gZXJyb3Igb24gdW5rbm93biBwcm9wZXJ0aWVzLFxuICogaW5zdGVhZCBvZiBqdXN0IGxvZ2dpbmcgdGhlIGVycm9yLlxuICogKGZvciBBT1QtY29tcGlsZWQgb25lcyB0aGlzIGNoZWNrIGhhcHBlbnMgYXQgYnVpbGQgdGltZSkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiDJtXNldFVua25vd25Qcm9wZXJ0eVN0cmljdE1vZGUoc2hvdWxkVGhyb3c6IGJvb2xlYW4pIHtcbiAgc2hvdWxkVGhyb3dFcnJvck9uVW5rbm93blByb3BlcnR5ID0gc2hvdWxkVGhyb3c7XG59XG5cbi8qKlxuICogR2V0cyB0aGUgY3VycmVudCB2YWx1ZSBvZiB0aGUgc3RyaWN0IG1vZGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiDJtWdldFVua25vd25Qcm9wZXJ0eVN0cmljdE1vZGUoKSB7XG4gIHJldHVybiBzaG91bGRUaHJvd0Vycm9yT25Vbmtub3duUHJvcGVydHk7XG59XG5cbi8qKlxuICogVmFsaWRhdGVzIHRoYXQgdGhlIGVsZW1lbnQgaXMga25vd24gYXQgcnVudGltZSBhbmQgcHJvZHVjZXNcbiAqIGFuIGVycm9yIGlmIGl0J3Mgbm90IHRoZSBjYXNlLlxuICogVGhpcyBjaGVjayBpcyByZWxldmFudCBmb3IgSklULWNvbXBpbGVkIGNvbXBvbmVudHMgKGZvciBBT1QtY29tcGlsZWRcbiAqIG9uZXMgdGhpcyBjaGVjayBoYXBwZW5zIGF0IGJ1aWxkIHRpbWUpLlxuICpcbiAqIFRoZSBlbGVtZW50IGlzIGNvbnNpZGVyZWQga25vd24gaWYgZWl0aGVyOlxuICogLSBpdCdzIGEga25vd24gSFRNTCBlbGVtZW50XG4gKiAtIGl0J3MgYSBrbm93biBjdXN0b20gZWxlbWVudFxuICogLSB0aGUgZWxlbWVudCBtYXRjaGVzIGFueSBkaXJlY3RpdmVcbiAqIC0gdGhlIGVsZW1lbnQgaXMgYWxsb3dlZCBieSBvbmUgb2YgdGhlIHNjaGVtYXNcbiAqXG4gKiBAcGFyYW0gZWxlbWVudCBFbGVtZW50IHRvIHZhbGlkYXRlXG4gKiBAcGFyYW0gbFZpZXcgQW4gYExWaWV3YCB0aGF0IHJlcHJlc2VudHMgYSBjdXJyZW50IGNvbXBvbmVudCB0aGF0IGlzIGJlaW5nIHJlbmRlcmVkXG4gKiBAcGFyYW0gdGFnTmFtZSBOYW1lIG9mIHRoZSB0YWcgdG8gY2hlY2tcbiAqIEBwYXJhbSBzY2hlbWFzIEFycmF5IG9mIHNjaGVtYXNcbiAqIEBwYXJhbSBoYXNEaXJlY3RpdmVzIEJvb2xlYW4gaW5kaWNhdGluZyB0aGF0IHRoZSBlbGVtZW50IG1hdGNoZXMgYW55IGRpcmVjdGl2ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVFbGVtZW50SXNLbm93bihcbiAgICBlbGVtZW50OiBSRWxlbWVudCwgbFZpZXc6IExWaWV3LCB0YWdOYW1lOiBzdHJpbmd8bnVsbCwgc2NoZW1hczogU2NoZW1hTWV0YWRhdGFbXXxudWxsLFxuICAgIGhhc0RpcmVjdGl2ZXM6IGJvb2xlYW4pOiB2b2lkIHtcbiAgLy8gSWYgYHNjaGVtYXNgIGlzIHNldCB0byBgbnVsbGAsIHRoYXQncyBhbiBpbmRpY2F0aW9uIHRoYXQgdGhpcyBDb21wb25lbnQgd2FzIGNvbXBpbGVkIGluIEFPVFxuICAvLyBtb2RlIHdoZXJlIHRoaXMgY2hlY2sgaGFwcGVucyBhdCBjb21waWxlIHRpbWUuIEluIEpJVCBtb2RlLCBgc2NoZW1hc2AgaXMgYWx3YXlzIHByZXNlbnQgYW5kXG4gIC8vIGRlZmluZWQgYXMgYW4gYXJyYXkgKGFzIGFuIGVtcHR5IGFycmF5IGluIGNhc2UgYHNjaGVtYXNgIGZpZWxkIGlzIG5vdCBkZWZpbmVkKSBhbmQgd2Ugc2hvdWxkXG4gIC8vIGV4ZWN1dGUgdGhlIGNoZWNrIGJlbG93LlxuICBpZiAoc2NoZW1hcyA9PT0gbnVsbCkgcmV0dXJuO1xuXG4gIC8vIElmIHRoZSBlbGVtZW50IG1hdGNoZXMgYW55IGRpcmVjdGl2ZSwgaXQncyBjb25zaWRlcmVkIGFzIHZhbGlkLlxuICBpZiAoIWhhc0RpcmVjdGl2ZXMgJiYgdGFnTmFtZSAhPT0gbnVsbCkge1xuICAgIC8vIFRoZSBlbGVtZW50IGlzIHVua25vd24gaWYgaXQncyBhbiBpbnN0YW5jZSBvZiBIVE1MVW5rbm93bkVsZW1lbnQsIG9yIGl0IGlzbid0IHJlZ2lzdGVyZWRcbiAgICAvLyBhcyBhIGN1c3RvbSBlbGVtZW50LiBOb3RlIHRoYXQgdW5rbm93biBlbGVtZW50cyB3aXRoIGEgZGFzaCBpbiB0aGVpciBuYW1lIHdvbid0IGJlIGluc3RhbmNlc1xuICAgIC8vIG9mIEhUTUxVbmtub3duRWxlbWVudCBpbiBicm93c2VycyB0aGF0IHN1cHBvcnQgd2ViIGNvbXBvbmVudHMuXG4gICAgY29uc3QgaXNVbmtub3duID1cbiAgICAgICAgLy8gTm90ZSB0aGF0IHdlIGNhbid0IGNoZWNrIGZvciBgdHlwZW9mIEhUTUxVbmtub3duRWxlbWVudCA9PT0gJ2Z1bmN0aW9uJ2AsXG4gICAgICAgIC8vIGJlY2F1c2Ugd2hpbGUgbW9zdCBicm93c2VycyByZXR1cm4gJ2Z1bmN0aW9uJywgSUUgcmV0dXJucyAnb2JqZWN0Jy5cbiAgICAgICAgKHR5cGVvZiBIVE1MVW5rbm93bkVsZW1lbnQgIT09ICd1bmRlZmluZWQnICYmIEhUTUxVbmtub3duRWxlbWVudCAmJlxuICAgICAgICAgZWxlbWVudCBpbnN0YW5jZW9mIEhUTUxVbmtub3duRWxlbWVudCkgfHxcbiAgICAgICAgKHR5cGVvZiBjdXN0b21FbGVtZW50cyAhPT0gJ3VuZGVmaW5lZCcgJiYgdGFnTmFtZS5pbmRleE9mKCctJykgPiAtMSAmJlxuICAgICAgICAgIWN1c3RvbUVsZW1lbnRzLmdldCh0YWdOYW1lKSk7XG5cbiAgICBpZiAoaXNVbmtub3duICYmICFtYXRjaGluZ1NjaGVtYXMoc2NoZW1hcywgdGFnTmFtZSkpIHtcbiAgICAgIGNvbnN0IGlzSG9zdFN0YW5kYWxvbmUgPSBpc0hvc3RDb21wb25lbnRTdGFuZGFsb25lKGxWaWV3KTtcbiAgICAgIGNvbnN0IHRlbXBsYXRlTG9jYXRpb24gPSBnZXRUZW1wbGF0ZUxvY2F0aW9uRGV0YWlscyhsVmlldyk7XG4gICAgICBjb25zdCBzY2hlbWFzID0gYCcke2lzSG9zdFN0YW5kYWxvbmUgPyAnQENvbXBvbmVudCcgOiAnQE5nTW9kdWxlJ30uc2NoZW1hcydgO1xuXG4gICAgICBsZXQgbWVzc2FnZSA9IGAnJHt0YWdOYW1lfScgaXMgbm90IGEga25vd24gZWxlbWVudCR7dGVtcGxhdGVMb2NhdGlvbn06XFxuYDtcbiAgICAgIG1lc3NhZ2UgKz0gYDEuIElmICcke3RhZ05hbWV9JyBpcyBhbiBBbmd1bGFyIGNvbXBvbmVudCwgdGhlbiB2ZXJpZnkgdGhhdCBpdCBpcyAke1xuICAgICAgICAgIGlzSG9zdFN0YW5kYWxvbmUgPyAnaW5jbHVkZWQgaW4gdGhlIFxcJ0BDb21wb25lbnQuaW1wb3J0c1xcJyBvZiB0aGlzIGNvbXBvbmVudCcgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnYSBwYXJ0IG9mIGFuIEBOZ01vZHVsZSB3aGVyZSB0aGlzIGNvbXBvbmVudCBpcyBkZWNsYXJlZCd9LlxcbmA7XG4gICAgICBpZiAodGFnTmFtZSAmJiB0YWdOYW1lLmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICAgIG1lc3NhZ2UgKz1cbiAgICAgICAgICAgIGAyLiBJZiAnJHt0YWdOYW1lfScgaXMgYSBXZWIgQ29tcG9uZW50IHRoZW4gYWRkICdDVVNUT01fRUxFTUVOVFNfU0NIRU1BJyB0byB0aGUgJHtcbiAgICAgICAgICAgICAgICBzY2hlbWFzfSBvZiB0aGlzIGNvbXBvbmVudCB0byBzdXBwcmVzcyB0aGlzIG1lc3NhZ2UuYDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1lc3NhZ2UgKz1cbiAgICAgICAgICAgIGAyLiBUbyBhbGxvdyBhbnkgZWxlbWVudCBhZGQgJ05PX0VSUk9SU19TQ0hFTUEnIHRvIHRoZSAke3NjaGVtYXN9IG9mIHRoaXMgY29tcG9uZW50LmA7XG4gICAgICB9XG4gICAgICBpZiAoc2hvdWxkVGhyb3dFcnJvck9uVW5rbm93bkVsZW1lbnQpIHtcbiAgICAgICAgdGhyb3cgbmV3IFJ1bnRpbWVFcnJvcihSdW50aW1lRXJyb3JDb2RlLlVOS05PV05fRUxFTUVOVCwgbWVzc2FnZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmVycm9yKGZvcm1hdFJ1bnRpbWVFcnJvcihSdW50aW1lRXJyb3JDb2RlLlVOS05PV05fRUxFTUVOVCwgbWVzc2FnZSkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFZhbGlkYXRlcyB0aGF0IHRoZSBwcm9wZXJ0eSBvZiB0aGUgZWxlbWVudCBpcyBrbm93biBhdCBydW50aW1lIGFuZCByZXR1cm5zXG4gKiBmYWxzZSBpZiBpdCdzIG5vdCB0aGUgY2FzZS5cbiAqIFRoaXMgY2hlY2sgaXMgcmVsZXZhbnQgZm9yIEpJVC1jb21waWxlZCBjb21wb25lbnRzIChmb3IgQU9ULWNvbXBpbGVkXG4gKiBvbmVzIHRoaXMgY2hlY2sgaGFwcGVucyBhdCBidWlsZCB0aW1lKS5cbiAqXG4gKiBUaGUgcHJvcGVydHkgaXMgY29uc2lkZXJlZCBrbm93biBpZiBlaXRoZXI6XG4gKiAtIGl0J3MgYSBrbm93biBwcm9wZXJ0eSBvZiB0aGUgZWxlbWVudFxuICogLSB0aGUgZWxlbWVudCBpcyBhbGxvd2VkIGJ5IG9uZSBvZiB0aGUgc2NoZW1hc1xuICogLSB0aGUgcHJvcGVydHkgaXMgdXNlZCBmb3IgYW5pbWF0aW9uc1xuICpcbiAqIEBwYXJhbSBlbGVtZW50IEVsZW1lbnQgdG8gdmFsaWRhdGVcbiAqIEBwYXJhbSBwcm9wTmFtZSBOYW1lIG9mIHRoZSBwcm9wZXJ0eSB0byBjaGVja1xuICogQHBhcmFtIHRhZ05hbWUgTmFtZSBvZiB0aGUgdGFnIGhvc3RpbmcgdGhlIHByb3BlcnR5XG4gKiBAcGFyYW0gc2NoZW1hcyBBcnJheSBvZiBzY2hlbWFzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1Byb3BlcnR5VmFsaWQoXG4gICAgZWxlbWVudDogUkVsZW1lbnR8UkNvbW1lbnQsIHByb3BOYW1lOiBzdHJpbmcsIHRhZ05hbWU6IHN0cmluZ3xudWxsLFxuICAgIHNjaGVtYXM6IFNjaGVtYU1ldGFkYXRhW118bnVsbCk6IGJvb2xlYW4ge1xuICAvLyBJZiBgc2NoZW1hc2AgaXMgc2V0IHRvIGBudWxsYCwgdGhhdCdzIGFuIGluZGljYXRpb24gdGhhdCB0aGlzIENvbXBvbmVudCB3YXMgY29tcGlsZWQgaW4gQU9UXG4gIC8vIG1vZGUgd2hlcmUgdGhpcyBjaGVjayBoYXBwZW5zIGF0IGNvbXBpbGUgdGltZS4gSW4gSklUIG1vZGUsIGBzY2hlbWFzYCBpcyBhbHdheXMgcHJlc2VudCBhbmRcbiAgLy8gZGVmaW5lZCBhcyBhbiBhcnJheSAoYXMgYW4gZW1wdHkgYXJyYXkgaW4gY2FzZSBgc2NoZW1hc2AgZmllbGQgaXMgbm90IGRlZmluZWQpIGFuZCB3ZSBzaG91bGRcbiAgLy8gZXhlY3V0ZSB0aGUgY2hlY2sgYmVsb3cuXG4gIGlmIChzY2hlbWFzID09PSBudWxsKSByZXR1cm4gdHJ1ZTtcblxuICAvLyBUaGUgcHJvcGVydHkgaXMgY29uc2lkZXJlZCB2YWxpZCBpZiB0aGUgZWxlbWVudCBtYXRjaGVzIHRoZSBzY2hlbWEsIGl0IGV4aXN0cyBvbiB0aGUgZWxlbWVudCxcbiAgLy8gb3IgaXQgaXMgc3ludGhldGljLCBhbmQgd2UgYXJlIGluIGEgYnJvd3NlciBjb250ZXh0ICh3ZWIgd29ya2VyIG5vZGVzIHNob3VsZCBiZSBza2lwcGVkKS5cbiAgaWYgKG1hdGNoaW5nU2NoZW1hcyhzY2hlbWFzLCB0YWdOYW1lKSB8fCBwcm9wTmFtZSBpbiBlbGVtZW50IHx8IGlzQW5pbWF0aW9uUHJvcChwcm9wTmFtZSkpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIE5vdGU6IGB0eXBlb2YgTm9kZWAgcmV0dXJucyAnZnVuY3Rpb24nIGluIG1vc3QgYnJvd3NlcnMsIGJ1dCBvbiBJRSBpdCBpcyAnb2JqZWN0JyBzbyB3ZVxuICAvLyBuZWVkIHRvIGFjY291bnQgZm9yIGJvdGggaGVyZSwgd2hpbGUgYmVpbmcgY2FyZWZ1bCB3aXRoIGB0eXBlb2YgbnVsbGAgYWxzbyByZXR1cm5pbmcgJ29iamVjdCcuXG4gIHJldHVybiB0eXBlb2YgTm9kZSA9PT0gJ3VuZGVmaW5lZCcgfHwgTm9kZSA9PT0gbnVsbCB8fCAhKGVsZW1lbnQgaW5zdGFuY2VvZiBOb2RlKTtcbn1cblxuLyoqXG4gKiBMb2dzIG9yIHRocm93cyBhbiBlcnJvciB0aGF0IGEgcHJvcGVydHkgaXMgbm90IHN1cHBvcnRlZCBvbiBhbiBlbGVtZW50LlxuICpcbiAqIEBwYXJhbSBwcm9wTmFtZSBOYW1lIG9mIHRoZSBpbnZhbGlkIHByb3BlcnR5XG4gKiBAcGFyYW0gdGFnTmFtZSBOYW1lIG9mIHRoZSB0YWcgaG9zdGluZyB0aGUgcHJvcGVydHlcbiAqIEBwYXJhbSBub2RlVHlwZSBUeXBlIG9mIHRoZSBub2RlIGhvc3RpbmcgdGhlIHByb3BlcnR5XG4gKiBAcGFyYW0gbFZpZXcgQW4gYExWaWV3YCB0aGF0IHJlcHJlc2VudHMgYSBjdXJyZW50IGNvbXBvbmVudFxuICovXG5leHBvcnQgZnVuY3Rpb24gaGFuZGxlVW5rbm93blByb3BlcnR5RXJyb3IoXG4gICAgcHJvcE5hbWU6IHN0cmluZywgdGFnTmFtZTogc3RyaW5nfG51bGwsIG5vZGVUeXBlOiBUTm9kZVR5cGUsIGxWaWV3OiBMVmlldyk6IHZvaWQge1xuICAvLyBTcGVjaWFsLWNhc2UgYSBzaXR1YXRpb24gd2hlbiBhIHN0cnVjdHVyYWwgZGlyZWN0aXZlIGlzIGFwcGxpZWQgdG9cbiAgLy8gYW4gYDxuZy10ZW1wbGF0ZT5gIGVsZW1lbnQsIGZvciBleGFtcGxlOiBgPG5nLXRlbXBsYXRlICpuZ0lmPVwidHJ1ZVwiPmAuXG4gIC8vIEluIHRoaXMgY2FzZSB0aGUgY29tcGlsZXIgZ2VuZXJhdGVzIHRoZSBgybXJtXRlbXBsYXRlYCBpbnN0cnVjdGlvbiB3aXRoXG4gIC8vIHRoZSBgbnVsbGAgYXMgdGhlIHRhZ05hbWUuIFRoZSBkaXJlY3RpdmUgbWF0Y2hpbmcgbG9naWMgYXQgcnVudGltZSByZWxpZXNcbiAgLy8gb24gdGhpcyBlZmZlY3QgKHNlZSBgaXNJbmxpbmVUZW1wbGF0ZWApLCB0aHVzIHVzaW5nIHRoZSAnbmctdGVtcGxhdGUnIGFzXG4gIC8vIGEgZGVmYXVsdCB2YWx1ZSBvZiB0aGUgYHROb2RlLnZhbHVlYCBpcyBub3QgZmVhc2libGUgYXQgdGhpcyBtb21lbnQuXG4gIGlmICghdGFnTmFtZSAmJiBub2RlVHlwZSA9PT0gVE5vZGVUeXBlLkNvbnRhaW5lcikge1xuICAgIHRhZ05hbWUgPSAnbmctdGVtcGxhdGUnO1xuICB9XG5cbiAgY29uc3QgaXNIb3N0U3RhbmRhbG9uZSA9IGlzSG9zdENvbXBvbmVudFN0YW5kYWxvbmUobFZpZXcpO1xuICBjb25zdCB0ZW1wbGF0ZUxvY2F0aW9uID0gZ2V0VGVtcGxhdGVMb2NhdGlvbkRldGFpbHMobFZpZXcpO1xuXG4gIGxldCBtZXNzYWdlID0gYENhbid0IGJpbmQgdG8gJyR7cHJvcE5hbWV9JyBzaW5jZSBpdCBpc24ndCBhIGtub3duIHByb3BlcnR5IG9mICcke3RhZ05hbWV9JyR7XG4gICAgICB0ZW1wbGF0ZUxvY2F0aW9ufS5gO1xuXG4gIGNvbnN0IHNjaGVtYXMgPSBgJyR7aXNIb3N0U3RhbmRhbG9uZSA/ICdAQ29tcG9uZW50JyA6ICdATmdNb2R1bGUnfS5zY2hlbWFzJ2A7XG4gIGNvbnN0IGltcG9ydExvY2F0aW9uID0gaXNIb3N0U3RhbmRhbG9uZSA/XG4gICAgICAnaW5jbHVkZWQgaW4gdGhlIFxcJ0BDb21wb25lbnQuaW1wb3J0c1xcJyBvZiB0aGlzIGNvbXBvbmVudCcgOlxuICAgICAgJ2EgcGFydCBvZiBhbiBATmdNb2R1bGUgd2hlcmUgdGhpcyBjb21wb25lbnQgaXMgZGVjbGFyZWQnO1xuICBpZiAoS05PV05fQ09OVFJPTF9GTE9XX0RJUkVDVElWRVMuaGFzKHByb3BOYW1lKSkge1xuICAgIC8vIE1vc3QgbGlrZWx5IHRoaXMgaXMgYSBjb250cm9sIGZsb3cgZGlyZWN0aXZlIChzdWNoIGFzIGAqbmdJZmApIHVzZWQgaW5cbiAgICAvLyBhIHRlbXBsYXRlLCBidXQgdGhlIGBDb21tb25Nb2R1bGVgIGlzIG5vdCBpbXBvcnRlZC5cbiAgICBtZXNzYWdlICs9IGBcXG5JZiB0aGUgJyR7cHJvcE5hbWV9JyBpcyBhbiBBbmd1bGFyIGNvbnRyb2wgZmxvdyBkaXJlY3RpdmUsIGAgK1xuICAgICAgICBgcGxlYXNlIG1ha2Ugc3VyZSB0aGF0IHRoZSAnQ29tbW9uTW9kdWxlJyBpcyAke2ltcG9ydExvY2F0aW9ufS5gO1xuICB9IGVsc2Uge1xuICAgIC8vIE1heSBiZSBhbiBBbmd1bGFyIGNvbXBvbmVudCwgd2hpY2ggaXMgbm90IGltcG9ydGVkL2RlY2xhcmVkP1xuICAgIG1lc3NhZ2UgKz0gYFxcbjEuIElmICcke3RhZ05hbWV9JyBpcyBhbiBBbmd1bGFyIGNvbXBvbmVudCBhbmQgaXQgaGFzIHRoZSBgICtcbiAgICAgICAgYCcke3Byb3BOYW1lfScgaW5wdXQsIHRoZW4gdmVyaWZ5IHRoYXQgaXQgaXMgJHtpbXBvcnRMb2NhdGlvbn0uYDtcbiAgICAvLyBNYXkgYmUgYSBXZWIgQ29tcG9uZW50P1xuICAgIGlmICh0YWdOYW1lICYmIHRhZ05hbWUuaW5kZXhPZignLScpID4gLTEpIHtcbiAgICAgIG1lc3NhZ2UgKz0gYFxcbjIuIElmICcke3RhZ05hbWV9JyBpcyBhIFdlYiBDb21wb25lbnQgdGhlbiBhZGQgJ0NVU1RPTV9FTEVNRU5UU19TQ0hFTUEnIGAgK1xuICAgICAgICAgIGB0byB0aGUgJHtzY2hlbWFzfSBvZiB0aGlzIGNvbXBvbmVudCB0byBzdXBwcmVzcyB0aGlzIG1lc3NhZ2UuYDtcbiAgICAgIG1lc3NhZ2UgKz0gYFxcbjMuIFRvIGFsbG93IGFueSBwcm9wZXJ0eSBhZGQgJ05PX0VSUk9SU19TQ0hFTUEnIHRvIGAgK1xuICAgICAgICAgIGB0aGUgJHtzY2hlbWFzfSBvZiB0aGlzIGNvbXBvbmVudC5gO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBJZiBpdCdzIGV4cGVjdGVkLCB0aGUgZXJyb3IgY2FuIGJlIHN1cHByZXNzZWQgYnkgdGhlIGBOT19FUlJPUlNfU0NIRU1BYCBzY2hlbWEuXG4gICAgICBtZXNzYWdlICs9IGBcXG4yLiBUbyBhbGxvdyBhbnkgcHJvcGVydHkgYWRkICdOT19FUlJPUlNfU0NIRU1BJyB0byBgICtcbiAgICAgICAgICBgdGhlICR7c2NoZW1hc30gb2YgdGhpcyBjb21wb25lbnQuYDtcbiAgICB9XG4gIH1cblxuICByZXBvcnRVbmtub3duUHJvcGVydHlFcnJvcihtZXNzYWdlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlcG9ydFVua25vd25Qcm9wZXJ0eUVycm9yKG1lc3NhZ2U6IHN0cmluZykge1xuICBpZiAoc2hvdWxkVGhyb3dFcnJvck9uVW5rbm93blByb3BlcnR5KSB7XG4gICAgdGhyb3cgbmV3IFJ1bnRpbWVFcnJvcihSdW50aW1lRXJyb3JDb2RlLlVOS05PV05fQklORElORywgbWVzc2FnZSk7XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS5lcnJvcihmb3JtYXRSdW50aW1lRXJyb3IoUnVudGltZUVycm9yQ29kZS5VTktOT1dOX0JJTkRJTkcsIG1lc3NhZ2UpKTtcbiAgfVxufVxuXG4vKipcbiAqIFdBUk5JTkc6IHRoaXMgaXMgYSAqKmRldi1tb2RlIG9ubHkqKiBmdW5jdGlvbiAodGh1cyBzaG91bGQgYWx3YXlzIGJlIGd1YXJkZWQgYnkgdGhlIGBuZ0Rldk1vZGVgKVxuICogYW5kIG11c3QgKipub3QqKiBiZSB1c2VkIGluIHByb2R1Y3Rpb24gYnVuZGxlcy4gVGhlIGZ1bmN0aW9uIG1ha2VzIG1lZ2Ftb3JwaGljIHJlYWRzLCB3aGljaCBtaWdodFxuICogYmUgdG9vIHNsb3cgZm9yIHByb2R1Y3Rpb24gbW9kZSBhbmQgYWxzbyBpdCByZWxpZXMgb24gdGhlIGNvbnN0cnVjdG9yIGZ1bmN0aW9uIGJlaW5nIGF2YWlsYWJsZS5cbiAqXG4gKiBHZXRzIGEgcmVmZXJlbmNlIHRvIHRoZSBob3N0IGNvbXBvbmVudCBkZWYgKHdoZXJlIGEgY3VycmVudCBjb21wb25lbnQgaXMgZGVjbGFyZWQpLlxuICpcbiAqIEBwYXJhbSBsVmlldyBBbiBgTFZpZXdgIHRoYXQgcmVwcmVzZW50cyBhIGN1cnJlbnQgY29tcG9uZW50IHRoYXQgaXMgYmVpbmcgcmVuZGVyZWQuXG4gKi9cbmZ1bmN0aW9uIGdldERlY2xhcmF0aW9uQ29tcG9uZW50RGVmKGxWaWV3OiBMVmlldyk6IENvbXBvbmVudERlZjx1bmtub3duPnxudWxsIHtcbiAgIW5nRGV2TW9kZSAmJiB0aHJvd0Vycm9yKCdNdXN0IG5ldmVyIGJlIGNhbGxlZCBpbiBwcm9kdWN0aW9uIG1vZGUnKTtcblxuICBjb25zdCBkZWNsYXJhdGlvbkxWaWV3ID0gbFZpZXdbREVDTEFSQVRJT05fQ09NUE9ORU5UX1ZJRVddIGFzIExWaWV3PFR5cGU8dW5rbm93bj4+O1xuICBjb25zdCBjb250ZXh0ID0gZGVjbGFyYXRpb25MVmlld1tDT05URVhUXTtcblxuICAvLyBVbmFibGUgdG8gb2J0YWluIGEgY29udGV4dC5cbiAgaWYgKCFjb250ZXh0KSByZXR1cm4gbnVsbDtcblxuICByZXR1cm4gY29udGV4dC5jb25zdHJ1Y3RvciA/IGdldENvbXBvbmVudERlZihjb250ZXh0LmNvbnN0cnVjdG9yKSA6IG51bGw7XG59XG5cbi8qKlxuICogV0FSTklORzogdGhpcyBpcyBhICoqZGV2LW1vZGUgb25seSoqIGZ1bmN0aW9uICh0aHVzIHNob3VsZCBhbHdheXMgYmUgZ3VhcmRlZCBieSB0aGUgYG5nRGV2TW9kZWApXG4gKiBhbmQgbXVzdCAqKm5vdCoqIGJlIHVzZWQgaW4gcHJvZHVjdGlvbiBidW5kbGVzLiBUaGUgZnVuY3Rpb24gbWFrZXMgbWVnYW1vcnBoaWMgcmVhZHMsIHdoaWNoIG1pZ2h0XG4gKiBiZSB0b28gc2xvdyBmb3IgcHJvZHVjdGlvbiBtb2RlLlxuICpcbiAqIENoZWNrcyBpZiB0aGUgY3VycmVudCBjb21wb25lbnQgaXMgZGVjbGFyZWQgaW5zaWRlIG9mIGEgc3RhbmRhbG9uZSBjb21wb25lbnQgdGVtcGxhdGUuXG4gKlxuICogQHBhcmFtIGxWaWV3IEFuIGBMVmlld2AgdGhhdCByZXByZXNlbnRzIGEgY3VycmVudCBjb21wb25lbnQgdGhhdCBpcyBiZWluZyByZW5kZXJlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzSG9zdENvbXBvbmVudFN0YW5kYWxvbmUobFZpZXc6IExWaWV3KTogYm9vbGVhbiB7XG4gICFuZ0Rldk1vZGUgJiYgdGhyb3dFcnJvcignTXVzdCBuZXZlciBiZSBjYWxsZWQgaW4gcHJvZHVjdGlvbiBtb2RlJyk7XG5cbiAgY29uc3QgY29tcG9uZW50RGVmID0gZ2V0RGVjbGFyYXRpb25Db21wb25lbnREZWYobFZpZXcpO1xuICAvLyBUcmVhdCBob3N0IGNvbXBvbmVudCBhcyBub24tc3RhbmRhbG9uZSBpZiB3ZSBjYW4ndCBvYnRhaW4gdGhlIGRlZi5cbiAgcmV0dXJuICEhY29tcG9uZW50RGVmPy5zdGFuZGFsb25lO1xufVxuXG4vKipcbiAqIFdBUk5JTkc6IHRoaXMgaXMgYSAqKmRldi1tb2RlIG9ubHkqKiBmdW5jdGlvbiAodGh1cyBzaG91bGQgYWx3YXlzIGJlIGd1YXJkZWQgYnkgdGhlIGBuZ0Rldk1vZGVgKVxuICogYW5kIG11c3QgKipub3QqKiBiZSB1c2VkIGluIHByb2R1Y3Rpb24gYnVuZGxlcy4gVGhlIGZ1bmN0aW9uIG1ha2VzIG1lZ2Ftb3JwaGljIHJlYWRzLCB3aGljaCBtaWdodFxuICogYmUgdG9vIHNsb3cgZm9yIHByb2R1Y3Rpb24gbW9kZS5cbiAqXG4gKiBDb25zdHJ1Y3RzIGEgc3RyaW5nIGRlc2NyaWJpbmcgdGhlIGxvY2F0aW9uIG9mIHRoZSBob3N0IGNvbXBvbmVudCB0ZW1wbGF0ZS4gVGhlIGZ1bmN0aW9uIGlzIHVzZWRcbiAqIGluIGRldiBtb2RlIHRvIHByb2R1Y2UgZXJyb3IgbWVzc2FnZXMuXG4gKlxuICogQHBhcmFtIGxWaWV3IEFuIGBMVmlld2AgdGhhdCByZXByZXNlbnRzIGEgY3VycmVudCBjb21wb25lbnQgdGhhdCBpcyBiZWluZyByZW5kZXJlZC5cbiAqL1xuZnVuY3Rpb24gZ2V0VGVtcGxhdGVMb2NhdGlvbkRldGFpbHMobFZpZXc6IExWaWV3KTogc3RyaW5nIHtcbiAgIW5nRGV2TW9kZSAmJiB0aHJvd0Vycm9yKCdNdXN0IG5ldmVyIGJlIGNhbGxlZCBpbiBwcm9kdWN0aW9uIG1vZGUnKTtcblxuICBjb25zdCBob3N0Q29tcG9uZW50RGVmID0gZ2V0RGVjbGFyYXRpb25Db21wb25lbnREZWYobFZpZXcpO1xuICBjb25zdCBjb21wb25lbnRDbGFzc05hbWUgPSBob3N0Q29tcG9uZW50RGVmPy50eXBlPy5uYW1lO1xuICByZXR1cm4gY29tcG9uZW50Q2xhc3NOYW1lID8gYCAodXNlZCBpbiB0aGUgJyR7Y29tcG9uZW50Q2xhc3NOYW1lfScgY29tcG9uZW50IHRlbXBsYXRlKWAgOiAnJztcbn1cblxuLyoqXG4gKiBUaGUgc2V0IG9mIGtub3duIGNvbnRyb2wgZmxvdyBkaXJlY3RpdmVzLlxuICogV2UgdXNlIHRoaXMgc2V0IHRvIHByb2R1Y2UgYSBtb3JlIHByZWNpc2VzIGVycm9yIG1lc3NhZ2Ugd2l0aCBhIG5vdGVcbiAqIHRoYXQgdGhlIGBDb21tb25Nb2R1bGVgIHNob3VsZCBhbHNvIGJlIGluY2x1ZGVkLlxuICovXG5leHBvcnQgY29uc3QgS05PV05fQ09OVFJPTF9GTE9XX0RJUkVDVElWRVMgPVxuICAgIG5ldyBTZXQoWyduZ0lmJywgJ25nRm9yJywgJ25nU3dpdGNoJywgJ25nU3dpdGNoQ2FzZScsICduZ1N3aXRjaERlZmF1bHQnXSk7XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIHRoZSB0YWcgbmFtZSBpcyBhbGxvd2VkIGJ5IHNwZWNpZmllZCBzY2hlbWFzLlxuICogQHBhcmFtIHNjaGVtYXMgQXJyYXkgb2Ygc2NoZW1hc1xuICogQHBhcmFtIHRhZ05hbWUgTmFtZSBvZiB0aGUgdGFnXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtYXRjaGluZ1NjaGVtYXMoc2NoZW1hczogU2NoZW1hTWV0YWRhdGFbXXxudWxsLCB0YWdOYW1lOiBzdHJpbmd8bnVsbCk6IGJvb2xlYW4ge1xuICBpZiAoc2NoZW1hcyAhPT0gbnVsbCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2NoZW1hcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qgc2NoZW1hID0gc2NoZW1hc1tpXTtcbiAgICAgIGlmIChzY2hlbWEgPT09IE5PX0VSUk9SU19TQ0hFTUEgfHxcbiAgICAgICAgICBzY2hlbWEgPT09IENVU1RPTV9FTEVNRU5UU19TQ0hFTUEgJiYgdGFnTmFtZSAmJiB0YWdOYW1lLmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cbiJdfQ==
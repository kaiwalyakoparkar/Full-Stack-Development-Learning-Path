/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ChangeDetectionStrategy } from '../../change_detection/constants';
import { Injector } from '../../di/injector';
import { assertEqual } from '../../util/assert';
import { assertLView } from '../assert';
import { discoverLocalRefs, getComponentAtNodeIndex, getDirectivesAtNodeIndex, getLContext, readPatchedLView } from '../context_discovery';
import { getComponentDef, getDirectiveDef } from '../definition';
import { NodeInjector } from '../di';
import { buildDebugNode } from '../instructions/lview_debug';
import { isLView } from '../interfaces/type_checks';
import { CLEANUP, CONTEXT, FLAGS, T_HOST, TVIEW } from '../interfaces/view';
import { getLViewParent, getRootContext } from './view_traversal_utils';
import { getTNode, unwrapRNode } from './view_utils';
/**
 * Retrieves the component instance associated with a given DOM element.
 *
 * @usageNotes
 * Given the following DOM structure:
 *
 * ```html
 * <app-root>
 *   <div>
 *     <child-comp></child-comp>
 *   </div>
 * </app-root>
 * ```
 *
 * Calling `getComponent` on `<child-comp>` will return the instance of `ChildComponent`
 * associated with this DOM element.
 *
 * Calling the function on `<app-root>` will return the `MyApp` instance.
 *
 *
 * @param element DOM element from which the component should be retrieved.
 * @returns Component instance associated with the element or `null` if there
 *    is no component associated with it.
 *
 * @publicApi
 * @globalApi ng
 */
export function getComponent(element) {
    ngDevMode && assertDomElement(element);
    const context = getLContext(element);
    if (context === null)
        return null;
    if (context.component === undefined) {
        const lView = context.lView;
        if (lView === null) {
            return null;
        }
        context.component = getComponentAtNodeIndex(context.nodeIndex, lView);
    }
    return context.component;
}
/**
 * If inside an embedded view (e.g. `*ngIf` or `*ngFor`), retrieves the context of the embedded
 * view that the element is part of. Otherwise retrieves the instance of the component whose view
 * owns the element (in this case, the result is the same as calling `getOwningComponent`).
 *
 * @param element Element for which to get the surrounding component instance.
 * @returns Instance of the component that is around the element or null if the element isn't
 *    inside any component.
 *
 * @publicApi
 * @globalApi ng
 */
export function getContext(element) {
    assertDomElement(element);
    const context = getLContext(element);
    const lView = context ? context.lView : null;
    return lView === null ? null : lView[CONTEXT];
}
/**
 * Retrieves the component instance whose view contains the DOM element.
 *
 * For example, if `<child-comp>` is used in the template of `<app-comp>`
 * (i.e. a `ViewChild` of `<app-comp>`), calling `getOwningComponent` on `<child-comp>`
 * would return `<app-comp>`.
 *
 * @param elementOrDir DOM element, component or directive instance
 *    for which to retrieve the root components.
 * @returns Component instance whose view owns the DOM element or null if the element is not
 *    part of a component view.
 *
 * @publicApi
 * @globalApi ng
 */
export function getOwningComponent(elementOrDir) {
    const context = getLContext(elementOrDir);
    let lView = context ? context.lView : null;
    if (lView === null)
        return null;
    let parent;
    while (lView[TVIEW].type === 2 /* TViewType.Embedded */ && (parent = getLViewParent(lView))) {
        lView = parent;
    }
    return lView[FLAGS] & 256 /* LViewFlags.IsRoot */ ? null : lView[CONTEXT];
}
/**
 * Retrieves all root components associated with a DOM element, directive or component instance.
 * Root components are those which have been bootstrapped by Angular.
 *
 * @param elementOrDir DOM element, component or directive instance
 *    for which to retrieve the root components.
 * @returns Root components associated with the target object.
 *
 * @publicApi
 * @globalApi ng
 */
export function getRootComponents(elementOrDir) {
    const lView = readPatchedLView(elementOrDir);
    return lView !== null ? [...getRootContext(lView).components] : [];
}
/**
 * Retrieves an `Injector` associated with an element, component or directive instance.
 *
 * @param elementOrDir DOM element, component or directive instance for which to
 *    retrieve the injector.
 * @returns Injector associated with the element, component or directive instance.
 *
 * @publicApi
 * @globalApi ng
 */
export function getInjector(elementOrDir) {
    const context = getLContext(elementOrDir);
    const lView = context ? context.lView : null;
    if (lView === null)
        return Injector.NULL;
    const tNode = lView[TVIEW].data[context.nodeIndex];
    return new NodeInjector(tNode, lView);
}
/**
 * Retrieve a set of injection tokens at a given DOM node.
 *
 * @param element Element for which the injection tokens should be retrieved.
 */
export function getInjectionTokens(element) {
    const context = getLContext(element);
    const lView = context ? context.lView : null;
    if (lView === null)
        return [];
    const tView = lView[TVIEW];
    const tNode = tView.data[context.nodeIndex];
    const providerTokens = [];
    const startIndex = tNode.providerIndexes & 1048575 /* TNodeProviderIndexes.ProvidersStartIndexMask */;
    const endIndex = tNode.directiveEnd;
    for (let i = startIndex; i < endIndex; i++) {
        let value = tView.data[i];
        if (isDirectiveDefHack(value)) {
            // The fact that we sometimes store Type and sometimes DirectiveDef in this location is a
            // design flaw.  We should always store same type so that we can be monomorphic. The issue
            // is that for Components/Directives we store the def instead the type. The correct behavior
            // is that we should always be storing injectable type in this location.
            value = value.type;
        }
        providerTokens.push(value);
    }
    return providerTokens;
}
/**
 * Retrieves directive instances associated with a given DOM node. Does not include
 * component instances.
 *
 * @usageNotes
 * Given the following DOM structure:
 *
 * ```html
 * <app-root>
 *   <button my-button></button>
 *   <my-comp></my-comp>
 * </app-root>
 * ```
 *
 * Calling `getDirectives` on `<button>` will return an array with an instance of the `MyButton`
 * directive that is associated with the DOM node.
 *
 * Calling `getDirectives` on `<my-comp>` will return an empty array.
 *
 * @param node DOM node for which to get the directives.
 * @returns Array of directives associated with the node.
 *
 * @publicApi
 * @globalApi ng
 */
export function getDirectives(node) {
    // Skip text nodes because we can't have directives associated with them.
    if (node instanceof Text) {
        return [];
    }
    const context = getLContext(node);
    const lView = context ? context.lView : null;
    if (lView === null) {
        return [];
    }
    const tView = lView[TVIEW];
    const nodeIndex = context.nodeIndex;
    if (!tView?.data[nodeIndex]) {
        return [];
    }
    if (context.directives === undefined) {
        context.directives = getDirectivesAtNodeIndex(nodeIndex, lView, false);
    }
    // The `directives` in this case are a named array called `LComponentView`. Clone the
    // result so we don't expose an internal data structure in the user's console.
    return context.directives === null ? [] : [...context.directives];
}
/**
 * Returns the debug (partial) metadata for a particular directive or component instance.
 * The function accepts an instance of a directive or component and returns the corresponding
 * metadata.
 *
 * @param directiveOrComponentInstance Instance of a directive or component
 * @returns metadata of the passed directive or component
 *
 * @publicApi
 * @globalApi ng
 */
export function getDirectiveMetadata(directiveOrComponentInstance) {
    const { constructor } = directiveOrComponentInstance;
    if (!constructor) {
        throw new Error('Unable to find the instance constructor');
    }
    // In case a component inherits from a directive, we may have component and directive metadata
    // To ensure we don't get the metadata of the directive, we want to call `getComponentDef` first.
    const componentDef = getComponentDef(constructor);
    if (componentDef) {
        return {
            inputs: componentDef.inputs,
            outputs: componentDef.outputs,
            encapsulation: componentDef.encapsulation,
            changeDetection: componentDef.onPush ? ChangeDetectionStrategy.OnPush :
                ChangeDetectionStrategy.Default
        };
    }
    const directiveDef = getDirectiveDef(constructor);
    if (directiveDef) {
        return { inputs: directiveDef.inputs, outputs: directiveDef.outputs };
    }
    return null;
}
/**
 * Retrieve map of local references.
 *
 * The references are retrieved as a map of local reference name to element or directive instance.
 *
 * @param target DOM element, component or directive instance for which to retrieve
 *    the local references.
 */
export function getLocalRefs(target) {
    const context = getLContext(target);
    if (context === null)
        return {};
    if (context.localRefs === undefined) {
        const lView = context.lView;
        if (lView === null) {
            return {};
        }
        context.localRefs = discoverLocalRefs(lView, context.nodeIndex);
    }
    return context.localRefs || {};
}
/**
 * Retrieves the host element of a component or directive instance.
 * The host element is the DOM element that matched the selector of the directive.
 *
 * @param componentOrDirective Component or directive instance for which the host
 *     element should be retrieved.
 * @returns Host element of the target.
 *
 * @publicApi
 * @globalApi ng
 */
export function getHostElement(componentOrDirective) {
    return getLContext(componentOrDirective).native;
}
/**
 * Retrieves the rendered text for a given component.
 *
 * This function retrieves the host element of a component and
 * and then returns the `textContent` for that element. This implies
 * that the text returned will include re-projected content of
 * the component as well.
 *
 * @param component The component to return the content text for.
 */
export function getRenderedText(component) {
    const hostElement = getHostElement(component);
    return hostElement.textContent || '';
}
/**
 * Retrieves a list of event listeners associated with a DOM element. The list does include host
 * listeners, but it does not include event listeners defined outside of the Angular context
 * (e.g. through `addEventListener`).
 *
 * @usageNotes
 * Given the following DOM structure:
 *
 * ```html
 * <app-root>
 *   <div (click)="doSomething()"></div>
 * </app-root>
 * ```
 *
 * Calling `getListeners` on `<div>` will return an object that looks as follows:
 *
 * ```ts
 * {
 *   name: 'click',
 *   element: <div>,
 *   callback: () => doSomething(),
 *   useCapture: false
 * }
 * ```
 *
 * @param element Element for which the DOM listeners should be retrieved.
 * @returns Array of event listeners on the DOM element.
 *
 * @publicApi
 * @globalApi ng
 */
export function getListeners(element) {
    ngDevMode && assertDomElement(element);
    const lContext = getLContext(element);
    const lView = lContext === null ? null : lContext.lView;
    if (lView === null)
        return [];
    const tView = lView[TVIEW];
    const lCleanup = lView[CLEANUP];
    const tCleanup = tView.cleanup;
    const listeners = [];
    if (tCleanup && lCleanup) {
        for (let i = 0; i < tCleanup.length;) {
            const firstParam = tCleanup[i++];
            const secondParam = tCleanup[i++];
            if (typeof firstParam === 'string') {
                const name = firstParam;
                const listenerElement = unwrapRNode(lView[secondParam]);
                const callback = lCleanup[tCleanup[i++]];
                const useCaptureOrIndx = tCleanup[i++];
                // if useCaptureOrIndx is boolean then report it as is.
                // if useCaptureOrIndx is positive number then it in unsubscribe method
                // if useCaptureOrIndx is negative number then it is a Subscription
                const type = (typeof useCaptureOrIndx === 'boolean' || useCaptureOrIndx >= 0) ? 'dom' : 'output';
                const useCapture = typeof useCaptureOrIndx === 'boolean' ? useCaptureOrIndx : false;
                if (element == listenerElement) {
                    listeners.push({ element, name, callback, useCapture, type });
                }
            }
        }
    }
    listeners.sort(sortListeners);
    return listeners;
}
function sortListeners(a, b) {
    if (a.name == b.name)
        return 0;
    return a.name < b.name ? -1 : 1;
}
/**
 * This function should not exist because it is megamorphic and only mostly correct.
 *
 * See call site for more info.
 */
function isDirectiveDefHack(obj) {
    return obj.type !== undefined && obj.template !== undefined && obj.declaredInputs !== undefined;
}
/**
 * Returns the attached `DebugNode` instance for an element in the DOM.
 *
 * @param element DOM element which is owned by an existing component's view.
 */
export function getDebugNode(element) {
    if (ngDevMode && !(element instanceof Node)) {
        throw new Error('Expecting instance of DOM Element');
    }
    const lContext = getLContext(element);
    const lView = lContext ? lContext.lView : null;
    if (lView === null) {
        return null;
    }
    const nodeIndex = lContext.nodeIndex;
    if (nodeIndex !== -1) {
        const valueInLView = lView[nodeIndex];
        // this means that value in the lView is a component with its own
        // data. In this situation the TNode is not accessed at the same spot.
        const tNode = isLView(valueInLView) ? valueInLView[T_HOST] : getTNode(lView[TVIEW], nodeIndex);
        ngDevMode &&
            assertEqual(tNode.index, nodeIndex, 'Expecting that TNode at index is same as index');
        return buildDebugNode(tNode, lView);
    }
    return null;
}
/**
 * Retrieve the component `LView` from component/element.
 *
 * NOTE: `LView` is a private and should not be leaked outside.
 *       Don't export this method to `ng.*` on window.
 *
 * @param target DOM element or component instance for which to retrieve the LView.
 */
export function getComponentLView(target) {
    const lContext = getLContext(target);
    const nodeIndx = lContext.nodeIndex;
    const lView = lContext.lView;
    ngDevMode && assertLView(lView);
    const componentLView = lView[nodeIndx];
    ngDevMode && assertLView(componentLView);
    return componentLView;
}
/** Asserts that a value is a DOM Element. */
function assertDomElement(value) {
    if (typeof Element !== 'undefined' && !(value instanceof Element)) {
        throw new Error('Expecting instance of DOM Element');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlzY292ZXJ5X3V0aWxzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvcmVuZGVyMy91dGlsL2Rpc2NvdmVyeV91dGlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSxrQ0FBa0MsQ0FBQztBQUN6RSxPQUFPLEVBQUMsUUFBUSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFFM0MsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQzlDLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxXQUFXLENBQUM7QUFDdEMsT0FBTyxFQUFDLGlCQUFpQixFQUFFLHVCQUF1QixFQUFFLHdCQUF3QixFQUFFLFdBQVcsRUFBRSxnQkFBZ0IsRUFBQyxNQUFNLHNCQUFzQixDQUFDO0FBQ3pJLE9BQU8sRUFBQyxlQUFlLEVBQUUsZUFBZSxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBQy9ELE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxPQUFPLENBQUM7QUFDbkMsT0FBTyxFQUFDLGNBQWMsRUFBQyxNQUFNLDZCQUE2QixDQUFDO0FBSTNELE9BQU8sRUFBQyxPQUFPLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUNsRCxPQUFPLEVBQUMsT0FBTyxFQUFFLE9BQU8sRUFBYSxLQUFLLEVBQWtDLE1BQU0sRUFBRSxLQUFLLEVBQVksTUFBTSxvQkFBb0IsQ0FBQztBQUdoSSxPQUFPLEVBQUMsY0FBYyxFQUFFLGNBQWMsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQ3RFLE9BQU8sRUFBQyxRQUFRLEVBQUUsV0FBVyxFQUFDLE1BQU0sY0FBYyxDQUFDO0FBSW5EOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQTBCRztBQUNILE1BQU0sVUFBVSxZQUFZLENBQUksT0FBZ0I7SUFDOUMsU0FBUyxJQUFJLGdCQUFn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LE1BQU0sUUFBUSxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUUsQ0FBQztJQUN0QyxNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsU0FBUyxDQUFDO0lBQ3BDLE1BQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxLQUFNLENBQUM7SUFDOUIsU0FBUyxJQUFJLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNoQyxNQUFNLGNBQWMsR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDdkMsU0FBUyxJQUFJLFdBQVcsQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUN6QyxPQUFPLGNBQWMsQ0FBQztBQUN4QixDQUFDO0FBRUQsNkNBQTZDO0FBQzdDLFNBQVMsZ0JBQWdCLENBQUMsS0FBVTtJQUNsQyxJQUFJLE9BQU8sT0FBTyxLQUFLLFdBQVcsSUFBSSxDQUFDLENBQUMsS0FBSyxZQUFZLE9BQU8sQ0FBQyxFQUFFO1FBQ2pFLE1BQU0sSUFBSSxLQUFLLENBQUMsbUNBQW1DLENBQUMsQ0FBQztLQUN0RDtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneX0gZnJvbSAnLi4vLi4vY2hhbmdlX2RldGVjdGlvbi9jb25zdGFudHMnO1xuaW1wb3J0IHtJbmplY3Rvcn0gZnJvbSAnLi4vLi4vZGkvaW5qZWN0b3InO1xuaW1wb3J0IHtWaWV3RW5jYXBzdWxhdGlvbn0gZnJvbSAnLi4vLi4vbWV0YWRhdGEvdmlldyc7XG5pbXBvcnQge2Fzc2VydEVxdWFsfSBmcm9tICcuLi8uLi91dGlsL2Fzc2VydCc7XG5pbXBvcnQge2Fzc2VydExWaWV3fSBmcm9tICcuLi9hc3NlcnQnO1xuaW1wb3J0IHtkaXNjb3ZlckxvY2FsUmVmcywgZ2V0Q29tcG9uZW50QXROb2RlSW5kZXgsIGdldERpcmVjdGl2ZXNBdE5vZGVJbmRleCwgZ2V0TENvbnRleHQsIHJlYWRQYXRjaGVkTFZpZXd9IGZyb20gJy4uL2NvbnRleHRfZGlzY292ZXJ5JztcbmltcG9ydCB7Z2V0Q29tcG9uZW50RGVmLCBnZXREaXJlY3RpdmVEZWZ9IGZyb20gJy4uL2RlZmluaXRpb24nO1xuaW1wb3J0IHtOb2RlSW5qZWN0b3J9IGZyb20gJy4uL2RpJztcbmltcG9ydCB7YnVpbGREZWJ1Z05vZGV9IGZyb20gJy4uL2luc3RydWN0aW9ucy9sdmlld19kZWJ1Zyc7XG5pbXBvcnQge0xDb250ZXh0fSBmcm9tICcuLi9pbnRlcmZhY2VzL2NvbnRleHQnO1xuaW1wb3J0IHtEaXJlY3RpdmVEZWZ9IGZyb20gJy4uL2ludGVyZmFjZXMvZGVmaW5pdGlvbic7XG5pbXBvcnQge1RFbGVtZW50Tm9kZSwgVE5vZGUsIFROb2RlUHJvdmlkZXJJbmRleGVzfSBmcm9tICcuLi9pbnRlcmZhY2VzL25vZGUnO1xuaW1wb3J0IHtpc0xWaWV3fSBmcm9tICcuLi9pbnRlcmZhY2VzL3R5cGVfY2hlY2tzJztcbmltcG9ydCB7Q0xFQU5VUCwgQ09OVEVYVCwgRGVidWdOb2RlLCBGTEFHUywgTFZpZXcsIExWaWV3RmxhZ3MsIFJvb3RDb250ZXh0LCBUX0hPU1QsIFRWSUVXLCBUVmlld1R5cGV9IGZyb20gJy4uL2ludGVyZmFjZXMvdmlldyc7XG5cbmltcG9ydCB7c3RyaW5naWZ5Rm9yRXJyb3J9IGZyb20gJy4vc3RyaW5naWZ5X3V0aWxzJztcbmltcG9ydCB7Z2V0TFZpZXdQYXJlbnQsIGdldFJvb3RDb250ZXh0fSBmcm9tICcuL3ZpZXdfdHJhdmVyc2FsX3V0aWxzJztcbmltcG9ydCB7Z2V0VE5vZGUsIHVud3JhcFJOb2RlfSBmcm9tICcuL3ZpZXdfdXRpbHMnO1xuXG5cblxuLyoqXG4gKiBSZXRyaWV2ZXMgdGhlIGNvbXBvbmVudCBpbnN0YW5jZSBhc3NvY2lhdGVkIHdpdGggYSBnaXZlbiBET00gZWxlbWVudC5cbiAqXG4gKiBAdXNhZ2VOb3Rlc1xuICogR2l2ZW4gdGhlIGZvbGxvd2luZyBET00gc3RydWN0dXJlOlxuICpcbiAqIGBgYGh0bWxcbiAqIDxhcHAtcm9vdD5cbiAqICAgPGRpdj5cbiAqICAgICA8Y2hpbGQtY29tcD48L2NoaWxkLWNvbXA+XG4gKiAgIDwvZGl2PlxuICogPC9hcHAtcm9vdD5cbiAqIGBgYFxuICpcbiAqIENhbGxpbmcgYGdldENvbXBvbmVudGAgb24gYDxjaGlsZC1jb21wPmAgd2lsbCByZXR1cm4gdGhlIGluc3RhbmNlIG9mIGBDaGlsZENvbXBvbmVudGBcbiAqIGFzc29jaWF0ZWQgd2l0aCB0aGlzIERPTSBlbGVtZW50LlxuICpcbiAqIENhbGxpbmcgdGhlIGZ1bmN0aW9uIG9uIGA8YXBwLXJvb3Q+YCB3aWxsIHJldHVybiB0aGUgYE15QXBwYCBpbnN0YW5jZS5cbiAqXG4gKlxuICogQHBhcmFtIGVsZW1lbnQgRE9NIGVsZW1lbnQgZnJvbSB3aGljaCB0aGUgY29tcG9uZW50IHNob3VsZCBiZSByZXRyaWV2ZWQuXG4gKiBAcmV0dXJucyBDb21wb25lbnQgaW5zdGFuY2UgYXNzb2NpYXRlZCB3aXRoIHRoZSBlbGVtZW50IG9yIGBudWxsYCBpZiB0aGVyZVxuICogICAgaXMgbm8gY29tcG9uZW50IGFzc29jaWF0ZWQgd2l0aCBpdC5cbiAqXG4gKiBAcHVibGljQXBpXG4gKiBAZ2xvYmFsQXBpIG5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRDb21wb25lbnQ8VD4oZWxlbWVudDogRWxlbWVudCk6IFR8bnVsbCB7XG4gIG5nRGV2TW9kZSAmJiBhc3NlcnREb21FbGVtZW50KGVsZW1lbnQpO1xuICBjb25zdCBjb250ZXh0ID0gZ2V0TENvbnRleHQoZWxlbWVudCk7XG4gIGlmIChjb250ZXh0ID09PSBudWxsKSByZXR1cm4gbnVsbDtcblxuICBpZiAoY29udGV4dC5jb21wb25lbnQgPT09IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IGxWaWV3ID0gY29udGV4dC5sVmlldztcbiAgICBpZiAobFZpZXcgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb250ZXh0LmNvbXBvbmVudCA9IGdldENvbXBvbmVudEF0Tm9kZUluZGV4KGNvbnRleHQubm9kZUluZGV4LCBsVmlldyk7XG4gIH1cblxuICByZXR1cm4gY29udGV4dC5jb21wb25lbnQgYXMgdW5rbm93biBhcyBUO1xufVxuXG5cbi8qKlxuICogSWYgaW5zaWRlIGFuIGVtYmVkZGVkIHZpZXcgKGUuZy4gYCpuZ0lmYCBvciBgKm5nRm9yYCksIHJldHJpZXZlcyB0aGUgY29udGV4dCBvZiB0aGUgZW1iZWRkZWRcbiAqIHZpZXcgdGhhdCB0aGUgZWxlbWVudCBpcyBwYXJ0IG9mLiBPdGhlcndpc2UgcmV0cmlldmVzIHRoZSBpbnN0YW5jZSBvZiB0aGUgY29tcG9uZW50IHdob3NlIHZpZXdcbiAqIG93bnMgdGhlIGVsZW1lbnQgKGluIHRoaXMgY2FzZSwgdGhlIHJlc3VsdCBpcyB0aGUgc2FtZSBhcyBjYWxsaW5nIGBnZXRPd25pbmdDb21wb25lbnRgKS5cbiAqXG4gKiBAcGFyYW0gZWxlbWVudCBFbGVtZW50IGZvciB3aGljaCB0byBnZXQgdGhlIHN1cnJvdW5kaW5nIGNvbXBvbmVudCBpbnN0YW5jZS5cbiAqIEByZXR1cm5zIEluc3RhbmNlIG9mIHRoZSBjb21wb25lbnQgdGhhdCBpcyBhcm91bmQgdGhlIGVsZW1lbnQgb3IgbnVsbCBpZiB0aGUgZWxlbWVudCBpc24ndFxuICogICAgaW5zaWRlIGFueSBjb21wb25lbnQuXG4gKlxuICogQHB1YmxpY0FwaVxuICogQGdsb2JhbEFwaSBuZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q29udGV4dDxUIGV4dGVuZHMoe30gfCBSb290Q29udGV4dCk+KGVsZW1lbnQ6IEVsZW1lbnQpOiBUfG51bGwge1xuICBhc3NlcnREb21FbGVtZW50KGVsZW1lbnQpO1xuICBjb25zdCBjb250ZXh0ID0gZ2V0TENvbnRleHQoZWxlbWVudCkhO1xuICBjb25zdCBsVmlldyA9IGNvbnRleHQgPyBjb250ZXh0LmxWaWV3IDogbnVsbDtcbiAgcmV0dXJuIGxWaWV3ID09PSBudWxsID8gbnVsbCA6IGxWaWV3W0NPTlRFWFRdIGFzIFQ7XG59XG5cbi8qKlxuICogUmV0cmlldmVzIHRoZSBjb21wb25lbnQgaW5zdGFuY2Ugd2hvc2UgdmlldyBjb250YWlucyB0aGUgRE9NIGVsZW1lbnQuXG4gKlxuICogRm9yIGV4YW1wbGUsIGlmIGA8Y2hpbGQtY29tcD5gIGlzIHVzZWQgaW4gdGhlIHRlbXBsYXRlIG9mIGA8YXBwLWNvbXA+YFxuICogKGkuZS4gYSBgVmlld0NoaWxkYCBvZiBgPGFwcC1jb21wPmApLCBjYWxsaW5nIGBnZXRPd25pbmdDb21wb25lbnRgIG9uIGA8Y2hpbGQtY29tcD5gXG4gKiB3b3VsZCByZXR1cm4gYDxhcHAtY29tcD5gLlxuICpcbiAqIEBwYXJhbSBlbGVtZW50T3JEaXIgRE9NIGVsZW1lbnQsIGNvbXBvbmVudCBvciBkaXJlY3RpdmUgaW5zdGFuY2VcbiAqICAgIGZvciB3aGljaCB0byByZXRyaWV2ZSB0aGUgcm9vdCBjb21wb25lbnRzLlxuICogQHJldHVybnMgQ29tcG9uZW50IGluc3RhbmNlIHdob3NlIHZpZXcgb3ducyB0aGUgRE9NIGVsZW1lbnQgb3IgbnVsbCBpZiB0aGUgZWxlbWVudCBpcyBub3RcbiAqICAgIHBhcnQgb2YgYSBjb21wb25lbnQgdmlldy5cbiAqXG4gKiBAcHVibGljQXBpXG4gKiBAZ2xvYmFsQXBpIG5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRPd25pbmdDb21wb25lbnQ8VD4oZWxlbWVudE9yRGlyOiBFbGVtZW50fHt9KTogVHxudWxsIHtcbiAgY29uc3QgY29udGV4dCA9IGdldExDb250ZXh0KGVsZW1lbnRPckRpcikhO1xuICBsZXQgbFZpZXcgPSBjb250ZXh0ID8gY29udGV4dC5sVmlldyA6IG51bGw7XG4gIGlmIChsVmlldyA9PT0gbnVsbCkgcmV0dXJuIG51bGw7XG5cbiAgbGV0IHBhcmVudDogTFZpZXd8bnVsbDtcbiAgd2hpbGUgKGxWaWV3W1RWSUVXXS50eXBlID09PSBUVmlld1R5cGUuRW1iZWRkZWQgJiYgKHBhcmVudCA9IGdldExWaWV3UGFyZW50KGxWaWV3KSEpKSB7XG4gICAgbFZpZXcgPSBwYXJlbnQ7XG4gIH1cbiAgcmV0dXJuIGxWaWV3W0ZMQUdTXSAmIExWaWV3RmxhZ3MuSXNSb290ID8gbnVsbCA6IGxWaWV3W0NPTlRFWFRdIGFzIHVua25vd24gYXMgVDtcbn1cblxuLyoqXG4gKiBSZXRyaWV2ZXMgYWxsIHJvb3QgY29tcG9uZW50cyBhc3NvY2lhdGVkIHdpdGggYSBET00gZWxlbWVudCwgZGlyZWN0aXZlIG9yIGNvbXBvbmVudCBpbnN0YW5jZS5cbiAqIFJvb3QgY29tcG9uZW50cyBhcmUgdGhvc2Ugd2hpY2ggaGF2ZSBiZWVuIGJvb3RzdHJhcHBlZCBieSBBbmd1bGFyLlxuICpcbiAqIEBwYXJhbSBlbGVtZW50T3JEaXIgRE9NIGVsZW1lbnQsIGNvbXBvbmVudCBvciBkaXJlY3RpdmUgaW5zdGFuY2VcbiAqICAgIGZvciB3aGljaCB0byByZXRyaWV2ZSB0aGUgcm9vdCBjb21wb25lbnRzLlxuICogQHJldHVybnMgUm9vdCBjb21wb25lbnRzIGFzc29jaWF0ZWQgd2l0aCB0aGUgdGFyZ2V0IG9iamVjdC5cbiAqXG4gKiBAcHVibGljQXBpXG4gKiBAZ2xvYmFsQXBpIG5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRSb290Q29tcG9uZW50cyhlbGVtZW50T3JEaXI6IEVsZW1lbnR8e30pOiB7fVtdIHtcbiAgY29uc3QgbFZpZXcgPSByZWFkUGF0Y2hlZExWaWV3PHt9PihlbGVtZW50T3JEaXIpO1xuICByZXR1cm4gbFZpZXcgIT09IG51bGwgPyBbLi4uZ2V0Um9vdENvbnRleHQobFZpZXcpLmNvbXBvbmVudHMgYXMgdW5rbm93biBhcyB7fVtdXSA6IFtdO1xufVxuXG4vKipcbiAqIFJldHJpZXZlcyBhbiBgSW5qZWN0b3JgIGFzc29jaWF0ZWQgd2l0aCBhbiBlbGVtZW50LCBjb21wb25lbnQgb3IgZGlyZWN0aXZlIGluc3RhbmNlLlxuICpcbiAqIEBwYXJhbSBlbGVtZW50T3JEaXIgRE9NIGVsZW1lbnQsIGNvbXBvbmVudCBvciBkaXJlY3RpdmUgaW5zdGFuY2UgZm9yIHdoaWNoIHRvXG4gKiAgICByZXRyaWV2ZSB0aGUgaW5qZWN0b3IuXG4gKiBAcmV0dXJucyBJbmplY3RvciBhc3NvY2lhdGVkIHdpdGggdGhlIGVsZW1lbnQsIGNvbXBvbmVudCBvciBkaXJlY3RpdmUgaW5zdGFuY2UuXG4gKlxuICogQHB1YmxpY0FwaVxuICogQGdsb2JhbEFwaSBuZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW5qZWN0b3IoZWxlbWVudE9yRGlyOiBFbGVtZW50fHt9KTogSW5qZWN0b3Ige1xuICBjb25zdCBjb250ZXh0ID0gZ2V0TENvbnRleHQoZWxlbWVudE9yRGlyKSE7XG4gIGNvbnN0IGxWaWV3ID0gY29udGV4dCA/IGNvbnRleHQubFZpZXcgOiBudWxsO1xuICBpZiAobFZpZXcgPT09IG51bGwpIHJldHVybiBJbmplY3Rvci5OVUxMO1xuXG4gIGNvbnN0IHROb2RlID0gbFZpZXdbVFZJRVddLmRhdGFbY29udGV4dC5ub2RlSW5kZXhdIGFzIFRFbGVtZW50Tm9kZTtcbiAgcmV0dXJuIG5ldyBOb2RlSW5qZWN0b3IodE5vZGUsIGxWaWV3KTtcbn1cblxuLyoqXG4gKiBSZXRyaWV2ZSBhIHNldCBvZiBpbmplY3Rpb24gdG9rZW5zIGF0IGEgZ2l2ZW4gRE9NIG5vZGUuXG4gKlxuICogQHBhcmFtIGVsZW1lbnQgRWxlbWVudCBmb3Igd2hpY2ggdGhlIGluamVjdGlvbiB0b2tlbnMgc2hvdWxkIGJlIHJldHJpZXZlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEluamVjdGlvblRva2VucyhlbGVtZW50OiBFbGVtZW50KTogYW55W10ge1xuICBjb25zdCBjb250ZXh0ID0gZ2V0TENvbnRleHQoZWxlbWVudCkhO1xuICBjb25zdCBsVmlldyA9IGNvbnRleHQgPyBjb250ZXh0LmxWaWV3IDogbnVsbDtcbiAgaWYgKGxWaWV3ID09PSBudWxsKSByZXR1cm4gW107XG4gIGNvbnN0IHRWaWV3ID0gbFZpZXdbVFZJRVddO1xuICBjb25zdCB0Tm9kZSA9IHRWaWV3LmRhdGFbY29udGV4dC5ub2RlSW5kZXhdIGFzIFROb2RlO1xuICBjb25zdCBwcm92aWRlclRva2VuczogYW55W10gPSBbXTtcbiAgY29uc3Qgc3RhcnRJbmRleCA9IHROb2RlLnByb3ZpZGVySW5kZXhlcyAmIFROb2RlUHJvdmlkZXJJbmRleGVzLlByb3ZpZGVyc1N0YXJ0SW5kZXhNYXNrO1xuICBjb25zdCBlbmRJbmRleCA9IHROb2RlLmRpcmVjdGl2ZUVuZDtcbiAgZm9yIChsZXQgaSA9IHN0YXJ0SW5kZXg7IGkgPCBlbmRJbmRleDsgaSsrKSB7XG4gICAgbGV0IHZhbHVlID0gdFZpZXcuZGF0YVtpXTtcbiAgICBpZiAoaXNEaXJlY3RpdmVEZWZIYWNrKHZhbHVlKSkge1xuICAgICAgLy8gVGhlIGZhY3QgdGhhdCB3ZSBzb21ldGltZXMgc3RvcmUgVHlwZSBhbmQgc29tZXRpbWVzIERpcmVjdGl2ZURlZiBpbiB0aGlzIGxvY2F0aW9uIGlzIGFcbiAgICAgIC8vIGRlc2lnbiBmbGF3LiAgV2Ugc2hvdWxkIGFsd2F5cyBzdG9yZSBzYW1lIHR5cGUgc28gdGhhdCB3ZSBjYW4gYmUgbW9ub21vcnBoaWMuIFRoZSBpc3N1ZVxuICAgICAgLy8gaXMgdGhhdCBmb3IgQ29tcG9uZW50cy9EaXJlY3RpdmVzIHdlIHN0b3JlIHRoZSBkZWYgaW5zdGVhZCB0aGUgdHlwZS4gVGhlIGNvcnJlY3QgYmVoYXZpb3JcbiAgICAgIC8vIGlzIHRoYXQgd2Ugc2hvdWxkIGFsd2F5cyBiZSBzdG9yaW5nIGluamVjdGFibGUgdHlwZSBpbiB0aGlzIGxvY2F0aW9uLlxuICAgICAgdmFsdWUgPSB2YWx1ZS50eXBlO1xuICAgIH1cbiAgICBwcm92aWRlclRva2Vucy5wdXNoKHZhbHVlKTtcbiAgfVxuICByZXR1cm4gcHJvdmlkZXJUb2tlbnM7XG59XG5cbi8qKlxuICogUmV0cmlldmVzIGRpcmVjdGl2ZSBpbnN0YW5jZXMgYXNzb2NpYXRlZCB3aXRoIGEgZ2l2ZW4gRE9NIG5vZGUuIERvZXMgbm90IGluY2x1ZGVcbiAqIGNvbXBvbmVudCBpbnN0YW5jZXMuXG4gKlxuICogQHVzYWdlTm90ZXNcbiAqIEdpdmVuIHRoZSBmb2xsb3dpbmcgRE9NIHN0cnVjdHVyZTpcbiAqXG4gKiBgYGBodG1sXG4gKiA8YXBwLXJvb3Q+XG4gKiAgIDxidXR0b24gbXktYnV0dG9uPjwvYnV0dG9uPlxuICogICA8bXktY29tcD48L215LWNvbXA+XG4gKiA8L2FwcC1yb290PlxuICogYGBgXG4gKlxuICogQ2FsbGluZyBgZ2V0RGlyZWN0aXZlc2Agb24gYDxidXR0b24+YCB3aWxsIHJldHVybiBhbiBhcnJheSB3aXRoIGFuIGluc3RhbmNlIG9mIHRoZSBgTXlCdXR0b25gXG4gKiBkaXJlY3RpdmUgdGhhdCBpcyBhc3NvY2lhdGVkIHdpdGggdGhlIERPTSBub2RlLlxuICpcbiAqIENhbGxpbmcgYGdldERpcmVjdGl2ZXNgIG9uIGA8bXktY29tcD5gIHdpbGwgcmV0dXJuIGFuIGVtcHR5IGFycmF5LlxuICpcbiAqIEBwYXJhbSBub2RlIERPTSBub2RlIGZvciB3aGljaCB0byBnZXQgdGhlIGRpcmVjdGl2ZXMuXG4gKiBAcmV0dXJucyBBcnJheSBvZiBkaXJlY3RpdmVzIGFzc29jaWF0ZWQgd2l0aCB0aGUgbm9kZS5cbiAqXG4gKiBAcHVibGljQXBpXG4gKiBAZ2xvYmFsQXBpIG5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXREaXJlY3RpdmVzKG5vZGU6IE5vZGUpOiB7fVtdIHtcbiAgLy8gU2tpcCB0ZXh0IG5vZGVzIGJlY2F1c2Ugd2UgY2FuJ3QgaGF2ZSBkaXJlY3RpdmVzIGFzc29jaWF0ZWQgd2l0aCB0aGVtLlxuICBpZiAobm9kZSBpbnN0YW5jZW9mIFRleHQpIHtcbiAgICByZXR1cm4gW107XG4gIH1cblxuICBjb25zdCBjb250ZXh0ID0gZ2V0TENvbnRleHQobm9kZSkhO1xuICBjb25zdCBsVmlldyA9IGNvbnRleHQgPyBjb250ZXh0LmxWaWV3IDogbnVsbDtcbiAgaWYgKGxWaWV3ID09PSBudWxsKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgY29uc3QgdFZpZXcgPSBsVmlld1tUVklFV107XG4gIGNvbnN0IG5vZGVJbmRleCA9IGNvbnRleHQubm9kZUluZGV4O1xuICBpZiAoIXRWaWV3Py5kYXRhW25vZGVJbmRleF0pIHtcbiAgICByZXR1cm4gW107XG4gIH1cbiAgaWYgKGNvbnRleHQuZGlyZWN0aXZlcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgY29udGV4dC5kaXJlY3RpdmVzID0gZ2V0RGlyZWN0aXZlc0F0Tm9kZUluZGV4KG5vZGVJbmRleCwgbFZpZXcsIGZhbHNlKTtcbiAgfVxuXG4gIC8vIFRoZSBgZGlyZWN0aXZlc2AgaW4gdGhpcyBjYXNlIGFyZSBhIG5hbWVkIGFycmF5IGNhbGxlZCBgTENvbXBvbmVudFZpZXdgLiBDbG9uZSB0aGVcbiAgLy8gcmVzdWx0IHNvIHdlIGRvbid0IGV4cG9zZSBhbiBpbnRlcm5hbCBkYXRhIHN0cnVjdHVyZSBpbiB0aGUgdXNlcidzIGNvbnNvbGUuXG4gIHJldHVybiBjb250ZXh0LmRpcmVjdGl2ZXMgPT09IG51bGwgPyBbXSA6IFsuLi5jb250ZXh0LmRpcmVjdGl2ZXNdO1xufVxuXG4vKipcbiAqIFBhcnRpYWwgbWV0YWRhdGEgZm9yIGEgZ2l2ZW4gZGlyZWN0aXZlIGluc3RhbmNlLlxuICogVGhpcyBpbmZvcm1hdGlvbiBtaWdodCBiZSB1c2VmdWwgZm9yIGRlYnVnZ2luZyBwdXJwb3NlcyBvciB0b29saW5nLlxuICogQ3VycmVudGx5IG9ubHkgYGlucHV0c2AgYW5kIGBvdXRwdXRzYCBtZXRhZGF0YSBpcyBhdmFpbGFibGUuXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgaW50ZXJmYWNlIERpcmVjdGl2ZURlYnVnTWV0YWRhdGEge1xuICBpbnB1dHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIG91dHB1dHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG59XG5cbi8qKlxuICogUGFydGlhbCBtZXRhZGF0YSBmb3IgYSBnaXZlbiBjb21wb25lbnQgaW5zdGFuY2UuXG4gKiBUaGlzIGluZm9ybWF0aW9uIG1pZ2h0IGJlIHVzZWZ1bCBmb3IgZGVidWdnaW5nIHB1cnBvc2VzIG9yIHRvb2xpbmcuXG4gKiBDdXJyZW50bHkgdGhlIGZvbGxvd2luZyBmaWVsZHMgYXJlIGF2YWlsYWJsZTpcbiAqICAtIGlucHV0c1xuICogIC0gb3V0cHV0c1xuICogIC0gZW5jYXBzdWxhdGlvblxuICogIC0gY2hhbmdlRGV0ZWN0aW9uXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgaW50ZXJmYWNlIENvbXBvbmVudERlYnVnTWV0YWRhdGEgZXh0ZW5kcyBEaXJlY3RpdmVEZWJ1Z01ldGFkYXRhIHtcbiAgZW5jYXBzdWxhdGlvbjogVmlld0VuY2Fwc3VsYXRpb247XG4gIGNoYW5nZURldGVjdGlvbjogQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3k7XG59XG5cbi8qKlxuICogUmV0dXJucyB0aGUgZGVidWcgKHBhcnRpYWwpIG1ldGFkYXRhIGZvciBhIHBhcnRpY3VsYXIgZGlyZWN0aXZlIG9yIGNvbXBvbmVudCBpbnN0YW5jZS5cbiAqIFRoZSBmdW5jdGlvbiBhY2NlcHRzIGFuIGluc3RhbmNlIG9mIGEgZGlyZWN0aXZlIG9yIGNvbXBvbmVudCBhbmQgcmV0dXJucyB0aGUgY29ycmVzcG9uZGluZ1xuICogbWV0YWRhdGEuXG4gKlxuICogQHBhcmFtIGRpcmVjdGl2ZU9yQ29tcG9uZW50SW5zdGFuY2UgSW5zdGFuY2Ugb2YgYSBkaXJlY3RpdmUgb3IgY29tcG9uZW50XG4gKiBAcmV0dXJucyBtZXRhZGF0YSBvZiB0aGUgcGFzc2VkIGRpcmVjdGl2ZSBvciBjb21wb25lbnRcbiAqXG4gKiBAcHVibGljQXBpXG4gKiBAZ2xvYmFsQXBpIG5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXREaXJlY3RpdmVNZXRhZGF0YShkaXJlY3RpdmVPckNvbXBvbmVudEluc3RhbmNlOiBhbnkpOiBDb21wb25lbnREZWJ1Z01ldGFkYXRhfFxuICAgIERpcmVjdGl2ZURlYnVnTWV0YWRhdGF8bnVsbCB7XG4gIGNvbnN0IHtjb25zdHJ1Y3Rvcn0gPSBkaXJlY3RpdmVPckNvbXBvbmVudEluc3RhbmNlO1xuICBpZiAoIWNvbnN0cnVjdG9yKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdVbmFibGUgdG8gZmluZCB0aGUgaW5zdGFuY2UgY29uc3RydWN0b3InKTtcbiAgfVxuICAvLyBJbiBjYXNlIGEgY29tcG9uZW50IGluaGVyaXRzIGZyb20gYSBkaXJlY3RpdmUsIHdlIG1heSBoYXZlIGNvbXBvbmVudCBhbmQgZGlyZWN0aXZlIG1ldGFkYXRhXG4gIC8vIFRvIGVuc3VyZSB3ZSBkb24ndCBnZXQgdGhlIG1ldGFkYXRhIG9mIHRoZSBkaXJlY3RpdmUsIHdlIHdhbnQgdG8gY2FsbCBgZ2V0Q29tcG9uZW50RGVmYCBmaXJzdC5cbiAgY29uc3QgY29tcG9uZW50RGVmID0gZ2V0Q29tcG9uZW50RGVmKGNvbnN0cnVjdG9yKTtcbiAgaWYgKGNvbXBvbmVudERlZikge1xuICAgIHJldHVybiB7XG4gICAgICBpbnB1dHM6IGNvbXBvbmVudERlZi5pbnB1dHMsXG4gICAgICBvdXRwdXRzOiBjb21wb25lbnREZWYub3V0cHV0cyxcbiAgICAgIGVuY2Fwc3VsYXRpb246IGNvbXBvbmVudERlZi5lbmNhcHN1bGF0aW9uLFxuICAgICAgY2hhbmdlRGV0ZWN0aW9uOiBjb21wb25lbnREZWYub25QdXNoID8gQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3kuT25QdXNoIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIENoYW5nZURldGVjdGlvblN0cmF0ZWd5LkRlZmF1bHRcbiAgICB9O1xuICB9XG4gIGNvbnN0IGRpcmVjdGl2ZURlZiA9IGdldERpcmVjdGl2ZURlZihjb25zdHJ1Y3Rvcik7XG4gIGlmIChkaXJlY3RpdmVEZWYpIHtcbiAgICByZXR1cm4ge2lucHV0czogZGlyZWN0aXZlRGVmLmlucHV0cywgb3V0cHV0czogZGlyZWN0aXZlRGVmLm91dHB1dHN9O1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIFJldHJpZXZlIG1hcCBvZiBsb2NhbCByZWZlcmVuY2VzLlxuICpcbiAqIFRoZSByZWZlcmVuY2VzIGFyZSByZXRyaWV2ZWQgYXMgYSBtYXAgb2YgbG9jYWwgcmVmZXJlbmNlIG5hbWUgdG8gZWxlbWVudCBvciBkaXJlY3RpdmUgaW5zdGFuY2UuXG4gKlxuICogQHBhcmFtIHRhcmdldCBET00gZWxlbWVudCwgY29tcG9uZW50IG9yIGRpcmVjdGl2ZSBpbnN0YW5jZSBmb3Igd2hpY2ggdG8gcmV0cmlldmVcbiAqICAgIHRoZSBsb2NhbCByZWZlcmVuY2VzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0TG9jYWxSZWZzKHRhcmdldDoge30pOiB7W2tleTogc3RyaW5nXTogYW55fSB7XG4gIGNvbnN0IGNvbnRleHQgPSBnZXRMQ29udGV4dCh0YXJnZXQpO1xuICBpZiAoY29udGV4dCA9PT0gbnVsbCkgcmV0dXJuIHt9O1xuXG4gIGlmIChjb250ZXh0LmxvY2FsUmVmcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgY29uc3QgbFZpZXcgPSBjb250ZXh0LmxWaWV3O1xuICAgIGlmIChsVmlldyA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHt9O1xuICAgIH1cbiAgICBjb250ZXh0LmxvY2FsUmVmcyA9IGRpc2NvdmVyTG9jYWxSZWZzKGxWaWV3LCBjb250ZXh0Lm5vZGVJbmRleCk7XG4gIH1cblxuICByZXR1cm4gY29udGV4dC5sb2NhbFJlZnMgfHwge307XG59XG5cbi8qKlxuICogUmV0cmlldmVzIHRoZSBob3N0IGVsZW1lbnQgb2YgYSBjb21wb25lbnQgb3IgZGlyZWN0aXZlIGluc3RhbmNlLlxuICogVGhlIGhvc3QgZWxlbWVudCBpcyB0aGUgRE9NIGVsZW1lbnQgdGhhdCBtYXRjaGVkIHRoZSBzZWxlY3RvciBvZiB0aGUgZGlyZWN0aXZlLlxuICpcbiAqIEBwYXJhbSBjb21wb25lbnRPckRpcmVjdGl2ZSBDb21wb25lbnQgb3IgZGlyZWN0aXZlIGluc3RhbmNlIGZvciB3aGljaCB0aGUgaG9zdFxuICogICAgIGVsZW1lbnQgc2hvdWxkIGJlIHJldHJpZXZlZC5cbiAqIEByZXR1cm5zIEhvc3QgZWxlbWVudCBvZiB0aGUgdGFyZ2V0LlxuICpcbiAqIEBwdWJsaWNBcGlcbiAqIEBnbG9iYWxBcGkgbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEhvc3RFbGVtZW50KGNvbXBvbmVudE9yRGlyZWN0aXZlOiB7fSk6IEVsZW1lbnQge1xuICByZXR1cm4gZ2V0TENvbnRleHQoY29tcG9uZW50T3JEaXJlY3RpdmUpIS5uYXRpdmUgYXMgdW5rbm93biBhcyBFbGVtZW50O1xufVxuXG4vKipcbiAqIFJldHJpZXZlcyB0aGUgcmVuZGVyZWQgdGV4dCBmb3IgYSBnaXZlbiBjb21wb25lbnQuXG4gKlxuICogVGhpcyBmdW5jdGlvbiByZXRyaWV2ZXMgdGhlIGhvc3QgZWxlbWVudCBvZiBhIGNvbXBvbmVudCBhbmRcbiAqIGFuZCB0aGVuIHJldHVybnMgdGhlIGB0ZXh0Q29udGVudGAgZm9yIHRoYXQgZWxlbWVudC4gVGhpcyBpbXBsaWVzXG4gKiB0aGF0IHRoZSB0ZXh0IHJldHVybmVkIHdpbGwgaW5jbHVkZSByZS1wcm9qZWN0ZWQgY29udGVudCBvZlxuICogdGhlIGNvbXBvbmVudCBhcyB3ZWxsLlxuICpcbiAqIEBwYXJhbSBjb21wb25lbnQgVGhlIGNvbXBvbmVudCB0byByZXR1cm4gdGhlIGNvbnRlbnQgdGV4dCBmb3IuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRSZW5kZXJlZFRleHQoY29tcG9uZW50OiBhbnkpOiBzdHJpbmcge1xuICBjb25zdCBob3N0RWxlbWVudCA9IGdldEhvc3RFbGVtZW50KGNvbXBvbmVudCk7XG4gIHJldHVybiBob3N0RWxlbWVudC50ZXh0Q29udGVudCB8fCAnJztcbn1cblxuLyoqXG4gKiBFdmVudCBsaXN0ZW5lciBjb25maWd1cmF0aW9uIHJldHVybmVkIGZyb20gYGdldExpc3RlbmVyc2AuXG4gKiBAcHVibGljQXBpXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgTGlzdGVuZXIge1xuICAvKiogTmFtZSBvZiB0aGUgZXZlbnQgbGlzdGVuZXIuICovXG4gIG5hbWU6IHN0cmluZztcbiAgLyoqIEVsZW1lbnQgdGhhdCB0aGUgbGlzdGVuZXIgaXMgYm91bmQgdG8uICovXG4gIGVsZW1lbnQ6IEVsZW1lbnQ7XG4gIC8qKiBDYWxsYmFjayB0aGF0IGlzIGludm9rZWQgd2hlbiB0aGUgZXZlbnQgaXMgdHJpZ2dlcmVkLiAqL1xuICBjYWxsYmFjazogKHZhbHVlOiBhbnkpID0+IGFueTtcbiAgLyoqIFdoZXRoZXIgdGhlIGxpc3RlbmVyIGlzIHVzaW5nIGV2ZW50IGNhcHR1cmluZy4gKi9cbiAgdXNlQ2FwdHVyZTogYm9vbGVhbjtcbiAgLyoqXG4gICAqIFR5cGUgb2YgdGhlIGxpc3RlbmVyIChlLmcuIGEgbmF0aXZlIERPTSBldmVudCBvciBhIGN1c3RvbSBAT3V0cHV0KS5cbiAgICovXG4gIHR5cGU6ICdkb20nfCdvdXRwdXQnO1xufVxuXG5cbi8qKlxuICogUmV0cmlldmVzIGEgbGlzdCBvZiBldmVudCBsaXN0ZW5lcnMgYXNzb2NpYXRlZCB3aXRoIGEgRE9NIGVsZW1lbnQuIFRoZSBsaXN0IGRvZXMgaW5jbHVkZSBob3N0XG4gKiBsaXN0ZW5lcnMsIGJ1dCBpdCBkb2VzIG5vdCBpbmNsdWRlIGV2ZW50IGxpc3RlbmVycyBkZWZpbmVkIG91dHNpZGUgb2YgdGhlIEFuZ3VsYXIgY29udGV4dFxuICogKGUuZy4gdGhyb3VnaCBgYWRkRXZlbnRMaXN0ZW5lcmApLlxuICpcbiAqIEB1c2FnZU5vdGVzXG4gKiBHaXZlbiB0aGUgZm9sbG93aW5nIERPTSBzdHJ1Y3R1cmU6XG4gKlxuICogYGBgaHRtbFxuICogPGFwcC1yb290PlxuICogICA8ZGl2IChjbGljayk9XCJkb1NvbWV0aGluZygpXCI+PC9kaXY+XG4gKiA8L2FwcC1yb290PlxuICogYGBgXG4gKlxuICogQ2FsbGluZyBgZ2V0TGlzdGVuZXJzYCBvbiBgPGRpdj5gIHdpbGwgcmV0dXJuIGFuIG9iamVjdCB0aGF0IGxvb2tzIGFzIGZvbGxvd3M6XG4gKlxuICogYGBgdHNcbiAqIHtcbiAqICAgbmFtZTogJ2NsaWNrJyxcbiAqICAgZWxlbWVudDogPGRpdj4sXG4gKiAgIGNhbGxiYWNrOiAoKSA9PiBkb1NvbWV0aGluZygpLFxuICogICB1c2VDYXB0dXJlOiBmYWxzZVxuICogfVxuICogYGBgXG4gKlxuICogQHBhcmFtIGVsZW1lbnQgRWxlbWVudCBmb3Igd2hpY2ggdGhlIERPTSBsaXN0ZW5lcnMgc2hvdWxkIGJlIHJldHJpZXZlZC5cbiAqIEByZXR1cm5zIEFycmF5IG9mIGV2ZW50IGxpc3RlbmVycyBvbiB0aGUgRE9NIGVsZW1lbnQuXG4gKlxuICogQHB1YmxpY0FwaVxuICogQGdsb2JhbEFwaSBuZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0TGlzdGVuZXJzKGVsZW1lbnQ6IEVsZW1lbnQpOiBMaXN0ZW5lcltdIHtcbiAgbmdEZXZNb2RlICYmIGFzc2VydERvbUVsZW1lbnQoZWxlbWVudCk7XG4gIGNvbnN0IGxDb250ZXh0ID0gZ2V0TENvbnRleHQoZWxlbWVudCk7XG4gIGNvbnN0IGxWaWV3ID0gbENvbnRleHQgPT09IG51bGwgPyBudWxsIDogbENvbnRleHQubFZpZXc7XG4gIGlmIChsVmlldyA9PT0gbnVsbCkgcmV0dXJuIFtdO1xuXG4gIGNvbnN0IHRWaWV3ID0gbFZpZXdbVFZJRVddO1xuICBjb25zdCBsQ2xlYW51cCA9IGxWaWV3W0NMRUFOVVBdO1xuICBjb25zdCB0Q2xlYW51cCA9IHRWaWV3LmNsZWFudXA7XG4gIGNvbnN0IGxpc3RlbmVyczogTGlzdGVuZXJbXSA9IFtdO1xuICBpZiAodENsZWFudXAgJiYgbENsZWFudXApIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRDbGVhbnVwLmxlbmd0aDspIHtcbiAgICAgIGNvbnN0IGZpcnN0UGFyYW0gPSB0Q2xlYW51cFtpKytdO1xuICAgICAgY29uc3Qgc2Vjb25kUGFyYW0gPSB0Q2xlYW51cFtpKytdO1xuICAgICAgaWYgKHR5cGVvZiBmaXJzdFBhcmFtID09PSAnc3RyaW5nJykge1xuICAgICAgICBjb25zdCBuYW1lOiBzdHJpbmcgPSBmaXJzdFBhcmFtO1xuICAgICAgICBjb25zdCBsaXN0ZW5lckVsZW1lbnQgPSB1bndyYXBSTm9kZShsVmlld1tzZWNvbmRQYXJhbV0pIGFzIGFueSBhcyBFbGVtZW50O1xuICAgICAgICBjb25zdCBjYWxsYmFjazogKHZhbHVlOiBhbnkpID0+IGFueSA9IGxDbGVhbnVwW3RDbGVhbnVwW2krK11dO1xuICAgICAgICBjb25zdCB1c2VDYXB0dXJlT3JJbmR4ID0gdENsZWFudXBbaSsrXTtcbiAgICAgICAgLy8gaWYgdXNlQ2FwdHVyZU9ySW5keCBpcyBib29sZWFuIHRoZW4gcmVwb3J0IGl0IGFzIGlzLlxuICAgICAgICAvLyBpZiB1c2VDYXB0dXJlT3JJbmR4IGlzIHBvc2l0aXZlIG51bWJlciB0aGVuIGl0IGluIHVuc3Vic2NyaWJlIG1ldGhvZFxuICAgICAgICAvLyBpZiB1c2VDYXB0dXJlT3JJbmR4IGlzIG5lZ2F0aXZlIG51bWJlciB0aGVuIGl0IGlzIGEgU3Vic2NyaXB0aW9uXG4gICAgICAgIGNvbnN0IHR5cGUgPVxuICAgICAgICAgICAgKHR5cGVvZiB1c2VDYXB0dXJlT3JJbmR4ID09PSAnYm9vbGVhbicgfHwgdXNlQ2FwdHVyZU9ySW5keCA+PSAwKSA/ICdkb20nIDogJ291dHB1dCc7XG4gICAgICAgIGNvbnN0IHVzZUNhcHR1cmUgPSB0eXBlb2YgdXNlQ2FwdHVyZU9ySW5keCA9PT0gJ2Jvb2xlYW4nID8gdXNlQ2FwdHVyZU9ySW5keCA6IGZhbHNlO1xuICAgICAgICBpZiAoZWxlbWVudCA9PSBsaXN0ZW5lckVsZW1lbnQpIHtcbiAgICAgICAgICBsaXN0ZW5lcnMucHVzaCh7ZWxlbWVudCwgbmFtZSwgY2FsbGJhY2ssIHVzZUNhcHR1cmUsIHR5cGV9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBsaXN0ZW5lcnMuc29ydChzb3J0TGlzdGVuZXJzKTtcbiAgcmV0dXJuIGxpc3RlbmVycztcbn1cblxuZnVuY3Rpb24gc29ydExpc3RlbmVycyhhOiBMaXN0ZW5lciwgYjogTGlzdGVuZXIpIHtcbiAgaWYgKGEubmFtZSA9PSBiLm5hbWUpIHJldHVybiAwO1xuICByZXR1cm4gYS5uYW1lIDwgYi5uYW1lID8gLTEgOiAxO1xufVxuXG4vKipcbiAqIFRoaXMgZnVuY3Rpb24gc2hvdWxkIG5vdCBleGlzdCBiZWNhdXNlIGl0IGlzIG1lZ2Ftb3JwaGljIGFuZCBvbmx5IG1vc3RseSBjb3JyZWN0LlxuICpcbiAqIFNlZSBjYWxsIHNpdGUgZm9yIG1vcmUgaW5mby5cbiAqL1xuZnVuY3Rpb24gaXNEaXJlY3RpdmVEZWZIYWNrKG9iajogYW55KTogb2JqIGlzIERpcmVjdGl2ZURlZjxhbnk+IHtcbiAgcmV0dXJuIG9iai50eXBlICE9PSB1bmRlZmluZWQgJiYgb2JqLnRlbXBsYXRlICE9PSB1bmRlZmluZWQgJiYgb2JqLmRlY2xhcmVkSW5wdXRzICE9PSB1bmRlZmluZWQ7XG59XG5cbi8qKlxuICogUmV0dXJucyB0aGUgYXR0YWNoZWQgYERlYnVnTm9kZWAgaW5zdGFuY2UgZm9yIGFuIGVsZW1lbnQgaW4gdGhlIERPTS5cbiAqXG4gKiBAcGFyYW0gZWxlbWVudCBET00gZWxlbWVudCB3aGljaCBpcyBvd25lZCBieSBhbiBleGlzdGluZyBjb21wb25lbnQncyB2aWV3LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0RGVidWdOb2RlKGVsZW1lbnQ6IEVsZW1lbnQpOiBEZWJ1Z05vZGV8bnVsbCB7XG4gIGlmIChuZ0Rldk1vZGUgJiYgIShlbGVtZW50IGluc3RhbmNlb2YgTm9kZSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGluZyBpbnN0YW5jZSBvZiBET00gRWxlbWVudCcpO1xuICB9XG5cbiAgY29uc3QgbENvbnRleHQgPSBnZXRMQ29udGV4dChlbGVtZW50KSE7XG4gIGNvbnN0IGxWaWV3ID0gbENvbnRleHQgPyBsQ29udGV4dC5sVmlldyA6IG51bGw7XG5cbiAgaWYgKGxWaWV3ID09PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBub2RlSW5kZXggPSBsQ29udGV4dC5ub2RlSW5kZXg7XG4gIGlmIChub2RlSW5kZXggIT09IC0xKSB7XG4gICAgY29uc3QgdmFsdWVJbkxWaWV3ID0gbFZpZXdbbm9kZUluZGV4XTtcbiAgICAvLyB0aGlzIG1lYW5zIHRoYXQgdmFsdWUgaW4gdGhlIGxWaWV3IGlzIGEgY29tcG9uZW50IHdpdGggaXRzIG93blxuICAgIC8vIGRhdGEuIEluIHRoaXMgc2l0dWF0aW9uIHRoZSBUTm9kZSBpcyBub3QgYWNjZXNzZWQgYXQgdGhlIHNhbWUgc3BvdC5cbiAgICBjb25zdCB0Tm9kZSA9XG4gICAgICAgIGlzTFZpZXcodmFsdWVJbkxWaWV3KSA/ICh2YWx1ZUluTFZpZXdbVF9IT1NUXSBhcyBUTm9kZSkgOiBnZXRUTm9kZShsVmlld1tUVklFV10sIG5vZGVJbmRleCk7XG4gICAgbmdEZXZNb2RlICYmXG4gICAgICAgIGFzc2VydEVxdWFsKHROb2RlLmluZGV4LCBub2RlSW5kZXgsICdFeHBlY3RpbmcgdGhhdCBUTm9kZSBhdCBpbmRleCBpcyBzYW1lIGFzIGluZGV4Jyk7XG4gICAgcmV0dXJuIGJ1aWxkRGVidWdOb2RlKHROb2RlLCBsVmlldyk7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBSZXRyaWV2ZSB0aGUgY29tcG9uZW50IGBMVmlld2AgZnJvbSBjb21wb25lbnQvZWxlbWVudC5cbiAqXG4gKiBOT1RFOiBgTFZpZXdgIGlzIGEgcHJpdmF0ZSBhbmQgc2hvdWxkIG5vdCBiZSBsZWFrZWQgb3V0c2lkZS5cbiAqICAgICAgIERvbid0IGV4cG9ydCB0aGlzIG1ldGhvZCB0byBgbmcuKmAgb24gd2luZG93LlxuICpcbiAqIEBwYXJhbSB0YXJnZXQgRE9NIGVsZW1lbnQgb3IgY29tcG9uZW50IGluc3RhbmNlIGZvciB3aGljaCB0byByZXRyaWV2ZSB0aGUgTFZpZXcuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRDb21wb25lbnRMVmlldyh0YXJnZXQ6IGFueSk6IExWaWV3IHtcbiAgY29uc3QgbENvbnRleHQgPSBnZXRMQ29udGV4dCh0YXJnZXQpITtcbiAgY29uc3Qgbm9kZUluZHggPSBsQ29udGV4dC5ub2RlSW5kZXg7XG4gIGNvbnN0IGxWaWV3ID0gbENvbnRleHQubFZpZXchO1xuICBuZ0Rldk1vZGUgJiYgYXNzZXJ0TFZpZXcobFZpZXcpO1xuICBjb25zdCBjb21wb25lbnRMVmlldyA9IGxWaWV3W25vZGVJbmR4XTtcbiAgbmdEZXZNb2RlICYmIGFzc2VydExWaWV3KGNvbXBvbmVudExWaWV3KTtcbiAgcmV0dXJuIGNvbXBvbmVudExWaWV3O1xufVxuXG4vKiogQXNzZXJ0cyB0aGF0IGEgdmFsdWUgaXMgYSBET00gRWxlbWVudC4gKi9cbmZ1bmN0aW9uIGFzc2VydERvbUVsZW1lbnQodmFsdWU6IGFueSkge1xuICBpZiAodHlwZW9mIEVsZW1lbnQgIT09ICd1bmRlZmluZWQnICYmICEodmFsdWUgaW5zdGFuY2VvZiBFbGVtZW50KSkge1xuICAgIHRocm93IG5ldyBFcnJvcignRXhwZWN0aW5nIGluc3RhbmNlIG9mIERPTSBFbGVtZW50Jyk7XG4gIH1cbn1cbiJdfQ==
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ViewEncapsulation } from '../metadata/view';
import { RendererStyleFlags2 } from '../render/api_flags';
import { addToArray, removeFromArray } from '../util/array_utils';
import { assertDefined, assertEqual, assertFunction, assertString } from '../util/assert';
import { escapeCommentText } from '../util/dom';
import { assertLContainer, assertLView, assertParentView, assertProjectionSlots, assertTNodeForLView } from './assert';
import { attachPatchData } from './context_discovery';
import { icuContainerIterate } from './i18n/i18n_tree_shaking';
import { CONTAINER_HEADER_OFFSET, HAS_TRANSPLANTED_VIEWS, MOVED_VIEWS, NATIVE, unusedValueExportToPlacateAjd as unused1 } from './interfaces/container';
import { NodeInjectorFactory } from './interfaces/injector';
import { unregisterLView } from './interfaces/lview_tracking';
import { unusedValueExportToPlacateAjd as unused2 } from './interfaces/node';
import { unusedValueExportToPlacateAjd as unused3 } from './interfaces/projection';
import { unusedValueExportToPlacateAjd as unused4 } from './interfaces/renderer';
import { isLContainer, isLView } from './interfaces/type_checks';
import { CHILD_HEAD, CLEANUP, DECLARATION_COMPONENT_VIEW, DECLARATION_LCONTAINER, FLAGS, HOST, NEXT, PARENT, QUERIES, RENDERER, T_HOST, TVIEW, unusedValueExportToPlacateAjd as unused5 } from './interfaces/view';
import { assertTNodeType } from './node_assert';
import { profiler } from './profiler';
import { getLViewParent } from './util/view_traversal_utils';
import { getNativeByTNode, unwrapRNode, updateTransplantedViewCount } from './util/view_utils';
const unusedValueToPlacateAjd = unused1 + unused2 + unused3 + unused4 + unused5;
/**
 * NOTE: for performance reasons, the possible actions are inlined within the function instead of
 * being passed as an argument.
 */
function applyToElementOrContainer(action, renderer, parent, lNodeToHandle, beforeNode) {
    // If this slot was allocated for a text node dynamically created by i18n, the text node itself
    // won't be created until i18nApply() in the update block, so this node should be skipped.
    // For more info, see "ICU expressions should work inside an ngTemplateOutlet inside an ngFor"
    // in `i18n_spec.ts`.
    if (lNodeToHandle != null) {
        let lContainer;
        let isComponent = false;
        // We are expecting an RNode, but in the case of a component or LContainer the `RNode` is
        // wrapped in an array which needs to be unwrapped. We need to know if it is a component and if
        // it has LContainer so that we can process all of those cases appropriately.
        if (isLContainer(lNodeToHandle)) {
            lContainer = lNodeToHandle;
        }
        else if (isLView(lNodeToHandle)) {
            isComponent = true;
            ngDevMode && assertDefined(lNodeToHandle[HOST], 'HOST must be defined for a component LView');
            lNodeToHandle = lNodeToHandle[HOST];
        }
        const rNode = unwrapRNode(lNodeToHandle);
        if (action === 0 /* WalkTNodeTreeAction.Create */ && parent !== null) {
            if (beforeNode == null) {
                nativeAppendChild(renderer, parent, rNode);
            }
            else {
                nativeInsertBefore(renderer, parent, rNode, beforeNode || null, true);
            }
        }
        else if (action === 1 /* WalkTNodeTreeAction.Insert */ && parent !== null) {
            nativeInsertBefore(renderer, parent, rNode, beforeNode || null, true);
        }
        else if (action === 2 /* WalkTNodeTreeAction.Detach */) {
            nativeRemoveNode(renderer, rNode, isComponent);
        }
        else if (action === 3 /* WalkTNodeTreeAction.Destroy */) {
            ngDevMode && ngDevMode.rendererDestroyNode++;
            renderer.destroyNode(rNode);
        }
        if (lContainer != null) {
            applyContainer(renderer, action, lContainer, parent, beforeNode);
        }
    }
}
export function createTextNode(renderer, value) {
    ngDevMode && ngDevMode.rendererCreateTextNode++;
    ngDevMode && ngDevMode.rendererSetText++;
    return renderer.createText(value);
}
export function updateTextNode(renderer, rNode, value) {
    ngDevMode && ngDevMode.rendererSetText++;
    renderer.setValue(rNode, value);
}
export function createCommentNode(renderer, value) {
    ngDevMode && ngDevMode.rendererCreateComment++;
    return renderer.createComment(escapeCommentText(value));
}
/**
 * Creates a native element from a tag name, using a renderer.
 * @param renderer A renderer to use
 * @param name the tag name
 * @param namespace Optional namespace for element.
 * @returns the element created
 */
export function createElementNode(renderer, name, namespace) {
    ngDevMode && ngDevMode.rendererCreateElement++;
    return renderer.createElement(name, namespace);
}
/**
 * Removes all DOM elements associated with a view.
 *
 * Because some root nodes of the view may be containers, we sometimes need
 * to propagate deeply into the nested containers to remove all elements in the
 * views beneath it.
 *
 * @param tView The `TView' of the `LView` from which elements should be added or removed
 * @param lView The view from which elements should be added or removed
 */
export function removeViewFromContainer(tView, lView) {
    const renderer = lView[RENDERER];
    applyView(tView, lView, renderer, 2 /* WalkTNodeTreeAction.Detach */, null, null);
    lView[HOST] = null;
    lView[T_HOST] = null;
}
/**
 * Adds all DOM elements associated with a view.
 *
 * Because some root nodes of the view may be containers, we sometimes need
 * to propagate deeply into the nested containers to add all elements in the
 * views beneath it.
 *
 * @param tView The `TView' of the `LView` from which elements should be added or removed
 * @param parentTNode The `TNode` where the `LView` should be attached to.
 * @param renderer Current renderer to use for DOM manipulations.
 * @param lView The view from which elements should be added or removed
 * @param parentNativeNode The parent `RElement` where it should be inserted into.
 * @param beforeNode The node before which elements should be added, if insert mode
 */
export function addViewToContainer(tView, parentTNode, renderer, lView, parentNativeNode, beforeNode) {
    lView[HOST] = parentNativeNode;
    lView[T_HOST] = parentTNode;
    applyView(tView, lView, renderer, 1 /* WalkTNodeTreeAction.Insert */, parentNativeNode, beforeNode);
}
/**
 * Detach a `LView` from the DOM by detaching its nodes.
 *
 * @param tView The `TView' of the `LView` to be detached
 * @param lView the `LView` to be detached.
 */
export function renderDetachView(tView, lView) {
    applyView(tView, lView, lView[RENDERER], 2 /* WalkTNodeTreeAction.Detach */, null, null);
}
/**
 * Traverses down and up the tree of views and containers to remove listeners and
 * call onDestroy callbacks.
 *
 * Notes:
 *  - Because it's used for onDestroy calls, it needs to be bottom-up.
 *  - Must process containers instead of their views to avoid splicing
 *  when views are destroyed and re-added.
 *  - Using a while loop because it's faster than recursion
 *  - Destroy only called on movement to sibling or movement to parent (laterally or up)
 *
 *  @param rootView The view to destroy
 */
export function destroyViewTree(rootView) {
    // If the view has no children, we can clean it up and return early.
    let lViewOrLContainer = rootView[CHILD_HEAD];
    if (!lViewOrLContainer) {
        return cleanUpView(rootView[TVIEW], rootView);
    }
    while (lViewOrLContainer) {
        let next = null;
        if (isLView(lViewOrLContainer)) {
            // If LView, traverse down to child.
            next = lViewOrLContainer[CHILD_HEAD];
        }
        else {
            ngDevMode && assertLContainer(lViewOrLContainer);
            // If container, traverse down to its first LView.
            const firstView = lViewOrLContainer[CONTAINER_HEADER_OFFSET];
            if (firstView)
                next = firstView;
        }
        if (!next) {
            // Only clean up view when moving to the side or up, as destroy hooks
            // should be called in order from the bottom up.
            while (lViewOrLContainer && !lViewOrLContainer[NEXT] && lViewOrLContainer !== rootView) {
                if (isLView(lViewOrLContainer)) {
                    cleanUpView(lViewOrLContainer[TVIEW], lViewOrLContainer);
                }
                lViewOrLContainer = lViewOrLContainer[PARENT];
            }
            if (lViewOrLContainer === null)
                lViewOrLContainer = rootView;
            if (isLView(lViewOrLContainer)) {
                cleanUpView(lViewOrLContainer[TVIEW], lViewOrLContainer);
            }
            next = lViewOrLContainer && lViewOrLContainer[NEXT];
        }
        lViewOrLContainer = next;
    }
}
/**
 * Inserts a view into a container.
 *
 * This adds the view to the container's array of active views in the correct
 * position. It also adds the view's elements to the DOM if the container isn't a
 * root node of another view (in that case, the view's elements will be added when
 * the container's parent view is added later).
 *
 * @param tView The `TView' of the `LView` to insert
 * @param lView The view to insert
 * @param lContainer The container into which the view should be inserted
 * @param index Which index in the container to insert the child view into
 */
export function insertView(tView, lView, lContainer, index) {
    ngDevMode && assertLView(lView);
    ngDevMode && assertLContainer(lContainer);
    const indexInContainer = CONTAINER_HEADER_OFFSET + index;
    const containerLength = lContainer.length;
    if (index > 0) {
        // This is a new view, we need to add it to the children.
        lContainer[indexInContainer - 1][NEXT] = lView;
    }
    if (index < containerLength - CONTAINER_HEADER_OFFSET) {
        lView[NEXT] = lContainer[indexInContainer];
        addToArray(lContainer, CONTAINER_HEADER_OFFSET + index, lView);
    }
    else {
        lContainer.push(lView);
        lView[NEXT] = null;
    }
    lView[PARENT] = lContainer;
    // track views where declaration and insertion points are different
    const declarationLContainer = lView[DECLARATION_LCONTAINER];
    if (declarationLContainer !== null && lContainer !== declarationLContainer) {
        trackMovedView(declarationLContainer, lView);
    }
    // notify query that a new view has been added
    const lQueries = lView[QUERIES];
    if (lQueries !== null) {
        lQueries.insertView(tView);
    }
    // Sets the attached flag
    lView[FLAGS] |= 64 /* LViewFlags.Attached */;
}
/**
 * Track views created from the declaration container (TemplateRef) and inserted into a
 * different LContainer.
 */
function trackMovedView(declarationContainer, lView) {
    ngDevMode && assertDefined(lView, 'LView required');
    ngDevMode && assertLContainer(declarationContainer);
    const movedViews = declarationContainer[MOVED_VIEWS];
    const insertedLContainer = lView[PARENT];
    ngDevMode && assertLContainer(insertedLContainer);
    const insertedComponentLView = insertedLContainer[PARENT][DECLARATION_COMPONENT_VIEW];
    ngDevMode && assertDefined(insertedComponentLView, 'Missing insertedComponentLView');
    const declaredComponentLView = lView[DECLARATION_COMPONENT_VIEW];
    ngDevMode && assertDefined(declaredComponentLView, 'Missing declaredComponentLView');
    if (declaredComponentLView !== insertedComponentLView) {
        // At this point the declaration-component is not same as insertion-component; this means that
        // this is a transplanted view. Mark the declared lView as having transplanted views so that
        // those views can participate in CD.
        declarationContainer[HAS_TRANSPLANTED_VIEWS] = true;
    }
    if (movedViews === null) {
        declarationContainer[MOVED_VIEWS] = [lView];
    }
    else {
        movedViews.push(lView);
    }
}
function detachMovedView(declarationContainer, lView) {
    ngDevMode && assertLContainer(declarationContainer);
    ngDevMode &&
        assertDefined(declarationContainer[MOVED_VIEWS], 'A projected view should belong to a non-empty projected views collection');
    const movedViews = declarationContainer[MOVED_VIEWS];
    const declarationViewIndex = movedViews.indexOf(lView);
    const insertionLContainer = lView[PARENT];
    ngDevMode && assertLContainer(insertionLContainer);
    // If the view was marked for refresh but then detached before it was checked (where the flag
    // would be cleared and the counter decremented), we need to decrement the view counter here
    // instead.
    if (lView[FLAGS] & 512 /* LViewFlags.RefreshTransplantedView */) {
        lView[FLAGS] &= ~512 /* LViewFlags.RefreshTransplantedView */;
        updateTransplantedViewCount(insertionLContainer, -1);
    }
    movedViews.splice(declarationViewIndex, 1);
}
/**
 * Detaches a view from a container.
 *
 * This method removes the view from the container's array of active views. It also
 * removes the view's elements from the DOM.
 *
 * @param lContainer The container from which to detach a view
 * @param removeIndex The index of the view to detach
 * @returns Detached LView instance.
 */
export function detachView(lContainer, removeIndex) {
    if (lContainer.length <= CONTAINER_HEADER_OFFSET)
        return;
    const indexInContainer = CONTAINER_HEADER_OFFSET + removeIndex;
    const viewToDetach = lContainer[indexInContainer];
    if (viewToDetach) {
        const declarationLContainer = viewToDetach[DECLARATION_LCONTAINER];
        if (declarationLContainer !== null && declarationLContainer !== lContainer) {
            detachMovedView(declarationLContainer, viewToDetach);
        }
        if (removeIndex > 0) {
            lContainer[indexInContainer - 1][NEXT] = viewToDetach[NEXT];
        }
        const removedLView = removeFromArray(lContainer, CONTAINER_HEADER_OFFSET + removeIndex);
        removeViewFromContainer(viewToDetach[TVIEW], viewToDetach);
        // notify query that a view has been removed
        const lQueries = removedLView[QUERIES];
        if (lQueries !== null) {
            lQueries.detachView(removedLView[TVIEW]);
        }
        viewToDetach[PARENT] = null;
        viewToDetach[NEXT] = null;
        // Unsets the attached flag
        viewToDetach[FLAGS] &= ~64 /* LViewFlags.Attached */;
    }
    return viewToDetach;
}
/**
 * A standalone function which destroys an LView,
 * conducting clean up (e.g. removing listeners, calling onDestroys).
 *
 * @param tView The `TView' of the `LView` to be destroyed
 * @param lView The view to be destroyed.
 */
export function destroyLView(tView, lView) {
    if (!(lView[FLAGS] & 128 /* LViewFlags.Destroyed */)) {
        const renderer = lView[RENDERER];
        if (renderer.destroyNode) {
            applyView(tView, lView, renderer, 3 /* WalkTNodeTreeAction.Destroy */, null, null);
        }
        destroyViewTree(lView);
    }
}
/**
 * Calls onDestroys hooks for all directives and pipes in a given view and then removes all
 * listeners. Listeners are removed as the last step so events delivered in the onDestroys hooks
 * can be propagated to @Output listeners.
 *
 * @param tView `TView` for the `LView` to clean up.
 * @param lView The LView to clean up
 */
function cleanUpView(tView, lView) {
    if (!(lView[FLAGS] & 128 /* LViewFlags.Destroyed */)) {
        // Usually the Attached flag is removed when the view is detached from its parent, however
        // if it's a root view, the flag won't be unset hence why we're also removing on destroy.
        lView[FLAGS] &= ~64 /* LViewFlags.Attached */;
        // Mark the LView as destroyed *before* executing the onDestroy hooks. An onDestroy hook
        // runs arbitrary user code, which could include its own `viewRef.destroy()` (or similar). If
        // We don't flag the view as destroyed before the hooks, this could lead to an infinite loop.
        // This also aligns with the ViewEngine behavior. It also means that the onDestroy hook is
        // really more of an "afterDestroy" hook if you think about it.
        lView[FLAGS] |= 128 /* LViewFlags.Destroyed */;
        executeOnDestroys(tView, lView);
        processCleanups(tView, lView);
        // For component views only, the local renderer is destroyed at clean up time.
        if (lView[TVIEW].type === 1 /* TViewType.Component */) {
            ngDevMode && ngDevMode.rendererDestroy++;
            lView[RENDERER].destroy();
        }
        const declarationContainer = lView[DECLARATION_LCONTAINER];
        // we are dealing with an embedded view that is still inserted into a container
        if (declarationContainer !== null && isLContainer(lView[PARENT])) {
            // and this is a projected view
            if (declarationContainer !== lView[PARENT]) {
                detachMovedView(declarationContainer, lView);
            }
            // For embedded views still attached to a container: remove query result from this view.
            const lQueries = lView[QUERIES];
            if (lQueries !== null) {
                lQueries.detachView(tView);
            }
        }
        // Unregister the view once everything else has been cleaned up.
        unregisterLView(lView);
    }
}
/** Removes listeners and unsubscribes from output subscriptions */
function processCleanups(tView, lView) {
    const tCleanup = tView.cleanup;
    const lCleanup = lView[CLEANUP];
    // `LCleanup` contains both share information with `TCleanup` as well as instance specific
    // information appended at the end. We need to know where the end of the `TCleanup` information
    // is, and we track this with `lastLCleanupIndex`.
    let lastLCleanupIndex = -1;
    if (tCleanup !== null) {
        for (let i = 0; i < tCleanup.length - 1; i += 2) {
            if (typeof tCleanup[i] === 'string') {
                // This is a native DOM listener
                const idxOrTargetGetter = tCleanup[i + 1];
                const target = typeof idxOrTargetGetter === 'function' ?
                    idxOrTargetGetter(lView) :
                    unwrapRNode(lView[idxOrTargetGetter]);
                const listener = lCleanup[lastLCleanupIndex = tCleanup[i + 2]];
                const useCaptureOrSubIdx = tCleanup[i + 3];
                if (typeof useCaptureOrSubIdx === 'boolean') {
                    // native DOM listener registered with Renderer3
                    target.removeEventListener(tCleanup[i], listener, useCaptureOrSubIdx);
                }
                else {
                    if (useCaptureOrSubIdx >= 0) {
                        // unregister
                        lCleanup[lastLCleanupIndex = useCaptureOrSubIdx]();
                    }
                    else {
                        // Subscription
                        lCleanup[lastLCleanupIndex = -useCaptureOrSubIdx].unsubscribe();
                    }
                }
                i += 2;
            }
            else {
                // This is a cleanup function that is grouped with the index of its context
                const context = lCleanup[lastLCleanupIndex = tCleanup[i + 1]];
                tCleanup[i].call(context);
            }
        }
    }
    if (lCleanup !== null) {
        for (let i = lastLCleanupIndex + 1; i < lCleanup.length; i++) {
            const instanceCleanupFn = lCleanup[i];
            ngDevMode && assertFunction(instanceCleanupFn, 'Expecting instance cleanup function.');
            instanceCleanupFn();
        }
        lView[CLEANUP] = null;
    }
}
/** Calls onDestroy hooks for this view */
function executeOnDestroys(tView, lView) {
    let destroyHooks;
    if (tView != null && (destroyHooks = tView.destroyHooks) != null) {
        for (let i = 0; i < destroyHooks.length; i += 2) {
            const context = lView[destroyHooks[i]];
            // Only call the destroy hook if the context has been requested.
            if (!(context instanceof NodeInjectorFactory)) {
                const toCall = destroyHooks[i + 1];
                if (Array.isArray(toCall)) {
                    for (let j = 0; j < toCall.length; j += 2) {
                        const callContext = context[toCall[j]];
                        const hook = toCall[j + 1];
                        profiler(4 /* ProfilerEvent.LifecycleHookStart */, callContext, hook);
                        try {
                            hook.call(callContext);
                        }
                        finally {
                            profiler(5 /* ProfilerEvent.LifecycleHookEnd */, callContext, hook);
                        }
                    }
                }
                else {
                    profiler(4 /* ProfilerEvent.LifecycleHookStart */, context, toCall);
                    try {
                        toCall.call(context);
                    }
                    finally {
                        profiler(5 /* ProfilerEvent.LifecycleHookEnd */, context, toCall);
                    }
                }
            }
        }
    }
}
/**
 * Returns a native element if a node can be inserted into the given parent.
 *
 * There are two reasons why we may not be able to insert a element immediately.
 * - Projection: When creating a child content element of a component, we have to skip the
 *   insertion because the content of a component will be projected.
 *   `<component><content>delayed due to projection</content></component>`
 * - Parent container is disconnected: This can happen when we are inserting a view into
 *   parent container, which itself is disconnected. For example the parent container is part
 *   of a View which has not be inserted or is made for projection but has not been inserted
 *   into destination.
 *
 * @param tView: Current `TView`.
 * @param tNode: `TNode` for which we wish to retrieve render parent.
 * @param lView: Current `LView`.
 */
export function getParentRElement(tView, tNode, lView) {
    return getClosestRElement(tView, tNode.parent, lView);
}
/**
 * Get closest `RElement` or `null` if it can't be found.
 *
 * If `TNode` is `TNodeType.Element` => return `RElement` at `LView[tNode.index]` location.
 * If `TNode` is `TNodeType.ElementContainer|IcuContain` => return the parent (recursively).
 * If `TNode` is `null` then return host `RElement`:
 *   - return `null` if projection
 *   - return `null` if parent container is disconnected (we have no parent.)
 *
 * @param tView: Current `TView`.
 * @param tNode: `TNode` for which we wish to retrieve `RElement` (or `null` if host element is
 *     needed).
 * @param lView: Current `LView`.
 * @returns `null` if the `RElement` can't be determined at this time (no parent / projection)
 */
export function getClosestRElement(tView, tNode, lView) {
    let parentTNode = tNode;
    // Skip over element and ICU containers as those are represented by a comment node and
    // can't be used as a render parent.
    while (parentTNode !== null &&
        (parentTNode.type & (8 /* TNodeType.ElementContainer */ | 32 /* TNodeType.Icu */))) {
        tNode = parentTNode;
        parentTNode = tNode.parent;
    }
    // If the parent tNode is null, then we are inserting across views: either into an embedded view
    // or a component view.
    if (parentTNode === null) {
        // We are inserting a root element of the component view into the component host element and
        // it should always be eager.
        return lView[HOST];
    }
    else {
        ngDevMode && assertTNodeType(parentTNode, 3 /* TNodeType.AnyRNode */ | 4 /* TNodeType.Container */);
        if (parentTNode.flags & 2 /* TNodeFlags.isComponentHost */) {
            ngDevMode && assertTNodeForLView(parentTNode, lView);
            const encapsulation = tView.data[parentTNode.directiveStart].encapsulation;
            // We've got a parent which is an element in the current view. We just need to verify if the
            // parent element is not a component. Component's content nodes are not inserted immediately
            // because they will be projected, and so doing insert at this point would be wasteful.
            // Since the projection would then move it to its final destination. Note that we can't
            // make this assumption when using the Shadow DOM, because the native projection placeholders
            // (<content> or <slot>) have to be in place as elements are being inserted.
            if (encapsulation === ViewEncapsulation.None ||
                encapsulation === ViewEncapsulation.Emulated) {
                return null;
            }
        }
        return getNativeByTNode(parentTNode, lView);
    }
}
/**
 * Inserts a native node before another native node for a given parent.
 * This is a utility function that can be used when native nodes were determined.
 */
export function nativeInsertBefore(renderer, parent, child, beforeNode, isMove) {
    ngDevMode && ngDevMode.rendererInsertBefore++;
    renderer.insertBefore(parent, child, beforeNode, isMove);
}
function nativeAppendChild(renderer, parent, child) {
    ngDevMode && ngDevMode.rendererAppendChild++;
    ngDevMode && assertDefined(parent, 'parent node must be defined');
    renderer.appendChild(parent, child);
}
function nativeAppendOrInsertBefore(renderer, parent, child, beforeNode, isMove) {
    if (beforeNode !== null) {
        nativeInsertBefore(renderer, parent, child, beforeNode, isMove);
    }
    else {
        nativeAppendChild(renderer, parent, child);
    }
}
/** Removes a node from the DOM given its native parent. */
function nativeRemoveChild(renderer, parent, child, isHostElement) {
    renderer.removeChild(parent, child, isHostElement);
}
/** Checks if an element is a `<template>` node. */
function isTemplateNode(node) {
    return node.tagName === 'TEMPLATE' && node.content !== undefined;
}
/**
 * Returns a native parent of a given native node.
 */
export function nativeParentNode(renderer, node) {
    return renderer.parentNode(node);
}
/**
 * Returns a native sibling of a given native node.
 */
export function nativeNextSibling(renderer, node) {
    return renderer.nextSibling(node);
}
/**
 * Find a node in front of which `currentTNode` should be inserted.
 *
 * This method determines the `RNode` in front of which we should insert the `currentRNode`. This
 * takes `TNode.insertBeforeIndex` into account if i18n code has been invoked.
 *
 * @param parentTNode parent `TNode`
 * @param currentTNode current `TNode` (The node which we would like to insert into the DOM)
 * @param lView current `LView`
 */
function getInsertInFrontOfRNode(parentTNode, currentTNode, lView) {
    return _getInsertInFrontOfRNodeWithI18n(parentTNode, currentTNode, lView);
}
/**
 * Find a node in front of which `currentTNode` should be inserted. (Does not take i18n into
 * account)
 *
 * This method determines the `RNode` in front of which we should insert the `currentRNode`. This
 * does not take `TNode.insertBeforeIndex` into account.
 *
 * @param parentTNode parent `TNode`
 * @param currentTNode current `TNode` (The node which we would like to insert into the DOM)
 * @param lView current `LView`
 */
export function getInsertInFrontOfRNodeWithNoI18n(parentTNode, currentTNode, lView) {
    if (parentTNode.type & (8 /* TNodeType.ElementContainer */ | 32 /* TNodeType.Icu */)) {
        return getNativeByTNode(parentTNode, lView);
    }
    return null;
}
/**
 * Tree shakable boundary for `getInsertInFrontOfRNodeWithI18n` function.
 *
 * This function will only be set if i18n code runs.
 */
let _getInsertInFrontOfRNodeWithI18n = getInsertInFrontOfRNodeWithNoI18n;
/**
 * Tree shakable boundary for `processI18nInsertBefore` function.
 *
 * This function will only be set if i18n code runs.
 */
let _processI18nInsertBefore;
export function setI18nHandling(getInsertInFrontOfRNodeWithI18n, processI18nInsertBefore) {
    _getInsertInFrontOfRNodeWithI18n = getInsertInFrontOfRNodeWithI18n;
    _processI18nInsertBefore = processI18nInsertBefore;
}
/**
 * Appends the `child` native node (or a collection of nodes) to the `parent`.
 *
 * @param tView The `TView' to be appended
 * @param lView The current LView
 * @param childRNode The native child (or children) that should be appended
 * @param childTNode The TNode of the child element
 */
export function appendChild(tView, lView, childRNode, childTNode) {
    const parentRNode = getParentRElement(tView, childTNode, lView);
    const renderer = lView[RENDERER];
    const parentTNode = childTNode.parent || lView[T_HOST];
    const anchorNode = getInsertInFrontOfRNode(parentTNode, childTNode, lView);
    if (parentRNode != null) {
        if (Array.isArray(childRNode)) {
            for (let i = 0; i < childRNode.length; i++) {
                nativeAppendOrInsertBefore(renderer, parentRNode, childRNode[i], anchorNode, false);
            }
        }
        else {
            nativeAppendOrInsertBefore(renderer, parentRNode, childRNode, anchorNode, false);
        }
    }
    _processI18nInsertBefore !== undefined &&
        _processI18nInsertBefore(renderer, childTNode, lView, childRNode, parentRNode);
}
/**
 * Returns the first native node for a given LView, starting from the provided TNode.
 *
 * Native nodes are returned in the order in which those appear in the native tree (DOM).
 */
function getFirstNativeNode(lView, tNode) {
    if (tNode !== null) {
        ngDevMode &&
            assertTNodeType(tNode, 3 /* TNodeType.AnyRNode */ | 12 /* TNodeType.AnyContainer */ | 32 /* TNodeType.Icu */ | 16 /* TNodeType.Projection */);
        const tNodeType = tNode.type;
        if (tNodeType & 3 /* TNodeType.AnyRNode */) {
            return getNativeByTNode(tNode, lView);
        }
        else if (tNodeType & 4 /* TNodeType.Container */) {
            return getBeforeNodeForView(-1, lView[tNode.index]);
        }
        else if (tNodeType & 8 /* TNodeType.ElementContainer */) {
            const elIcuContainerChild = tNode.child;
            if (elIcuContainerChild !== null) {
                return getFirstNativeNode(lView, elIcuContainerChild);
            }
            else {
                const rNodeOrLContainer = lView[tNode.index];
                if (isLContainer(rNodeOrLContainer)) {
                    return getBeforeNodeForView(-1, rNodeOrLContainer);
                }
                else {
                    return unwrapRNode(rNodeOrLContainer);
                }
            }
        }
        else if (tNodeType & 32 /* TNodeType.Icu */) {
            let nextRNode = icuContainerIterate(tNode, lView);
            let rNode = nextRNode();
            // If the ICU container has no nodes, than we use the ICU anchor as the node.
            return rNode || unwrapRNode(lView[tNode.index]);
        }
        else {
            const projectionNodes = getProjectionNodes(lView, tNode);
            if (projectionNodes !== null) {
                if (Array.isArray(projectionNodes)) {
                    return projectionNodes[0];
                }
                const parentView = getLViewParent(lView[DECLARATION_COMPONENT_VIEW]);
                ngDevMode && assertParentView(parentView);
                return getFirstNativeNode(parentView, projectionNodes);
            }
            else {
                return getFirstNativeNode(lView, tNode.next);
            }
        }
    }
    return null;
}
export function getProjectionNodes(lView, tNode) {
    if (tNode !== null) {
        const componentView = lView[DECLARATION_COMPONENT_VIEW];
        const componentHost = componentView[T_HOST];
        const slotIdx = tNode.projection;
        ngDevMode && assertProjectionSlots(lView);
        return componentHost.projection[slotIdx];
    }
    return null;
}
export function getBeforeNodeForView(viewIndexInContainer, lContainer) {
    const nextViewIndex = CONTAINER_HEADER_OFFSET + viewIndexInContainer + 1;
    if (nextViewIndex < lContainer.length) {
        const lView = lContainer[nextViewIndex];
        const firstTNodeOfView = lView[TVIEW].firstChild;
        if (firstTNodeOfView !== null) {
            return getFirstNativeNode(lView, firstTNodeOfView);
        }
    }
    return lContainer[NATIVE];
}
/**
 * Removes a native node itself using a given renderer. To remove the node we are looking up its
 * parent from the native tree as not all platforms / browsers support the equivalent of
 * node.remove().
 *
 * @param renderer A renderer to be used
 * @param rNode The native node that should be removed
 * @param isHostElement A flag indicating if a node to be removed is a host of a component.
 */
export function nativeRemoveNode(renderer, rNode, isHostElement) {
    ngDevMode && ngDevMode.rendererRemoveNode++;
    const nativeParent = nativeParentNode(renderer, rNode);
    if (nativeParent) {
        nativeRemoveChild(renderer, nativeParent, rNode, isHostElement);
    }
}
/**
 * Performs the operation of `action` on the node. Typically this involves inserting or removing
 * nodes on the LView or projection boundary.
 */
function applyNodes(renderer, action, tNode, lView, parentRElement, beforeNode, isProjection) {
    while (tNode != null) {
        ngDevMode && assertTNodeForLView(tNode, lView);
        ngDevMode &&
            assertTNodeType(tNode, 3 /* TNodeType.AnyRNode */ | 12 /* TNodeType.AnyContainer */ | 16 /* TNodeType.Projection */ | 32 /* TNodeType.Icu */);
        const rawSlotValue = lView[tNode.index];
        const tNodeType = tNode.type;
        if (isProjection) {
            if (action === 0 /* WalkTNodeTreeAction.Create */) {
                rawSlotValue && attachPatchData(unwrapRNode(rawSlotValue), lView);
                tNode.flags |= 4 /* TNodeFlags.isProjected */;
            }
        }
        if ((tNode.flags & 64 /* TNodeFlags.isDetached */) !== 64 /* TNodeFlags.isDetached */) {
            if (tNodeType & 8 /* TNodeType.ElementContainer */) {
                applyNodes(renderer, action, tNode.child, lView, parentRElement, beforeNode, false);
                applyToElementOrContainer(action, renderer, parentRElement, rawSlotValue, beforeNode);
            }
            else if (tNodeType & 32 /* TNodeType.Icu */) {
                const nextRNode = icuContainerIterate(tNode, lView);
                let rNode;
                while (rNode = nextRNode()) {
                    applyToElementOrContainer(action, renderer, parentRElement, rNode, beforeNode);
                }
                applyToElementOrContainer(action, renderer, parentRElement, rawSlotValue, beforeNode);
            }
            else if (tNodeType & 16 /* TNodeType.Projection */) {
                applyProjectionRecursive(renderer, action, lView, tNode, parentRElement, beforeNode);
            }
            else {
                ngDevMode && assertTNodeType(tNode, 3 /* TNodeType.AnyRNode */ | 4 /* TNodeType.Container */);
                applyToElementOrContainer(action, renderer, parentRElement, rawSlotValue, beforeNode);
            }
        }
        tNode = isProjection ? tNode.projectionNext : tNode.next;
    }
}
function applyView(tView, lView, renderer, action, parentRElement, beforeNode) {
    applyNodes(renderer, action, tView.firstChild, lView, parentRElement, beforeNode, false);
}
/**
 * `applyProjection` performs operation on the projection.
 *
 * Inserting a projection requires us to locate the projected nodes from the parent component. The
 * complication is that those nodes themselves could be re-projected from their parent component.
 *
 * @param tView The `TView` of `LView` which needs to be inserted, detached, destroyed
 * @param lView The `LView` which needs to be inserted, detached, destroyed.
 * @param tProjectionNode node to project
 */
export function applyProjection(tView, lView, tProjectionNode) {
    const renderer = lView[RENDERER];
    const parentRNode = getParentRElement(tView, tProjectionNode, lView);
    const parentTNode = tProjectionNode.parent || lView[T_HOST];
    let beforeNode = getInsertInFrontOfRNode(parentTNode, tProjectionNode, lView);
    applyProjectionRecursive(renderer, 0 /* WalkTNodeTreeAction.Create */, lView, tProjectionNode, parentRNode, beforeNode);
}
/**
 * `applyProjectionRecursive` performs operation on the projection specified by `action` (insert,
 * detach, destroy)
 *
 * Inserting a projection requires us to locate the projected nodes from the parent component. The
 * complication is that those nodes themselves could be re-projected from their parent component.
 *
 * @param renderer Render to use
 * @param action action to perform (insert, detach, destroy)
 * @param lView The LView which needs to be inserted, detached, destroyed.
 * @param tProjectionNode node to project
 * @param parentRElement parent DOM element for insertion/removal.
 * @param beforeNode Before which node the insertions should happen.
 */
function applyProjectionRecursive(renderer, action, lView, tProjectionNode, parentRElement, beforeNode) {
    const componentLView = lView[DECLARATION_COMPONENT_VIEW];
    const componentNode = componentLView[T_HOST];
    ngDevMode &&
        assertEqual(typeof tProjectionNode.projection, 'number', 'expecting projection index');
    const nodeToProjectOrRNodes = componentNode.projection[tProjectionNode.projection];
    if (Array.isArray(nodeToProjectOrRNodes)) {
        // This should not exist, it is a bit of a hack. When we bootstrap a top level node and we
        // need to support passing projectable nodes, so we cheat and put them in the TNode
        // of the Host TView. (Yes we put instance info at the T Level). We can get away with it
        // because we know that that TView is not shared and therefore it will not be a problem.
        // This should be refactored and cleaned up.
        for (let i = 0; i < nodeToProjectOrRNodes.length; i++) {
            const rNode = nodeToProjectOrRNodes[i];
            applyToElementOrContainer(action, renderer, parentRElement, rNode, beforeNode);
        }
    }
    else {
        let nodeToProject = nodeToProjectOrRNodes;
        const projectedComponentLView = componentLView[PARENT];
        applyNodes(renderer, action, nodeToProject, projectedComponentLView, parentRElement, beforeNode, true);
    }
}
/**
 * `applyContainer` performs an operation on the container and its views as specified by
 * `action` (insert, detach, destroy)
 *
 * Inserting a Container is complicated by the fact that the container may have Views which
 * themselves have containers or projections.
 *
 * @param renderer Renderer to use
 * @param action action to perform (insert, detach, destroy)
 * @param lContainer The LContainer which needs to be inserted, detached, destroyed.
 * @param parentRElement parent DOM element for insertion/removal.
 * @param beforeNode Before which node the insertions should happen.
 */
function applyContainer(renderer, action, lContainer, parentRElement, beforeNode) {
    ngDevMode && assertLContainer(lContainer);
    const anchor = lContainer[NATIVE]; // LContainer has its own before node.
    const native = unwrapRNode(lContainer);
    // An LContainer can be created dynamically on any node by injecting ViewContainerRef.
    // Asking for a ViewContainerRef on an element will result in a creation of a separate anchor
    // node (comment in the DOM) that will be different from the LContainer's host node. In this
    // particular case we need to execute action on 2 nodes:
    // - container's host node (this is done in the executeActionOnElementOrContainer)
    // - container's host node (this is done here)
    if (anchor !== native) {
        // This is very strange to me (Misko). I would expect that the native is same as anchor. I
        // don't see a reason why they should be different, but they are.
        //
        // If they are we need to process the second anchor as well.
        applyToElementOrContainer(action, renderer, parentRElement, anchor, beforeNode);
    }
    for (let i = CONTAINER_HEADER_OFFSET; i < lContainer.length; i++) {
        const lView = lContainer[i];
        applyView(lView[TVIEW], lView, renderer, action, parentRElement, anchor);
    }
}
/**
 * Writes class/style to element.
 *
 * @param renderer Renderer to use.
 * @param isClassBased `true` if it should be written to `class` (`false` to write to `style`)
 * @param rNode The Node to write to.
 * @param prop Property to write to. This would be the class/style name.
 * @param value Value to write. If `null`/`undefined`/`false` this is considered a remove (set/add
 *        otherwise).
 */
export function applyStyling(renderer, isClassBased, rNode, prop, value) {
    if (isClassBased) {
        // We actually want JS true/false here because any truthy value should add the class
        if (!value) {
            ngDevMode && ngDevMode.rendererRemoveClass++;
            renderer.removeClass(rNode, prop);
        }
        else {
            ngDevMode && ngDevMode.rendererAddClass++;
            renderer.addClass(rNode, prop);
        }
    }
    else {
        let flags = prop.indexOf('-') === -1 ? undefined : RendererStyleFlags2.DashCase;
        if (value == null /** || value === undefined */) {
            ngDevMode && ngDevMode.rendererRemoveStyle++;
            renderer.removeStyle(rNode, prop, flags);
        }
        else {
            // A value is important if it ends with `!important`. The style
            // parser strips any semicolons at the end of the value.
            const isImportant = typeof value === 'string' ? value.endsWith('!important') : false;
            if (isImportant) {
                // !important has to be stripped from the value for it to be valid.
                value = value.slice(0, -10);
                flags |= RendererStyleFlags2.Important;
            }
            ngDevMode && ngDevMode.rendererSetStyle++;
            renderer.setStyle(rNode, prop, value, flags);
        }
    }
}
/**
 * Write `cssText` to `RElement`.
 *
 * This function does direct write without any reconciliation. Used for writing initial values, so
 * that static styling values do not pull in the style parser.
 *
 * @param renderer Renderer to use
 * @param element The element which needs to be updated.
 * @param newValue The new class list to write.
 */
export function writeDirectStyle(renderer, element, newValue) {
    ngDevMode && assertString(newValue, '\'newValue\' should be a string');
    renderer.setAttribute(element, 'style', newValue);
    ngDevMode && ngDevMode.rendererSetStyle++;
}
/**
 * Write `className` to `RElement`.
 *
 * This function does direct write without any reconciliation. Used for writing initial values, so
 * that static styling values do not pull in the style parser.
 *
 * @param renderer Renderer to use
 * @param element The element which needs to be updated.
 * @param newValue The new class list to write.
 */
export function writeDirectClass(renderer, element, newValue) {
    ngDevMode && assertString(newValue, '\'newValue\' should be a string');
    if (newValue === '') {
        // There are tests in `google3` which expect `element.getAttribute('class')` to be `null`.
        renderer.removeAttribute(element, 'class');
    }
    else {
        renderer.setAttribute(element, 'class', newValue);
    }
    ngDevMode && ngDevMode.rendererSetClassName++;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9kZV9tYW5pcHVsYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9yZW5kZXIzL25vZGVfbWFuaXB1bGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBQ25ELE9BQU8sRUFBQyxtQkFBbUIsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ3hELE9BQU8sRUFBQyxVQUFVLEVBQUUsZUFBZSxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFDaEUsT0FBTyxFQUFDLGFBQWEsRUFBRSxXQUFXLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBQ3hGLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLGFBQWEsQ0FBQztBQUU5QyxPQUFPLEVBQUMsZ0JBQWdCLEVBQUUsV0FBVyxFQUFFLGdCQUFnQixFQUFFLHFCQUFxQixFQUFFLG1CQUFtQixFQUFDLE1BQU0sVUFBVSxDQUFDO0FBQ3JILE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUNwRCxPQUFPLEVBQUMsbUJBQW1CLEVBQUMsTUFBTSwwQkFBMEIsQ0FBQztBQUM3RCxPQUFPLEVBQUMsdUJBQXVCLEVBQUUsc0JBQXNCLEVBQWMsV0FBVyxFQUFFLE1BQU0sRUFBRSw2QkFBNkIsSUFBSSxPQUFPLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUVsSyxPQUFPLEVBQUMsbUJBQW1CLEVBQUMsTUFBTSx1QkFBdUIsQ0FBQztBQUMxRCxPQUFPLEVBQUMsZUFBZSxFQUFDLE1BQU0sNkJBQTZCLENBQUM7QUFDNUQsT0FBTyxFQUFpRiw2QkFBNkIsSUFBSSxPQUFPLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUMzSixPQUFPLEVBQUMsNkJBQTZCLElBQUksT0FBTyxFQUFDLE1BQU0s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QUFVLGdCQUFnQixDQUFDLFFBQWtCLEVBQUUsT0FBaUIsRUFBRSxRQUFnQjtJQUN0RixTQUFTLElBQUksWUFBWSxDQUFDLFFBQVEsRUFBRSxpQ0FBaUMsQ0FBQyxDQUFDO0lBQ3ZFLElBQUksUUFBUSxLQUFLLEVBQUUsRUFBRTtRQUNuQiwwRkFBMEY7UUFDMUYsUUFBUSxDQUFDLGVBQWUsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7S0FDNUM7U0FBTTtRQUNMLFFBQVEsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQztLQUNuRDtJQUNELFNBQVMsSUFBSSxTQUFTLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztBQUNoRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Vmlld0VuY2Fwc3VsYXRpb259IGZyb20gJy4uL21ldGFkYXRhL3ZpZXcnO1xuaW1wb3J0IHtSZW5kZXJlclN0eWxlRmxhZ3MyfSBmcm9tICcuLi9yZW5kZXIvYXBpX2ZsYWdzJztcbmltcG9ydCB7YWRkVG9BcnJheSwgcmVtb3ZlRnJvbUFycmF5fSBmcm9tICcuLi91dGlsL2FycmF5X3V0aWxzJztcbmltcG9ydCB7YXNzZXJ0RGVmaW5lZCwgYXNzZXJ0RXF1YWwsIGFzc2VydEZ1bmN0aW9uLCBhc3NlcnRTdHJpbmd9IGZyb20gJy4uL3V0aWwvYXNzZXJ0JztcbmltcG9ydCB7ZXNjYXBlQ29tbWVudFRleHR9IGZyb20gJy4uL3V0aWwvZG9tJztcblxuaW1wb3J0IHthc3NlcnRMQ29udGFpbmVyLCBhc3NlcnRMVmlldywgYXNzZXJ0UGFyZW50VmlldywgYXNzZXJ0UHJvamVjdGlvblNsb3RzLCBhc3NlcnRUTm9kZUZvckxWaWV3fSBmcm9tICcuL2Fzc2VydCc7XG5pbXBvcnQge2F0dGFjaFBhdGNoRGF0YX0gZnJvbSAnLi9jb250ZXh0X2Rpc2NvdmVyeSc7XG5pbXBvcnQge2ljdUNvbnRhaW5lckl0ZXJhdGV9IGZyb20gJy4vaTE4bi9pMThuX3RyZWVfc2hha2luZyc7XG5pbXBvcnQge0NPTlRBSU5FUl9IRUFERVJfT0ZGU0VULCBIQVNfVFJBTlNQTEFOVEVEX1ZJRVdTLCBMQ29udGFpbmVyLCBNT1ZFRF9WSUVXUywgTkFUSVZFLCB1bnVzZWRWYWx1ZUV4cG9ydFRvUGxhY2F0ZUFqZCBhcyB1bnVzZWQxfSBmcm9tICcuL2ludGVyZmFjZXMvY29udGFpbmVyJztcbmltcG9ydCB7Q29tcG9uZW50RGVmfSBmcm9tICcuL2ludGVyZmFjZXMvZGVmaW5pdGlvbic7XG5pbXBvcnQge05vZGVJbmplY3RvckZhY3Rvcnl9IGZyb20gJy4vaW50ZXJmYWNlcy9pbmplY3Rvcic7XG5pbXBvcnQge3VucmVnaXN0ZXJMVmlld30gZnJvbSAnLi9pbnRlcmZhY2VzL2x2aWV3X3RyYWNraW5nJztcbmltcG9ydCB7VEVsZW1lbnROb2RlLCBUSWN1Q29udGFpbmVyTm9kZSwgVE5vZGUsIFROb2RlRmxhZ3MsIFROb2RlVHlwZSwgVFByb2plY3Rpb25Ob2RlLCB1bnVzZWRWYWx1ZUV4cG9ydFRvUGxhY2F0ZUFqZCBhcyB1bnVzZWQyfSBmcm9tICcuL2ludGVyZmFjZXMvbm9kZSc7XG5pbXBvcnQge3VudXNlZFZhbHVlRXhwb3J0VG9QbGFjYXRlQWpkIGFzIHVudXNlZDN9IGZyb20gJy4vaW50ZXJmYWNlcy9wcm9qZWN0aW9uJztcbmltcG9ydCB7UmVuZGVyZXIsIHVudXNlZFZhbHVlRXhwb3J0VG9QbGFjYXRlQWpkIGFzIHVudXNlZDR9IGZyb20gJy4vaW50ZXJmYWNlcy9yZW5kZXJlcic7XG5pbXBvcnQge1JDb21tZW50LCBSRWxlbWVudCwgUk5vZGUsIFJUZW1wbGF0ZSwgUlRleHR9IGZyb20gJy4vaW50ZXJmYWNlcy9yZW5kZXJlcl9kb20nO1xuaW1wb3J0IHtpc0xDb250YWluZXIsIGlzTFZpZXd9IGZyb20gJy4vaW50ZXJmYWNlcy90eXBlX2NoZWNrcyc7XG5pbXBvcnQge0NISUxEX0hFQUQsIENMRUFOVVAsIERFQ0xBUkFUSU9OX0NPTVBPTkVOVF9WSUVXLCBERUNMQVJBVElPTl9MQ09OVEFJTkVSLCBEZXN0cm95SG9va0RhdGEsIEZMQUdTLCBIb29rRGF0YSwgSG9va0ZuLCBIT1NULCBMVmlldywgTFZpZXdGbGFncywgTkVYVCwgUEFSRU5ULCBRVUVSSUVTLCBSRU5ERVJFUiwgVF9IT1NULCBUVklFVywgVFZpZXcsIFRWaWV3VHlwZSwgdW51c2VkVmFsdWVFeHBvcnRUb1BsYWNhdGVBamQgYXMgdW51c2VkNX0gZnJvbSAnLi9pbnRlcmZhY2VzL3ZpZXcnO1xuaW1wb3J0IHthc3NlcnRUTm9kZVR5cGV9IGZyb20gJy4vbm9kZV9hc3NlcnQnO1xuaW1wb3J0IHtwcm9maWxlciwgUHJvZmlsZXJFdmVudH0gZnJvbSAnLi9wcm9maWxlcic7XG5pbXBvcnQge2dldExWaWV3UGFyZW50fSBmcm9tICcuL3V0aWwvdmlld190cmF2ZXJzYWxfdXRpbHMnO1xuaW1wb3J0IHtnZXROYXRpdmVCeVROb2RlLCB1bndyYXBSTm9kZSwgdXBkYXRlVHJhbnNwbGFudGVkVmlld0NvdW50fSBmcm9tICcuL3V0aWwvdmlld191dGlscyc7XG5cblxuXG5jb25zdCB1bnVzZWRWYWx1ZVRvUGxhY2F0ZUFqZCA9IHVudXNlZDEgKyB1bnVzZWQyICsgdW51c2VkMyArIHVudXNlZDQgKyB1bnVzZWQ1O1xuXG5jb25zdCBlbnVtIFdhbGtUTm9kZVRyZWVBY3Rpb24ge1xuICAvKiogbm9kZSBjcmVhdGUgaW4gdGhlIG5hdGl2ZSBlbnZpcm9ubWVudC4gUnVuIG9uIGluaXRpYWwgY3JlYXRpb24uICovXG4gIENyZWF0ZSA9IDAsXG5cbiAgLyoqXG4gICAqIG5vZGUgaW5zZXJ0IGluIHRoZSBuYXRpdmUgZW52aXJvbm1lbnQuXG4gICAqIFJ1biB3aGVuIGV4aXN0aW5nIG5vZGUgaGFzIGJlZW4gZGV0YWNoZWQgYW5kIG5lZWRzIHRvIGJlIHJlLWF0dGFjaGVkLlxuICAgKi9cbiAgSW5zZXJ0ID0gMSxcblxuICAvKiogbm9kZSBkZXRhY2ggZnJvbSB0aGUgbmF0aXZlIGVudmlyb25tZW50ICovXG4gIERldGFjaCA9IDIsXG5cbiAgLyoqIG5vZGUgZGVzdHJ1Y3Rpb24gdXNpbmcgdGhlIHJlbmRlcmVyJ3MgQVBJICovXG4gIERlc3Ryb3kgPSAzLFxufVxuXG5cblxuLyoqXG4gKiBOT1RFOiBmb3IgcGVyZm9ybWFuY2UgcmVhc29ucywgdGhlIHBvc3NpYmxlIGFjdGlvbnMgYXJlIGlubGluZWQgd2l0aGluIHRoZSBmdW5jdGlvbiBpbnN0ZWFkIG9mXG4gKiBiZWluZyBwYXNzZWQgYXMgYW4gYXJndW1lbnQuXG4gKi9cbmZ1bmN0aW9uIGFwcGx5VG9FbGVtZW50T3JDb250YWluZXIoXG4gICAgYWN0aW9uOiBXYWxrVE5vZGVUcmVlQWN0aW9uLCByZW5kZXJlcjogUmVuZGVyZXIsIHBhcmVudDogUkVsZW1lbnR8bnVsbCxcbiAgICBsTm9kZVRvSGFuZGxlOiBSTm9kZXxMQ29udGFpbmVyfExWaWV3LCBiZWZvcmVOb2RlPzogUk5vZGV8bnVsbCkge1xuICAvLyBJZiB0aGlzIHNsb3Qgd2FzIGFsbG9jYXRlZCBmb3IgYSB0ZXh0IG5vZGUgZHluYW1pY2FsbHkgY3JlYXRlZCBieSBpMThuLCB0aGUgdGV4dCBub2RlIGl0c2VsZlxuICAvLyB3b24ndCBiZSBjcmVhdGVkIHVudGlsIGkxOG5BcHBseSgpIGluIHRoZSB1cGRhdGUgYmxvY2ssIHNvIHRoaXMgbm9kZSBzaG91bGQgYmUgc2tpcHBlZC5cbiAgLy8gRm9yIG1vcmUgaW5mbywgc2VlIFwiSUNVIGV4cHJlc3Npb25zIHNob3VsZCB3b3JrIGluc2lkZSBhbiBuZ1RlbXBsYXRlT3V0bGV0IGluc2lkZSBhbiBuZ0ZvclwiXG4gIC8vIGluIGBpMThuX3NwZWMudHNgLlxuICBpZiAobE5vZGVUb0hhbmRsZSAhPSBudWxsKSB7XG4gICAgbGV0IGxDb250YWluZXI6IExDb250YWluZXJ8dW5kZWZpbmVkO1xuICAgIGxldCBpc0NvbXBvbmVudCA9IGZhbHNlO1xuICAgIC8vIFdlIGFyZSBleHBlY3RpbmcgYW4gUk5vZGUsIGJ1dCBpbiB0aGUgY2FzZSBvZiBhIGNvbXBvbmVudCBvciBMQ29udGFpbmVyIHRoZSBgUk5vZGVgIGlzXG4gICAgLy8gd3JhcHBlZCBpbiBhbiBhcnJheSB3aGljaCBuZWVkcyB0byBiZSB1bndyYXBwZWQuIFdlIG5lZWQgdG8ga25vdyBpZiBpdCBpcyBhIGNvbXBvbmVudCBhbmQgaWZcbiAgICAvLyBpdCBoYXMgTENvbnRhaW5lciBzbyB0aGF0IHdlIGNhbiBwcm9jZXNzIGFsbCBvZiB0aG9zZSBjYXNlcyBhcHByb3ByaWF0ZWx5LlxuICAgIGlmIChpc0xDb250YWluZXIobE5vZGVUb0hhbmRsZSkpIHtcbiAgICAgIGxDb250YWluZXIgPSBsTm9kZVRvSGFuZGxlO1xuICAgIH0gZWxzZSBpZiAoaXNMVmlldyhsTm9kZVRvSGFuZGxlKSkge1xuICAgICAgaXNDb21wb25lbnQgPSB0cnVlO1xuICAgICAgbmdEZXZNb2RlICYmIGFzc2VydERlZmluZWQobE5vZGVUb0hhbmRsZVtIT1NUXSwgJ0hPU1QgbXVzdCBiZSBkZWZpbmVkIGZvciBhIGNvbXBvbmVudCBMVmlldycpO1xuICAgICAgbE5vZGVUb0hhbmRsZSA9IGxOb2RlVG9IYW5kbGVbSE9TVF0hO1xuICAgIH1cbiAgICBjb25zdCByTm9kZTogUk5vZGUgPSB1bndyYXBSTm9kZShsTm9kZVRvSGFuZGxlKTtcblxuICAgIGlmIChhY3Rpb24gPT09IFdhbGtUTm9kZVRyZWVBY3Rpb24uQ3JlYXRlICYmIHBhcmVudCAhPT0gbnVsbCkge1xuICAgICAgaWYgKGJlZm9yZU5vZGUgPT0gbnVsbCkge1xuICAgICAgICBuYXRpdmVBcHBlbmRDaGlsZChyZW5kZXJlciwgcGFyZW50LCByTm9kZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuYXRpdmVJbnNlcnRCZWZvcmUocmVuZGVyZXIsIHBhcmVudCwgck5vZGUsIGJlZm9yZU5vZGUgfHwgbnVsbCwgdHJ1ZSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChhY3Rpb24gPT09IFdhbGtUTm9kZVRyZWVBY3Rpb24uSW5zZXJ0ICYmIHBhcmVudCAhPT0gbnVsbCkge1xuICAgICAgbmF0aXZlSW5zZXJ0QmVmb3JlKHJlbmRlcmVyLCBwYXJlbnQsIHJOb2RlLCBiZWZvcmVOb2RlIHx8IG51bGwsIHRydWUpO1xuICAgIH0gZWxzZSBpZiAoYWN0aW9uID09PSBXYWxrVE5vZGVUcmVlQWN0aW9uLkRldGFjaCkge1xuICAgICAgbmF0aXZlUmVtb3ZlTm9kZShyZW5kZXJlciwgck5vZGUsIGlzQ29tcG9uZW50KTtcbiAgICB9IGVsc2UgaWYgKGFjdGlvbiA9PT0gV2Fsa1ROb2RlVHJlZUFjdGlvbi5EZXN0cm95KSB7XG4gICAgICBuZ0Rldk1vZGUgJiYgbmdEZXZNb2RlLnJlbmRlcmVyRGVzdHJveU5vZGUrKztcbiAgICAgIHJlbmRlcmVyLmRlc3Ryb3lOb2RlIShyTm9kZSk7XG4gICAgfVxuICAgIGlmIChsQ29udGFpbmVyICE9IG51bGwpIHtcbiAgICAgIGFwcGx5Q29udGFpbmVyKHJlbmRlcmVyLCBhY3Rpb24sIGxDb250YWluZXIsIHBhcmVudCwgYmVmb3JlTm9kZSk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVUZXh0Tm9kZShyZW5kZXJlcjogUmVuZGVyZXIsIHZhbHVlOiBzdHJpbmcpOiBSVGV4dCB7XG4gIG5nRGV2TW9kZSAmJiBuZ0Rldk1vZGUucmVuZGVyZXJDcmVhdGVUZXh0Tm9kZSsrO1xuICBuZ0Rldk1vZGUgJiYgbmdEZXZNb2RlLnJlbmRlcmVyU2V0VGV4dCsrO1xuICByZXR1cm4gcmVuZGVyZXIuY3JlYXRlVGV4dCh2YWx1ZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1cGRhdGVUZXh0Tm9kZShyZW5kZXJlcjogUmVuZGVyZXIsIHJOb2RlOiBSVGV4dCwgdmFsdWU6IHN0cmluZyk6IHZvaWQge1xuICBuZ0Rldk1vZGUgJiYgbmdEZXZNb2RlLnJlbmRlcmVyU2V0VGV4dCsrO1xuICByZW5kZXJlci5zZXRWYWx1ZShyTm9kZSwgdmFsdWUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29tbWVudE5vZGUocmVuZGVyZXI6IFJlbmRlcmVyLCB2YWx1ZTogc3RyaW5nKTogUkNvbW1lbnQge1xuICBuZ0Rldk1vZGUgJiYgbmdEZXZNb2RlLnJlbmRlcmVyQ3JlYXRlQ29tbWVudCsrO1xuICByZXR1cm4gcmVuZGVyZXIuY3JlYXRlQ29tbWVudChlc2NhcGVDb21tZW50VGV4dCh2YWx1ZSkpO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuYXRpdmUgZWxlbWVudCBmcm9tIGEgdGFnIG5hbWUsIHVzaW5nIGEgcmVuZGVyZXIuXG4gKiBAcGFyYW0gcmVuZGVyZXIgQSByZW5kZXJlciB0byB1c2VcbiAqIEBwYXJhbSBuYW1lIHRoZSB0YWcgbmFtZVxuICogQHBhcmFtIG5hbWVzcGFjZSBPcHRpb25hbCBuYW1lc3BhY2UgZm9yIGVsZW1lbnQuXG4gKiBAcmV0dXJucyB0aGUgZWxlbWVudCBjcmVhdGVkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVFbGVtZW50Tm9kZShcbiAgICByZW5kZXJlcjogUmVuZGVyZXIsIG5hbWU6IHN0cmluZywgbmFtZXNwYWNlOiBzdHJpbmd8bnVsbCk6IFJFbGVtZW50IHtcbiAgbmdEZXZNb2RlICYmIG5nRGV2TW9kZS5yZW5kZXJlckNyZWF0ZUVsZW1lbnQrKztcbiAgcmV0dXJuIHJlbmRlcmVyLmNyZWF0ZUVsZW1lbnQobmFtZSwgbmFtZXNwYWNlKTtcbn1cblxuXG4vKipcbiAqIFJlbW92ZXMgYWxsIERPTSBlbGVtZW50cyBhc3NvY2lhdGVkIHdpdGggYSB2aWV3LlxuICpcbiAqIEJlY2F1c2Ugc29tZSByb290IG5vZGVzIG9mIHRoZSB2aWV3IG1heSBiZSBjb250YWluZXJzLCB3ZSBzb21ldGltZXMgbmVlZFxuICogdG8gcHJvcGFnYXRlIGRlZXBseSBpbnRvIHRoZSBuZXN0ZWQgY29udGFpbmVycyB0byByZW1vdmUgYWxsIGVsZW1lbnRzIGluIHRoZVxuICogdmlld3MgYmVuZWF0aCBpdC5cbiAqXG4gKiBAcGFyYW0gdFZpZXcgVGhlIGBUVmlldycgb2YgdGhlIGBMVmlld2AgZnJvbSB3aGljaCBlbGVtZW50cyBzaG91bGQgYmUgYWRkZWQgb3IgcmVtb3ZlZFxuICogQHBhcmFtIGxWaWV3IFRoZSB2aWV3IGZyb20gd2hpY2ggZWxlbWVudHMgc2hvdWxkIGJlIGFkZGVkIG9yIHJlbW92ZWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlbW92ZVZpZXdGcm9tQ29udGFpbmVyKHRWaWV3OiBUVmlldywgbFZpZXc6IExWaWV3KTogdm9pZCB7XG4gIGNvbnN0IHJlbmRlcmVyID0gbFZpZXdbUkVOREVSRVJdO1xuICBhcHBseVZpZXcodFZpZXcsIGxWaWV3LCByZW5kZXJlciwgV2Fsa1ROb2RlVHJlZUFjdGlvbi5EZXRhY2gsIG51bGwsIG51bGwpO1xuICBsVmlld1tIT1NUXSA9IG51bGw7XG4gIGxWaWV3W1RfSE9TVF0gPSBudWxsO1xufVxuXG4vKipcbiAqIEFkZHMgYWxsIERPTSBlbGVtZW50cyBhc3NvY2lhdGVkIHdpdGggYSB2aWV3LlxuICpcbiAqIEJlY2F1c2Ugc29tZSByb290IG5vZGVzIG9mIHRoZSB2aWV3IG1heSBiZSBjb250YWluZXJzLCB3ZSBzb21ldGltZXMgbmVlZFxuICogdG8gcHJvcGFnYXRlIGRlZXBseSBpbnRvIHRoZSBuZXN0ZWQgY29udGFpbmVycyB0byBhZGQgYWxsIGVsZW1lbnRzIGluIHRoZVxuICogdmlld3MgYmVuZWF0aCBpdC5cbiAqXG4gKiBAcGFyYW0gdFZpZXcgVGhlIGBUVmlldycgb2YgdGhlIGBMVmlld2AgZnJvbSB3aGljaCBlbGVtZW50cyBzaG91bGQgYmUgYWRkZWQgb3IgcmVtb3ZlZFxuICogQHBhcmFtIHBhcmVudFROb2RlIFRoZSBgVE5vZGVgIHdoZXJlIHRoZSBgTFZpZXdgIHNob3VsZCBiZSBhdHRhY2hlZCB0by5cbiAqIEBwYXJhbSByZW5kZXJlciBDdXJyZW50IHJlbmRlcmVyIHRvIHVzZSBmb3IgRE9NIG1hbmlwdWxhdGlvbnMuXG4gKiBAcGFyYW0gbFZpZXcgVGhlIHZpZXcgZnJvbSB3aGljaCBlbGVtZW50cyBzaG91bGQgYmUgYWRkZWQgb3IgcmVtb3ZlZFxuICogQHBhcmFtIHBhcmVudE5hdGl2ZU5vZGUgVGhlIHBhcmVudCBgUkVsZW1lbnRgIHdoZXJlIGl0IHNob3VsZCBiZSBpbnNlcnRlZCBpbnRvLlxuICogQHBhcmFtIGJlZm9yZU5vZGUgVGhlIG5vZGUgYmVmb3JlIHdoaWNoIGVsZW1lbnRzIHNob3VsZCBiZSBhZGRlZCwgaWYgaW5zZXJ0IG1vZGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFkZFZpZXdUb0NvbnRhaW5lcihcbiAgICB0VmlldzogVFZpZXcsIHBhcmVudFROb2RlOiBUTm9kZSwgcmVuZGVyZXI6IFJlbmRlcmVyLCBsVmlldzogTFZpZXcsIHBhcmVudE5hdGl2ZU5vZGU6IFJFbGVtZW50LFxuICAgIGJlZm9yZU5vZGU6IFJOb2RlfG51bGwpOiB2b2lkIHtcbiAgbFZpZXdbSE9TVF0gPSBwYXJlbnROYXRpdmVOb2RlO1xuICBsVmlld1tUX0hPU1RdID0gcGFyZW50VE5vZGU7XG4gIGFwcGx5Vmlldyh0VmlldywgbFZpZXcsIHJlbmRlcmVyLCBXYWxrVE5vZGVUcmVlQWN0aW9uLkluc2VydCwgcGFyZW50TmF0aXZlTm9kZSwgYmVmb3JlTm9kZSk7XG59XG5cblxuLyoqXG4gKiBEZXRhY2ggYSBgTFZpZXdgIGZyb20gdGhlIERPTSBieSBkZXRhY2hpbmcgaXRzIG5vZGVzLlxuICpcbiAqIEBwYXJhbSB0VmlldyBUaGUgYFRWaWV3JyBvZiB0aGUgYExWaWV3YCB0byBiZSBkZXRhY2hlZFxuICogQHBhcmFtIGxWaWV3IHRoZSBgTFZpZXdgIHRvIGJlIGRldGFjaGVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyRGV0YWNoVmlldyh0VmlldzogVFZpZXcsIGxWaWV3OiBMVmlldykge1xuICBhcHBseVZpZXcodFZpZXcsIGxWaWV3LCBsVmlld1tSRU5ERVJFUl0sIFdhbGtUTm9kZVRyZWVBY3Rpb24uRGV0YWNoLCBudWxsLCBudWxsKTtcbn1cblxuLyoqXG4gKiBUcmF2ZXJzZXMgZG93biBhbmQgdXAgdGhlIHRyZWUgb2Ygdmlld3MgYW5kIGNvbnRhaW5lcnMgdG8gcmVtb3ZlIGxpc3RlbmVycyBhbmRcbiAqIGNhbGwgb25EZXN0cm95IGNhbGxiYWNrcy5cbiAqXG4gKiBOb3RlczpcbiAqICAtIEJlY2F1c2UgaXQncyB1c2VkIGZvciBvbkRlc3Ryb3kgY2FsbHMsIGl0IG5lZWRzIHRvIGJlIGJvdHRvbS11cC5cbiAqICAtIE11c3QgcHJvY2VzcyBjb250YWluZXJzIGluc3RlYWQgb2YgdGhlaXIgdmlld3MgdG8gYXZvaWQgc3BsaWNpbmdcbiAqICB3aGVuIHZpZXdzIGFyZSBkZXN0cm95ZWQgYW5kIHJlLWFkZGVkLlxuICogIC0gVXNpbmcgYSB3aGlsZSBsb29wIGJlY2F1c2UgaXQncyBmYXN0ZXIgdGhhbiByZWN1cnNpb25cbiAqICAtIERlc3Ryb3kgb25seSBjYWxsZWQgb24gbW92ZW1lbnQgdG8gc2libGluZyBvciBtb3ZlbWVudCB0byBwYXJlbnQgKGxhdGVyYWxseSBvciB1cClcbiAqXG4gKiAgQHBhcmFtIHJvb3RWaWV3IFRoZSB2aWV3IHRvIGRlc3Ryb3lcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlc3Ryb3lWaWV3VHJlZShyb290VmlldzogTFZpZXcpOiB2b2lkIHtcbiAgLy8gSWYgdGhlIHZpZXcgaGFzIG5vIGNoaWxkcmVuLCB3ZSBjYW4gY2xlYW4gaXQgdXAgYW5kIHJldHVybiBlYXJseS5cbiAgbGV0IGxWaWV3T3JMQ29udGFpbmVyID0gcm9vdFZpZXdbQ0hJTERfSEVBRF07XG4gIGlmICghbFZpZXdPckxDb250YWluZXIpIHtcbiAgICByZXR1cm4gY2xlYW5VcFZpZXcocm9vdFZpZXdbVFZJRVddLCByb290Vmlldyk7XG4gIH1cblxuICB3aGlsZSAobFZpZXdPckxDb250YWluZXIpIHtcbiAgICBsZXQgbmV4dDogTFZpZXd8TENvbnRhaW5lcnxudWxsID0gbnVsbDtcblxuICAgIGlmIChpc0xWaWV3KGxWaWV3T3JMQ29udGFpbmVyKSkge1xuICAgICAgLy8gSWYgTFZpZXcsIHRyYXZlcnNlIGRvd24gdG8gY2hpbGQuXG4gICAgICBuZXh0ID0gbFZpZXdPckxDb250YWluZXJbQ0hJTERfSEVBRF07XG4gICAgfSBlbHNlIHtcbiAgICAgIG5nRGV2TW9kZSAmJiBhc3NlcnRMQ29udGFpbmVyKGxWaWV3T3JMQ29udGFpbmVyKTtcbiAgICAgIC8vIElmIGNvbnRhaW5lciwgdHJhdmVyc2UgZG93biB0byBpdHMgZmlyc3QgTFZpZXcuXG4gICAgICBjb25zdCBmaXJzdFZpZXc6IExWaWV3fHVuZGVmaW5lZCA9IGxWaWV3T3JMQ29udGFpbmVyW0NPTlRBSU5FUl9IRUFERVJfT0ZGU0VUXTtcbiAgICAgIGlmIChmaXJzdFZpZXcpIG5leHQgPSBmaXJzdFZpZXc7XG4gICAgfVxuXG4gICAgaWYgKCFuZXh0KSB7XG4gICAgICAvLyBPbmx5IGNsZWFuIHVwIHZpZXcgd2hlbiBtb3ZpbmcgdG8gdGhlIHNpZGUgb3IgdXAsIGFzIGRlc3Ryb3kgaG9va3NcbiAgICAgIC8vIHNob3VsZCBiZSBjYWxsZWQgaW4gb3JkZXIgZnJvbSB0aGUgYm90dG9tIHVwLlxuICAgICAgd2hpbGUgKGxWaWV3T3JMQ29udGFpbmVyICYmICFsVmlld09yTENvbnRhaW5lciFbTkVYVF0gJiYgbFZpZXdPckxDb250YWluZXIgIT09IHJvb3RWaWV3KSB7XG4gICAgICAgIGlmIChpc0xWaWV3KGxWaWV3T3JMQ29udGFpbmVyKSkge1xuICAgICAgICAgIGNsZWFuVXBWaWV3KGxWaWV3T3JMQ29udGFpbmVyW1RWSUVXXSwgbFZpZXdPckxDb250YWluZXIpO1xuICAgICAgICB9XG4gICAgICAgIGxWaWV3T3JMQ29udGFpbmVyID0gbFZpZXdPckxDb250YWluZXJbUEFSRU5UXTtcbiAgICAgIH1cbiAgICAgIGlmIChsVmlld09yTENvbnRhaW5lciA9PT0gbnVsbCkgbFZpZXdPckxDb250YWluZXIgPSByb290VmlldztcbiAgICAgIGlmIChpc0xWaWV3KGxWaWV3T3JMQ29udGFpbmVyKSkge1xuICAgICAgICBjbGVhblVwVmlldyhsVmlld09yTENvbnRhaW5lcltUVklFV10sIGxWaWV3T3JMQ29udGFpbmVyKTtcbiAgICAgIH1cbiAgICAgIG5leHQgPSBsVmlld09yTENvbnRhaW5lciAmJiBsVmlld09yTENvbnRhaW5lciFbTkVYVF07XG4gICAgfVxuICAgIGxWaWV3T3JMQ29udGFpbmVyID0gbmV4dDtcbiAgfVxufVxuXG4vKipcbiAqIEluc2VydHMgYSB2aWV3IGludG8gYSBjb250YWluZXIuXG4gKlxuICogVGhpcyBhZGRzIHRoZSB2aWV3IHRvIHRoZSBjb250YWluZXIncyBhcnJheSBvZiBhY3RpdmUgdmlld3MgaW4gdGhlIGNvcnJlY3RcbiAqIHBvc2l0aW9uLiBJdCBhbHNvIGFkZHMgdGhlIHZpZXcncyBlbGVtZW50cyB0byB0aGUgRE9NIGlmIHRoZSBjb250YWluZXIgaXNuJ3QgYVxuICogcm9vdCBub2RlIG9mIGFub3RoZXIgdmlldyAoaW4gdGhhdCBjYXNlLCB0aGUgdmlldydzIGVsZW1lbnRzIHdpbGwgYmUgYWRkZWQgd2hlblxuICogdGhlIGNvbnRhaW5lcidzIHBhcmVudCB2aWV3IGlzIGFkZGVkIGxhdGVyKS5cbiAqXG4gKiBAcGFyYW0gdFZpZXcgVGhlIGBUVmlldycgb2YgdGhlIGBMVmlld2AgdG8gaW5zZXJ0XG4gKiBAcGFyYW0gbFZpZXcgVGhlIHZpZXcgdG8gaW5zZXJ0XG4gKiBAcGFyYW0gbENvbnRhaW5lciBUaGUgY29udGFpbmVyIGludG8gd2hpY2ggdGhlIHZpZXcgc2hvdWxkIGJlIGluc2VydGVkXG4gKiBAcGFyYW0gaW5kZXggV2hpY2ggaW5kZXggaW4gdGhlIGNvbnRhaW5lciB0byBpbnNlcnQgdGhlIGNoaWxkIHZpZXcgaW50b1xuICovXG5leHBvcnQgZnVuY3Rpb24gaW5zZXJ0Vmlldyh0VmlldzogVFZpZXcsIGxWaWV3OiBMVmlldywgbENvbnRhaW5lcjogTENvbnRhaW5lciwgaW5kZXg6IG51bWJlcikge1xuICBuZ0Rldk1vZGUgJiYgYXNzZXJ0TFZpZXcobFZpZXcpO1xuICBuZ0Rldk1vZGUgJiYgYXNzZXJ0TENvbnRhaW5lcihsQ29udGFpbmVyKTtcbiAgY29uc3QgaW5kZXhJbkNvbnRhaW5lciA9IENPTlRBSU5FUl9IRUFERVJfT0ZGU0VUICsgaW5kZXg7XG4gIGNvbnN0IGNvbnRhaW5lckxlbmd0aCA9IGxDb250YWluZXIubGVuZ3RoO1xuXG4gIGlmIChpbmRleCA+IDApIHtcbiAgICAvLyBUaGlzIGlzIGEgbmV3IHZpZXcsIHdlIG5lZWQgdG8gYWRkIGl0IHRvIHRoZSBjaGlsZHJlbi5cbiAgICBsQ29udGFpbmVyW2luZGV4SW5Db250YWluZXIgLSAxXVtORVhUXSA9IGxWaWV3O1xuICB9XG4gIGlmIChpbmRleCA8IGNvbnRhaW5lckxlbmd0aCAtIENPTlRBSU5FUl9IRUFERVJfT0ZGU0VUKSB7XG4gICAgbFZpZXdbTkVYVF0gPSBsQ29udGFpbmVyW2luZGV4SW5Db250YWluZXJdO1xuICAgIGFkZFRvQXJyYXkobENvbnRhaW5lciwgQ09OVEFJTkVSX0hFQURFUl9PRkZTRVQgKyBpbmRleCwgbFZpZXcpO1xuICB9IGVsc2Uge1xuICAgIGxDb250YWluZXIucHVzaChsVmlldyk7XG4gICAgbFZpZXdbTkVYVF0gPSBudWxsO1xuICB9XG5cbiAgbFZpZXdbUEFSRU5UXSA9IGxDb250YWluZXI7XG5cbiAgLy8gdHJhY2sgdmlld3Mgd2hlcmUgZGVjbGFyYXRpb24gYW5kIGluc2VydGlvbiBwb2ludHMgYXJlIGRpZmZlcmVudFxuICBjb25zdCBkZWNsYXJhdGlvbkxDb250YWluZXIgPSBsVmlld1tERUNMQVJBVElPTl9MQ09OVEFJTkVSXTtcbiAgaWYgKGRlY2xhcmF0aW9uTENvbnRhaW5lciAhPT0gbnVsbCAmJiBsQ29udGFpbmVyICE9PSBkZWNsYXJhdGlvbkxDb250YWluZXIpIHtcbiAgICB0cmFja01vdmVkVmlldyhkZWNsYXJhdGlvbkxDb250YWluZXIsIGxWaWV3KTtcbiAgfVxuXG4gIC8vIG5vdGlmeSBxdWVyeSB0aGF0IGEgbmV3IHZpZXcgaGFzIGJlZW4gYWRkZWRcbiAgY29uc3QgbFF1ZXJpZXMgPSBsVmlld1tRVUVSSUVTXTtcbiAgaWYgKGxRdWVyaWVzICE9PSBudWxsKSB7XG4gICAgbFF1ZXJpZXMuaW5zZXJ0Vmlldyh0Vmlldyk7XG4gIH1cblxuICAvLyBTZXRzIHRoZSBhdHRhY2hlZCBmbGFnXG4gIGxWaWV3W0ZMQUdTXSB8PSBMVmlld0ZsYWdzLkF0dGFjaGVkO1xufVxuXG4vKipcbiAqIFRyYWNrIHZpZXdzIGNyZWF0ZWQgZnJvbSB0aGUgZGVjbGFyYXRpb24gY29udGFpbmVyIChUZW1wbGF0ZVJlZikgYW5kIGluc2VydGVkIGludG8gYVxuICogZGlmZmVyZW50IExDb250YWluZXIuXG4gKi9cbmZ1bmN0aW9uIHRyYWNrTW92ZWRWaWV3KGRlY2xhcmF0aW9uQ29udGFpbmVyOiBMQ29udGFpbmVyLCBsVmlldzogTFZpZXcpIHtcbiAgbmdEZXZNb2RlICYmIGFzc2VydERlZmluZWQobFZpZXcsICdMVmlldyByZXF1aXJlZCcpO1xuICBuZ0Rldk1vZGUgJiYgYXNzZXJ0TENvbnRhaW5lcihkZWNsYXJhdGlvbkNvbnRhaW5lcik7XG4gIGNvbnN0IG1vdmVkVmlld3MgPSBkZWNsYXJhdGlvbkNvbnRhaW5lcltNT1ZFRF9WSUVXU107XG4gIGNvbnN0IGluc2VydGVkTENvbnRhaW5lciA9IGxWaWV3W1BBUkVOVF0gYXMgTENvbnRhaW5lcjtcbiAgbmdEZXZNb2RlICYmIGFzc2VydExDb250YWluZXIoaW5zZXJ0ZWRMQ29udGFpbmVyKTtcbiAgY29uc3QgaW5zZXJ0ZWRDb21wb25lbnRMVmlldyA9IGluc2VydGVkTENvbnRhaW5lcltQQVJFTlRdIVtERUNMQVJBVElPTl9DT01QT05FTlRfVklFV107XG4gIG5nRGV2TW9kZSAmJiBhc3NlcnREZWZpbmVkKGluc2VydGVkQ29tcG9uZW50TFZpZXcsICdNaXNzaW5nIGluc2VydGVkQ29tcG9uZW50TFZpZXcnKTtcbiAgY29uc3QgZGVjbGFyZWRDb21wb25lbnRMVmlldyA9IGxWaWV3W0RFQ0xBUkFUSU9OX0NPTVBPTkVOVF9WSUVXXTtcbiAgbmdEZXZNb2RlICYmIGFzc2VydERlZmluZWQoZGVjbGFyZWRDb21wb25lbnRMVmlldywgJ01pc3NpbmcgZGVjbGFyZWRDb21wb25lbnRMVmlldycpO1xuICBpZiAoZGVjbGFyZWRDb21wb25lbnRMVmlldyAhPT0gaW5zZXJ0ZWRDb21wb25lbnRMVmlldykge1xuICAgIC8vIEF0IHRoaXMgcG9pbnQgdGhlIGRlY2xhcmF0aW9uLWNvbXBvbmVudCBpcyBub3Qgc2FtZSBhcyBpbnNlcnRpb24tY29tcG9uZW50OyB0aGlzIG1lYW5zIHRoYXRcbiAgICAvLyB0aGlzIGlzIGEgdHJhbnNwbGFudGVkIHZpZXcuIE1hcmsgdGhlIGRlY2xhcmVkIGxWaWV3IGFzIGhhdmluZyB0cmFuc3BsYW50ZWQgdmlld3Mgc28gdGhhdFxuICAgIC8vIHRob3NlIHZpZXdzIGNhbiBwYXJ0aWNpcGF0ZSBpbiBDRC5cbiAgICBkZWNsYXJhdGlvbkNvbnRhaW5lcltIQVNfVFJBTlNQTEFOVEVEX1ZJRVdTXSA9IHRydWU7XG4gIH1cbiAgaWYgKG1vdmVkVmlld3MgPT09IG51bGwpIHtcbiAgICBkZWNsYXJhdGlvbkNvbnRhaW5lcltNT1ZFRF9WSUVXU10gPSBbbFZpZXddO1xuICB9IGVsc2Uge1xuICAgIG1vdmVkVmlld3MucHVzaChsVmlldyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZGV0YWNoTW92ZWRWaWV3KGRlY2xhcmF0aW9uQ29udGFpbmVyOiBMQ29udGFpbmVyLCBsVmlldzogTFZpZXcpIHtcbiAgbmdEZXZNb2RlICYmIGFzc2VydExDb250YWluZXIoZGVjbGFyYXRpb25Db250YWluZXIpO1xuICBuZ0Rldk1vZGUgJiZcbiAgICAgIGFzc2VydERlZmluZWQoXG4gICAgICAgICAgZGVjbGFyYXRpb25Db250YWluZXJbTU9WRURfVklFV1NdLFxuICAgICAgICAgICdBIHByb2plY3RlZCB2aWV3IHNob3VsZCBiZWxvbmcgdG8gYSBub24tZW1wdHkgcHJvamVjdGVkIHZpZXdzIGNvbGxlY3Rpb24nKTtcbiAgY29uc3QgbW92ZWRWaWV3cyA9IGRlY2xhcmF0aW9uQ29udGFpbmVyW01PVkVEX1ZJRVdTXSE7XG4gIGNvbnN0IGRlY2xhcmF0aW9uVmlld0luZGV4ID0gbW92ZWRWaWV3cy5pbmRleE9mKGxWaWV3KTtcbiAgY29uc3QgaW5zZXJ0aW9uTENvbnRhaW5lciA9IGxWaWV3W1BBUkVOVF0gYXMgTENvbnRhaW5lcjtcbiAgbmdEZXZNb2RlICYmIGFzc2VydExDb250YWluZXIoaW5zZXJ0aW9uTENvbnRhaW5lcik7XG5cbiAgLy8gSWYgdGhlIHZpZXcgd2FzIG1hcmtlZCBmb3IgcmVmcmVzaCBidXQgdGhlbiBkZXRhY2hlZCBiZWZvcmUgaXQgd2FzIGNoZWNrZWQgKHdoZXJlIHRoZSBmbGFnXG4gIC8vIHdvdWxkIGJlIGNsZWFyZWQgYW5kIHRoZSBjb3VudGVyIGRlY3JlbWVudGVkKSwgd2UgbmVlZCB0byBkZWNyZW1lbnQgdGhlIHZpZXcgY291bnRlciBoZXJlXG4gIC8vIGluc3RlYWQuXG4gIGlmIChsVmlld1tGTEFHU10gJiBMVmlld0ZsYWdzLlJlZnJlc2hUcmFuc3BsYW50ZWRWaWV3KSB7XG4gICAgbFZpZXdbRkxBR1NdICY9IH5MVmlld0ZsYWdzLlJlZnJlc2hUcmFuc3BsYW50ZWRWaWV3O1xuICAgIHVwZGF0ZVRyYW5zcGxhbnRlZFZpZXdDb3VudChpbnNlcnRpb25MQ29udGFpbmVyLCAtMSk7XG4gIH1cblxuICBtb3ZlZFZpZXdzLnNwbGljZShkZWNsYXJhdGlvblZpZXdJbmRleCwgMSk7XG59XG5cbi8qKlxuICogRGV0YWNoZXMgYSB2aWV3IGZyb20gYSBjb250YWluZXIuXG4gKlxuICogVGhpcyBtZXRob2QgcmVtb3ZlcyB0aGUgdmlldyBmcm9tIHRoZSBjb250YWluZXIncyBhcnJheSBvZiBhY3RpdmUgdmlld3MuIEl0IGFsc29cbiAqIHJlbW92ZXMgdGhlIHZpZXcncyBlbGVtZW50cyBmcm9tIHRoZSBET00uXG4gKlxuICogQHBhcmFtIGxDb250YWluZXIgVGhlIGNvbnRhaW5lciBmcm9tIHdoaWNoIHRvIGRldGFjaCBhIHZpZXdcbiAqIEBwYXJhbSByZW1vdmVJbmRleCBUaGUgaW5kZXggb2YgdGhlIHZpZXcgdG8gZGV0YWNoXG4gKiBAcmV0dXJucyBEZXRhY2hlZCBMVmlldyBpbnN0YW5jZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRldGFjaFZpZXcobENvbnRhaW5lcjogTENvbnRhaW5lciwgcmVtb3ZlSW5kZXg6IG51bWJlcik6IExWaWV3fHVuZGVmaW5lZCB7XG4gIGlmIChsQ29udGFpbmVyLmxlbmd0aCA8PSBDT05UQUlORVJfSEVBREVSX09GRlNFVCkgcmV0dXJuO1xuXG4gIGNvbnN0IGluZGV4SW5Db250YWluZXIgPSBDT05UQUlORVJfSEVBREVSX09GRlNFVCArIHJlbW92ZUluZGV4O1xuICBjb25zdCB2aWV3VG9EZXRhY2ggPSBsQ29udGFpbmVyW2luZGV4SW5Db250YWluZXJdO1xuXG4gIGlmICh2aWV3VG9EZXRhY2gpIHtcbiAgICBjb25zdCBkZWNsYXJhdGlvbkxDb250YWluZXIgPSB2aWV3VG9EZXRhY2hbREVDTEFSQVRJT05fTENPTlRBSU5FUl07XG4gICAgaWYgKGRlY2xhcmF0aW9uTENvbnRhaW5lciAhPT0gbnVsbCAmJiBkZWNsYXJhdGlvbkxDb250YWluZXIgIT09IGxDb250YWluZXIpIHtcbiAgICAgIGRldGFjaE1vdmVkVmlldyhkZWNsYXJhdGlvbkxDb250YWluZXIsIHZpZXdUb0RldGFjaCk7XG4gICAgfVxuXG5cbiAgICBpZiAocmVtb3ZlSW5kZXggPiAwKSB7XG4gICAgICBsQ29udGFpbmVyW2luZGV4SW5Db250YWluZXIgLSAxXVtORVhUXSA9IHZpZXdUb0RldGFjaFtORVhUXSBhcyBMVmlldztcbiAgICB9XG4gICAgY29uc3QgcmVtb3ZlZExWaWV3ID0gcmVtb3ZlRnJvbUFycmF5KGxDb250YWluZXIsIENPTlRBSU5FUl9IRUFERVJfT0ZGU0VUICsgcmVtb3ZlSW5kZXgpO1xuICAgIHJlbW92ZVZpZXdGcm9tQ29udGFpbmVyKHZpZXdUb0RldGFjaFtUVklFV10sIHZpZXdUb0RldGFjaCk7XG5cbiAgICAvLyBub3RpZnkgcXVlcnkgdGhhdCBhIHZpZXcgaGFzIGJlZW4gcmVtb3ZlZFxuICAgIGNvbnN0IGxRdWVyaWVzID0gcmVtb3ZlZExWaWV3W1FVRVJJRVNdO1xuICAgIGlmIChsUXVlcmllcyAhPT0gbnVsbCkge1xuICAgICAgbFF1ZXJpZXMuZGV0YWNoVmlldyhyZW1vdmVkTFZpZXdbVFZJRVddKTtcbiAgICB9XG5cbiAgICB2aWV3VG9EZXRhY2hbUEFSRU5UXSA9IG51bGw7XG4gICAgdmlld1RvRGV0YWNoW05FWFRdID0gbnVsbDtcbiAgICAvLyBVbnNldHMgdGhlIGF0dGFjaGVkIGZsYWdcbiAgICB2aWV3VG9EZXRhY2hbRkxBR1NdICY9IH5MVmlld0ZsYWdzLkF0dGFjaGVkO1xuICB9XG4gIHJldHVybiB2aWV3VG9EZXRhY2g7XG59XG5cbi8qKlxuICogQSBzdGFuZGFsb25lIGZ1bmN0aW9uIHdoaWNoIGRlc3Ryb3lzIGFuIExWaWV3LFxuICogY29uZHVjdGluZyBjbGVhbiB1cCAoZS5nLiByZW1vdmluZyBsaXN0ZW5lcnMsIGNhbGxpbmcgb25EZXN0cm95cykuXG4gKlxuICogQHBhcmFtIHRWaWV3IFRoZSBgVFZpZXcnIG9mIHRoZSBgTFZpZXdgIHRvIGJlIGRlc3Ryb3llZFxuICogQHBhcmFtIGxWaWV3IFRoZSB2aWV3IHRvIGJlIGRlc3Ryb3llZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlc3Ryb3lMVmlldyh0VmlldzogVFZpZXcsIGxWaWV3OiBMVmlldykge1xuICBpZiAoIShsVmlld1tGTEFHU10gJiBMVmlld0ZsYWdzLkRlc3Ryb3llZCkpIHtcbiAgICBjb25zdCByZW5kZXJlciA9IGxWaWV3W1JFTkRFUkVSXTtcbiAgICBpZiAocmVuZGVyZXIuZGVzdHJveU5vZGUpIHtcbiAgICAgIGFwcGx5Vmlldyh0VmlldywgbFZpZXcsIHJlbmRlcmVyLCBXYWxrVE5vZGVUcmVlQWN0aW9uLkRlc3Ryb3ksIG51bGwsIG51bGwpO1xuICAgIH1cblxuICAgIGRlc3Ryb3lWaWV3VHJlZShsVmlldyk7XG4gIH1cbn1cblxuLyoqXG4gKiBDYWxscyBvbkRlc3Ryb3lzIGhvb2tzIGZvciBhbGwgZGlyZWN0aXZlcyBhbmQgcGlwZXMgaW4gYSBnaXZlbiB2aWV3IGFuZCB0aGVuIHJlbW92ZXMgYWxsXG4gKiBsaXN0ZW5lcnMuIExpc3RlbmVycyBhcmUgcmVtb3ZlZCBhcyB0aGUgbGFzdCBzdGVwIHNvIGV2ZW50cyBkZWxpdmVyZWQgaW4gdGhlIG9uRGVzdHJveXMgaG9va3NcbiAqIGNhbiBiZSBwcm9wYWdhdGVkIHRvIEBPdXRwdXQgbGlzdGVuZXJzLlxuICpcbiAqIEBwYXJhbSB0VmlldyBgVFZpZXdgIGZvciB0aGUgYExWaWV3YCB0byBjbGVhbiB1cC5cbiAqIEBwYXJhbSBsVmlldyBUaGUgTFZpZXcgdG8gY2xlYW4gdXBcbiAqL1xuZnVuY3Rpb24gY2xlYW5VcFZpZXcodFZpZXc6IFRWaWV3LCBsVmlldzogTFZpZXcpOiB2b2lkIHtcbiAgaWYgKCEobFZpZXdbRkxBR1NdICYgTFZpZXdGbGFncy5EZXN0cm95ZWQpKSB7XG4gICAgLy8gVXN1YWxseSB0aGUgQXR0YWNoZWQgZmxhZyBpcyByZW1vdmVkIHdoZW4gdGhlIHZpZXcgaXMgZGV0YWNoZWQgZnJvbSBpdHMgcGFyZW50LCBob3dldmVyXG4gICAgLy8gaWYgaXQncyBhIHJvb3QgdmlldywgdGhlIGZsYWcgd29uJ3QgYmUgdW5zZXQgaGVuY2Ugd2h5IHdlJ3JlIGFsc28gcmVtb3Zpbmcgb24gZGVzdHJveS5cbiAgICBsVmlld1tGTEFHU10gJj0gfkxWaWV3RmxhZ3MuQXR0YWNoZWQ7XG5cbiAgICAvLyBNYXJrIHRoZSBMVmlldyBhcyBkZXN0cm95ZWQgKmJlZm9yZSogZXhlY3V0aW5nIHRoZSBvbkRlc3Ryb3kgaG9va3MuIEFuIG9uRGVzdHJveSBob29rXG4gICAgLy8gcnVucyBhcmJpdHJhcnkgdXNlciBjb2RlLCB3aGljaCBjb3VsZCBpbmNsdWRlIGl0cyBvd24gYHZpZXdSZWYuZGVzdHJveSgpYCAob3Igc2ltaWxhcikuIElmXG4gICAgLy8gV2UgZG9uJ3QgZmxhZyB0aGUgdmlldyBhcyBkZXN0cm95ZWQgYmVmb3JlIHRoZSBob29rcywgdGhpcyBjb3VsZCBsZWFkIHRvIGFuIGluZmluaXRlIGxvb3AuXG4gICAgLy8gVGhpcyBhbHNvIGFsaWducyB3aXRoIHRoZSBWaWV3RW5naW5lIGJlaGF2aW9yLiBJdCBhbHNvIG1lYW5zIHRoYXQgdGhlIG9uRGVzdHJveSBob29rIGlzXG4gICAgLy8gcmVhbGx5IG1vcmUgb2YgYW4gXCJhZnRlckRlc3Ryb3lcIiBob29rIGlmIHlvdSB0aGluayBhYm91dCBpdC5cbiAgICBsVmlld1tGTEFHU10gfD0gTFZpZXdGbGFncy5EZXN0cm95ZWQ7XG5cbiAgICBleGVjdXRlT25EZXN0cm95cyh0VmlldywgbFZpZXcpO1xuICAgIHByb2Nlc3NDbGVhbnVwcyh0VmlldywgbFZpZXcpO1xuICAgIC8vIEZvciBjb21wb25lbnQgdmlld3Mgb25seSwgdGhlIGxvY2FsIHJlbmRlcmVyIGlzIGRlc3Ryb3llZCBhdCBjbGVhbiB1cCB0aW1lLlxuICAgIGlmIChsVmlld1tUVklFV10udHlwZSA9PT0gVFZpZXdUeXBlLkNvbXBvbmVudCkge1xuICAgICAgbmdEZXZNb2RlICYmIG5nRGV2TW9kZS5yZW5kZXJlckRlc3Ryb3krKztcbiAgICAgIGxWaWV3W1JFTkRFUkVSXS5kZXN0cm95KCk7XG4gICAgfVxuXG4gICAgY29uc3QgZGVjbGFyYXRpb25Db250YWluZXIgPSBsVmlld1tERUNMQVJBVElPTl9MQ09OVEFJTkVSXTtcbiAgICAvLyB3ZSBhcmUgZGVhbGluZyB3aXRoIGFuIGVtYmVkZGVkIHZpZXcgdGhhdCBpcyBzdGlsbCBpbnNlcnRlZCBpbnRvIGEgY29udGFpbmVyXG4gICAgaWYgKGRlY2xhcmF0aW9uQ29udGFpbmVyICE9PSBudWxsICYmIGlzTENvbnRhaW5lcihsVmlld1tQQVJFTlRdKSkge1xuICAgICAgLy8gYW5kIHRoaXMgaXMgYSBwcm9qZWN0ZWQgdmlld1xuICAgICAgaWYgKGRlY2xhcmF0aW9uQ29udGFpbmVyICE9PSBsVmlld1tQQVJFTlRdKSB7XG4gICAgICAgIGRldGFjaE1vdmVkVmlldyhkZWNsYXJhdGlvbkNvbnRhaW5lciwgbFZpZXcpO1xuICAgICAgfVxuXG4gICAgICAvLyBGb3IgZW1iZWRkZWQgdmlld3Mgc3RpbGwgYXR0YWNoZWQgdG8gYSBjb250YWluZXI6IHJlbW92ZSBxdWVyeSByZXN1bHQgZnJvbSB0aGlzIHZpZXcuXG4gICAgICBjb25zdCBsUXVlcmllcyA9IGxWaWV3W1FVRVJJRVNdO1xuICAgICAgaWYgKGxRdWVyaWVzICE9PSBudWxsKSB7XG4gICAgICAgIGxRdWVyaWVzLmRldGFjaFZpZXcodFZpZXcpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFVucmVnaXN0ZXIgdGhlIHZpZXcgb25jZSBldmVyeXRoaW5nIGVsc2UgaGFzIGJlZW4gY2xlYW5lZCB1cC5cbiAgICB1bnJlZ2lzdGVyTFZpZXcobFZpZXcpO1xuICB9XG59XG5cbi8qKiBSZW1vdmVzIGxpc3RlbmVycyBhbmQgdW5zdWJzY3JpYmVzIGZyb20gb3V0cHV0IHN1YnNjcmlwdGlvbnMgKi9cbmZ1bmN0aW9uIHByb2Nlc3NDbGVhbnVwcyh0VmlldzogVFZpZXcsIGxWaWV3OiBMVmlldyk6IHZvaWQge1xuICBjb25zdCB0Q2xlYW51cCA9IHRWaWV3LmNsZWFudXA7XG4gIGNvbnN0IGxDbGVhbnVwID0gbFZpZXdbQ0xFQU5VUF0hO1xuICAvLyBgTENsZWFudXBgIGNvbnRhaW5zIGJvdGggc2hhcmUgaW5mb3JtYXRpb24gd2l0aCBgVENsZWFudXBgIGFzIHdlbGwgYXMgaW5zdGFuY2Ugc3BlY2lmaWNcbiAgLy8gaW5mb3JtYXRpb24gYXBwZW5kZWQgYXQgdGhlIGVuZC4gV2UgbmVlZCB0byBrbm93IHdoZXJlIHRoZSBlbmQgb2YgdGhlIGBUQ2xlYW51cGAgaW5mb3JtYXRpb25cbiAgLy8gaXMsIGFuZCB3ZSB0cmFjayB0aGlzIHdpdGggYGxhc3RMQ2xlYW51cEluZGV4YC5cbiAgbGV0IGxhc3RMQ2xlYW51cEluZGV4ID0gLTE7XG4gIGlmICh0Q2xlYW51cCAhPT0gbnVsbCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdENsZWFudXAubGVuZ3RoIC0gMTsgaSArPSAyKSB7XG4gICAgICBpZiAodHlwZW9mIHRDbGVhbnVwW2ldID09PSAnc3RyaW5nJykge1xuICAgICAgICAvLyBUaGlzIGlzIGEgbmF0aXZlIERPTSBsaXN0ZW5lclxuICAgICAgICBjb25zdCBpZHhPclRhcmdldEdldHRlciA9IHRDbGVhbnVwW2kgKyAxXTtcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gdHlwZW9mIGlkeE9yVGFyZ2V0R2V0dGVyID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgICAgIGlkeE9yVGFyZ2V0R2V0dGVyKGxWaWV3KSA6XG4gICAgICAgICAgICB1bndyYXBSTm9kZShsVmlld1tpZHhPclRhcmdldEdldHRlcl0pO1xuICAgICAgICBjb25zdCBsaXN0ZW5lciA9IGxDbGVhbnVwW2xhc3RMQ2xlYW51cEluZGV4ID0gdENsZWFudXBbaSArIDJdXTtcbiAgICAgICAgY29uc3QgdXNlQ2FwdHVyZU9yU3ViSWR4ID0gdENsZWFudXBbaSArIDNdO1xuICAgICAgICBpZiAodHlwZW9mIHVzZUNhcHR1cmVPclN1YklkeCA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgLy8gbmF0aXZlIERPTSBsaXN0ZW5lciByZWdpc3RlcmVkIHdpdGggUmVuZGVyZXIzXG4gICAgICAgICAgdGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIodENsZWFudXBbaV0sIGxpc3RlbmVyLCB1c2VDYXB0dXJlT3JTdWJJZHgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmICh1c2VDYXB0dXJlT3JTdWJJZHggPj0gMCkge1xuICAgICAgICAgICAgLy8gdW5yZWdpc3RlclxuICAgICAgICAgICAgbENsZWFudXBbbGFzdExDbGVhbnVwSW5kZXggPSB1c2VDYXB0dXJlT3JTdWJJZHhdKCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFN1YnNjcmlwdGlvblxuICAgICAgICAgICAgbENsZWFudXBbbGFzdExDbGVhbnVwSW5kZXggPSAtdXNlQ2FwdHVyZU9yU3ViSWR4XS51bnN1YnNjcmliZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpICs9IDI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUaGlzIGlzIGEgY2xlYW51cCBmdW5jdGlvbiB0aGF0IGlzIGdyb3VwZWQgd2l0aCB0aGUgaW5kZXggb2YgaXRzIGNvbnRleHRcbiAgICAgICAgY29uc3QgY29udGV4dCA9IGxDbGVhbnVwW2xhc3RMQ2xlYW51cEluZGV4ID0gdENsZWFudXBbaSArIDFdXTtcbiAgICAgICAgdENsZWFudXBbaV0uY2FsbChjb250ZXh0KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgaWYgKGxDbGVhbnVwICE9PSBudWxsKSB7XG4gICAgZm9yIChsZXQgaSA9IGxhc3RMQ2xlYW51cEluZGV4ICsgMTsgaSA8IGxDbGVhbnVwLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpbnN0YW5jZUNsZWFudXBGbiA9IGxDbGVhbnVwW2ldO1xuICAgICAgbmdEZXZNb2RlICYmIGFzc2VydEZ1bmN0aW9uKGluc3RhbmNlQ2xlYW51cEZuLCAnRXhwZWN0aW5nIGluc3RhbmNlIGNsZWFudXAgZnVuY3Rpb24uJyk7XG4gICAgICBpbnN0YW5jZUNsZWFudXBGbigpO1xuICAgIH1cbiAgICBsVmlld1tDTEVBTlVQXSA9IG51bGw7XG4gIH1cbn1cblxuLyoqIENhbGxzIG9uRGVzdHJveSBob29rcyBmb3IgdGhpcyB2aWV3ICovXG5mdW5jdGlvbiBleGVjdXRlT25EZXN0cm95cyh0VmlldzogVFZpZXcsIGxWaWV3OiBMVmlldyk6IHZvaWQge1xuICBsZXQgZGVzdHJveUhvb2tzOiBEZXN0cm95SG9va0RhdGF8bnVsbDtcblxuICBpZiAodFZpZXcgIT0gbnVsbCAmJiAoZGVzdHJveUhvb2tzID0gdFZpZXcuZGVzdHJveUhvb2tzKSAhPSBudWxsKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkZXN0cm95SG9va3MubGVuZ3RoOyBpICs9IDIpIHtcbiAgICAgIGNvbnN0IGNvbnRleHQgPSBsVmlld1tkZXN0cm95SG9va3NbaV0gYXMgbnVtYmVyXTtcblxuICAgICAgLy8gT25seSBjYWxsIHRoZSBkZXN0cm95IGhvb2sgaWYgdGhlIGNvbnRleHQgaGFzIGJlZW4gcmVxdWVzdGVkLlxuICAgICAgaWYgKCEoY29udGV4dCBpbnN0YW5jZW9mIE5vZGVJbmplY3RvckZhY3RvcnkpKSB7XG4gICAgICAgIGNvbnN0IHRvQ2FsbCA9IGRlc3Ryb3lIb29rc1tpICsgMV0gYXMgSG9va0ZuIHwgSG9va0RhdGE7XG5cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodG9DYWxsKSkge1xuICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdG9DYWxsLmxlbmd0aDsgaiArPSAyKSB7XG4gICAgICAgICAgICBjb25zdCBjYWxsQ29udGV4dCA9IGNvbnRleHRbdG9DYWxsW2pdIGFzIG51bWJlcl07XG4gICAgICAgICAgICBjb25zdCBob29rID0gdG9DYWxsW2ogKyAxXSBhcyBIb29rRm47XG4gICAgICAgICAgICBwcm9maWxlcihQcm9maWxlckV2ZW50LkxpZmVjeWNsZUhvb2tTdGFydCwgY2FsbENvbnRleHQsIGhvb2spO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgaG9vay5jYWxsKGNhbGxDb250ZXh0KTtcbiAgICAgICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICAgIHByb2ZpbGVyKFByb2ZpbGVyRXZlbnQuTGlmZWN5Y2xlSG9va0VuZCwgY2FsbENvbnRleHQsIGhvb2spO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwcm9maWxlcihQcm9maWxlckV2ZW50LkxpZmVjeWNsZUhvb2tTdGFydCwgY29udGV4dCwgdG9DYWxsKTtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgdG9DYWxsLmNhbGwoY29udGV4dCk7XG4gICAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIHByb2ZpbGVyKFByb2ZpbGVyRXZlbnQuTGlmZWN5Y2xlSG9va0VuZCwgY29udGV4dCwgdG9DYWxsKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBSZXR1cm5zIGEgbmF0aXZlIGVsZW1lbnQgaWYgYSBub2RlIGNhbiBiZSBpbnNlcnRlZCBpbnRvIHRoZSBnaXZlbiBwYXJlbnQuXG4gKlxuICogVGhlcmUgYXJlIHR3byByZWFzb25zIHdoeSB3ZSBtYXkgbm90IGJlIGFibGUgdG8gaW5zZXJ0IGEgZWxlbWVudCBpbW1lZGlhdGVseS5cbiAqIC0gUHJvamVjdGlvbjogV2hlbiBjcmVhdGluZyBhIGNoaWxkIGNvbnRlbnQgZWxlbWVudCBvZiBhIGNvbXBvbmVudCwgd2UgaGF2ZSB0byBza2lwIHRoZVxuICogICBpbnNlcnRpb24gYmVjYXVzZSB0aGUgY29udGVudCBvZiBhIGNvbXBvbmVudCB3aWxsIGJlIHByb2plY3RlZC5cbiAqICAgYDxjb21wb25lbnQ+PGNvbnRlbnQ+ZGVsYXllZCBkdWUgdG8gcHJvamVjdGlvbjwvY29udGVudD48L2NvbXBvbmVudD5gXG4gKiAtIFBhcmVudCBjb250YWluZXIgaXMgZGlzY29ubmVjdGVkOiBUaGlzIGNhbiBoYXBwZW4gd2hlbiB3ZSBhcmUgaW5zZXJ0aW5nIGEgdmlldyBpbnRvXG4gKiAgIHBhcmVudCBjb250YWluZXIsIHdoaWNoIGl0c2VsZiBpcyBkaXNjb25uZWN0ZWQuIEZvciBleGFtcGxlIHRoZSBwYXJlbnQgY29udGFpbmVyIGlzIHBhcnRcbiAqICAgb2YgYSBWaWV3IHdoaWNoIGhhcyBub3QgYmUgaW5zZXJ0ZWQgb3IgaXMgbWFkZSBmb3IgcHJvamVjdGlvbiBidXQgaGFzIG5vdCBiZWVuIGluc2VydGVkXG4gKiAgIGludG8gZGVzdGluYXRpb24uXG4gKlxuICogQHBhcmFtIHRWaWV3OiBDdXJyZW50IGBUVmlld2AuXG4gKiBAcGFyYW0gdE5vZGU6IGBUTm9kZWAgZm9yIHdoaWNoIHdlIHdpc2ggdG8gcmV0cmlldmUgcmVuZGVyIHBhcmVudC5cbiAqIEBwYXJhbSBsVmlldzogQ3VycmVudCBgTFZpZXdgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0UGFyZW50UkVsZW1lbnQodFZpZXc6IFRWaWV3LCB0Tm9kZTogVE5vZGUsIGxWaWV3OiBMVmlldyk6IFJFbGVtZW50fG51bGwge1xuICByZXR1cm4gZ2V0Q2xvc2VzdFJFbGVtZW50KHRWaWV3LCB0Tm9kZS5wYXJlbnQsIGxWaWV3KTtcbn1cblxuLyoqXG4gKiBHZXQgY2xvc2VzdCBgUkVsZW1lbnRgIG9yIGBudWxsYCBpZiBpdCBjYW4ndCBiZSBmb3VuZC5cbiAqXG4gKiBJZiBgVE5vZGVgIGlzIGBUTm9kZVR5cGUuRWxlbWVudGAgPT4gcmV0dXJuIGBSRWxlbWVudGAgYXQgYExWaWV3W3ROb2RlLmluZGV4XWAgbG9jYXRpb24uXG4gKiBJZiBgVE5vZGVgIGlzIGBUTm9kZVR5cGUuRWxlbWVudENvbnRhaW5lcnxJY3VDb250YWluYCA9PiByZXR1cm4gdGhlIHBhcmVudCAocmVjdXJzaXZlbHkpLlxuICogSWYgYFROb2RlYCBpcyBgbnVsbGAgdGhlbiByZXR1cm4gaG9zdCBgUkVsZW1lbnRgOlxuICogICAtIHJldHVybiBgbnVsbGAgaWYgcHJvamVjdGlvblxuICogICAtIHJldHVybiBgbnVsbGAgaWYgcGFyZW50IGNvbnRhaW5lciBpcyBkaXNjb25uZWN0ZWQgKHdlIGhhdmUgbm8gcGFyZW50LilcbiAqXG4gKiBAcGFyYW0gdFZpZXc6IEN1cnJlbnQgYFRWaWV3YC5cbiAqIEBwYXJhbSB0Tm9kZTogYFROb2RlYCBmb3Igd2hpY2ggd2Ugd2lzaCB0byByZXRyaWV2ZSBgUkVsZW1lbnRgIChvciBgbnVsbGAgaWYgaG9zdCBlbGVtZW50IGlzXG4gKiAgICAgbmVlZGVkKS5cbiAqIEBwYXJhbSBsVmlldzogQ3VycmVudCBgTFZpZXdgLlxuICogQHJldHVybnMgYG51bGxgIGlmIHRoZSBgUkVsZW1lbnRgIGNhbid0IGJlIGRldGVybWluZWQgYXQgdGhpcyB0aW1lIChubyBwYXJlbnQgLyBwcm9qZWN0aW9uKVxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q2xvc2VzdFJFbGVtZW50KHRWaWV3OiBUVmlldywgdE5vZGU6IFROb2RlfG51bGwsIGxWaWV3OiBMVmlldyk6IFJFbGVtZW50fG51bGwge1xuICBsZXQgcGFyZW50VE5vZGU6IFROb2RlfG51bGwgPSB0Tm9kZTtcbiAgLy8gU2tpcCBvdmVyIGVsZW1lbnQgYW5kIElDVSBjb250YWluZXJzIGFzIHRob3NlIGFyZSByZXByZXNlbnRlZCBieSBhIGNvbW1lbnQgbm9kZSBhbmRcbiAgLy8gY2FuJ3QgYmUgdXNlZCBhcyBhIHJlbmRlciBwYXJlbnQuXG4gIHdoaWxlIChwYXJlbnRUTm9kZSAhPT0gbnVsbCAmJlxuICAgICAgICAgKHBhcmVudFROb2RlLnR5cGUgJiAoVE5vZGVUeXBlLkVsZW1lbnRDb250YWluZXIgfCBUTm9kZVR5cGUuSWN1KSkpIHtcbiAgICB0Tm9kZSA9IHBhcmVudFROb2RlO1xuICAgIHBhcmVudFROb2RlID0gdE5vZGUucGFyZW50O1xuICB9XG5cbiAgLy8gSWYgdGhlIHBhcmVudCB0Tm9kZSBpcyBudWxsLCB0aGVuIHdlIGFyZSBpbnNlcnRpbmcgYWNyb3NzIHZpZXdzOiBlaXRoZXIgaW50byBhbiBlbWJlZGRlZCB2aWV3XG4gIC8vIG9yIGEgY29tcG9uZW50IHZpZXcuXG4gIGlmIChwYXJlbnRUTm9kZSA9PT0gbnVsbCkge1xuICAgIC8vIFdlIGFyZSBpbnNlcnRpbmcgYSByb290IGVsZW1lbnQgb2YgdGhlIGNvbXBvbmVudCB2aWV3IGludG8gdGhlIGNvbXBvbmVudCBob3N0IGVsZW1lbnQgYW5kXG4gICAgLy8gaXQgc2hvdWxkIGFsd2F5cyBiZSBlYWdlci5cbiAgICByZXR1cm4gbFZpZXdbSE9TVF07XG4gIH0gZWxzZSB7XG4gICAgbmdEZXZNb2RlICYmIGFzc2VydFROb2RlVHlwZShwYXJlbnRUTm9kZSwgVE5vZGVUeXBlLkFueVJOb2RlIHwgVE5vZGVUeXBlLkNvbnRhaW5lcik7XG4gICAgaWYgKHBhcmVudFROb2RlLmZsYWdzICYgVE5vZGVGbGFncy5pc0NvbXBvbmVudEhvc3QpIHtcbiAgICAgIG5nRGV2TW9kZSAmJiBhc3NlcnRUTm9kZUZvckxWaWV3KHBhcmVudFROb2RlLCBsVmlldyk7XG4gICAgICBjb25zdCBlbmNhcHN1bGF0aW9uID1cbiAgICAgICAgICAodFZpZXcuZGF0YVtwYXJlbnRUTm9kZS5kaXJlY3RpdmVTdGFydF0gYXMgQ29tcG9uZW50RGVmPHVua25vd24+KS5lbmNhcHN1bGF0aW9uO1xuICAgICAgLy8gV2UndmUgZ290IGEgcGFyZW50IHdoaWNoIGlzIGFuIGVsZW1lbnQgaW4gdGhlIGN1cnJlbnQgdmlldy4gV2UganVzdCBuZWVkIHRvIHZlcmlmeSBpZiB0aGVcbiAgICAgIC8vIHBhcmVudCBlbGVtZW50IGlzIG5vdCBhIGNvbXBvbmVudC4gQ29tcG9uZW50J3MgY29udGVudCBub2RlcyBhcmUgbm90IGluc2VydGVkIGltbWVkaWF0ZWx5XG4gICAgICAvLyBiZWNhdXNlIHRoZXkgd2lsbCBiZSBwcm9qZWN0ZWQsIGFuZCBzbyBkb2luZyBpbnNlcnQgYXQgdGhpcyBwb2ludCB3b3VsZCBiZSB3YXN0ZWZ1bC5cbiAgICAgIC8vIFNpbmNlIHRoZSBwcm9qZWN0aW9uIHdvdWxkIHRoZW4gbW92ZSBpdCB0byBpdHMgZmluYWwgZGVzdGluYXRpb24uIE5vdGUgdGhhdCB3ZSBjYW4ndFxuICAgICAgLy8gbWFrZSB0aGlzIGFzc3VtcHRpb24gd2hlbiB1c2luZyB0aGUgU2hhZG93IERPTSwgYmVjYXVzZSB0aGUgbmF0aXZlIHByb2plY3Rpb24gcGxhY2Vob2xkZXJzXG4gICAgICAvLyAoPGNvbnRlbnQ+IG9yIDxzbG90PikgaGF2ZSB0byBiZSBpbiBwbGFjZSBhcyBlbGVtZW50cyBhcmUgYmVpbmcgaW5zZXJ0ZWQuXG4gICAgICBpZiAoZW5jYXBzdWxhdGlvbiA9PT0gVmlld0VuY2Fwc3VsYXRpb24uTm9uZSB8fFxuICAgICAgICAgIGVuY2Fwc3VsYXRpb24gPT09IFZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBnZXROYXRpdmVCeVROb2RlKHBhcmVudFROb2RlLCBsVmlldykgYXMgUkVsZW1lbnQ7XG4gIH1cbn1cblxuLyoqXG4gKiBJbnNlcnRzIGEgbmF0aXZlIG5vZGUgYmVmb3JlIGFub3RoZXIgbmF0aXZlIG5vZGUgZm9yIGEgZ2l2ZW4gcGFyZW50LlxuICogVGhpcyBpcyBhIHV0aWxpdHkgZnVuY3Rpb24gdGhhdCBjYW4gYmUgdXNlZCB3aGVuIG5hdGl2ZSBub2RlcyB3ZXJlIGRldGVybWluZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBuYXRpdmVJbnNlcnRCZWZvcmUoXG4gICAgcmVuZGVyZXI6IFJlbmRlcmVyLCBwYXJlbnQ6IFJFbGVtZW50LCBjaGlsZDogUk5vZGUsIGJlZm9yZU5vZGU6IFJOb2RlfG51bGwsXG4gICAgaXNNb3ZlOiBib29sZWFuKTogdm9pZCB7XG4gIG5nRGV2TW9kZSAmJiBuZ0Rldk1vZGUucmVuZGVyZXJJbnNlcnRCZWZvcmUrKztcbiAgcmVuZGVyZXIuaW5zZXJ0QmVmb3JlKHBhcmVudCwgY2hpbGQsIGJlZm9yZU5vZGUsIGlzTW92ZSk7XG59XG5cbmZ1bmN0aW9uIG5hdGl2ZUFwcGVuZENoaWxkKHJlbmRlcmVyOiBSZW5kZXJlciwgcGFyZW50OiBSRWxlbWVudCwgY2hpbGQ6IFJOb2RlKTogdm9pZCB7XG4gIG5nRGV2TW9kZSAmJiBuZ0Rldk1vZGUucmVuZGVyZXJBcHBlbmRDaGlsZCsrO1xuICBuZ0Rldk1vZGUgJiYgYXNzZXJ0RGVmaW5lZChwYXJlbnQsICdwYXJlbnQgbm9kZSBtdXN0IGJlIGRlZmluZWQnKTtcbiAgcmVuZGVyZXIuYXBwZW5kQ2hpbGQocGFyZW50LCBjaGlsZCk7XG59XG5cbmZ1bmN0aW9uIG5hdGl2ZUFwcGVuZE9ySW5zZXJ0QmVmb3JlKFxuICAgIHJlbmRlcmVyOiBSZW5kZXJlciwgcGFyZW50OiBSRWxlbWVudCwgY2hpbGQ6IFJOb2RlLCBiZWZvcmVOb2RlOiBSTm9kZXxudWxsLCBpc01vdmU6IGJvb2xlYW4pIHtcbiAgaWYgKGJlZm9yZU5vZGUgIT09IG51bGwpIHtcbiAgICBuYXRpdmVJbnNlcnRCZWZvcmUocmVuZGVyZXIsIHBhcmVudCwgY2hpbGQsIGJlZm9yZU5vZGUsIGlzTW92ZSk7XG4gIH0gZWxzZSB7XG4gICAgbmF0aXZlQXBwZW5kQ2hpbGQocmVuZGVyZXIsIHBhcmVudCwgY2hpbGQpO1xuICB9XG59XG5cbi8qKiBSZW1vdmVzIGEgbm9kZSBmcm9tIHRoZSBET00gZ2l2ZW4gaXRzIG5hdGl2ZSBwYXJlbnQuICovXG5mdW5jdGlvbiBuYXRpdmVSZW1vdmVDaGlsZChcbiAgICByZW5kZXJlcjogUmVuZGVyZXIsIHBhcmVudDogUkVsZW1lbnQsIGNoaWxkOiBSTm9kZSwgaXNIb3N0RWxlbWVudD86IGJvb2xlYW4pOiB2b2lkIHtcbiAgcmVuZGVyZXIucmVtb3ZlQ2hpbGQocGFyZW50LCBjaGlsZCwgaXNIb3N0RWxlbWVudCk7XG59XG5cbi8qKiBDaGVja3MgaWYgYW4gZWxlbWVudCBpcyBhIGA8dGVtcGxhdGU+YCBub2RlLiAqL1xuZnVuY3Rpb24gaXNUZW1wbGF0ZU5vZGUobm9kZTogUkVsZW1lbnQpOiBub2RlIGlzIFJUZW1wbGF0ZSB7XG4gIHJldHVybiBub2RlLnRhZ05hbWUgPT09ICdURU1QTEFURScgJiYgKG5vZGUgYXMgUlRlbXBsYXRlKS5jb250ZW50ICE9PSB1bmRlZmluZWQ7XG59XG5cbi8qKlxuICogUmV0dXJucyBhIG5hdGl2ZSBwYXJlbnQgb2YgYSBnaXZlbiBuYXRpdmUgbm9kZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5hdGl2ZVBhcmVudE5vZGUocmVuZGVyZXI6IFJlbmRlcmVyLCBub2RlOiBSTm9kZSk6IFJFbGVtZW50fG51bGwge1xuICByZXR1cm4gcmVuZGVyZXIucGFyZW50Tm9kZShub2RlKTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIGEgbmF0aXZlIHNpYmxpbmcgb2YgYSBnaXZlbiBuYXRpdmUgbm9kZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5hdGl2ZU5leHRTaWJsaW5nKHJlbmRlcmVyOiBSZW5kZXJlciwgbm9kZTogUk5vZGUpOiBSTm9kZXxudWxsIHtcbiAgcmV0dXJuIHJlbmRlcmVyLm5leHRTaWJsaW5nKG5vZGUpO1xufVxuXG4vKipcbiAqIEZpbmQgYSBub2RlIGluIGZyb250IG9mIHdoaWNoIGBjdXJyZW50VE5vZGVgIHNob3VsZCBiZSBpbnNlcnRlZC5cbiAqXG4gKiBUaGlzIG1ldGhvZCBkZXRlcm1pbmVzIHRoZSBgUk5vZGVgIGluIGZyb250IG9mIHdoaWNoIHdlIHNob3VsZCBpbnNlcnQgdGhlIGBjdXJyZW50Uk5vZGVgLiBUaGlzXG4gKiB0YWtlcyBgVE5vZGUuaW5zZXJ0QmVmb3JlSW5kZXhgIGludG8gYWNjb3VudCBpZiBpMThuIGNvZGUgaGFzIGJlZW4gaW52b2tlZC5cbiAqXG4gKiBAcGFyYW0gcGFyZW50VE5vZGUgcGFyZW50IGBUTm9kZWBcbiAqIEBwYXJhbSBjdXJyZW50VE5vZGUgY3VycmVudCBgVE5vZGVgIChUaGUgbm9kZSB3aGljaCB3ZSB3b3VsZCBsaWtlIHRvIGluc2VydCBpbnRvIHRoZSBET00pXG4gKiBAcGFyYW0gbFZpZXcgY3VycmVudCBgTFZpZXdgXG4gKi9cbmZ1bmN0aW9uIGdldEluc2VydEluRnJvbnRPZlJOb2RlKHBhcmVudFROb2RlOiBUTm9kZSwgY3VycmVudFROb2RlOiBUTm9kZSwgbFZpZXc6IExWaWV3KTogUk5vZGV8XG4gICAgbnVsbCB7XG4gIHJldHVybiBfZ2V0SW5zZXJ0SW5Gcm9udE9mUk5vZGVXaXRoSTE4bihwYXJlbnRUTm9kZSwgY3VycmVudFROb2RlLCBsVmlldyk7XG59XG5cblxuLyoqXG4gKiBGaW5kIGEgbm9kZSBpbiBmcm9udCBvZiB3aGljaCBgY3VycmVudFROb2RlYCBzaG91bGQgYmUgaW5zZXJ0ZWQuIChEb2VzIG5vdCB0YWtlIGkxOG4gaW50b1xuICogYWNjb3VudClcbiAqXG4gKiBUaGlzIG1ldGhvZCBkZXRlcm1pbmVzIHRoZSBgUk5vZGVgIGluIGZyb250IG9mIHdoaWNoIHdlIHNob3VsZCBpbnNlcnQgdGhlIGBjdXJyZW50Uk5vZGVgLiBUaGlzXG4gKiBkb2VzIG5vdCB0YWtlIGBUTm9kZS5pbnNlcnRCZWZvcmVJbmRleGAgaW50byBhY2NvdW50LlxuICpcbiAqIEBwYXJhbSBwYXJlbnRUTm9kZSBwYXJlbnQgYFROb2RlYFxuICogQHBhcmFtIGN1cnJlbnRUTm9kZSBjdXJyZW50IGBUTm9kZWAgKFRoZSBub2RlIHdoaWNoIHdlIHdvdWxkIGxpa2UgdG8gaW5zZXJ0IGludG8gdGhlIERPTSlcbiAqIEBwYXJhbSBsVmlldyBjdXJyZW50IGBMVmlld2BcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEluc2VydEluRnJvbnRPZlJOb2RlV2l0aE5vSTE4bihcbiAgICBwYXJlbnRUTm9kZTogVE5vZGUsIGN1cnJlbnRUTm9kZTogVE5vZGUsIGxWaWV3OiBMVmlldyk6IFJOb2RlfG51bGwge1xuICBpZiAocGFyZW50VE5vZGUudHlwZSAmIChUTm9kZVR5cGUuRWxlbWVudENvbnRhaW5lciB8IFROb2RlVHlwZS5JY3UpKSB7XG4gICAgcmV0dXJuIGdldE5hdGl2ZUJ5VE5vZGUocGFyZW50VE5vZGUsIGxWaWV3KTtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBUcmVlIHNoYWthYmxlIGJvdW5kYXJ5IGZvciBgZ2V0SW5zZXJ0SW5Gcm9udE9mUk5vZGVXaXRoSTE4bmAgZnVuY3Rpb24uXG4gKlxuICogVGhpcyBmdW5jdGlvbiB3aWxsIG9ubHkgYmUgc2V0IGlmIGkxOG4gY29kZSBydW5zLlxuICovXG5sZXQgX2dldEluc2VydEluRnJvbnRPZlJOb2RlV2l0aEkxOG46IChwYXJlbnRUTm9kZTogVE5vZGUsIGN1cnJlbnRUTm9kZTogVE5vZGUsIGxWaWV3OiBMVmlldykgPT5cbiAgICBSTm9kZSB8IG51bGwgPSBnZXRJbnNlcnRJbkZyb250T2ZSTm9kZVdpdGhOb0kxOG47XG5cbi8qKlxuICogVHJlZSBzaGFrYWJsZSBib3VuZGFyeSBmb3IgYHByb2Nlc3NJMThuSW5zZXJ0QmVmb3JlYCBmdW5jdGlvbi5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHdpbGwgb25seSBiZSBzZXQgaWYgaTE4biBjb2RlIHJ1bnMuXG4gKi9cbmxldCBfcHJvY2Vzc0kxOG5JbnNlcnRCZWZvcmU6IChcbiAgICByZW5kZXJlcjogUmVuZGVyZXIsIGNoaWxkVE5vZGU6IFROb2RlLCBsVmlldzogTFZpZXcsIGNoaWxkUk5vZGU6IFJOb2RlfFJOb2RlW10sXG4gICAgcGFyZW50UkVsZW1lbnQ6IFJFbGVtZW50fG51bGwpID0+IHZvaWQ7XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRJMThuSGFuZGxpbmcoXG4gICAgZ2V0SW5zZXJ0SW5Gcm9udE9mUk5vZGVXaXRoSTE4bjogKHBhcmVudFROb2RlOiBUTm9kZSwgY3VycmVudFROb2RlOiBUTm9kZSwgbFZpZXc6IExWaWV3KSA9PlxuICAgICAgICBSTm9kZSB8IG51bGwsXG4gICAgcHJvY2Vzc0kxOG5JbnNlcnRCZWZvcmU6IChcbiAgICAgICAgcmVuZGVyZXI6IFJlbmRlcmVyLCBjaGlsZFROb2RlOiBUTm9kZSwgbFZpZXc6IExWaWV3LCBjaGlsZFJOb2RlOiBSTm9kZXxSTm9kZVtdLFxuICAgICAgICBwYXJlbnRSRWxlbWVudDogUkVsZW1lbnR8bnVsbCkgPT4gdm9pZCkge1xuICBfZ2V0SW5zZXJ0SW5Gcm9udE9mUk5vZGVXaXRoSTE4biA9IGdldEluc2VydEluRnJvbnRPZlJOb2RlV2l0aEkxOG47XG4gIF9wcm9jZXNzSTE4bkluc2VydEJlZm9yZSA9IHByb2Nlc3NJMThuSW5zZXJ0QmVmb3JlO1xufVxuXG4vKipcbiAqIEFwcGVuZHMgdGhlIGBjaGlsZGAgbmF0aXZlIG5vZGUgKG9yIGEgY29sbGVjdGlvbiBvZiBub2RlcykgdG8gdGhlIGBwYXJlbnRgLlxuICpcbiAqIEBwYXJhbSB0VmlldyBUaGUgYFRWaWV3JyB0byBiZSBhcHBlbmRlZFxuICogQHBhcmFtIGxWaWV3IFRoZSBjdXJyZW50IExWaWV3XG4gKiBAcGFyYW0gY2hpbGRSTm9kZSBUaGUgbmF0aXZlIGNoaWxkIChvciBjaGlsZHJlbikgdGhhdCBzaG91bGQgYmUgYXBwZW5kZWRcbiAqIEBwYXJhbSBjaGlsZFROb2RlIFRoZSBUTm9kZSBvZiB0aGUgY2hpbGQgZWxlbWVudFxuICovXG5leHBvcnQgZnVuY3Rpb24gYXBwZW5kQ2hpbGQoXG4gICAgdFZpZXc6IFRWaWV3LCBsVmlldzogTFZpZXcsIGNoaWxkUk5vZGU6IFJOb2RlfFJOb2RlW10sIGNoaWxkVE5vZGU6IFROb2RlKTogdm9pZCB7XG4gIGNvbnN0IHBhcmVudFJOb2RlID0gZ2V0UGFyZW50UkVsZW1lbnQodFZpZXcsIGNoaWxkVE5vZGUsIGxWaWV3KTtcbiAgY29uc3QgcmVuZGVyZXIgPSBsVmlld1tSRU5ERVJFUl07XG4gIGNvbnN0IHBhcmVudFROb2RlOiBUTm9kZSA9IGNoaWxkVE5vZGUucGFyZW50IHx8IGxWaWV3W1RfSE9TVF0hO1xuICBjb25zdCBhbmNob3JOb2RlID0gZ2V0SW5zZXJ0SW5Gcm9udE9mUk5vZGUocGFyZW50VE5vZGUsIGNoaWxkVE5vZGUsIGxWaWV3KTtcbiAgaWYgKHBhcmVudFJOb2RlICE9IG51bGwpIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShjaGlsZFJOb2RlKSkge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaGlsZFJOb2RlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG5hdGl2ZUFwcGVuZE9ySW5zZXJ0QmVmb3JlKHJlbmRlcmVyLCBwYXJlbnRSTm9kZSwgY2hpbGRSTm9kZVtpXSwgYW5jaG9yTm9kZSwgZmFsc2UpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBuYXRpdmVBcHBlbmRPckluc2VydEJlZm9yZShyZW5kZXJlciwgcGFyZW50Uk5vZGUsIGNoaWxkUk5vZGUsIGFuY2hvck5vZGUsIGZhbHNlKTtcbiAgICB9XG4gIH1cblxuICBfcHJvY2Vzc0kxOG5JbnNlcnRCZWZvcmUgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgX3Byb2Nlc3NJMThuSW5zZXJ0QmVmb3JlKHJlbmRlcmVyLCBjaGlsZFROb2RlLCBsVmlldywgY2hpbGRSTm9kZSwgcGFyZW50Uk5vZGUpO1xufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIGZpcnN0IG5hdGl2ZSBub2RlIGZvciBhIGdpdmVuIExWaWV3LCBzdGFydGluZyBmcm9tIHRoZSBwcm92aWRlZCBUTm9kZS5cbiAqXG4gKiBOYXRpdmUgbm9kZXMgYXJlIHJldHVybmVkIGluIHRoZSBvcmRlciBpbiB3aGljaCB0aG9zZSBhcHBlYXIgaW4gdGhlIG5hdGl2ZSB0cmVlIChET00pLlxuICovXG5mdW5jdGlvbiBnZXRGaXJzdE5hdGl2ZU5vZGUobFZpZXc6IExWaWV3LCB0Tm9kZTogVE5vZGV8bnVsbCk6IFJOb2RlfG51bGwge1xuICBpZiAodE5vZGUgIT09IG51bGwpIHtcbiAgICBuZ0Rldk1vZGUgJiZcbiAgICAgICAgYXNzZXJ0VE5vZGVUeXBlKFxuICAgICAgICAgICAgdE5vZGUsXG4gICAgICAgICAgICBUTm9kZVR5cGUuQW55Uk5vZGUgfCBUTm9kZVR5cGUuQW55Q29udGFpbmVyIHwgVE5vZGVUeXBlLkljdSB8IFROb2RlVHlwZS5Qcm9qZWN0aW9uKTtcblxuICAgIGNvbnN0IHROb2RlVHlwZSA9IHROb2RlLnR5cGU7XG4gICAgaWYgKHROb2RlVHlwZSAmIFROb2RlVHlwZS5BbnlSTm9kZSkge1xuICAgICAgcmV0dXJuIGdldE5hdGl2ZUJ5VE5vZGUodE5vZGUsIGxWaWV3KTtcbiAgICB9IGVsc2UgaWYgKHROb2RlVHlwZSAmIFROb2RlVHlwZS5Db250YWluZXIpIHtcbiAgICAgIHJldHVybiBnZXRCZWZvcmVOb2RlRm9yVmlldygtMSwgbFZpZXdbdE5vZGUuaW5kZXhdKTtcbiAgICB9IGVsc2UgaWYgKHROb2RlVHlwZSAmIFROb2RlVHlwZS5FbGVtZW50Q29udGFpbmVyKSB7XG4gICAgICBjb25zdCBlbEljdUNvbnRhaW5lckNoaWxkID0gdE5vZGUuY2hpbGQ7XG4gICAgICBpZiAoZWxJY3VDb250YWluZXJDaGlsZCAhPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gZ2V0Rmlyc3ROYXRpdmVOb2RlKGxWaWV3LCBlbEljdUNvbnRhaW5lckNoaWxkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHJOb2RlT3JMQ29udGFpbmVyID0gbFZpZXdbdE5vZGUuaW5kZXhdO1xuICAgICAgICBpZiAoaXNMQ29udGFpbmVyKHJOb2RlT3JMQ29udGFpbmVyKSkge1xuICAgICAgICAgIHJldHVybiBnZXRCZWZvcmVOb2RlRm9yVmlldygtMSwgck5vZGVPckxDb250YWluZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB1bndyYXBSTm9kZShyTm9kZU9yTENvbnRhaW5lcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHROb2RlVHlwZSAmIFROb2RlVHlwZS5JY3UpIHtcbiAgICAgIGxldCBuZXh0Uk5vZGUgPSBpY3VDb250YWluZXJJdGVyYXRlKHROb2RlIGFzIFRJY3VDb250YWluZXJOb2RlLCBsVmlldyk7XG4gICAgICBsZXQgck5vZGU6IFJOb2RlfG51bGwgPSBuZXh0Uk5vZGUoKTtcbiAgICAgIC8vIElmIHRoZSBJQ1UgY29udGFpbmVyIGhhcyBubyBub2RlcywgdGhhbiB3ZSB1c2UgdGhlIElDVSBhbmNob3IgYXMgdGhlIG5vZGUuXG4gICAgICByZXR1cm4gck5vZGUgfHwgdW53cmFwUk5vZGUobFZpZXdbdE5vZGUuaW5kZXhdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgcHJvamVjdGlvbk5vZGVzID0gZ2V0UHJvamVjdGlvbk5vZGVzKGxWaWV3LCB0Tm9kZSk7XG4gICAgICBpZiAocHJvamVjdGlvbk5vZGVzICE9PSBudWxsKSB7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHByb2plY3Rpb25Ob2RlcykpIHtcbiAgICAgICAgICByZXR1cm4gcHJvamVjdGlvbk5vZGVzWzBdO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBhcmVudFZpZXcgPSBnZXRMVmlld1BhcmVudChsVmlld1tERUNMQVJBVElPTl9DT01QT05FTlRfVklFV10pO1xuICAgICAgICBuZ0Rldk1vZGUgJiYgYXNzZXJ0UGFyZW50VmlldyhwYXJlbnRWaWV3KTtcbiAgICAgICAgcmV0dXJuIGdldEZpcnN0TmF0aXZlTm9kZShwYXJlbnRWaWV3ISwgcHJvamVjdGlvbk5vZGVzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBnZXRGaXJzdE5hdGl2ZU5vZGUobFZpZXcsIHROb2RlLm5leHQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UHJvamVjdGlvbk5vZGVzKGxWaWV3OiBMVmlldywgdE5vZGU6IFROb2RlfG51bGwpOiBUTm9kZXxSTm9kZVtdfG51bGwge1xuICBpZiAodE5vZGUgIT09IG51bGwpIHtcbiAgICBjb25zdCBjb21wb25lbnRWaWV3ID0gbFZpZXdbREVDTEFSQVRJT05fQ09NUE9ORU5UX1ZJRVddO1xuICAgIGNvbnN0IGNvbXBvbmVudEhvc3QgPSBjb21wb25lbnRWaWV3W1RfSE9TVF0gYXMgVEVsZW1lbnROb2RlO1xuICAgIGNvbnN0IHNsb3RJZHggPSB0Tm9kZS5wcm9qZWN0aW9uIGFzIG51bWJlcjtcbiAgICBuZ0Rldk1vZGUgJiYgYXNzZXJ0UHJvamVjdGlvblNsb3RzKGxWaWV3KTtcbiAgICByZXR1cm4gY29tcG9uZW50SG9zdC5wcm9qZWN0aW9uIVtzbG90SWR4XTtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEJlZm9yZU5vZGVGb3JWaWV3KHZpZXdJbmRleEluQ29udGFpbmVyOiBudW1iZXIsIGxDb250YWluZXI6IExDb250YWluZXIpOiBSTm9kZXxcbiAgICBudWxsIHtcbiAgY29uc3QgbmV4dFZpZXdJbmRleCA9IENPTlRBSU5FUl9IRUFERVJfT0ZGU0VUICsgdmlld0luZGV4SW5Db250YWluZXIgKyAxO1xuICBpZiAobmV4dFZpZXdJbmRleCA8IGxDb250YWluZXIubGVuZ3RoKSB7XG4gICAgY29uc3QgbFZpZXcgPSBsQ29udGFpbmVyW25leHRWaWV3SW5kZXhdIGFzIExWaWV3O1xuICAgIGNvbnN0IGZpcnN0VE5vZGVPZlZpZXcgPSBsVmlld1tUVklFV10uZmlyc3RDaGlsZDtcbiAgICBpZiAoZmlyc3RUTm9kZU9mVmlldyAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGdldEZpcnN0TmF0aXZlTm9kZShsVmlldywgZmlyc3RUTm9kZU9mVmlldyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGxDb250YWluZXJbTkFUSVZFXTtcbn1cblxuLyoqXG4gKiBSZW1vdmVzIGEgbmF0aXZlIG5vZGUgaXRzZWxmIHVzaW5nIGEgZ2l2ZW4gcmVuZGVyZXIuIFRvIHJlbW92ZSB0aGUgbm9kZSB3ZSBhcmUgbG9va2luZyB1cCBpdHNcbiAqIHBhcmVudCBmcm9tIHRoZSBuYXRpdmUgdHJlZSBhcyBub3QgYWxsIHBsYXRmb3JtcyAvIGJyb3dzZXJzIHN1cHBvcnQgdGhlIGVxdWl2YWxlbnQgb2ZcbiAqIG5vZGUucmVtb3ZlKCkuXG4gKlxuICogQHBhcmFtIHJlbmRlcmVyIEEgcmVuZGVyZXIgdG8gYmUgdXNlZFxuICogQHBhcmFtIHJOb2RlIFRoZSBuYXRpdmUgbm9kZSB0aGF0IHNob3VsZCBiZSByZW1vdmVkXG4gKiBAcGFyYW0gaXNIb3N0RWxlbWVudCBBIGZsYWcgaW5kaWNhdGluZyBpZiBhIG5vZGUgdG8gYmUgcmVtb3ZlZCBpcyBhIGhvc3Qgb2YgYSBjb21wb25lbnQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBuYXRpdmVSZW1vdmVOb2RlKHJlbmRlcmVyOiBSZW5kZXJlciwgck5vZGU6IFJOb2RlLCBpc0hvc3RFbGVtZW50PzogYm9vbGVhbik6IHZvaWQge1xuICBuZ0Rldk1vZGUgJiYgbmdEZXZNb2RlLnJlbmRlcmVyUmVtb3ZlTm9kZSsrO1xuICBjb25zdCBuYXRpdmVQYXJlbnQgPSBuYXRpdmVQYXJlbnROb2RlKHJlbmRlcmVyLCByTm9kZSk7XG4gIGlmIChuYXRpdmVQYXJlbnQpIHtcbiAgICBuYXRpdmVSZW1vdmVDaGlsZChyZW5kZXJlciwgbmF0aXZlUGFyZW50LCByTm9kZSwgaXNIb3N0RWxlbWVudCk7XG4gIH1cbn1cblxuXG4vKipcbiAqIFBlcmZvcm1zIHRoZSBvcGVyYXRpb24gb2YgYGFjdGlvbmAgb24gdGhlIG5vZGUuIFR5cGljYWxseSB0aGlzIGludm9sdmVzIGluc2VydGluZyBvciByZW1vdmluZ1xuICogbm9kZXMgb24gdGhlIExWaWV3IG9yIHByb2plY3Rpb24gYm91bmRhcnkuXG4gKi9cbmZ1bmN0aW9uIGFwcGx5Tm9kZXMoXG4gICAgcmVuZGVyZXI6IFJlbmRlcmVyLCBhY3Rpb246IFdhbGtUTm9kZVRyZWVBY3Rpb24sIHROb2RlOiBUTm9kZXxudWxsLCBsVmlldzogTFZpZXcsXG4gICAgcGFyZW50UkVsZW1lbnQ6IFJFbGVtZW50fG51bGwsIGJlZm9yZU5vZGU6IFJOb2RlfG51bGwsIGlzUHJvamVjdGlvbjogYm9vbGVhbikge1xuICB3aGlsZSAodE5vZGUgIT0gbnVsbCkge1xuICAgIG5nRGV2TW9kZSAmJiBhc3NlcnRUTm9kZUZvckxWaWV3KHROb2RlLCBsVmlldyk7XG4gICAgbmdEZXZNb2RlICYmXG4gICAgICAgIGFzc2VydFROb2RlVHlwZShcbiAgICAgICAgICAgIHROb2RlLFxuICAgICAgICAgICAgVE5vZGVUeXBlLkFueVJOb2RlIHwgVE5vZGVUeXBlLkFueUNvbnRhaW5lciB8IFROb2RlVHlwZS5Qcm9qZWN0aW9uIHwgVE5vZGVUeXBlLkljdSk7XG4gICAgY29uc3QgcmF3U2xvdFZhbHVlID0gbFZpZXdbdE5vZGUuaW5kZXhdO1xuICAgIGNvbnN0IHROb2RlVHlwZSA9IHROb2RlLnR5cGU7XG4gICAgaWYgKGlzUHJvamVjdGlvbikge1xuICAgICAgaWYgKGFjdGlvbiA9PT0gV2Fsa1ROb2RlVHJlZUFjdGlvbi5DcmVhdGUpIHtcbiAgICAgICAgcmF3U2xvdFZhbHVlICYmIGF0dGFjaFBhdGNoRGF0YSh1bndyYXBSTm9kZShyYXdTbG90VmFsdWUpLCBsVmlldyk7XG4gICAgICAgIHROb2RlLmZsYWdzIHw9IFROb2RlRmxhZ3MuaXNQcm9qZWN0ZWQ7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICgodE5vZGUuZmxhZ3MgJiBUTm9kZUZsYWdzLmlzRGV0YWNoZWQpICE9PSBUTm9kZUZsYWdzLmlzRGV0YWNoZWQpIHtcbiAgICAgIGlmICh0Tm9kZVR5cGUgJiBUTm9kZVR5cGUuRWxlbWVudENvbnRhaW5lcikge1xuICAgICAgICBhcHBseU5vZGVzKHJlbmRlcmVyLCBhY3Rpb24sIHROb2RlLmNoaWxkLCBsVmlldywgcGFyZW50UkVsZW1lbnQsIGJlZm9yZU5vZGUsIGZhbHNlKTtcbiAgICAgICAgYXBwbHlUb0VsZW1lbnRPckNvbnRhaW5lcihhY3Rpb24sIHJlbmRlcmVyLCBwYXJlbnRSRWxlbWVudCwgcmF3U2xvdFZhbHVlLCBiZWZvcmVOb2RlKTtcbiAgICAgIH0gZWxzZSBpZiAodE5vZGVUeXBlICYgVE5vZGVUeXBlLkljdSkge1xuICAgICAgICBjb25zdCBuZXh0Uk5vZGUgPSBpY3VDb250YWluZXJJdGVyYXRlKHROb2RlIGFzIFRJY3VDb250YWluZXJOb2RlLCBsVmlldyk7XG4gICAgICAgIGxldCByTm9kZTogUk5vZGV8bnVsbDtcbiAgICAgICAgd2hpbGUgKHJOb2RlID0gbmV4dFJOb2RlKCkpIHtcbiAgICAgICAgICBhcHBseVRvRWxlbWVudE9yQ29udGFpbmVyKGFjdGlvbiwgcmVuZGVyZXIsIHBhcmVudFJFbGVtZW50LCByTm9kZSwgYmVmb3JlTm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgYXBwbHlUb0VsZW1lbnRPckNvbnRhaW5lcihhY3Rpb24sIHJlbmRlcmVyLCBwYXJlbnRSRWxlbWVudCwgcmF3U2xvdFZhbHVlLCBiZWZvcmVOb2RlKTtcbiAgICAgIH0gZWxzZSBpZiAodE5vZGVUeXBlICYgVE5vZGVUeXBlLlByb2plY3Rpb24pIHtcbiAgICAgICAgYXBwbHlQcm9qZWN0aW9uUmVjdXJzaXZlKFxuICAgICAgICAgICAgcmVuZGVyZXIsIGFjdGlvbiwgbFZpZXcsIHROb2RlIGFzIFRQcm9qZWN0aW9uTm9kZSwgcGFyZW50UkVsZW1lbnQsIGJlZm9yZU5vZGUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmdEZXZNb2RlICYmIGFzc2VydFROb2RlVHlwZSh0Tm9kZSwgVE5vZGVUeXBlLkFueVJOb2RlIHwgVE5vZGVUeXBlLkNvbnRhaW5lcik7XG4gICAgICAgIGFwcGx5VG9FbGVtZW50T3JDb250YWluZXIoYWN0aW9uLCByZW5kZXJlciwgcGFyZW50UkVsZW1lbnQsIHJhd1Nsb3RWYWx1ZSwgYmVmb3JlTm9kZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHROb2RlID0gaXNQcm9qZWN0aW9uID8gdE5vZGUucHJvamVjdGlvbk5leHQgOiB0Tm9kZS5uZXh0O1xuICB9XG59XG5cblxuLyoqXG4gKiBgYXBwbHlWaWV3YCBwZXJmb3JtcyBvcGVyYXRpb24gb24gdGhlIHZpZXcgYXMgc3BlY2lmaWVkIGluIGBhY3Rpb25gIChpbnNlcnQsIGRldGFjaCwgZGVzdHJveSlcbiAqXG4gKiBJbnNlcnRpbmcgYSB2aWV3IHdpdGhvdXQgcHJvamVjdGlvbiBvciBjb250YWluZXJzIGF0IHRvcCBsZXZlbCBpcyBzaW1wbGUuIEp1c3QgaXRlcmF0ZSBvdmVyIHRoZVxuICogcm9vdCBub2RlcyBvZiB0aGUgVmlldywgYW5kIGZvciBlYWNoIG5vZGUgcGVyZm9ybSB0aGUgYGFjdGlvbmAuXG4gKlxuICogVGhpbmdzIGdldCBtb3JlIGNvbXBsaWNhdGVkIHdpdGggY29udGFpbmVycyBhbmQgcHJvamVjdGlvbnMuIFRoYXQgaXMgYmVjYXVzZSBjb21pbmcgYWNyb3NzOlxuICogLSBDb250YWluZXI6IGltcGxpZXMgdGhhdCB3ZSBoYXZlIHRvIGluc2VydC9yZW1vdmUvZGVzdHJveSB0aGUgdmlld3Mgb2YgdGhhdCBjb250YWluZXIgYXMgd2VsbFxuICogICAgICAgICAgICAgIHdoaWNoIGluIHR1cm4gY2FuIGhhdmUgdGhlaXIgb3duIENvbnRhaW5lcnMgYXQgdGhlIFZpZXcgcm9vdHMuXG4gKiAtIFByb2plY3Rpb246IGltcGxpZXMgdGhhdCB3ZSBoYXZlIHRvIGluc2VydC9yZW1vdmUvZGVzdHJveSB0aGUgbm9kZXMgb2YgdGhlIHByb2plY3Rpb24uIFRoZVxuICogICAgICAgICAgICAgICBjb21wbGljYXRpb24gaXMgdGhhdCB0aGUgbm9kZXMgd2UgYXJlIHByb2plY3RpbmcgY2FuIHRoZW1zZWx2ZXMgaGF2ZSBDb250YWluZXJzXG4gKiAgICAgICAgICAgICAgIG9yIG90aGVyIFByb2plY3Rpb25zLlxuICpcbiAqIEFzIHlvdSBjYW4gc2VlIHRoaXMgaXMgYSB2ZXJ5IHJlY3Vyc2l2ZSBwcm9ibGVtLiBZZXMgcmVjdXJzaW9uIGlzIG5vdCBtb3N0IGVmZmljaWVudCBidXQgdGhlXG4gKiBjb2RlIGlzIGNvbXBsaWNhdGVkIGVub3VnaCB0aGF0IHRyeWluZyB0byBpbXBsZW1lbnRlZCB3aXRoIHJlY3Vyc2lvbiBiZWNvbWVzIHVubWFpbnRhaW5hYmxlLlxuICpcbiAqIEBwYXJhbSB0VmlldyBUaGUgYFRWaWV3JyB3aGljaCBuZWVkcyB0byBiZSBpbnNlcnRlZCwgZGV0YWNoZWQsIGRlc3Ryb3llZFxuICogQHBhcmFtIGxWaWV3IFRoZSBMVmlldyB3aGljaCBuZWVkcyB0byBiZSBpbnNlcnRlZCwgZGV0YWNoZWQsIGRlc3Ryb3llZC5cbiAqIEBwYXJhbSByZW5kZXJlciBSZW5kZXJlciB0byB1c2VcbiAqIEBwYXJhbSBhY3Rpb24gYWN0aW9uIHRvIHBlcmZvcm0gKGluc2VydCwgZGV0YWNoLCBkZXN0cm95KVxuICogQHBhcmFtIHBhcmVudFJFbGVtZW50IHBhcmVudCBET00gZWxlbWVudCBmb3IgaW5zZXJ0aW9uIChSZW1vdmFsIGRvZXMgbm90IG5lZWQgaXQpLlxuICogQHBhcmFtIGJlZm9yZU5vZGUgQmVmb3JlIHdoaWNoIG5vZGUgdGhlIGluc2VydGlvbnMgc2hvdWxkIGhhcHBlbi5cbiAqL1xuZnVuY3Rpb24gYXBwbHlWaWV3KFxuICAgIHRWaWV3OiBUVmlldywgbFZpZXc6IExWaWV3LCByZW5kZXJlcjogUmVuZGVyZXIsIGFjdGlvbjogV2Fsa1ROb2RlVHJlZUFjdGlvbi5EZXN0cm95LFxuICAgIHBhcmVudFJFbGVtZW50OiBudWxsLCBiZWZvcmVOb2RlOiBudWxsKTogdm9pZDtcbmZ1bmN0aW9uIGFwcGx5VmlldyhcbiAgICB0VmlldzogVFZpZXcsIGxWaWV3OiBMVmlldywgcmVuZGVyZXI6IFJlbmRlcmVyLCBhY3Rpb246IFdhbGtUTm9kZVRyZWVBY3Rpb24sXG4gICAgcGFyZW50UkVsZW1lbnQ6IFJFbGVtZW50fG51bGwsIGJlZm9yZU5vZGU6IFJOb2RlfG51bGwpOiB2b2lkO1xuZnVuY3Rpb24gYXBwbHlWaWV3KFxuICAgIHRWaWV3OiBUVmlldywgbFZpZXc6IExWaWV3LCByZW5kZXJlcjogUmVuZGVyZXIsIGFjdGlvbjogV2Fsa1ROb2RlVHJlZUFjdGlvbixcbiAgICBwYXJlbnRSRWxlbWVudDogUkVsZW1lbnR8bnVsbCwgYmVmb3JlTm9kZTogUk5vZGV8bnVsbCk6IHZvaWQge1xuICBhcHBseU5vZGVzKHJlbmRlcmVyLCBhY3Rpb24sIHRWaWV3LmZpcnN0Q2hpbGQsIGxWaWV3LCBwYXJlbnRSRWxlbWVudCwgYmVmb3JlTm9kZSwgZmFsc2UpO1xufVxuXG4vKipcbiAqIGBhcHBseVByb2plY3Rpb25gIHBlcmZvcm1zIG9wZXJhdGlvbiBvbiB0aGUgcHJvamVjdGlvbi5cbiAqXG4gKiBJbnNlcnRpbmcgYSBwcm9qZWN0aW9uIHJlcXVpcmVzIHVzIHRvIGxvY2F0ZSB0aGUgcHJvamVjdGVkIG5vZGVzIGZyb20gdGhlIHBhcmVudCBjb21wb25lbnQuIFRoZVxuICogY29tcGxpY2F0aW9uIGlzIHRoYXQgdGhvc2Ugbm9kZXMgdGhlbXNlbHZlcyBjb3VsZCBiZSByZS1wcm9qZWN0ZWQgZnJvbSB0aGVpciBwYXJlbnQgY29tcG9uZW50LlxuICpcbiAqIEBwYXJhbSB0VmlldyBUaGUgYFRWaWV3YCBvZiBgTFZpZXdgIHdoaWNoIG5lZWRzIHRvIGJlIGluc2VydGVkLCBkZXRhY2hlZCwgZGVzdHJveWVkXG4gKiBAcGFyYW0gbFZpZXcgVGhlIGBMVmlld2Agd2hpY2ggbmVlZHMgdG8gYmUgaW5zZXJ0ZWQsIGRldGFjaGVkLCBkZXN0cm95ZWQuXG4gKiBAcGFyYW0gdFByb2plY3Rpb25Ob2RlIG5vZGUgdG8gcHJvamVjdFxuICovXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlQcm9qZWN0aW9uKHRWaWV3OiBUVmlldywgbFZpZXc6IExWaWV3LCB0UHJvamVjdGlvbk5vZGU6IFRQcm9qZWN0aW9uTm9kZSkge1xuICBjb25zdCByZW5kZXJlciA9IGxWaWV3W1JFTkRFUkVSXTtcbiAgY29uc3QgcGFyZW50Uk5vZGUgPSBnZXRQYXJlbnRSRWxlbWVudCh0VmlldywgdFByb2plY3Rpb25Ob2RlLCBsVmlldyk7XG4gIGNvbnN0IHBhcmVudFROb2RlID0gdFByb2plY3Rpb25Ob2RlLnBhcmVudCB8fCBsVmlld1tUX0hPU1RdITtcbiAgbGV0IGJlZm9yZU5vZGUgPSBnZXRJbnNlcnRJbkZyb250T2ZSTm9kZShwYXJlbnRUTm9kZSwgdFByb2plY3Rpb25Ob2RlLCBsVmlldyk7XG4gIGFwcGx5UHJvamVjdGlvblJlY3Vyc2l2ZShcbiAgICAgIHJlbmRlcmVyLCBXYWxrVE5vZGVUcmVlQWN0aW9uLkNyZWF0ZSwgbFZpZXcsIHRQcm9qZWN0aW9uTm9kZSwgcGFyZW50Uk5vZGUsIGJlZm9yZU5vZGUpO1xufVxuXG4vKipcbiAqIGBhcHBseVByb2plY3Rpb25SZWN1cnNpdmVgIHBlcmZvcm1zIG9wZXJhdGlvbiBvbiB0aGUgcHJvamVjdGlvbiBzcGVjaWZpZWQgYnkgYGFjdGlvbmAgKGluc2VydCxcbiAqIGRldGFjaCwgZGVzdHJveSlcbiAqXG4gKiBJbnNlcnRpbmcgYSBwcm9qZWN0aW9uIHJlcXVpcmVzIHVzIHRvIGxvY2F0ZSB0aGUgcHJvamVjdGVkIG5vZGVzIGZyb20gdGhlIHBhcmVudCBjb21wb25lbnQuIFRoZVxuICogY29tcGxpY2F0aW9uIGlzIHRoYXQgdGhvc2Ugbm9kZXMgdGhlbXNlbHZlcyBjb3VsZCBiZSByZS1wcm9qZWN0ZWQgZnJvbSB0aGVpciBwYXJlbnQgY29tcG9uZW50LlxuICpcbiAqIEBwYXJhbSByZW5kZXJlciBSZW5kZXIgdG8gdXNlXG4gKiBAcGFyYW0gYWN0aW9uIGFjdGlvbiB0byBwZXJmb3JtIChpbnNlcnQsIGRldGFjaCwgZGVzdHJveSlcbiAqIEBwYXJhbSBsVmlldyBUaGUgTFZpZXcgd2hpY2ggbmVlZHMgdG8gYmUgaW5zZXJ0ZWQsIGRldGFjaGVkLCBkZXN0cm95ZWQuXG4gKiBAcGFyYW0gdFByb2plY3Rpb25Ob2RlIG5vZGUgdG8gcHJvamVjdFxuICogQHBhcmFtIHBhcmVudFJFbGVtZW50IHBhcmVudCBET00gZWxlbWVudCBmb3IgaW5zZXJ0aW9uL3JlbW92YWwuXG4gKiBAcGFyYW0gYmVmb3JlTm9kZSBCZWZvcmUgd2hpY2ggbm9kZSB0aGUgaW5zZXJ0aW9ucyBzaG91bGQgaGFwcGVuLlxuICovXG5mdW5jdGlvbiBhcHBseVByb2plY3Rpb25SZWN1cnNpdmUoXG4gICAgcmVuZGVyZXI6IFJlbmRlcmVyLCBhY3Rpb246IFdhbGtUTm9kZVRyZWVBY3Rpb24sIGxWaWV3OiBMVmlldywgdFByb2plY3Rpb25Ob2RlOiBUUHJvamVjdGlvbk5vZGUsXG4gICAgcGFyZW50UkVsZW1lbnQ6IFJFbGVtZW50fG51bGwsIGJlZm9yZU5vZGU6IFJOb2RlfG51bGwpIHtcbiAgY29uc3QgY29tcG9uZW50TFZpZXcgPSBsVmlld1tERUNMQVJBVElPTl9DT01QT05FTlRfVklFV107XG4gIGNvbnN0IGNvbXBvbmVudE5vZGUgPSBjb21wb25lbnRMVmlld1tUX0hPU1RdIGFzIFRFbGVtZW50Tm9kZTtcbiAgbmdEZXZNb2RlICYmXG4gICAgICBhc3NlcnRFcXVhbCh0eXBlb2YgdFByb2plY3Rpb25Ob2RlLnByb2plY3Rpb24sICdudW1iZXInLCAnZXhwZWN0aW5nIHByb2plY3Rpb24gaW5kZXgnKTtcbiAgY29uc3Qgbm9kZVRvUHJvamVjdE9yUk5vZGVzID0gY29tcG9uZW50Tm9kZS5wcm9qZWN0aW9uIVt0UHJvamVjdGlvbk5vZGUucHJvamVjdGlvbl0hO1xuICBpZiAoQXJyYXkuaXNBcnJheShub2RlVG9Qcm9qZWN0T3JSTm9kZXMpKSB7XG4gICAgLy8gVGhpcyBzaG91bGQgbm90IGV4aXN0LCBpdCBpcyBhIGJpdCBvZiBhIGhhY2suIFdoZW4gd2UgYm9vdHN0cmFwIGEgdG9wIGxldmVsIG5vZGUgYW5kIHdlXG4gICAgLy8gbmVlZCB0byBzdXBwb3J0IHBhc3NpbmcgcHJvamVjdGFibGUgbm9kZXMsIHNvIHdlIGNoZWF0IGFuZCBwdXQgdGhlbSBpbiB0aGUgVE5vZGVcbiAgICAvLyBvZiB0aGUgSG9zdCBUVmlldy4gKFllcyB3ZSBwdXQgaW5zdGFuY2UgaW5mbyBhdCB0aGUgVCBMZXZlbCkuIFdlIGNhbiBnZXQgYXdheSB3aXRoIGl0XG4gICAgLy8gYmVjYXVzZSB3ZSBrbm93IHRoYXQgdGhhdCBUVmlldyBpcyBub3Qgc2hhcmVkIGFuZCB0aGVyZWZvcmUgaXQgd2lsbCBub3QgYmUgYSBwcm9ibGVtLlxuICAgIC8vIFRoaXMgc2hvdWxkIGJlIHJlZmFjdG9yZWQgYW5kIGNsZWFuZWQgdXAuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlVG9Qcm9qZWN0T3JSTm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHJOb2RlID0gbm9kZVRvUHJvamVjdE9yUk5vZGVzW2ldO1xuICAgICAgYXBwbHlUb0VsZW1lbnRPckNvbnRhaW5lcihhY3Rpb24sIHJlbmRlcmVyLCBwYXJlbnRSRWxlbWVudCwgck5vZGUsIGJlZm9yZU5vZGUpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBsZXQgbm9kZVRvUHJvamVjdDogVE5vZGV8bnVsbCA9IG5vZGVUb1Byb2plY3RPclJOb2RlcztcbiAgICBjb25zdCBwcm9qZWN0ZWRDb21wb25lbnRMVmlldyA9IGNvbXBvbmVudExWaWV3W1BBUkVOVF0gYXMgTFZpZXc7XG4gICAgYXBwbHlOb2RlcyhcbiAgICAgICAgcmVuZGVyZXIsIGFjdGlvbiwgbm9kZVRvUHJvamVjdCwgcHJvamVjdGVkQ29tcG9uZW50TFZpZXcsIHBhcmVudFJFbGVtZW50LCBiZWZvcmVOb2RlLCB0cnVlKTtcbiAgfVxufVxuXG5cbi8qKlxuICogYGFwcGx5Q29udGFpbmVyYCBwZXJmb3JtcyBhbiBvcGVyYXRpb24gb24gdGhlIGNvbnRhaW5lciBhbmQgaXRzIHZpZXdzIGFzIHNwZWNpZmllZCBieVxuICogYGFjdGlvbmAgKGluc2VydCwgZGV0YWNoLCBkZXN0cm95KVxuICpcbiAqIEluc2VydGluZyBhIENvbnRhaW5lciBpcyBjb21wbGljYXRlZCBieSB0aGUgZmFjdCB0aGF0IHRoZSBjb250YWluZXIgbWF5IGhhdmUgVmlld3Mgd2hpY2hcbiAqIHRoZW1zZWx2ZXMgaGF2ZSBjb250YWluZXJzIG9yIHByb2plY3Rpb25zLlxuICpcbiAqIEBwYXJhbSByZW5kZXJlciBSZW5kZXJlciB0byB1c2VcbiAqIEBwYXJhbSBhY3Rpb24gYWN0aW9uIHRvIHBlcmZvcm0gKGluc2VydCwgZGV0YWNoLCBkZXN0cm95KVxuICogQHBhcmFtIGxDb250YWluZXIgVGhlIExDb250YWluZXIgd2hpY2ggbmVlZHMgdG8gYmUgaW5zZXJ0ZWQsIGRldGFjaGVkLCBkZXN0cm95ZWQuXG4gKiBAcGFyYW0gcGFyZW50UkVsZW1lbnQgcGFyZW50IERPTSBlbGVtZW50IGZvciBpbnNlcnRpb24vcmVtb3ZhbC5cbiAqIEBwYXJhbSBiZWZvcmVOb2RlIEJlZm9yZSB3aGljaCBub2RlIHRoZSBpbnNlcnRpb25zIHNob3VsZCBoYXBwZW4uXG4gKi9cbmZ1bmN0aW9uIGFwcGx5Q29udGFpbmVyKFxuICAgIHJlbmRlcmVyOiBSZW5kZXJlciwgYWN0aW9uOiBXYWxrVE5vZGVUcmVlQWN0aW9uLCBsQ29udGFpbmVyOiBMQ29udGFpbmVyLFxuICAgIHBhcmVudFJFbGVtZW50OiBSRWxlbWVudHxudWxsLCBiZWZvcmVOb2RlOiBSTm9kZXxudWxsfHVuZGVmaW5lZCkge1xuICBuZ0Rldk1vZGUgJiYgYXNzZXJ0TENvbnRhaW5lcihsQ29udGFpbmVyKTtcbiAgY29uc3QgYW5jaG9yID0gbENvbnRhaW5lcltOQVRJVkVdOyAgLy8gTENvbnRhaW5lciBoYXMgaXRzIG93biBiZWZvcmUgbm9kZS5cbiAgY29uc3QgbmF0aXZlID0gdW53cmFwUk5vZGUobENvbnRhaW5lcik7XG4gIC8vIEFuIExDb250YWluZXIgY2FuIGJlIGNyZWF0ZWQgZHluYW1pY2FsbHkgb24gYW55IG5vZGUgYnkgaW5qZWN0aW5nIFZpZXdDb250YWluZXJSZWYuXG4gIC8vIEFza2luZyBmb3IgYSBWaWV3Q29udGFpbmVyUmVmIG9uIGFuIGVsZW1lbnQgd2lsbCByZXN1bHQgaW4gYSBjcmVhdGlvbiBvZiBhIHNlcGFyYXRlIGFuY2hvclxuICAvLyBub2RlIChjb21tZW50IGluIHRoZSBET00pIHRoYXQgd2lsbCBiZSBkaWZmZXJlbnQgZnJvbSB0aGUgTENvbnRhaW5lcidzIGhvc3Qgbm9kZS4gSW4gdGhpc1xuICAvLyBwYXJ0aWN1bGFyIGNhc2Ugd2UgbmVlZCB0byBleGVjdXRlIGFjdGlvbiBvbiAyIG5vZGVzOlxuICAvLyAtIGNvbnRhaW5lcidzIGhvc3Qgbm9kZSAodGhpcyBpcyBkb25lIGluIHRoZSBleGVjdXRlQWN0aW9uT25FbGVtZW50T3JDb250YWluZXIpXG4gIC8vIC0gY29udGFpbmVyJ3MgaG9zdCBub2RlICh0aGlzIGlzIGRvbmUgaGVyZSlcbiAgaWYgKGFuY2hvciAhPT0gbmF0aXZlKSB7XG4gICAgLy8gVGhpcyBpcyB2ZXJ5IHN0cmFuZ2UgdG8gbWUgKE1pc2tvKS4gSSB3b3VsZCBleHBlY3QgdGhhdCB0aGUgbmF0aXZlIGlzIHNhbWUgYXMgYW5jaG9yLiBJXG4gICAgLy8gZG9uJ3Qgc2VlIGEgcmVhc29uIHdoeSB0aGV5IHNob3VsZCBiZSBkaWZmZXJlbnQsIGJ1dCB0aGV5IGFyZS5cbiAgICAvL1xuICAgIC8vIElmIHRoZXkgYXJlIHdlIG5lZWQgdG8gcHJvY2VzcyB0aGUgc2Vjb25kIGFuY2hvciBhcyB3ZWxsLlxuICAgIGFwcGx5VG9FbGVtZW50T3JDb250YWluZXIoYWN0aW9uLCByZW5kZXJlciwgcGFyZW50UkVsZW1lbnQsIGFuY2hvciwgYmVmb3JlTm9kZSk7XG4gIH1cbiAgZm9yIChsZXQgaSA9IENPTlRBSU5FUl9IRUFERVJfT0ZGU0VUOyBpIDwgbENvbnRhaW5lci5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGxWaWV3ID0gbENvbnRhaW5lcltpXSBhcyBMVmlldztcbiAgICBhcHBseVZpZXcobFZpZXdbVFZJRVddLCBsVmlldywgcmVuZGVyZXIsIGFjdGlvbiwgcGFyZW50UkVsZW1lbnQsIGFuY2hvcik7XG4gIH1cbn1cblxuLyoqXG4gKiBXcml0ZXMgY2xhc3Mvc3R5bGUgdG8gZWxlbWVudC5cbiAqXG4gKiBAcGFyYW0gcmVuZGVyZXIgUmVuZGVyZXIgdG8gdXNlLlxuICogQHBhcmFtIGlzQ2xhc3NCYXNlZCBgdHJ1ZWAgaWYgaXQgc2hvdWxkIGJlIHdyaXR0ZW4gdG8gYGNsYXNzYCAoYGZhbHNlYCB0byB3cml0ZSB0byBgc3R5bGVgKVxuICogQHBhcmFtIHJOb2RlIFRoZSBOb2RlIHRvIHdyaXRlIHRvLlxuICogQHBhcmFtIHByb3AgUHJvcGVydHkgdG8gd3JpdGUgdG8uIFRoaXMgd291bGQgYmUgdGhlIGNsYXNzL3N0eWxlIG5hbWUuXG4gKiBAcGFyYW0gdmFsdWUgVmFsdWUgdG8gd3JpdGUuIElmIGBudWxsYC9gdW5kZWZpbmVkYC9gZmFsc2VgIHRoaXMgaXMgY29uc2lkZXJlZCBhIHJlbW92ZSAoc2V0L2FkZFxuICogICAgICAgIG90aGVyd2lzZSkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhcHBseVN0eWxpbmcoXG4gICAgcmVuZGVyZXI6IFJlbmRlcmVyLCBpc0NsYXNzQmFzZWQ6IGJvb2xlYW4sIHJOb2RlOiBSRWxlbWVudCwgcHJvcDogc3RyaW5nLCB2YWx1ZTogYW55KSB7XG4gIGlmIChpc0NsYXNzQmFzZWQpIHtcbiAgICAvLyBXZSBhY3R1YWxseSB3YW50IEpTIHRydWUvZmFsc2UgaGVyZSBiZWNhdXNlIGFueSB0cnV0aHkgdmFsdWUgc2hvdWxkIGFkZCB0aGUgY2xhc3NcbiAgICBpZiAoIXZhbHVlKSB7XG4gICAgICBuZ0Rldk1vZGUgJiYgbmdEZXZNb2RlLnJlbmRlcmVyUmVtb3ZlQ2xhc3MrKztcbiAgICAgIHJlbmRlcmVyLnJlbW92ZUNsYXNzKHJOb2RlLCBwcm9wKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmdEZXZNb2RlICYmIG5nRGV2TW9kZS5yZW5kZXJlckFkZENsYXNzKys7XG4gICAgICByZW5kZXJlci5hZGRDbGFzcyhyTm9kZSwgcHJvcCk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGxldCBmbGFncyA9IHByb3AuaW5kZXhPZignLScpID09PSAtMSA/IHVuZGVmaW5lZCA6IFJlbmRlcmVyU3R5bGVGbGFnczIuRGFzaENhc2UgYXMgbnVtYmVyO1xuICAgIGlmICh2YWx1ZSA9PSBudWxsIC8qKiB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkICovKSB7XG4gICAgICBuZ0Rldk1vZGUgJiYgbmdEZXZNb2RlLnJlbmRlcmVyUmVtb3ZlU3R5bGUrKztcbiAgICAgIHJlbmRlcmVyLnJlbW92ZVN0eWxlKHJOb2RlLCBwcm9wLCBmbGFncyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEEgdmFsdWUgaXMgaW1wb3J0YW50IGlmIGl0IGVuZHMgd2l0aCBgIWltcG9ydGFudGAuIFRoZSBzdHlsZVxuICAgICAgLy8gcGFyc2VyIHN0cmlwcyBhbnkgc2VtaWNvbG9ucyBhdCB0aGUgZW5kIG9mIHRoZSB2YWx1ZS5cbiAgICAgIGNvbnN0IGlzSW1wb3J0YW50ID0gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyA/IHZhbHVlLmVuZHNXaXRoKCchaW1wb3J0YW50JykgOiBmYWxzZTtcblxuICAgICAgaWYgKGlzSW1wb3J0YW50KSB7XG4gICAgICAgIC8vICFpbXBvcnRhbnQgaGFzIHRvIGJlIHN0cmlwcGVkIGZyb20gdGhlIHZhbHVlIGZvciBpdCB0byBiZSB2YWxpZC5cbiAgICAgICAgdmFsdWUgPSB2YWx1ZS5zbGljZSgwLCAtMTApO1xuICAgICAgICBmbGFncyEgfD0gUmVuZGVyZXJTdHlsZUZsYWdzMi5JbXBvcnRhbnQ7XG4gICAgICB9XG5cbiAgICAgIG5nRGV2TW9kZSAmJiBuZ0Rldk1vZGUucmVuZGVyZXJTZXRTdHlsZSsrO1xuICAgICAgcmVuZGVyZXIuc2V0U3R5bGUock5vZGUsIHByb3AsIHZhbHVlLCBmbGFncyk7XG4gICAgfVxuICB9XG59XG5cblxuLyoqXG4gKiBXcml0ZSBgY3NzVGV4dGAgdG8gYFJFbGVtZW50YC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIGRvZXMgZGlyZWN0IHdyaXRlIHdpdGhvdXQgYW55IHJlY29uY2lsaWF0aW9uLiBVc2VkIGZvciB3cml0aW5nIGluaXRpYWwgdmFsdWVzLCBzb1xuICogdGhhdCBzdGF0aWMgc3R5bGluZyB2YWx1ZXMgZG8gbm90IHB1bGwgaW4gdGhlIHN0eWxlIHBhcnNlci5cbiAqXG4gKiBAcGFyYW0gcmVuZGVyZXIgUmVuZGVyZXIgdG8gdXNlXG4gKiBAcGFyYW0gZWxlbWVudCBUaGUgZWxlbWVudCB3aGljaCBuZWVkcyB0byBiZSB1cGRhdGVkLlxuICogQHBhcmFtIG5ld1ZhbHVlIFRoZSBuZXcgY2xhc3MgbGlzdCB0byB3cml0ZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlRGlyZWN0U3R5bGUocmVuZGVyZXI6IFJlbmRlcmVyLCBlbGVtZW50OiBSRWxlbWVudCwgbmV3VmFsdWU6IHN0cmluZykge1xuICBuZ0Rldk1vZGUgJiYgYXNzZXJ0U3RyaW5nKG5ld1ZhbHVlLCAnXFwnbmV3VmFsdWVcXCcgc2hvdWxkIGJlIGEgc3RyaW5nJyk7XG4gIHJlbmRlcmVyLnNldEF0dHJpYnV0ZShlbGVtZW50LCAnc3R5bGUnLCBuZXdWYWx1ZSk7XG4gIG5nRGV2TW9kZSAmJiBuZ0Rldk1vZGUucmVuZGVyZXJTZXRTdHlsZSsrO1xufVxuXG4vKipcbiAqIFdyaXRlIGBjbGFzc05hbWVgIHRvIGBSRWxlbWVudGAuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBkb2VzIGRpcmVjdCB3cml0ZSB3aXRob3V0IGFueSByZWNvbmNpbGlhdGlvbi4gVXNlZCBmb3Igd3JpdGluZyBpbml0aWFsIHZhbHVlcywgc29cbiAqIHRoYXQgc3RhdGljIHN0eWxpbmcgdmFsdWVzIGRvIG5vdCBwdWxsIGluIHRoZSBzdHlsZSBwYXJzZXIuXG4gKlxuICogQHBhcmFtIHJlbmRlcmVyIFJlbmRlcmVyIHRvIHVzZVxuICogQHBhcmFtIGVsZW1lbnQgVGhlIGVsZW1lbnQgd2hpY2ggbmVlZHMgdG8gYmUgdXBkYXRlZC5cbiAqIEBwYXJhbSBuZXdWYWx1ZSBUaGUgbmV3IGNsYXNzIGxpc3QgdG8gd3JpdGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZURpcmVjdENsYXNzKHJlbmRlcmVyOiBSZW5kZXJlciwgZWxlbWVudDogUkVsZW1lbnQsIG5ld1ZhbHVlOiBzdHJpbmcpIHtcbiAgbmdEZXZNb2RlICYmIGFzc2VydFN0cmluZyhuZXdWYWx1ZSwgJ1xcJ25ld1ZhbHVlXFwnIHNob3VsZCBiZSBhIHN0cmluZycpO1xuICBpZiAobmV3VmFsdWUgPT09ICcnKSB7XG4gICAgLy8gVGhlcmUgYXJlIHRlc3RzIGluIGBnb29nbGUzYCB3aGljaCBleHBlY3QgYGVsZW1lbnQuZ2V0QXR0cmlidXRlKCdjbGFzcycpYCB0byBiZSBgbnVsbGAuXG4gICAgcmVuZGVyZXIucmVtb3ZlQXR0cmlidXRlKGVsZW1lbnQsICdjbGFzcycpO1xuICB9IGVsc2Uge1xuICAgIHJlbmRlcmVyLnNldEF0dHJpYnV0ZShlbGVtZW50LCAnY2xhc3MnLCBuZXdWYWx1ZSk7XG4gIH1cbiAgbmdEZXZNb2RlICYmIG5nRGV2TW9kZS5yZW5kZXJlclNldENsYXNzTmFtZSsrO1xufVxuIl19
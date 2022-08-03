/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { convertToParamMap, PRIMARY_OUTLET } from './shared';
import { equalSegments, UrlSegment } from './url_tree';
import { shallowEqual, shallowEqualArrays } from './utils/collection';
import { Tree, TreeNode } from './utils/tree';
/**
 * Represents the state of the router as a tree of activated routes.
 *
 * @usageNotes
 *
 * Every node in the route tree is an `ActivatedRoute` instance
 * that knows about the "consumed" URL segments, the extracted parameters,
 * and the resolved data.
 * Use the `ActivatedRoute` properties to traverse the tree from any node.
 *
 * The following fragment shows how a component gets the root node
 * of the current state to establish its own route tree:
 *
 * ```
 * @Component({templateUrl:'template.html'})
 * class MyComponent {
 *   constructor(router: Router) {
 *     const state: RouterState = router.routerState;
 *     const root: ActivatedRoute = state.root;
 *     const child = root.firstChild;
 *     const id: Observable<string> = child.params.map(p => p.id);
 *     //...
 *   }
 * }
 * ```
 *
 * @see `ActivatedRoute`
 * @see [Getting route information](guide/router#getting-route-information)
 *
 * @publicApi
 */
export class RouterState extends Tree {
    /** @internal */
    constructor(root, 
    /** The current snapshot of the router state */
    snapshot) {
        super(root);
        this.snapshot = snapshot;
        setRouterState(this, root);
    }
    toString() {
        return this.snapshot.toString();
    }
}
export function createEmptyState(urlTree, rootComponent) {
    const snapshot = createEmptyStateSnapshot(urlTree, rootComponent);
    const emptyUrl = new BehaviorSubject([new UrlSegment('', {})]);
    const emptyParams = new BehaviorSubject({});
    const emptyData = new BehaviorSubject({});
    const emptyQueryParams = new BehaviorSubject({});
    const fragment = new BehaviorSubject('');
    const activated = new ActivatedRoute(emptyUrl, emptyParams, emptyQueryParams, fragment, emptyData, PRIMARY_OUTLET, rootComponent, snapshot.root);
    activated.snapshot = snapshot.root;
    return new RouterState(new TreeNode(activated, []), snapshot);
}
export function createEmptyStateSnapshot(urlTree, rootComponent) {
    const emptyParams = {};
    const emptyData = {};
    const emptyQueryParams = {};
    const fragment = '';
    const activated = new ActivatedRouteSnapshot([], emptyParams, emptyQueryParams, fragment, emptyData, PRIMARY_OUTLET, rootComponent, null, urlTree.root, -1, {});
    return new RouterStateSnapshot('', new TreeNode(activated, []));
}
/**
 * Provides access to information about a route associated with a component
 * that is loaded in an outlet.
 * Use to traverse the `RouterState` tree and extract information from nodes.
 *
 * The following example shows how to construct a component using information from a
 * currently activated route.
 *
 * Note: the observables in this class only emit when the current and previous values differ based
 * on shallow equality. For example, changing deeply nested properties in resolved `data` will not
 * cause the `ActivatedRoute.data` `Observable` to emit a new value.
 *
 * {@example router/activated-route/module.ts region="activated-route"
 *     header="activated-route.component.ts"}
 *
 * @see [Getting route information](guide/router#getting-route-information)
 *
 * @publicApi
 */
export class ActivatedRoute {
    /** @internal */
    constructor(
    /** An observable of the URL segments matched by this route. */
    url, 
    /** An observable of the matrix parameters scoped to this route. */
    params, 
    /** An observable of the query parameters shared by all the routes. */
    queryParams, 
    /** An observable of the URL fragment shared by all the routes. */
    fragment, 
    /** An observable of the static and resolved data of this route. */
    data, 
    /** The outlet name of the route, a constant. */
    outlet, 
    /** The component of the route, a constant. */
    component, futureSnapshot) {
        this.url = url;
        this.params = params;
        this.queryParams = queryParams;
        this.fragment = fragment;
        this.data = data;
        this.outlet = outlet;
        this.component = component;
        this._futureSnapshot = futureSnapshot;
    }
    /** The configuration used to match this route. */
    get routeConfig() {
        return this._futureSnapshot.routeConfig;
    }
    /** The root of the router state. */
    get root() {
        return this._routerState.root;
    }
    /** The parent of this route in the router state tree. */
    get parent() {
        return this._routerState.parent(this);
    }
    /** The first child of this route in the router state tree. */
    get firstChild() {
        return this._routerState.firstChild(this);
    }
    /** The children of this route in the router state tree. */
    get children() {
        return this._routerState.children(this);
    }
    /** The path from the root of the router state tree to this route. */
    get pathFromRoot() {
        return this._routerState.pathFromRoot(this);
    }
    /**
     * An Observable that contains a map of the required and optional parameters
     * specific to the route.
     * The map supports retrieving single and multiple values from the same parameter.
     */
    get paramMap() {
        if (!this._paramMap) {
            this._paramMap = this.params.pipe(map((p) => convertToParamMap(p)));
        }
        return this._paramMap;
    }
    /**
     * An Observable that contains a map of the query parameters available to all routes.
     * The map supports retrieving single and multiple values from the query parameter.
     */
    get queryParamMap() {
        if (!this._queryParamMap) {
            this._queryParamMap =
                this.queryParams.pipe(map((p) => convertToParamMap(p)));
        }
        return this._queryParamMap;
    }
    toString() {
        return this.snapshot ? this.snapshot.toString() : `Future(${this._futureSnapshot})`;
    }
}
/**
 * Returns the inherited params, data, and resolve for a given route.
 * By default, this only inherits values up to the nearest path-less or component-less route.
 * @internal
 */
export function inheritedParamsDataResolve(route, paramsInheritanceStrategy = 'emptyOnly') {
    const pathFromRoot = route.pathFromRoot;
    let inheritingStartingFrom = 0;
    if (paramsInheritanceStrategy !== 'always') {
        inheritingStartingFrom = pathFromRoot.length - 1;
        while (inheritingStartingFrom >= 1) {
            const current = pathFromRoot[inheritingStartingFrom];
            const parent = pathFromRoot[inheritingStartingFrom - 1];
            // current route is an empty path => inherits its parent's params and data
            if (current.routeConfig && current.routeConfig.path === '') {
                inheritingStartingFrom--;
                // parent is componentless => current route should inherit its params and data
            }
            else if (!parent.component) {
                inheritingStartingFrom--;
            }
            else {
                break;
            }
        }
    }
    return flattenInherited(pathFromRoot.slice(inheritingStartingFrom));
}
/** @internal */
function flattenInherited(pathFromRoot) {
    return pathFromRoot.reduce((res, curr) => {
        const params = { ...res.params, ...curr.params };
        const data = { ...res.data, ...curr.data };
        const resolve = { ...curr.data, ...res.resolve, ...curr.routeConfig?.data, ...curr._resolvedData };
        return { params, data, resolve };
    }, { params: {}, data: {}, resolve: {} });
}
/**
 * @description
 *
 * Contains the information about a route associated with a component loaded in an
 * outlet at a particular moment in time. ActivatedRouteSnapshot can also be used to
 * traverse the router state tree.
 *
 * The following example initializes a component with route information extracted
 * from the snapshot of the root node at the time of creation.
 *
 * ```
 * @Component({templateUrl:'./my-component.html'})
 * class MyComponent {
 *   constructor(route: ActivatedRoute) {
 *     const id: string = route.snapshot.params.id;
 *     const url: string = route.snapshot.url.join('');
 *     const user = route.snapshot.data.user;
 *   }
 * }
 * ```
 *
 * @publicApi
 */
export class ActivatedRouteSnapshot {
    /** @internal */
    constructor(
    /** The URL segments matched by this route */
    url, 
    /**
     *  The matrix parameters scoped to this route.
     *
     *  You can compute all params (or data) in the router state or to get params outside
     *  of an activated component by traversing the `RouterState` tree as in the following
     *  example:
     *  ```
     *  collectRouteParams(router: Router) {
     *    let params = {};
     *    let stack: ActivatedRouteSnapshot[] = [router.routerState.snapshot.root];
     *    while (stack.length > 0) {
     *      const route = stack.pop()!;
     *      params = {...params, ...route.params};
     *      stack.push(...route.children);
     *    }
     *    return params;
     *  }
     *  ```
     */
    params, 
    /** The query parameters shared by all the routes */
    queryParams, 
    /** The URL fragment shared by all the routes */
    fragment, 
    /** The static and resolved data of this route */
    data, 
    /** The outlet name of the route */
    outlet, 
    /** The component of the route */
    component, routeConfig, urlSegment, lastPathIndex, resolve, correctedLastPathIndex) {
        this.url = url;
        this.params = params;
        this.queryParams = queryParams;
        this.fragment = fragment;
        this.data = data;
        this.outlet = outlet;
        this.component = component;
        this.routeConfig = routeConfig;
        this._urlSegment = urlSegment;
        this._lastPathIndex = lastPathIndex;
        this._correctedLastPathIndex = correctedLastPathIndex ?? lastPathIndex;
        this._resolve = resolve;
    }
    /** The root of the router state */
    get root() {
        return this._routerState.root;
    }
    /** The parent of this route in the router state tree */
    get parent() {
        return this._routerState.parent(this);
    }
    /** The first child of this route in the router state tree */
    get firstChild() {
        return this._routerState.firstChild(this);
    }
    /** The children of this route in the router state tree */
    get children() {
        return this._routerState.children(this);
    }
    /** The path from the root of the router state tree to this route */
    get pathFromRoot() {
        return this._routerState.pathFromRoot(this);
    }
    get paramMap() {
        if (!this._paramMap) {
            this._paramMap = convertToParamMap(this.params);
        }
        return this._paramMap;
    }
    get queryParamMap() {
        if (!this._queryParamMap) {
            this._queryParamMap = convertToParamMap(this.queryParams);
        }
        return this._queryParamMap;
    }
    toString() {
        const url = this.url.map(segment => segment.toString()).join('/');
        const matched = this.routeConfig ? this.routeConfig.path : '';
        return `Route(url:'${url}', path:'${matched}')`;
    }
}
/**
 * @description
 *
 * Represents the state of the router at a moment in time.
 *
 * This is a tree of activated route snapshots. Every node in this tree knows about
 * the "consumed" URL segments, the extracted parameters, and the resolved data.
 *
 * The following example shows how a component is initialized with information
 * from the snapshot of the root node's state at the time of creation.
 *
 * ```
 * @Component({templateUrl:'template.html'})
 * class MyComponent {
 *   constructor(router: Router) {
 *     const state: RouterState = router.routerState;
 *     const snapshot: RouterStateSnapshot = state.snapshot;
 *     const root: ActivatedRouteSnapshot = snapshot.root;
 *     const child = root.firstChild;
 *     const id: Observable<string> = child.params.map(p => p.id);
 *     //...
 *   }
 * }
 * ```
 *
 * @publicApi
 */
export class RouterStateSnapshot extends Tree {
    /** @internal */
    constructor(
    /** The url from which this snapshot was created */
    url, root) {
        super(root);
        this.url = url;
        setRouterState(this, root);
    }
    toString() {
        return serializeNode(this._root);
    }
}
function setRouterState(state, node) {
    node.value._routerState = state;
    node.children.forEach(c => setRouterState(state, c));
}
function serializeNode(node) {
    const c = node.children.length > 0 ? ` { ${node.children.map(serializeNode).join(', ')} } ` : '';
    return `${node.value}${c}`;
}
/**
 * The expectation is that the activate route is created with the right set of parameters.
 * So we push new values into the observables only when they are not the initial values.
 * And we detect that by checking if the snapshot field is set.
 */
export function advanceActivatedRoute(route) {
    if (route.snapshot) {
        const currentSnapshot = route.snapshot;
        const nextSnapshot = route._futureSnapshot;
        route.snapshot = nextSnapshot;
        if (!shallowEqual(currentSnapshot.queryParams, nextSnapshot.queryParams)) {
            route.queryParams.next(nextSnapshot.queryParams);
        }
        if (currentSnapshot.fragment !== nextSnapshot.fragment) {
            route.fragment.next(nextSnapshot.fragment);
        }
        if (!shallowEqual(currentSnapshot.params, nextSnapshot.params)) {
            route.params.next(nextSnapshot.params);
        }
        if (!shallowEqualArrays(currentSnapshot.url, nextSnapshot.url)) {
            route.url.next(nextSnapshot.url);
        }
        if (!shallowEqual(currentSnapshot.data, nextSnapshot.data)) {
            route.data.next(nextSnapshot.data);
        }
    }
    else {
        route.snapshot = route._futureSnapshot;
        // this is for resolved data
        route.data.next(route._futureSnapshot.data);
    }
}
export function equalParamsAndUrlSegments(a, b) {
    const equalUrlParams = shallowEqual(a.params, b.params) && equalSegments(a.url, b.url);
    const parentsMismatch = !a.parent !== !b.parent;
    return equalUrlParams && !parentsMismatch &&
        (!a.parent || equalParamsAndUrlSegments(a.parent, b.parent));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGVyX3N0YXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvcm91dGVyL3NyYy9yb3V0ZXJfc3RhdGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxFQUFDLGVBQWUsRUFBYSxNQUFNLE1BQU0sQ0FBQztBQUNqRCxPQUFPLEVBQUMsR0FBRyxFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFHbkMsT0FBTyxFQUFDLGlCQUFpQixFQUFvQixjQUFjLEVBQUMsTUFBTSxVQUFVLENBQUM7QUFDN0UsT0FBTyxFQUFDLGFBQWEsRUFBRSxVQUFVLEVBQTJCLE1BQU0sWUFBWSxDQUFDO0FBQy9FLE9BQU8sRUFBQyxZQUFZLEVBQUUsa0JBQWtCLEVBQUMsTUFBTSxvQkFBb0IsQ0FBQztBQUNwRSxPQUFPLEVBQUMsSUFBSSxFQUFFLFFBQVEsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUk1Qzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBOEJHO0FBQ0gsTUFBTSxPQUFPLFdBQVksU0FBUSxJQUFvQjtJQUNuRCxnQkFBZ0I7SUFDaEIsWUFDSSxJQUE4QjtJQUM5QiwrQ0FBK0M7SUFDeEMsUUFBNkI7UUFDdEMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBREgsYUFBUSxHQUFSLFFBQVEsQ0FBcUI7UUFFdEMsY0FBYyxDQUFjLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztJQUMxQyxDQUFDO0lBRVEsUUFBUTtRQUNmLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUNsQyxDQUFDO0NBQ0Y7QUFFRCxNQUFNLFVBQVUsZ0JBQWdCLENBQUMsT0FBZ0IsRUFBRSxhQUE2QjtJQUM5RSxNQUFNLFFBQVEsR0FBRyx3QkFBd0IsQ0FBQyxPQUFPLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFDbEUsTUFBTSxRQUFRLEdBQUcsSUFBSSxlQUFlLENBQUMs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QUFDLENBQUM7U0FDM0M7S0FDRjtTQUFNO1FBQ0wsS0FBSyxDQUFDLFFBQVEsR0FBRyxLQUFLLENBQUMsZUFBZSxDQUFDO1FBRXZDLDRCQUE0QjtRQUN0QixLQUFLLENBQUMsSUFBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ3BEO0FBQ0gsQ0FBQztBQUdELE1BQU0sVUFBVSx5QkFBeUIsQ0FDckMsQ0FBeUIsRUFBRSxDQUF5QjtJQUN0RCxNQUFNLGNBQWMsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksYUFBYSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3ZGLE1BQU0sZUFBZSxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7SUFFaEQsT0FBTyxjQUFjLElBQUksQ0FBQyxlQUFlO1FBQ3JDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUFJLHlCQUF5QixDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLE1BQU8sQ0FBQyxDQUFDLENBQUM7QUFDcEUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1R5cGV9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHtCZWhhdmlvclN1YmplY3QsIE9ic2VydmFibGV9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHttYXB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcblxuaW1wb3J0IHtEYXRhLCBSZXNvbHZlRGF0YSwgUm91dGV9IGZyb20gJy4vbW9kZWxzJztcbmltcG9ydCB7Y29udmVydFRvUGFyYW1NYXAsIFBhcmFtTWFwLCBQYXJhbXMsIFBSSU1BUllfT1VUTEVUfSBmcm9tICcuL3NoYXJlZCc7XG5pbXBvcnQge2VxdWFsU2VnbWVudHMsIFVybFNlZ21lbnQsIFVybFNlZ21lbnRHcm91cCwgVXJsVHJlZX0gZnJvbSAnLi91cmxfdHJlZSc7XG5pbXBvcnQge3NoYWxsb3dFcXVhbCwgc2hhbGxvd0VxdWFsQXJyYXlzfSBmcm9tICcuL3V0aWxzL2NvbGxlY3Rpb24nO1xuaW1wb3J0IHtUcmVlLCBUcmVlTm9kZX0gZnJvbSAnLi91dGlscy90cmVlJztcblxuXG5cbi8qKlxuICogUmVwcmVzZW50cyB0aGUgc3RhdGUgb2YgdGhlIHJvdXRlciBhcyBhIHRyZWUgb2YgYWN0aXZhdGVkIHJvdXRlcy5cbiAqXG4gKiBAdXNhZ2VOb3Rlc1xuICpcbiAqIEV2ZXJ5IG5vZGUgaW4gdGhlIHJvdXRlIHRyZWUgaXMgYW4gYEFjdGl2YXRlZFJvdXRlYCBpbnN0YW5jZVxuICogdGhhdCBrbm93cyBhYm91dCB0aGUgXCJjb25zdW1lZFwiIFVSTCBzZWdtZW50cywgdGhlIGV4dHJhY3RlZCBwYXJhbWV0ZXJzLFxuICogYW5kIHRoZSByZXNvbHZlZCBkYXRhLlxuICogVXNlIHRoZSBgQWN0aXZhdGVkUm91dGVgIHByb3BlcnRpZXMgdG8gdHJhdmVyc2UgdGhlIHRyZWUgZnJvbSBhbnkgbm9kZS5cbiAqXG4gKiBUaGUgZm9sbG93aW5nIGZyYWdtZW50IHNob3dzIGhvdyBhIGNvbXBvbmVudCBnZXRzIHRoZSByb290IG5vZGVcbiAqIG9mIHRoZSBjdXJyZW50IHN0YXRlIHRvIGVzdGFibGlzaCBpdHMgb3duIHJvdXRlIHRyZWU6XG4gKlxuICogYGBgXG4gKiBAQ29tcG9uZW50KHt0ZW1wbGF0ZVVybDondGVtcGxhdGUuaHRtbCd9KVxuICogY2xhc3MgTXlDb21wb25lbnQge1xuICogICBjb25zdHJ1Y3Rvcihyb3V0ZXI6IFJvdXRlcikge1xuICogICAgIGNvbnN0IHN0YXRlOiBSb3V0ZXJTdGF0ZSA9IHJvdXRlci5yb3V0ZXJTdGF0ZTtcbiAqICAgICBjb25zdCByb290OiBBY3RpdmF0ZWRSb3V0ZSA9IHN0YXRlLnJvb3Q7XG4gKiAgICAgY29uc3QgY2hpbGQgPSByb290LmZpcnN0Q2hpbGQ7XG4gKiAgICAgY29uc3QgaWQ6IE9ic2VydmFibGU8c3RyaW5nPiA9IGNoaWxkLnBhcmFtcy5tYXAocCA9PiBwLmlkKTtcbiAqICAgICAvLy4uLlxuICogICB9XG4gKiB9XG4gKiBgYGBcbiAqXG4gKiBAc2VlIGBBY3RpdmF0ZWRSb3V0ZWBcbiAqIEBzZWUgW0dldHRpbmcgcm91dGUgaW5mb3JtYXRpb25dKGd1aWRlL3JvdXRlciNnZXR0aW5nLXJvdXRlLWluZm9ybWF0aW9uKVxuICpcbiAqIEBwdWJsaWNBcGlcbiAqL1xuZXhwb3J0IGNsYXNzIFJvdXRlclN0YXRlIGV4dGVuZHMgVHJlZTxBY3RpdmF0ZWRSb3V0ZT4ge1xuICAvKiogQGludGVybmFsICovXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcm9vdDogVHJlZU5vZGU8QWN0aXZhdGVkUm91dGU+LFxuICAgICAgLyoqIFRoZSBjdXJyZW50IHNuYXBzaG90IG9mIHRoZSByb3V0ZXIgc3RhdGUgKi9cbiAgICAgIHB1YmxpYyBzbmFwc2hvdDogUm91dGVyU3RhdGVTbmFwc2hvdCkge1xuICAgIHN1cGVyKHJvb3QpO1xuICAgIHNldFJvdXRlclN0YXRlKDxSb3V0ZXJTdGF0ZT50aGlzLCByb290KTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRvU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuc25hcHNob3QudG9TdHJpbmcoKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRW1wdHlTdGF0ZSh1cmxUcmVlOiBVcmxUcmVlLCByb290Q29tcG9uZW50OiBUeXBlPGFueT58bnVsbCk6IFJvdXRlclN0YXRlIHtcbiAgY29uc3Qgc25hcHNob3QgPSBjcmVhdGVFbXB0eVN0YXRlU25hcHNob3QodXJsVHJlZSwgcm9vdENvbXBvbmVudCk7XG4gIGNvbnN0IGVtcHR5VXJsID0gbmV3IEJlaGF2aW9yU3ViamVjdChbbmV3IFVybFNlZ21lbnQoJycsIHt9KV0pO1xuICBjb25zdCBlbXB0eVBhcmFtcyA9IG5ldyBCZWhhdmlvclN1YmplY3Qoe30pO1xuICBjb25zdCBlbXB0eURhdGEgPSBuZXcgQmVoYXZpb3JTdWJqZWN0KHt9KTtcbiAgY29uc3QgZW1wdHlRdWVyeVBhcmFtcyA9IG5ldyBCZWhhdmlvclN1YmplY3Qoe30pO1xuICBjb25zdCBmcmFnbWVudCA9IG5ldyBCZWhhdmlvclN1YmplY3QoJycpO1xuICBjb25zdCBhY3RpdmF0ZWQgPSBuZXcgQWN0aXZhdGVkUm91dGUoXG4gICAgICBlbXB0eVVybCwgZW1wdHlQYXJhbXMsIGVtcHR5UXVlcnlQYXJhbXMsIGZyYWdtZW50LCBlbXB0eURhdGEsIFBSSU1BUllfT1VUTEVULCByb290Q29tcG9uZW50LFxuICAgICAgc25hcHNob3Qucm9vdCk7XG4gIGFjdGl2YXRlZC5zbmFwc2hvdCA9IHNuYXBzaG90LnJvb3Q7XG4gIHJldHVybiBuZXcgUm91dGVyU3RhdGUobmV3IFRyZWVOb2RlPEFjdGl2YXRlZFJvdXRlPihhY3RpdmF0ZWQsIFtdKSwgc25hcHNob3QpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRW1wdHlTdGF0ZVNuYXBzaG90KFxuICAgIHVybFRyZWU6IFVybFRyZWUsIHJvb3RDb21wb25lbnQ6IFR5cGU8YW55PnxudWxsKTogUm91dGVyU3RhdGVTbmFwc2hvdCB7XG4gIGNvbnN0IGVtcHR5UGFyYW1zID0ge307XG4gIGNvbnN0IGVtcHR5RGF0YSA9IHt9O1xuICBjb25zdCBlbXB0eVF1ZXJ5UGFyYW1zID0ge307XG4gIGNvbnN0IGZyYWdtZW50ID0gJyc7XG4gIGNvbnN0IGFjdGl2YXRlZCA9IG5ldyBBY3RpdmF0ZWRSb3V0ZVNuYXBzaG90KFxuICAgICAgW10sIGVtcHR5UGFyYW1zLCBlbXB0eVF1ZXJ5UGFyYW1zLCBmcmFnbWVudCwgZW1wdHlEYXRhLCBQUklNQVJZX09VVExFVCwgcm9vdENvbXBvbmVudCwgbnVsbCxcbiAgICAgIHVybFRyZWUucm9vdCwgLTEsIHt9KTtcbiAgcmV0dXJuIG5ldyBSb3V0ZXJTdGF0ZVNuYXBzaG90KCcnLCBuZXcgVHJlZU5vZGU8QWN0aXZhdGVkUm91dGVTbmFwc2hvdD4oYWN0aXZhdGVkLCBbXSkpO1xufVxuXG4vKipcbiAqIFByb3ZpZGVzIGFjY2VzcyB0byBpbmZvcm1hdGlvbiBhYm91dCBhIHJvdXRlIGFzc29jaWF0ZWQgd2l0aCBhIGNvbXBvbmVudFxuICogdGhhdCBpcyBsb2FkZWQgaW4gYW4gb3V0bGV0LlxuICogVXNlIHRvIHRyYXZlcnNlIHRoZSBgUm91dGVyU3RhdGVgIHRyZWUgYW5kIGV4dHJhY3QgaW5mb3JtYXRpb24gZnJvbSBub2Rlcy5cbiAqXG4gKiBUaGUgZm9sbG93aW5nIGV4YW1wbGUgc2hvd3MgaG93IHRvIGNvbnN0cnVjdCBhIGNvbXBvbmVudCB1c2luZyBpbmZvcm1hdGlvbiBmcm9tIGFcbiAqIGN1cnJlbnRseSBhY3RpdmF0ZWQgcm91dGUuXG4gKlxuICogTm90ZTogdGhlIG9ic2VydmFibGVzIGluIHRoaXMgY2xhc3Mgb25seSBlbWl0IHdoZW4gdGhlIGN1cnJlbnQgYW5kIHByZXZpb3VzIHZhbHVlcyBkaWZmZXIgYmFzZWRcbiAqIG9uIHNoYWxsb3cgZXF1YWxpdHkuIEZvciBleGFtcGxlLCBjaGFuZ2luZyBkZWVwbHkgbmVzdGVkIHByb3BlcnRpZXMgaW4gcmVzb2x2ZWQgYGRhdGFgIHdpbGwgbm90XG4gKiBjYXVzZSB0aGUgYEFjdGl2YXRlZFJvdXRlLmRhdGFgIGBPYnNlcnZhYmxlYCB0byBlbWl0IGEgbmV3IHZhbHVlLlxuICpcbiAqIHtAZXhhbXBsZSByb3V0ZXIvYWN0aXZhdGVkLXJvdXRlL21vZHVsZS50cyByZWdpb249XCJhY3RpdmF0ZWQtcm91dGVcIlxuICogICAgIGhlYWRlcj1cImFjdGl2YXRlZC1yb3V0ZS5jb21wb25lbnQudHNcIn1cbiAqXG4gKiBAc2VlIFtHZXR0aW5nIHJvdXRlIGluZm9ybWF0aW9uXShndWlkZS9yb3V0ZXIjZ2V0dGluZy1yb3V0ZS1pbmZvcm1hdGlvbilcbiAqXG4gKiBAcHVibGljQXBpXG4gKi9cbmV4cG9ydCBjbGFzcyBBY3RpdmF0ZWRSb3V0ZSB7XG4gIC8qKiBUaGUgY3VycmVudCBzbmFwc2hvdCBvZiB0aGlzIHJvdXRlICovXG4gIHNuYXBzaG90ITogQWN0aXZhdGVkUm91dGVTbmFwc2hvdDtcbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfZnV0dXJlU25hcHNob3Q6IEFjdGl2YXRlZFJvdXRlU25hcHNob3Q7XG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX3JvdXRlclN0YXRlITogUm91dGVyU3RhdGU7XG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX3BhcmFtTWFwITogT2JzZXJ2YWJsZTxQYXJhbU1hcD47XG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX3F1ZXJ5UGFyYW1NYXAhOiBPYnNlcnZhYmxlPFBhcmFtTWFwPjtcblxuICAvKiogQGludGVybmFsICovXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgLyoqIEFuIG9ic2VydmFibGUgb2YgdGhlIFVSTCBzZWdtZW50cyBtYXRjaGVkIGJ5IHRoaXMgcm91dGUuICovXG4gICAgICBwdWJsaWMgdXJsOiBPYnNlcnZhYmxlPFVybFNlZ21lbnRbXT4sXG4gICAgICAvKiogQW4gb2JzZXJ2YWJsZSBvZiB0aGUgbWF0cml4IHBhcmFtZXRlcnMgc2NvcGVkIHRvIHRoaXMgcm91dGUuICovXG4gICAgICBwdWJsaWMgcGFyYW1zOiBPYnNlcnZhYmxlPFBhcmFtcz4sXG4gICAgICAvKiogQW4gb2JzZXJ2YWJsZSBvZiB0aGUgcXVlcnkgcGFyYW1ldGVycyBzaGFyZWQgYnkgYWxsIHRoZSByb3V0ZXMuICovXG4gICAgICBwdWJsaWMgcXVlcnlQYXJhbXM6IE9ic2VydmFibGU8UGFyYW1zPixcbiAgICAgIC8qKiBBbiBvYnNlcnZhYmxlIG9mIHRoZSBVUkwgZnJhZ21lbnQgc2hhcmVkIGJ5IGFsbCB0aGUgcm91dGVzLiAqL1xuICAgICAgcHVibGljIGZyYWdtZW50OiBPYnNlcnZhYmxlPHN0cmluZ3xudWxsPixcbiAgICAgIC8qKiBBbiBvYnNlcnZhYmxlIG9mIHRoZSBzdGF0aWMgYW5kIHJlc29sdmVkIGRhdGEgb2YgdGhpcyByb3V0ZS4gKi9cbiAgICAgIHB1YmxpYyBkYXRhOiBPYnNlcnZhYmxlPERhdGE+LFxuICAgICAgLyoqIFRoZSBvdXRsZXQgbmFtZSBvZiB0aGUgcm91dGUsIGEgY29uc3RhbnQuICovXG4gICAgICBwdWJsaWMgb3V0bGV0OiBzdHJpbmcsXG4gICAgICAvKiogVGhlIGNvbXBvbmVudCBvZiB0aGUgcm91dGUsIGEgY29uc3RhbnQuICovXG4gICAgICBwdWJsaWMgY29tcG9uZW50OiBUeXBlPGFueT58bnVsbCwgZnV0dXJlU25hcHNob3Q6IEFjdGl2YXRlZFJvdXRlU25hcHNob3QpIHtcbiAgICB0aGlzLl9mdXR1cmVTbmFwc2hvdCA9IGZ1dHVyZVNuYXBzaG90O1xuICB9XG5cbiAgLyoqIFRoZSBjb25maWd1cmF0aW9uIHVzZWQgdG8gbWF0Y2ggdGhpcyByb3V0ZS4gKi9cbiAgZ2V0IHJvdXRlQ29uZmlnKCk6IFJvdXRlfG51bGwge1xuICAgIHJldHVybiB0aGlzLl9mdXR1cmVTbmFwc2hvdC5yb3V0ZUNvbmZpZztcbiAgfVxuXG4gIC8qKiBUaGUgcm9vdCBvZiB0aGUgcm91dGVyIHN0YXRlLiAqL1xuICBnZXQgcm9vdCgpOiBBY3RpdmF0ZWRSb3V0ZSB7XG4gICAgcmV0dXJuIHRoaXMuX3JvdXRlclN0YXRlLnJvb3Q7XG4gIH1cblxuICAvKiogVGhlIHBhcmVudCBvZiB0aGlzIHJvdXRlIGluIHRoZSByb3V0ZXIgc3RhdGUgdHJlZS4gKi9cbiAgZ2V0IHBhcmVudCgpOiBBY3RpdmF0ZWRSb3V0ZXxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5fcm91dGVyU3RhdGUucGFyZW50KHRoaXMpO1xuICB9XG5cbiAgLyoqIFRoZSBmaXJzdCBjaGlsZCBvZiB0aGlzIHJvdXRlIGluIHRoZSByb3V0ZXIgc3RhdGUgdHJlZS4gKi9cbiAgZ2V0IGZpcnN0Q2hpbGQoKTogQWN0aXZhdGVkUm91dGV8bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuX3JvdXRlclN0YXRlLmZpcnN0Q2hpbGQodGhpcyk7XG4gIH1cblxuICAvKiogVGhlIGNoaWxkcmVuIG9mIHRoaXMgcm91dGUgaW4gdGhlIHJvdXRlciBzdGF0ZSB0cmVlLiAqL1xuICBnZXQgY2hpbGRyZW4oKTogQWN0aXZhdGVkUm91dGVbXSB7XG4gICAgcmV0dXJuIHRoaXMuX3JvdXRlclN0YXRlLmNoaWxkcmVuKHRoaXMpO1xuICB9XG5cbiAgLyoqIFRoZSBwYXRoIGZyb20gdGhlIHJvb3Qgb2YgdGhlIHJvdXRlciBzdGF0ZSB0cmVlIHRvIHRoaXMgcm91dGUuICovXG4gIGdldCBwYXRoRnJvbVJvb3QoKTogQWN0aXZhdGVkUm91dGVbXSB7XG4gICAgcmV0dXJuIHRoaXMuX3JvdXRlclN0YXRlLnBhdGhGcm9tUm9vdCh0aGlzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBbiBPYnNlcnZhYmxlIHRoYXQgY29udGFpbnMgYSBtYXAgb2YgdGhlIHJlcXVpcmVkIGFuZCBvcHRpb25hbCBwYXJhbWV0ZXJzXG4gICAqIHNwZWNpZmljIHRvIHRoZSByb3V0ZS5cbiAgICogVGhlIG1hcCBzdXBwb3J0cyByZXRyaWV2aW5nIHNpbmdsZSBhbmQgbXVsdGlwbGUgdmFsdWVzIGZyb20gdGhlIHNhbWUgcGFyYW1ldGVyLlxuICAgKi9cbiAgZ2V0IHBhcmFtTWFwKCk6IE9ic2VydmFibGU8UGFyYW1NYXA+IHtcbiAgICBpZiAoIXRoaXMuX3BhcmFtTWFwKSB7XG4gICAgICB0aGlzLl9wYXJhbU1hcCA9IHRoaXMucGFyYW1zLnBpcGUobWFwKChwOiBQYXJhbXMpOiBQYXJhbU1hcCA9PiBjb252ZXJ0VG9QYXJhbU1hcChwKSkpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fcGFyYW1NYXA7XG4gIH1cblxuICAvKipcbiAgICogQW4gT2JzZXJ2YWJsZSB0aGF0IGNvbnRhaW5zIGEgbWFwIG9mIHRoZSBxdWVyeSBwYXJhbWV0ZXJzIGF2YWlsYWJsZSB0byBhbGwgcm91dGVzLlxuICAgKiBUaGUgbWFwIHN1cHBvcnRzIHJldHJpZXZpbmcgc2luZ2xlIGFuZCBtdWx0aXBsZSB2YWx1ZXMgZnJvbSB0aGUgcXVlcnkgcGFyYW1ldGVyLlxuICAgKi9cbiAgZ2V0IHF1ZXJ5UGFyYW1NYXAoKTogT2JzZXJ2YWJsZTxQYXJhbU1hcD4ge1xuICAgIGlmICghdGhpcy5fcXVlcnlQYXJhbU1hcCkge1xuICAgICAgdGhpcy5fcXVlcnlQYXJhbU1hcCA9XG4gICAgICAgICAgdGhpcy5xdWVyeVBhcmFtcy5waXBlKG1hcCgocDogUGFyYW1zKTogUGFyYW1NYXAgPT4gY29udmVydFRvUGFyYW1NYXAocCkpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3F1ZXJ5UGFyYW1NYXA7XG4gIH1cblxuICB0b1N0cmluZygpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLnNuYXBzaG90ID8gdGhpcy5zbmFwc2hvdC50b1N0cmluZygpIDogYEZ1dHVyZSgke3RoaXMuX2Z1dHVyZVNuYXBzaG90fSlgO1xuICB9XG59XG5cbmV4cG9ydCB0eXBlIFBhcmFtc0luaGVyaXRhbmNlU3RyYXRlZ3kgPSAnZW1wdHlPbmx5J3wnYWx3YXlzJztcblxuLyoqIEBpbnRlcm5hbCAqL1xuZXhwb3J0IHR5cGUgSW5oZXJpdGVkID0ge1xuICBwYXJhbXM6IFBhcmFtcyxcbiAgZGF0YTogRGF0YSxcbiAgcmVzb2x2ZTogRGF0YSxcbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUgaW5oZXJpdGVkIHBhcmFtcywgZGF0YSwgYW5kIHJlc29sdmUgZm9yIGEgZ2l2ZW4gcm91dGUuXG4gKiBCeSBkZWZhdWx0LCB0aGlzIG9ubHkgaW5oZXJpdHMgdmFsdWVzIHVwIHRvIHRoZSBuZWFyZXN0IHBhdGgtbGVzcyBvciBjb21wb25lbnQtbGVzcyByb3V0ZS5cbiAqIEBpbnRlcm5hbFxuICovXG5leHBvcnQgZnVuY3Rpb24gaW5oZXJpdGVkUGFyYW1zRGF0YVJlc29sdmUoXG4gICAgcm91dGU6IEFjdGl2YXRlZFJvdXRlU25hcHNob3QsXG4gICAgcGFyYW1zSW5oZXJpdGFuY2VTdHJhdGVneTogUGFyYW1zSW5oZXJpdGFuY2VTdHJhdGVneSA9ICdlbXB0eU9ubHknKTogSW5oZXJpdGVkIHtcbiAgY29uc3QgcGF0aEZyb21Sb290ID0gcm91dGUucGF0aEZyb21Sb290O1xuXG4gIGxldCBpbmhlcml0aW5nU3RhcnRpbmdGcm9tID0gMDtcbiAgaWYgKHBhcmFtc0luaGVyaXRhbmNlU3RyYXRlZ3kgIT09ICdhbHdheXMnKSB7XG4gICAgaW5oZXJpdGluZ1N0YXJ0aW5nRnJvbSA9IHBhdGhGcm9tUm9vdC5sZW5ndGggLSAxO1xuXG4gICAgd2hpbGUgKGluaGVyaXRpbmdTdGFydGluZ0Zyb20gPj0gMSkge1xuICAgICAgY29uc3QgY3VycmVudCA9IHBhdGhGcm9tUm9vdFtpbmhlcml0aW5nU3RhcnRpbmdGcm9tXTtcbiAgICAgIGNvbnN0IHBhcmVudCA9IHBhdGhGcm9tUm9vdFtpbmhlcml0aW5nU3RhcnRpbmdGcm9tIC0gMV07XG4gICAgICAvLyBjdXJyZW50IHJvdXRlIGlzIGFuIGVtcHR5IHBhdGggPT4gaW5oZXJpdHMgaXRzIHBhcmVudCdzIHBhcmFtcyBhbmQgZGF0YVxuICAgICAgaWYgKGN1cnJlbnQucm91dGVDb25maWcgJiYgY3VycmVudC5yb3V0ZUNvbmZpZy5wYXRoID09PSAnJykge1xuICAgICAgICBpbmhlcml0aW5nU3RhcnRpbmdGcm9tLS07XG5cbiAgICAgICAgLy8gcGFyZW50IGlzIGNvbXBvbmVudGxlc3MgPT4gY3VycmVudCByb3V0ZSBzaG91bGQgaW5oZXJpdCBpdHMgcGFyYW1zIGFuZCBkYXRhXG4gICAgICB9IGVsc2UgaWYgKCFwYXJlbnQuY29tcG9uZW50KSB7XG4gICAgICAgIGluaGVyaXRpbmdTdGFydGluZ0Zyb20tLTtcblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGZsYXR0ZW5Jbmhlcml0ZWQocGF0aEZyb21Sb290LnNsaWNlKGluaGVyaXRpbmdTdGFydGluZ0Zyb20pKTtcbn1cblxuLyoqIEBpbnRlcm5hbCAqL1xuZnVuY3Rpb24gZmxhdHRlbkluaGVyaXRlZChwYXRoRnJvbVJvb3Q6IEFjdGl2YXRlZFJvdXRlU25hcHNob3RbXSk6IEluaGVyaXRlZCB7XG4gIHJldHVybiBwYXRoRnJvbVJvb3QucmVkdWNlKChyZXMsIGN1cnIpID0+IHtcbiAgICBjb25zdCBwYXJhbXMgPSB7Li4ucmVzLnBhcmFtcywgLi4uY3Vyci5wYXJhbXN9O1xuICAgIGNvbnN0IGRhdGEgPSB7Li4ucmVzLmRhdGEsIC4uLmN1cnIuZGF0YX07XG4gICAgY29uc3QgcmVzb2x2ZSA9XG4gICAgICAgIHsuLi5jdXJyLmRhdGEsIC4uLnJlcy5yZXNvbHZlLCAuLi5jdXJyLnJvdXRlQ29uZmlnPy5kYXRhLCAuLi5jdXJyLl9yZXNvbHZlZERhdGF9O1xuICAgIHJldHVybiB7cGFyYW1zLCBkYXRhLCByZXNvbHZlfTtcbiAgfSwge3BhcmFtczoge30sIGRhdGE6IHt9LCByZXNvbHZlOiB7fX0pO1xufVxuXG4vKipcbiAqIEBkZXNjcmlwdGlvblxuICpcbiAqIENvbnRhaW5zIHRoZSBpbmZvcm1hdGlvbiBhYm91dCBhIHJvdXRlIGFzc29jaWF0ZWQgd2l0aCBhIGNvbXBvbmVudCBsb2FkZWQgaW4gYW5cbiAqIG91dGxldCBhdCBhIHBhcnRpY3VsYXIgbW9tZW50IGluIHRpbWUuIEFjdGl2YXRlZFJvdXRlU25hcHNob3QgY2FuIGFsc28gYmUgdXNlZCB0b1xuICogdHJhdmVyc2UgdGhlIHJvdXRlciBzdGF0ZSB0cmVlLlxuICpcbiAqIFRoZSBmb2xsb3dpbmcgZXhhbXBsZSBpbml0aWFsaXplcyBhIGNvbXBvbmVudCB3aXRoIHJvdXRlIGluZm9ybWF0aW9uIGV4dHJhY3RlZFxuICogZnJvbSB0aGUgc25hcHNob3Qgb2YgdGhlIHJvb3Qgbm9kZSBhdCB0aGUgdGltZSBvZiBjcmVhdGlvbi5cbiAqXG4gKiBgYGBcbiAqIEBDb21wb25lbnQoe3RlbXBsYXRlVXJsOicuL215LWNvbXBvbmVudC5odG1sJ30pXG4gKiBjbGFzcyBNeUNvbXBvbmVudCB7XG4gKiAgIGNvbnN0cnVjdG9yKHJvdXRlOiBBY3RpdmF0ZWRSb3V0ZSkge1xuICogICAgIGNvbnN0IGlkOiBzdHJpbmcgPSByb3V0ZS5zbmFwc2hvdC5wYXJhbXMuaWQ7XG4gKiAgICAgY29uc3QgdXJsOiBzdHJpbmcgPSByb3V0ZS5zbmFwc2hvdC51cmwuam9pbignJyk7XG4gKiAgICAgY29uc3QgdXNlciA9IHJvdXRlLnNuYXBzaG90LmRhdGEudXNlcjtcbiAqICAgfVxuICogfVxuICogYGBgXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgY2xhc3MgQWN0aXZhdGVkUm91dGVTbmFwc2hvdCB7XG4gIC8qKiBUaGUgY29uZmlndXJhdGlvbiB1c2VkIHRvIG1hdGNoIHRoaXMgcm91dGUgKiovXG4gIHB1YmxpYyByZWFkb25seSByb3V0ZUNvbmZpZzogUm91dGV8bnVsbDtcbiAgLyoqIEBpbnRlcm5hbCAqKi9cbiAgX3VybFNlZ21lbnQ6IFVybFNlZ21lbnRHcm91cDtcbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfbGFzdFBhdGhJbmRleDogbnVtYmVyO1xuICAvKipcbiAgICogQGludGVybmFsXG4gICAqXG4gICAqIFVzZWQgb25seSBpbiBkZXYgbW9kZSB0byBkZXRlY3QgaWYgYXBwbGljYXRpb24gcmVsaWVzIG9uIGByZWxhdGl2ZUxpbmtSZXNvbHV0aW9uOiAnbGVnYWN5J2BcbiAgICogU2hvdWxkIGJlIHJlbW92ZWQgaW4gdjE2LlxuICAgKi9cbiAgX2NvcnJlY3RlZExhc3RQYXRoSW5kZXg6IG51bWJlcjtcbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfcmVzb2x2ZTogUmVzb2x2ZURhdGE7XG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgLy8gVE9ETyhpc3N1ZS8yNDU3MSk6IHJlbW92ZSAnIScuXG4gIF9yZXNvbHZlZERhdGEhOiBEYXRhO1xuICAvKiogQGludGVybmFsICovXG4gIC8vIFRPRE8oaXNzdWUvMjQ1NzEpOiByZW1vdmUgJyEnLlxuICBfcm91dGVyU3RhdGUhOiBSb3V0ZXJTdGF0ZVNuYXBzaG90O1xuICAvKiogQGludGVybmFsICovXG4gIC8vIFRPRE8oaXNzdWUvMjQ1NzEpOiByZW1vdmUgJyEnLlxuICBfcGFyYW1NYXAhOiBQYXJhbU1hcDtcbiAgLyoqIEBpbnRlcm5hbCAqL1xuICAvLyBUT0RPKGlzc3VlLzI0NTcxKTogcmVtb3ZlICchJy5cbiAgX3F1ZXJ5UGFyYW1NYXAhOiBQYXJhbU1hcDtcblxuICAvKiogQGludGVybmFsICovXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgLyoqIFRoZSBVUkwgc2VnbWVudHMgbWF0Y2hlZCBieSB0aGlzIHJvdXRlICovXG4gICAgICBwdWJsaWMgdXJsOiBVcmxTZWdtZW50W10sXG4gICAgICAvKipcbiAgICAgICAqICBUaGUgbWF0cml4IHBhcmFtZXRlcnMgc2NvcGVkIHRvIHRoaXMgcm91dGUuXG4gICAgICAgKlxuICAgICAgICogIFlvdSBjYW4gY29tcHV0ZSBhbGwgcGFyYW1zIChvciBkYXRhKSBpbiB0aGUgcm91dGVyIHN0YXRlIG9yIHRvIGdldCBwYXJhbXMgb3V0c2lkZVxuICAgICAgICogIG9mIGFuIGFjdGl2YXRlZCBjb21wb25lbnQgYnkgdHJhdmVyc2luZyB0aGUgYFJvdXRlclN0YXRlYCB0cmVlIGFzIGluIHRoZSBmb2xsb3dpbmdcbiAgICAgICAqICBleGFtcGxlOlxuICAgICAgICogIGBgYFxuICAgICAgICogIGNvbGxlY3RSb3V0ZVBhcmFtcyhyb3V0ZXI6IFJvdXRlcikge1xuICAgICAgICogICAgbGV0IHBhcmFtcyA9IHt9O1xuICAgICAgICogICAgbGV0IHN0YWNrOiBBY3RpdmF0ZWRSb3V0ZVNuYXBzaG90W10gPSBbcm91dGVyLnJvdXRlclN0YXRlLnNuYXBzaG90LnJvb3RdO1xuICAgICAgICogICAgd2hpbGUgKHN0YWNrLmxlbmd0aCA+IDApIHtcbiAgICAgICAqICAgICAgY29uc3Qgcm91dGUgPSBzdGFjay5wb3AoKSE7XG4gICAgICAgKiAgICAgIHBhcmFtcyA9IHsuLi5wYXJhbXMsIC4uLnJvdXRlLnBhcmFtc307XG4gICAgICAgKiAgICAgIHN0YWNrLnB1c2goLi4ucm91dGUuY2hpbGRyZW4pO1xuICAgICAgICogICAgfVxuICAgICAgICogICAgcmV0dXJuIHBhcmFtcztcbiAgICAgICAqICB9XG4gICAgICAgKiAgYGBgXG4gICAgICAgKi9cbiAgICAgIHB1YmxpYyBwYXJhbXM6IFBhcmFtcyxcbiAgICAgIC8qKiBUaGUgcXVlcnkgcGFyYW1ldGVycyBzaGFyZWQgYnkgYWxsIHRoZSByb3V0ZXMgKi9cbiAgICAgIHB1YmxpYyBxdWVyeVBhcmFtczogUGFyYW1zLFxuICAgICAgLyoqIFRoZSBVUkwgZnJhZ21lbnQgc2hhcmVkIGJ5IGFsbCB0aGUgcm91dGVzICovXG4gICAgICBwdWJsaWMgZnJhZ21lbnQ6IHN0cmluZ3xudWxsLFxuICAgICAgLyoqIFRoZSBzdGF0aWMgYW5kIHJlc29sdmVkIGRhdGEgb2YgdGhpcyByb3V0ZSAqL1xuICAgICAgcHVibGljIGRhdGE6IERhdGEsXG4gICAgICAvKiogVGhlIG91dGxldCBuYW1lIG9mIHRoZSByb3V0ZSAqL1xuICAgICAgcHVibGljIG91dGxldDogc3RyaW5nLFxuICAgICAgLyoqIFRoZSBjb21wb25lbnQgb2YgdGhlIHJvdXRlICovXG4gICAgICBwdWJsaWMgY29tcG9uZW50OiBUeXBlPGFueT58bnVsbCwgcm91dGVDb25maWc6IFJvdXRlfG51bGwsIHVybFNlZ21lbnQ6IFVybFNlZ21lbnRHcm91cCxcbiAgICAgIGxhc3RQYXRoSW5kZXg6IG51bWJlciwgcmVzb2x2ZTogUmVzb2x2ZURhdGEsIGNvcnJlY3RlZExhc3RQYXRoSW5kZXg/OiBudW1iZXIpIHtcbiAgICB0aGlzLnJvdXRlQ29uZmlnID0gcm91dGVDb25maWc7XG4gICAgdGhpcy5fdXJsU2VnbWVudCA9IHVybFNlZ21lbnQ7XG4gICAgdGhpcy5fbGFzdFBhdGhJbmRleCA9IGxhc3RQYXRoSW5kZXg7XG4gICAgdGhpcy5fY29ycmVjdGVkTGFzdFBhdGhJbmRleCA9IGNvcnJlY3RlZExhc3RQYXRoSW5kZXggPz8gbGFzdFBhdGhJbmRleDtcbiAgICB0aGlzLl9yZXNvbHZlID0gcmVzb2x2ZTtcbiAgfVxuXG4gIC8qKiBUaGUgcm9vdCBvZiB0aGUgcm91dGVyIHN0YXRlICovXG4gIGdldCByb290KCk6IEFjdGl2YXRlZFJvdXRlU25hcHNob3Qge1xuICAgIHJldHVybiB0aGlzLl9yb3V0ZXJTdGF0ZS5yb290O1xuICB9XG5cbiAgLyoqIFRoZSBwYXJlbnQgb2YgdGhpcyByb3V0ZSBpbiB0aGUgcm91dGVyIHN0YXRlIHRyZWUgKi9cbiAgZ2V0IHBhcmVudCgpOiBBY3RpdmF0ZWRSb3V0ZVNuYXBzaG90fG51bGwge1xuICAgIHJldHVybiB0aGlzLl9yb3V0ZXJTdGF0ZS5wYXJlbnQodGhpcyk7XG4gIH1cblxuICAvKiogVGhlIGZpcnN0IGNoaWxkIG9mIHRoaXMgcm91dGUgaW4gdGhlIHJvdXRlciBzdGF0ZSB0cmVlICovXG4gIGdldCBmaXJzdENoaWxkKCk6IEFjdGl2YXRlZFJvdXRlU25hcHNob3R8bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuX3JvdXRlclN0YXRlLmZpcnN0Q2hpbGQodGhpcyk7XG4gIH1cblxuICAvKiogVGhlIGNoaWxkcmVuIG9mIHRoaXMgcm91dGUgaW4gdGhlIHJvdXRlciBzdGF0ZSB0cmVlICovXG4gIGdldCBjaGlsZHJlbigpOiBBY3RpdmF0ZWRSb3V0ZVNuYXBzaG90W10ge1xuICAgIHJldHVybiB0aGlzLl9yb3V0ZXJTdGF0ZS5jaGlsZHJlbih0aGlzKTtcbiAgfVxuXG4gIC8qKiBUaGUgcGF0aCBmcm9tIHRoZSByb290IG9mIHRoZSByb3V0ZXIgc3RhdGUgdHJlZSB0byB0aGlzIHJvdXRlICovXG4gIGdldCBwYXRoRnJvbVJvb3QoKTogQWN0aXZhdGVkUm91dGVTbmFwc2hvdFtdIHtcbiAgICByZXR1cm4gdGhpcy5fcm91dGVyU3RhdGUucGF0aEZyb21Sb290KHRoaXMpO1xuICB9XG5cbiAgZ2V0IHBhcmFtTWFwKCk6IFBhcmFtTWFwIHtcbiAgICBpZiAoIXRoaXMuX3BhcmFtTWFwKSB7XG4gICAgICB0aGlzLl9wYXJhbU1hcCA9IGNvbnZlcnRUb1BhcmFtTWFwKHRoaXMucGFyYW1zKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3BhcmFtTWFwO1xuICB9XG5cbiAgZ2V0IHF1ZXJ5UGFyYW1NYXAoKTogUGFyYW1NYXAge1xuICAgIGlmICghdGhpcy5fcXVlcnlQYXJhbU1hcCkge1xuICAgICAgdGhpcy5fcXVlcnlQYXJhbU1hcCA9IGNvbnZlcnRUb1BhcmFtTWFwKHRoaXMucXVlcnlQYXJhbXMpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fcXVlcnlQYXJhbU1hcDtcbiAgfVxuXG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgY29uc3QgdXJsID0gdGhpcy51cmwubWFwKHNlZ21lbnQgPT4gc2VnbWVudC50b1N0cmluZygpKS5qb2luKCcvJyk7XG4gICAgY29uc3QgbWF0Y2hlZCA9IHRoaXMucm91dGVDb25maWcgPyB0aGlzLnJvdXRlQ29uZmlnLnBhdGggOiAnJztcbiAgICByZXR1cm4gYFJvdXRlKHVybDonJHt1cmx9JywgcGF0aDonJHttYXRjaGVkfScpYDtcbiAgfVxufVxuXG4vKipcbiAqIEBkZXNjcmlwdGlvblxuICpcbiAqIFJlcHJlc2VudHMgdGhlIHN0YXRlIG9mIHRoZSByb3V0ZXIgYXQgYSBtb21lbnQgaW4gdGltZS5cbiAqXG4gKiBUaGlzIGlzIGEgdHJlZSBvZiBhY3RpdmF0ZWQgcm91dGUgc25hcHNob3RzLiBFdmVyeSBub2RlIGluIHRoaXMgdHJlZSBrbm93cyBhYm91dFxuICogdGhlIFwiY29uc3VtZWRcIiBVUkwgc2VnbWVudHMsIHRoZSBleHRyYWN0ZWQgcGFyYW1ldGVycywgYW5kIHRoZSByZXNvbHZlZCBkYXRhLlxuICpcbiAqIFRoZSBmb2xsb3dpbmcgZXhhbXBsZSBzaG93cyBob3cgYSBjb21wb25lbnQgaXMgaW5pdGlhbGl6ZWQgd2l0aCBpbmZvcm1hdGlvblxuICogZnJvbSB0aGUgc25hcHNob3Qgb2YgdGhlIHJvb3Qgbm9kZSdzIHN0YXRlIGF0IHRoZSB0aW1lIG9mIGNyZWF0aW9uLlxuICpcbiAqIGBgYFxuICogQENvbXBvbmVudCh7dGVtcGxhdGVVcmw6J3RlbXBsYXRlLmh0bWwnfSlcbiAqIGNsYXNzIE15Q29tcG9uZW50IHtcbiAqICAgY29uc3RydWN0b3Iocm91dGVyOiBSb3V0ZXIpIHtcbiAqICAgICBjb25zdCBzdGF0ZTogUm91dGVyU3RhdGUgPSByb3V0ZXIucm91dGVyU3RhdGU7XG4gKiAgICAgY29uc3Qgc25hcHNob3Q6IFJvdXRlclN0YXRlU25hcHNob3QgPSBzdGF0ZS5zbmFwc2hvdDtcbiAqICAgICBjb25zdCByb290OiBBY3RpdmF0ZWRSb3V0ZVNuYXBzaG90ID0gc25hcHNob3Qucm9vdDtcbiAqICAgICBjb25zdCBjaGlsZCA9IHJvb3QuZmlyc3RDaGlsZDtcbiAqICAgICBjb25zdCBpZDogT2JzZXJ2YWJsZTxzdHJpbmc+ID0gY2hpbGQucGFyYW1zLm1hcChwID0+IHAuaWQpO1xuICogICAgIC8vLi4uXG4gKiAgIH1cbiAqIH1cbiAqIGBgYFxuICpcbiAqIEBwdWJsaWNBcGlcbiAqL1xuZXhwb3J0IGNsYXNzIFJvdXRlclN0YXRlU25hcHNob3QgZXh0ZW5kcyBUcmVlPEFjdGl2YXRlZFJvdXRlU25hcHNob3Q+IHtcbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIC8qKiBUaGUgdXJsIGZyb20gd2hpY2ggdGhpcyBzbmFwc2hvdCB3YXMgY3JlYXRlZCAqL1xuICAgICAgcHVibGljIHVybDogc3RyaW5nLCByb290OiBUcmVlTm9kZTxBY3RpdmF0ZWRSb3V0ZVNuYXBzaG90Pikge1xuICAgIHN1cGVyKHJvb3QpO1xuICAgIHNldFJvdXRlclN0YXRlKDxSb3V0ZXJTdGF0ZVNuYXBzaG90PnRoaXMsIHJvb3QpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdG9TdHJpbmcoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gc2VyaWFsaXplTm9kZSh0aGlzLl9yb290KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzZXRSb3V0ZXJTdGF0ZTxVLCBUIGV4dGVuZHMge19yb3V0ZXJTdGF0ZTogVX0+KHN0YXRlOiBVLCBub2RlOiBUcmVlTm9kZTxUPik6IHZvaWQge1xuICBub2RlLnZhbHVlLl9yb3V0ZXJTdGF0ZSA9IHN0YXRlO1xuICBub2RlLmNoaWxkcmVuLmZvckVhY2goYyA9PiBzZXRSb3V0ZXJTdGF0ZShzdGF0ZSwgYykpO1xufVxuXG5mdW5jdGlvbiBzZXJpYWxpemVOb2RlKG5vZGU6IFRyZWVOb2RlPEFjdGl2YXRlZFJvdXRlU25hcHNob3Q+KTogc3RyaW5nIHtcbiAgY29uc3QgYyA9IG5vZGUuY2hpbGRyZW4ubGVuZ3RoID4gMCA/IGAgeyAke25vZGUuY2hpbGRyZW4ubWFwKHNlcmlhbGl6ZU5vZGUpLmpvaW4oJywgJyl9IH0gYCA6ICcnO1xuICByZXR1cm4gYCR7bm9kZS52YWx1ZX0ke2N9YDtcbn1cblxuLyoqXG4gKiBUaGUgZXhwZWN0YXRpb24gaXMgdGhhdCB0aGUgYWN0aXZhdGUgcm91dGUgaXMgY3JlYXRlZCB3aXRoIHRoZSByaWdodCBzZXQgb2YgcGFyYW1ldGVycy5cbiAqIFNvIHdlIHB1c2ggbmV3IHZhbHVlcyBpbnRvIHRoZSBvYnNlcnZhYmxlcyBvbmx5IHdoZW4gdGhleSBhcmUgbm90IHRoZSBpbml0aWFsIHZhbHVlcy5cbiAqIEFuZCB3ZSBkZXRlY3QgdGhhdCBieSBjaGVja2luZyBpZiB0aGUgc25hcHNob3QgZmllbGQgaXMgc2V0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYWR2YW5jZUFjdGl2YXRlZFJvdXRlKHJvdXRlOiBBY3RpdmF0ZWRSb3V0ZSk6IHZvaWQge1xuICBpZiAocm91dGUuc25hcHNob3QpIHtcbiAgICBjb25zdCBjdXJyZW50U25hcHNob3QgPSByb3V0ZS5zbmFwc2hvdDtcbiAgICBjb25zdCBuZXh0U25hcHNob3QgPSByb3V0ZS5fZnV0dXJlU25hcHNob3Q7XG4gICAgcm91dGUuc25hcHNob3QgPSBuZXh0U25hcHNob3Q7XG4gICAgaWYgKCFzaGFsbG93RXF1YWwoY3VycmVudFNuYXBzaG90LnF1ZXJ5UGFyYW1zLCBuZXh0U25hcHNob3QucXVlcnlQYXJhbXMpKSB7XG4gICAgICAoPGFueT5yb3V0ZS5xdWVyeVBhcmFtcykubmV4dChuZXh0U25hcHNob3QucXVlcnlQYXJhbXMpO1xuICAgIH1cbiAgICBpZiAoY3VycmVudFNuYXBzaG90LmZyYWdtZW50ICE9PSBuZXh0U25hcHNob3QuZnJhZ21lbnQpIHtcbiAgICAgICg8YW55PnJvdXRlLmZyYWdtZW50KS5uZXh0KG5leHRTbmFwc2hvdC5mcmFnbWVudCk7XG4gICAgfVxuICAgIGlmICghc2hhbGxvd0VxdWFsKGN1cnJlbnRTbmFwc2hvdC5wYXJhbXMsIG5leHRTbmFwc2hvdC5wYXJhbXMpKSB7XG4gICAgICAoPGFueT5yb3V0ZS5wYXJhbXMpLm5leHQobmV4dFNuYXBzaG90LnBhcmFtcyk7XG4gICAgfVxuICAgIGlmICghc2hhbGxvd0VxdWFsQXJyYXlzKGN1cnJlbnRTbmFwc2hvdC51cmwsIG5leHRTbmFwc2hvdC51cmwpKSB7XG4gICAgICAoPGFueT5yb3V0ZS51cmwpLm5leHQobmV4dFNuYXBzaG90LnVybCk7XG4gICAgfVxuICAgIGlmICghc2hhbGxvd0VxdWFsKGN1cnJlbnRTbmFwc2hvdC5kYXRhLCBuZXh0U25hcHNob3QuZGF0YSkpIHtcbiAgICAgICg8YW55PnJvdXRlLmRhdGEpLm5leHQobmV4dFNuYXBzaG90LmRhdGEpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICByb3V0ZS5zbmFwc2hvdCA9IHJvdXRlLl9mdXR1cmVTbmFwc2hvdDtcblxuICAgIC8vIHRoaXMgaXMgZm9yIHJlc29sdmVkIGRhdGFcbiAgICAoPGFueT5yb3V0ZS5kYXRhKS5uZXh0KHJvdXRlLl9mdXR1cmVTbmFwc2hvdC5kYXRhKTtcbiAgfVxufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBlcXVhbFBhcmFtc0FuZFVybFNlZ21lbnRzKFxuICAgIGE6IEFjdGl2YXRlZFJvdXRlU25hcHNob3QsIGI6IEFjdGl2YXRlZFJvdXRlU25hcHNob3QpOiBib29sZWFuIHtcbiAgY29uc3QgZXF1YWxVcmxQYXJhbXMgPSBzaGFsbG93RXF1YWwoYS5wYXJhbXMsIGIucGFyYW1zKSAmJiBlcXVhbFNlZ21lbnRzKGEudXJsLCBiLnVybCk7XG4gIGNvbnN0IHBhcmVudHNNaXNtYXRjaCA9ICFhLnBhcmVudCAhPT0gIWIucGFyZW50O1xuXG4gIHJldHVybiBlcXVhbFVybFBhcmFtcyAmJiAhcGFyZW50c01pc21hdGNoICYmXG4gICAgICAoIWEucGFyZW50IHx8IGVxdWFsUGFyYW1zQW5kVXJsU2VnbWVudHMoYS5wYXJlbnQsIGIucGFyZW50ISkpO1xufVxuIl19
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ɵRuntimeError as RuntimeError } from '@angular/core';
import { EmptyError, from, Observable, of } from 'rxjs';
import { catchError, concatMap, defaultIfEmpty, first, last as rxjsLast, map, scan, switchMap, takeWhile } from 'rxjs/operators';
import { ActivatedRouteSnapshot, inheritedParamsDataResolve, RouterStateSnapshot } from './router_state';
import { PRIMARY_OUTLET } from './shared';
import { last } from './utils/collection';
import { getOutlet, sortByMatchingOutlets } from './utils/config';
import { isImmediateMatch, matchWithChecks, noLeftoversInUrl, split } from './utils/config_matching';
import { TreeNode } from './utils/tree';
const NG_DEV_MODE = typeof ngDevMode === 'undefined' || !!ngDevMode;
class NoMatch {
}
function newObservableError(e) {
    // TODO(atscott): This pattern is used throughout the router code and can be `throwError` instead.
    return new Observable((obs) => obs.error(e));
}
export function recognize(injector, rootComponentType, config, urlTree, url, urlSerializer, paramsInheritanceStrategy = 'emptyOnly', relativeLinkResolution = 'legacy') {
    return new Recognizer(injector, rootComponentType, config, urlTree, url, paramsInheritanceStrategy, relativeLinkResolution, urlSerializer)
        .recognize()
        .pipe(switchMap(result => {
        if (result === null) {
            return newObservableError(new NoMatch());
        }
        else {
            return of(result);
        }
    }));
}
export class Recognizer {
    constructor(injector, rootComponentType, config, urlTree, url, paramsInheritanceStrategy, relativeLinkResolution, urlSerializer) {
        this.injector = injector;
        this.rootComponentType = rootComponentType;
        this.config = config;
        this.urlTree = urlTree;
        this.url = url;
        this.paramsInheritanceStrategy = paramsInheritanceStrategy;
        this.relativeLinkResolution = relativeLinkResolution;
        this.urlSerializer = urlSerializer;
    }
    recognize() {
        const rootSegmentGroup = split(this.urlTree.root, [], [], this.config.filter(c => c.redirectTo === undefined), this.relativeLinkResolution)
            .segmentGroup;
        return this.processSegmentGroup(this.injector, this.config, rootSegmentGroup, PRIMARY_OUTLET)
            .pipe(map(children => {
            if (children === null) {
                return null;
            }
            // Use Object.freeze to prevent readers of the Router state from modifying it outside of a
            // navigation, resulting in the router being out of sync with the browser.
            const root = new ActivatedRouteSnapshot([], Object.freeze({}), Object.freeze({ ...this.urlTree.queryParams }), this.urlTree.fragment, {}, PRIMARY_OUTLET, this.rootComponentType, null, this.urlTree.root, -1, {});
            const rootNode = new TreeNode(root, children);
            const routeState = new RouterStateSnapshot(this.url, rootNode);
            this.inheritParamsAndData(routeState._root);
            return routeState;
        }));
    }
    inheritParamsAndData(routeNode) {
        const route = routeNode.value;
        const i = inheritedParamsDataResolve(route, this.paramsInheritanceStrategy);
        route.params = Object.freeze(i.params);
        route.data = Object.freeze(i.data);
        routeNode.children.forEach(n => this.inheritParamsAndData(n));
    }
    processSegmentGroup(injector, config, segmentGroup, outlet) {
        if (segmentGroup.segments.length === 0 && segmentGroup.hasChildren()) {
            return this.processChildren(injector, config, segmentGroup);
        }
        return this.processSegment(injector, config, segmentGroup, segmentGroup.segments, outlet);
    }
    /**
     * Matches every child outlet in the `segmentGroup` to a `Route` in the config. Returns `null` if
     * we cannot find a match for _any_ of the children.
     *
     * @param config - The `Routes` to match against
     * @param segmentGroup - The `UrlSegmentGroup` whose children need to be matched against the
     *     config.
     */
    processChildren(injector, config, segmentGroup) {
        return from(Object.keys(segmentGroup.children))
            .pipe(concatMap(childOutlet => {
            const child = segmentGroup.children[childOutlet];
            // Sort the config so that routes with outlets that match the one being activated
            // appear first, followed by routes for other outlets, which might match if they have
            // an empty path.
            const sortedConfig = sortByMatchingOutlets(config, childOutlet);
            return this.processSegmentGroup(injector, sortedConfig, child, childOutlet);
        }), scan((children, outletChildren) => {
            if (!children || !outletChildren)
                return null;
            children.push(...outletChildren);
            return children;
        }), takeWhile(children => children !== null), defaultIfEmpty(null), rxjsLast(), map(children => {
            if (children === null)
                return null;
            // Because we may have matched two outlets to the same empty path segment, we can have
            // multiple activated results for the same outlet. We should merge the children of
            // these results so the final return value is only one `TreeNode` per outlet.
            const mergedChildren = mergeEmptyPathMatches(children);
            if (NG_DEV_MODE) {
                // This should really never happen - we are only taking the first match for each
                // outlet and merge the empty path matches.
                checkOutletNameUniqueness(mergedChildren);
            }
            sortActivatedRouteSnapshots(mergedChildren);
            return mergedChildren;
        }));
    }
    processSegment(injector, routes, segmentGroup, segments, outlet) {
        return from(routes).pipe(concatMap(r => {
            return this.processSegmentAgainstRoute(r._injector ?? injector, r, segmentGroup, segments, outlet);
        }), first((x) => !!x), catchError(e => {
            if (e instanceof EmptyError) {
                if (noLeftoversInUrl(segmentGroup, segments, outlet)) {
                    return of([]);
                }
                return of(null);
            }
            throw e;
        }));
    }
    processSegmentAgainstRoute(injector, route, rawSegment, segments, outlet) {
        if (route.redirectTo || !isImmediateMatch(route, rawSegment, segments, outlet))
            return of(null);
        let matchResult;
        if (route.path === '**') {
            const params = segments.length > 0 ? last(segments).parameters : {};
            const pathIndexShift = getPathIndexShift(rawSegment) + segments.length;
            const snapshot = new ActivatedRouteSnapshot(segments, params, Object.freeze({ ...this.urlTree.queryParams }), this.urlTree.fragment, getData(route), getOutlet(route), route.component ?? route._loadedComponent ?? null, route, getSourceSegmentGroup(rawSegment), pathIndexShift, getResolve(route), 
            // NG_DEV_MODE is used to prevent the getCorrectedPathIndexShift function from affecting
            // production bundle size. This value is intended only to surface a warning to users
            // depending on `relativeLinkResolution: 'legacy'` in dev mode.
            (NG_DEV_MODE ? getCorrectedPathIndexShift(rawSegment) + segments.length :
                pathIndexShift));
            matchResult = of({
                snapshot,
                consumedSegments: [],
                remainingSegments: [],
            });
        }
        else {
            matchResult =
                matchWithChecks(rawSegment, route, segments, injector, this.urlSerializer)
                    .pipe(map(({ matched, consumedSegments, remainingSegments, parameters }) => {
                    if (!matched) {
                        return null;
                    }
                    const pathIndexShift = getPathIndexShift(rawSegment) + consumedSegments.length;
                    const snapshot = new ActivatedRouteSnapshot(consumedSegments, parameters, Object.freeze({ ...this.urlTree.queryParams }), this.urlTree.fragment, getData(route), getOutlet(route), route.component ?? route._loadedComponent ?? null, route, getSourceSegmentGroup(rawSegment), pathIndexShift, getResolve(route), (NG_DEV_MODE ?
                        getCorrectedPathIndexShift(rawSegment) + consumedSegments.length :
                        pathIndexShift));
                    return { snapshot, consumedSegments, remainingSegments };
                }));
        }
        return matchResult.pipe(switchMap((result) => {
            if (result === null) {
                return of(null);
            }
            const { snapshot, consumedSegments, remainingSegments } = result;
            // If the route has an injector created from providers, we should start using that.
            injector = route._injector ?? injector;
            const childInjector = route._loadedInjector ?? injector;
            const childConfig = getChildConfig(route);
            const { segmentGroup, slicedSegments } = split(rawSegment, consumedSegments, remainingSegments, 
            // Filter out routes with redirectTo because we are trying to create activated route
            // snapshots and don't handle redirects here. That should have been done in
            // `applyRedirects`.
            childConfig.filter(c => c.redirectTo === undefined), this.relativeLinkResolution);
            if (slicedSegments.length === 0 && segmentGroup.hasChildren()) {
                return this.processChildren(childInjector, childConfig, segmentGroup).pipe(map(children => {
                    if (children === null) {
                        return null;
                    }
                    return [new TreeNode(snapshot, children)];
                }));
            }
            if (childConfig.length === 0 && slicedSegments.length === 0) {
                return of([new TreeNode(snapshot, [])]);
            }
            const matchedOnOutlet = getOutlet(route) === outlet;
            // If we matched a config due to empty path match on a different outlet, we need to
            // continue passing the current outlet for the segment rather than switch to PRIMARY.
            // Note that we switch to primary when we have a match because outlet configs look like
            // this: {path: 'a', outlet: 'a', children: [
            //  {path: 'b', component: B},
            //  {path: 'c', component: C},
            // ]}
            // Notice that the children of the named outlet are configured with the primary outlet
            return this
                .processSegment(childInjector, childConfig, segmentGroup, slicedSegments, matchedOnOutlet ? PRIMARY_OUTLET : outlet)
                .pipe(map(children => {
                if (children === null) {
                    return null;
                }
                return [new TreeNode(snapshot, children)];
            }));
        }));
    }
}
function sortActivatedRouteSnapshots(nodes) {
    nodes.sort((a, b) => {
        if (a.value.outlet === PRIMARY_OUTLET)
            return -1;
        if (b.value.outlet === PRIMARY_OUTLET)
            return 1;
        return a.value.outlet.localeCompare(b.value.outlet);
    });
}
function getChildConfig(route) {
    if (route.children) {
        return route.children;
    }
    if (route.loadChildren) {
        return route._loadedRoutes;
    }
    return [];
}
function hasEmptyPathConfig(node) {
    const config = node.value.routeConfig;
    return config && config.path === '' && config.redirectTo === undefined;
}
/**
 * Finds `TreeNode`s with matching empty path route configs and merges them into `TreeNode` with
 * the children from each duplicate. This is necessary because different outlets can match a
 * single empty path route config and the results need to then be merged.
 */
function mergeEmptyPathMatches(nodes) {
    const result = [];
    // The set of nodes which contain children that were merged from two duplicate empty path nodes.
    const mergedNodes = new Set();
    for (const node of nodes) {
        if (!hasEmptyPathConfig(node)) {
            result.push(node);
            continue;
        }
        const duplicateEmptyPathNode = result.find(resultNode => node.value.routeConfig === resultNode.value.routeConfig);
        if (duplicateEmptyPathNode !== undefined) {
            duplicateEmptyPathNode.children.push(...node.children);
            mergedNodes.add(duplicateEmptyPathNode);
        }
        else {
            result.push(node);
        }
    }
    // For each node which has children from multiple sources, we need to recompute a new `TreeNode`
    // by also merging those children. This is necessary when there are multiple empty path configs
    // in a row. Put another way: whenever we combine children of two nodes, we need to also check
    // if any of those children can be combined into a single node as well.
    for (const mergedNode of mergedNodes) {
        const mergedChildren = mergeEmptyPathMatches(mergedNode.children);
        result.push(new TreeNode(mergedNode.value, mergedChildren));
    }
    return result.filter(n => !mergedNodes.has(n));
}
function checkOutletNameUniqueness(nodes) {
    const names = {};
    nodes.forEach(n => {
        const routeWithSameOutletName = names[n.value.outlet];
        if (routeWithSameOutletName) {
            const p = routeWithSameOutletName.url.map(s => s.toString()).join('/');
            const c = n.value.url.map(s => s.toString()).join('/');
            throw new RuntimeError(4006 /* RuntimeErrorCode.TWO_SEGMENTS_WITH_SAME_OUTLET */, NG_DEV_MODE && `Two segments cannot have the same outlet name: '${p}' and '${c}'.`);
        }
        names[n.value.outlet] = n.value;
    });
}
function getSourceSegmentGroup(segmentGroup) {
    let s = segmentGroup;
    while (s._sourceSegment) {
        s = s._sourceSegment;
    }
    return s;
}
function getPathIndexShift(segmentGroup) {
    let s = segmentGroup;
    let res = s._segmentIndexShift ?? 0;
    while (s._sourceSegment) {
        s = s._sourceSegment;
        res += s._segmentIndexShift ?? 0;
    }
    return res - 1;
}
function getCorrectedPathIndexShift(segmentGroup) {
    let s = segmentGroup;
    let res = s._segmentIndexShiftCorrected ?? s._segmentIndexShift ?? 0;
    while (s._sourceSegment) {
        s = s._sourceSegment;
        res += s._segmentIndexShiftCorrected ?? s._segmentIndexShift ?? 0;
    }
    return res - 1;
}
function getData(route) {
    return route.data || {};
}
function getResolve(route) {
    return route.resolve || {};
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVjb2duaXplLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvcm91dGVyL3NyYy9yZWNvZ25pemUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUF1RCxhQUFhLElBQUksWUFBWSxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBQ2xILE9BQU8sRUFBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBWSxFQUFFLEVBQUMsTUFBTSxNQUFNLENBQUM7QUFDaEUsT0FBTyxFQUFDLFVBQVUsRUFBRSxTQUFTLEVBQUUsY0FBYyxFQUFFLEtBQUssRUFBRSxJQUFJLElBQUksUUFBUSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQWEsU0FBUyxFQUFZLFNBQVMsRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBSXBKLE9BQU8sRUFBQyxzQkFBc0IsRUFBRSwwQkFBMEIsRUFBNkIsbUJBQW1CLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUNsSSxPQUFPLEVBQUMsY0FBYyxFQUFDLE1BQU0sVUFBVSxDQUFDO0FBRXhDLE9BQU8sRUFBQyxJQUFJLEVBQUMsTUFBTSxvQkFBb0IsQ0FBQztBQUN4QyxPQUFPLEVBQW1DLFNBQVMsRUFBRSxxQkFBcUIsRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBQ2xHLE9BQU8sRUFBQyxnQkFBZ0IsRUFBRSxlQUFlLEVBQUUsZ0JBQWdCLEVBQUUsS0FBSyxFQUFDLE1BQU0seUJBQXlCLENBQUM7QUFDbkcsT0FBTyxFQUFDLFFBQVEsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUV0QyxNQUFNLFdBQVcsR0FBRyxPQUFPLFNBQVMsS0FBSyxXQUFXLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUVwRSxNQUFNLE9BQU87Q0FBRztBQUVoQixTQUFTLGtCQUFrQixDQUFDLENBQVU7SUFDcEMsa0dBQWtHO0lBQ2xHLE9BQU8sSUFBSSxVQUFVLENBQXNCLENBQUMsR0FB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KipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtjcmVhdGVFbnZpcm9ubWVudEluamVjdG9yLCBFbnZpcm9ubWVudEluamVjdG9yLCBUeXBlLCDJtVJ1bnRpbWVFcnJvciBhcyBSdW50aW1lRXJyb3J9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHtFbXB0eUVycm9yLCBmcm9tLCBPYnNlcnZhYmxlLCBPYnNlcnZlciwgb2Z9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHtjYXRjaEVycm9yLCBjb25jYXRNYXAsIGRlZmF1bHRJZkVtcHR5LCBmaXJzdCwgbGFzdCBhcyByeGpzTGFzdCwgbWFwLCBzY2FuLCBzdGFydFdpdGgsIHN3aXRjaE1hcCwgdGFrZUxhc3QsIHRha2VXaGlsZX0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuXG5pbXBvcnQge1J1bnRpbWVFcnJvckNvZGV9IGZyb20gJy4vZXJyb3JzJztcbmltcG9ydCB7RGF0YSwgUmVzb2x2ZURhdGEsIFJvdXRlLCBSb3V0ZXN9IGZyb20gJy4vbW9kZWxzJztcbmltcG9ydCB7QWN0aXZhdGVkUm91dGVTbmFwc2hvdCwgaW5oZXJpdGVkUGFyYW1zRGF0YVJlc29sdmUsIFBhcmFtc0luaGVyaXRhbmNlU3RyYXRlZ3ksIFJvdXRlclN0YXRlU25hcHNob3R9IGZyb20gJy4vcm91dGVyX3N0YXRlJztcbmltcG9ydCB7UFJJTUFSWV9PVVRMRVR9IGZyb20gJy4vc2hhcmVkJztcbmltcG9ydCB7VXJsU2VnbWVudCwgVXJsU2VnbWVudEdyb3VwLCBVcmxTZXJpYWxpemVyLCBVcmxUcmVlfSBmcm9tICcuL3VybF90cmVlJztcbmltcG9ydCB7bGFzdH0gZnJvbSAnLi91dGlscy9jb2xsZWN0aW9uJztcbmltcG9ydCB7Z2V0T3JDcmVhdGVSb3V0ZUluamVjdG9ySWZOZWVkZWQsIGdldE91dGxldCwgc29ydEJ5TWF0Y2hpbmdPdXRsZXRzfSBmcm9tICcuL3V0aWxzL2NvbmZpZyc7XG5pbXBvcnQge2lzSW1tZWRpYXRlTWF0Y2gsIG1hdGNoV2l0aENoZWNrcywgbm9MZWZ0b3ZlcnNJblVybCwgc3BsaXR9IGZyb20gJy4vdXRpbHMvY29uZmlnX21hdGNoaW5nJztcbmltcG9ydCB7VHJlZU5vZGV9IGZyb20gJy4vdXRpbHMvdHJlZSc7XG5cbmNvbnN0IE5HX0RFVl9NT0RFID0gdHlwZW9mIG5nRGV2TW9kZSA9PT0gJ3VuZGVmaW5lZCcgfHwgISFuZ0Rldk1vZGU7XG5cbmNsYXNzIE5vTWF0Y2gge31cblxuZnVuY3Rpb24gbmV3T2JzZXJ2YWJsZUVycm9yKGU6IHVua25vd24pOiBPYnNlcnZhYmxlPFJvdXRlclN0YXRlU25hcHNob3Q+IHtcbiAgLy8gVE9ETyhhdHNjb3R0KTogVGhpcyBwYXR0ZXJuIGlzIHVzZWQgdGhyb3VnaG91dCB0aGUgcm91dGVyIGNvZGUgYW5kIGNhbiBiZSBgdGhyb3dFcnJvcmAgaW5zdGVhZC5cbiAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlPFJvdXRlclN0YXRlU25hcHNob3Q+KChvYnM6IE9ic2VydmVyPFJvdXRlclN0YXRlU25hcHNob3Q+KSA9PiBvYnMuZXJyb3IoZSkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVjb2duaXplKFxuICAgIGluamVjdG9yOiBFbnZpcm9ubWVudEluamVjdG9yLCByb290Q29tcG9uZW50VHlwZTogVHlwZTxhbnk+fG51bGwsIGNvbmZpZzogUm91dGVzLFxuICAgIHVybFRyZWU6IFVybFRyZWUsIHVybDogc3RyaW5nLCB1cmxTZXJpYWxpemVyOiBVcmxTZXJpYWxpemVyLFxuICAgIHBhcmFtc0luaGVyaXRhbmNlU3RyYXRlZ3k6IFBhcmFtc0luaGVyaXRhbmNlU3RyYXRlZ3kgPSAnZW1wdHlPbmx5JyxcbiAgICByZWxhdGl2ZUxpbmtSZXNvbHV0aW9uOiAnbGVnYWN5J3wnY29ycmVjdGVkJyA9ICdsZWdhY3knKTogT2JzZXJ2YWJsZTxSb3V0ZXJTdGF0ZVNuYXBzaG90PiB7XG4gIHJldHVybiBuZXcgUmVjb2duaXplcihcbiAgICAgICAgICAgICBpbmplY3Rvciwgcm9vdENvbXBvbmVudFR5cGUsIGNvbmZpZywgdXJsVHJlZSwgdXJsLCBwYXJhbXNJbmhlcml0YW5jZVN0cmF0ZWd5LFxuICAgICAgICAgICAgIHJlbGF0aXZlTGlua1Jlc29sdXRpb24sIHVybFNlcmlhbGl6ZXIpXG4gICAgICAucmVjb2duaXplKClcbiAgICAgIC5waXBlKHN3aXRjaE1hcChyZXN1bHQgPT4ge1xuICAgICAgICBpZiAocmVzdWx0ID09PSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuIG5ld09ic2VydmFibGVFcnJvcihuZXcgTm9NYXRjaCgpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gb2YocmVzdWx0KTtcbiAgICAgICAgfVxuICAgICAgfSkpO1xufVxuXG5leHBvcnQgY2xhc3MgUmVjb2duaXplciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBpbmplY3RvcjogRW52aXJvbm1lbnRJbmplY3RvciwgcHJpdmF0ZSByb290Q29tcG9uZW50VHlwZTogVHlwZTxhbnk+fG51bGwsXG4gICAgICBwcml2YXRlIGNvbmZpZzogUm91dGVzLCBwcml2YXRlIHVybFRyZWU6IFVybFRyZWUsIHByaXZhdGUgdXJsOiBzdHJpbmcsXG4gICAgICBwcml2YXRlIHBhcmFtc0luaGVyaXRhbmNlU3RyYXRlZ3k6IFBhcmFtc0luaGVyaXRhbmNlU3RyYXRlZ3ksXG4gICAgICBwcml2YXRlIHJlbGF0aXZlTGlua1Jlc29sdXRpb246ICdsZWdhY3knfCdjb3JyZWN0ZWQnLFxuICAgICAgcHJpdmF0ZSByZWFkb25seSB1cmxTZXJpYWxpemVyOiBVcmxTZXJpYWxpemVyKSB7fVxuXG4gIHJlY29nbml6ZSgpOiBPYnNlcnZhYmxlPFJvdXRlclN0YXRlU25hcHNob3R8bnVsbD4ge1xuICAgIGNvbnN0IHJvb3RTZWdtZW50R3JvdXAgPVxuICAgICAgICBzcGxpdChcbiAgICAgICAgICAgIHRoaXMudXJsVHJlZS5yb290LCBbXSwgW10sIHRoaXMuY29uZmlnLmZpbHRlcihjID0+IGMucmVkaXJlY3RUbyA9PT0gdW5kZWZpbmVkKSxcbiAgICAgICAgICAgIHRoaXMucmVsYXRpdmVMaW5rUmVzb2x1dGlvbilcbiAgICAgICAgICAgIC5zZWdtZW50R3JvdXA7XG5cbiAgICByZXR1cm4gdGhpcy5wcm9jZXNzU2VnbWVudEdyb3VwKHRoaXMuaW5qZWN0b3IsIHRoaXMuY29uZmlnLCByb290U2VnbWVudEdyb3VwLCBQUklNQVJZX09VVExFVClcbiAgICAgICAgLnBpcGUobWFwKGNoaWxkcmVuID0+IHtcbiAgICAgICAgICBpZiAoY2hpbGRyZW4gPT09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFVzZSBPYmplY3QuZnJlZXplIHRvIHByZXZlbnQgcmVhZGVycyBvZiB0aGUgUm91dGVyIHN0YXRlIGZyb20gbW9kaWZ5aW5nIGl0IG91dHNpZGUgb2YgYVxuICAgICAgICAgIC8vIG5hdmlnYXRpb24sIHJlc3VsdGluZyBpbiB0aGUgcm91dGVyIGJlaW5nIG91dCBvZiBzeW5jIHdpdGggdGhlIGJyb3dzZXIuXG4gICAgICAgICAgY29uc3Qgcm9vdCA9IG5ldyBBY3RpdmF0ZWRSb3V0ZVNuYXBzaG90KFxuICAgICAgICAgICAgICBbXSwgT2JqZWN0LmZyZWV6ZSh7fSksIE9iamVjdC5mcmVlemUoey4uLnRoaXMudXJsVHJlZS5xdWVyeVBhcmFtc30pLFxuICAgICAgICAgICAgICB0aGlzLnVybFRyZWUuZnJhZ21lbnQsIHt9LCBQUklNQVJZX09VVExFVCwgdGhpcy5yb290Q29tcG9uZW50VHlwZSwgbnVsbCxcbiAgICAgICAgICAgICAgdGhpcy51cmxUcmVlLnJvb3QsIC0xLCB7fSk7XG5cbiAgICAgICAgICBjb25zdCByb290Tm9kZSA9IG5ldyBUcmVlTm9kZTxBY3RpdmF0ZWRSb3V0ZVNuYXBzaG90Pihyb290LCBjaGlsZHJlbik7XG4gICAgICAgICAgY29uc3Qgcm91dGVTdGF0ZSA9IG5ldyBSb3V0ZXJTdGF0ZVNuYXBzaG90KHRoaXMudXJsLCByb290Tm9kZSk7XG4gICAgICAgICAgdGhpcy5pbmhlcml0UGFyYW1zQW5kRGF0YShyb3V0ZVN0YXRlLl9yb290KTtcbiAgICAgICAgICByZXR1cm4gcm91dGVTdGF0ZTtcbiAgICAgICAgfSkpO1xuICB9XG5cbiAgaW5oZXJpdFBhcmFtc0FuZERhdGEocm91dGVOb2RlOiBUcmVlTm9kZTxBY3RpdmF0ZWRSb3V0ZVNuYXBzaG90Pik6IHZvaWQge1xuICAgIGNvbnN0IHJvdXRlID0gcm91dGVOb2RlLnZhbHVlO1xuXG4gICAgY29uc3QgaSA9IGluaGVyaXRlZFBhcmFtc0RhdGFSZXNvbHZlKHJvdXRlLCB0aGlzLnBhcmFtc0luaGVyaXRhbmNlU3RyYXRlZ3kpO1xuICAgIHJvdXRlLnBhcmFtcyA9IE9iamVjdC5mcmVlemUoaS5wYXJhbXMpO1xuICAgIHJvdXRlLmRhdGEgPSBPYmplY3QuZnJlZXplKGkuZGF0YSk7XG5cbiAgICByb3V0ZU5vZGUuY2hpbGRyZW4uZm9yRWFjaChuID0+IHRoaXMuaW5oZXJpdFBhcmFtc0FuZERhdGEobikpO1xuICB9XG5cbiAgcHJvY2Vzc1NlZ21lbnRHcm91cChcbiAgICAgIGluamVjdG9yOiBFbnZpcm9ubWVudEluamVjdG9yLCBjb25maWc6IFJvdXRlW10sIHNlZ21lbnRHcm91cDogVXJsU2VnbWVudEdyb3VwLFxuICAgICAgb3V0bGV0OiBzdHJpbmcpOiBPYnNlcnZhYmxlPFRyZWVOb2RlPEFjdGl2YXRlZFJvdXRlU25hcHNob3Q+W118bnVsbD4ge1xuICAgIGlmIChzZWdtZW50R3JvdXAuc2VnbWVudHMubGVuZ3RoID09PSAwICYmIHNlZ21lbnRHcm91cC5oYXNDaGlsZHJlbigpKSB7XG4gICAgICByZXR1cm4gdGhpcy5wcm9jZXNzQ2hpbGRyZW4oaW5qZWN0b3IsIGNvbmZpZywgc2VnbWVudEdyb3VwKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5wcm9jZXNzU2VnbWVudChpbmplY3RvciwgY29uZmlnLCBzZWdtZW50R3JvdXAsIHNlZ21lbnRHcm91cC5zZWdtZW50cywgb3V0bGV0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBNYXRjaGVzIGV2ZXJ5IGNoaWxkIG91dGxldCBpbiB0aGUgYHNlZ21lbnRHcm91cGAgdG8gYSBgUm91dGVgIGluIHRoZSBjb25maWcuIFJldHVybnMgYG51bGxgIGlmXG4gICAqIHdlIGNhbm5vdCBmaW5kIGEgbWF0Y2ggZm9yIF9hbnlfIG9mIHRoZSBjaGlsZHJlbi5cbiAgICpcbiAgICogQHBhcmFtIGNvbmZpZyAtIFRoZSBgUm91dGVzYCB0byBtYXRjaCBhZ2FpbnN0XG4gICAqIEBwYXJhbSBzZWdtZW50R3JvdXAgLSBUaGUgYFVybFNlZ21lbnRHcm91cGAgd2hvc2UgY2hpbGRyZW4gbmVlZCB0byBiZSBtYXRjaGVkIGFnYWluc3QgdGhlXG4gICAqICAgICBjb25maWcuXG4gICAqL1xuICBwcm9jZXNzQ2hpbGRyZW4oaW5qZWN0b3I6IEVudmlyb25tZW50SW5qZWN0b3IsIGNvbmZpZzogUm91dGVbXSwgc2VnbWVudEdyb3VwOiBVcmxTZWdtZW50R3JvdXApOlxuICAgICAgT2JzZXJ2YWJsZTxUcmVlTm9kZTxBY3RpdmF0ZWRSb3V0ZVNuYXBzaG90PltdfG51bGw+IHtcbiAgICByZXR1cm4gZnJvbShPYmplY3Qua2V5cyhzZWdtZW50R3JvdXAuY2hpbGRyZW4pKVxuICAgICAgICAucGlwZShcbiAgICAgICAgICAgIGNvbmNhdE1hcChjaGlsZE91dGxldCA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gc2VnbWVudEdyb3VwLmNoaWxkcmVuW2NoaWxkT3V0bGV0XTtcbiAgICAgICAgICAgICAgLy8gU29ydCB0aGUgY29uZmlnIHNvIHRoYXQgcm91dGVzIHdpdGggb3V0bGV0cyB0aGF0IG1hdGNoIHRoZSBvbmUgYmVpbmcgYWN0aXZhdGVkXG4gICAgICAgICAgICAgIC8vIGFwcGVhciBmaXJzdCwgZm9sbG93ZWQgYnkgcm91dGVzIGZvciBvdGhlciBvdXRsZXRzLCB3aGljaCBtaWdodCBtYXRjaCBpZiB0aGV5IGhhdmVcbiAgICAgICAgICAgICAgLy8gYW4gZW1wdHkgcGF0aC5cbiAgICAgICAgICAgICAgY29uc3Qgc29ydGVkQ29uZmlnID0gc29ydEJ5TWF0Y2hpbmdPdXRsZXRzKGNvbmZpZywgY2hpbGRPdXRsZXQpO1xuICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wcm9jZXNzU2VnbWVudEdyb3VwKGluamVjdG9yLCBzb3J0ZWRDb25maWcsIGNoaWxkLCBjaGlsZE91dGxldCk7XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIHNjYW4oKGNoaWxkcmVuLCBvdXRsZXRDaGlsZHJlbikgPT4ge1xuICAgICAgICAgICAgICBpZiAoIWNoaWxkcmVuIHx8ICFvdXRsZXRDaGlsZHJlbikgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgIGNoaWxkcmVuLnB1c2goLi4ub3V0bGV0Q2hpbGRyZW4pO1xuICAgICAgICAgICAgICByZXR1cm4gY2hpbGRyZW47XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIHRha2VXaGlsZShjaGlsZHJlbiA9PiBjaGlsZHJlbiAhPT0gbnVsbCksXG4gICAgICAgICAgICBkZWZhdWx0SWZFbXB0eShudWxsIGFzIFRyZWVOb2RlPEFjdGl2YXRlZFJvdXRlU25hcHNob3Q+W10gfCBudWxsKSxcbiAgICAgICAgICAgIHJ4anNMYXN0KCksXG4gICAgICAgICAgICBtYXAoY2hpbGRyZW4gPT4ge1xuICAgICAgICAgICAgICBpZiAoY2hpbGRyZW4gPT09IG51bGwpIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAvLyBCZWNhdXNlIHdlIG1heSBoYXZlIG1hdGNoZWQgdHdvIG91dGxldHMgdG8gdGhlIHNhbWUgZW1wdHkgcGF0aCBzZWdtZW50LCB3ZSBjYW4gaGF2ZVxuICAgICAgICAgICAgICAvLyBtdWx0aXBsZSBhY3RpdmF0ZWQgcmVzdWx0cyBmb3IgdGhlIHNhbWUgb3V0bGV0LiBXZSBzaG91bGQgbWVyZ2UgdGhlIGNoaWxkcmVuIG9mXG4gICAgICAgICAgICAgIC8vIHRoZXNlIHJlc3VsdHMgc28gdGhlIGZpbmFsIHJldHVybiB2YWx1ZSBpcyBvbmx5IG9uZSBgVHJlZU5vZGVgIHBlciBvdXRsZXQuXG4gICAgICAgICAgICAgIGNvbnN0IG1lcmdlZENoaWxkcmVuID0gbWVyZ2VFbXB0eVBhdGhNYXRjaGVzKGNoaWxkcmVuKTtcbiAgICAgICAgICAgICAgaWYgKE5HX0RFVl9NT0RFKSB7XG4gICAgICAgICAgICAgICAgLy8gVGhpcyBzaG91bGQgcmVhbGx5IG5ldmVyIGhhcHBlbiAtIHdlIGFyZSBvbmx5IHRha2luZyB0aGUgZmlyc3QgbWF0Y2ggZm9yIGVhY2hcbiAgICAgICAgICAgICAgICAvLyBvdXRsZXQgYW5kIG1lcmdlIHRoZSBlbXB0eSBwYXRoIG1hdGNoZXMuXG4gICAgICAgICAgICAgICAgY2hlY2tPdXRsZXROYW1lVW5pcXVlbmVzcyhtZXJnZWRDaGlsZHJlbik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgc29ydEFjdGl2YXRlZFJvdXRlU25hcHNob3RzKG1lcmdlZENoaWxkcmVuKTtcbiAgICAgICAgICAgICAgcmV0dXJuIG1lcmdlZENoaWxkcmVuO1xuICAgICAgICAgICAgfSksXG4gICAgICAgICk7XG4gIH1cblxuICBwcm9jZXNzU2VnbWVudChcbiAgICAgIGluamVjdG9yOiBFbnZpcm9ubWVudEluamVjdG9yLCByb3V0ZXM6IFJvdXRlW10sIHNlZ21lbnRHcm91cDogVXJsU2VnbWVudEdyb3VwLFxuICAgICAgc2VnbWVudHM6IFVybFNlZ21lbnRbXSwgb3V0bGV0OiBzdHJpbmcpOiBPYnNlcnZhYmxlPFRyZWVOb2RlPEFjdGl2YXRlZFJvdXRlU25hcHNob3Q+W118bnVsbD4ge1xuICAgIHJldHVybiBmcm9tKHJvdXRlcykucGlwZShcbiAgICAgICAgY29uY2F0TWFwKHIgPT4ge1xuICAgICAgICAgIHJldHVybiB0aGlzLnByb2Nlc3NTZWdtZW50QWdhaW5zdFJvdXRlKFxuICAgICAgICAgICAgICByLl9pbmplY3RvciA/PyBpbmplY3Rvciwgciwgc2VnbWVudEdyb3VwLCBzZWdtZW50cywgb3V0bGV0KTtcbiAgICAgICAgfSksXG4gICAgICAgIGZpcnN0KCh4KTogeCBpcyBUcmVlTm9kZTxBY3RpdmF0ZWRSb3V0ZVNuYXBzaG90PltdID0+ICEheCksIGNhdGNoRXJyb3IoZSA9PiB7XG4gICAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBFbXB0eUVycm9yKSB7XG4gICAgICAgICAgICBpZiAobm9MZWZ0b3ZlcnNJblVybChzZWdtZW50R3JvdXAsIHNlZ21lbnRzLCBvdXRsZXQpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBvZihbXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gb2YobnVsbCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRocm93IGU7XG4gICAgICAgIH0pKTtcbiAgfVxuXG4gIHByb2Nlc3NTZWdtZW50QWdhaW5zdFJvdXRlKFxuICAgICAgaW5qZWN0b3I6IEVudmlyb25tZW50SW5qZWN0b3IsIHJvdXRlOiBSb3V0ZSwgcmF3U2VnbWVudDogVXJsU2VnbWVudEdyb3VwLFxuICAgICAgc2VnbWVudHM6IFVybFNlZ21lbnRbXSwgb3V0bGV0OiBzdHJpbmcpOiBPYnNlcnZhYmxlPFRyZWVOb2RlPEFjdGl2YXRlZFJvdXRlU25hcHNob3Q+W118bnVsbD4ge1xuICAgIGlmIChyb3V0ZS5yZWRpcmVjdFRvIHx8ICFpc0ltbWVkaWF0ZU1hdGNoKHJvdXRlLCByYXdTZWdtZW50LCBzZWdtZW50cywgb3V0bGV0KSkgcmV0dXJuIG9mKG51bGwpO1xuXG4gICAgbGV0IG1hdGNoUmVzdWx0OiBPYnNlcnZhYmxlPHtcbiAgICAgIHNuYXBzaG90OiBBY3RpdmF0ZWRSb3V0ZVNuYXBzaG90LFxuICAgICAgY29uc3VtZWRTZWdtZW50czogVXJsU2VnbWVudFtdLFxuICAgICAgcmVtYWluaW5nU2VnbWVudHM6IFVybFNlZ21lbnRbXSxcbiAgICB9fG51bGw+O1xuXG4gICAgaWYgKHJvdXRlLnBhdGggPT09ICcqKicpIHtcbiAgICAgIGNvbnN0IHBhcmFtcyA9IHNlZ21lbnRzLmxlbmd0aCA+IDAgPyBsYXN0KHNlZ21lbnRzKSEucGFyYW1ldGVycyA6IHt9O1xuICAgICAgY29uc3QgcGF0aEluZGV4U2hpZnQgPSBnZXRQYXRoSW5kZXhTaGlmdChyYXdTZWdtZW50KSArIHNlZ21lbnRzLmxlbmd0aDtcbiAgICAgIGNvbnN0IHNuYXBzaG90ID0gbmV3IEFjdGl2YXRlZFJvdXRlU25hcHNob3QoXG4gICAgICAgICAgc2VnbWVudHMsIHBhcmFtcywgT2JqZWN0LmZyZWV6ZSh7Li4udGhpcy51cmxUcmVlLnF1ZXJ5UGFyYW1zfSksIHRoaXMudXJsVHJlZS5mcmFnbWVudCxcbiAgICAgICAgICBnZXREYXRhKHJvdXRlKSwgZ2V0T3V0bGV0KHJvdXRlKSwgcm91dGUuY29tcG9uZW50ID8/IHJvdXRlLl9sb2FkZWRDb21wb25lbnQgPz8gbnVsbCxcbiAgICAgICAgICByb3V0ZSwgZ2V0U291cmNlU2VnbWVudEdyb3VwKHJhd1NlZ21lbnQpLCBwYXRoSW5kZXhTaGlmdCwgZ2V0UmVzb2x2ZShyb3V0ZSksXG4gICAgICAgICAgLy8gTkdfREVWX01PREUgaXMgdXNlZCB0byBwcmV2ZW50IHRoZSBnZXRDb3JyZWN0ZWRQYXRoSW5kZXhTaGlmdCBmdW5jdGlvbiBmcm9tIGFmZmVjdGluZ1xuICAgICAgICAgIC8vIHByb2R1Y3Rpb24gYnVuZGxlIHNpemUuIFRoaXMgdmFsdWUgaXMgaW50ZW5kZWQgb25seSB0byBzdXJmYWNlIGEgd2FybmluZyB0byB1c2Vyc1xuICAgICAgICAgIC8vIGRlcGVuZGluZyBvbiBgcmVsYXRpdmVMaW5rUmVzb2x1dGlvbjogJ2xlZ2FjeSdgIGluIGRldiBtb2RlLlxuICAgICAgICAgIChOR19ERVZfTU9ERSA/IGdldENvcnJlY3RlZFBhdGhJbmRleFNoaWZ0KHJhd1NlZ21lbnQpICsgc2VnbWVudHMubGVuZ3RoIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICBwYXRoSW5kZXhTaGlmdCkpO1xuICAgICAgbWF0Y2hSZXN1bHQgPSBvZih7XG4gICAgICAgIHNuYXBzaG90LFxuICAgICAgICBjb25zdW1lZFNlZ21lbnRzOiBbXSxcbiAgICAgICAgcmVtYWluaW5nU2VnbWVudHM6IFtdLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1hdGNoUmVzdWx0ID1cbiAgICAgICAgICBtYXRjaFdpdGhDaGVja3MocmF3U2VnbWVudCwgcm91dGUsIHNlZ21lbnRzLCBpbmplY3RvciwgdGhpcy51cmxTZXJpYWxpemVyKVxuICAgICAgICAgICAgICAucGlwZShtYXAoKHttYXRjaGVkLCBjb25zdW1lZFNlZ21lbnRzLCByZW1haW5pbmdTZWdtZW50cywgcGFyYW1ldGVyc30pID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIW1hdGNoZWQpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBwYXRoSW5kZXhTaGlmdCA9IGdldFBhdGhJbmRleFNoaWZ0KHJhd1NlZ21lbnQpICsgY29uc3VtZWRTZWdtZW50cy5sZW5ndGg7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBzbmFwc2hvdCA9IG5ldyBBY3RpdmF0ZWRSb3V0ZVNuYXBzaG90KFxuICAgICAgICAgICAgICAgICAgICBjb25zdW1lZFNlZ21lbnRzLCBwYXJhbWV0ZXJzLCBPYmplY3QuZnJlZXplKHsuLi50aGlzLnVybFRyZWUucXVlcnlQYXJhbXN9KSxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51cmxUcmVlLmZyYWdtZW50LCBnZXREYXRhKHJvdXRlKSwgZ2V0T3V0bGV0KHJvdXRlKSxcbiAgICAgICAgICAgICAgICAgICAgcm91dGUuY29tcG9uZW50ID8/IHJvdXRlLl9sb2FkZWRDb21wb25lbnQgPz8gbnVsbCwgcm91dGUsXG4gICAgICAgICAgICAgICAgICAgIGdldFNvdXJjZVNlZ21lbnRHcm91cChyYXdTZWdtZW50KSwgcGF0aEluZGV4U2hpZnQsIGdldFJlc29sdmUocm91dGUpLFxuICAgICAgICAgICAgICAgICAgICAoTkdfREVWX01PREUgP1xuICAgICAgICAgICAgICAgICAgICAgICAgIGdldENvcnJlY3RlZFBhdGhJbmRleFNoaWZ0KHJhd1NlZ21lbnQpICsgY29uc3VtZWRTZWdtZW50cy5sZW5ndGggOlxuICAgICAgICAgICAgICAgICAgICAgICAgIHBhdGhJbmRleFNoaWZ0KSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtzbmFwc2hvdCwgY29uc3VtZWRTZWdtZW50cywgcmVtYWluaW5nU2VnbWVudHN9O1xuICAgICAgICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG1hdGNoUmVzdWx0LnBpcGUoc3dpdGNoTWFwKChyZXN1bHQpID0+IHtcbiAgICAgIGlmIChyZXN1bHQgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG9mKG51bGwpO1xuICAgICAgfVxuICAgICAgY29uc3Qge3NuYXBzaG90LCBjb25zdW1lZFNlZ21lbnRzLCByZW1haW5pbmdTZWdtZW50c30gPSByZXN1bHQ7XG4gICAgICAvLyBJZiB0aGUgcm91dGUgaGFzIGFuIGluamVjdG9yIGNyZWF0ZWQgZnJvbSBwcm92aWRlcnMsIHdlIHNob3VsZCBzdGFydCB1c2luZyB0aGF0LlxuICAgICAgaW5qZWN0b3IgPSByb3V0ZS5faW5qZWN0b3IgPz8gaW5qZWN0b3I7XG4gICAgICBjb25zdCBjaGlsZEluamVjdG9yID0gcm91dGUuX2xvYWRlZEluamVjdG9yID8/IGluamVjdG9yO1xuICAgICAgY29uc3QgY2hpbGRDb25maWc6IFJvdXRlW10gPSBnZXRDaGlsZENvbmZpZyhyb3V0ZSk7XG5cbiAgICAgIGNvbnN0IHtzZWdtZW50R3JvdXAsIHNsaWNlZFNlZ21lbnRzfSA9IHNwbGl0KFxuICAgICAgICAgIHJhd1NlZ21lbnQsIGNvbnN1bWVkU2VnbWVudHMsIHJlbWFpbmluZ1NlZ21lbnRzLFxuICAgICAgICAgIC8vIEZpbHRlciBvdXQgcm91dGVzIHdpdGggcmVkaXJlY3RUbyBiZWNhdXNlIHdlIGFyZSB0cnlpbmcgdG8gY3JlYXRlIGFjdGl2YXRlZCByb3V0ZVxuICAgICAgICAgIC8vIHNuYXBzaG90cyBhbmQgZG9uJ3QgaGFuZGxlIHJlZGlyZWN0cyBoZXJlLiBUaGF0IHNob3VsZCBoYXZlIGJlZW4gZG9uZSBpblxuICAgICAgICAgIC8vIGBhcHBseVJlZGlyZWN0c2AuXG4gICAgICAgICAgY2hpbGRDb25maWcuZmlsdGVyKGMgPT4gYy5yZWRpcmVjdFRvID09PSB1bmRlZmluZWQpLCB0aGlzLnJlbGF0aXZlTGlua1Jlc29sdXRpb24pO1xuXG4gICAgICBpZiAoc2xpY2VkU2VnbWVudHMubGVuZ3RoID09PSAwICYmIHNlZ21lbnRHcm91cC5oYXNDaGlsZHJlbigpKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnByb2Nlc3NDaGlsZHJlbihjaGlsZEluamVjdG9yLCBjaGlsZENvbmZpZywgc2VnbWVudEdyb3VwKS5waXBlKG1hcChjaGlsZHJlbiA9PiB7XG4gICAgICAgICAgaWYgKGNoaWxkcmVuID09PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIFtuZXcgVHJlZU5vZGU8QWN0aXZhdGVkUm91dGVTbmFwc2hvdD4oc25hcHNob3QsIGNoaWxkcmVuKV07XG4gICAgICAgIH0pKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGNoaWxkQ29uZmlnLmxlbmd0aCA9PT0gMCAmJiBzbGljZWRTZWdtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIG9mKFtuZXcgVHJlZU5vZGU8QWN0aXZhdGVkUm91dGVTbmFwc2hvdD4oc25hcHNob3QsIFtdKV0pO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBtYXRjaGVkT25PdXRsZXQgPSBnZXRPdXRsZXQocm91dGUpID09PSBvdXRsZXQ7XG4gICAgICAvLyBJZiB3ZSBtYXRjaGVkIGEgY29uZmlnIGR1ZSB0byBlbXB0eSBwYXRoIG1hdGNoIG9uIGEgZGlmZmVyZW50IG91dGxldCwgd2UgbmVlZCB0b1xuICAgICAgLy8gY29udGludWUgcGFzc2luZyB0aGUgY3VycmVudCBvdXRsZXQgZm9yIHRoZSBzZWdtZW50IHJhdGhlciB0aGFuIHN3aXRjaCB0byBQUklNQVJZLlxuICAgICAgLy8gTm90ZSB0aGF0IHdlIHN3aXRjaCB0byBwcmltYXJ5IHdoZW4gd2UgaGF2ZSBhIG1hdGNoIGJlY2F1c2Ugb3V0bGV0IGNvbmZpZ3MgbG9vayBsaWtlXG4gICAgICAvLyB0aGlzOiB7cGF0aDogJ2EnLCBvdXRsZXQ6ICdhJywgY2hpbGRyZW46IFtcbiAgICAgIC8vICB7cGF0aDogJ2InLCBjb21wb25lbnQ6IEJ9LFxuICAgICAgLy8gIHtwYXRoOiAnYycsIGNvbXBvbmVudDogQ30sXG4gICAgICAvLyBdfVxuICAgICAgLy8gTm90aWNlIHRoYXQgdGhlIGNoaWxkcmVuIG9mIHRoZSBuYW1lZCBvdXRsZXQgYXJlIGNvbmZpZ3VyZWQgd2l0aCB0aGUgcHJpbWFyeSBvdXRsZXRcbiAgICAgIHJldHVybiB0aGlzXG4gICAgICAgICAgLnByb2Nlc3NTZWdtZW50KFxuICAgICAgICAgICAgICBjaGlsZEluamVjdG9yLCBjaGlsZENvbmZpZywgc2VnbWVudEdyb3VwLCBzbGljZWRTZWdtZW50cyxcbiAgICAgICAgICAgICAgbWF0Y2hlZE9uT3V0bGV0ID8gUFJJTUFSWV9PVVRMRVQgOiBvdXRsZXQpXG4gICAgICAgICAgLnBpcGUobWFwKGNoaWxkcmVuID0+IHtcbiAgICAgICAgICAgIGlmIChjaGlsZHJlbiA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBbbmV3IFRyZWVOb2RlPEFjdGl2YXRlZFJvdXRlU25hcHNob3Q+KHNuYXBzaG90LCBjaGlsZHJlbildO1xuICAgICAgICAgIH0pKTtcbiAgICB9KSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc29ydEFjdGl2YXRlZFJvdXRlU25hcHNob3RzKG5vZGVzOiBUcmVlTm9kZTxBY3RpdmF0ZWRSb3V0ZVNuYXBzaG90PltdKTogdm9pZCB7XG4gIG5vZGVzLnNvcnQoKGEsIGIpID0+IHtcbiAgICBpZiAoYS52YWx1ZS5vdXRsZXQgPT09IFBSSU1BUllfT1VUTEVUKSByZXR1cm4gLTE7XG4gICAgaWYgKGIudmFsdWUub3V0bGV0ID09PSBQUklNQVJZX09VVExFVCkgcmV0dXJuIDE7XG4gICAgcmV0dXJuIGEudmFsdWUub3V0bGV0LmxvY2FsZUNvbXBhcmUoYi52YWx1ZS5vdXRsZXQpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gZ2V0Q2hpbGRDb25maWcocm91dGU6IFJvdXRlKTogUm91dGVbXSB7XG4gIGlmIChyb3V0ZS5jaGlsZHJlbikge1xuICAgIHJldHVybiByb3V0ZS5jaGlsZHJlbjtcbiAgfVxuXG4gIGlmIChyb3V0ZS5sb2FkQ2hpbGRyZW4pIHtcbiAgICByZXR1cm4gcm91dGUuX2xvYWRlZFJvdXRlcyE7XG4gIH1cblxuICByZXR1cm4gW107XG59XG5cbmZ1bmN0aW9uIGhhc0VtcHR5UGF0aENvbmZpZyhub2RlOiBUcmVlTm9kZTxBY3RpdmF0ZWRSb3V0ZVNuYXBzaG90Pikge1xuICBjb25zdCBjb25maWcgPSBub2RlLnZhbHVlLnJvdXRlQ29uZmlnO1xuICByZXR1cm4gY29uZmlnICYmIGNvbmZpZy5wYXRoID09PSAnJyAmJiBjb25maWcucmVkaXJlY3RUbyA9PT0gdW5kZWZpbmVkO1xufVxuXG4vKipcbiAqIEZpbmRzIGBUcmVlTm9kZWBzIHdpdGggbWF0Y2hpbmcgZW1wdHkgcGF0aCByb3V0ZSBjb25maWdzIGFuZCBtZXJnZXMgdGhlbSBpbnRvIGBUcmVlTm9kZWAgd2l0aFxuICogdGhlIGNoaWxkcmVuIGZyb20gZWFjaCBkdXBsaWNhdGUuIFRoaXMgaXMgbmVjZXNzYXJ5IGJlY2F1c2UgZGlmZmVyZW50IG91dGxldHMgY2FuIG1hdGNoIGFcbiAqIHNpbmdsZSBlbXB0eSBwYXRoIHJvdXRlIGNvbmZpZyBhbmQgdGhlIHJlc3VsdHMgbmVlZCB0byB0aGVuIGJlIG1lcmdlZC5cbiAqL1xuZnVuY3Rpb24gbWVyZ2VFbXB0eVBhdGhNYXRjaGVzKG5vZGVzOiBBcnJheTxUcmVlTm9kZTxBY3RpdmF0ZWRSb3V0ZVNuYXBzaG90Pj4pOlxuICAgIEFycmF5PFRyZWVOb2RlPEFjdGl2YXRlZFJvdXRlU25hcHNob3Q+PiB7XG4gIGNvbnN0IHJlc3VsdDogQXJyYXk8VHJlZU5vZGU8QWN0aXZhdGVkUm91dGVTbmFwc2hvdD4+ID0gW107XG4gIC8vIFRoZSBzZXQgb2Ygbm9kZXMgd2hpY2ggY29udGFpbiBjaGlsZHJlbiB0aGF0IHdlcmUgbWVyZ2VkIGZyb20gdHdvIGR1cGxpY2F0ZSBlbXB0eSBwYXRoIG5vZGVzLlxuICBjb25zdCBtZXJnZWROb2RlczogU2V0PFRyZWVOb2RlPEFjdGl2YXRlZFJvdXRlU25hcHNob3Q+PiA9IG5ldyBTZXQoKTtcblxuICBmb3IgKGNvbnN0IG5vZGUgb2Ygbm9kZXMpIHtcbiAgICBpZiAoIWhhc0VtcHR5UGF0aENvbmZpZyhub2RlKSkge1xuICAgICAgcmVzdWx0LnB1c2gobm9kZSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBkdXBsaWNhdGVFbXB0eVBhdGhOb2RlID1cbiAgICAgICAgcmVzdWx0LmZpbmQocmVzdWx0Tm9kZSA9PiBub2RlLnZhbHVlLnJvdXRlQ29uZmlnID09PSByZXN1bHROb2RlLnZhbHVlLnJvdXRlQ29uZmlnKTtcbiAgICBpZiAoZHVwbGljYXRlRW1wdHlQYXRoTm9kZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBkdXBsaWNhdGVFbXB0eVBhdGhOb2RlLmNoaWxkcmVuLnB1c2goLi4ubm9kZS5jaGlsZHJlbik7XG4gICAgICBtZXJnZWROb2Rlcy5hZGQoZHVwbGljYXRlRW1wdHlQYXRoTm9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdC5wdXNoKG5vZGUpO1xuICAgIH1cbiAgfVxuICAvLyBGb3IgZWFjaCBub2RlIHdoaWNoIGhhcyBjaGlsZHJlbiBmcm9tIG11bHRpcGxlIHNvdXJjZXMsIHdlIG5lZWQgdG8gcmVjb21wdXRlIGEgbmV3IGBUcmVlTm9kZWBcbiAgLy8gYnkgYWxzbyBtZXJnaW5nIHRob3NlIGNoaWxkcmVuLiBUaGlzIGlzIG5lY2Vzc2FyeSB3aGVuIHRoZXJlIGFyZSBtdWx0aXBsZSBlbXB0eSBwYXRoIGNvbmZpZ3NcbiAgLy8gaW4gYSByb3cuIFB1dCBhbm90aGVyIHdheTogd2hlbmV2ZXIgd2UgY29tYmluZSBjaGlsZHJlbiBvZiB0d28gbm9kZXMsIHdlIG5lZWQgdG8gYWxzbyBjaGVja1xuICAvLyBpZiBhbnkgb2YgdGhvc2UgY2hpbGRyZW4gY2FuIGJlIGNvbWJpbmVkIGludG8gYSBzaW5nbGUgbm9kZSBhcyB3ZWxsLlxuICBmb3IgKGNvbnN0IG1lcmdlZE5vZGUgb2YgbWVyZ2VkTm9kZXMpIHtcbiAgICBjb25zdCBtZXJnZWRDaGlsZHJlbiA9IG1lcmdlRW1wdHlQYXRoTWF0Y2hlcyhtZXJnZWROb2RlLmNoaWxkcmVuKTtcbiAgICByZXN1bHQucHVzaChuZXcgVHJlZU5vZGUobWVyZ2VkTm9kZS52YWx1ZSwgbWVyZ2VkQ2hpbGRyZW4pKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0LmZpbHRlcihuID0+ICFtZXJnZWROb2Rlcy5oYXMobikpO1xufVxuXG5mdW5jdGlvbiBjaGVja091dGxldE5hbWVVbmlxdWVuZXNzKG5vZGVzOiBUcmVlTm9kZTxBY3RpdmF0ZWRSb3V0ZVNuYXBzaG90PltdKTogdm9pZCB7XG4gIGNvbnN0IG5hbWVzOiB7W2s6IHN0cmluZ106IEFjdGl2YXRlZFJvdXRlU25hcHNob3R9ID0ge307XG4gIG5vZGVzLmZvckVhY2gobiA9PiB7XG4gICAgY29uc3Qgcm91dGVXaXRoU2FtZU91dGxldE5hbWUgPSBuYW1lc1tuLnZhbHVlLm91dGxldF07XG4gICAgaWYgKHJvdXRlV2l0aFNhbWVPdXRsZXROYW1lKSB7XG4gICAgICBjb25zdCBwID0gcm91dGVXaXRoU2FtZU91dGxldE5hbWUudXJsLm1hcChzID0+IHMudG9TdHJpbmcoKSkuam9pbignLycpO1xuICAgICAgY29uc3QgYyA9IG4udmFsdWUudXJsLm1hcChzID0+IHMudG9TdHJpbmcoKSkuam9pbignLycpO1xuICAgICAgdGhyb3cgbmV3IFJ1bnRpbWVFcnJvcihcbiAgICAgICAgICBSdW50aW1lRXJyb3JDb2RlLlRXT19TRUdNRU5UU19XSVRIX1NBTUVfT1VUTEVULFxuICAgICAgICAgIE5HX0RFVl9NT0RFICYmIGBUd28gc2VnbWVudHMgY2Fubm90IGhhdmUgdGhlIHNhbWUgb3V0bGV0IG5hbWU6ICcke3B9JyBhbmQgJyR7Y30nLmApO1xuICAgIH1cbiAgICBuYW1lc1tuLnZhbHVlLm91dGxldF0gPSBuLnZhbHVlO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gZ2V0U291cmNlU2VnbWVudEdyb3VwKHNlZ21lbnRHcm91cDogVXJsU2VnbWVudEdyb3VwKTogVXJsU2VnbWVudEdyb3VwIHtcbiAgbGV0IHMgPSBzZWdtZW50R3JvdXA7XG4gIHdoaWxlIChzLl9zb3VyY2VTZWdtZW50KSB7XG4gICAgcyA9IHMuX3NvdXJjZVNlZ21lbnQ7XG4gIH1cbiAgcmV0dXJuIHM7XG59XG5cbmZ1bmN0aW9uIGdldFBhdGhJbmRleFNoaWZ0KHNlZ21lbnRHcm91cDogVXJsU2VnbWVudEdyb3VwKTogbnVtYmVyIHtcbiAgbGV0IHMgPSBzZWdtZW50R3JvdXA7XG4gIGxldCByZXMgPSBzLl9zZWdtZW50SW5kZXhTaGlmdCA/PyAwO1xuICB3aGlsZSAocy5fc291cmNlU2VnbWVudCkge1xuICAgIHMgPSBzLl9zb3VyY2VTZWdtZW50O1xuICAgIHJlcyArPSBzLl9zZWdtZW50SW5kZXhTaGlmdCA/PyAwO1xuICB9XG4gIHJldHVybiByZXMgLSAxO1xufVxuXG5mdW5jdGlvbiBnZXRDb3JyZWN0ZWRQYXRoSW5kZXhTaGlmdChzZWdtZW50R3JvdXA6IFVybFNlZ21lbnRHcm91cCk6IG51bWJlciB7XG4gIGxldCBzID0gc2VnbWVudEdyb3VwO1xuICBsZXQgcmVzID0gcy5fc2VnbWVudEluZGV4U2hpZnRDb3JyZWN0ZWQgPz8gcy5fc2VnbWVudEluZGV4U2hpZnQgPz8gMDtcbiAgd2hpbGUgKHMuX3NvdXJjZVNlZ21lbnQpIHtcbiAgICBzID0gcy5fc291cmNlU2VnbWVudDtcbiAgICByZXMgKz0gcy5fc2VnbWVudEluZGV4U2hpZnRDb3JyZWN0ZWQgPz8gcy5fc2VnbWVudEluZGV4U2hpZnQgPz8gMDtcbiAgfVxuICByZXR1cm4gcmVzIC0gMTtcbn1cblxuZnVuY3Rpb24gZ2V0RGF0YShyb3V0ZTogUm91dGUpOiBEYXRhIHtcbiAgcmV0dXJuIHJvdXRlLmRhdGEgfHwge307XG59XG5cbmZ1bmN0aW9uIGdldFJlc29sdmUocm91dGU6IFJvdXRlKTogUmVzb2x2ZURhdGEge1xuICByZXR1cm4gcm91dGUucmVzb2x2ZSB8fCB7fTtcbn1cbiJdfQ==
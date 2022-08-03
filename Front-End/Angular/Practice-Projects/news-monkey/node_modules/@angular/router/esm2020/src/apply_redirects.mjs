/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ɵRuntimeError as RuntimeError } from '@angular/core';
import { EmptyError, from, of, throwError } from 'rxjs';
import { catchError, concatMap, first, last, map, mergeMap, scan, switchMap, tap } from 'rxjs/operators';
import { navigationCancelingError } from './navigation_canceling_error';
import { runCanLoadGuards } from './operators/check_guards';
import { PRIMARY_OUTLET } from './shared';
import { createRoot, squashSegmentGroup, UrlSegmentGroup, UrlTree } from './url_tree';
import { forEach } from './utils/collection';
import { getOrCreateRouteInjectorIfNeeded, getOutlet, sortByMatchingOutlets } from './utils/config';
import { isImmediateMatch, match, matchWithChecks, noLeftoversInUrl, split } from './utils/config_matching';
const NG_DEV_MODE = typeof ngDevMode === 'undefined' || ngDevMode;
class NoMatch {
    constructor(segmentGroup) {
        this.segmentGroup = segmentGroup || null;
    }
}
class AbsoluteRedirect {
    constructor(urlTree) {
        this.urlTree = urlTree;
    }
}
function noMatch(segmentGroup) {
    return throwError(new NoMatch(segmentGroup));
}
function absoluteRedirect(newTree) {
    return throwError(new AbsoluteRedirect(newTree));
}
function namedOutletsRedirect(redirectTo) {
    return throwError(new RuntimeError(4000 /* RuntimeErrorCode.NAMED_OUTLET_REDIRECT */, NG_DEV_MODE &&
        `Only absolute redirects can have named outlets. redirectTo: '${redirectTo}'`));
}
function canLoadFails(route) {
    return throwError(navigationCancelingError(NG_DEV_MODE &&
        `Cannot load children because the guard of the route "path: '${route.path}'" returned false`, 3 /* NavigationCancellationCode.GuardRejected */));
}
/**
 * Returns the `UrlTree` with the redirection applied.
 *
 * Lazy modules are loaded along the way.
 */
export function applyRedirects(injector, configLoader, urlSerializer, urlTree, config) {
    return new ApplyRedirects(injector, configLoader, urlSerializer, urlTree, config).apply();
}
class ApplyRedirects {
    constructor(injector, configLoader, urlSerializer, urlTree, config) {
        this.injector = injector;
        this.configLoader = configLoader;
        this.urlSerializer = urlSerializer;
        this.urlTree = urlTree;
        this.config = config;
        this.allowRedirects = true;
    }
    apply() {
        const splitGroup = split(this.urlTree.root, [], [], this.config).segmentGroup;
        // TODO(atscott): creating a new segment removes the _sourceSegment _segmentIndexShift, which is
        // only necessary to prevent failures in tests which assert exact object matches. The `split` is
        // now shared between `applyRedirects` and `recognize` but only the `recognize` step needs these
        // properties. Before the implementations were merged, the `applyRedirects` would not assign
        // them. We should be able to remove this logic as a "breaking change" but should do some more
        // investigation into the failures first.
        const rootSegmentGroup = new UrlSegmentGroup(splitGroup.segments, splitGroup.children);
        const expanded$ = this.expandSegmentGroup(this.injector, this.config, rootSegmentGroup, PRIMARY_OUTLET);
        const urlTrees$ = expanded$.pipe(map((rootSegmentGroup) => {
            return this.createUrlTree(squashSegmentGroup(rootSegmentGroup), this.urlTree.queryParams, this.urlTree.fragment);
        }));
        return urlTrees$.pipe(catchError((e) => {
            if (e instanceof AbsoluteRedirect) {
                // After an absolute redirect we do not apply any more redirects!
                // If this implementation changes, update the documentation note in `redirectTo`.
                this.allowRedirects = false;
                // we need to run matching, so we can fetch all lazy-loaded modules
                return this.match(e.urlTree);
            }
            if (e instanceof NoMatch) {
                throw this.noMatchError(e);
            }
            throw e;
        }));
    }
    match(tree) {
        const expanded$ = this.expandSegmentGroup(this.injector, this.config, tree.root, PRIMARY_OUTLET);
        const mapped$ = expanded$.pipe(map((rootSegmentGroup) => {
            return this.createUrlTree(squashSegmentGroup(rootSegmentGroup), tree.queryParams, tree.fragment);
        }));
        return mapped$.pipe(catchError((e) => {
            if (e instanceof NoMatch) {
                throw this.noMatchError(e);
            }
            throw e;
        }));
    }
    noMatchError(e) {
        return new RuntimeError(4002 /* RuntimeErrorCode.NO_MATCH */, NG_DEV_MODE && `Cannot match any routes. URL Segment: '${e.segmentGroup}'`);
    }
    createUrlTree(rootCandidate, queryParams, fragment) {
        const root = createRoot(rootCandidate);
        return new UrlTree(root, queryParams, fragment);
    }
    expandSegmentGroup(injector, routes, segmentGroup, outlet) {
        if (segmentGroup.segments.length === 0 && segmentGroup.hasChildren()) {
            return this.expandChildren(injector, routes, segmentGroup)
                .pipe(map((children) => new UrlSegmentGroup([], children)));
        }
        return this.expandSegment(injector, segmentGroup, routes, segmentGroup.segments, outlet, true);
    }
    // Recursively expand segment groups for all the child outlets
    expandChildren(injector, routes, segmentGroup) {
        // Expand outlets one at a time, starting with the primary outlet. We need to do it this way
        // because an absolute redirect from the primary outlet takes precedence.
        const childOutlets = [];
        for (const child of Object.keys(segmentGroup.children)) {
            if (child === 'primary') {
                childOutlets.unshift(child);
            }
            else {
                childOutlets.push(child);
            }
        }
        return from(childOutlets)
            .pipe(concatMap(childOutlet => {
            const child = segmentGroup.children[childOutlet];
            // Sort the routes so routes with outlets that match the segment appear
            // first, followed by routes for other outlets, which might match if they have an
            // empty path.
            const sortedRoutes = sortByMatchingOutlets(routes, childOutlet);
            return this.expandSegmentGroup(injector, sortedRoutes, child, childOutlet)
                .pipe(map(s => ({ segment: s, outlet: childOutlet })));
        }), scan((children, expandedChild) => {
            children[expandedChild.outlet] = expandedChild.segment;
            return children;
        }, {}), last());
    }
    expandSegment(injector, segmentGroup, routes, segments, outlet, allowRedirects) {
        return from(routes).pipe(concatMap(r => {
            const expanded$ = this.expandSegmentAgainstRoute(injector, segmentGroup, routes, r, segments, outlet, allowRedirects);
            return expanded$.pipe(catchError((e) => {
                if (e instanceof NoMatch) {
                    return of(null);
                }
                throw e;
            }));
        }), first((s) => !!s), catchError((e, _) => {
            if (e instanceof EmptyError || e.name === 'EmptyError') {
                if (noLeftoversInUrl(segmentGroup, segments, outlet)) {
                    return of(new UrlSegmentGroup([], {}));
                }
                return noMatch(segmentGroup);
            }
            throw e;
        }));
    }
    expandSegmentAgainstRoute(injector, segmentGroup, routes, route, paths, outlet, allowRedirects) {
        if (!isImmediateMatch(route, segmentGroup, paths, outlet)) {
            return noMatch(segmentGroup);
        }
        if (route.redirectTo === undefined) {
            return this.matchSegmentAgainstRoute(injector, segmentGroup, route, paths, outlet);
        }
        if (allowRedirects && this.allowRedirects) {
            return this.expandSegmentAgainstRouteUsingRedirect(injector, segmentGroup, routes, route, paths, outlet);
        }
        return noMatch(segmentGroup);
    }
    expandSegmentAgainstRouteUsingRedirect(injector, segmentGroup, routes, route, segments, outlet) {
        if (route.path === '**') {
            return this.expandWildCardWithParamsAgainstRouteUsingRedirect(injector, routes, route, outlet);
        }
        return this.expandRegularSegmentAgainstRouteUsingRedirect(injector, segmentGroup, routes, route, segments, outlet);
    }
    expandWildCardWithParamsAgainstRouteUsingRedirect(injector, routes, route, outlet) {
        const newTree = this.applyRedirectCommands([], route.redirectTo, {});
        if (route.redirectTo.startsWith('/')) {
            return absoluteRedirect(newTree);
        }
        return this.lineralizeSegments(route, newTree).pipe(mergeMap((newSegments) => {
            const group = new UrlSegmentGroup(newSegments, {});
            return this.expandSegment(injector, group, routes, newSegments, outlet, false);
        }));
    }
    expandRegularSegmentAgainstRouteUsingRedirect(injector, segmentGroup, routes, route, segments, outlet) {
        const { matched, consumedSegments, remainingSegments, positionalParamSegments } = match(segmentGroup, route, segments);
        if (!matched)
            return noMatch(segmentGroup);
        const newTree = this.applyRedirectCommands(consumedSegments, route.redirectTo, positionalParamSegments);
        if (route.redirectTo.startsWith('/')) {
            return absoluteRedirect(newTree);
        }
        return this.lineralizeSegments(route, newTree).pipe(mergeMap((newSegments) => {
            return this.expandSegment(injector, segmentGroup, routes, newSegments.concat(remainingSegments), outlet, false);
        }));
    }
    matchSegmentAgainstRoute(injector, rawSegmentGroup, route, segments, outlet) {
        if (route.path === '**') {
            // Only create the Route's `EnvironmentInjector` if it matches the attempted navigation
            injector = getOrCreateRouteInjectorIfNeeded(route, injector);
            if (route.loadChildren) {
                const loaded$ = route._loadedRoutes ?
                    of({ routes: route._loadedRoutes, injector: route._loadedInjector }) :
                    this.configLoader.loadChildren(injector, route);
                return loaded$.pipe(map((cfg) => {
                    route._loadedRoutes = cfg.routes;
                    route._loadedInjector = cfg.injector;
                    return new UrlSegmentGroup(segments, {});
                }));
            }
            return of(new UrlSegmentGroup(segments, {}));
        }
        return matchWithChecks(rawSegmentGroup, route, segments, injector, this.urlSerializer)
            .pipe(switchMap(({ matched, consumedSegments, remainingSegments }) => {
            if (!matched)
                return noMatch(rawSegmentGroup);
            // If the route has an injector created from providers, we should start using that.
            injector = route._injector ?? injector;
            const childConfig$ = this.getChildConfig(injector, route, segments);
            return childConfig$.pipe(mergeMap((routerConfig) => {
                const childInjector = routerConfig.injector ?? injector;
                const childConfig = routerConfig.routes;
                const { segmentGroup: splitSegmentGroup, slicedSegments } = split(rawSegmentGroup, consumedSegments, remainingSegments, childConfig);
                // See comment on the other call to `split` about why this is necessary.
                const segmentGroup = new UrlSegmentGroup(splitSegmentGroup.segments, splitSegmentGroup.children);
                if (slicedSegments.length === 0 && segmentGroup.hasChildren()) {
                    const expanded$ = this.expandChildren(childInjector, childConfig, segmentGroup);
                    return expanded$.pipe(map((children) => new UrlSegmentGroup(consumedSegments, children)));
                }
                if (childConfig.length === 0 && slicedSegments.length === 0) {
                    return of(new UrlSegmentGroup(consumedSegments, {}));
                }
                const matchedOnOutlet = getOutlet(route) === outlet;
                const expanded$ = this.expandSegment(childInjector, segmentGroup, childConfig, slicedSegments, matchedOnOutlet ? PRIMARY_OUTLET : outlet, true);
                return expanded$.pipe(map((cs) => new UrlSegmentGroup(consumedSegments.concat(cs.segments), cs.children)));
            }));
        }));
    }
    getChildConfig(injector, route, segments) {
        if (route.children) {
            // The children belong to the same module
            return of({ routes: route.children, injector });
        }
        if (route.loadChildren) {
            // lazy children belong to the loaded module
            if (route._loadedRoutes !== undefined) {
                return of({ routes: route._loadedRoutes, injector: route._loadedInjector });
            }
            return runCanLoadGuards(injector, route, segments, this.urlSerializer)
                .pipe(mergeMap((shouldLoadResult) => {
                if (shouldLoadResult) {
                    return this.configLoader.loadChildren(injector, route)
                        .pipe(tap((cfg) => {
                        route._loadedRoutes = cfg.routes;
                        route._loadedInjector = cfg.injector;
                    }));
                }
                return canLoadFails(route);
            }));
        }
        return of({ routes: [], injector });
    }
    lineralizeSegments(route, urlTree) {
        let res = [];
        let c = urlTree.root;
        while (true) {
            res = res.concat(c.segments);
            if (c.numberOfChildren === 0) {
                return of(res);
            }
            if (c.numberOfChildren > 1 || !c.children[PRIMARY_OUTLET]) {
                return namedOutletsRedirect(route.redirectTo);
            }
            c = c.children[PRIMARY_OUTLET];
        }
    }
    applyRedirectCommands(segments, redirectTo, posParams) {
        return this.applyRedirectCreateUrlTree(redirectTo, this.urlSerializer.parse(redirectTo), segments, posParams);
    }
    applyRedirectCreateUrlTree(redirectTo, urlTree, segments, posParams) {
        const newRoot = this.createSegmentGroup(redirectTo, urlTree.root, segments, posParams);
        return new UrlTree(newRoot, this.createQueryParams(urlTree.queryParams, this.urlTree.queryParams), urlTree.fragment);
    }
    createQueryParams(redirectToParams, actualParams) {
        const res = {};
        forEach(redirectToParams, (v, k) => {
            const copySourceValue = typeof v === 'string' && v.startsWith(':');
            if (copySourceValue) {
                const sourceName = v.substring(1);
                res[k] = actualParams[sourceName];
            }
            else {
                res[k] = v;
            }
        });
        return res;
    }
    createSegmentGroup(redirectTo, group, segments, posParams) {
        const updatedSegments = this.createSegments(redirectTo, group.segments, segments, posParams);
        let children = {};
        forEach(group.children, (child, name) => {
            children[name] = this.createSegmentGroup(redirectTo, child, segments, posParams);
        });
        return new UrlSegmentGroup(updatedSegments, children);
    }
    createSegments(redirectTo, redirectToSegments, actualSegments, posParams) {
        return redirectToSegments.map(s => s.path.startsWith(':') ? this.findPosParam(redirectTo, s, posParams) :
            this.findOrReturn(s, actualSegments));
    }
    findPosParam(redirectTo, redirectToUrlSegment, posParams) {
        const pos = posParams[redirectToUrlSegment.path.substring(1)];
        if (!pos)
            throw new RuntimeError(4001 /* RuntimeErrorCode.MISSING_REDIRECT */, NG_DEV_MODE &&
                `Cannot redirect to '${redirectTo}'. Cannot find '${redirectToUrlSegment.path}'.`);
        return pos;
    }
    findOrReturn(redirectToUrlSegment, actualSegments) {
        let idx = 0;
        for (const s of actualSegments) {
            if (s.path === redirectToUrlSegment.path) {
                actualSegments.splice(idx);
                return s;
            }
            idx++;
        }
        return redirectToUrlSegment;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbHlfcmVkaXJlY3RzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvcm91dGVyL3NyYy9hcHBseV9yZWRpcmVjdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFzQixhQUFhLElBQUksWUFBWSxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBQ2pGLE9BQU8sRUFBQyxVQUFVLEVBQUUsSUFBSSxFQUFjLEVBQUUsRUFBRSxVQUFVLEVBQUMsTUFBTSxNQUFNLENBQUM7QUFDbEUsT0FBTyxFQUFDLFVBQVUsRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFLdkcsT0FBTyxFQUFDLHdCQUF3QixFQUFDLE1BQU0sOEJBQThCLENBQUM7QUFDdEUsT0FBTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFFMUQsT0FBTyxFQUFTLGNBQWMsRUFBQyxNQUFNLFVBQVUsQ0FBQztBQUNoRCxPQUFPLEVBQUMsVUFBVSxFQUFFLGtCQUFrQixFQUFjLGVBQWUsRUFBaUIsT0FBTyxFQUFDLE1BQU0sWUFBWSxDQUFDO0FBQy9HLE9BQU8sRUFBQyxPQUFPLEVBQUMsTUFBTSxvQkFBb0IsQ0FBQztBQUMzQyxPQUFPLEVBQUMsZ0NBQWdDLEVBQUUsU0FBUyxFQUFFLHFCQUFxQixFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFDbEcsT0FBTyxFQUFDLGdCQUFnQixFQUFFLEtBQUssRUFBRSxlQUFlLEVBQUUsZ0JBQWdCLEVBQUUsS0FBSyxFQUFDLE1BQU0seUJBQXlCLENBQUM7QUFFMUcsTUFBTSxXQUFXLEdBQUcsT0FBTyxTQUFTLEtBQUssV0FBVyxJQUFJLFNBQVMsQ0FBQztBQUVsRSxNQUFNLE9BQU87SUFHWCxZQUFZLFlBQThC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QUF1QixVQUFVLG1CQUFtQixvQkFBb0IsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDO1FBQzdGLE9BQU8sR0FBRyxDQUFDO0lBQ2IsQ0FBQztJQUVPLFlBQVksQ0FBQyxvQkFBZ0MsRUFBRSxjQUE0QjtRQUNqRixJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUM7UUFDWixLQUFLLE1BQU0sQ0FBQyxJQUFJLGNBQWMsRUFBRTtZQUM5QixJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssb0JBQW9CLENBQUMsSUFBSSxFQUFFO2dCQUN4QyxjQUFjLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUMzQixPQUFPLENBQUMsQ0FBQzthQUNWO1lBQ0QsR0FBRyxFQUFFLENBQUM7U0FDUDtRQUNELE9BQU8sb0JBQW9CLENBQUM7SUFDOUIsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7RW52aXJvbm1lbnRJbmplY3RvciwgybVSdW50aW1lRXJyb3IgYXMgUnVudGltZUVycm9yfSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7RW1wdHlFcnJvciwgZnJvbSwgT2JzZXJ2YWJsZSwgb2YsIHRocm93RXJyb3J9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHtjYXRjaEVycm9yLCBjb25jYXRNYXAsIGZpcnN0LCBsYXN0LCBtYXAsIG1lcmdlTWFwLCBzY2FuLCBzd2l0Y2hNYXAsIHRhcH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuXG5pbXBvcnQge1J1bnRpbWVFcnJvckNvZGV9IGZyb20gJy4vZXJyb3JzJztcbmltcG9ydCB7TmF2aWdhdGlvbkNhbmNlbGxhdGlvbkNvZGV9IGZyb20gJy4vZXZlbnRzJztcbmltcG9ydCB7TG9hZGVkUm91dGVyQ29uZmlnLCBSb3V0ZSwgUm91dGVzfSBmcm9tICcuL21vZGVscyc7XG5pbXBvcnQge25hdmlnYXRpb25DYW5jZWxpbmdFcnJvcn0gZnJvbSAnLi9uYXZpZ2F0aW9uX2NhbmNlbGluZ19lcnJvcic7XG5pbXBvcnQge3J1bkNhbkxvYWRHdWFyZHN9IGZyb20gJy4vb3BlcmF0b3JzL2NoZWNrX2d1YXJkcyc7XG5pbXBvcnQge1JvdXRlckNvbmZpZ0xvYWRlcn0gZnJvbSAnLi9yb3V0ZXJfY29uZmlnX2xvYWRlcic7XG5pbXBvcnQge1BhcmFtcywgUFJJTUFSWV9PVVRMRVR9IGZyb20gJy4vc2hhcmVkJztcbmltcG9ydCB7Y3JlYXRlUm9vdCwgc3F1YXNoU2VnbWVudEdyb3VwLCBVcmxTZWdtZW50LCBVcmxTZWdtZW50R3JvdXAsIFVybFNlcmlhbGl6ZXIsIFVybFRyZWV9IGZyb20gJy4vdXJsX3RyZWUnO1xuaW1wb3J0IHtmb3JFYWNofSBmcm9tICcuL3V0aWxzL2NvbGxlY3Rpb24nO1xuaW1wb3J0IHtnZXRPckNyZWF0ZVJvdXRlSW5qZWN0b3JJZk5lZWRlZCwgZ2V0T3V0bGV0LCBzb3J0QnlNYXRjaGluZ091dGxldHN9IGZyb20gJy4vdXRpbHMvY29uZmlnJztcbmltcG9ydCB7aXNJbW1lZGlhdGVNYXRjaCwgbWF0Y2gsIG1hdGNoV2l0aENoZWNrcywgbm9MZWZ0b3ZlcnNJblVybCwgc3BsaXR9IGZyb20gJy4vdXRpbHMvY29uZmlnX21hdGNoaW5nJztcblxuY29uc3QgTkdfREVWX01PREUgPSB0eXBlb2YgbmdEZXZNb2RlID09PSAndW5kZWZpbmVkJyB8fCBuZ0Rldk1vZGU7XG5cbmNsYXNzIE5vTWF0Y2gge1xuICBwdWJsaWMgc2VnbWVudEdyb3VwOiBVcmxTZWdtZW50R3JvdXB8bnVsbDtcblxuICBjb25zdHJ1Y3RvcihzZWdtZW50R3JvdXA/OiBVcmxTZWdtZW50R3JvdXApIHtcbiAgICB0aGlzLnNlZ21lbnRHcm91cCA9IHNlZ21lbnRHcm91cCB8fCBudWxsO1xuICB9XG59XG5cbmNsYXNzIEFic29sdXRlUmVkaXJlY3Qge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdXJsVHJlZTogVXJsVHJlZSkge31cbn1cblxuZnVuY3Rpb24gbm9NYXRjaChzZWdtZW50R3JvdXA6IFVybFNlZ21lbnRHcm91cCk6IE9ic2VydmFibGU8VXJsU2VnbWVudEdyb3VwPiB7XG4gIHJldHVybiB0aHJvd0Vycm9yKG5ldyBOb01hdGNoKHNlZ21lbnRHcm91cCkpO1xufVxuXG5mdW5jdGlvbiBhYnNvbHV0ZVJlZGlyZWN0KG5ld1RyZWU6IFVybFRyZWUpOiBPYnNlcnZhYmxlPGFueT4ge1xuICByZXR1cm4gdGhyb3dFcnJvcihuZXcgQWJzb2x1dGVSZWRpcmVjdChuZXdUcmVlKSk7XG59XG5cbmZ1bmN0aW9uIG5hbWVkT3V0bGV0c1JlZGlyZWN0KHJlZGlyZWN0VG86IHN0cmluZyk6IE9ic2VydmFibGU8YW55PiB7XG4gIHJldHVybiB0aHJvd0Vycm9yKG5ldyBSdW50aW1lRXJyb3IoXG4gICAgICBSdW50aW1lRXJyb3JDb2RlLk5BTUVEX09VVExFVF9SRURJUkVDVCxcbiAgICAgIE5HX0RFVl9NT0RFICYmXG4gICAgICAgICAgYE9ubHkgYWJzb2x1dGUgcmVkaXJlY3RzIGNhbiBoYXZlIG5hbWVkIG91dGxldHMuIHJlZGlyZWN0VG86ICcke3JlZGlyZWN0VG99J2ApKTtcbn1cblxuZnVuY3Rpb24gY2FuTG9hZEZhaWxzKHJvdXRlOiBSb3V0ZSk6IE9ic2VydmFibGU8TG9hZGVkUm91dGVyQ29uZmlnPiB7XG4gIHJldHVybiB0aHJvd0Vycm9yKG5hdmlnYXRpb25DYW5jZWxpbmdFcnJvcihcbiAgICAgIE5HX0RFVl9NT0RFICYmXG4gICAgICAgICAgYENhbm5vdCBsb2FkIGNoaWxkcmVuIGJlY2F1c2UgdGhlIGd1YXJkIG9mIHRoZSByb3V0ZSBcInBhdGg6ICcke1xuICAgICAgICAgICAgICByb3V0ZS5wYXRofSdcIiByZXR1cm5lZCBmYWxzZWAsXG4gICAgICBOYXZpZ2F0aW9uQ2FuY2VsbGF0aW9uQ29kZS5HdWFyZFJlamVjdGVkKSk7XG59XG5cbi8qKlxuICogUmV0dXJucyB0aGUgYFVybFRyZWVgIHdpdGggdGhlIHJlZGlyZWN0aW9uIGFwcGxpZWQuXG4gKlxuICogTGF6eSBtb2R1bGVzIGFyZSBsb2FkZWQgYWxvbmcgdGhlIHdheS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5UmVkaXJlY3RzKFxuICAgIGluamVjdG9yOiBFbnZpcm9ubWVudEluamVjdG9yLCBjb25maWdMb2FkZXI6IFJvdXRlckNvbmZpZ0xvYWRlciwgdXJsU2VyaWFsaXplcjogVXJsU2VyaWFsaXplcixcbiAgICB1cmxUcmVlOiBVcmxUcmVlLCBjb25maWc6IFJvdXRlcyk6IE9ic2VydmFibGU8VXJsVHJlZT4ge1xuICByZXR1cm4gbmV3IEFwcGx5UmVkaXJlY3RzKGluamVjdG9yLCBjb25maWdMb2FkZXIsIHVybFNlcmlhbGl6ZXIsIHVybFRyZWUsIGNvbmZpZykuYXBwbHkoKTtcbn1cblxuY2xhc3MgQXBwbHlSZWRpcmVjdHMge1xuICBwcml2YXRlIGFsbG93UmVkaXJlY3RzOiBib29sZWFuID0gdHJ1ZTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgaW5qZWN0b3I6IEVudmlyb25tZW50SW5qZWN0b3IsIHByaXZhdGUgY29uZmlnTG9hZGVyOiBSb3V0ZXJDb25maWdMb2FkZXIsXG4gICAgICBwcml2YXRlIHVybFNlcmlhbGl6ZXI6IFVybFNlcmlhbGl6ZXIsIHByaXZhdGUgdXJsVHJlZTogVXJsVHJlZSwgcHJpdmF0ZSBjb25maWc6IFJvdXRlcykge31cblxuICBhcHBseSgpOiBPYnNlcnZhYmxlPFVybFRyZWU+IHtcbiAgICBjb25zdCBzcGxpdEdyb3VwID0gc3BsaXQodGhpcy51cmxUcmVlLnJvb3QsIFtdLCBbXSwgdGhpcy5jb25maWcpLnNlZ21lbnRHcm91cDtcbiAgICAvLyBUT0RPKGF0c2NvdHQpOiBjcmVhdGluZyBhIG5ldyBzZWdtZW50IHJlbW92ZXMgdGhlIF9zb3VyY2VTZWdtZW50IF9zZWdtZW50SW5kZXhTaGlmdCwgd2hpY2ggaXNcbiAgICAvLyBvbmx5IG5lY2Vzc2FyeSB0byBwcmV2ZW50IGZhaWx1cmVzIGluIHRlc3RzIHdoaWNoIGFzc2VydCBleGFjdCBvYmplY3QgbWF0Y2hlcy4gVGhlIGBzcGxpdGAgaXNcbiAgICAvLyBub3cgc2hhcmVkIGJldHdlZW4gYGFwcGx5UmVkaXJlY3RzYCBhbmQgYHJlY29nbml6ZWAgYnV0IG9ubHkgdGhlIGByZWNvZ25pemVgIHN0ZXAgbmVlZHMgdGhlc2VcbiAgICAvLyBwcm9wZXJ0aWVzLiBCZWZvcmUgdGhlIGltcGxlbWVudGF0aW9ucyB3ZXJlIG1lcmdlZCwgdGhlIGBhcHBseVJlZGlyZWN0c2Agd291bGQgbm90IGFzc2lnblxuICAgIC8vIHRoZW0uIFdlIHNob3VsZCBiZSBhYmxlIHRvIHJlbW92ZSB0aGlzIGxvZ2ljIGFzIGEgXCJicmVha2luZyBjaGFuZ2VcIiBidXQgc2hvdWxkIGRvIHNvbWUgbW9yZVxuICAgIC8vIGludmVzdGlnYXRpb24gaW50byB0aGUgZmFpbHVyZXMgZmlyc3QuXG4gICAgY29uc3Qgcm9vdFNlZ21lbnRHcm91cCA9IG5ldyBVcmxTZWdtZW50R3JvdXAoc3BsaXRHcm91cC5zZWdtZW50cywgc3BsaXRHcm91cC5jaGlsZHJlbik7XG5cbiAgICBjb25zdCBleHBhbmRlZCQgPVxuICAgICAgICB0aGlzLmV4cGFuZFNlZ21lbnRHcm91cCh0aGlzLmluamVjdG9yLCB0aGlzLmNvbmZpZywgcm9vdFNlZ21lbnRHcm91cCwgUFJJTUFSWV9PVVRMRVQpO1xuICAgIGNvbnN0IHVybFRyZWVzJCA9IGV4cGFuZGVkJC5waXBlKG1hcCgocm9vdFNlZ21lbnRHcm91cDogVXJsU2VnbWVudEdyb3VwKSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5jcmVhdGVVcmxUcmVlKFxuICAgICAgICAgIHNxdWFzaFNlZ21lbnRHcm91cChyb290U2VnbWVudEdyb3VwKSwgdGhpcy51cmxUcmVlLnF1ZXJ5UGFyYW1zLCB0aGlzLnVybFRyZWUuZnJhZ21lbnQpO1xuICAgIH0pKTtcbiAgICByZXR1cm4gdXJsVHJlZXMkLnBpcGUoY2F0Y2hFcnJvcigoZTogYW55KSA9PiB7XG4gICAgICBpZiAoZSBpbnN0YW5jZW9mIEFic29sdXRlUmVkaXJlY3QpIHtcbiAgICAgICAgLy8gQWZ0ZXIgYW4gYWJzb2x1dGUgcmVkaXJlY3Qgd2UgZG8gbm90IGFwcGx5IGFueSBtb3JlIHJlZGlyZWN0cyFcbiAgICAgICAgLy8gSWYgdGhpcyBpbXBsZW1lbnRhdGlvbiBjaGFuZ2VzLCB1cGRhdGUgdGhlIGRvY3VtZW50YXRpb24gbm90ZSBpbiBgcmVkaXJlY3RUb2AuXG4gICAgICAgIHRoaXMuYWxsb3dSZWRpcmVjdHMgPSBmYWxzZTtcbiAgICAgICAgLy8gd2UgbmVlZCB0byBydW4gbWF0Y2hpbmcsIHNvIHdlIGNhbiBmZXRjaCBhbGwgbGF6eS1sb2FkZWQgbW9kdWxlc1xuICAgICAgICByZXR1cm4gdGhpcy5tYXRjaChlLnVybFRyZWUpO1xuICAgICAgfVxuXG4gICAgICBpZiAoZSBpbnN0YW5jZW9mIE5vTWF0Y2gpIHtcbiAgICAgICAgdGhyb3cgdGhpcy5ub01hdGNoRXJyb3IoZSk7XG4gICAgICB9XG5cbiAgICAgIHRocm93IGU7XG4gICAgfSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBtYXRjaCh0cmVlOiBVcmxUcmVlKTogT2JzZXJ2YWJsZTxVcmxUcmVlPiB7XG4gICAgY29uc3QgZXhwYW5kZWQkID1cbiAgICAgICAgdGhpcy5leHBhbmRTZWdtZW50R3JvdXAodGhpcy5pbmplY3RvciwgdGhpcy5jb25maWcsIHRyZWUucm9vdCwgUFJJTUFSWV9PVVRMRVQpO1xuICAgIGNvbnN0IG1hcHBlZCQgPSBleHBhbmRlZCQucGlwZShtYXAoKHJvb3RTZWdtZW50R3JvdXA6IFVybFNlZ21lbnRHcm91cCkgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuY3JlYXRlVXJsVHJlZShcbiAgICAgICAgICBzcXVhc2hTZWdtZW50R3JvdXAocm9vdFNlZ21lbnRHcm91cCksIHRyZWUucXVlcnlQYXJhbXMsIHRyZWUuZnJhZ21lbnQpO1xuICAgIH0pKTtcbiAgICByZXR1cm4gbWFwcGVkJC5waXBlKGNhdGNoRXJyb3IoKGU6IGFueSk6IE9ic2VydmFibGU8VXJsVHJlZT4gPT4ge1xuICAgICAgaWYgKGUgaW5zdGFuY2VvZiBOb01hdGNoKSB7XG4gICAgICAgIHRocm93IHRoaXMubm9NYXRjaEVycm9yKGUpO1xuICAgICAgfVxuXG4gICAgICB0aHJvdyBlO1xuICAgIH0pKTtcbiAgfVxuXG4gIHByaXZhdGUgbm9NYXRjaEVycm9yKGU6IE5vTWF0Y2gpOiBhbnkge1xuICAgIHJldHVybiBuZXcgUnVudGltZUVycm9yKFxuICAgICAgICBSdW50aW1lRXJyb3JDb2RlLk5PX01BVENILFxuICAgICAgICBOR19ERVZfTU9ERSAmJiBgQ2Fubm90IG1hdGNoIGFueSByb3V0ZXMuIFVSTCBTZWdtZW50OiAnJHtlLnNlZ21lbnRHcm91cH0nYCk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVVybFRyZWUocm9vdENhbmRpZGF0ZTogVXJsU2VnbWVudEdyb3VwLCBxdWVyeVBhcmFtczogUGFyYW1zLCBmcmFnbWVudDogc3RyaW5nfG51bGwpOlxuICAgICAgVXJsVHJlZSB7XG4gICAgY29uc3Qgcm9vdCA9IGNyZWF0ZVJvb3Qocm9vdENhbmRpZGF0ZSk7XG4gICAgcmV0dXJuIG5ldyBVcmxUcmVlKHJvb3QsIHF1ZXJ5UGFyYW1zLCBmcmFnbWVudCk7XG4gIH1cblxuICBwcml2YXRlIGV4cGFuZFNlZ21lbnRHcm91cChcbiAgICAgIGluamVjdG9yOiBFbnZpcm9ubWVudEluamVjdG9yLCByb3V0ZXM6IFJvdXRlW10sIHNlZ21lbnRHcm91cDogVXJsU2VnbWVudEdyb3VwLFxuICAgICAgb3V0bGV0OiBzdHJpbmcpOiBPYnNlcnZhYmxlPFVybFNlZ21lbnRHcm91cD4ge1xuICAgIGlmIChzZWdtZW50R3JvdXAuc2VnbWVudHMubGVuZ3RoID09PSAwICYmIHNlZ21lbnRHcm91cC5oYXNDaGlsZHJlbigpKSB7XG4gICAgICByZXR1cm4gdGhpcy5leHBhbmRDaGlsZHJlbihpbmplY3Rvciwgcm91dGVzLCBzZWdtZW50R3JvdXApXG4gICAgICAgICAgLnBpcGUobWFwKChjaGlsZHJlbjogYW55KSA9PiBuZXcgVXJsU2VnbWVudEdyb3VwKFtdLCBjaGlsZHJlbikpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5leHBhbmRTZWdtZW50KGluamVjdG9yLCBzZWdtZW50R3JvdXAsIHJvdXRlcywgc2VnbWVudEdyb3VwLnNlZ21lbnRzLCBvdXRsZXQsIHRydWUpO1xuICB9XG5cbiAgLy8gUmVjdXJzaXZlbHkgZXhwYW5kIHNlZ21lbnQgZ3JvdXBzIGZvciBhbGwgdGhlIGNoaWxkIG91dGxldHNcbiAgcHJpdmF0ZSBleHBhbmRDaGlsZHJlbihcbiAgICAgIGluamVjdG9yOiBFbnZpcm9ubWVudEluamVjdG9yLCByb3V0ZXM6IFJvdXRlW10sXG4gICAgICBzZWdtZW50R3JvdXA6IFVybFNlZ21lbnRHcm91cCk6IE9ic2VydmFibGU8e1tuYW1lOiBzdHJpbmddOiBVcmxTZWdtZW50R3JvdXB9PiB7XG4gICAgLy8gRXhwYW5kIG91dGxldHMgb25lIGF0IGEgdGltZSwgc3RhcnRpbmcgd2l0aCB0aGUgcHJpbWFyeSBvdXRsZXQuIFdlIG5lZWQgdG8gZG8gaXQgdGhpcyB3YXlcbiAgICAvLyBiZWNhdXNlIGFuIGFic29sdXRlIHJlZGlyZWN0IGZyb20gdGhlIHByaW1hcnkgb3V0bGV0IHRha2VzIHByZWNlZGVuY2UuXG4gICAgY29uc3QgY2hpbGRPdXRsZXRzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGZvciAoY29uc3QgY2hpbGQgb2YgT2JqZWN0LmtleXMoc2VnbWVudEdyb3VwLmNoaWxkcmVuKSkge1xuICAgICAgaWYgKGNoaWxkID09PSAncHJpbWFyeScpIHtcbiAgICAgICAgY2hpbGRPdXRsZXRzLnVuc2hpZnQoY2hpbGQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2hpbGRPdXRsZXRzLnB1c2goY2hpbGQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmcm9tKGNoaWxkT3V0bGV0cylcbiAgICAgICAgLnBpcGUoXG4gICAgICAgICAgICBjb25jYXRNYXAoY2hpbGRPdXRsZXQgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBjaGlsZCA9IHNlZ21lbnRHcm91cC5jaGlsZHJlbltjaGlsZE91dGxldF07XG4gICAgICAgICAgICAgIC8vIFNvcnQgdGhlIHJvdXRlcyBzbyByb3V0ZXMgd2l0aCBvdXRsZXRzIHRoYXQgbWF0Y2ggdGhlIHNlZ21lbnQgYXBwZWFyXG4gICAgICAgICAgICAgIC8vIGZpcnN0LCBmb2xsb3dlZCBieSByb3V0ZXMgZm9yIG90aGVyIG91dGxldHMsIHdoaWNoIG1pZ2h0IG1hdGNoIGlmIHRoZXkgaGF2ZSBhblxuICAgICAgICAgICAgICAvLyBlbXB0eSBwYXRoLlxuICAgICAgICAgICAgICBjb25zdCBzb3J0ZWRSb3V0ZXMgPSBzb3J0QnlNYXRjaGluZ091dGxldHMocm91dGVzLCBjaGlsZE91dGxldCk7XG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLmV4cGFuZFNlZ21lbnRHcm91cChpbmplY3Rvciwgc29ydGVkUm91dGVzLCBjaGlsZCwgY2hpbGRPdXRsZXQpXG4gICAgICAgICAgICAgICAgICAucGlwZShtYXAocyA9PiAoe3NlZ21lbnQ6IHMsIG91dGxldDogY2hpbGRPdXRsZXR9KSkpO1xuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBzY2FuKFxuICAgICAgICAgICAgICAgIChjaGlsZHJlbiwgZXhwYW5kZWRDaGlsZCkgPT4ge1xuICAgICAgICAgICAgICAgICAgY2hpbGRyZW5bZXhwYW5kZWRDaGlsZC5vdXRsZXRdID0gZXhwYW5kZWRDaGlsZC5zZWdtZW50O1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIGNoaWxkcmVuO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge30gYXMge1tvdXRsZXQ6IHN0cmluZ106IFVybFNlZ21lbnRHcm91cH0pLFxuICAgICAgICAgICAgbGFzdCgpLFxuICAgICAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBleHBhbmRTZWdtZW50KFxuICAgICAgaW5qZWN0b3I6IEVudmlyb25tZW50SW5qZWN0b3IsIHNlZ21lbnRHcm91cDogVXJsU2VnbWVudEdyb3VwLCByb3V0ZXM6IFJvdXRlW10sXG4gICAgICBzZWdtZW50czogVXJsU2VnbWVudFtdLCBvdXRsZXQ6IHN0cmluZyxcbiAgICAgIGFsbG93UmVkaXJlY3RzOiBib29sZWFuKTogT2JzZXJ2YWJsZTxVcmxTZWdtZW50R3JvdXA+IHtcbiAgICByZXR1cm4gZnJvbShyb3V0ZXMpLnBpcGUoXG4gICAgICAgIGNvbmNhdE1hcChyID0+IHtcbiAgICAgICAgICBjb25zdCBleHBhbmRlZCQgPSB0aGlzLmV4cGFuZFNlZ21lbnRBZ2FpbnN0Um91dGUoXG4gICAgICAgICAgICAgIGluamVjdG9yLCBzZWdtZW50R3JvdXAsIHJvdXRlcywgciwgc2VnbWVudHMsIG91dGxldCwgYWxsb3dSZWRpcmVjdHMpO1xuICAgICAgICAgIHJldHVybiBleHBhbmRlZCQucGlwZShjYXRjaEVycm9yKChlOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChlIGluc3RhbmNlb2YgTm9NYXRjaCkge1xuICAgICAgICAgICAgICByZXR1cm4gb2YobnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgIH0pKTtcbiAgICAgICAgfSksXG4gICAgICAgIGZpcnN0KChzKTogcyBpcyBVcmxTZWdtZW50R3JvdXAgPT4gISFzKSwgY2F0Y2hFcnJvcigoZTogYW55LCBfOiBhbnkpID0+IHtcbiAgICAgICAgICBpZiAoZSBpbnN0YW5jZW9mIEVtcHR5RXJyb3IgfHwgZS5uYW1lID09PSAnRW1wdHlFcnJvcicpIHtcbiAgICAgICAgICAgIGlmIChub0xlZnRvdmVyc0luVXJsKHNlZ21lbnRHcm91cCwgc2VnbWVudHMsIG91dGxldCkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIG9mKG5ldyBVcmxTZWdtZW50R3JvdXAoW10sIHt9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbm9NYXRjaChzZWdtZW50R3JvdXApO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICB9KSk7XG4gIH1cblxuICBwcml2YXRlIGV4cGFuZFNlZ21lbnRBZ2FpbnN0Um91dGUoXG4gICAgICBpbmplY3RvcjogRW52aXJvbm1lbnRJbmplY3Rvciwgc2VnbWVudEdyb3VwOiBVcmxTZWdtZW50R3JvdXAsIHJvdXRlczogUm91dGVbXSwgcm91dGU6IFJvdXRlLFxuICAgICAgcGF0aHM6IFVybFNlZ21lbnRbXSwgb3V0bGV0OiBzdHJpbmcsIGFsbG93UmVkaXJlY3RzOiBib29sZWFuKTogT2JzZXJ2YWJsZTxVcmxTZWdtZW50R3JvdXA+IHtcbiAgICBpZiAoIWlzSW1tZWRpYXRlTWF0Y2gocm91dGUsIHNlZ21lbnRHcm91cCwgcGF0aHMsIG91dGxldCkpIHtcbiAgICAgIHJldHVybiBub01hdGNoKHNlZ21lbnRHcm91cCk7XG4gICAgfVxuXG4gICAgaWYgKHJvdXRlLnJlZGlyZWN0VG8gPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMubWF0Y2hTZWdtZW50QWdhaW5zdFJvdXRlKGluamVjdG9yLCBzZWdtZW50R3JvdXAsIHJvdXRlLCBwYXRocywgb3V0bGV0KTtcbiAgICB9XG5cbiAgICBpZiAoYWxsb3dSZWRpcmVjdHMgJiYgdGhpcy5hbGxvd1JlZGlyZWN0cykge1xuICAgICAgcmV0dXJuIHRoaXMuZXhwYW5kU2VnbWVudEFnYWluc3RSb3V0ZVVzaW5nUmVkaXJlY3QoXG4gICAgICAgICAgaW5qZWN0b3IsIHNlZ21lbnRHcm91cCwgcm91dGVzLCByb3V0ZSwgcGF0aHMsIG91dGxldCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5vTWF0Y2goc2VnbWVudEdyb3VwKTtcbiAgfVxuXG4gIHByaXZhdGUgZXhwYW5kU2VnbWVudEFnYWluc3RSb3V0ZVVzaW5nUmVkaXJlY3QoXG4gICAgICBpbmplY3RvcjogRW52aXJvbm1lbnRJbmplY3Rvciwgc2VnbWVudEdyb3VwOiBVcmxTZWdtZW50R3JvdXAsIHJvdXRlczogUm91dGVbXSwgcm91dGU6IFJvdXRlLFxuICAgICAgc2VnbWVudHM6IFVybFNlZ21lbnRbXSwgb3V0bGV0OiBzdHJpbmcpOiBPYnNlcnZhYmxlPFVybFNlZ21lbnRHcm91cD4ge1xuICAgIGlmIChyb3V0ZS5wYXRoID09PSAnKionKSB7XG4gICAgICByZXR1cm4gdGhpcy5leHBhbmRXaWxkQ2FyZFdpdGhQYXJhbXNBZ2FpbnN0Um91dGVVc2luZ1JlZGlyZWN0KFxuICAgICAgICAgIGluamVjdG9yLCByb3V0ZXMsIHJvdXRlLCBvdXRsZXQpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmV4cGFuZFJlZ3VsYXJTZWdtZW50QWdhaW5zdFJvdXRlVXNpbmdSZWRpcmVjdChcbiAgICAgICAgaW5qZWN0b3IsIHNlZ21lbnRHcm91cCwgcm91dGVzLCByb3V0ZSwgc2VnbWVudHMsIG91dGxldCk7XG4gIH1cblxuICBwcml2YXRlIGV4cGFuZFdpbGRDYXJkV2l0aFBhcmFtc0FnYWluc3RSb3V0ZVVzaW5nUmVkaXJlY3QoXG4gICAgICBpbmplY3RvcjogRW52aXJvbm1lbnRJbmplY3Rvciwgcm91dGVzOiBSb3V0ZVtdLCByb3V0ZTogUm91dGUsXG4gICAgICBvdXRsZXQ6IHN0cmluZyk6IE9ic2VydmFibGU8VXJsU2VnbWVudEdyb3VwPiB7XG4gICAgY29uc3QgbmV3VHJlZSA9IHRoaXMuYXBwbHlSZWRpcmVjdENvbW1hbmRzKFtdLCByb3V0ZS5yZWRpcmVjdFRvISwge30pO1xuICAgIGlmIChyb3V0ZS5yZWRpcmVjdFRvIS5zdGFydHNXaXRoKCcvJykpIHtcbiAgICAgIHJldHVybiBhYnNvbHV0ZVJlZGlyZWN0KG5ld1RyZWUpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmxpbmVyYWxpemVTZWdtZW50cyhyb3V0ZSwgbmV3VHJlZSkucGlwZShtZXJnZU1hcCgobmV3U2VnbWVudHM6IFVybFNlZ21lbnRbXSkgPT4ge1xuICAgICAgY29uc3QgZ3JvdXAgPSBuZXcgVXJsU2VnbWVudEdyb3VwKG5ld1NlZ21lbnRzLCB7fSk7XG4gICAgICByZXR1cm4gdGhpcy5leHBhbmRTZWdtZW50KGluamVjdG9yLCBncm91cCwgcm91dGVzLCBuZXdTZWdtZW50cywgb3V0bGV0LCBmYWxzZSk7XG4gICAgfSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBleHBhbmRSZWd1bGFyU2VnbWVudEFnYWluc3RSb3V0ZVVzaW5nUmVkaXJlY3QoXG4gICAgICBpbmplY3RvcjogRW52aXJvbm1lbnRJbmplY3Rvciwgc2VnbWVudEdyb3VwOiBVcmxTZWdtZW50R3JvdXAsIHJvdXRlczogUm91dGVbXSwgcm91dGU6IFJvdXRlLFxuICAgICAgc2VnbWVudHM6IFVybFNlZ21lbnRbXSwgb3V0bGV0OiBzdHJpbmcpOiBPYnNlcnZhYmxlPFVybFNlZ21lbnRHcm91cD4ge1xuICAgIGNvbnN0IHttYXRjaGVkLCBjb25zdW1lZFNlZ21lbnRzLCByZW1haW5pbmdTZWdtZW50cywgcG9zaXRpb25hbFBhcmFtU2VnbWVudHN9ID1cbiAgICAgICAgbWF0Y2goc2VnbWVudEdyb3VwLCByb3V0ZSwgc2VnbWVudHMpO1xuICAgIGlmICghbWF0Y2hlZCkgcmV0dXJuIG5vTWF0Y2goc2VnbWVudEdyb3VwKTtcblxuICAgIGNvbnN0IG5ld1RyZWUgPVxuICAgICAgICB0aGlzLmFwcGx5UmVkaXJlY3RDb21tYW5kcyhjb25zdW1lZFNlZ21lbnRzLCByb3V0ZS5yZWRpcmVjdFRvISwgcG9zaXRpb25hbFBhcmFtU2VnbWVudHMpO1xuICAgIGlmIChyb3V0ZS5yZWRpcmVjdFRvIS5zdGFydHNXaXRoKCcvJykpIHtcbiAgICAgIHJldHVybiBhYnNvbHV0ZVJlZGlyZWN0KG5ld1RyZWUpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmxpbmVyYWxpemVTZWdtZW50cyhyb3V0ZSwgbmV3VHJlZSkucGlwZShtZXJnZU1hcCgobmV3U2VnbWVudHM6IFVybFNlZ21lbnRbXSkgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuZXhwYW5kU2VnbWVudChcbiAgICAgICAgICBpbmplY3Rvciwgc2VnbWVudEdyb3VwLCByb3V0ZXMsIG5ld1NlZ21lbnRzLmNvbmNhdChyZW1haW5pbmdTZWdtZW50cyksIG91dGxldCwgZmFsc2UpO1xuICAgIH0pKTtcbiAgfVxuXG4gIHByaXZhdGUgbWF0Y2hTZWdtZW50QWdhaW5zdFJvdXRlKFxuICAgICAgaW5qZWN0b3I6IEVudmlyb25tZW50SW5qZWN0b3IsIHJhd1NlZ21lbnRHcm91cDogVXJsU2VnbWVudEdyb3VwLCByb3V0ZTogUm91dGUsXG4gICAgICBzZWdtZW50czogVXJsU2VnbWVudFtdLCBvdXRsZXQ6IHN0cmluZyk6IE9ic2VydmFibGU8VXJsU2VnbWVudEdyb3VwPiB7XG4gICAgaWYgKHJvdXRlLnBhdGggPT09ICcqKicpIHtcbiAgICAgIC8vIE9ubHkgY3JlYXRlIHRoZSBSb3V0ZSdzIGBFbnZpcm9ubWVudEluamVjdG9yYCBpZiBpdCBtYXRjaGVzIHRoZSBhdHRlbXB0ZWQgbmF2aWdhdGlvblxuICAgICAgaW5qZWN0b3IgPSBnZXRPckNyZWF0ZVJvdXRlSW5qZWN0b3JJZk5lZWRlZChyb3V0ZSwgaW5qZWN0b3IpO1xuICAgICAgaWYgKHJvdXRlLmxvYWRDaGlsZHJlbikge1xuICAgICAgICBjb25zdCBsb2FkZWQkID0gcm91dGUuX2xvYWRlZFJvdXRlcyA/XG4gICAgICAgICAgICBvZih7cm91dGVzOiByb3V0ZS5fbG9hZGVkUm91dGVzLCBpbmplY3Rvcjogcm91dGUuX2xvYWRlZEluamVjdG9yfSkgOlxuICAgICAgICAgICAgdGhpcy5jb25maWdMb2FkZXIubG9hZENoaWxkcmVuKGluamVjdG9yLCByb3V0ZSk7XG4gICAgICAgIHJldHVybiBsb2FkZWQkLnBpcGUobWFwKChjZmc6IExvYWRlZFJvdXRlckNvbmZpZykgPT4ge1xuICAgICAgICAgIHJvdXRlLl9sb2FkZWRSb3V0ZXMgPSBjZmcucm91dGVzO1xuICAgICAgICAgIHJvdXRlLl9sb2FkZWRJbmplY3RvciA9IGNmZy5pbmplY3RvcjtcbiAgICAgICAgICByZXR1cm4gbmV3IFVybFNlZ21lbnRHcm91cChzZWdtZW50cywge30pO1xuICAgICAgICB9KSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBvZihuZXcgVXJsU2VnbWVudEdyb3VwKHNlZ21lbnRzLCB7fSkpO1xuICAgIH1cblxuICAgIHJldHVybiBtYXRjaFdpdGhDaGVja3MocmF3U2VnbWVudEdyb3VwLCByb3V0ZSwgc2VnbWVudHMsIGluamVjdG9yLCB0aGlzLnVybFNlcmlhbGl6ZXIpXG4gICAgICAgIC5waXBlKFxuICAgICAgICAgICAgc3dpdGNoTWFwKCh7bWF0Y2hlZCwgY29uc3VtZWRTZWdtZW50cywgcmVtYWluaW5nU2VnbWVudHN9KSA9PiB7XG4gICAgICAgICAgICAgIGlmICghbWF0Y2hlZCkgcmV0dXJuIG5vTWF0Y2gocmF3U2VnbWVudEdyb3VwKTtcblxuICAgICAgICAgICAgICAvLyBJZiB0aGUgcm91dGUgaGFzIGFuIGluamVjdG9yIGNyZWF0ZWQgZnJvbSBwcm92aWRlcnMsIHdlIHNob3VsZCBzdGFydCB1c2luZyB0aGF0LlxuICAgICAgICAgICAgICBpbmplY3RvciA9IHJvdXRlLl9pbmplY3RvciA/PyBpbmplY3RvcjtcbiAgICAgICAgICAgICAgY29uc3QgY2hpbGRDb25maWckID0gdGhpcy5nZXRDaGlsZENvbmZpZyhpbmplY3Rvciwgcm91dGUsIHNlZ21lbnRzKTtcblxuICAgICAgICAgICAgICByZXR1cm4gY2hpbGRDb25maWckLnBpcGUobWVyZ2VNYXAoKHJvdXRlckNvbmZpZzogTG9hZGVkUm91dGVyQ29uZmlnKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGRJbmplY3RvciA9IHJvdXRlckNvbmZpZy5pbmplY3RvciA/PyBpbmplY3RvcjtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZENvbmZpZyA9IHJvdXRlckNvbmZpZy5yb3V0ZXM7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB7c2VnbWVudEdyb3VwOiBzcGxpdFNlZ21lbnRHcm91cCwgc2xpY2VkU2VnbWVudHN9ID1cbiAgICAgICAgICAgICAgICAgICAgc3BsaXQocmF3U2VnbWVudEdyb3VwLCBjb25zdW1lZFNlZ21lbnRzLCByZW1haW5pbmdTZWdtZW50cywgY2hpbGRDb25maWcpO1xuICAgICAgICAgICAgICAgIC8vIFNlZSBjb21tZW50IG9uIHRoZSBvdGhlciBjYWxsIHRvIGBzcGxpdGAgYWJvdXQgd2h5IHRoaXMgaXMgbmVjZXNzYXJ5LlxuICAgICAgICAgICAgICAgIGNvbnN0IHNlZ21lbnRHcm91cCA9XG4gICAgICAgICAgICAgICAgICAgIG5ldyBVcmxTZWdtZW50R3JvdXAoc3BsaXRTZWdtZW50R3JvdXAuc2VnbWVudHMsIHNwbGl0U2VnbWVudEdyb3VwLmNoaWxkcmVuKTtcblxuICAgICAgICAgICAgICAgIGlmIChzbGljZWRTZWdtZW50cy5sZW5ndGggPT09IDAgJiYgc2VnbWVudEdyb3VwLmhhc0NoaWxkcmVuKCkpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGV4cGFuZGVkJCA9IHRoaXMuZXhwYW5kQ2hpbGRyZW4oY2hpbGRJbmplY3RvciwgY2hpbGRDb25maWcsIHNlZ21lbnRHcm91cCk7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gZXhwYW5kZWQkLnBpcGUoXG4gICAgICAgICAgICAgICAgICAgICAgbWFwKChjaGlsZHJlbjogYW55KSA9PiBuZXcgVXJsU2VnbWVudEdyb3VwKGNvbnN1bWVkU2VnbWVudHMsIGNoaWxkcmVuKSkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChjaGlsZENvbmZpZy5sZW5ndGggPT09IDAgJiYgc2xpY2VkU2VnbWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gb2YobmV3IFVybFNlZ21lbnRHcm91cChjb25zdW1lZFNlZ21lbnRzLCB7fSkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoZWRPbk91dGxldCA9IGdldE91dGxldChyb3V0ZSkgPT09IG91dGxldDtcbiAgICAgICAgICAgICAgICBjb25zdCBleHBhbmRlZCQgPSB0aGlzLmV4cGFuZFNlZ21lbnQoXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkSW5qZWN0b3IsIHNlZ21lbnRHcm91cCwgY2hpbGRDb25maWcsIHNsaWNlZFNlZ21lbnRzLFxuICAgICAgICAgICAgICAgICAgICBtYXRjaGVkT25PdXRsZXQgPyBQUklNQVJZX09VVExFVCA6IG91dGxldCwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGV4cGFuZGVkJC5waXBlKFxuICAgICAgICAgICAgICAgICAgICBtYXAoKGNzOiBVcmxTZWdtZW50R3JvdXApID0+IG5ldyBVcmxTZWdtZW50R3JvdXAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3VtZWRTZWdtZW50cy5jb25jYXQoY3Muc2VnbWVudHMpLCBjcy5jaGlsZHJlbikpKTtcbiAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfSksXG4gICAgICAgICk7XG4gIH1cblxuICBwcml2YXRlIGdldENoaWxkQ29uZmlnKGluamVjdG9yOiBFbnZpcm9ubWVudEluamVjdG9yLCByb3V0ZTogUm91dGUsIHNlZ21lbnRzOiBVcmxTZWdtZW50W10pOlxuICAgICAgT2JzZXJ2YWJsZTxMb2FkZWRSb3V0ZXJDb25maWc+IHtcbiAgICBpZiAocm91dGUuY2hpbGRyZW4pIHtcbiAgICAgIC8vIFRoZSBjaGlsZHJlbiBiZWxvbmcgdG8gdGhlIHNhbWUgbW9kdWxlXG4gICAgICByZXR1cm4gb2Yoe3JvdXRlczogcm91dGUuY2hpbGRyZW4sIGluamVjdG9yfSk7XG4gICAgfVxuXG4gICAgaWYgKHJvdXRlLmxvYWRDaGlsZHJlbikge1xuICAgICAgLy8gbGF6eSBjaGlsZHJlbiBiZWxvbmcgdG8gdGhlIGxvYWRlZCBtb2R1bGVcbiAgICAgIGlmIChyb3V0ZS5fbG9hZGVkUm91dGVzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIG9mKHtyb3V0ZXM6IHJvdXRlLl9sb2FkZWRSb3V0ZXMsIGluamVjdG9yOiByb3V0ZS5fbG9hZGVkSW5qZWN0b3J9KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJ1bkNhbkxvYWRHdWFyZHMoaW5qZWN0b3IsIHJvdXRlLCBzZWdtZW50cywgdGhpcy51cmxTZXJpYWxpemVyKVxuICAgICAgICAgIC5waXBlKG1lcmdlTWFwKChzaG91bGRMb2FkUmVzdWx0OiBib29sZWFuKSA9PiB7XG4gICAgICAgICAgICBpZiAoc2hvdWxkTG9hZFJlc3VsdCkge1xuICAgICAgICAgICAgICByZXR1cm4gdGhpcy5jb25maWdMb2FkZXIubG9hZENoaWxkcmVuKGluamVjdG9yLCByb3V0ZSlcbiAgICAgICAgICAgICAgICAgIC5waXBlKHRhcCgoY2ZnOiBMb2FkZWRSb3V0ZXJDb25maWcpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcm91dGUuX2xvYWRlZFJvdXRlcyA9IGNmZy5yb3V0ZXM7XG4gICAgICAgICAgICAgICAgICAgIHJvdXRlLl9sb2FkZWRJbmplY3RvciA9IGNmZy5pbmplY3RvcjtcbiAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjYW5Mb2FkRmFpbHMocm91dGUpO1xuICAgICAgICAgIH0pKTtcbiAgICB9XG5cbiAgICByZXR1cm4gb2Yoe3JvdXRlczogW10sIGluamVjdG9yfSk7XG4gIH1cblxuICBwcml2YXRlIGxpbmVyYWxpemVTZWdtZW50cyhyb3V0ZTogUm91dGUsIHVybFRyZWU6IFVybFRyZWUpOiBPYnNlcnZhYmxlPFVybFNlZ21lbnRbXT4ge1xuICAgIGxldCByZXM6IFVybFNlZ21lbnRbXSA9IFtdO1xuICAgIGxldCBjID0gdXJsVHJlZS5yb290O1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICByZXMgPSByZXMuY29uY2F0KGMuc2VnbWVudHMpO1xuICAgICAgaWYgKGMubnVtYmVyT2ZDaGlsZHJlbiA9PT0gMCkge1xuICAgICAgICByZXR1cm4gb2YocmVzKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGMubnVtYmVyT2ZDaGlsZHJlbiA+IDEgfHwgIWMuY2hpbGRyZW5bUFJJTUFSWV9PVVRMRVRdKSB7XG4gICAgICAgIHJldHVybiBuYW1lZE91dGxldHNSZWRpcmVjdChyb3V0ZS5yZWRpcmVjdFRvISk7XG4gICAgICB9XG5cbiAgICAgIGMgPSBjLmNoaWxkcmVuW1BSSU1BUllfT1VUTEVUXTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFwcGx5UmVkaXJlY3RDb21tYW5kcyhcbiAgICAgIHNlZ21lbnRzOiBVcmxTZWdtZW50W10sIHJlZGlyZWN0VG86IHN0cmluZywgcG9zUGFyYW1zOiB7W2s6IHN0cmluZ106IFVybFNlZ21lbnR9KTogVXJsVHJlZSB7XG4gICAgcmV0dXJuIHRoaXMuYXBwbHlSZWRpcmVjdENyZWF0ZVVybFRyZWUoXG4gICAgICAgIHJlZGlyZWN0VG8sIHRoaXMudXJsU2VyaWFsaXplci5wYXJzZShyZWRpcmVjdFRvKSwgc2VnbWVudHMsIHBvc1BhcmFtcyk7XG4gIH1cblxuICBwcml2YXRlIGFwcGx5UmVkaXJlY3RDcmVhdGVVcmxUcmVlKFxuICAgICAgcmVkaXJlY3RUbzogc3RyaW5nLCB1cmxUcmVlOiBVcmxUcmVlLCBzZWdtZW50czogVXJsU2VnbWVudFtdLFxuICAgICAgcG9zUGFyYW1zOiB7W2s6IHN0cmluZ106IFVybFNlZ21lbnR9KTogVXJsVHJlZSB7XG4gICAgY29uc3QgbmV3Um9vdCA9IHRoaXMuY3JlYXRlU2VnbWVudEdyb3VwKHJlZGlyZWN0VG8sIHVybFRyZWUucm9vdCwgc2VnbWVudHMsIHBvc1BhcmFtcyk7XG4gICAgcmV0dXJuIG5ldyBVcmxUcmVlKFxuICAgICAgICBuZXdSb290LCB0aGlzLmNyZWF0ZVF1ZXJ5UGFyYW1zKHVybFRyZWUucXVlcnlQYXJhbXMsIHRoaXMudXJsVHJlZS5xdWVyeVBhcmFtcyksXG4gICAgICAgIHVybFRyZWUuZnJhZ21lbnQpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVRdWVyeVBhcmFtcyhyZWRpcmVjdFRvUGFyYW1zOiBQYXJhbXMsIGFjdHVhbFBhcmFtczogUGFyYW1zKTogUGFyYW1zIHtcbiAgICBjb25zdCByZXM6IFBhcmFtcyA9IHt9O1xuICAgIGZvckVhY2gocmVkaXJlY3RUb1BhcmFtcywgKHY6IGFueSwgazogc3RyaW5nKSA9PiB7XG4gICAgICBjb25zdCBjb3B5U291cmNlVmFsdWUgPSB0eXBlb2YgdiA9PT0gJ3N0cmluZycgJiYgdi5zdGFydHNXaXRoKCc6Jyk7XG4gICAgICBpZiAoY29weVNvdXJjZVZhbHVlKSB7XG4gICAgICAgIGNvbnN0IHNvdXJjZU5hbWUgPSB2LnN1YnN0cmluZygxKTtcbiAgICAgICAgcmVzW2tdID0gYWN0dWFsUGFyYW1zW3NvdXJjZU5hbWVdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzW2tdID0gdjtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcmVzO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVTZWdtZW50R3JvdXAoXG4gICAgICByZWRpcmVjdFRvOiBzdHJpbmcsIGdyb3VwOiBVcmxTZWdtZW50R3JvdXAsIHNlZ21lbnRzOiBVcmxTZWdtZW50W10sXG4gICAgICBwb3NQYXJhbXM6IHtbazogc3RyaW5nXTogVXJsU2VnbWVudH0pOiBVcmxTZWdtZW50R3JvdXAge1xuICAgIGNvbnN0IHVwZGF0ZWRTZWdtZW50cyA9IHRoaXMuY3JlYXRlU2VnbWVudHMocmVkaXJlY3RUbywgZ3JvdXAuc2VnbWVudHMsIHNlZ21lbnRzLCBwb3NQYXJhbXMpO1xuXG4gICAgbGV0IGNoaWxkcmVuOiB7W246IHN0cmluZ106IFVybFNlZ21lbnRHcm91cH0gPSB7fTtcbiAgICBmb3JFYWNoKGdyb3VwLmNoaWxkcmVuLCAoY2hpbGQ6IFVybFNlZ21lbnRHcm91cCwgbmFtZTogc3RyaW5nKSA9PiB7XG4gICAgICBjaGlsZHJlbltuYW1lXSA9IHRoaXMuY3JlYXRlU2VnbWVudEdyb3VwKHJlZGlyZWN0VG8sIGNoaWxkLCBzZWdtZW50cywgcG9zUGFyYW1zKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBuZXcgVXJsU2VnbWVudEdyb3VwKHVwZGF0ZWRTZWdtZW50cywgY2hpbGRyZW4pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVTZWdtZW50cyhcbiAgICAgIHJlZGlyZWN0VG86IHN0cmluZywgcmVkaXJlY3RUb1NlZ21lbnRzOiBVcmxTZWdtZW50W10sIGFjdHVhbFNlZ21lbnRzOiBVcmxTZWdtZW50W10sXG4gICAgICBwb3NQYXJhbXM6IHtbazogc3RyaW5nXTogVXJsU2VnbWVudH0pOiBVcmxTZWdtZW50W10ge1xuICAgIHJldHVybiByZWRpcmVjdFRvU2VnbWVudHMubWFwKFxuICAgICAgICBzID0+IHMucGF0aC5zdGFydHNXaXRoKCc6JykgPyB0aGlzLmZpbmRQb3NQYXJhbShyZWRpcmVjdFRvLCBzLCBwb3NQYXJhbXMpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5maW5kT3JSZXR1cm4ocywgYWN0dWFsU2VnbWVudHMpKTtcbiAgfVxuXG4gIHByaXZhdGUgZmluZFBvc1BhcmFtKFxuICAgICAgcmVkaXJlY3RUbzogc3RyaW5nLCByZWRpcmVjdFRvVXJsU2VnbWVudDogVXJsU2VnbWVudCxcbiAgICAgIHBvc1BhcmFtczoge1trOiBzdHJpbmddOiBVcmxTZWdtZW50fSk6IFVybFNlZ21lbnQge1xuICAgIGNvbnN0IHBvcyA9IHBvc1BhcmFtc1tyZWRpcmVjdFRvVXJsU2VnbWVudC5wYXRoLnN1YnN0cmluZygxKV07XG4gICAgaWYgKCFwb3MpXG4gICAgICB0aHJvdyBuZXcgUnVudGltZUVycm9yKFxuICAgICAgICAgIFJ1bnRpbWVFcnJvckNvZGUuTUlTU0lOR19SRURJUkVDVCxcbiAgICAgICAgICBOR19ERVZfTU9ERSAmJlxuICAgICAgICAgICAgICBgQ2Fubm90IHJlZGlyZWN0IHRvICcke3JlZGlyZWN0VG99Jy4gQ2Fubm90IGZpbmQgJyR7cmVkaXJlY3RUb1VybFNlZ21lbnQucGF0aH0nLmApO1xuICAgIHJldHVybiBwb3M7XG4gIH1cblxuICBwcml2YXRlIGZpbmRPclJldHVybihyZWRpcmVjdFRvVXJsU2VnbWVudDogVXJsU2VnbWVudCwgYWN0dWFsU2VnbWVudHM6IFVybFNlZ21lbnRbXSk6IFVybFNlZ21lbnQge1xuICAgIGxldCBpZHggPSAwO1xuICAgIGZvciAoY29uc3QgcyBvZiBhY3R1YWxTZWdtZW50cykge1xuICAgICAgaWYgKHMucGF0aCA9PT0gcmVkaXJlY3RUb1VybFNlZ21lbnQucGF0aCkge1xuICAgICAgICBhY3R1YWxTZWdtZW50cy5zcGxpY2UoaWR4KTtcbiAgICAgICAgcmV0dXJuIHM7XG4gICAgICB9XG4gICAgICBpZHgrKztcbiAgICB9XG4gICAgcmV0dXJuIHJlZGlyZWN0VG9VcmxTZWdtZW50O1xuICB9XG59XG4iXX0=
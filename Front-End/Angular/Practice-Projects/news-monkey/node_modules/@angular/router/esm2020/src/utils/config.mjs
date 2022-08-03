/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { createEnvironmentInjector, ɵisStandalone as isStandalone, ɵRuntimeError as RuntimeError } from '@angular/core';
import { EmptyOutletComponent } from '../components/empty_outlet';
import { PRIMARY_OUTLET } from '../shared';
/**
 * Creates an `EnvironmentInjector` if the `Route` has providers and one does not already exist
 * and returns the injector. Otherwise, if the `Route` does not have `providers`, returns the
 * `currentInjector`.
 *
 * @param route The route that might have providers
 * @param currentInjector The parent injector of the `Route`
 */
export function getOrCreateRouteInjectorIfNeeded(route, currentInjector) {
    if (route.providers && !route._injector) {
        route._injector =
            createEnvironmentInjector(route.providers, currentInjector, `Route: ${route.path}`);
    }
    return route._injector ?? currentInjector;
}
export function getLoadedRoutes(route) {
    return route._loadedRoutes;
}
export function getLoadedInjector(route) {
    return route._loadedInjector;
}
export function getLoadedComponent(route) {
    return route._loadedComponent;
}
export function getProvidersInjector(route) {
    return route._injector;
}
export function validateConfig(config, parentPath = '', requireStandaloneComponents = false) {
    // forEach doesn't iterate undefined values
    for (let i = 0; i < config.length; i++) {
        const route = config[i];
        const fullPath = getFullPath(parentPath, route);
        validateNode(route, fullPath, requireStandaloneComponents);
    }
}
export function assertStandalone(fullPath, component) {
    if (component && !isStandalone(component)) {
        throw new RuntimeError(4014 /* RuntimeErrorCode.INVALID_ROUTE_CONFIG */, `Invalid configuration of route '${fullPath}'. The component must be standalone.`);
    }
}
function validateNode(route, fullPath, requireStandaloneComponents) {
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
        if (!route) {
            throw new RuntimeError(4014 /* RuntimeErrorCode.INVALID_ROUTE_CONFIG */, `
      Invalid configuration of route '${fullPath}': Encountered undefined route.
      The reason might be an extra comma.

      Example:
      const routes: Routes = [
        { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
        { path: 'dashboard',  component: DashboardComponent },, << two commas
        { path: 'detail/:id', component: HeroDetailComponent }
      ];
    `);
        }
        if (Array.isArray(route)) {
            throw new RuntimeError(4014 /* RuntimeErrorCode.INVALID_ROUTE_CONFIG */, `Invalid configuration of route '${fullPath}': Array cannot be specified`);
        }
        if (!route.component && !route.loadComponent && !route.children && !route.loadChildren &&
            (route.outlet && route.outlet !== PRIMARY_OUTLET)) {
            throw new RuntimeError(4014 /* RuntimeErrorCode.INVALID_ROUTE_CONFIG */, `Invalid configuration of route '${fullPath}': a componentless route without children or loadChildren cannot have a named outlet set`);
        }
        if (route.redirectTo && route.children) {
            throw new RuntimeError(4014 /* RuntimeErrorCode.INVALID_ROUTE_CONFIG */, `Invalid configuration of route '${fullPath}': redirectTo and children cannot be used together`);
        }
        if (route.redirectTo && route.loadChildren) {
            throw new RuntimeError(4014 /* RuntimeErrorCode.INVALID_ROUTE_CONFIG */, `Invalid configuration of route '${fullPath}': redirectTo and loadChildren cannot be used together`);
        }
        if (route.children && route.loadChildren) {
            throw new RuntimeError(4014 /* RuntimeErrorCode.INVALID_ROUTE_CONFIG */, `Invalid configuration of route '${fullPath}': children and loadChildren cannot be used together`);
        }
        if (route.redirectTo && (route.component || route.loadComponent)) {
            throw new RuntimeError(4014 /* RuntimeErrorCode.INVALID_ROUTE_CONFIG */, `Invalid configuration of route '${fullPath}': redirectTo and component/loadComponent cannot be used together`);
        }
        if (route.component && route.loadComponent) {
            throw new RuntimeError(4014 /* RuntimeErrorCode.INVALID_ROUTE_CONFIG */, `Invalid configuration of route '${fullPath}': component and loadComponent cannot be used together`);
        }
        if (route.redirectTo && route.canActivate) {
            throw new RuntimeError(4014 /* RuntimeErrorCode.INVALID_ROUTE_CONFIG */, `Invalid configuration of route '${fullPath}': redirectTo and canActivate cannot be used together. Redirects happen before activation ` +
                `so canActivate will never be executed.`);
        }
        if (route.path && route.matcher) {
            throw new RuntimeError(4014 /* RuntimeErrorCode.INVALID_ROUTE_CONFIG */, `Invalid configuration of route '${fullPath}': path and matcher cannot be used together`);
        }
        if (route.redirectTo === void 0 && !route.component && !route.loadComponent &&
            !route.children && !route.loadChildren) {
            throw new RuntimeError(4014 /* RuntimeErrorCode.INVALID_ROUTE_CONFIG */, `Invalid configuration of route '${fullPath}'. One of the following must be provided: component, loadComponent, redirectTo, children or loadChildren`);
        }
        if (route.path === void 0 && route.matcher === void 0) {
            throw new RuntimeError(4014 /* RuntimeErrorCode.INVALID_ROUTE_CONFIG */, `Invalid configuration of route '${fullPath}': routes must have either a path or a matcher specified`);
        }
        if (typeof route.path === 'string' && route.path.charAt(0) === '/') {
            throw new RuntimeError(4014 /* RuntimeErrorCode.INVALID_ROUTE_CONFIG */, `Invalid configuration of route '${fullPath}': path cannot start with a slash`);
        }
        if (route.path === '' && route.redirectTo !== void 0 && route.pathMatch === void 0) {
            const exp = `The default value of 'pathMatch' is 'prefix', but often the intent is to use 'full'.`;
            throw new RuntimeError(4014 /* RuntimeErrorCode.INVALID_ROUTE_CONFIG */, `Invalid configuration of route '{path: "${fullPath}", redirectTo: "${route.redirectTo}"}': please provide 'pathMatch'. ${exp}`);
        }
        if (requireStandaloneComponents) {
            assertStandalone(fullPath, route.component);
        }
    }
    if (route.children) {
        validateConfig(route.children, fullPath, requireStandaloneComponents);
    }
}
function getFullPath(parentPath, currentRoute) {
    if (!currentRoute) {
        return parentPath;
    }
    if (!parentPath && !currentRoute.path) {
        return '';
    }
    else if (parentPath && !currentRoute.path) {
        return `${parentPath}/`;
    }
    else if (!parentPath && currentRoute.path) {
        return currentRoute.path;
    }
    else {
        return `${parentPath}/${currentRoute.path}`;
    }
}
/**
 * Makes a copy of the config and adds any default required properties.
 */
export function standardizeConfig(r) {
    const children = r.children && r.children.map(standardizeConfig);
    const c = children ? { ...r, children } : { ...r };
    if ((!c.component && !c.loadComponent) && (children || c.loadChildren) &&
        (c.outlet && c.outlet !== PRIMARY_OUTLET)) {
        c.component = EmptyOutletComponent;
    }
    return c;
}
/** Returns the `route.outlet` or PRIMARY_OUTLET if none exists. */
export function getOutlet(route) {
    return route.outlet || PRIMARY_OUTLET;
}
/**
 * Sorts the `routes` such that the ones with an outlet matching `outletName` come first.
 * The order of the configs is otherwise preserved.
 */
export function sortByMatchingOutlets(routes, outletName) {
    const sortedConfig = routes.filter(r => getOutlet(r) === outletName);
    sortedConfig.push(...routes.filter(r => getOutlet(r) !== outletName));
    return sortedConfig;
}
/**
 * Gets the first injector in the snapshot's parent tree.
 *
 * If the `Route` has a static list of providers, the returned injector will be the one created from
 * those. If it does not exist, the returned injector may come from the parents, which may be from a
 * loaded config or their static providers.
 *
 * Returns `null` if there is neither this nor any parents have a stored injector.
 *
 * Generally used for retrieving the injector to use for getting tokens for guards/resolvers and
 * also used for getting the correct injector to use for creating components.
 */
export function getClosestRouteInjector(snapshot) {
    if (!snapshot)
        return null;
    // If the current route has its own injector, which is created from the static providers on the
    // route itself, we should use that. Otherwise, we start at the parent since we do not want to
    // include the lazy loaded injector from this route.
    if (snapshot.routeConfig?._injector) {
        return snapshot.routeConfig._injector;
    }
    for (let s = snapshot.parent; s; s = s.parent) {
        const route = s.routeConfig;
        // Note that the order here is important. `_loadedInjector` stored on the route with
        // `loadChildren: () => NgModule` so it applies to child routes with priority. The `_injector`
        // is created from the static providers on that parent route, so it applies to the children as
        // well, but only if there is no lazy loaded NgModuleRef injector.
        if (route?._loadedInjector)
            return route._loadedInjector;
        if (route?._injector)
            return route._injector;
    }
    return null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvcm91dGVyL3NyYy91dGlscy9jb25maWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLHlCQUF5QixFQUE2QixhQUFhLElBQUksWUFBWSxFQUFFLGFBQWEsSUFBSSxZQUFZLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFFakosT0FBTyxFQUFDLG9CQUFvQixFQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFJaEUsT0FBTyxFQUFDLGNBQWMsRUFBQyxNQUFNLFdBQVcsQ0FBQztBQUV6Qzs7Ozs7OztHQU9HO0FBQ0gsTUFBTSxVQUFVLGdDQUFnQyxDQUM1QyxLQUFZLEVBQUUsZUFBb0M7SUFDcEQsSUFBSSxLQUFLLENBQUMsU0FBUyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRTtRQUN2QyxLQUFLLENBQUMsU0FBUztZQUNYLHlCQUF5QixDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUUsZUFBZSxFQUFFLFVBQVUsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7S0FDekY7SUFDRCxPQUFPLEtBQUssQ0FBQyxTQUFTLElBQUksZUFBZSxDQUFDO0FBQzVDLENBQUM7QUFFRCxNQUFNLFVBQVUsZUFBZSxDQUFDLEtBQVk7SUFDMUMsT0FBTyxLQUFLLENBQUMsYUFBYSxDQUFDO0FBQzdCLENBQUM7QUFFRCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsS0FBWTtJQUM1QyxPQUFPLEtBQUssQ0FBQyxlQUFlLENBQUM7QUFDL0IsQ0FBQztBQUNELE1BQU0sVUFBVSxrQkFBa0IsQ0FBQyxLQUFZO0lBQzdDLE9BQU8sS0FBSyxDQUFDLGdCQUFnQixDQUFDO0FBQ2hDLENBQUM7QUFFRCxNQUFNLFVBQVUsb0JBQW9CLENBQUMsS0FBWTtJQUMvQyxPQUFPLEtBQUssQ0FBQyxTQUFTLENBQUM7QUFDekIsQ0FBQztBQUVELE1BQU0sVUFBVSxjQUFjLENBQzFCLE1BQWMsRUFBRSxhQUFxQixFQUFFLEVBQUUsMkJBQTJCLEdBQUcsS0FBSztJQUM5RSwyQ0FBMkM7SUFDM0MsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDdEMsTUFBTSxLQUFLLEdBQVUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQy9CLE1BQU0sUUFBUSxHQUFXLFdBQVcsQ0FBQyxVQUFVLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDeEQsWUFBWSxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsMkJBQTJCLENBQUMsQ0FBQztLQUM1RDtBQUNILENBQUM7QUFFRCxNQUFNLFVBQVUsZ0JBQWdCLENBQUMsUUFBZ0IsRUFBRSxTQUFrQztJQUNuRixJQUFJLFNBQVMsSUFBSSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsRUFBRTtRQUN6QyxNQUFNLElBQUksWUFBWSxtREFFbEIsbUNBQW1DLFFBQVEsc0NBQXNDLENBQUMsQ0FBQztLQUN4RjtBQUNILENBQUM7QUFFRCxTQUFTLFlBQVksQ0FBQyxLQUFZLEVBQUUsUUFBZ0IsRUFBRSwyQkFBb0M7SUFDeEYsSUFBSSxPQUFPLFNBQVMsS0FBSyxXQUFXLElBQUksU0FBUyxFQUFFO1FBQ2pELElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDVixNQUFNLElBQUksWUFBWSxtREFBd0M7d0NBQzVCLFFBQVE7Ozs7Ozs7OztLQVMzQyxDQUFDLENBQUM7U0FDRjtRQUNELElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUN4QixNQUFNLElBQUksWUFBWSxtREFFbEIsbUNBQW1DLFFBQVEsOEJBQThCLENBQUMsQ0FBQztTQUNoRjtRQUNELElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxJQUFJLENBQUMsS0FBSyxDQUFDLGFBQWEsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWTtZQUNsRixDQUFDLEtBQUssQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxjQUFjLENBQUMsRUFBRTtZQUNyRCxNQUFNLElBQUksWUFBWSxtREFFbEIsbUNBQ0ksUUFBUSwwRkFBMEYsQ0FBQyxDQUFDO1NBQzdHO1FBQ0QsSUFBSSxLQUFLLENBQUMsVUFBVSxJQUFJLEtBQUssQ0FBQyxRQUFRLEVBQUU7WUFDdEMsTUFBTSxJQUFJLFlBQVksbURBRWxCLG1DQUNJLFFBQVEsb0RBQW9ELENBQUMsQ0FBQztTQUN2RTtRQUNELElBQUksS0FBSyxDQUFDLFVBQVUsSUFBSSxLQUFLLENBQUMsWUFBWSxFQUFFO1lBQzFDLE1BQU0sSUFBSSxZQUFZLG1EQUVsQixtQ0FDSSxRQUFRLHdEQUF3RCxDQUFDLENBQUM7U0FDM0U7UUFDRCxJQUFJLEtBQUssQ0FBQyxRQUFRLElBQUksS0FBSyxDQUFDLFlBQVksRUFBRTtZQUN4QyxNQUFNLElBQUksWUFBWSxtREFFbEIsbUNBQ0ksUUFBUSxzREFBc0QsQ0FBQyxDQUFDO1NBQ3pFO1FBQ0QsSUFBSSxLQUFLLENBQUMsVUFBVSxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsSUFBSSxLQUFLLENBQUMsYUFBYSxDQUFDLEVBQUU7WUFDaEUsTUFBTSxJQUFJLFlBQVksbURBRWxCLG1DQUNJLFFBQVEsbUVBQW1FLENBQUMsQ0FBQztTQUN0RjtRQUNELElBQUksS0FBSyxDQUFDLFNBQVMsSUFBSSxLQUFLLENBQUMsYUFBYSxFQUFFO1lBQzFDLE1BQU0sSUFBSSxZQUFZLG1EQUVsQixtQ0FDSSxRQUFRLHdEQUF3RCxDQUFDLENBQUM7U0FDM0U7UUFDRCxJQUFJLEtBQUssQ0FBQyxVQUFVLElBQUksS0FBSyxDQUFDLFdBQVcsRUFBRTtZQUN6QyxNQUFNLElBQUksWUFBWSxtREFFbEIsbUNBQ0ksUUFBUSw0RkFBNEY7Z0JBQ3BHLHdDQUF3QyxDQUFDLENBQUM7U0FDbkQ7UUFDRCxJQUFJLEtBQUssQ0FBQyxJQUFJLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRTtZQUMvQixNQUFNLElBQUksWUFBWSxtREFFbEIsbUNBQW1DLFFBQVEsNkNBQTZDLENBQUMsQ0FBQztTQUMvRjtRQUNELElBQUksS0FBSyxDQUFDLFVBQVUsS0FBSyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLElBQUksQ0FBQyxLQUFLLENBQUMsYUFBYTtZQUN2RSxDQUFDLEtBQUssQ0FBQyxRQUFRLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxFQUFFO1lBQzFDLE1BQU0sSUFBSSxZQUFZLG1EQUVsQixtQ0FDSSxRQUFRLDBHQUEwRyxDQUFDLENBQUM7U0FDN0g7UUFDRCxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLE9BQU8sS0FBSyxLQUFLLENBQUMsRUFBRTtZQUNyRCxNQUFNLElBQUksWUFBWSxtREFFbEIsbUNBQ0ksUUFBUSwwREFBMEQsQ0FBQyxDQUFDO1NBQzdFO1FBQ0QsSUFBSSxPQUFPLEtBQUssQ0FBQyxJQUFJLEtBQUssUUFBUSxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsRUFBRTtZQUNsRSxNQUFNLElBQUksWUFBWSxtREFFbEIsbUNBQW1DLFFBQVEsbUNBQW1DLENBQUMsQ0FBQztTQUNyRjtRQUNELElBQUksS0FBSyxDQUFDLElBQUksS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLFVBQVUsS0FBSyxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsU0FBUyxLQUFLLEtBQUssQ0FBQyxFQUFFO1lBQ2xGLE1BQU0sR0FBRyxHQUNMLHNGQUFzRixDQUFDO1lBQzNGLE1BQU0sSUFBSSxZQUFZLG1EQUVsQiwyQ0FBMkMsUUFBUSxtQkFDL0MsS0FBSyxDQUFDLFVBQVUsb0NBQW9DLEdBQUcsRUFBRSxDQUFDLENBQUM7U0FDcEU7UUFDRCxJQUFJLDJCQUEyQixFQUFFO1lBQy9CLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7U0FDN0M7S0FDRjtJQUNELElBQUksS0FBSyxDQUFDLFFBQVEsRUFBRTtRQUNsQixjQUFjLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsMkJBQTJCLENBQUMsQ0FBQztLQUN2RTtBQUNILENBQUM7QUFFRCxTQUFTLFdBQVcsQ0FBQyxVQUFrQixFQUFFLFlBQW1CO0lBQzFELElBQUksQ0FBQyxZQUFZLEVBQUU7UUFDakIsT0FBTyxVQUFVLENBQUM7S0FDbkI7SUFDRCxJQUFJLENBQUMsVUFBVSxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRTtRQUNyQyxPQUFPLEVBQUUsQ0FBQztLQUNYO1NBQU0sSUFBSSxVQUFVLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFO1FBQzNDLE9BQU8sR0FBRyxVQUFVLEdBQUcsQ0FBQztLQUN6QjtTQUFNLElBQUksQ0FBQyxVQUFVLElBQUksWUFBWSxDQUFDLElBQUksRUFBRTtRQUMzQyxPQUFPLFlBQVksQ0FBQyxJQUFJLENBQUM7S0FDMUI7U0FBTTtRQUNMLE9BQU8sR0FBRyxVQUFVLElBQUksWUFBWSxDQUFDLElBQUksRUFBRSxDQUFDO0tBQzdDO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0gsTUFBTSxVQUFVLGlCQUFpQixDQUFDLENBQVE7SUFDeEMsTUFBTSxRQUFRLEdBQUcsQ0FBQyxDQUFDLFFBQVEsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ2pFLE1BQU0sQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBQyxHQUFHLENBQUMsRUFBRSxRQUFRLEVBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxHQUFHLENBQUMsRUFBQyxDQUFDO0lBQy9DLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxRQUFRLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQztRQUNsRSxDQUFDLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLE1BQU0sS0FBSyxjQUFjLENBQUMsRUFBRTtRQUM3QyxDQUFDLENBQUMsU0FBUyxHQUFHLG9CQUFvQixDQUFDO0tBQ3BDO0lBQ0QsT0FBTyxDQUFDLENBQUM7QUFDWCxDQUFDO0FBRUQsbUVBQW1FO0FBQ25FLE1BQU0sVUFBVSxTQUFTLENBQUMsS0FBWTtJQUNwQyxPQUFPLEtBQUssQ0FBQyxNQUFNLElBQUksY0FBYyxDQUFDO0FBQ3hDLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUscUJBQXFCLENBQUMsTUFBYyxFQUFFLFVBQWtCO0lBQ3RFLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssVUFBVSxDQUFDLENBQUM7SUFDckUsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQztJQUN0RSxPQUFPLFlBQVksQ0FBQztBQUN0QixDQUFDO0FBRUQ7Ozs7Ozs7Ozs7O0dBV0c7QUFDSCxNQUFNLFVBQVUsdUJBQXVCLENBQUMsUUFBZ0M7SUFFdEUsSUFBSSxDQUFDLFFBQVE7UUFBRSxPQUFPLElBQUksQ0FBQztJQUUzQiwrRkFBK0Y7SUFDL0YsOEZBQThGO0lBQzlGLG9EQUFvRDtJQUNwRCxJQUFJLFFBQVEsQ0FBQyxXQUFXLEVBQUUsU0FBUyxFQUFFO1FBQ25DLE9BQU8sUUFBUSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUM7S0FDdkM7SUFFRCxLQUFLLElBQUksQ0FBQyxHQUFHLFFBQVEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFO1FBQzdDLE1BQU0sS0FBSyxHQUFHLENBQUMsQ0FBQyxXQUFXLENBQUM7UUFDNUIsb0ZBQW9GO1FBQ3BGLDhGQUE4RjtRQUM5Riw4RkFBOEY7UUFDOUYsa0VBQWtFO1FBQ2xFLElBQUksS0FBSyxFQUFFLGVBQWU7WUFBRSxPQUFPLEtBQUssQ0FBQyxlQUFlLENBQUM7UUFDekQsSUFBSSxLQUFLLEVBQUUsU0FBUztZQUFFLE9BQU8sS0FBSyxDQUFDLFNBQVMsQ0FBQztLQUM5QztJQUVELE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2NyZWF0ZUVudmlyb25tZW50SW5qZWN0b3IsIEVudmlyb25tZW50SW5qZWN0b3IsIFR5cGUsIMm1aXNTdGFuZGFsb25lIGFzIGlzU3RhbmRhbG9uZSwgybVSdW50aW1lRXJyb3IgYXMgUnVudGltZUVycm9yfSBmcm9tICdAYW5ndWxhci9jb3JlJztcblxuaW1wb3J0IHtFbXB0eU91dGxldENvbXBvbmVudH0gZnJvbSAnLi4vY29tcG9uZW50cy9lbXB0eV9vdXRsZXQnO1xuaW1wb3J0IHtSdW50aW1lRXJyb3JDb2RlfSBmcm9tICcuLi9lcnJvcnMnO1xuaW1wb3J0IHtSb3V0ZSwgUm91dGVzfSBmcm9tICcuLi9tb2RlbHMnO1xuaW1wb3J0IHtBY3RpdmF0ZWRSb3V0ZVNuYXBzaG90fSBmcm9tICcuLi9yb3V0ZXJfc3RhdGUnO1xuaW1wb3J0IHtQUklNQVJZX09VVExFVH0gZnJvbSAnLi4vc2hhcmVkJztcblxuLyoqXG4gKiBDcmVhdGVzIGFuIGBFbnZpcm9ubWVudEluamVjdG9yYCBpZiB0aGUgYFJvdXRlYCBoYXMgcHJvdmlkZXJzIGFuZCBvbmUgZG9lcyBub3QgYWxyZWFkeSBleGlzdFxuICogYW5kIHJldHVybnMgdGhlIGluamVjdG9yLiBPdGhlcndpc2UsIGlmIHRoZSBgUm91dGVgIGRvZXMgbm90IGhhdmUgYHByb3ZpZGVyc2AsIHJldHVybnMgdGhlXG4gKiBgY3VycmVudEluamVjdG9yYC5cbiAqXG4gKiBAcGFyYW0gcm91dGUgVGhlIHJvdXRlIHRoYXQgbWlnaHQgaGF2ZSBwcm92aWRlcnNcbiAqIEBwYXJhbSBjdXJyZW50SW5qZWN0b3IgVGhlIHBhcmVudCBpbmplY3RvciBvZiB0aGUgYFJvdXRlYFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0T3JDcmVhdGVSb3V0ZUluamVjdG9ySWZOZWVkZWQoXG4gICAgcm91dGU6IFJvdXRlLCBjdXJyZW50SW5qZWN0b3I6IEVudmlyb25tZW50SW5qZWN0b3IpIHtcbiAgaWYgKHJvdXRlLnByb3ZpZGVycyAmJiAhcm91dGUuX2luamVjdG9yKSB7XG4gICAgcm91dGUuX2luamVjdG9yID1cbiAgICAgICAgY3JlYXRlRW52aXJvbm1lbnRJbmplY3Rvcihyb3V0ZS5wcm92aWRlcnMsIGN1cnJlbnRJbmplY3RvciwgYFJvdXRlOiAke3JvdXRlLnBhdGh9YCk7XG4gIH1cbiAgcmV0dXJuIHJvdXRlLl9pbmplY3RvciA/PyBjdXJyZW50SW5qZWN0b3I7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRMb2FkZWRSb3V0ZXMocm91dGU6IFJvdXRlKTogUm91dGVbXXx1bmRlZmluZWQge1xuICByZXR1cm4gcm91dGUuX2xvYWRlZFJvdXRlcztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldExvYWRlZEluamVjdG9yKHJvdXRlOiBSb3V0ZSk6IEVudmlyb25tZW50SW5qZWN0b3J8dW5kZWZpbmVkIHtcbiAgcmV0dXJuIHJvdXRlLl9sb2FkZWRJbmplY3Rvcjtcbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRMb2FkZWRDb21wb25lbnQocm91dGU6IFJvdXRlKTogVHlwZTx1bmtub3duPnx1bmRlZmluZWQge1xuICByZXR1cm4gcm91dGUuX2xvYWRlZENvbXBvbmVudDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFByb3ZpZGVyc0luamVjdG9yKHJvdXRlOiBSb3V0ZSk6IEVudmlyb25tZW50SW5qZWN0b3J8dW5kZWZpbmVkIHtcbiAgcmV0dXJuIHJvdXRlLl9pbmplY3Rvcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlQ29uZmlnKFxuICAgIGNvbmZpZzogUm91dGVzLCBwYXJlbnRQYXRoOiBzdHJpbmcgPSAnJywgcmVxdWlyZVN0YW5kYWxvbmVDb21wb25lbnRzID0gZmFsc2UpOiB2b2lkIHtcbiAgLy8gZm9yRWFjaCBkb2Vzbid0IGl0ZXJhdGUgdW5kZWZpbmVkIHZhbHVlc1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGNvbmZpZy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHJvdXRlOiBSb3V0ZSA9IGNvbmZpZ1tpXTtcbiAgICBjb25zdCBmdWxsUGF0aDogc3RyaW5nID0gZ2V0RnVsbFBhdGgocGFyZW50UGF0aCwgcm91dGUpO1xuICAgIHZhbGlkYXRlTm9kZShyb3V0ZSwgZnVsbFBhdGgsIHJlcXVpcmVTdGFuZGFsb25lQ29tcG9uZW50cyk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFN0YW5kYWxvbmUoZnVsbFBhdGg6IHN0cmluZywgY29tcG9uZW50OiBUeXBlPHVua25vd24+fHVuZGVmaW5lZCkge1xuICBpZiAoY29tcG9uZW50ICYmICFpc1N0YW5kYWxvbmUoY29tcG9uZW50KSkge1xuICAgIHRocm93IG5ldyBSdW50aW1lRXJyb3IoXG4gICAgICAgIFJ1bnRpbWVFcnJvckNvZGUuSU5WQUxJRF9ST1VURV9DT05GSUcsXG4gICAgICAgIGBJbnZhbGlkIGNvbmZpZ3VyYXRpb24gb2Ygcm91dGUgJyR7ZnVsbFBhdGh9Jy4gVGhlIGNvbXBvbmVudCBtdXN0IGJlIHN0YW5kYWxvbmUuYCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVOb2RlKHJvdXRlOiBSb3V0ZSwgZnVsbFBhdGg6IHN0cmluZywgcmVxdWlyZVN0YW5kYWxvbmVDb21wb25lbnRzOiBib29sZWFuKTogdm9pZCB7XG4gIGlmICh0eXBlb2YgbmdEZXZNb2RlID09PSAndW5kZWZpbmVkJyB8fCBuZ0Rldk1vZGUpIHtcbiAgICBpZiAoIXJvdXRlKSB7XG4gICAgICB0aHJvdyBuZXcgUnVudGltZUVycm9yKFJ1bnRpbWVFcnJvckNvZGUuSU5WQUxJRF9ST1VURV9DT05GSUcsIGBcbiAgICAgIEludmFsaWQgY29uZmlndXJhdGlvbiBvZiByb3V0ZSAnJHtmdWxsUGF0aH0nOiBFbmNvdW50ZXJlZCB1bmRlZmluZWQgcm91dGUuXG4gICAgICBUaGUgcmVhc29uIG1pZ2h0IGJlIGFuIGV4dHJhIGNvbW1hLlxuXG4gICAgICBFeGFtcGxlOlxuICAgICAgY29uc3Qgcm91dGVzOiBSb3V0ZXMgPSBbXG4gICAgICAgIHsgcGF0aDogJycsIHJlZGlyZWN0VG86ICcvZGFzaGJvYXJkJywgcGF0aE1hdGNoOiAnZnVsbCcgfSxcbiAgICAgICAgeyBwYXRoOiAnZGFzaGJvYXJkJywgIGNvbXBvbmVudDogRGFzaGJvYXJkQ29tcG9uZW50IH0sLCA8PCB0d28gY29tbWFzXG4gICAgICAgIHsgcGF0aDogJ2RldGFpbC86aWQnLCBjb21wb25lbnQ6IEhlcm9EZXRhaWxDb21wb25lbnQgfVxuICAgICAgXTtcbiAgICBgKTtcbiAgICB9XG4gICAgaWYgKEFycmF5LmlzQXJyYXkocm91dGUpKSB7XG4gICAgICB0aHJvdyBuZXcgUnVudGltZUVycm9yKFxuICAgICAgICAgIFJ1bnRpbWVFcnJvckNvZGUuSU5WQUxJRF9ST1VURV9DT05GSUcsXG4gICAgICAgICAgYEludmFsaWQgY29uZmlndXJhdGlvbiBvZiByb3V0ZSAnJHtmdWxsUGF0aH0nOiBBcnJheSBjYW5ub3QgYmUgc3BlY2lmaWVkYCk7XG4gICAgfVxuICAgIGlmICghcm91dGUuY29tcG9uZW50ICYmICFyb3V0ZS5sb2FkQ29tcG9uZW50ICYmICFyb3V0ZS5jaGlsZHJlbiAmJiAhcm91dGUubG9hZENoaWxkcmVuICYmXG4gICAgICAgIChyb3V0ZS5vdXRsZXQgJiYgcm91dGUub3V0bGV0ICE9PSBQUklNQVJZX09VVExFVCkpIHtcbiAgICAgIHRocm93IG5ldyBSdW50aW1lRXJyb3IoXG4gICAgICAgICAgUnVudGltZUVycm9yQ29kZS5JTlZBTElEX1JPVVRFX0NPTkZJRyxcbiAgICAgICAgICBgSW52YWxpZCBjb25maWd1cmF0aW9uIG9mIHJvdXRlICcke1xuICAgICAgICAgICAgICBmdWxsUGF0aH0nOiBhIGNvbXBvbmVudGxlc3Mgcm91dGUgd2l0aG91dCBjaGlsZHJlbiBvciBsb2FkQ2hpbGRyZW4gY2Fubm90IGhhdmUgYSBuYW1lZCBvdXRsZXQgc2V0YCk7XG4gICAgfVxuICAgIGlmIChyb3V0ZS5yZWRpcmVjdFRvICYmIHJvdXRlLmNoaWxkcmVuKSB7XG4gICAgICB0aHJvdyBuZXcgUnVudGltZUVycm9yKFxuICAgICAgICAgIFJ1bnRpbWVFcnJvckNvZGUuSU5WQUxJRF9ST1VURV9DT05GSUcsXG4gICAgICAgICAgYEludmFsaWQgY29uZmlndXJhdGlvbiBvZiByb3V0ZSAnJHtcbiAgICAgICAgICAgICAgZnVsbFBhdGh9JzogcmVkaXJlY3RUbyBhbmQgY2hpbGRyZW4gY2Fubm90IGJlIHVzZWQgdG9nZXRoZXJgKTtcbiAgICB9XG4gICAgaWYgKHJvdXRlLnJlZGlyZWN0VG8gJiYgcm91dGUubG9hZENoaWxkcmVuKSB7XG4gICAgICB0aHJvdyBuZXcgUnVudGltZUVycm9yKFxuICAgICAgICAgIFJ1bnRpbWVFcnJvckNvZGUuSU5WQUxJRF9ST1VURV9DT05GSUcsXG4gICAgICAgICAgYEludmFsaWQgY29uZmlndXJhdGlvbiBvZiByb3V0ZSAnJHtcbiAgICAgICAgICAgICAgZnVsbFBhdGh9JzogcmVkaXJlY3RUbyBhbmQgbG9hZENoaWxkcmVuIGNhbm5vdCBiZSB1c2VkIHRvZ2V0aGVyYCk7XG4gICAgfVxuICAgIGlmIChyb3V0ZS5jaGlsZHJlbiAmJiByb3V0ZS5sb2FkQ2hpbGRyZW4pIHtcbiAgICAgIHRocm93IG5ldyBSdW50aW1lRXJyb3IoXG4gICAgICAgICAgUnVudGltZUVycm9yQ29kZS5JTlZBTElEX1JPVVRFX0NPTkZJRyxcbiAgICAgICAgICBgSW52YWxpZCBjb25maWd1cmF0aW9uIG9mIHJvdXRlICcke1xuICAgICAgICAgICAgICBmdWxsUGF0aH0nOiBjaGlsZHJlbiBhbmQgbG9hZENoaWxkcmVuIGNhbm5vdCBiZSB1c2VkIHRvZ2V0aGVyYCk7XG4gICAgfVxuICAgIGlmIChyb3V0ZS5yZWRpcmVjdFRvICYmIChyb3V0ZS5jb21wb25lbnQgfHwgcm91dGUubG9hZENvbXBvbmVudCkpIHtcbiAgICAgIHRocm93IG5ldyBSdW50aW1lRXJyb3IoXG4gICAgICAgICAgUnVudGltZUVycm9yQ29kZS5JTlZBTElEX1JPVVRFX0NPTkZJRyxcbiAgICAgICAgICBgSW52YWxpZCBjb25maWd1cmF0aW9uIG9mIHJvdXRlICcke1xuICAgICAgICAgICAgICBmdWxsUGF0aH0nOiByZWRpcmVjdFRvIGFuZCBjb21wb25lbnQvbG9hZENvbXBvbmVudCBjYW5ub3QgYmUgdXNlZCB0b2dldGhlcmApO1xuICAgIH1cbiAgICBpZiAocm91dGUuY29tcG9uZW50ICYmIHJvdXRlLmxvYWRDb21wb25lbnQpIHtcbiAgICAgIHRocm93IG5ldyBSdW50aW1lRXJyb3IoXG4gICAgICAgICAgUnVudGltZUVycm9yQ29kZS5JTlZBTElEX1JPVVRFX0NPTkZJRyxcbiAgICAgICAgICBgSW52YWxpZCBjb25maWd1cmF0aW9uIG9mIHJvdXRlICcke1xuICAgICAgICAgICAgICBmdWxsUGF0aH0nOiBjb21wb25lbnQgYW5kIGxvYWRDb21wb25lbnQgY2Fubm90IGJlIHVzZWQgdG9nZXRoZXJgKTtcbiAgICB9XG4gICAgaWYgKHJvdXRlLnJlZGlyZWN0VG8gJiYgcm91dGUuY2FuQWN0aXZhdGUpIHtcbiAgICAgIHRocm93IG5ldyBSdW50aW1lRXJyb3IoXG4gICAgICAgICAgUnVudGltZUVycm9yQ29kZS5JTlZBTElEX1JPVVRFX0NPTkZJRyxcbiAgICAgICAgICBgSW52YWxpZCBjb25maWd1cmF0aW9uIG9mIHJvdXRlICcke1xuICAgICAgICAgICAgICBmdWxsUGF0aH0nOiByZWRpcmVjdFRvIGFuZCBjYW5BY3RpdmF0ZSBjYW5ub3QgYmUgdXNlZCB0b2dldGhlci4gUmVkaXJlY3RzIGhhcHBlbiBiZWZvcmUgYWN0aXZhdGlvbiBgICtcbiAgICAgICAgICAgICAgYHNvIGNhbkFjdGl2YXRlIHdpbGwgbmV2ZXIgYmUgZXhlY3V0ZWQuYCk7XG4gICAgfVxuICAgIGlmIChyb3V0ZS5wYXRoICYmIHJvdXRlLm1hdGNoZXIpIHtcbiAgICAgIHRocm93IG5ldyBSdW50aW1lRXJyb3IoXG4gICAgICAgICAgUnVudGltZUVycm9yQ29kZS5JTlZBTElEX1JPVVRFX0NPTkZJRyxcbiAgICAgICAgICBgSW52YWxpZCBjb25maWd1cmF0aW9uIG9mIHJvdXRlICcke2Z1bGxQYXRofSc6IHBhdGggYW5kIG1hdGNoZXIgY2Fubm90IGJlIHVzZWQgdG9nZXRoZXJgKTtcbiAgICB9XG4gICAgaWYgKHJvdXRlLnJlZGlyZWN0VG8gPT09IHZvaWQgMCAmJiAhcm91dGUuY29tcG9uZW50ICYmICFyb3V0ZS5sb2FkQ29tcG9uZW50ICYmXG4gICAgICAgICFyb3V0ZS5jaGlsZHJlbiAmJiAhcm91dGUubG9hZENoaWxkcmVuKSB7XG4gICAgICB0aHJvdyBuZXcgUnVudGltZUVycm9yKFxuICAgICAgICAgIFJ1bnRpbWVFcnJvckNvZGUuSU5WQUxJRF9ST1VURV9DT05GSUcsXG4gICAgICAgICAgYEludmFsaWQgY29uZmlndXJhdGlvbiBvZiByb3V0ZSAnJHtcbiAgICAgICAgICAgICAgZnVsbFBhdGh9Jy4gT25lIG9mIHRoZSBmb2xsb3dpbmcgbXVzdCBiZSBwcm92aWRlZDogY29tcG9uZW50LCBsb2FkQ29tcG9uZW50LCByZWRpcmVjdFRvLCBjaGlsZHJlbiBvciBsb2FkQ2hpbGRyZW5gKTtcbiAgICB9XG4gICAgaWYgKHJvdXRlLnBhdGggPT09IHZvaWQgMCAmJiByb3V0ZS5tYXRjaGVyID09PSB2b2lkIDApIHtcbiAgICAgIHRocm93IG5ldyBSdW50aW1lRXJyb3IoXG4gICAgICAgICAgUnVudGltZUVycm9yQ29kZS5JTlZBTElEX1JPVVRFX0NPTkZJRyxcbiAgICAgICAgICBgSW52YWxpZCBjb25maWd1cmF0aW9uIG9mIHJvdXRlICcke1xuICAgICAgICAgICAgICBmdWxsUGF0aH0nOiByb3V0ZXMgbXVzdCBoYXZlIGVpdGhlciBhIHBhdGggb3IgYSBtYXRjaGVyIHNwZWNpZmllZGApO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHJvdXRlLnBhdGggPT09ICdzdHJpbmcnICYmIHJvdXRlLnBhdGguY2hhckF0KDApID09PSAnLycpIHtcbiAgICAgIHRocm93IG5ldyBSdW50aW1lRXJyb3IoXG4gICAgICAgICAgUnVudGltZUVycm9yQ29kZS5JTlZBTElEX1JPVVRFX0NPTkZJRyxcbiAgICAgICAgICBgSW52YWxpZCBjb25maWd1cmF0aW9uIG9mIHJvdXRlICcke2Z1bGxQYXRofSc6IHBhdGggY2Fubm90IHN0YXJ0IHdpdGggYSBzbGFzaGApO1xuICAgIH1cbiAgICBpZiAocm91dGUucGF0aCA9PT0gJycgJiYgcm91dGUucmVkaXJlY3RUbyAhPT0gdm9pZCAwICYmIHJvdXRlLnBhdGhNYXRjaCA9PT0gdm9pZCAwKSB7XG4gICAgICBjb25zdCBleHAgPVxuICAgICAgICAgIGBUaGUgZGVmYXVsdCB2YWx1ZSBvZiAncGF0aE1hdGNoJyBpcyAncHJlZml4JywgYnV0IG9mdGVuIHRoZSBpbnRlbnQgaXMgdG8gdXNlICdmdWxsJy5gO1xuICAgICAgdGhyb3cgbmV3IFJ1bnRpbWVFcnJvcihcbiAgICAgICAgICBSdW50aW1lRXJyb3JDb2RlLklOVkFMSURfUk9VVEVfQ09ORklHLFxuICAgICAgICAgIGBJbnZhbGlkIGNvbmZpZ3VyYXRpb24gb2Ygcm91dGUgJ3twYXRoOiBcIiR7ZnVsbFBhdGh9XCIsIHJlZGlyZWN0VG86IFwiJHtcbiAgICAgICAgICAgICAgcm91dGUucmVkaXJlY3RUb31cIn0nOiBwbGVhc2UgcHJvdmlkZSAncGF0aE1hdGNoJy4gJHtleHB9YCk7XG4gICAgfVxuICAgIGlmIChyZXF1aXJlU3RhbmRhbG9uZUNvbXBvbmVudHMpIHtcbiAgICAgIGFzc2VydFN0YW5kYWxvbmUoZnVsbFBhdGgsIHJvdXRlLmNvbXBvbmVudCk7XG4gICAgfVxuICB9XG4gIGlmIChyb3V0ZS5jaGlsZHJlbikge1xuICAgIHZhbGlkYXRlQ29uZmlnKHJvdXRlLmNoaWxkcmVuLCBmdWxsUGF0aCwgcmVxdWlyZVN0YW5kYWxvbmVDb21wb25lbnRzKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRGdWxsUGF0aChwYXJlbnRQYXRoOiBzdHJpbmcsIGN1cnJlbnRSb3V0ZTogUm91dGUpOiBzdHJpbmcge1xuICBpZiAoIWN1cnJlbnRSb3V0ZSkge1xuICAgIHJldHVybiBwYXJlbnRQYXRoO1xuICB9XG4gIGlmICghcGFyZW50UGF0aCAmJiAhY3VycmVudFJvdXRlLnBhdGgpIHtcbiAgICByZXR1cm4gJyc7XG4gIH0gZWxzZSBpZiAocGFyZW50UGF0aCAmJiAhY3VycmVudFJvdXRlLnBhdGgpIHtcbiAgICByZXR1cm4gYCR7cGFyZW50UGF0aH0vYDtcbiAgfSBlbHNlIGlmICghcGFyZW50UGF0aCAmJiBjdXJyZW50Um91dGUucGF0aCkge1xuICAgIHJldHVybiBjdXJyZW50Um91dGUucGF0aDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYCR7cGFyZW50UGF0aH0vJHtjdXJyZW50Um91dGUucGF0aH1gO1xuICB9XG59XG5cbi8qKlxuICogTWFrZXMgYSBjb3B5IG9mIHRoZSBjb25maWcgYW5kIGFkZHMgYW55IGRlZmF1bHQgcmVxdWlyZWQgcHJvcGVydGllcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN0YW5kYXJkaXplQ29uZmlnKHI6IFJvdXRlKTogUm91dGUge1xuICBjb25zdCBjaGlsZHJlbiA9IHIuY2hpbGRyZW4gJiYgci5jaGlsZHJlbi5tYXAoc3RhbmRhcmRpemVDb25maWcpO1xuICBjb25zdCBjID0gY2hpbGRyZW4gPyB7Li4uciwgY2hpbGRyZW59IDogey4uLnJ9O1xuICBpZiAoKCFjLmNvbXBvbmVudCAmJiAhYy5sb2FkQ29tcG9uZW50KSAmJiAoY2hpbGRyZW4gfHwgYy5sb2FkQ2hpbGRyZW4pICYmXG4gICAgICAoYy5vdXRsZXQgJiYgYy5vdXRsZXQgIT09IFBSSU1BUllfT1VUTEVUKSkge1xuICAgIGMuY29tcG9uZW50ID0gRW1wdHlPdXRsZXRDb21wb25lbnQ7XG4gIH1cbiAgcmV0dXJuIGM7XG59XG5cbi8qKiBSZXR1cm5zIHRoZSBgcm91dGUub3V0bGV0YCBvciBQUklNQVJZX09VVExFVCBpZiBub25lIGV4aXN0cy4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRPdXRsZXQocm91dGU6IFJvdXRlKTogc3RyaW5nIHtcbiAgcmV0dXJuIHJvdXRlLm91dGxldCB8fCBQUklNQVJZX09VVExFVDtcbn1cblxuLyoqXG4gKiBTb3J0cyB0aGUgYHJvdXRlc2Agc3VjaCB0aGF0IHRoZSBvbmVzIHdpdGggYW4gb3V0bGV0IG1hdGNoaW5nIGBvdXRsZXROYW1lYCBjb21lIGZpcnN0LlxuICogVGhlIG9yZGVyIG9mIHRoZSBjb25maWdzIGlzIG90aGVyd2lzZSBwcmVzZXJ2ZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzb3J0QnlNYXRjaGluZ091dGxldHMocm91dGVzOiBSb3V0ZXMsIG91dGxldE5hbWU6IHN0cmluZyk6IFJvdXRlcyB7XG4gIGNvbnN0IHNvcnRlZENvbmZpZyA9IHJvdXRlcy5maWx0ZXIociA9PiBnZXRPdXRsZXQocikgPT09IG91dGxldE5hbWUpO1xuICBzb3J0ZWRDb25maWcucHVzaCguLi5yb3V0ZXMuZmlsdGVyKHIgPT4gZ2V0T3V0bGV0KHIpICE9PSBvdXRsZXROYW1lKSk7XG4gIHJldHVybiBzb3J0ZWRDb25maWc7XG59XG5cbi8qKlxuICogR2V0cyB0aGUgZmlyc3QgaW5qZWN0b3IgaW4gdGhlIHNuYXBzaG90J3MgcGFyZW50IHRyZWUuXG4gKlxuICogSWYgdGhlIGBSb3V0ZWAgaGFzIGEgc3RhdGljIGxpc3Qgb2YgcHJvdmlkZXJzLCB0aGUgcmV0dXJuZWQgaW5qZWN0b3Igd2lsbCBiZSB0aGUgb25lIGNyZWF0ZWQgZnJvbVxuICogdGhvc2UuIElmIGl0IGRvZXMgbm90IGV4aXN0LCB0aGUgcmV0dXJuZWQgaW5qZWN0b3IgbWF5IGNvbWUgZnJvbSB0aGUgcGFyZW50cywgd2hpY2ggbWF5IGJlIGZyb20gYVxuICogbG9hZGVkIGNvbmZpZyBvciB0aGVpciBzdGF0aWMgcHJvdmlkZXJzLlxuICpcbiAqIFJldHVybnMgYG51bGxgIGlmIHRoZXJlIGlzIG5laXRoZXIgdGhpcyBub3IgYW55IHBhcmVudHMgaGF2ZSBhIHN0b3JlZCBpbmplY3Rvci5cbiAqXG4gKiBHZW5lcmFsbHkgdXNlZCBmb3IgcmV0cmlldmluZyB0aGUgaW5qZWN0b3IgdG8gdXNlIGZvciBnZXR0aW5nIHRva2VucyBmb3IgZ3VhcmRzL3Jlc29sdmVycyBhbmRcbiAqIGFsc28gdXNlZCBmb3IgZ2V0dGluZyB0aGUgY29ycmVjdCBpbmplY3RvciB0byB1c2UgZm9yIGNyZWF0aW5nIGNvbXBvbmVudHMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRDbG9zZXN0Um91dGVJbmplY3RvcihzbmFwc2hvdDogQWN0aXZhdGVkUm91dGVTbmFwc2hvdCk6IEVudmlyb25tZW50SW5qZWN0b3J8XG4gICAgbnVsbCB7XG4gIGlmICghc25hcHNob3QpIHJldHVybiBudWxsO1xuXG4gIC8vIElmIHRoZSBjdXJyZW50IHJvdXRlIGhhcyBpdHMgb3duIGluamVjdG9yLCB3aGljaCBpcyBjcmVhdGVkIGZyb20gdGhlIHN0YXRpYyBwcm92aWRlcnMgb24gdGhlXG4gIC8vIHJvdXRlIGl0c2VsZiwgd2Ugc2hvdWxkIHVzZSB0aGF0LiBPdGhlcndpc2UsIHdlIHN0YXJ0IGF0IHRoZSBwYXJlbnQgc2luY2Ugd2UgZG8gbm90IHdhbnQgdG9cbiAgLy8gaW5jbHVkZSB0aGUgbGF6eSBsb2FkZWQgaW5qZWN0b3IgZnJvbSB0aGlzIHJvdXRlLlxuICBpZiAoc25hcHNob3Qucm91dGVDb25maWc/Ll9pbmplY3Rvcikge1xuICAgIHJldHVybiBzbmFwc2hvdC5yb3V0ZUNvbmZpZy5faW5qZWN0b3I7XG4gIH1cblxuICBmb3IgKGxldCBzID0gc25hcHNob3QucGFyZW50OyBzOyBzID0gcy5wYXJlbnQpIHtcbiAgICBjb25zdCByb3V0ZSA9IHMucm91dGVDb25maWc7XG4gICAgLy8gTm90ZSB0aGF0IHRoZSBvcmRlciBoZXJlIGlzIGltcG9ydGFudC4gYF9sb2FkZWRJbmplY3RvcmAgc3RvcmVkIG9uIHRoZSByb3V0ZSB3aXRoXG4gICAgLy8gYGxvYWRDaGlsZHJlbjogKCkgPT4gTmdNb2R1bGVgIHNvIGl0IGFwcGxpZXMgdG8gY2hpbGQgcm91dGVzIHdpdGggcHJpb3JpdHkuIFRoZSBgX2luamVjdG9yYFxuICAgIC8vIGlzIGNyZWF0ZWQgZnJvbSB0aGUgc3RhdGljIHByb3ZpZGVycyBvbiB0aGF0IHBhcmVudCByb3V0ZSwgc28gaXQgYXBwbGllcyB0byB0aGUgY2hpbGRyZW4gYXNcbiAgICAvLyB3ZWxsLCBidXQgb25seSBpZiB0aGVyZSBpcyBubyBsYXp5IGxvYWRlZCBOZ01vZHVsZVJlZiBpbmplY3Rvci5cbiAgICBpZiAocm91dGU/Ll9sb2FkZWRJbmplY3RvcikgcmV0dXJuIHJvdXRlLl9sb2FkZWRJbmplY3RvcjtcbiAgICBpZiAocm91dGU/Ll9pbmplY3RvcikgcmV0dXJuIHJvdXRlLl9pbmplY3RvcjtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuIl19
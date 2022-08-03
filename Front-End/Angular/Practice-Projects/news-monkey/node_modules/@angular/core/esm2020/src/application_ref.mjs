/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import './util/ng_jit_mode';
import { merge, Observable } from 'rxjs';
import { share } from 'rxjs/operators';
import { ApplicationInitStatus } from './application_init';
import { APP_BOOTSTRAP_LISTENER, PLATFORM_INITIALIZER } from './application_tokens';
import { getCompilerFacade } from './compiler/compiler_facade';
import { Console } from './console';
import { Injectable } from './di/injectable';
import { InjectionToken } from './di/injection_token';
import { Injector } from './di/injector';
import { EnvironmentInjector } from './di/r3_injector';
import { INJECTOR_SCOPE } from './di/scope';
import { ErrorHandler } from './error_handler';
import { formatRuntimeError, RuntimeError } from './errors';
import { DEFAULT_LOCALE_ID } from './i18n/localization';
import { LOCALE_ID } from './i18n/tokens';
import { COMPILER_OPTIONS } from './linker/compiler';
import { ComponentFactory } from './linker/component_factory';
import { ComponentFactoryResolver } from './linker/component_factory_resolver';
import { NgModuleRef } from './linker/ng_module_factory';
import { isComponentResourceResolutionQueueEmpty, resolveComponentResources } from './metadata/resource_loading';
import { assertNgModuleType } from './render3/assert';
import { assertStandaloneComponentType } from './render3/errors';
import { setLocaleId } from './render3/i18n/i18n_locale_id';
import { setJitOptions } from './render3/jit/jit_options';
import { isStandalone } from './render3/jit/module';
import { createEnvironmentInjector, NgModuleFactory as R3NgModuleFactory } from './render3/ng_module_ref';
import { publishDefaultGlobalUtils as _publishDefaultGlobalUtils } from './render3/util/global_utils';
import { TESTABILITY } from './testability/testability';
import { isPromise } from './util/lang';
import { scheduleMicroTask } from './util/microtask';
import { stringify } from './util/stringify';
import { NgZone, NoopNgZone } from './zone/ng_zone';
import * as i0 from "./r3_symbols";
import * as i1 from "./di/injector";
import * as i2 from "./zone/ng_zone";
import * as i3 from "./di/r3_injector";
import * as i4 from "./error_handler";
let _platformInjector = null;
/**
 * Internal token to indicate whether having multiple bootstrapped platform should be allowed (only
 * one bootstrapped platform is allowed by default). This token helps to support SSR scenarios.
 */
export const ALLOW_MULTIPLE_PLATFORMS = new InjectionToken('AllowMultipleToken');
/**
 * Internal token that allows to register extra callbacks that should be invoked during the
 * `PlatformRef.destroy` operation. This token is needed to avoid a direct reference to the
 * `PlatformRef` class (i.e. register the callback via `PlatformRef.onDestroy`), thus making the
 * entire class tree-shakeable.
 */
const PLATFORM_DESTROY_LISTENERS = new InjectionToken('PlatformDestroyListeners');
const NG_DEV_MODE = typeof ngDevMode === 'undefined' || ngDevMode;
export function compileNgModuleFactory(injector, options, moduleType) {
    ngDevMode && assertNgModuleType(moduleType);
    const moduleFactory = new R3NgModuleFactory(moduleType);
    // All of the logic below is irrelevant for AOT-compiled code.
    if (typeof ngJitMode !== 'undefined' && !ngJitMode) {
        return Promise.resolve(moduleFactory);
    }
    const compilerOptions = injector.get(COMPILER_OPTIONS, []).concat(options);
    // Configure the compiler to use the provided options. This call may fail when multiple modules
    // are bootstrapped with incompatible options, as a component can only be compiled according to
    // a single set of options.
    setJitOptions({
        defaultEncapsulation: _lastDefined(compilerOptions.map(opts => opts.defaultEncapsulation)),
        preserveWhitespaces: _lastDefined(compilerOptions.map(opts => opts.preserveWhitespaces)),
    });
    if (isComponentResourceResolutionQueueEmpty()) {
        return Promise.resolve(moduleFactory);
    }
    const compilerProviders = _mergeArrays(compilerOptions.map(o => o.providers));
    // In case there are no compiler providers, we just return the module factory as
    // there won't be any resource loader. This can happen with Ivy, because AOT compiled
    // modules can be still passed through "bootstrapModule". In that case we shouldn't
    // unnecessarily require the JIT compiler.
    if (compilerProviders.length === 0) {
        return Promise.resolve(moduleFactory);
    }
    const compiler = getCompilerFacade({
        usage: 0 /* JitCompilerUsage.Decorator */,
        kind: 'NgModule',
        type: moduleType,
    });
    const compilerInjector = Injector.create({ providers: compilerProviders });
    const resourceLoader = compilerInjector.get(compiler.ResourceLoader);
    // The resource loader can also return a string while the "resolveComponentResources"
    // always expects a promise. Therefore we need to wrap the returned value in a promise.
    return resolveComponentResources(url => Promise.resolve(resourceLoader.get(url)))
        .then(() => moduleFactory);
}
export function publishDefaultGlobalUtils() {
    ngDevMode && _publishDefaultGlobalUtils();
}
export function isBoundToModule(cf) {
    return cf.isBoundToModule;
}
/**
 * A token for third-party components that can register themselves with NgProbe.
 *
 * @publicApi
 */
export class NgProbeToken {
    constructor(name, token) {
        this.name = name;
        this.token = token;
    }
}
/**
 * Creates a platform.
 * Platforms must be created on launch using this function.
 *
 * @publicApi
 */
export function createPlatform(injector) {
    if (_platformInjector && !_platformInjector.get(ALLOW_MULTIPLE_PLATFORMS, false)) {
        throw new RuntimeError(400 /* RuntimeErrorCode.MULTIPLE_PLATFORMS */, ngDevMode &&
            'There can be only one platform. Destroy the previous one to create a new one.');
    }
    publishDefaultGlobalUtils();
    _platformInjector = injector;
    const platform = injector.get(PlatformRef);
    runPlatformInitializers(injector);
    return platform;
}
/**
 * The goal of this function is to bootstrap a platform injector,
 * but avoid referencing `PlatformRef` class.
 * This function is needed for bootstrapping a Standalone Component.
 */
export function createOrReusePlatformInjector(providers = []) {
    // If a platform injector already exists, it means that the platform
    // is already bootstrapped and no additional actions are required.
    if (_platformInjector)
        return _platformInjector;
    // Otherwise, setup a new platform injector and run platform initializers.
    const injector = createPlatformInjector(providers);
    _platformInjector = injector;
    publishDefaultGlobalUtils();
    runPlatformInitializers(injector);
    return injector;
}
export function runPlatformInitializers(injector) {
    const inits = injector.get(PLATFORM_INITIALIZER, null);
    if (inits) {
        inits.forEach((init) => init());
    }
}
/**
 * Internal bootstrap application API that implements the core bootstrap logic.
 *
 * Platforms (such as `platform-browser`) may require different set of application and platform
 * providers for an application to function correctly. As a result, platforms may use this function
 * internally and supply the necessary providers during the bootstrap, while exposing
 * platform-specific APIs as a part of their public API.
 *
 * @returns A promise that returns an `ApplicationRef` instance once resolved.
 */
export function internalBootstrapApplication(config) {
    const { rootComponent, appProviders, platformProviders } = config;
    NG_DEV_MODE && assertStandaloneComponentType(rootComponent);
    const platformInjector = createOrReusePlatformInjector(platformProviders);
    const ngZone = new NgZone(getNgZoneOptions());
    return ngZone.run(() => {
        // Create root application injector based on a set of providers configured at the platform
        // bootstrap level as well as providers passed to the bootstrap call by a user.
        const allAppProviders = [
            { provide: NgZone, useValue: ngZone },
            ...(appProviders || []), //
        ];
        const appInjector = createEnvironmentInjector(allAppProviders, platformInjector, 'Environment Injector');
        const exceptionHandler = appInjector.get(ErrorHandler, null);
        if (NG_DEV_MODE && !exceptionHandler) {
            throw new RuntimeError(402 /* RuntimeErrorCode.ERROR_HANDLER_NOT_FOUND */, 'No `ErrorHandler` found in the Dependency Injection tree.');
        }
        let onErrorSubscription;
        ngZone.runOutsideAngular(() => {
            onErrorSubscription = ngZone.onError.subscribe({
                next: (error) => {
                    exceptionHandler.handleError(error);
                }
            });
        });
        return _callAndReportToErrorHandler(exceptionHandler, ngZone, () => {
            const initStatus = appInjector.get(ApplicationInitStatus);
            initStatus.runInitializers();
            return initStatus.donePromise.then(() => {
                const localeId = appInjector.get(LOCALE_ID, DEFAULT_LOCALE_ID);
                setLocaleId(localeId || DEFAULT_LOCALE_ID);
                const appRef = appInjector.get(ApplicationRef);
                // If the whole platform is destroyed, invoke the `destroy` method
                // for all bootstrapped applications as well.
                const destroyListener = () => appRef.destroy();
                const onPlatformDestroyListeners = platformInjector.get(PLATFORM_DESTROY_LISTENERS, null);
                onPlatformDestroyListeners?.add(destroyListener);
                appRef.onDestroy(() => {
                    onPlatformDestroyListeners?.delete(destroyListener);
                    onErrorSubscription.unsubscribe();
                });
                appRef.bootstrap(rootComponent);
                return appRef;
            });
        });
    });
}
/**
 * Creates a factory for a platform. Can be used to provide or override `Providers` specific to
 * your application's runtime needs, such as `PLATFORM_INITIALIZER` and `PLATFORM_ID`.
 * @param parentPlatformFactory Another platform factory to modify. Allows you to compose factories
 * to build up configurations that might be required by different libraries or parts of the
 * application.
 * @param name Identifies the new platform factory.
 * @param providers A set of dependency providers for platforms created with the new factory.
 *
 * @publicApi
 */
export function createPlatformFactory(parentPlatformFactory, name, providers = []) {
    const desc = `Platform: ${name}`;
    const marker = new InjectionToken(desc);
    return (extraProviders = []) => {
        let platform = getPlatform();
        if (!platform || platform.injector.get(ALLOW_MULTIPLE_PLATFORMS, false)) {
            const platformProviders = [
                ...providers,
                ...extraProviders,
                { provide: marker, useValue: true }
            ];
            if (parentPlatformFactory) {
                parentPlatformFactory(platformProviders);
            }
            else {
                createPlatform(createPlatformInjector(platformProviders, desc));
            }
        }
        return assertPlatform(marker);
    };
}
/**
 * Checks that there is currently a platform that contains the given token as a provider.
 *
 * @publicApi
 */
export function assertPlatform(requiredToken) {
    const platform = getPlatform();
    if (!platform) {
        throw new RuntimeError(401 /* RuntimeErrorCode.PLATFORM_NOT_FOUND */, ngDevMode && 'No platform exists!');
    }
    if ((typeof ngDevMode === 'undefined' || ngDevMode) &&
        !platform.injector.get(requiredToken, null)) {
        throw new RuntimeError(400 /* RuntimeErrorCode.MULTIPLE_PLATFORMS */, 'A platform with a different configuration has been created. Please destroy it first.');
    }
    return platform;
}
/**
 * Helper function to create an instance of a platform injector (that maintains the 'platform'
 * scope).
 */
export function createPlatformInjector(providers = [], name) {
    return Injector.create({
        name,
        providers: [
            { provide: INJECTOR_SCOPE, useValue: 'platform' },
            { provide: PLATFORM_DESTROY_LISTENERS, useValue: new Set([() => _platformInjector = null]) },
            ...providers
        ],
    });
}
/**
 * Destroys the current Angular platform and all Angular applications on the page.
 * Destroys all modules and listeners registered with the platform.
 *
 * @publicApi
 */
export function destroyPlatform() {
    getPlatform()?.destroy();
}
/**
 * Returns the current platform.
 *
 * @publicApi
 */
export function getPlatform() {
    return _platformInjector?.get(PlatformRef) ?? null;
}
/**
 * The Angular platform is the entry point for Angular on a web page.
 * Each page has exactly one platform. Services (such as reflection) which are common
 * to every Angular application running on the page are bound in its scope.
 * A page's platform is initialized implicitly when a platform is created using a platform
 * factory such as `PlatformBrowser`, or explicitly by calling the `createPlatform()` function.
 *
 * @publicApi
 */
export class PlatformRef {
    /** @internal */
    constructor(_injector) {
        this._injector = _injector;
        this._modules = [];
        this._destroyListeners = [];
        this._destroyed = false;
    }
    /**
     * Creates an instance of an `@NgModule` for the given platform.
     *
     * @deprecated Passing NgModule factories as the `PlatformRef.bootstrapModuleFactory` function
     *     argument is deprecated. Use the `PlatformRef.bootstrapModule` API instead.
     */
    bootstrapModuleFactory(moduleFactory, options) {
        // Note: We need to create the NgZone _before_ we instantiate the module,
        // as instantiating the module creates some providers eagerly.
        // So we create a mini parent injector that just contains the new NgZone and
        // pass that as parent to the NgModuleFactory.
        const ngZone = getNgZone(options?.ngZone, getNgZoneOptions(options));
        const providers = [{ provide: NgZone, useValue: ngZone }];
        // Note: Create ngZoneInjector within ngZone.run so that all of the instantiated services are
        // created within the Angular zone
        // Do not try to replace ngZone.run with ApplicationRef#run because ApplicationRef would then be
        // created outside of the Angular zone.
        return ngZone.run(() => {
            const ngZoneInjector = Injector.create({ providers: providers, parent: this.injector, name: moduleFactory.moduleType.name });
            const moduleRef = moduleFactory.create(ngZoneInjector);
            const exceptionHandler = moduleRef.injector.get(ErrorHandler, null);
            if (!exceptionHandler) {
                throw new RuntimeError(402 /* RuntimeErrorCode.ERROR_HANDLER_NOT_FOUND */, ngDevMode && 'No ErrorHandler. Is platform module (BrowserModule) included?');
            }
            ngZone.runOutsideAngular(() => {
                const subscription = ngZone.onError.subscribe({
                    next: (error) => {
                        exceptionHandler.handleError(error);
                    }
                });
                moduleRef.onDestroy(() => {
                    remove(this._modules, moduleRef);
                    subscription.unsubscribe();
                });
            });
            return _callAndReportToErrorHandler(exceptionHandler, ngZone, () => {
                const initStatus = moduleRef.injector.get(ApplicationInitStatus);
                initStatus.runInitializers();
                return initStatus.donePromise.then(() => {
                    // If the `LOCALE_ID` provider is defined at bootstrap then we set the value for ivy
                    const localeId = moduleRef.injector.get(LOCALE_ID, DEFAULT_LOCALE_ID);
                    setLocaleId(localeId || DEFAULT_LOCALE_ID);
                    this._moduleDoBootstrap(moduleRef);
                    return moduleRef;
                });
            });
        });
    }
    /**
     * Creates an instance of an `@NgModule` for a given platform.
     *
     * @usageNotes
     * ### Simple Example
     *
     * ```typescript
     * @NgModule({
     *   imports: [BrowserModule]
     * })
     * class MyModule {}
     *
     * let moduleRef = platformBrowser().bootstrapModule(MyModule);
     * ```
     *
     */
    bootstrapModule(moduleType, compilerOptions = []) {
        const options = optionsReducer({}, compilerOptions);
        return compileNgModuleFactory(this.injector, options, moduleType)
            .then(moduleFactory => this.bootstrapModuleFactory(moduleFactory, options));
    }
    _moduleDoBootstrap(moduleRef) {
        const appRef = moduleRef.injector.get(ApplicationRef);
        if (moduleRef._bootstrapComponents.length > 0) {
            moduleRef._bootstrapComponents.forEach(f => appRef.bootstrap(f));
        }
        else if (moduleRef.instance.ngDoBootstrap) {
            moduleRef.instance.ngDoBootstrap(appRef);
        }
        else {
            throw new RuntimeError(403 /* RuntimeErrorCode.BOOTSTRAP_COMPONENTS_NOT_FOUND */, ngDevMode &&
                `The module ${stringify(moduleRef.instance.constructor)} was bootstrapped, ` +
                    `but it does not declare "@NgModule.bootstrap" components nor a "ngDoBootstrap" method. ` +
                    `Please define one of these.`);
        }
        this._modules.push(moduleRef);
    }
    /**
     * Registers a listener to be called when the platform is destroyed.
     */
    onDestroy(callback) {
        this._destroyListeners.push(callback);
    }
    /**
     * Retrieves the platform {@link Injector}, which is the parent injector for
     * every Angular application on the page and provides singleton providers.
     */
    get injector() {
        return this._injector;
    }
    /**
     * Destroys the current Angular platform and all Angular applications on the page.
     * Destroys all modules and listeners registered with the platform.
     */
    destroy() {
        if (this._destroyed) {
            throw new RuntimeError(404 /* RuntimeErrorCode.PLATFORM_ALREADY_DESTROYED */, ngDevMode && 'The platform has already been destroyed!');
        }
        this._modules.slice().forEach(module => module.destroy());
        this._destroyListeners.forEach(listener => listener());
        const destroyListeners = this._injector.get(PLATFORM_DESTROY_LISTENERS, null);
        if (destroyListeners) {
            destroyListeners.forEach(listener => listener());
            destroyListeners.clear();
        }
        this._destroyed = true;
    }
    /**
     * Indicates whether this instance was destroyed.
     */
    get destroyed() {
        return this._destroyed;
    }
}
PlatformRef.ɵfac = function PlatformRef_Factory(t) { return new (t || PlatformRef)(i0.ɵɵinject(i1.Injector)); };
PlatformRef.ɵprov = /*@__PURE__*/ i0.ɵɵdefineInjectable({ token: PlatformRef, factory: PlatformRef.ɵfac, providedIn: 'platform' });
(function () { (typeof ngDevMode === "undefined" || ngDevMode) && i0.setClassMetadata(PlatformRef, [{
        type: Injectable,
        args: [{ providedIn: 'platform' }]
    }], function () { return [{ type: i1.Injector }]; }, null); })();
// Transforms a set of `BootstrapOptions` (supported by the NgModule-based bootstrap APIs) ->
// `NgZoneOptions` that are recognized by the NgZone constructor. Passing no options will result in
// a set of default options returned.
function getNgZoneOptions(options) {
    return {
        enableLongStackTrace: typeof ngDevMode === 'undefined' ? false : !!ngDevMode,
        shouldCoalesceEventChangeDetection: !!(options && options.ngZoneEventCoalescing) || false,
        shouldCoalesceRunChangeDetection: !!(options && options.ngZoneRunCoalescing) || false,
    };
}
function getNgZone(ngZoneToUse, options) {
    let ngZone;
    if (ngZoneToUse === 'noop') {
        ngZone = new NoopNgZone();
    }
    else {
        ngZone = (ngZoneToUse === 'zone.js' ? undefined : ngZoneToUse) || new NgZone(options);
    }
    return ngZone;
}
function _callAndReportToErrorHandler(errorHandler, ngZone, callback) {
    try {
        const result = callback();
        if (isPromise(result)) {
            return result.catch((e) => {
                ngZone.runOutsideAngular(() => errorHandler.handleError(e));
                // rethrow as the exception handler might not do it
                throw e;
            });
        }
        return result;
    }
    catch (e) {
        ngZone.runOutsideAngular(() => errorHandler.handleError(e));
        // rethrow as the exception handler might not do it
        throw e;
    }
}
function optionsReducer(dst, objs) {
    if (Array.isArray(objs)) {
        dst = objs.reduce(optionsReducer, dst);
    }
    else {
        dst = { ...dst, ...objs };
    }
    return dst;
}
/**
 * A reference to an Angular application running on a page.
 *
 * @usageNotes
 *
 * {@a is-stable-examples}
 * ### isStable examples and caveats
 *
 * Note two important points about `isStable`, demonstrated in the examples below:
 * - the application will never be stable if you start any kind
 * of recurrent asynchronous task when the application starts
 * (for example for a polling process, started with a `setInterval`, a `setTimeout`
 * or using RxJS operators like `interval`);
 * - the `isStable` Observable runs outside of the Angular zone.
 *
 * Let's imagine that you start a recurrent task
 * (here incrementing a counter, using RxJS `interval`),
 * and at the same time subscribe to `isStable`.
 *
 * ```
 * constructor(appRef: ApplicationRef) {
 *   appRef.isStable.pipe(
 *      filter(stable => stable)
 *   ).subscribe(() => console.log('App is stable now');
 *   interval(1000).subscribe(counter => console.log(counter));
 * }
 * ```
 * In this example, `isStable` will never emit `true`,
 * and the trace "App is stable now" will never get logged.
 *
 * If you want to execute something when the app is stable,
 * you have to wait for the application to be stable
 * before starting your polling process.
 *
 * ```
 * constructor(appRef: ApplicationRef) {
 *   appRef.isStable.pipe(
 *     first(stable => stable),
 *     tap(stable => console.log('App is stable now')),
 *     switchMap(() => interval(1000))
 *   ).subscribe(counter => console.log(counter));
 * }
 * ```
 * In this example, the trace "App is stable now" will be logged
 * and then the counter starts incrementing every second.
 *
 * Note also that this Observable runs outside of the Angular zone,
 * which means that the code in the subscription
 * to this Observable will not trigger the change detection.
 *
 * Let's imagine that instead of logging the counter value,
 * you update a field of your component
 * and display it in its template.
 *
 * ```
 * constructor(appRef: ApplicationRef) {
 *   appRef.isStable.pipe(
 *     first(stable => stable),
 *     switchMap(() => interval(1000))
 *   ).subscribe(counter => this.value = counter);
 * }
 * ```
 * As the `isStable` Observable runs outside the zone,
 * the `value` field will be updated properly,
 * but the template will not be refreshed!
 *
 * You'll have to manually trigger the change detection to update the template.
 *
 * ```
 * constructor(appRef: ApplicationRef, cd: ChangeDetectorRef) {
 *   appRef.isStable.pipe(
 *     first(stable => stable),
 *     switchMap(() => interval(1000))
 *   ).subscribe(counter => {
 *     this.value = counter;
 *     cd.detectChanges();
 *   });
 * }
 * ```
 *
 * Or make the subscription callback run inside the zone.
 *
 * ```
 * constructor(appRef: ApplicationRef, zone: NgZone) {
 *   appRef.isStable.pipe(
 *     first(stable => stable),
 *     switchMap(() => interval(1000))
 *   ).subscribe(counter => zone.run(() => this.value = counter));
 * }
 * ```
 *
 * @publicApi
 */
export class ApplicationRef {
    /** @internal */
    constructor(_zone, _injector, _exceptionHandler) {
        this._zone = _zone;
        this._injector = _injector;
        this._exceptionHandler = _exceptionHandler;
        /** @internal */
        this._bootstrapListeners = [];
        this._views = [];
        this._runningTick = false;
        this._stable = true;
        this._destroyed = false;
        this._destroyListeners = [];
        /**
         * Get a list of component types registered to this application.
         * This list is populated even before the component is created.
         */
        this.componentTypes = [];
        /**
         * Get a list of components registered to this application.
         */
        this.components = [];
        this._onMicrotaskEmptySubscription = this._zone.onMicrotaskEmpty.subscribe({
            next: () => {
                this._zone.run(() => {
                    this.tick();
                });
            }
        });
        const isCurrentlyStable = new Observable((observer) => {
            this._stable = this._zone.isStable && !this._zone.hasPendingMacrotasks &&
                !this._zone.hasPendingMicrotasks;
            this._zone.runOutsideAngular(() => {
                observer.next(this._stable);
                observer.complete();
            });
        });
        const isStable = new Observable((observer) => {
            // Create the subscription to onStable outside the Angular Zone so that
            // the callback is run outside the Angular Zone.
            let stableSub;
            this._zone.runOutsideAngular(() => {
                stableSub = this._zone.onStable.subscribe(() => {
                    NgZone.assertNotInAngularZone();
                    // Check whether there are no pending macro/micro tasks in the next tick
                    // to allow for NgZone to update the state.
                    scheduleMicroTask(() => {
                        if (!this._stable && !this._zone.hasPendingMacrotasks &&
                            !this._zone.hasPendingMicrotasks) {
                            this._stable = true;
                            observer.next(true);
                        }
                    });
                });
            });
            const unstableSub = this._zone.onUnstable.subscribe(() => {
                NgZone.assertInAngularZone();
                if (this._stable) {
                    this._stable = false;
                    this._zone.runOutsideAngular(() => {
                        observer.next(false);
                    });
                }
            });
            return () => {
                stableSub.unsubscribe();
                unstableSub.unsubscribe();
            };
        });
        this.isStable =
            merge(isCurrentlyStable, isStable.pipe(share()));
    }
    /**
     * Indicates whether this instance was destroyed.
     */
    get destroyed() {
        return this._destroyed;
    }
    /**
     * The `EnvironmentInjector` used to create this application.
     */
    get injector() {
        return this._injector;
    }
    /**
     * Bootstrap a component onto the element identified by its selector or, optionally, to a
     * specified element.
     *
     * @usageNotes
     * ### Bootstrap process
     *
     * When bootstrapping a component, Angular mounts it onto a target DOM element
     * and kicks off automatic change detection. The target DOM element can be
     * provided using the `rootSelectorOrNode` argument.
     *
     * If the target DOM element is not provided, Angular tries to find one on a page
     * using the `selector` of the component that is being bootstrapped
     * (first matched element is used).
     *
     * ### Example
     *
     * Generally, we define the component to bootstrap in the `bootstrap` array of `NgModule`,
     * but it requires us to know the component while writing the application code.
     *
     * Imagine a situation where we have to wait for an API call to decide about the component to
     * bootstrap. We can use the `ngDoBootstrap` hook of the `NgModule` and call this method to
     * dynamically bootstrap a component.
     *
     * {@example core/ts/platform/platform.ts region='componentSelector'}
     *
     * Optionally, a component can be mounted onto a DOM element that does not match the
     * selector of the bootstrapped component.
     *
     * In the following example, we are providing a CSS selector to match the target element.
     *
     * {@example core/ts/platform/platform.ts region='cssSelector'}
     *
     * While in this example, we are providing reference to a DOM node.
     *
     * {@example core/ts/platform/platform.ts region='domNode'}
     */
    bootstrap(componentOrFactory, rootSelectorOrNode) {
        NG_DEV_MODE && this.warnIfDestroyed();
        const isComponentFactory = componentOrFactory instanceof ComponentFactory;
        const initStatus = this._injector.get(ApplicationInitStatus);
        if (!initStatus.done) {
            const standalone = !isComponentFactory && isStandalone(componentOrFactory);
            const errorMessage = 'Cannot bootstrap as there are still asynchronous initializers running.' +
                (standalone ? '' :
                    ' Bootstrap components in the `ngDoBootstrap` method of the root module.');
            throw new RuntimeError(405 /* RuntimeErrorCode.ASYNC_INITIALIZERS_STILL_RUNNING */, NG_DEV_MODE && errorMessage);
        }
        let componentFactory;
        if (isComponentFactory) {
            componentFactory = componentOrFactory;
        }
        else {
            const resolver = this._injector.get(ComponentFactoryResolver);
            componentFactory = resolver.resolveComponentFactory(componentOrFactory);
        }
        this.componentTypes.push(componentFactory.componentType);
        // Create a factory associated with the current module if it's not bound to some other
        const ngModule = isBoundToModule(componentFactory) ? undefined : this._injector.get(NgModuleRef);
        const selectorOrNode = rootSelectorOrNode || componentFactory.selector;
        const compRef = componentFactory.create(Injector.NULL, [], selectorOrNode, ngModule);
        const nativeElement = compRef.location.nativeElement;
        const testability = compRef.injector.get(TESTABILITY, null);
        testability?.registerApplication(nativeElement);
        compRef.onDestroy(() => {
            this.detachView(compRef.hostView);
            remove(this.components, compRef);
            testability?.unregisterApplication(nativeElement);
        });
        this._loadComponent(compRef);
        if (typeof ngDevMode === 'undefined' || ngDevMode) {
            const _console = this._injector.get(Console);
            _console.log(`Angular is running in development mode. Call enableProdMode() to enable production mode.`);
        }
        return compRef;
    }
    /**
     * Invoke this method to explicitly process change detection and its side-effects.
     *
     * In development mode, `tick()` also performs a second change detection cycle to ensure that no
     * further changes are detected. If additional changes are picked up during this second cycle,
     * bindings in the app have side-effects that cannot be resolved in a single change detection
     * pass.
     * In this case, Angular throws an error, since an Angular application can only have one change
     * detection pass during which all change detection must complete.
     */
    tick() {
        NG_DEV_MODE && this.warnIfDestroyed();
        if (this._runningTick) {
            throw new RuntimeError(101 /* RuntimeErrorCode.RECURSIVE_APPLICATION_REF_TICK */, ngDevMode && 'ApplicationRef.tick is called recursively');
        }
        try {
            this._runningTick = true;
            for (let view of this._views) {
                view.detectChanges();
            }
            if (typeof ngDevMode === 'undefined' || ngDevMode) {
                for (let view of this._views) {
                    view.checkNoChanges();
                }
            }
        }
        catch (e) {
            // Attention: Don't rethrow as it could cancel subscriptions to Observables!
            this._zone.runOutsideAngular(() => this._exceptionHandler.handleError(e));
        }
        finally {
            this._runningTick = false;
        }
    }
    /**
     * Attaches a view so that it will be dirty checked.
     * The view will be automatically detached when it is destroyed.
     * This will throw if the view is already attached to a ViewContainer.
     */
    attachView(viewRef) {
        NG_DEV_MODE && this.warnIfDestroyed();
        const view = viewRef;
        this._views.push(view);
        view.attachToAppRef(this);
    }
    /**
     * Detaches a view from dirty checking again.
     */
    detachView(viewRef) {
        NG_DEV_MODE && this.warnIfDestroyed();
        const view = viewRef;
        remove(this._views, view);
        view.detachFromAppRef();
    }
    _loadComponent(componentRef) {
        this.attachView(componentRef.hostView);
        this.tick();
        this.components.push(componentRef);
        // Get the listeners lazily to prevent DI cycles.
        const listeners = this._injector.get(APP_BOOTSTRAP_LISTENER, []).concat(this._bootstrapListeners);
        listeners.forEach((listener) => listener(componentRef));
    }
    /** @internal */
    ngOnDestroy() {
        if (this._destroyed)
            return;
        try {
            // Call all the lifecycle hooks.
            this._destroyListeners.forEach(listener => listener());
            // Destroy all registered views.
            this._views.slice().forEach((view) => view.destroy());
            this._onMicrotaskEmptySubscription.unsubscribe();
        }
        finally {
            // Indicate that this instance is destroyed.
            this._destroyed = true;
            // Release all references.
            this._views = [];
            this._bootstrapListeners = [];
            this._destroyListeners = [];
        }
    }
    /**
     * Registers a listener to be called when an instance is destroyed.
     *
     * @param callback A callback function to add as a listener.
     * @returns A function which unregisters a listener.
     *
     * @internal
     */
    onDestroy(callback) {
        NG_DEV_MODE && this.warnIfDestroyed();
        this._destroyListeners.push(callback);
        return () => remove(this._destroyListeners, callback);
    }
    /**
     * Destroys an Angular application represented by this `ApplicationRef`. Calling this function
     * will destroy the associated environment injectors as well as all the bootstrapped components
     * with their views.
     */
    destroy() {
        if (this._destroyed) {
            throw new RuntimeError(406 /* RuntimeErrorCode.APPLICATION_REF_ALREADY_DESTROYED */, ngDevMode && 'This instance of the `ApplicationRef` has already been destroyed.');
        }
        const injector = this._injector;
        // Check that this injector instance supports destroy operation.
        if (injector.destroy && !injector.destroyed) {
            // Destroying an underlying injector will trigger the `ngOnDestroy` lifecycle
            // hook, which invokes the remaining cleanup actions.
            injector.destroy();
        }
    }
    /**
     * Returns the number of attached views.
     */
    get viewCount() {
        return this._views.length;
    }
    warnIfDestroyed() {
        if (NG_DEV_MODE && this._destroyed) {
            console.warn(formatRuntimeError(406 /* RuntimeErrorCode.APPLICATION_REF_ALREADY_DESTROYED */, 'This instance of the `ApplicationRef` has already been destroyed.'));
        }
    }
}
ApplicationRef.ɵfac = function ApplicationRef_Factory(t) { return new (t || ApplicationRef)(i0.ɵɵinject(i2.NgZone), i0.ɵɵinject(i3.EnvironmentInjector), i0.ɵɵinject(i4.ErrorHandler)); };
ApplicationRef.ɵprov = /*@__PURE__*/ i0.ɵɵdefineInjectable({ token: ApplicationRef, factory: ApplicationRef.ɵfac, providedIn: 'root' });
(function () { (typeof ngDevMode === "undefined" || ngDevMode) && i0.setClassMetadata(ApplicationRef, [{
        type: Injectable,
        args: [{ providedIn: 'root' }]
    }], function () { return [{ type: i2.NgZone }, { type: i3.EnvironmentInjector }, { type: i4.ErrorHandler }]; }, null); })();
function remove(list, el) {
    const index = list.indexOf(el);
    if (index > -1) {
        list.splice(index, 1);
    }
}
function _lastDefined(args) {
    for (let i = args.length - 1; i >= 0; i--) {
        if (args[i] !== undefined) {
            return args[i];
        }
    }
    return undefined;
}
function _mergeArrays(parts) {
    const result = [];
    parts.forEach((part) => part && result.push(...part));
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb25fcmVmLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvYXBwbGljYXRpb25fcmVmLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sb0JBQW9CLENBQUM7QUFFNUIsT0FBTyxFQUFDLEtBQUssRUFBRSxVQUFVLEVBQXlCLE1BQU0sTUFBTSxDQUFDO0FBQy9ELE9BQU8sRUFBQyxLQUFLLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUVyQyxPQUFPLEVBQUMscUJBQXFCLEVBQUMsTUFBTSxvQkFBb0IsQ0FBQztBQUN6RCxPQUFPLEVBQUMsc0JBQXNCLEVBQUUsb0JBQW9CLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUNsRixPQUFPLEVBQUMsaUJBQWlCLEVBQW1CLE1BQU0sNEJBQTRCLENBQUM7QUFDL0UsT0FBTyxFQUFDLE9BQU8sRUFBQyxNQUFNLFdBQVcsQ0FBQztBQUNsQyxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0saUJBQWlCLENBQUM7QUFDM0MsT0FBTyxFQUFDLGNBQWMsRUFBQyxNQUFNLHNCQUFzQixDQUFDO0FBQ3BELE9BQU8sRUFBQyxRQUFRLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFFdkMsT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDckQsT0FBTyxFQUFDLGNBQWMsRUFBQyxNQUFNLFlBQVksQ0FBQztBQUMxQyxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0saUJBQWlCLENBQUM7QUFDN0MsT0FBTyxFQUFDLGtCQUFrQixFQUFFLFlBQVksRUFBbUIsTUFBTSxVQUFVLENBQUM7QUFDNUUsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFDdEQsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUV4QyxPQUFPLEVBQUMsZ0JBQWdCLEVBQWtCLE1BQU0s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QUFFLENBQUM7SUFDekIsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3RELE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICcuL3V0aWwvbmdfaml0X21vZGUnO1xuXG5pbXBvcnQge21lcmdlLCBPYnNlcnZhYmxlLCBPYnNlcnZlciwgU3Vic2NyaXB0aW9ufSBmcm9tICdyeGpzJztcbmltcG9ydCB7c2hhcmV9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcblxuaW1wb3J0IHtBcHBsaWNhdGlvbkluaXRTdGF0dXN9IGZyb20gJy4vYXBwbGljYXRpb25faW5pdCc7XG5pbXBvcnQge0FQUF9CT09UU1RSQVBfTElTVEVORVIsIFBMQVRGT1JNX0lOSVRJQUxJWkVSfSBmcm9tICcuL2FwcGxpY2F0aW9uX3Rva2Vucyc7XG5pbXBvcnQge2dldENvbXBpbGVyRmFjYWRlLCBKaXRDb21waWxlclVzYWdlfSBmcm9tICcuL2NvbXBpbGVyL2NvbXBpbGVyX2ZhY2FkZSc7XG5pbXBvcnQge0NvbnNvbGV9IGZyb20gJy4vY29uc29sZSc7XG5pbXBvcnQge0luamVjdGFibGV9IGZyb20gJy4vZGkvaW5qZWN0YWJsZSc7XG5pbXBvcnQge0luamVjdGlvblRva2VufSBmcm9tICcuL2RpL2luamVjdGlvbl90b2tlbic7XG5pbXBvcnQge0luamVjdG9yfSBmcm9tICcuL2RpL2luamVjdG9yJztcbmltcG9ydCB7SW1wb3J0ZWROZ01vZHVsZVByb3ZpZGVycywgUHJvdmlkZXIsIFN0YXRpY1Byb3ZpZGVyfSBmcm9tICcuL2RpL2ludGVyZmFjZS9wcm92aWRlcic7XG5pbXBvcnQge0Vudmlyb25tZW50SW5qZWN0b3J9IGZyb20gJy4vZGkvcjNfaW5qZWN0b3InO1xuaW1wb3J0IHtJTkpFQ1RPUl9TQ09QRX0gZnJvbSAnLi9kaS9zY29wZSc7XG5pbXBvcnQge0Vycm9ySGFuZGxlcn0gZnJvbSAnLi9lcnJvcl9oYW5kbGVyJztcbmltcG9ydCB7Zm9ybWF0UnVudGltZUVycm9yLCBSdW50aW1lRXJyb3IsIFJ1bnRpbWVFcnJvckNvZGV9IGZyb20gJy4vZXJyb3JzJztcbmltcG9ydCB7REVGQVVMVF9MT0NBTEVfSUR9IGZyb20gJy4vaTE4bi9sb2NhbGl6YXRpb24nO1xuaW1wb3J0IHtMT0NBTEVfSUR9IGZyb20gJy4vaTE4bi90b2tlbnMnO1xuaW1wb3J0IHtUeXBlfSBmcm9tICcuL2ludGVyZmFjZS90eXBlJztcbmltcG9ydCB7Q09NUElMRVJfT1BUSU9OUywgQ29tcGlsZXJPcHRpb25zfSBmcm9tICcuL2xpbmtlci9jb21waWxlcic7XG5pbXBvcnQge0NvbXBvbmVudEZhY3RvcnksIENvbXBvbmVudFJlZn0gZnJvbSAnLi9saW5rZXIvY29tcG9uZW50X2ZhY3RvcnknO1xuaW1wb3J0IHtDb21wb25lbnRGYWN0b3J5UmVzb2x2ZXJ9IGZyb20gJy4vbGlua2VyL2NvbXBvbmVudF9mYWN0b3J5X3Jlc29sdmVyJztcbmltcG9ydCB7SW50ZXJuYWxOZ01vZHVsZVJlZiwgTmdNb2R1bGVGYWN0b3J5LCBOZ01vZHVsZVJlZn0gZnJvbSAnLi9saW5rZXIvbmdfbW9kdWxlX2ZhY3RvcnknO1xuaW1wb3J0IHtJbnRlcm5hbFZpZXdSZWYsIFZpZXdSZWZ9IGZyb20gJy4vbGlua2VyL3ZpZXdfcmVmJztcbmltcG9ydCB7aXNDb21wb25lbnRSZXNvdXJjZVJlc29sdXRpb25RdWV1ZUVtcHR5LCByZXNvbHZlQ29tcG9uZW50UmVzb3VyY2VzfSBmcm9tICcuL21ldGFkYXRhL3Jlc291cmNlX2xvYWRpbmcnO1xuaW1wb3J0IHthc3NlcnROZ01vZHVsZVR5cGV9IGZyb20gJy4vcmVuZGVyMy9hc3NlcnQnO1xuaW1wb3J0IHtDb21wb25lbnRGYWN0b3J5IGFzIFIzQ29tcG9uZW50RmFjdG9yeX0gZnJvbSAnLi9yZW5kZXIzL2NvbXBvbmVudF9yZWYnO1xuaW1wb3J0IHthc3NlcnRTdGFuZGFsb25lQ29tcG9uZW50VHlwZX0gZnJvbSAnLi9yZW5kZXIzL2Vycm9ycyc7XG5pbXBvcnQge3NldExvY2FsZUlkfSBmcm9tICcuL3JlbmRlcjMvaTE4bi9pMThuX2xvY2FsZV9pZCc7XG5pbXBvcnQge3NldEppdE9wdGlvbnN9IGZyb20gJy4vcmVuZGVyMy9qaXQvaml0X29wdGlvbnMnO1xuaW1wb3J0IHtpc1N0YW5kYWxvbmV9IGZyb20gJy4vcmVuZGVyMy9qaXQvbW9kdWxlJztcbmltcG9ydCB7Y3JlYXRlRW52aXJvbm1lbnRJbmplY3RvciwgTmdNb2R1bGVGYWN0b3J5IGFzIFIzTmdNb2R1bGVGYWN0b3J5fSBmcm9tICcuL3JlbmRlcjMvbmdfbW9kdWxlX3JlZic7XG5pbXBvcnQge3B1Ymxpc2hEZWZhdWx0R2xvYmFsVXRpbHMgYXMgX3B1Ymxpc2hEZWZhdWx0R2xvYmFsVXRpbHN9IGZyb20gJy4vcmVuZGVyMy91dGlsL2dsb2JhbF91dGlscyc7XG5pbXBvcnQge1RFU1RBQklMSVRZfSBmcm9tICcuL3Rlc3RhYmlsaXR5L3Rlc3RhYmlsaXR5JztcbmltcG9ydCB7aXNQcm9taXNlfSBmcm9tICcuL3V0aWwvbGFuZyc7XG5pbXBvcnQge3NjaGVkdWxlTWljcm9UYXNrfSBmcm9tICcuL3V0aWwvbWljcm90YXNrJztcbmltcG9ydCB7c3RyaW5naWZ5fSBmcm9tICcuL3V0aWwvc3RyaW5naWZ5JztcbmltcG9ydCB7Tmdab25lLCBOb29wTmdab25lfSBmcm9tICcuL3pvbmUvbmdfem9uZSc7XG5cbmxldCBfcGxhdGZvcm1JbmplY3RvcjogSW5qZWN0b3J8bnVsbCA9IG51bGw7XG5cbi8qKlxuICogSW50ZXJuYWwgdG9rZW4gdG8gaW5kaWNhdGUgd2hldGhlciBoYXZpbmcgbXVsdGlwbGUgYm9vdHN0cmFwcGVkIHBsYXRmb3JtIHNob3VsZCBiZSBhbGxvd2VkIChvbmx5XG4gKiBvbmUgYm9vdHN0cmFwcGVkIHBsYXRmb3JtIGlzIGFsbG93ZWQgYnkgZGVmYXVsdCkuIFRoaXMgdG9rZW4gaGVscHMgdG8gc3VwcG9ydCBTU1Igc2NlbmFyaW9zLlxuICovXG5leHBvcnQgY29uc3QgQUxMT1dfTVVMVElQTEVfUExBVEZPUk1TID0gbmV3IEluamVjdGlvblRva2VuPGJvb2xlYW4+KCdBbGxvd011bHRpcGxlVG9rZW4nKTtcblxuLyoqXG4gKiBJbnRlcm5hbCB0b2tlbiB0aGF0IGFsbG93cyB0byByZWdpc3RlciBleHRyYSBjYWxsYmFja3MgdGhhdCBzaG91bGQgYmUgaW52b2tlZCBkdXJpbmcgdGhlXG4gKiBgUGxhdGZvcm1SZWYuZGVzdHJveWAgb3BlcmF0aW9uLiBUaGlzIHRva2VuIGlzIG5lZWRlZCB0byBhdm9pZCBhIGRpcmVjdCByZWZlcmVuY2UgdG8gdGhlXG4gKiBgUGxhdGZvcm1SZWZgIGNsYXNzIChpLmUuIHJlZ2lzdGVyIHRoZSBjYWxsYmFjayB2aWEgYFBsYXRmb3JtUmVmLm9uRGVzdHJveWApLCB0aHVzIG1ha2luZyB0aGVcbiAqIGVudGlyZSBjbGFzcyB0cmVlLXNoYWtlYWJsZS5cbiAqL1xuY29uc3QgUExBVEZPUk1fREVTVFJPWV9MSVNURU5FUlMgPVxuICAgIG5ldyBJbmplY3Rpb25Ub2tlbjxTZXQ8Vm9pZEZ1bmN0aW9uPj4oJ1BsYXRmb3JtRGVzdHJveUxpc3RlbmVycycpO1xuXG5jb25zdCBOR19ERVZfTU9ERSA9IHR5cGVvZiBuZ0Rldk1vZGUgPT09ICd1bmRlZmluZWQnIHx8IG5nRGV2TW9kZTtcblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVOZ01vZHVsZUZhY3Rvcnk8TT4oXG4gICAgaW5qZWN0b3I6IEluamVjdG9yLCBvcHRpb25zOiBDb21waWxlck9wdGlvbnMsXG4gICAgbW9kdWxlVHlwZTogVHlwZTxNPik6IFByb21pc2U8TmdNb2R1bGVGYWN0b3J5PE0+PiB7XG4gIG5nRGV2TW9kZSAmJiBhc3NlcnROZ01vZHVsZVR5cGUobW9kdWxlVHlwZSk7XG5cbiAgY29uc3QgbW9kdWxlRmFjdG9yeSA9IG5ldyBSM05nTW9kdWxlRmFjdG9yeShtb2R1bGVUeXBlKTtcblxuICAvLyBBbGwgb2YgdGhlIGxvZ2ljIGJlbG93IGlzIGlycmVsZXZhbnQgZm9yIEFPVC1jb21waWxlZCBjb2RlLlxuICBpZiAodHlwZW9mIG5nSml0TW9kZSAhPT0gJ3VuZGVmaW5lZCcgJiYgIW5nSml0TW9kZSkge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUobW9kdWxlRmFjdG9yeSk7XG4gIH1cblxuICBjb25zdCBjb21waWxlck9wdGlvbnMgPSBpbmplY3Rvci5nZXQoQ09NUElMRVJfT1BUSU9OUywgW10pLmNvbmNhdChvcHRpb25zKTtcblxuICAvLyBDb25maWd1cmUgdGhlIGNvbXBpbGVyIHRvIHVzZSB0aGUgcHJvdmlkZWQgb3B0aW9ucy4gVGhpcyBjYWxsIG1heSBmYWlsIHdoZW4gbXVsdGlwbGUgbW9kdWxlc1xuICAvLyBhcmUgYm9vdHN0cmFwcGVkIHdpdGggaW5jb21wYXRpYmxlIG9wdGlvbnMsIGFzIGEgY29tcG9uZW50IGNhbiBvbmx5IGJlIGNvbXBpbGVkIGFjY29yZGluZyB0b1xuICAvLyBhIHNpbmdsZSBzZXQgb2Ygb3B0aW9ucy5cbiAgc2V0Sml0T3B0aW9ucyh7XG4gICAgZGVmYXVsdEVuY2Fwc3VsYXRpb246IF9sYXN0RGVmaW5lZChjb21waWxlck9wdGlvbnMubWFwKG9wdHMgPT4gb3B0cy5kZWZhdWx0RW5jYXBzdWxhdGlvbikpLFxuICAgIHByZXNlcnZlV2hpdGVzcGFjZXM6IF9sYXN0RGVmaW5lZChjb21waWxlck9wdGlvbnMubWFwKG9wdHMgPT4gb3B0cy5wcmVzZXJ2ZVdoaXRlc3BhY2VzKSksXG4gIH0pO1xuXG4gIGlmIChpc0NvbXBvbmVudFJlc291cmNlUmVzb2x1dGlvblF1ZXVlRW1wdHkoKSkge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUobW9kdWxlRmFjdG9yeSk7XG4gIH1cblxuICBjb25zdCBjb21waWxlclByb3ZpZGVycyA9IF9tZXJnZUFycmF5cyhjb21waWxlck9wdGlvbnMubWFwKG8gPT4gby5wcm92aWRlcnMhKSk7XG5cbiAgLy8gSW4gY2FzZSB0aGVyZSBhcmUgbm8gY29tcGlsZXIgcHJvdmlkZXJzLCB3ZSBqdXN0IHJldHVybiB0aGUgbW9kdWxlIGZhY3RvcnkgYXNcbiAgLy8gdGhlcmUgd29uJ3QgYmUgYW55IHJlc291cmNlIGxvYWRlci4gVGhpcyBjYW4gaGFwcGVuIHdpdGggSXZ5LCBiZWNhdXNlIEFPVCBjb21waWxlZFxuICAvLyBtb2R1bGVzIGNhbiBiZSBzdGlsbCBwYXNzZWQgdGhyb3VnaCBcImJvb3RzdHJhcE1vZHVsZVwiLiBJbiB0aGF0IGNhc2Ugd2Ugc2hvdWxkbid0XG4gIC8vIHVubmVjZXNzYXJpbHkgcmVxdWlyZSB0aGUgSklUIGNvbXBpbGVyLlxuICBpZiAoY29tcGlsZXJQcm92aWRlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShtb2R1bGVGYWN0b3J5KTtcbiAgfVxuXG4gIGNvbnN0IGNvbXBpbGVyID0gZ2V0Q29tcGlsZXJGYWNhZGUoe1xuICAgIHVzYWdlOiBKaXRDb21waWxlclVzYWdlLkRlY29yYXRvcixcbiAgICBraW5kOiAnTmdNb2R1bGUnLFxuICAgIHR5cGU6IG1vZHVsZVR5cGUsXG4gIH0pO1xuICBjb25zdCBjb21waWxlckluamVjdG9yID0gSW5qZWN0b3IuY3JlYXRlKHtwcm92aWRlcnM6IGNvbXBpbGVyUHJvdmlkZXJzfSk7XG4gIGNvbnN0IHJlc291cmNlTG9hZGVyID0gY29tcGlsZXJJbmplY3Rvci5nZXQoY29tcGlsZXIuUmVzb3VyY2VMb2FkZXIpO1xuICAvLyBUaGUgcmVzb3VyY2UgbG9hZGVyIGNhbiBhbHNvIHJldHVybiBhIHN0cmluZyB3aGlsZSB0aGUgXCJyZXNvbHZlQ29tcG9uZW50UmVzb3VyY2VzXCJcbiAgLy8gYWx3YXlzIGV4cGVjdHMgYSBwcm9taXNlLiBUaGVyZWZvcmUgd2UgbmVlZCB0byB3cmFwIHRoZSByZXR1cm5lZCB2YWx1ZSBpbiBhIHByb21pc2UuXG4gIHJldHVybiByZXNvbHZlQ29tcG9uZW50UmVzb3VyY2VzKHVybCA9PiBQcm9taXNlLnJlc29sdmUocmVzb3VyY2VMb2FkZXIuZ2V0KHVybCkpKVxuICAgICAgLnRoZW4oKCkgPT4gbW9kdWxlRmFjdG9yeSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwdWJsaXNoRGVmYXVsdEdsb2JhbFV0aWxzKCkge1xuICBuZ0Rldk1vZGUgJiYgX3B1Ymxpc2hEZWZhdWx0R2xvYmFsVXRpbHMoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzQm91bmRUb01vZHVsZTxDPihjZjogQ29tcG9uZW50RmFjdG9yeTxDPik6IGJvb2xlYW4ge1xuICByZXR1cm4gKGNmIGFzIFIzQ29tcG9uZW50RmFjdG9yeTxDPikuaXNCb3VuZFRvTW9kdWxlO1xufVxuXG4vKipcbiAqIEEgdG9rZW4gZm9yIHRoaXJkLXBhcnR5IGNvbXBvbmVudHMgdGhhdCBjYW4gcmVnaXN0ZXIgdGhlbXNlbHZlcyB3aXRoIE5nUHJvYmUuXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgY2xhc3MgTmdQcm9iZVRva2VuIHtcbiAgY29uc3RydWN0b3IocHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHRva2VuOiBhbnkpIHt9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIHBsYXRmb3JtLlxuICogUGxhdGZvcm1zIG11c3QgYmUgY3JlYXRlZCBvbiBsYXVuY2ggdXNpbmcgdGhpcyBmdW5jdGlvbi5cbiAqXG4gKiBAcHVibGljQXBpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVQbGF0Zm9ybShpbmplY3RvcjogSW5qZWN0b3IpOiBQbGF0Zm9ybVJlZiB7XG4gIGlmIChfcGxhdGZvcm1JbmplY3RvciAmJiAhX3BsYXRmb3JtSW5qZWN0b3IuZ2V0KEFMTE9XX01VTFRJUExFX1BMQVRGT1JNUywgZmFsc2UpKSB7XG4gICAgdGhyb3cgbmV3IFJ1bnRpbWVFcnJvcihcbiAgICAgICAgUnVudGltZUVycm9yQ29kZS5NVUxUSVBMRV9QTEFURk9STVMsXG4gICAgICAgIG5nRGV2TW9kZSAmJlxuICAgICAgICAgICAgJ1RoZXJlIGNhbiBiZSBvbmx5IG9uZSBwbGF0Zm9ybS4gRGVzdHJveSB0aGUgcHJldmlvdXMgb25lIHRvIGNyZWF0ZSBhIG5ldyBvbmUuJyk7XG4gIH1cbiAgcHVibGlzaERlZmF1bHRHbG9iYWxVdGlscygpO1xuICBfcGxhdGZvcm1JbmplY3RvciA9IGluamVjdG9yO1xuICBjb25zdCBwbGF0Zm9ybSA9IGluamVjdG9yLmdldChQbGF0Zm9ybVJlZik7XG4gIHJ1blBsYXRmb3JtSW5pdGlhbGl6ZXJzKGluamVjdG9yKTtcbiAgcmV0dXJuIHBsYXRmb3JtO1xufVxuXG4vKipcbiAqIFRoZSBnb2FsIG9mIHRoaXMgZnVuY3Rpb24gaXMgdG8gYm9vdHN0cmFwIGEgcGxhdGZvcm0gaW5qZWN0b3IsXG4gKiBidXQgYXZvaWQgcmVmZXJlbmNpbmcgYFBsYXRmb3JtUmVmYCBjbGFzcy5cbiAqIFRoaXMgZnVuY3Rpb24gaXMgbmVlZGVkIGZvciBib290c3RyYXBwaW5nIGEgU3RhbmRhbG9uZSBDb21wb25lbnQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVPclJldXNlUGxhdGZvcm1JbmplY3Rvcihwcm92aWRlcnM6IFN0YXRpY1Byb3ZpZGVyW10gPSBbXSk6IEluamVjdG9yIHtcbiAgLy8gSWYgYSBwbGF0Zm9ybSBpbmplY3RvciBhbHJlYWR5IGV4aXN0cywgaXQgbWVhbnMgdGhhdCB0aGUgcGxhdGZvcm1cbiAgLy8gaXMgYWxyZWFkeSBib290c3RyYXBwZWQgYW5kIG5vIGFkZGl0aW9uYWwgYWN0aW9ucyBhcmUgcmVxdWlyZWQuXG4gIGlmIChfcGxhdGZvcm1JbmplY3RvcikgcmV0dXJuIF9wbGF0Zm9ybUluamVjdG9yO1xuXG4gIC8vIE90aGVyd2lzZSwgc2V0dXAgYSBuZXcgcGxhdGZvcm0gaW5qZWN0b3IgYW5kIHJ1biBwbGF0Zm9ybSBpbml0aWFsaXplcnMuXG4gIGNvbnN0IGluamVjdG9yID0gY3JlYXRlUGxhdGZvcm1JbmplY3Rvcihwcm92aWRlcnMpO1xuICBfcGxhdGZvcm1JbmplY3RvciA9IGluamVjdG9yO1xuICBwdWJsaXNoRGVmYXVsdEdsb2JhbFV0aWxzKCk7XG4gIHJ1blBsYXRmb3JtSW5pdGlhbGl6ZXJzKGluamVjdG9yKTtcbiAgcmV0dXJuIGluamVjdG9yO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcnVuUGxhdGZvcm1Jbml0aWFsaXplcnMoaW5qZWN0b3I6IEluamVjdG9yKTogdm9pZCB7XG4gIGNvbnN0IGluaXRzID0gaW5qZWN0b3IuZ2V0KFBMQVRGT1JNX0lOSVRJQUxJWkVSLCBudWxsKTtcbiAgaWYgKGluaXRzKSB7XG4gICAgaW5pdHMuZm9yRWFjaCgoaW5pdDogYW55KSA9PiBpbml0KCkpO1xuICB9XG59XG5cbi8qKlxuICogSW50ZXJuYWwgYm9vdHN0cmFwIGFwcGxpY2F0aW9uIEFQSSB0aGF0IGltcGxlbWVudHMgdGhlIGNvcmUgYm9vdHN0cmFwIGxvZ2ljLlxuICpcbiAqIFBsYXRmb3JtcyAoc3VjaCBhcyBgcGxhdGZvcm0tYnJvd3NlcmApIG1heSByZXF1aXJlIGRpZmZlcmVudCBzZXQgb2YgYXBwbGljYXRpb24gYW5kIHBsYXRmb3JtXG4gKiBwcm92aWRlcnMgZm9yIGFuIGFwcGxpY2F0aW9uIHRvIGZ1bmN0aW9uIGNvcnJlY3RseS4gQXMgYSByZXN1bHQsIHBsYXRmb3JtcyBtYXkgdXNlIHRoaXMgZnVuY3Rpb25cbiAqIGludGVybmFsbHkgYW5kIHN1cHBseSB0aGUgbmVjZXNzYXJ5IHByb3ZpZGVycyBkdXJpbmcgdGhlIGJvb3RzdHJhcCwgd2hpbGUgZXhwb3NpbmdcbiAqIHBsYXRmb3JtLXNwZWNpZmljIEFQSXMgYXMgYSBwYXJ0IG9mIHRoZWlyIHB1YmxpYyBBUEkuXG4gKlxuICogQHJldHVybnMgQSBwcm9taXNlIHRoYXQgcmV0dXJucyBhbiBgQXBwbGljYXRpb25SZWZgIGluc3RhbmNlIG9uY2UgcmVzb2x2ZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbnRlcm5hbEJvb3RzdHJhcEFwcGxpY2F0aW9uKGNvbmZpZzoge1xuICByb290Q29tcG9uZW50OiBUeXBlPHVua25vd24+LFxuICBhcHBQcm92aWRlcnM/OiBBcnJheTxQcm92aWRlcnxJbXBvcnRlZE5nTW9kdWxlUHJvdmlkZXJzPixcbiAgcGxhdGZvcm1Qcm92aWRlcnM/OiBQcm92aWRlcltdLFxufSk6IFByb21pc2U8QXBwbGljYXRpb25SZWY+IHtcbiAgY29uc3Qge3Jvb3RDb21wb25lbnQsIGFwcFByb3ZpZGVycywgcGxhdGZvcm1Qcm92aWRlcnN9ID0gY29uZmlnO1xuICBOR19ERVZfTU9ERSAmJiBhc3NlcnRTdGFuZGFsb25lQ29tcG9uZW50VHlwZShyb290Q29tcG9uZW50KTtcblxuICBjb25zdCBwbGF0Zm9ybUluamVjdG9yID0gY3JlYXRlT3JSZXVzZVBsYXRmb3JtSW5qZWN0b3IocGxhdGZvcm1Qcm92aWRlcnMgYXMgU3RhdGljUHJvdmlkZXJbXSk7XG5cbiAgY29uc3Qgbmdab25lID0gbmV3IE5nWm9uZShnZXROZ1pvbmVPcHRpb25zKCkpO1xuXG4gIHJldHVybiBuZ1pvbmUucnVuKCgpID0+IHtcbiAgICAvLyBDcmVhdGUgcm9vdCBhcHBsaWNhdGlvbiBpbmplY3RvciBiYXNlZCBvbiBhIHNldCBvZiBwcm92aWRlcnMgY29uZmlndXJlZCBhdCB0aGUgcGxhdGZvcm1cbiAgICAvLyBib290c3RyYXAgbGV2ZWwgYXMgd2VsbCBhcyBwcm92aWRlcnMgcGFzc2VkIHRvIHRoZSBib290c3RyYXAgY2FsbCBieSBhIHVzZXIuXG4gICAgY29uc3QgYWxsQXBwUHJvdmlkZXJzID0gW1xuICAgICAge3Byb3ZpZGU6IE5nWm9uZSwgdXNlVmFsdWU6IG5nWm9uZX0sICAvL1xuICAgICAgLi4uKGFwcFByb3ZpZGVycyB8fCBbXSksICAgICAgICAgICAgICAvL1xuICAgIF07XG4gICAgY29uc3QgYXBwSW5qZWN0b3IgPSBjcmVhdGVFbnZpcm9ubWVudEluamVjdG9yKFxuICAgICAgICBhbGxBcHBQcm92aWRlcnMsIHBsYXRmb3JtSW5qZWN0b3IgYXMgRW52aXJvbm1lbnRJbmplY3RvciwgJ0Vudmlyb25tZW50IEluamVjdG9yJyk7XG5cbiAgICBjb25zdCBleGNlcHRpb25IYW5kbGVyOiBFcnJvckhhbmRsZXJ8bnVsbCA9IGFwcEluamVjdG9yLmdldChFcnJvckhhbmRsZXIsIG51bGwpO1xuICAgIGlmIChOR19ERVZfTU9ERSAmJiAhZXhjZXB0aW9uSGFuZGxlcikge1xuICAgICAgdGhyb3cgbmV3IFJ1bnRpbWVFcnJvcihcbiAgICAgICAgICBSdW50aW1lRXJyb3JDb2RlLkVSUk9SX0hBTkRMRVJfTk9UX0ZPVU5ELFxuICAgICAgICAgICdObyBgRXJyb3JIYW5kbGVyYCBmb3VuZCBpbiB0aGUgRGVwZW5kZW5jeSBJbmplY3Rpb24gdHJlZS4nKTtcbiAgICB9XG5cbiAgICBsZXQgb25FcnJvclN1YnNjcmlwdGlvbjogU3Vic2NyaXB0aW9uO1xuICAgIG5nWm9uZS5ydW5PdXRzaWRlQW5ndWxhcigoKSA9PiB7XG4gICAgICBvbkVycm9yU3Vic2NyaXB0aW9uID0gbmdab25lLm9uRXJyb3Iuc3Vic2NyaWJlKHtcbiAgICAgICAgbmV4dDogKGVycm9yOiBhbnkpID0+IHtcbiAgICAgICAgICBleGNlcHRpb25IYW5kbGVyIS5oYW5kbGVFcnJvcihlcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiBfY2FsbEFuZFJlcG9ydFRvRXJyb3JIYW5kbGVyKGV4Y2VwdGlvbkhhbmRsZXIhLCBuZ1pvbmUsICgpID0+IHtcbiAgICAgIGNvbnN0IGluaXRTdGF0dXMgPSBhcHBJbmplY3Rvci5nZXQoQXBwbGljYXRpb25Jbml0U3RhdHVzKTtcbiAgICAgIGluaXRTdGF0dXMucnVuSW5pdGlhbGl6ZXJzKCk7XG4gICAgICByZXR1cm4gaW5pdFN0YXR1cy5kb25lUHJvbWlzZS50aGVuKCgpID0+IHtcbiAgICAgICAgY29uc3QgbG9jYWxlSWQgPSBhcHBJbmplY3Rvci5nZXQoTE9DQUxFX0lELCBERUZBVUxUX0xPQ0FMRV9JRCk7XG4gICAgICAgIHNldExvY2FsZUlkKGxvY2FsZUlkIHx8IERFRkFVTFRfTE9DQUxFX0lEKTtcblxuICAgICAgICBjb25zdCBhcHBSZWYgPSBhcHBJbmplY3Rvci5nZXQoQXBwbGljYXRpb25SZWYpO1xuXG4gICAgICAgIC8vIElmIHRoZSB3aG9sZSBwbGF0Zm9ybSBpcyBkZXN0cm95ZWQsIGludm9rZSB0aGUgYGRlc3Ryb3lgIG1ldGhvZFxuICAgICAgICAvLyBmb3IgYWxsIGJvb3RzdHJhcHBlZCBhcHBsaWNhdGlvbnMgYXMgd2VsbC5cbiAgICAgICAgY29uc3QgZGVzdHJveUxpc3RlbmVyID0gKCkgPT4gYXBwUmVmLmRlc3Ryb3koKTtcbiAgICAgICAgY29uc3Qgb25QbGF0Zm9ybURlc3Ryb3lMaXN0ZW5lcnMgPSBwbGF0Zm9ybUluamVjdG9yLmdldChQTEFURk9STV9ERVNUUk9ZX0xJU1RFTkVSUywgbnVsbCk7XG4gICAgICAgIG9uUGxhdGZvcm1EZXN0cm95TGlzdGVuZXJzPy5hZGQoZGVzdHJveUxpc3RlbmVyKTtcblxuICAgICAgICBhcHBSZWYub25EZXN0cm95KCgpID0+IHtcbiAgICAgICAgICBvblBsYXRmb3JtRGVzdHJveUxpc3RlbmVycz8uZGVsZXRlKGRlc3Ryb3lMaXN0ZW5lcik7XG4gICAgICAgICAgb25FcnJvclN1YnNjcmlwdGlvbi51bnN1YnNjcmliZSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICBhcHBSZWYuYm9vdHN0cmFwKHJvb3RDb21wb25lbnQpO1xuICAgICAgICByZXR1cm4gYXBwUmVmO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBmYWN0b3J5IGZvciBhIHBsYXRmb3JtLiBDYW4gYmUgdXNlZCB0byBwcm92aWRlIG9yIG92ZXJyaWRlIGBQcm92aWRlcnNgIHNwZWNpZmljIHRvXG4gKiB5b3VyIGFwcGxpY2F0aW9uJ3MgcnVudGltZSBuZWVkcywgc3VjaCBhcyBgUExBVEZPUk1fSU5JVElBTElaRVJgIGFuZCBgUExBVEZPUk1fSURgLlxuICogQHBhcmFtIHBhcmVudFBsYXRmb3JtRmFjdG9yeSBBbm90aGVyIHBsYXRmb3JtIGZhY3RvcnkgdG8gbW9kaWZ5LiBBbGxvd3MgeW91IHRvIGNvbXBvc2UgZmFjdG9yaWVzXG4gKiB0byBidWlsZCB1cCBjb25maWd1cmF0aW9ucyB0aGF0IG1pZ2h0IGJlIHJlcXVpcmVkIGJ5IGRpZmZlcmVudCBsaWJyYXJpZXMgb3IgcGFydHMgb2YgdGhlXG4gKiBhcHBsaWNhdGlvbi5cbiAqIEBwYXJhbSBuYW1lIElkZW50aWZpZXMgdGhlIG5ldyBwbGF0Zm9ybSBmYWN0b3J5LlxuICogQHBhcmFtIHByb3ZpZGVycyBBIHNldCBvZiBkZXBlbmRlbmN5IHByb3ZpZGVycyBmb3IgcGxhdGZvcm1zIGNyZWF0ZWQgd2l0aCB0aGUgbmV3IGZhY3RvcnkuXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUGxhdGZvcm1GYWN0b3J5KFxuICAgIHBhcmVudFBsYXRmb3JtRmFjdG9yeTogKChleHRyYVByb3ZpZGVycz86IFN0YXRpY1Byb3ZpZGVyW10pID0+IFBsYXRmb3JtUmVmKXxudWxsLCBuYW1lOiBzdHJpbmcsXG4gICAgcHJvdmlkZXJzOiBTdGF0aWNQcm92aWRlcltdID0gW10pOiAoZXh0cmFQcm92aWRlcnM/OiBTdGF0aWNQcm92aWRlcltdKSA9PiBQbGF0Zm9ybVJlZiB7XG4gIGNvbnN0IGRlc2MgPSBgUGxhdGZvcm06ICR7bmFtZX1gO1xuICBjb25zdCBtYXJrZXIgPSBuZXcgSW5qZWN0aW9uVG9rZW4oZGVzYyk7XG4gIHJldHVybiAoZXh0cmFQcm92aWRlcnM6IFN0YXRpY1Byb3ZpZGVyW10gPSBbXSkgPT4ge1xuICAgIGxldCBwbGF0Zm9ybSA9IGdldFBsYXRmb3JtKCk7XG4gICAgaWYgKCFwbGF0Zm9ybSB8fCBwbGF0Zm9ybS5pbmplY3Rvci5nZXQoQUxMT1dfTVVMVElQTEVfUExBVEZPUk1TLCBmYWxzZSkpIHtcbiAgICAgIGNvbnN0IHBsYXRmb3JtUHJvdmlkZXJzOiBTdGF0aWNQcm92aWRlcltdID0gW1xuICAgICAgICAuLi5wcm92aWRlcnMsICAgICAgIC8vXG4gICAgICAgIC4uLmV4dHJhUHJvdmlkZXJzLCAgLy9cbiAgICAgICAge3Byb3ZpZGU6IG1hcmtlciwgdXNlVmFsdWU6IHRydWV9XG4gICAgICBdO1xuICAgICAgaWYgKHBhcmVudFBsYXRmb3JtRmFjdG9yeSkge1xuICAgICAgICBwYXJlbnRQbGF0Zm9ybUZhY3RvcnkocGxhdGZvcm1Qcm92aWRlcnMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY3JlYXRlUGxhdGZvcm0oY3JlYXRlUGxhdGZvcm1JbmplY3RvcihwbGF0Zm9ybVByb3ZpZGVycywgZGVzYykpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYXNzZXJ0UGxhdGZvcm0obWFya2VyKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBDaGVja3MgdGhhdCB0aGVyZSBpcyBjdXJyZW50bHkgYSBwbGF0Zm9ybSB0aGF0IGNvbnRhaW5zIHRoZSBnaXZlbiB0b2tlbiBhcyBhIHByb3ZpZGVyLlxuICpcbiAqIEBwdWJsaWNBcGlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFBsYXRmb3JtKHJlcXVpcmVkVG9rZW46IGFueSk6IFBsYXRmb3JtUmVmIHtcbiAgY29uc3QgcGxhdGZvcm0gPSBnZXRQbGF0Zm9ybSgpO1xuXG4gIGlmICghcGxhdGZvcm0pIHtcbiAgICB0aHJvdyBuZXcgUnVudGltZUVycm9yKFJ1bnRpbWVFcnJvckNvZGUuUExBVEZPUk1fTk9UX0ZPVU5ELCBuZ0Rldk1vZGUgJiYgJ05vIHBsYXRmb3JtIGV4aXN0cyEnKTtcbiAgfVxuXG4gIGlmICgodHlwZW9mIG5nRGV2TW9kZSA9PT0gJ3VuZGVmaW5lZCcgfHwgbmdEZXZNb2RlKSAmJlxuICAgICAgIXBsYXRmb3JtLmluamVjdG9yLmdldChyZXF1aXJlZFRva2VuLCBudWxsKSkge1xuICAgIHRocm93IG5ldyBSdW50aW1lRXJyb3IoXG4gICAgICAgIFJ1bnRpbWVFcnJvckNvZGUuTVVMVElQTEVfUExBVEZPUk1TLFxuICAgICAgICAnQSBwbGF0Zm9ybSB3aXRoIGEgZGlmZmVyZW50IGNvbmZpZ3VyYXRpb24gaGFzIGJlZW4gY3JlYXRlZC4gUGxlYXNlIGRlc3Ryb3kgaXQgZmlyc3QuJyk7XG4gIH1cblxuICByZXR1cm4gcGxhdGZvcm07XG59XG5cbi8qKlxuICogSGVscGVyIGZ1bmN0aW9uIHRvIGNyZWF0ZSBhbiBpbnN0YW5jZSBvZiBhIHBsYXRmb3JtIGluamVjdG9yICh0aGF0IG1haW50YWlucyB0aGUgJ3BsYXRmb3JtJ1xuICogc2NvcGUpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUGxhdGZvcm1JbmplY3Rvcihwcm92aWRlcnM6IFN0YXRpY1Byb3ZpZGVyW10gPSBbXSwgbmFtZT86IHN0cmluZyk6IEluamVjdG9yIHtcbiAgcmV0dXJuIEluamVjdG9yLmNyZWF0ZSh7XG4gICAgbmFtZSxcbiAgICBwcm92aWRlcnM6IFtcbiAgICAgIHtwcm92aWRlOiBJTkpFQ1RPUl9TQ09QRSwgdXNlVmFsdWU6ICdwbGF0Zm9ybSd9LFxuICAgICAge3Byb3ZpZGU6IFBMQVRGT1JNX0RFU1RST1lfTElTVEVORVJTLCB1c2VWYWx1ZTogbmV3IFNldChbKCkgPT4gX3BsYXRmb3JtSW5qZWN0b3IgPSBudWxsXSl9LFxuICAgICAgLi4ucHJvdmlkZXJzXG4gICAgXSxcbiAgfSk7XG59XG5cbi8qKlxuICogRGVzdHJveXMgdGhlIGN1cnJlbnQgQW5ndWxhciBwbGF0Zm9ybSBhbmQgYWxsIEFuZ3VsYXIgYXBwbGljYXRpb25zIG9uIHRoZSBwYWdlLlxuICogRGVzdHJveXMgYWxsIG1vZHVsZXMgYW5kIGxpc3RlbmVycyByZWdpc3RlcmVkIHdpdGggdGhlIHBsYXRmb3JtLlxuICpcbiAqIEBwdWJsaWNBcGlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlc3Ryb3lQbGF0Zm9ybSgpOiB2b2lkIHtcbiAgZ2V0UGxhdGZvcm0oKT8uZGVzdHJveSgpO1xufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIGN1cnJlbnQgcGxhdGZvcm0uXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0UGxhdGZvcm0oKTogUGxhdGZvcm1SZWZ8bnVsbCB7XG4gIHJldHVybiBfcGxhdGZvcm1JbmplY3Rvcj8uZ2V0KFBsYXRmb3JtUmVmKSA/PyBudWxsO1xufVxuXG4vKipcbiAqIFByb3ZpZGVzIGFkZGl0aW9uYWwgb3B0aW9ucyB0byB0aGUgYm9vdHN0cmFwcGluZyBwcm9jZXNzLlxuICpcbiAqIEBwdWJsaWNBcGlcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBCb290c3RyYXBPcHRpb25zIHtcbiAgLyoqXG4gICAqIE9wdGlvbmFsbHkgc3BlY2lmeSB3aGljaCBgTmdab25lYCBzaG91bGQgYmUgdXNlZC5cbiAgICpcbiAgICogLSBQcm92aWRlIHlvdXIgb3duIGBOZ1pvbmVgIGluc3RhbmNlLlxuICAgKiAtIGB6b25lLmpzYCAtIFVzZSBkZWZhdWx0IGBOZ1pvbmVgIHdoaWNoIHJlcXVpcmVzIGBab25lLmpzYC5cbiAgICogLSBgbm9vcGAgLSBVc2UgYE5vb3BOZ1pvbmVgIHdoaWNoIGRvZXMgbm90aGluZy5cbiAgICovXG4gIG5nWm9uZT86IE5nWm9uZXwnem9uZS5qcyd8J25vb3AnO1xuXG4gIC8qKlxuICAgKiBPcHRpb25hbGx5IHNwZWNpZnkgY29hbGVzY2luZyBldmVudCBjaGFuZ2UgZGV0ZWN0aW9ucyBvciBub3QuXG4gICAqIENvbnNpZGVyIHRoZSBmb2xsb3dpbmcgY2FzZS5cbiAgICpcbiAgICogPGRpdiAoY2xpY2spPVwiZG9Tb21ldGhpbmcoKVwiPlxuICAgKiAgIDxidXR0b24gKGNsaWNrKT1cImRvU29tZXRoaW5nRWxzZSgpXCI+PC9idXR0b24+XG4gICAqIDwvZGl2PlxuICAgKlxuICAgKiBXaGVuIGJ1dHRvbiBpcyBjbGlja2VkLCBiZWNhdXNlIG9mIHRoZSBldmVudCBidWJibGluZywgYm90aFxuICAgKiBldmVudCBoYW5kbGVycyB3aWxsIGJlIGNhbGxlZCBhbmQgMiBjaGFuZ2UgZGV0ZWN0aW9ucyB3aWxsIGJlXG4gICAqIHRyaWdnZXJlZC4gV2UgY2FuIGNvYWxlc2NlIHN1Y2gga2luZCBvZiBldmVudHMgdG8gb25seSB0cmlnZ2VyXG4gICAqIGNoYW5nZSBkZXRlY3Rpb24gb25seSBvbmNlLlxuICAgKlxuICAgKiBCeSBkZWZhdWx0LCB0aGlzIG9wdGlvbiB3aWxsIGJlIGZhbHNlLiBTbyB0aGUgZXZlbnRzIHdpbGwgbm90IGJlXG4gICAqIGNvYWxlc2NlZCBhbmQgdGhlIGNoYW5nZSBkZXRlY3Rpb24gd2lsbCBiZSB0cmlnZ2VyZWQgbXVsdGlwbGUgdGltZXMuXG4gICAqIEFuZCBpZiB0aGlzIG9wdGlvbiBiZSBzZXQgdG8gdHJ1ZSwgdGhlIGNoYW5nZSBkZXRlY3Rpb24gd2lsbCBiZVxuICAgKiB0cmlnZ2VyZWQgYXN5bmMgYnkgc2NoZWR1bGluZyBhIGFuaW1hdGlvbiBmcmFtZS4gU28gaW4gdGhlIGNhc2UgYWJvdmUsXG4gICAqIHRoZSBjaGFuZ2UgZGV0ZWN0aW9uIHdpbGwgb25seSBiZSB0cmlnZ2VyZWQgb25jZS5cbiAgICovXG4gIG5nWm9uZUV2ZW50Q29hbGVzY2luZz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIE9wdGlvbmFsbHkgc3BlY2lmeSBpZiBgTmdab25lI3J1bigpYCBtZXRob2QgaW52b2NhdGlvbnMgc2hvdWxkIGJlIGNvYWxlc2NlZFxuICAgKiBpbnRvIGEgc2luZ2xlIGNoYW5nZSBkZXRlY3Rpb24uXG4gICAqXG4gICAqIENvbnNpZGVyIHRoZSBmb2xsb3dpbmcgY2FzZS5cbiAgICpcbiAgICogZm9yIChsZXQgaSA9IDA7IGkgPCAxMDsgaSArKykge1xuICAgKiAgIG5nWm9uZS5ydW4oKCkgPT4ge1xuICAgKiAgICAgLy8gZG8gc29tZXRoaW5nXG4gICAqICAgfSk7XG4gICAqIH1cbiAgICpcbiAgICogVGhpcyBjYXNlIHRyaWdnZXJzIHRoZSBjaGFuZ2UgZGV0ZWN0aW9uIG11bHRpcGxlIHRpbWVzLlxuICAgKiBXaXRoIG5nWm9uZVJ1bkNvYWxlc2Npbmcgb3B0aW9ucywgYWxsIGNoYW5nZSBkZXRlY3Rpb25zIGluIGFuIGV2ZW50IGxvb3AgdHJpZ2dlciBvbmx5IG9uY2UuXG4gICAqIEluIGFkZGl0aW9uLCB0aGUgY2hhbmdlIGRldGVjdGlvbiBleGVjdXRlcyBpbiByZXF1ZXN0QW5pbWF0aW9uLlxuICAgKlxuICAgKi9cbiAgbmdab25lUnVuQ29hbGVzY2luZz86IGJvb2xlYW47XG59XG5cbi8qKlxuICogVGhlIEFuZ3VsYXIgcGxhdGZvcm0gaXMgdGhlIGVudHJ5IHBvaW50IGZvciBBbmd1bGFyIG9uIGEgd2ViIHBhZ2UuXG4gKiBFYWNoIHBhZ2UgaGFzIGV4YWN0bHkgb25lIHBsYXRmb3JtLiBTZXJ2aWNlcyAoc3VjaCBhcyByZWZsZWN0aW9uKSB3aGljaCBhcmUgY29tbW9uXG4gKiB0byBldmVyeSBBbmd1bGFyIGFwcGxpY2F0aW9uIHJ1bm5pbmcgb24gdGhlIHBhZ2UgYXJlIGJvdW5kIGluIGl0cyBzY29wZS5cbiAqIEEgcGFnZSdzIHBsYXRmb3JtIGlzIGluaXRpYWxpemVkIGltcGxpY2l0bHkgd2hlbiBhIHBsYXRmb3JtIGlzIGNyZWF0ZWQgdXNpbmcgYSBwbGF0Zm9ybVxuICogZmFjdG9yeSBzdWNoIGFzIGBQbGF0Zm9ybUJyb3dzZXJgLCBvciBleHBsaWNpdGx5IGJ5IGNhbGxpbmcgdGhlIGBjcmVhdGVQbGF0Zm9ybSgpYCBmdW5jdGlvbi5cbiAqXG4gKiBAcHVibGljQXBpXG4gKi9cbkBJbmplY3RhYmxlKHtwcm92aWRlZEluOiAncGxhdGZvcm0nfSlcbmV4cG9ydCBjbGFzcyBQbGF0Zm9ybVJlZiB7XG4gIHByaXZhdGUgX21vZHVsZXM6IE5nTW9kdWxlUmVmPGFueT5bXSA9IFtdO1xuICBwcml2YXRlIF9kZXN0cm95TGlzdGVuZXJzOiBBcnJheTwoKSA9PiB2b2lkPiA9IFtdO1xuICBwcml2YXRlIF9kZXN0cm95ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuICAvKiogQGludGVybmFsICovXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX2luamVjdG9yOiBJbmplY3Rvcikge31cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBpbnN0YW5jZSBvZiBhbiBgQE5nTW9kdWxlYCBmb3IgdGhlIGdpdmVuIHBsYXRmb3JtLlxuICAgKlxuICAgKiBAZGVwcmVjYXRlZCBQYXNzaW5nIE5nTW9kdWxlIGZhY3RvcmllcyBhcyB0aGUgYFBsYXRmb3JtUmVmLmJvb3RzdHJhcE1vZHVsZUZhY3RvcnlgIGZ1bmN0aW9uXG4gICAqICAgICBhcmd1bWVudCBpcyBkZXByZWNhdGVkLiBVc2UgdGhlIGBQbGF0Zm9ybVJlZi5ib290c3RyYXBNb2R1bGVgIEFQSSBpbnN0ZWFkLlxuICAgKi9cbiAgYm9vdHN0cmFwTW9kdWxlRmFjdG9yeTxNPihtb2R1bGVGYWN0b3J5OiBOZ01vZHVsZUZhY3Rvcnk8TT4sIG9wdGlvbnM/OiBCb290c3RyYXBPcHRpb25zKTpcbiAgICAgIFByb21pc2U8TmdNb2R1bGVSZWY8TT4+IHtcbiAgICAvLyBOb3RlOiBXZSBuZWVkIHRvIGNyZWF0ZSB0aGUgTmdab25lIF9iZWZvcmVfIHdlIGluc3RhbnRpYXRlIHRoZSBtb2R1bGUsXG4gICAgLy8gYXMgaW5zdGFudGlhdGluZyB0aGUgbW9kdWxlIGNyZWF0ZXMgc29tZSBwcm92aWRlcnMgZWFnZXJseS5cbiAgICAvLyBTbyB3ZSBjcmVhdGUgYSBtaW5pIHBhcmVudCBpbmplY3RvciB0aGF0IGp1c3QgY29udGFpbnMgdGhlIG5ldyBOZ1pvbmUgYW5kXG4gICAgLy8gcGFzcyB0aGF0IGFzIHBhcmVudCB0byB0aGUgTmdNb2R1bGVGYWN0b3J5LlxuICAgIGNvbnN0IG5nWm9uZSA9IGdldE5nWm9uZShvcHRpb25zPy5uZ1pvbmUsIGdldE5nWm9uZU9wdGlvbnMob3B0aW9ucykpO1xuICAgIGNvbnN0IHByb3ZpZGVyczogU3RhdGljUHJvdmlkZXJbXSA9IFt7cHJvdmlkZTogTmdab25lLCB1c2VWYWx1ZTogbmdab25lfV07XG4gICAgLy8gTm90ZTogQ3JlYXRlIG5nWm9uZUluamVjdG9yIHdpdGhpbiBuZ1pvbmUucnVuIHNvIHRoYXQgYWxsIG9mIHRoZSBpbnN0YW50aWF0ZWQgc2VydmljZXMgYXJlXG4gICAgLy8gY3JlYXRlZCB3aXRoaW4gdGhlIEFuZ3VsYXIgem9uZVxuICAgIC8vIERvIG5vdCB0cnkgdG8gcmVwbGFjZSBuZ1pvbmUucnVuIHdpdGggQXBwbGljYXRpb25SZWYjcnVuIGJlY2F1c2UgQXBwbGljYXRpb25SZWYgd291bGQgdGhlbiBiZVxuICAgIC8vIGNyZWF0ZWQgb3V0c2lkZSBvZiB0aGUgQW5ndWxhciB6b25lLlxuICAgIHJldHVybiBuZ1pvbmUucnVuKCgpID0+IHtcbiAgICAgIGNvbnN0IG5nWm9uZUluamVjdG9yID0gSW5qZWN0b3IuY3JlYXRlKFxuICAgICAgICAgIHtwcm92aWRlcnM6IHByb3ZpZGVycywgcGFyZW50OiB0aGlzLmluamVjdG9yLCBuYW1lOiBtb2R1bGVGYWN0b3J5Lm1vZHVsZVR5cGUubmFtZX0pO1xuICAgICAgY29uc3QgbW9kdWxlUmVmID0gPEludGVybmFsTmdNb2R1bGVSZWY8TT4+bW9kdWxlRmFjdG9yeS5jcmVhdGUobmdab25lSW5qZWN0b3IpO1xuICAgICAgY29uc3QgZXhjZXB0aW9uSGFuZGxlcjogRXJyb3JIYW5kbGVyfG51bGwgPSBtb2R1bGVSZWYuaW5qZWN0b3IuZ2V0KEVycm9ySGFuZGxlciwgbnVsbCk7XG4gICAgICBpZiAoIWV4Y2VwdGlvbkhhbmRsZXIpIHtcbiAgICAgICAgdGhyb3cgbmV3IFJ1bnRpbWVFcnJvcihcbiAgICAgICAgICAgIFJ1bnRpbWVFcnJvckNvZGUuRVJST1JfSEFORExFUl9OT1RfRk9VTkQsXG4gICAgICAgICAgICBuZ0Rldk1vZGUgJiYgJ05vIEVycm9ySGFuZGxlci4gSXMgcGxhdGZvcm0gbW9kdWxlIChCcm93c2VyTW9kdWxlKSBpbmNsdWRlZD8nKTtcbiAgICAgIH1cbiAgICAgIG5nWm9uZSEucnVuT3V0c2lkZUFuZ3VsYXIoKCkgPT4ge1xuICAgICAgICBjb25zdCBzdWJzY3JpcHRpb24gPSBuZ1pvbmUhLm9uRXJyb3Iuc3Vic2NyaWJlKHtcbiAgICAgICAgICBuZXh0OiAoZXJyb3I6IGFueSkgPT4ge1xuICAgICAgICAgICAgZXhjZXB0aW9uSGFuZGxlci5oYW5kbGVFcnJvcihlcnJvcik7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgbW9kdWxlUmVmLm9uRGVzdHJveSgoKSA9PiB7XG4gICAgICAgICAgcmVtb3ZlKHRoaXMuX21vZHVsZXMsIG1vZHVsZVJlZik7XG4gICAgICAgICAgc3Vic2NyaXB0aW9uLnVuc3Vic2NyaWJlKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gX2NhbGxBbmRSZXBvcnRUb0Vycm9ySGFuZGxlcihleGNlcHRpb25IYW5kbGVyLCBuZ1pvbmUhLCAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGluaXRTdGF0dXM6IEFwcGxpY2F0aW9uSW5pdFN0YXR1cyA9IG1vZHVsZVJlZi5pbmplY3Rvci5nZXQoQXBwbGljYXRpb25Jbml0U3RhdHVzKTtcbiAgICAgICAgaW5pdFN0YXR1cy5ydW5Jbml0aWFsaXplcnMoKTtcbiAgICAgICAgcmV0dXJuIGluaXRTdGF0dXMuZG9uZVByb21pc2UudGhlbigoKSA9PiB7XG4gICAgICAgICAgLy8gSWYgdGhlIGBMT0NBTEVfSURgIHByb3ZpZGVyIGlzIGRlZmluZWQgYXQgYm9vdHN0cmFwIHRoZW4gd2Ugc2V0IHRoZSB2YWx1ZSBmb3IgaXZ5XG4gICAgICAgICAgY29uc3QgbG9jYWxlSWQgPSBtb2R1bGVSZWYuaW5qZWN0b3IuZ2V0KExPQ0FMRV9JRCwgREVGQVVMVF9MT0NBTEVfSUQpO1xuICAgICAgICAgIHNldExvY2FsZUlkKGxvY2FsZUlkIHx8IERFRkFVTFRfTE9DQUxFX0lEKTtcbiAgICAgICAgICB0aGlzLl9tb2R1bGVEb0Jvb3RzdHJhcChtb2R1bGVSZWYpO1xuICAgICAgICAgIHJldHVybiBtb2R1bGVSZWY7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBpbnN0YW5jZSBvZiBhbiBgQE5nTW9kdWxlYCBmb3IgYSBnaXZlbiBwbGF0Zm9ybS5cbiAgICpcbiAgICogQHVzYWdlTm90ZXNcbiAgICogIyMjIFNpbXBsZSBFeGFtcGxlXG4gICAqXG4gICAqIGBgYHR5cGVzY3JpcHRcbiAgICogQE5nTW9kdWxlKHtcbiAgICogICBpbXBvcnRzOiBbQnJvd3Nlck1vZHVsZV1cbiAgICogfSlcbiAgICogY2xhc3MgTXlNb2R1bGUge31cbiAgICpcbiAgICogbGV0IG1vZHVsZVJlZiA9IHBsYXRmb3JtQnJvd3NlcigpLmJvb3RzdHJhcE1vZHVsZShNeU1vZHVsZSk7XG4gICAqIGBgYFxuICAgKlxuICAgKi9cbiAgYm9vdHN0cmFwTW9kdWxlPE0+KFxuICAgICAgbW9kdWxlVHlwZTogVHlwZTxNPixcbiAgICAgIGNvbXBpbGVyT3B0aW9uczogKENvbXBpbGVyT3B0aW9ucyZCb290c3RyYXBPcHRpb25zKXxcbiAgICAgIEFycmF5PENvbXBpbGVyT3B0aW9ucyZCb290c3RyYXBPcHRpb25zPiA9IFtdKTogUHJvbWlzZTxOZ01vZHVsZVJlZjxNPj4ge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBvcHRpb25zUmVkdWNlcih7fSwgY29tcGlsZXJPcHRpb25zKTtcbiAgICByZXR1cm4gY29tcGlsZU5nTW9kdWxlRmFjdG9yeSh0aGlzLmluamVjdG9yLCBvcHRpb25zLCBtb2R1bGVUeXBlKVxuICAgICAgICAudGhlbihtb2R1bGVGYWN0b3J5ID0+IHRoaXMuYm9vdHN0cmFwTW9kdWxlRmFjdG9yeShtb2R1bGVGYWN0b3J5LCBvcHRpb25zKSk7XG4gIH1cblxuICBwcml2YXRlIF9tb2R1bGVEb0Jvb3RzdHJhcChtb2R1bGVSZWY6IEludGVybmFsTmdNb2R1bGVSZWY8YW55Pik6IHZvaWQge1xuICAgIGNvbnN0IGFwcFJlZiA9IG1vZHVsZVJlZi5pbmplY3Rvci5nZXQoQXBwbGljYXRpb25SZWYpIGFzIEFwcGxpY2F0aW9uUmVmO1xuICAgIGlmIChtb2R1bGVSZWYuX2Jvb3RzdHJhcENvbXBvbmVudHMubGVuZ3RoID4gMCkge1xuICAgICAgbW9kdWxlUmVmLl9ib290c3RyYXBDb21wb25lbnRzLmZvckVhY2goZiA9PiBhcHBSZWYuYm9vdHN0cmFwKGYpKTtcbiAgICB9IGVsc2UgaWYgKG1vZHVsZVJlZi5pbnN0YW5jZS5uZ0RvQm9vdHN0cmFwKSB7XG4gICAgICBtb2R1bGVSZWYuaW5zdGFuY2UubmdEb0Jvb3RzdHJhcChhcHBSZWYpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgUnVudGltZUVycm9yKFxuICAgICAgICAgIFJ1bnRpbWVFcnJvckNvZGUuQk9PVFNUUkFQX0NPTVBPTkVOVFNfTk9UX0ZPVU5ELFxuICAgICAgICAgIG5nRGV2TW9kZSAmJlxuICAgICAgICAgICAgICBgVGhlIG1vZHVsZSAke3N0cmluZ2lmeShtb2R1bGVSZWYuaW5zdGFuY2UuY29uc3RydWN0b3IpfSB3YXMgYm9vdHN0cmFwcGVkLCBgICtcbiAgICAgICAgICAgICAgICAgIGBidXQgaXQgZG9lcyBub3QgZGVjbGFyZSBcIkBOZ01vZHVsZS5ib290c3RyYXBcIiBjb21wb25lbnRzIG5vciBhIFwibmdEb0Jvb3RzdHJhcFwiIG1ldGhvZC4gYCArXG4gICAgICAgICAgICAgICAgICBgUGxlYXNlIGRlZmluZSBvbmUgb2YgdGhlc2UuYCk7XG4gICAgfVxuICAgIHRoaXMuX21vZHVsZXMucHVzaChtb2R1bGVSZWYpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyBhIGxpc3RlbmVyIHRvIGJlIGNhbGxlZCB3aGVuIHRoZSBwbGF0Zm9ybSBpcyBkZXN0cm95ZWQuXG4gICAqL1xuICBvbkRlc3Ryb3koY2FsbGJhY2s6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl9kZXN0cm95TGlzdGVuZXJzLnB1c2goY2FsbGJhY2spO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlcyB0aGUgcGxhdGZvcm0ge0BsaW5rIEluamVjdG9yfSwgd2hpY2ggaXMgdGhlIHBhcmVudCBpbmplY3RvciBmb3JcbiAgICogZXZlcnkgQW5ndWxhciBhcHBsaWNhdGlvbiBvbiB0aGUgcGFnZSBhbmQgcHJvdmlkZXMgc2luZ2xldG9uIHByb3ZpZGVycy5cbiAgICovXG4gIGdldCBpbmplY3RvcigpOiBJbmplY3RvciB7XG4gICAgcmV0dXJuIHRoaXMuX2luamVjdG9yO1xuICB9XG5cbiAgLyoqXG4gICAqIERlc3Ryb3lzIHRoZSBjdXJyZW50IEFuZ3VsYXIgcGxhdGZvcm0gYW5kIGFsbCBBbmd1bGFyIGFwcGxpY2F0aW9ucyBvbiB0aGUgcGFnZS5cbiAgICogRGVzdHJveXMgYWxsIG1vZHVsZXMgYW5kIGxpc3RlbmVycyByZWdpc3RlcmVkIHdpdGggdGhlIHBsYXRmb3JtLlxuICAgKi9cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5fZGVzdHJveWVkKSB7XG4gICAgICB0aHJvdyBuZXcgUnVudGltZUVycm9yKFxuICAgICAgICAgIFJ1bnRpbWVFcnJvckNvZGUuUExBVEZPUk1fQUxSRUFEWV9ERVNUUk9ZRUQsXG4gICAgICAgICAgbmdEZXZNb2RlICYmICdUaGUgcGxhdGZvcm0gaGFzIGFscmVhZHkgYmVlbiBkZXN0cm95ZWQhJyk7XG4gICAgfVxuICAgIHRoaXMuX21vZHVsZXMuc2xpY2UoKS5mb3JFYWNoKG1vZHVsZSA9PiBtb2R1bGUuZGVzdHJveSgpKTtcbiAgICB0aGlzLl9kZXN0cm95TGlzdGVuZXJzLmZvckVhY2gobGlzdGVuZXIgPT4gbGlzdGVuZXIoKSk7XG5cbiAgICBjb25zdCBkZXN0cm95TGlzdGVuZXJzID0gdGhpcy5faW5qZWN0b3IuZ2V0KFBMQVRGT1JNX0RFU1RST1lfTElTVEVORVJTLCBudWxsKTtcbiAgICBpZiAoZGVzdHJveUxpc3RlbmVycykge1xuICAgICAgZGVzdHJveUxpc3RlbmVycy5mb3JFYWNoKGxpc3RlbmVyID0+IGxpc3RlbmVyKCkpO1xuICAgICAgZGVzdHJveUxpc3RlbmVycy5jbGVhcigpO1xuICAgIH1cblxuICAgIHRoaXMuX2Rlc3Ryb3llZCA9IHRydWU7XG4gIH1cblxuICAvKipcbiAgICogSW5kaWNhdGVzIHdoZXRoZXIgdGhpcyBpbnN0YW5jZSB3YXMgZGVzdHJveWVkLlxuICAgKi9cbiAgZ2V0IGRlc3Ryb3llZCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVzdHJveWVkO1xuICB9XG59XG5cbi8vIFNldCBvZiBvcHRpb25zIHJlY29nbml6ZWQgYnkgdGhlIE5nWm9uZS5cbmludGVyZmFjZSBOZ1pvbmVPcHRpb25zIHtcbiAgZW5hYmxlTG9uZ1N0YWNrVHJhY2U6IGJvb2xlYW47XG4gIHNob3VsZENvYWxlc2NlRXZlbnRDaGFuZ2VEZXRlY3Rpb246IGJvb2xlYW47XG4gIHNob3VsZENvYWxlc2NlUnVuQ2hhbmdlRGV0ZWN0aW9uOiBib29sZWFuO1xufVxuXG4vLyBUcmFuc2Zvcm1zIGEgc2V0IG9mIGBCb290c3RyYXBPcHRpb25zYCAoc3VwcG9ydGVkIGJ5IHRoZSBOZ01vZHVsZS1iYXNlZCBib290c3RyYXAgQVBJcykgLT5cbi8vIGBOZ1pvbmVPcHRpb25zYCB0aGF0IGFyZSByZWNvZ25pemVkIGJ5IHRoZSBOZ1pvbmUgY29uc3RydWN0b3IuIFBhc3Npbmcgbm8gb3B0aW9ucyB3aWxsIHJlc3VsdCBpblxuLy8gYSBzZXQgb2YgZGVmYXVsdCBvcHRpb25zIHJldHVybmVkLlxuZnVuY3Rpb24gZ2V0Tmdab25lT3B0aW9ucyhvcHRpb25zPzogQm9vdHN0cmFwT3B0aW9ucyk6IE5nWm9uZU9wdGlvbnMge1xuICByZXR1cm4ge1xuICAgIGVuYWJsZUxvbmdTdGFja1RyYWNlOiB0eXBlb2YgbmdEZXZNb2RlID09PSAndW5kZWZpbmVkJyA/IGZhbHNlIDogISFuZ0Rldk1vZGUsXG4gICAgc2hvdWxkQ29hbGVzY2VFdmVudENoYW5nZURldGVjdGlvbjogISEob3B0aW9ucyAmJiBvcHRpb25zLm5nWm9uZUV2ZW50Q29hbGVzY2luZykgfHwgZmFsc2UsXG4gICAgc2hvdWxkQ29hbGVzY2VSdW5DaGFuZ2VEZXRlY3Rpb246ICEhKG9wdGlvbnMgJiYgb3B0aW9ucy5uZ1pvbmVSdW5Db2FsZXNjaW5nKSB8fCBmYWxzZSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0Tmdab25lKG5nWm9uZVRvVXNlOiBOZ1pvbmV8J3pvbmUuanMnfCdub29wJ3x1bmRlZmluZWQsIG9wdGlvbnM6IE5nWm9uZU9wdGlvbnMpOiBOZ1pvbmUge1xuICBsZXQgbmdab25lOiBOZ1pvbmU7XG5cbiAgaWYgKG5nWm9uZVRvVXNlID09PSAnbm9vcCcpIHtcbiAgICBuZ1pvbmUgPSBuZXcgTm9vcE5nWm9uZSgpO1xuICB9IGVsc2Uge1xuICAgIG5nWm9uZSA9IChuZ1pvbmVUb1VzZSA9PT0gJ3pvbmUuanMnID8gdW5kZWZpbmVkIDogbmdab25lVG9Vc2UpIHx8IG5ldyBOZ1pvbmUob3B0aW9ucyk7XG4gIH1cbiAgcmV0dXJuIG5nWm9uZTtcbn1cblxuZnVuY3Rpb24gX2NhbGxBbmRSZXBvcnRUb0Vycm9ySGFuZGxlcihcbiAgICBlcnJvckhhbmRsZXI6IEVycm9ySGFuZGxlciwgbmdab25lOiBOZ1pvbmUsIGNhbGxiYWNrOiAoKSA9PiBhbnkpOiBhbnkge1xuICB0cnkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGNhbGxiYWNrKCk7XG4gICAgaWYgKGlzUHJvbWlzZShyZXN1bHQpKSB7XG4gICAgICByZXR1cm4gcmVzdWx0LmNhdGNoKChlOiBhbnkpID0+IHtcbiAgICAgICAgbmdab25lLnJ1bk91dHNpZGVBbmd1bGFyKCgpID0+IGVycm9ySGFuZGxlci5oYW5kbGVFcnJvcihlKSk7XG4gICAgICAgIC8vIHJldGhyb3cgYXMgdGhlIGV4Y2VwdGlvbiBoYW5kbGVyIG1pZ2h0IG5vdCBkbyBpdFxuICAgICAgICB0aHJvdyBlO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSBjYXRjaCAoZSkge1xuICAgIG5nWm9uZS5ydW5PdXRzaWRlQW5ndWxhcigoKSA9PiBlcnJvckhhbmRsZXIuaGFuZGxlRXJyb3IoZSkpO1xuICAgIC8vIHJldGhyb3cgYXMgdGhlIGV4Y2VwdGlvbiBoYW5kbGVyIG1pZ2h0IG5vdCBkbyBpdFxuICAgIHRocm93IGU7XG4gIH1cbn1cblxuZnVuY3Rpb24gb3B0aW9uc1JlZHVjZXI8VCBleHRlbmRzIE9iamVjdD4oZHN0OiBhbnksIG9ianM6IFR8VFtdKTogVCB7XG4gIGlmIChBcnJheS5pc0FycmF5KG9ianMpKSB7XG4gICAgZHN0ID0gb2Jqcy5yZWR1Y2Uob3B0aW9uc1JlZHVjZXIsIGRzdCk7XG4gIH0gZWxzZSB7XG4gICAgZHN0ID0gey4uLmRzdCwgLi4uKG9ianMgYXMgYW55KX07XG4gIH1cbiAgcmV0dXJuIGRzdDtcbn1cblxuLyoqXG4gKiBBIHJlZmVyZW5jZSB0byBhbiBBbmd1bGFyIGFwcGxpY2F0aW9uIHJ1bm5pbmcgb24gYSBwYWdlLlxuICpcbiAqIEB1c2FnZU5vdGVzXG4gKlxuICoge0BhIGlzLXN0YWJsZS1leGFtcGxlc31cbiAqICMjIyBpc1N0YWJsZSBleGFtcGxlcyBhbmQgY2F2ZWF0c1xuICpcbiAqIE5vdGUgdHdvIGltcG9ydGFudCBwb2ludHMgYWJvdXQgYGlzU3RhYmxlYCwgZGVtb25zdHJhdGVkIGluIHRoZSBleGFtcGxlcyBiZWxvdzpcbiAqIC0gdGhlIGFwcGxpY2F0aW9uIHdpbGwgbmV2ZXIgYmUgc3RhYmxlIGlmIHlvdSBzdGFydCBhbnkga2luZFxuICogb2YgcmVjdXJyZW50IGFzeW5jaHJvbm91cyB0YXNrIHdoZW4gdGhlIGFwcGxpY2F0aW9uIHN0YXJ0c1xuICogKGZvciBleGFtcGxlIGZvciBhIHBvbGxpbmcgcHJvY2Vzcywgc3RhcnRlZCB3aXRoIGEgYHNldEludGVydmFsYCwgYSBgc2V0VGltZW91dGBcbiAqIG9yIHVzaW5nIFJ4SlMgb3BlcmF0b3JzIGxpa2UgYGludGVydmFsYCk7XG4gKiAtIHRoZSBgaXNTdGFibGVgIE9ic2VydmFibGUgcnVucyBvdXRzaWRlIG9mIHRoZSBBbmd1bGFyIHpvbmUuXG4gKlxuICogTGV0J3MgaW1hZ2luZSB0aGF0IHlvdSBzdGFydCBhIHJlY3VycmVudCB0YXNrXG4gKiAoaGVyZSBpbmNyZW1lbnRpbmcgYSBjb3VudGVyLCB1c2luZyBSeEpTIGBpbnRlcnZhbGApLFxuICogYW5kIGF0IHRoZSBzYW1lIHRpbWUgc3Vic2NyaWJlIHRvIGBpc1N0YWJsZWAuXG4gKlxuICogYGBgXG4gKiBjb25zdHJ1Y3RvcihhcHBSZWY6IEFwcGxpY2F0aW9uUmVmKSB7XG4gKiAgIGFwcFJlZi5pc1N0YWJsZS5waXBlKFxuICogICAgICBmaWx0ZXIoc3RhYmxlID0+IHN0YWJsZSlcbiAqICAgKS5zdWJzY3JpYmUoKCkgPT4gY29uc29sZS5sb2coJ0FwcCBpcyBzdGFibGUgbm93Jyk7XG4gKiAgIGludGVydmFsKDEwMDApLnN1YnNjcmliZShjb3VudGVyID0+IGNvbnNvbGUubG9nKGNvdW50ZXIpKTtcbiAqIH1cbiAqIGBgYFxuICogSW4gdGhpcyBleGFtcGxlLCBgaXNTdGFibGVgIHdpbGwgbmV2ZXIgZW1pdCBgdHJ1ZWAsXG4gKiBhbmQgdGhlIHRyYWNlIFwiQXBwIGlzIHN0YWJsZSBub3dcIiB3aWxsIG5ldmVyIGdldCBsb2dnZWQuXG4gKlxuICogSWYgeW91IHdhbnQgdG8gZXhlY3V0ZSBzb21ldGhpbmcgd2hlbiB0aGUgYXBwIGlzIHN0YWJsZSxcbiAqIHlvdSBoYXZlIHRvIHdhaXQgZm9yIHRoZSBhcHBsaWNhdGlvbiB0byBiZSBzdGFibGVcbiAqIGJlZm9yZSBzdGFydGluZyB5b3VyIHBvbGxpbmcgcHJvY2Vzcy5cbiAqXG4gKiBgYGBcbiAqIGNvbnN0cnVjdG9yKGFwcFJlZjogQXBwbGljYXRpb25SZWYpIHtcbiAqICAgYXBwUmVmLmlzU3RhYmxlLnBpcGUoXG4gKiAgICAgZmlyc3Qoc3RhYmxlID0+IHN0YWJsZSksXG4gKiAgICAgdGFwKHN0YWJsZSA9PiBjb25zb2xlLmxvZygnQXBwIGlzIHN0YWJsZSBub3cnKSksXG4gKiAgICAgc3dpdGNoTWFwKCgpID0+IGludGVydmFsKDEwMDApKVxuICogICApLnN1YnNjcmliZShjb3VudGVyID0+IGNvbnNvbGUubG9nKGNvdW50ZXIpKTtcbiAqIH1cbiAqIGBgYFxuICogSW4gdGhpcyBleGFtcGxlLCB0aGUgdHJhY2UgXCJBcHAgaXMgc3RhYmxlIG5vd1wiIHdpbGwgYmUgbG9nZ2VkXG4gKiBhbmQgdGhlbiB0aGUgY291bnRlciBzdGFydHMgaW5jcmVtZW50aW5nIGV2ZXJ5IHNlY29uZC5cbiAqXG4gKiBOb3RlIGFsc28gdGhhdCB0aGlzIE9ic2VydmFibGUgcnVucyBvdXRzaWRlIG9mIHRoZSBBbmd1bGFyIHpvbmUsXG4gKiB3aGljaCBtZWFucyB0aGF0IHRoZSBjb2RlIGluIHRoZSBzdWJzY3JpcHRpb25cbiAqIHRvIHRoaXMgT2JzZXJ2YWJsZSB3aWxsIG5vdCB0cmlnZ2VyIHRoZSBjaGFuZ2UgZGV0ZWN0aW9uLlxuICpcbiAqIExldCdzIGltYWdpbmUgdGhhdCBpbnN0ZWFkIG9mIGxvZ2dpbmcgdGhlIGNvdW50ZXIgdmFsdWUsXG4gKiB5b3UgdXBkYXRlIGEgZmllbGQgb2YgeW91ciBjb21wb25lbnRcbiAqIGFuZCBkaXNwbGF5IGl0IGluIGl0cyB0ZW1wbGF0ZS5cbiAqXG4gKiBgYGBcbiAqIGNvbnN0cnVjdG9yKGFwcFJlZjogQXBwbGljYXRpb25SZWYpIHtcbiAqICAgYXBwUmVmLmlzU3RhYmxlLnBpcGUoXG4gKiAgICAgZmlyc3Qoc3RhYmxlID0+IHN0YWJsZSksXG4gKiAgICAgc3dpdGNoTWFwKCgpID0+IGludGVydmFsKDEwMDApKVxuICogICApLnN1YnNjcmliZShjb3VudGVyID0+IHRoaXMudmFsdWUgPSBjb3VudGVyKTtcbiAqIH1cbiAqIGBgYFxuICogQXMgdGhlIGBpc1N0YWJsZWAgT2JzZXJ2YWJsZSBydW5zIG91dHNpZGUgdGhlIHpvbmUsXG4gKiB0aGUgYHZhbHVlYCBmaWVsZCB3aWxsIGJlIHVwZGF0ZWQgcHJvcGVybHksXG4gKiBidXQgdGhlIHRlbXBsYXRlIHdpbGwgbm90IGJlIHJlZnJlc2hlZCFcbiAqXG4gKiBZb3UnbGwgaGF2ZSB0byBtYW51YWxseSB0cmlnZ2VyIHRoZSBjaGFuZ2UgZGV0ZWN0aW9uIHRvIHVwZGF0ZSB0aGUgdGVtcGxhdGUuXG4gKlxuICogYGBgXG4gKiBjb25zdHJ1Y3RvcihhcHBSZWY6IEFwcGxpY2F0aW9uUmVmLCBjZDogQ2hhbmdlRGV0ZWN0b3JSZWYpIHtcbiAqICAgYXBwUmVmLmlzU3RhYmxlLnBpcGUoXG4gKiAgICAgZmlyc3Qoc3RhYmxlID0+IHN0YWJsZSksXG4gKiAgICAgc3dpdGNoTWFwKCgpID0+IGludGVydmFsKDEwMDApKVxuICogICApLnN1YnNjcmliZShjb3VudGVyID0+IHtcbiAqICAgICB0aGlzLnZhbHVlID0gY291bnRlcjtcbiAqICAgICBjZC5kZXRlY3RDaGFuZ2VzKCk7XG4gKiAgIH0pO1xuICogfVxuICogYGBgXG4gKlxuICogT3IgbWFrZSB0aGUgc3Vic2NyaXB0aW9uIGNhbGxiYWNrIHJ1biBpbnNpZGUgdGhlIHpvbmUuXG4gKlxuICogYGBgXG4gKiBjb25zdHJ1Y3RvcihhcHBSZWY6IEFwcGxpY2F0aW9uUmVmLCB6b25lOiBOZ1pvbmUpIHtcbiAqICAgYXBwUmVmLmlzU3RhYmxlLnBpcGUoXG4gKiAgICAgZmlyc3Qoc3RhYmxlID0+IHN0YWJsZSksXG4gKiAgICAgc3dpdGNoTWFwKCgpID0+IGludGVydmFsKDEwMDApKVxuICogICApLnN1YnNjcmliZShjb3VudGVyID0+IHpvbmUucnVuKCgpID0+IHRoaXMudmFsdWUgPSBjb3VudGVyKSk7XG4gKiB9XG4gKiBgYGBcbiAqXG4gKiBAcHVibGljQXBpXG4gKi9cbkBJbmplY3RhYmxlKHtwcm92aWRlZEluOiAncm9vdCd9KVxuZXhwb3J0IGNsYXNzIEFwcGxpY2F0aW9uUmVmIHtcbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBwcml2YXRlIF9ib290c3RyYXBMaXN0ZW5lcnM6ICgoY29tcFJlZjogQ29tcG9uZW50UmVmPGFueT4pID0+IHZvaWQpW10gPSBbXTtcbiAgcHJpdmF0ZSBfdmlld3M6IEludGVybmFsVmlld1JlZltdID0gW107XG4gIHByaXZhdGUgX3J1bm5pbmdUaWNrOiBib29sZWFuID0gZmFsc2U7XG4gIHByaXZhdGUgX3N0YWJsZSA9IHRydWU7XG4gIHByaXZhdGUgX29uTWljcm90YXNrRW1wdHlTdWJzY3JpcHRpb246IFN1YnNjcmlwdGlvbjtcbiAgcHJpdmF0ZSBfZGVzdHJveWVkID0gZmFsc2U7XG4gIHByaXZhdGUgX2Rlc3Ryb3lMaXN0ZW5lcnM6IEFycmF5PCgpID0+IHZvaWQ+ID0gW107XG5cbiAgLyoqXG4gICAqIEluZGljYXRlcyB3aGV0aGVyIHRoaXMgaW5zdGFuY2Ugd2FzIGRlc3Ryb3llZC5cbiAgICovXG4gIGdldCBkZXN0cm95ZWQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlc3Ryb3llZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgYSBsaXN0IG9mIGNvbXBvbmVudCB0eXBlcyByZWdpc3RlcmVkIHRvIHRoaXMgYXBwbGljYXRpb24uXG4gICAqIFRoaXMgbGlzdCBpcyBwb3B1bGF0ZWQgZXZlbiBiZWZvcmUgdGhlIGNvbXBvbmVudCBpcyBjcmVhdGVkLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGNvbXBvbmVudFR5cGVzOiBUeXBlPGFueT5bXSA9IFtdO1xuXG4gIC8qKlxuICAgKiBHZXQgYSBsaXN0IG9mIGNvbXBvbmVudHMgcmVnaXN0ZXJlZCB0byB0aGlzIGFwcGxpY2F0aW9uLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGNvbXBvbmVudHM6IENvbXBvbmVudFJlZjxhbnk+W10gPSBbXTtcblxuICAvKipcbiAgICogUmV0dXJucyBhbiBPYnNlcnZhYmxlIHRoYXQgaW5kaWNhdGVzIHdoZW4gdGhlIGFwcGxpY2F0aW9uIGlzIHN0YWJsZSBvciB1bnN0YWJsZS5cbiAgICpcbiAgICogQHNlZSAgW1VzYWdlIG5vdGVzXSgjaXMtc3RhYmxlLWV4YW1wbGVzKSBmb3IgZXhhbXBsZXMgYW5kIGNhdmVhdHMgd2hlbiB1c2luZyB0aGlzIEFQSS5cbiAgICovXG4gIC8vIFRPRE8oaXNzdWUvMjQ1NzEpOiByZW1vdmUgJyEnLlxuICBwdWJsaWMgcmVhZG9ubHkgaXNTdGFibGUhOiBPYnNlcnZhYmxlPGJvb2xlYW4+O1xuXG4gIC8qKlxuICAgKiBUaGUgYEVudmlyb25tZW50SW5qZWN0b3JgIHVzZWQgdG8gY3JlYXRlIHRoaXMgYXBwbGljYXRpb24uXG4gICAqL1xuICBnZXQgaW5qZWN0b3IoKTogRW52aXJvbm1lbnRJbmplY3RvciB7XG4gICAgcmV0dXJuIHRoaXMuX2luamVjdG9yO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgX3pvbmU6IE5nWm9uZSxcbiAgICAgIHByaXZhdGUgX2luamVjdG9yOiBFbnZpcm9ubWVudEluamVjdG9yLFxuICAgICAgcHJpdmF0ZSBfZXhjZXB0aW9uSGFuZGxlcjogRXJyb3JIYW5kbGVyLFxuICApIHtcbiAgICB0aGlzLl9vbk1pY3JvdGFza0VtcHR5U3Vic2NyaXB0aW9uID0gdGhpcy5fem9uZS5vbk1pY3JvdGFza0VtcHR5LnN1YnNjcmliZSh7XG4gICAgICBuZXh0OiAoKSA9PiB7XG4gICAgICAgIHRoaXMuX3pvbmUucnVuKCgpID0+IHtcbiAgICAgICAgICB0aGlzLnRpY2soKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBjb25zdCBpc0N1cnJlbnRseVN0YWJsZSA9IG5ldyBPYnNlcnZhYmxlPGJvb2xlYW4+KChvYnNlcnZlcjogT2JzZXJ2ZXI8Ym9vbGVhbj4pID0+IHtcbiAgICAgIHRoaXMuX3N0YWJsZSA9IHRoaXMuX3pvbmUuaXNTdGFibGUgJiYgIXRoaXMuX3pvbmUuaGFzUGVuZGluZ01hY3JvdGFza3MgJiZcbiAgICAgICAgICAhdGhpcy5fem9uZS5oYXNQZW5kaW5nTWljcm90YXNrcztcbiAgICAgIHRoaXMuX3pvbmUucnVuT3V0c2lkZUFuZ3VsYXIoKCkgPT4ge1xuICAgICAgICBvYnNlcnZlci5uZXh0KHRoaXMuX3N0YWJsZSk7XG4gICAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGNvbnN0IGlzU3RhYmxlID0gbmV3IE9ic2VydmFibGU8Ym9vbGVhbj4oKG9ic2VydmVyOiBPYnNlcnZlcjxib29sZWFuPikgPT4ge1xuICAgICAgLy8gQ3JlYXRlIHRoZSBzdWJzY3JpcHRpb24gdG8gb25TdGFibGUgb3V0c2lkZSB0aGUgQW5ndWxhciBab25lIHNvIHRoYXRcbiAgICAgIC8vIHRoZSBjYWxsYmFjayBpcyBydW4gb3V0c2lkZSB0aGUgQW5ndWxhciBab25lLlxuICAgICAgbGV0IHN0YWJsZVN1YjogU3Vic2NyaXB0aW9uO1xuICAgICAgdGhpcy5fem9uZS5ydW5PdXRzaWRlQW5ndWxhcigoKSA9PiB7XG4gICAgICAgIHN0YWJsZVN1YiA9IHRoaXMuX3pvbmUub25TdGFibGUuc3Vic2NyaWJlKCgpID0+IHtcbiAgICAgICAgICBOZ1pvbmUuYXNzZXJ0Tm90SW5Bbmd1bGFyWm9uZSgpO1xuXG4gICAgICAgICAgLy8gQ2hlY2sgd2hldGhlciB0aGVyZSBhcmUgbm8gcGVuZGluZyBtYWNyby9taWNybyB0YXNrcyBpbiB0aGUgbmV4dCB0aWNrXG4gICAgICAgICAgLy8gdG8gYWxsb3cgZm9yIE5nWm9uZSB0byB1cGRhdGUgdGhlIHN0YXRlLlxuICAgICAgICAgIHNjaGVkdWxlTWljcm9UYXNrKCgpID0+IHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fc3RhYmxlICYmICF0aGlzLl96b25lLmhhc1BlbmRpbmdNYWNyb3Rhc2tzICYmXG4gICAgICAgICAgICAgICAgIXRoaXMuX3pvbmUuaGFzUGVuZGluZ01pY3JvdGFza3MpIHtcbiAgICAgICAgICAgICAgdGhpcy5fc3RhYmxlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgb2JzZXJ2ZXIubmV4dCh0cnVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgY29uc3QgdW5zdGFibGVTdWI6IFN1YnNjcmlwdGlvbiA9IHRoaXMuX3pvbmUub25VbnN0YWJsZS5zdWJzY3JpYmUoKCkgPT4ge1xuICAgICAgICBOZ1pvbmUuYXNzZXJ0SW5Bbmd1bGFyWm9uZSgpO1xuICAgICAgICBpZiAodGhpcy5fc3RhYmxlKSB7XG4gICAgICAgICAgdGhpcy5fc3RhYmxlID0gZmFsc2U7XG4gICAgICAgICAgdGhpcy5fem9uZS5ydW5PdXRzaWRlQW5ndWxhcigoKSA9PiB7XG4gICAgICAgICAgICBvYnNlcnZlci5uZXh0KGZhbHNlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiAoKSA9PiB7XG4gICAgICAgIHN0YWJsZVN1Yi51bnN1YnNjcmliZSgpO1xuICAgICAgICB1bnN0YWJsZVN1Yi51bnN1YnNjcmliZSgpO1xuICAgICAgfTtcbiAgICB9KTtcblxuICAgICh0aGlzIGFzIHtpc1N0YWJsZTogT2JzZXJ2YWJsZTxib29sZWFuPn0pLmlzU3RhYmxlID1cbiAgICAgICAgbWVyZ2UoaXNDdXJyZW50bHlTdGFibGUsIGlzU3RhYmxlLnBpcGUoc2hhcmUoKSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEJvb3RzdHJhcCBhIGNvbXBvbmVudCBvbnRvIHRoZSBlbGVtZW50IGlkZW50aWZpZWQgYnkgaXRzIHNlbGVjdG9yIG9yLCBvcHRpb25hbGx5LCB0byBhXG4gICAqIHNwZWNpZmllZCBlbGVtZW50LlxuICAgKlxuICAgKiBAdXNhZ2VOb3Rlc1xuICAgKiAjIyMgQm9vdHN0cmFwIHByb2Nlc3NcbiAgICpcbiAgICogV2hlbiBib290c3RyYXBwaW5nIGEgY29tcG9uZW50LCBBbmd1bGFyIG1vdW50cyBpdCBvbnRvIGEgdGFyZ2V0IERPTSBlbGVtZW50XG4gICAqIGFuZCBraWNrcyBvZmYgYXV0b21hdGljIGNoYW5nZSBkZXRlY3Rpb24uIFRoZSB0YXJnZXQgRE9NIGVsZW1lbnQgY2FuIGJlXG4gICAqIHByb3ZpZGVkIHVzaW5nIHRoZSBgcm9vdFNlbGVjdG9yT3JOb2RlYCBhcmd1bWVudC5cbiAgICpcbiAgICogSWYgdGhlIHRhcmdldCBET00gZWxlbWVudCBpcyBub3QgcHJvdmlkZWQsIEFuZ3VsYXIgdHJpZXMgdG8gZmluZCBvbmUgb24gYSBwYWdlXG4gICAqIHVzaW5nIHRoZSBgc2VsZWN0b3JgIG9mIHRoZSBjb21wb25lbnQgdGhhdCBpcyBiZWluZyBib290c3RyYXBwZWRcbiAgICogKGZpcnN0IG1hdGNoZWQgZWxlbWVudCBpcyB1c2VkKS5cbiAgICpcbiAgICogIyMjIEV4YW1wbGVcbiAgICpcbiAgICogR2VuZXJhbGx5LCB3ZSBkZWZpbmUgdGhlIGNvbXBvbmVudCB0byBib290c3RyYXAgaW4gdGhlIGBib290c3RyYXBgIGFycmF5IG9mIGBOZ01vZHVsZWAsXG4gICAqIGJ1dCBpdCByZXF1aXJlcyB1cyB0byBrbm93IHRoZSBjb21wb25lbnQgd2hpbGUgd3JpdGluZyB0aGUgYXBwbGljYXRpb24gY29kZS5cbiAgICpcbiAgICogSW1hZ2luZSBhIHNpdHVhdGlvbiB3aGVyZSB3ZSBoYXZlIHRvIHdhaXQgZm9yIGFuIEFQSSBjYWxsIHRvIGRlY2lkZSBhYm91dCB0aGUgY29tcG9uZW50IHRvXG4gICAqIGJvb3RzdHJhcC4gV2UgY2FuIHVzZSB0aGUgYG5nRG9Cb290c3RyYXBgIGhvb2sgb2YgdGhlIGBOZ01vZHVsZWAgYW5kIGNhbGwgdGhpcyBtZXRob2QgdG9cbiAgICogZHluYW1pY2FsbHkgYm9vdHN0cmFwIGEgY29tcG9uZW50LlxuICAgKlxuICAgKiB7QGV4YW1wbGUgY29yZS90cy9wbGF0Zm9ybS9wbGF0Zm9ybS50cyByZWdpb249J2NvbXBvbmVudFNlbGVjdG9yJ31cbiAgICpcbiAgICogT3B0aW9uYWxseSwgYSBjb21wb25lbnQgY2FuIGJlIG1vdW50ZWQgb250byBhIERPTSBlbGVtZW50IHRoYXQgZG9lcyBub3QgbWF0Y2ggdGhlXG4gICAqIHNlbGVjdG9yIG9mIHRoZSBib290c3RyYXBwZWQgY29tcG9uZW50LlxuICAgKlxuICAgKiBJbiB0aGUgZm9sbG93aW5nIGV4YW1wbGUsIHdlIGFyZSBwcm92aWRpbmcgYSBDU1Mgc2VsZWN0b3IgdG8gbWF0Y2ggdGhlIHRhcmdldCBlbGVtZW50LlxuICAgKlxuICAgKiB7QGV4YW1wbGUgY29yZS90cy9wbGF0Zm9ybS9wbGF0Zm9ybS50cyByZWdpb249J2Nzc1NlbGVjdG9yJ31cbiAgICpcbiAgICogV2hpbGUgaW4gdGhpcyBleGFtcGxlLCB3ZSBhcmUgcHJvdmlkaW5nIHJlZmVyZW5jZSB0byBhIERPTSBub2RlLlxuICAgKlxuICAgKiB7QGV4YW1wbGUgY29yZS90cy9wbGF0Zm9ybS9wbGF0Zm9ybS50cyByZWdpb249J2RvbU5vZGUnfVxuICAgKi9cbiAgYm9vdHN0cmFwPEM+KGNvbXBvbmVudDogVHlwZTxDPiwgcm9vdFNlbGVjdG9yT3JOb2RlPzogc3RyaW5nfGFueSk6IENvbXBvbmVudFJlZjxDPjtcblxuICAvKipcbiAgICogQm9vdHN0cmFwIGEgY29tcG9uZW50IG9udG8gdGhlIGVsZW1lbnQgaWRlbnRpZmllZCBieSBpdHMgc2VsZWN0b3Igb3IsIG9wdGlvbmFsbHksIHRvIGFcbiAgICogc3BlY2lmaWVkIGVsZW1lbnQuXG4gICAqXG4gICAqIEB1c2FnZU5vdGVzXG4gICAqICMjIyBCb290c3RyYXAgcHJvY2Vzc1xuICAgKlxuICAgKiBXaGVuIGJvb3RzdHJhcHBpbmcgYSBjb21wb25lbnQsIEFuZ3VsYXIgbW91bnRzIGl0IG9udG8gYSB0YXJnZXQgRE9NIGVsZW1lbnRcbiAgICogYW5kIGtpY2tzIG9mZiBhdXRvbWF0aWMgY2hhbmdlIGRldGVjdGlvbi4gVGhlIHRhcmdldCBET00gZWxlbWVudCBjYW4gYmVcbiAgICogcHJvdmlkZWQgdXNpbmcgdGhlIGByb290U2VsZWN0b3JPck5vZGVgIGFyZ3VtZW50LlxuICAgKlxuICAgKiBJZiB0aGUgdGFyZ2V0IERPTSBlbGVtZW50IGlzIG5vdCBwcm92aWRlZCwgQW5ndWxhciB0cmllcyB0byBmaW5kIG9uZSBvbiBhIHBhZ2VcbiAgICogdXNpbmcgdGhlIGBzZWxlY3RvcmAgb2YgdGhlIGNvbXBvbmVudCB0aGF0IGlzIGJlaW5nIGJvb3RzdHJhcHBlZFxuICAgKiAoZmlyc3QgbWF0Y2hlZCBlbGVtZW50IGlzIHVzZWQpLlxuICAgKlxuICAgKiAjIyMgRXhhbXBsZVxuICAgKlxuICAgKiBHZW5lcmFsbHksIHdlIGRlZmluZSB0aGUgY29tcG9uZW50IHRvIGJvb3RzdHJhcCBpbiB0aGUgYGJvb3RzdHJhcGAgYXJyYXkgb2YgYE5nTW9kdWxlYCxcbiAgICogYnV0IGl0IHJlcXVpcmVzIHVzIHRvIGtub3cgdGhlIGNvbXBvbmVudCB3aGlsZSB3cml0aW5nIHRoZSBhcHBsaWNhdGlvbiBjb2RlLlxuICAgKlxuICAgKiBJbWFnaW5lIGEgc2l0dWF0aW9uIHdoZXJlIHdlIGhhdmUgdG8gd2FpdCBmb3IgYW4gQVBJIGNhbGwgdG8gZGVjaWRlIGFib3V0IHRoZSBjb21wb25lbnQgdG9cbiAgICogYm9vdHN0cmFwLiBXZSBjYW4gdXNlIHRoZSBgbmdEb0Jvb3RzdHJhcGAgaG9vayBvZiB0aGUgYE5nTW9kdWxlYCBhbmQgY2FsbCB0aGlzIG1ldGhvZCB0b1xuICAgKiBkeW5hbWljYWxseSBib290c3RyYXAgYSBjb21wb25lbnQuXG4gICAqXG4gICAqIHtAZXhhbXBsZSBjb3JlL3RzL3BsYXRmb3JtL3BsYXRmb3JtLnRzIHJlZ2lvbj0nY29tcG9uZW50U2VsZWN0b3InfVxuICAgKlxuICAgKiBPcHRpb25hbGx5LCBhIGNvbXBvbmVudCBjYW4gYmUgbW91bnRlZCBvbnRvIGEgRE9NIGVsZW1lbnQgdGhhdCBkb2VzIG5vdCBtYXRjaCB0aGVcbiAgICogc2VsZWN0b3Igb2YgdGhlIGJvb3RzdHJhcHBlZCBjb21wb25lbnQuXG4gICAqXG4gICAqIEluIHRoZSBmb2xsb3dpbmcgZXhhbXBsZSwgd2UgYXJlIHByb3ZpZGluZyBhIENTUyBzZWxlY3RvciB0byBtYXRjaCB0aGUgdGFyZ2V0IGVsZW1lbnQuXG4gICAqXG4gICAqIHtAZXhhbXBsZSBjb3JlL3RzL3BsYXRmb3JtL3BsYXRmb3JtLnRzIHJlZ2lvbj0nY3NzU2VsZWN0b3InfVxuICAgKlxuICAgKiBXaGlsZSBpbiB0aGlzIGV4YW1wbGUsIHdlIGFyZSBwcm92aWRpbmcgcmVmZXJlbmNlIHRvIGEgRE9NIG5vZGUuXG4gICAqXG4gICAqIHtAZXhhbXBsZSBjb3JlL3RzL3BsYXRmb3JtL3BsYXRmb3JtLnRzIHJlZ2lvbj0nZG9tTm9kZSd9XG4gICAqXG4gICAqIEBkZXByZWNhdGVkIFBhc3NpbmcgQ29tcG9uZW50IGZhY3RvcmllcyBhcyB0aGUgYEFwcGxpY2F0aW9uLmJvb3RzdHJhcGAgZnVuY3Rpb24gYXJndW1lbnQgaXNcbiAgICogICAgIGRlcHJlY2F0ZWQuIFBhc3MgQ29tcG9uZW50IFR5cGVzIGluc3RlYWQuXG4gICAqL1xuICBib290c3RyYXA8Qz4oY29tcG9uZW50RmFjdG9yeTogQ29tcG9uZW50RmFjdG9yeTxDPiwgcm9vdFNlbGVjdG9yT3JOb2RlPzogc3RyaW5nfGFueSk6XG4gICAgICBDb21wb25lbnRSZWY8Qz47XG5cbiAgLyoqXG4gICAqIEJvb3RzdHJhcCBhIGNvbXBvbmVudCBvbnRvIHRoZSBlbGVtZW50IGlkZW50aWZpZWQgYnkgaXRzIHNlbGVjdG9yIG9yLCBvcHRpb25hbGx5LCB0byBhXG4gICAqIHNwZWNpZmllZCBlbGVtZW50LlxuICAgKlxuICAgKiBAdXNhZ2VOb3Rlc1xuICAgKiAjIyMgQm9vdHN0cmFwIHByb2Nlc3NcbiAgICpcbiAgICogV2hlbiBib290c3RyYXBwaW5nIGEgY29tcG9uZW50LCBBbmd1bGFyIG1vdW50cyBpdCBvbnRvIGEgdGFyZ2V0IERPTSBlbGVtZW50XG4gICAqIGFuZCBraWNrcyBvZmYgYXV0b21hdGljIGNoYW5nZSBkZXRlY3Rpb24uIFRoZSB0YXJnZXQgRE9NIGVsZW1lbnQgY2FuIGJlXG4gICAqIHByb3ZpZGVkIHVzaW5nIHRoZSBgcm9vdFNlbGVjdG9yT3JOb2RlYCBhcmd1bWVudC5cbiAgICpcbiAgICogSWYgdGhlIHRhcmdldCBET00gZWxlbWVudCBpcyBub3QgcHJvdmlkZWQsIEFuZ3VsYXIgdHJpZXMgdG8gZmluZCBvbmUgb24gYSBwYWdlXG4gICAqIHVzaW5nIHRoZSBgc2VsZWN0b3JgIG9mIHRoZSBjb21wb25lbnQgdGhhdCBpcyBiZWluZyBib290c3RyYXBwZWRcbiAgICogKGZpcnN0IG1hdGNoZWQgZWxlbWVudCBpcyB1c2VkKS5cbiAgICpcbiAgICogIyMjIEV4YW1wbGVcbiAgICpcbiAgICogR2VuZXJhbGx5LCB3ZSBkZWZpbmUgdGhlIGNvbXBvbmVudCB0byBib290c3RyYXAgaW4gdGhlIGBib290c3RyYXBgIGFycmF5IG9mIGBOZ01vZHVsZWAsXG4gICAqIGJ1dCBpdCByZXF1aXJlcyB1cyB0byBrbm93IHRoZSBjb21wb25lbnQgd2hpbGUgd3JpdGluZyB0aGUgYXBwbGljYXRpb24gY29kZS5cbiAgICpcbiAgICogSW1hZ2luZSBhIHNpdHVhdGlvbiB3aGVyZSB3ZSBoYXZlIHRvIHdhaXQgZm9yIGFuIEFQSSBjYWxsIHRvIGRlY2lkZSBhYm91dCB0aGUgY29tcG9uZW50IHRvXG4gICAqIGJvb3RzdHJhcC4gV2UgY2FuIHVzZSB0aGUgYG5nRG9Cb290c3RyYXBgIGhvb2sgb2YgdGhlIGBOZ01vZHVsZWAgYW5kIGNhbGwgdGhpcyBtZXRob2QgdG9cbiAgICogZHluYW1pY2FsbHkgYm9vdHN0cmFwIGEgY29tcG9uZW50LlxuICAgKlxuICAgKiB7QGV4YW1wbGUgY29yZS90cy9wbGF0Zm9ybS9wbGF0Zm9ybS50cyByZWdpb249J2NvbXBvbmVudFNlbGVjdG9yJ31cbiAgICpcbiAgICogT3B0aW9uYWxseSwgYSBjb21wb25lbnQgY2FuIGJlIG1vdW50ZWQgb250byBhIERPTSBlbGVtZW50IHRoYXQgZG9lcyBub3QgbWF0Y2ggdGhlXG4gICAqIHNlbGVjdG9yIG9mIHRoZSBib290c3RyYXBwZWQgY29tcG9uZW50LlxuICAgKlxuICAgKiBJbiB0aGUgZm9sbG93aW5nIGV4YW1wbGUsIHdlIGFyZSBwcm92aWRpbmcgYSBDU1Mgc2VsZWN0b3IgdG8gbWF0Y2ggdGhlIHRhcmdldCBlbGVtZW50LlxuICAgKlxuICAgKiB7QGV4YW1wbGUgY29yZS90cy9wbGF0Zm9ybS9wbGF0Zm9ybS50cyByZWdpb249J2Nzc1NlbGVjdG9yJ31cbiAgICpcbiAgICogV2hpbGUgaW4gdGhpcyBleGFtcGxlLCB3ZSBhcmUgcHJvdmlkaW5nIHJlZmVyZW5jZSB0byBhIERPTSBub2RlLlxuICAgKlxuICAgKiB7QGV4YW1wbGUgY29yZS90cy9wbGF0Zm9ybS9wbGF0Zm9ybS50cyByZWdpb249J2RvbU5vZGUnfVxuICAgKi9cbiAgYm9vdHN0cmFwPEM+KGNvbXBvbmVudE9yRmFjdG9yeTogQ29tcG9uZW50RmFjdG9yeTxDPnxUeXBlPEM+LCByb290U2VsZWN0b3JPck5vZGU/OiBzdHJpbmd8YW55KTpcbiAgICAgIENvbXBvbmVudFJlZjxDPiB7XG4gICAgTkdfREVWX01PREUgJiYgdGhpcy53YXJuSWZEZXN0cm95ZWQoKTtcbiAgICBjb25zdCBpc0NvbXBvbmVudEZhY3RvcnkgPSBjb21wb25lbnRPckZhY3RvcnkgaW5zdGFuY2VvZiBDb21wb25lbnRGYWN0b3J5O1xuICAgIGNvbnN0IGluaXRTdGF0dXMgPSB0aGlzLl9pbmplY3Rvci5nZXQoQXBwbGljYXRpb25Jbml0U3RhdHVzKTtcblxuICAgIGlmICghaW5pdFN0YXR1cy5kb25lKSB7XG4gICAgICBjb25zdCBzdGFuZGFsb25lID0gIWlzQ29tcG9uZW50RmFjdG9yeSAmJiBpc1N0YW5kYWxvbmUoY29tcG9uZW50T3JGYWN0b3J5KTtcbiAgICAgIGNvbnN0IGVycm9yTWVzc2FnZSA9XG4gICAgICAgICAgJ0Nhbm5vdCBib290c3RyYXAgYXMgdGhlcmUgYXJlIHN0aWxsIGFzeW5jaHJvbm91cyBpbml0aWFsaXplcnMgcnVubmluZy4nICtcbiAgICAgICAgICAoc3RhbmRhbG9uZSA/ICcnIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICcgQm9vdHN0cmFwIGNvbXBvbmVudHMgaW4gdGhlIGBuZ0RvQm9vdHN0cmFwYCBtZXRob2Qgb2YgdGhlIHJvb3QgbW9kdWxlLicpO1xuICAgICAgdGhyb3cgbmV3IFJ1bnRpbWVFcnJvcihcbiAgICAgICAgICBSdW50aW1lRXJyb3JDb2RlLkFTWU5DX0lOSVRJQUxJWkVSU19TVElMTF9SVU5OSU5HLCBOR19ERVZfTU9ERSAmJiBlcnJvck1lc3NhZ2UpO1xuICAgIH1cblxuICAgIGxldCBjb21wb25lbnRGYWN0b3J5OiBDb21wb25lbnRGYWN0b3J5PEM+O1xuICAgIGlmIChpc0NvbXBvbmVudEZhY3RvcnkpIHtcbiAgICAgIGNvbXBvbmVudEZhY3RvcnkgPSBjb21wb25lbnRPckZhY3Rvcnk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHJlc29sdmVyID0gdGhpcy5faW5qZWN0b3IuZ2V0KENvbXBvbmVudEZhY3RvcnlSZXNvbHZlcik7XG4gICAgICBjb21wb25lbnRGYWN0b3J5ID0gcmVzb2x2ZXIucmVzb2x2ZUNvbXBvbmVudEZhY3RvcnkoY29tcG9uZW50T3JGYWN0b3J5KSE7XG4gICAgfVxuICAgIHRoaXMuY29tcG9uZW50VHlwZXMucHVzaChjb21wb25lbnRGYWN0b3J5LmNvbXBvbmVudFR5cGUpO1xuXG4gICAgLy8gQ3JlYXRlIGEgZmFjdG9yeSBhc3NvY2lhdGVkIHdpdGggdGhlIGN1cnJlbnQgbW9kdWxlIGlmIGl0J3Mgbm90IGJvdW5kIHRvIHNvbWUgb3RoZXJcbiAgICBjb25zdCBuZ01vZHVsZSA9XG4gICAgICAgIGlzQm91bmRUb01vZHVsZShjb21wb25lbnRGYWN0b3J5KSA/IHVuZGVmaW5lZCA6IHRoaXMuX2luamVjdG9yLmdldChOZ01vZHVsZVJlZik7XG4gICAgY29uc3Qgc2VsZWN0b3JPck5vZGUgPSByb290U2VsZWN0b3JPck5vZGUgfHwgY29tcG9uZW50RmFjdG9yeS5zZWxlY3RvcjtcbiAgICBjb25zdCBjb21wUmVmID0gY29tcG9uZW50RmFjdG9yeS5jcmVhdGUoSW5qZWN0b3IuTlVMTCwgW10sIHNlbGVjdG9yT3JOb2RlLCBuZ01vZHVsZSk7XG4gICAgY29uc3QgbmF0aXZlRWxlbWVudCA9IGNvbXBSZWYubG9jYXRpb24ubmF0aXZlRWxlbWVudDtcbiAgICBjb25zdCB0ZXN0YWJpbGl0eSA9IGNvbXBSZWYuaW5qZWN0b3IuZ2V0KFRFU1RBQklMSVRZLCBudWxsKTtcbiAgICB0ZXN0YWJpbGl0eT8ucmVnaXN0ZXJBcHBsaWNhdGlvbihuYXRpdmVFbGVtZW50KTtcblxuICAgIGNvbXBSZWYub25EZXN0cm95KCgpID0+IHtcbiAgICAgIHRoaXMuZGV0YWNoVmlldyhjb21wUmVmLmhvc3RWaWV3KTtcbiAgICAgIHJlbW92ZSh0aGlzLmNvbXBvbmVudHMsIGNvbXBSZWYpO1xuICAgICAgdGVzdGFiaWxpdHk/LnVucmVnaXN0ZXJBcHBsaWNhdGlvbihuYXRpdmVFbGVtZW50KTtcbiAgICB9KTtcblxuICAgIHRoaXMuX2xvYWRDb21wb25lbnQoY29tcFJlZik7XG4gICAgaWYgKHR5cGVvZiBuZ0Rldk1vZGUgPT09ICd1bmRlZmluZWQnIHx8IG5nRGV2TW9kZSkge1xuICAgICAgY29uc3QgX2NvbnNvbGUgPSB0aGlzLl9pbmplY3Rvci5nZXQoQ29uc29sZSk7XG4gICAgICBfY29uc29sZS5sb2coXG4gICAgICAgICAgYEFuZ3VsYXIgaXMgcnVubmluZyBpbiBkZXZlbG9wbWVudCBtb2RlLiBDYWxsIGVuYWJsZVByb2RNb2RlKCkgdG8gZW5hYmxlIHByb2R1Y3Rpb24gbW9kZS5gKTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbXBSZWY7XG4gIH1cblxuICAvKipcbiAgICogSW52b2tlIHRoaXMgbWV0aG9kIHRvIGV4cGxpY2l0bHkgcHJvY2VzcyBjaGFuZ2UgZGV0ZWN0aW9uIGFuZCBpdHMgc2lkZS1lZmZlY3RzLlxuICAgKlxuICAgKiBJbiBkZXZlbG9wbWVudCBtb2RlLCBgdGljaygpYCBhbHNvIHBlcmZvcm1zIGEgc2Vjb25kIGNoYW5nZSBkZXRlY3Rpb24gY3ljbGUgdG8gZW5zdXJlIHRoYXQgbm9cbiAgICogZnVydGhlciBjaGFuZ2VzIGFyZSBkZXRlY3RlZC4gSWYgYWRkaXRpb25hbCBjaGFuZ2VzIGFyZSBwaWNrZWQgdXAgZHVyaW5nIHRoaXMgc2Vjb25kIGN5Y2xlLFxuICAgKiBiaW5kaW5ncyBpbiB0aGUgYXBwIGhhdmUgc2lkZS1lZmZlY3RzIHRoYXQgY2Fubm90IGJlIHJlc29sdmVkIGluIGEgc2luZ2xlIGNoYW5nZSBkZXRlY3Rpb25cbiAgICogcGFzcy5cbiAgICogSW4gdGhpcyBjYXNlLCBBbmd1bGFyIHRocm93cyBhbiBlcnJvciwgc2luY2UgYW4gQW5ndWxhciBhcHBsaWNhdGlvbiBjYW4gb25seSBoYXZlIG9uZSBjaGFuZ2VcbiAgICogZGV0ZWN0aW9uIHBhc3MgZHVyaW5nIHdoaWNoIGFsbCBjaGFuZ2UgZGV0ZWN0aW9uIG11c3QgY29tcGxldGUuXG4gICAqL1xuICB0aWNrKCk6IHZvaWQge1xuICAgIE5HX0RFVl9NT0RFICYmIHRoaXMud2FybklmRGVzdHJveWVkKCk7XG4gICAgaWYgKHRoaXMuX3J1bm5pbmdUaWNrKSB7XG4gICAgICB0aHJvdyBuZXcgUnVudGltZUVycm9yKFxuICAgICAgICAgIFJ1bnRpbWVFcnJvckNvZGUuUkVDVVJTSVZFX0FQUExJQ0FUSU9OX1JFRl9USUNLLFxuICAgICAgICAgIG5nRGV2TW9kZSAmJiAnQXBwbGljYXRpb25SZWYudGljayBpcyBjYWxsZWQgcmVjdXJzaXZlbHknKTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgdGhpcy5fcnVubmluZ1RpY2sgPSB0cnVlO1xuICAgICAgZm9yIChsZXQgdmlldyBvZiB0aGlzLl92aWV3cykge1xuICAgICAgICB2aWV3LmRldGVjdENoYW5nZXMoKTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgbmdEZXZNb2RlID09PSAndW5kZWZpbmVkJyB8fCBuZ0Rldk1vZGUpIHtcbiAgICAgICAgZm9yIChsZXQgdmlldyBvZiB0aGlzLl92aWV3cykge1xuICAgICAgICAgIHZpZXcuY2hlY2tOb0NoYW5nZXMoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIEF0dGVudGlvbjogRG9uJ3QgcmV0aHJvdyBhcyBpdCBjb3VsZCBjYW5jZWwgc3Vic2NyaXB0aW9ucyB0byBPYnNlcnZhYmxlcyFcbiAgICAgIHRoaXMuX3pvbmUucnVuT3V0c2lkZUFuZ3VsYXIoKCkgPT4gdGhpcy5fZXhjZXB0aW9uSGFuZGxlci5oYW5kbGVFcnJvcihlKSk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMuX3J1bm5pbmdUaWNrID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEF0dGFjaGVzIGEgdmlldyBzbyB0aGF0IGl0IHdpbGwgYmUgZGlydHkgY2hlY2tlZC5cbiAgICogVGhlIHZpZXcgd2lsbCBiZSBhdXRvbWF0aWNhbGx5IGRldGFjaGVkIHdoZW4gaXQgaXMgZGVzdHJveWVkLlxuICAgKiBUaGlzIHdpbGwgdGhyb3cgaWYgdGhlIHZpZXcgaXMgYWxyZWFkeSBhdHRhY2hlZCB0byBhIFZpZXdDb250YWluZXIuXG4gICAqL1xuICBhdHRhY2hWaWV3KHZpZXdSZWY6IFZpZXdSZWYpOiB2b2lkIHtcbiAgICBOR19ERVZfTU9ERSAmJiB0aGlzLndhcm5JZkRlc3Ryb3llZCgpO1xuICAgIGNvbnN0IHZpZXcgPSAodmlld1JlZiBhcyBJbnRlcm5hbFZpZXdSZWYpO1xuICAgIHRoaXMuX3ZpZXdzLnB1c2godmlldyk7XG4gICAgdmlldy5hdHRhY2hUb0FwcFJlZih0aGlzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXRhY2hlcyBhIHZpZXcgZnJvbSBkaXJ0eSBjaGVja2luZyBhZ2Fpbi5cbiAgICovXG4gIGRldGFjaFZpZXcodmlld1JlZjogVmlld1JlZik6IHZvaWQge1xuICAgIE5HX0RFVl9NT0RFICYmIHRoaXMud2FybklmRGVzdHJveWVkKCk7XG4gICAgY29uc3QgdmlldyA9ICh2aWV3UmVmIGFzIEludGVybmFsVmlld1JlZik7XG4gICAgcmVtb3ZlKHRoaXMuX3ZpZXdzLCB2aWV3KTtcbiAgICB2aWV3LmRldGFjaEZyb21BcHBSZWYoKTtcbiAgfVxuXG4gIHByaXZhdGUgX2xvYWRDb21wb25lbnQoY29tcG9uZW50UmVmOiBDb21wb25lbnRSZWY8YW55Pik6IHZvaWQge1xuICAgIHRoaXMuYXR0YWNoVmlldyhjb21wb25lbnRSZWYuaG9zdFZpZXcpO1xuICAgIHRoaXMudGljaygpO1xuICAgIHRoaXMuY29tcG9uZW50cy5wdXNoKGNvbXBvbmVudFJlZik7XG4gICAgLy8gR2V0IHRoZSBsaXN0ZW5lcnMgbGF6aWx5IHRvIHByZXZlbnQgREkgY3ljbGVzLlxuICAgIGNvbnN0IGxpc3RlbmVycyA9XG4gICAgICAgIHRoaXMuX2luamVjdG9yLmdldChBUFBfQk9PVFNUUkFQX0xJU1RFTkVSLCBbXSkuY29uY2F0KHRoaXMuX2Jvb3RzdHJhcExpc3RlbmVycyk7XG4gICAgbGlzdGVuZXJzLmZvckVhY2goKGxpc3RlbmVyKSA9PiBsaXN0ZW5lcihjb21wb25lbnRSZWYpKTtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgbmdPbkRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMuX2Rlc3Ryb3llZCkgcmV0dXJuO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIENhbGwgYWxsIHRoZSBsaWZlY3ljbGUgaG9va3MuXG4gICAgICB0aGlzLl9kZXN0cm95TGlzdGVuZXJzLmZvckVhY2gobGlzdGVuZXIgPT4gbGlzdGVuZXIoKSk7XG5cbiAgICAgIC8vIERlc3Ryb3kgYWxsIHJlZ2lzdGVyZWQgdmlld3MuXG4gICAgICB0aGlzLl92aWV3cy5zbGljZSgpLmZvckVhY2goKHZpZXcpID0+IHZpZXcuZGVzdHJveSgpKTtcbiAgICAgIHRoaXMuX29uTWljcm90YXNrRW1wdHlTdWJzY3JpcHRpb24udW5zdWJzY3JpYmUoKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgLy8gSW5kaWNhdGUgdGhhdCB0aGlzIGluc3RhbmNlIGlzIGRlc3Ryb3llZC5cbiAgICAgIHRoaXMuX2Rlc3Ryb3llZCA9IHRydWU7XG5cbiAgICAgIC8vIFJlbGVhc2UgYWxsIHJlZmVyZW5jZXMuXG4gICAgICB0aGlzLl92aWV3cyA9IFtdO1xuICAgICAgdGhpcy5fYm9vdHN0cmFwTGlzdGVuZXJzID0gW107XG4gICAgICB0aGlzLl9kZXN0cm95TGlzdGVuZXJzID0gW107XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyBhIGxpc3RlbmVyIHRvIGJlIGNhbGxlZCB3aGVuIGFuIGluc3RhbmNlIGlzIGRlc3Ryb3llZC5cbiAgICpcbiAgICogQHBhcmFtIGNhbGxiYWNrIEEgY2FsbGJhY2sgZnVuY3Rpb24gdG8gYWRkIGFzIGEgbGlzdGVuZXIuXG4gICAqIEByZXR1cm5zIEEgZnVuY3Rpb24gd2hpY2ggdW5yZWdpc3RlcnMgYSBsaXN0ZW5lci5cbiAgICpcbiAgICogQGludGVybmFsXG4gICAqL1xuICBvbkRlc3Ryb3koY2FsbGJhY2s6ICgpID0+IHZvaWQpOiBWb2lkRnVuY3Rpb24ge1xuICAgIE5HX0RFVl9NT0RFICYmIHRoaXMud2FybklmRGVzdHJveWVkKCk7XG4gICAgdGhpcy5fZGVzdHJveUxpc3RlbmVycy5wdXNoKGNhbGxiYWNrKTtcbiAgICByZXR1cm4gKCkgPT4gcmVtb3ZlKHRoaXMuX2Rlc3Ryb3lMaXN0ZW5lcnMsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXN0cm95cyBhbiBBbmd1bGFyIGFwcGxpY2F0aW9uIHJlcHJlc2VudGVkIGJ5IHRoaXMgYEFwcGxpY2F0aW9uUmVmYC4gQ2FsbGluZyB0aGlzIGZ1bmN0aW9uXG4gICAqIHdpbGwgZGVzdHJveSB0aGUgYXNzb2NpYXRlZCBlbnZpcm9ubWVudCBpbmplY3RvcnMgYXMgd2VsbCBhcyBhbGwgdGhlIGJvb3RzdHJhcHBlZCBjb21wb25lbnRzXG4gICAqIHdpdGggdGhlaXIgdmlld3MuXG4gICAqL1xuICBkZXN0cm95KCk6IHZvaWQge1xuICAgIGlmICh0aGlzLl9kZXN0cm95ZWQpIHtcbiAgICAgIHRocm93IG5ldyBSdW50aW1lRXJyb3IoXG4gICAgICAgICAgUnVudGltZUVycm9yQ29kZS5BUFBMSUNBVElPTl9SRUZfQUxSRUFEWV9ERVNUUk9ZRUQsXG4gICAgICAgICAgbmdEZXZNb2RlICYmICdUaGlzIGluc3RhbmNlIG9mIHRoZSBgQXBwbGljYXRpb25SZWZgIGhhcyBhbHJlYWR5IGJlZW4gZGVzdHJveWVkLicpO1xuICAgIH1cblxuICAgIC8vIFRoaXMgaXMgYSB0ZW1wb3JhcnkgdHlwZSB0byByZXByZXNlbnQgYW4gaW5zdGFuY2Ugb2YgYW4gUjNJbmplY3Rvciwgd2hpY2ggY2FuIGJlIGRlc3Ryb3llZC5cbiAgICAvLyBUaGUgdHlwZSB3aWxsIGJlIHJlcGxhY2VkIHdpdGggYSBkaWZmZXJlbnQgb25lIG9uY2UgZGVzdHJveWFibGUgaW5qZWN0b3IgdHlwZSBpcyBhdmFpbGFibGUuXG4gICAgdHlwZSBEZXN0cm95YWJsZUluamVjdG9yID0gSW5qZWN0b3Ime2Rlc3Ryb3k/OiBGdW5jdGlvbiwgZGVzdHJveWVkPzogYm9vbGVhbn07XG5cbiAgICBjb25zdCBpbmplY3RvciA9IHRoaXMuX2luamVjdG9yIGFzIERlc3Ryb3lhYmxlSW5qZWN0b3I7XG5cbiAgICAvLyBDaGVjayB0aGF0IHRoaXMgaW5qZWN0b3IgaW5zdGFuY2Ugc3VwcG9ydHMgZGVzdHJveSBvcGVyYXRpb24uXG4gICAgaWYgKGluamVjdG9yLmRlc3Ryb3kgJiYgIWluamVjdG9yLmRlc3Ryb3llZCkge1xuICAgICAgLy8gRGVzdHJveWluZyBhbiB1bmRlcmx5aW5nIGluamVjdG9yIHdpbGwgdHJpZ2dlciB0aGUgYG5nT25EZXN0cm95YCBsaWZlY3ljbGVcbiAgICAgIC8vIGhvb2ssIHdoaWNoIGludm9rZXMgdGhlIHJlbWFpbmluZyBjbGVhbnVwIGFjdGlvbnMuXG4gICAgICBpbmplY3Rvci5kZXN0cm95KCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIG51bWJlciBvZiBhdHRhY2hlZCB2aWV3cy5cbiAgICovXG4gIGdldCB2aWV3Q291bnQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3ZpZXdzLmxlbmd0aDtcbiAgfVxuXG4gIHByaXZhdGUgd2FybklmRGVzdHJveWVkKCkge1xuICAgIGlmIChOR19ERVZfTU9ERSAmJiB0aGlzLl9kZXN0cm95ZWQpIHtcbiAgICAgIGNvbnNvbGUud2Fybihmb3JtYXRSdW50aW1lRXJyb3IoXG4gICAgICAgICAgUnVudGltZUVycm9yQ29kZS5BUFBMSUNBVElPTl9SRUZfQUxSRUFEWV9ERVNUUk9ZRUQsXG4gICAgICAgICAgJ1RoaXMgaW5zdGFuY2Ugb2YgdGhlIGBBcHBsaWNhdGlvblJlZmAgaGFzIGFscmVhZHkgYmVlbiBkZXN0cm95ZWQuJykpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiByZW1vdmU8VD4obGlzdDogVFtdLCBlbDogVCk6IHZvaWQge1xuICBjb25zdCBpbmRleCA9IGxpc3QuaW5kZXhPZihlbCk7XG4gIGlmIChpbmRleCA+IC0xKSB7XG4gICAgbGlzdC5zcGxpY2UoaW5kZXgsIDEpO1xuICB9XG59XG5cbmZ1bmN0aW9uIF9sYXN0RGVmaW5lZDxUPihhcmdzOiBUW10pOiBUfHVuZGVmaW5lZCB7XG4gIGZvciAobGV0IGkgPSBhcmdzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgaWYgKGFyZ3NbaV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGFyZ3NbaV07XG4gICAgfVxuICB9XG4gIHJldHVybiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIF9tZXJnZUFycmF5cyhwYXJ0czogYW55W11bXSk6IGFueVtdIHtcbiAgY29uc3QgcmVzdWx0OiBhbnlbXSA9IFtdO1xuICBwYXJ0cy5mb3JFYWNoKChwYXJ0KSA9PiBwYXJ0ICYmIHJlc3VsdC5wdXNoKC4uLnBhcnQpKTtcbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdfQ==
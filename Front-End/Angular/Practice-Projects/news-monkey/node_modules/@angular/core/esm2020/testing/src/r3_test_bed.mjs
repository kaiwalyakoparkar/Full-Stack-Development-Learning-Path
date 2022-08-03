/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
// The formatter and CI disagree on how this import statement should be formatted. Both try to keep
// it on one line, too, which has gotten very hard to read & manage. So disable the formatter for
// this statement only.
/* clang-format off */
import { InjectFlags, Injector, NgZone, ɵflushModuleScopingQueueAsMuchAsPossible as flushModuleScopingQueueAsMuchAsPossible, ɵgetUnknownElementStrictMode as getUnknownElementStrictMode, ɵgetUnknownPropertyStrictMode as getUnknownPropertyStrictMode, ɵRender3ComponentFactory as ComponentFactory, ɵresetCompiledComponents as resetCompiledComponents, ɵsetAllowDuplicateNgModuleIdsForTest as setAllowDuplicateNgModuleIdsForTest, ɵsetUnknownElementStrictMode as setUnknownElementStrictMode, ɵsetUnknownPropertyStrictMode as setUnknownPropertyStrictMode, ɵstringify as stringify, } from '@angular/core';
/* clang-format on */
import { ComponentFixture } from './component_fixture';
import { R3TestBedCompiler } from './r3_test_bed_compiler';
import { ComponentFixtureAutoDetect, ComponentFixtureNoNgZone, TEARDOWN_TESTING_MODULE_ON_DESTROY_DEFAULT, TestComponentRenderer, THROW_ON_UNKNOWN_ELEMENTS_DEFAULT, THROW_ON_UNKNOWN_PROPERTIES_DEFAULT } from './test_bed_common';
let _nextRootElementId = 0;
/**
 * @description
 * Configures and initializes environment for unit testing and provides methods for
 * creating components and services in unit tests.
 *
 * TestBed is the primary api for writing unit tests for Angular applications and libraries.
 *
 * Note: Use `TestBed` in tests. It will be set to either `TestBedViewEngine` or `TestBedRender3`
 * according to the compiler used.
 */
export class TestBedRender3 {
    constructor() {
        // Properties
        this.platform = null;
        this.ngModule = null;
        this._compiler = null;
        this._testModuleRef = null;
        this._activeFixtures = [];
        this._globalCompilationChecked = false;
    }
    /**
     * Initialize the environment for testing with a compiler factory, a PlatformRef, and an
     * angular module. These are common to every test in the suite.
     *
     * This may only be called once, to set up the common providers for the current test
     * suite on the current platform. If you absolutely need to change the providers,
     * first use `resetTestEnvironment`.
     *
     * Test modules and platforms for individual platforms are available from
     * '@angular/<platform_name>/testing'.
     *
     * @publicApi
     */
    static initTestEnvironment(ngModule, platform, options) {
        const testBed = _getTestBedRender3();
        testBed.initTestEnvironment(ngModule, platform, options);
        return testBed;
    }
    /**
     * Reset the providers for the test injector.
     *
     * @publicApi
     */
    static resetTestEnvironment() {
        _getTestBedRender3().resetTestEnvironment();
    }
    static configureCompiler(config) {
        _getTestBedRender3().configureCompiler(config);
        return TestBedRender3;
    }
    /**
     * Allows overriding default providers, directives, pipes, modules of the test injector,
     * which are defined in test_injector.js
     */
    static configureTestingModule(moduleDef) {
        _getTestBedRender3().configureTestingModule(moduleDef);
        return TestBedRender3;
    }
    /**
     * Compile components with a `templateUrl` for the test's NgModule.
     * It is necessary to call this function
     * as fetching urls is asynchronous.
     */
    static compileComponents() {
        return _getTestBedRender3().compileComponents();
    }
    static overrideModule(ngModule, override) {
        _getTestBedRender3().overrideModule(ngModule, override);
        return TestBedRender3;
    }
    static overrideComponent(component, override) {
        _getTestBedRender3().overrideComponent(component, override);
        return TestBedRender3;
    }
    static overrideDirective(directive, override) {
        _getTestBedRender3().overrideDirective(directive, override);
        return TestBedRender3;
    }
    static overridePipe(pipe, override) {
        _getTestBedRender3().overridePipe(pipe, override);
        return TestBedRender3;
    }
    static overrideTemplate(component, template) {
        _getTestBedRender3().overrideComponent(component, { set: { template, templateUrl: null } });
        return TestBedRender3;
    }
    /**
     * Overrides the template of the given component, compiling the template
     * in the context of the TestingModule.
     *
     * Note: This works for JIT and AOTed components as well.
     */
    static overrideTemplateUsingTestingModule(component, template) {
        _getTestBedRender3().overrideTemplateUsingTestingModule(component, template);
        return TestBedRender3;
    }
    static overrideProvider(token, provider) {
        _getTestBedRender3().overrideProvider(token, provider);
        return TestBedRender3;
    }
    static inject(token, notFoundValue, flags) {
        return _getTestBedRender3().inject(token, notFoundValue, flags);
    }
    /** @deprecated from v9.0.0 use TestBed.inject */
    static get(token, notFoundValue = Injector.THROW_IF_NOT_FOUND, flags = InjectFlags.Default) {
        return _getTestBedRender3().inject(token, notFoundValue, flags);
    }
    static createComponent(component) {
        return _getTestBedRender3().createComponent(component);
    }
    static resetTestingModule() {
        _getTestBedRender3().resetTestingModule();
        return TestBedRender3;
    }
    static shouldTearDownTestingModule() {
        return _getTestBedRender3().shouldTearDownTestingModule();
    }
    static tearDownTestingModule() {
        _getTestBedRender3().tearDownTestingModule();
    }
    /**
     * Initialize the environment for testing with a compiler factory, a PlatformRef, and an
     * angular module. These are common to every test in the suite.
     *
     * This may only be called once, to set up the common providers for the current test
     * suite on the current platform. If you absolutely need to change the providers,
     * first use `resetTestEnvironment`.
     *
     * Test modules and platforms for individual platforms are available from
     * '@angular/<platform_name>/testing'.
     *
     * @publicApi
     */
    initTestEnvironment(ngModule, platform, options) {
        if (this.platform || this.ngModule) {
            throw new Error('Cannot set base providers because it has already been called');
        }
        TestBedRender3._environmentTeardownOptions = options?.teardown;
        TestBedRender3._environmentErrorOnUnknownElementsOption = options?.errorOnUnknownElements;
        TestBedRender3._environmentErrorOnUnknownPropertiesOption = options?.errorOnUnknownProperties;
        this.platform = platform;
        this.ngModule = ngModule;
        this._compiler = new R3TestBedCompiler(this.platform, this.ngModule);
        // TestBed does not have an API which can reliably detect the start of a test, and thus could be
        // used to track the state of the NgModule registry and reset it correctly. Instead, when we
        // know we're in a testing scenario, we disable the check for duplicate NgModule registration
        // completely.
        setAllowDuplicateNgModuleIdsForTest(true);
    }
    /**
     * Reset the providers for the test injector.
     *
     * @publicApi
     */
    resetTestEnvironment() {
        this.resetTestingModule();
        this._compiler = null;
        this.platform = null;
        this.ngModule = null;
        TestBedRender3._environmentTeardownOptions = undefined;
        setAllowDuplicateNgModuleIdsForTest(false);
    }
    resetTestingModule() {
        this.checkGlobalCompilationFinished();
        resetCompiledComponents();
        if (this._compiler !== null) {
            this.compiler.restoreOriginalState();
        }
        this._compiler = new R3TestBedCompiler(this.platform, this.ngModule);
        // Restore the previous value of the "error on unknown elements" option
        setUnknownElementStrictMode(this._previousErrorOnUnknownElementsOption ?? THROW_ON_UNKNOWN_ELEMENTS_DEFAULT);
        // Restore the previous value of the "error on unknown properties" option
        setUnknownPropertyStrictMode(this._previousErrorOnUnknownPropertiesOption ?? THROW_ON_UNKNOWN_PROPERTIES_DEFAULT);
        // We have to chain a couple of try/finally blocks, because each step can
        // throw errors and we don't want it to interrupt the next step and we also
        // want an error to be thrown at the end.
        try {
            this.destroyActiveFixtures();
        }
        finally {
            try {
                if (this.shouldTearDownTestingModule()) {
                    this.tearDownTestingModule();
                }
            }
            finally {
                this._testModuleRef = null;
                this._instanceTeardownOptions = undefined;
                this._instanceErrorOnUnknownElementsOption = undefined;
                this._instanceErrorOnUnknownPropertiesOption = undefined;
            }
        }
    }
    configureCompiler(config) {
        if (config.useJit != null) {
            throw new Error('the Render3 compiler JiT mode is not configurable !');
        }
        if (config.providers !== undefined) {
            this.compiler.setCompilerProviders(config.providers);
        }
    }
    configureTestingModule(moduleDef) {
        this.assertNotInstantiated('R3TestBed.configureTestingModule', 'configure the test module');
        // Trigger module scoping queue flush before executing other TestBed operations in a test.
        // This is needed for the first test invocation to ensure that globally declared modules have
        // their components scoped properly. See the `checkGlobalCompilationFinished` function
        // description for additional info.
        this.checkGlobalCompilationFinished();
        // Always re-assign the options, even if they're undefined.
        // This ensures that we don't carry them between tests.
        this._instanceTeardownOptions = moduleDef.teardown;
        this._instanceErrorOnUnknownElementsOption = moduleDef.errorOnUnknownElements;
        this._instanceErrorOnUnknownPropertiesOption = moduleDef.errorOnUnknownProperties;
        // Store the current value of the strict mode option,
        // so we can restore it later
        this._previousErrorOnUnknownElementsOption = getUnknownElementStrictMode();
        setUnknownElementStrictMode(this.shouldThrowErrorOnUnknownElements());
        this._previousErrorOnUnknownPropertiesOption = getUnknownPropertyStrictMode();
        setUnknownPropertyStrictMode(this.shouldThrowErrorOnUnknownProperties());
        this.compiler.configureTestingModule(moduleDef);
    }
    compileComponents() {
        return this.compiler.compileComponents();
    }
    inject(token, notFoundValue, flags) {
        if (token === TestBedRender3) {
            return this;
        }
        const UNDEFINED = {};
        const result = this.testModuleRef.injector.get(token, UNDEFINED, flags);
        return result === UNDEFINED ? this.compiler.injector.get(token, notFoundValue, flags) :
            result;
    }
    /** @deprecated from v9.0.0 use TestBed.inject */
    get(token, notFoundValue = Injector.THROW_IF_NOT_FOUND, flags = InjectFlags.Default) {
        return this.inject(token, notFoundValue, flags);
    }
    execute(tokens, fn, context) {
        const params = tokens.map(t => this.inject(t));
        return fn.apply(context, params);
    }
    overrideModule(ngModule, override) {
        this.assertNotInstantiated('overrideModule', 'override module metadata');
        this.compiler.overrideModule(ngModule, override);
    }
    overrideComponent(component, override) {
        this.assertNotInstantiated('overrideComponent', 'override component metadata');
        this.compiler.overrideComponent(component, override);
    }
    overrideTemplateUsingTestingModule(component, template) {
        this.assertNotInstantiated('R3TestBed.overrideTemplateUsingTestingModule', 'Cannot override template when the test module has already been instantiated');
        this.compiler.overrideTemplateUsingTestingModule(component, template);
    }
    overrideDirective(directive, override) {
        this.assertNotInstantiated('overrideDirective', 'override directive metadata');
        this.compiler.overrideDirective(directive, override);
    }
    overridePipe(pipe, override) {
        this.assertNotInstantiated('overridePipe', 'override pipe metadata');
        this.compiler.overridePipe(pipe, override);
    }
    /**
     * Overwrites all providers for the given token with the given provider definition.
     */
    overrideProvider(token, provider) {
        this.assertNotInstantiated('overrideProvider', 'override provider');
        this.compiler.overrideProvider(token, provider);
    }
    createComponent(type) {
        const testComponentRenderer = this.inject(TestComponentRenderer);
        const rootElId = `root${_nextRootElementId++}`;
        testComponentRenderer.insertRootElement(rootElId);
        const componentDef = type.ɵcmp;
        if (!componentDef) {
            throw new Error(`It looks like '${stringify(type)}' has not been compiled.`);
        }
        // TODO: Don't cast as `InjectionToken<boolean>`, proper type is boolean[]
        const noNgZone = this.inject(ComponentFixtureNoNgZone, false);
        // TODO: Don't cast as `InjectionToken<boolean>`, proper type is boolean[]
        const autoDetect = this.inject(ComponentFixtureAutoDetect, false);
        const ngZone = noNgZone ? null : this.inject(NgZone, null);
        const componentFactory = new ComponentFactory(componentDef);
        const initComponent = () => {
            const componentRef = componentFactory.create(Injector.NULL, [], `#${rootElId}`, this.testModuleRef);
            return new ComponentFixture(componentRef, ngZone, autoDetect);
        };
        const fixture = ngZone ? ngZone.run(initComponent) : initComponent();
        this._activeFixtures.push(fixture);
        return fixture;
    }
    /**
     * @internal strip this from published d.ts files due to
     * https://github.com/microsoft/TypeScript/issues/36216
     */
    get compiler() {
        if (this._compiler === null) {
            throw new Error(`Need to call TestBed.initTestEnvironment() first`);
        }
        return this._compiler;
    }
    /**
     * @internal strip this from published d.ts files due to
     * https://github.com/microsoft/TypeScript/issues/36216
     */
    get testModuleRef() {
        if (this._testModuleRef === null) {
            this._testModuleRef = this.compiler.finalize();
        }
        return this._testModuleRef;
    }
    assertNotInstantiated(methodName, methodDescription) {
        if (this._testModuleRef !== null) {
            throw new Error(`Cannot ${methodDescription} when the test module has already been instantiated. ` +
                `Make sure you are not using \`inject\` before \`${methodName}\`.`);
        }
    }
    /**
     * Check whether the module scoping queue should be flushed, and flush it if needed.
     *
     * When the TestBed is reset, it clears the JIT module compilation queue, cancelling any
     * in-progress module compilation. This creates a potential hazard - the very first time the
     * TestBed is initialized (or if it's reset without being initialized), there may be pending
     * compilations of modules declared in global scope. These compilations should be finished.
     *
     * To ensure that globally declared modules have their components scoped properly, this function
     * is called whenever TestBed is initialized or reset. The _first_ time that this happens, prior
     * to any other operations, the scoping queue is flushed.
     */
    checkGlobalCompilationFinished() {
        // Checking _testNgModuleRef is null should not be necessary, but is left in as an additional
        // guard that compilations queued in tests (after instantiation) are never flushed accidentally.
        if (!this._globalCompilationChecked && this._testModuleRef === null) {
            flushModuleScopingQueueAsMuchAsPossible();
        }
        this._globalCompilationChecked = true;
    }
    destroyActiveFixtures() {
        let errorCount = 0;
        this._activeFixtures.forEach((fixture) => {
            try {
                fixture.destroy();
            }
            catch (e) {
                errorCount++;
                console.error('Error during cleanup of component', {
                    component: fixture.componentInstance,
                    stacktrace: e,
                });
            }
        });
        this._activeFixtures = [];
        if (errorCount > 0 && this.shouldRethrowTeardownErrors()) {
            throw Error(`${errorCount} ${(errorCount === 1 ? 'component' : 'components')} ` +
                `threw errors during cleanup`);
        }
    }
    shouldRethrowTeardownErrors() {
        const instanceOptions = this._instanceTeardownOptions;
        const environmentOptions = TestBedRender3._environmentTeardownOptions;
        // If the new teardown behavior hasn't been configured, preserve the old behavior.
        if (!instanceOptions && !environmentOptions) {
            return TEARDOWN_TESTING_MODULE_ON_DESTROY_DEFAULT;
        }
        // Otherwise use the configured behavior or default to rethrowing.
        return instanceOptions?.rethrowErrors ?? environmentOptions?.rethrowErrors ??
            this.shouldTearDownTestingModule();
    }
    shouldThrowErrorOnUnknownElements() {
        // Check if a configuration has been provided to throw when an unknown element is found
        return this._instanceErrorOnUnknownElementsOption ??
            TestBedRender3._environmentErrorOnUnknownElementsOption ??
            THROW_ON_UNKNOWN_ELEMENTS_DEFAULT;
    }
    shouldThrowErrorOnUnknownProperties() {
        // Check if a configuration has been provided to throw when an unknown property is found
        return this._instanceErrorOnUnknownPropertiesOption ??
            TestBedRender3._environmentErrorOnUnknownPropertiesOption ??
            THROW_ON_UNKNOWN_PROPERTIES_DEFAULT;
    }
    shouldTearDownTestingModule() {
        return this._instanceTeardownOptions?.destroyAfterEach ??
            TestBedRender3._environmentTeardownOptions?.destroyAfterEach ??
            TEARDOWN_TESTING_MODULE_ON_DESTROY_DEFAULT;
    }
    tearDownTestingModule() {
        // If the module ref has already been destroyed, we won't be able to get a test renderer.
        if (this._testModuleRef === null) {
            return;
        }
        // Resolve the renderer ahead of time, because we want to remove the root elements as the very
        // last step, but the injector will be destroyed as a part of the module ref destruction.
        const testRenderer = this.inject(TestComponentRenderer);
        try {
            this._testModuleRef.destroy();
        }
        catch (e) {
            if (this.shouldRethrowTeardownErrors()) {
                throw e;
            }
            else {
                console.error('Error during cleanup of a testing module', {
                    component: this._testModuleRef.instance,
                    stacktrace: e,
                });
            }
        }
        finally {
            testRenderer.removeAllRootElements?.();
        }
    }
}
let testBed;
export function _getTestBedRender3() {
    return testBed = testBed || new TestBedRender3();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfdGVzdF9iZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3Rlc3Rpbmcvc3JjL3IzX3Rlc3RfYmVkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILG1HQUFtRztBQUNuRyxpR0FBaUc7QUFDakcsdUJBQXVCO0FBRXZCLHNCQUFzQjtBQUN0QixPQUFPLEVBR0wsV0FBVyxFQUVYLFFBQVEsRUFFUixNQUFNLEVBS04sd0NBQXdDLElBQUksdUNBQXVDLEVBQ25GLDRCQUE0QixJQUFJLDJCQUEyQixFQUMzRCw2QkFBNkIsSUFBSSw0QkFBNEIsRUFDN0Qsd0JBQXdCLElBQUksZ0JBQWdCLEVBRTVDLHdCQUF3QixJQUFJLHVCQUF1QixFQUNuRCxvQ0FBb0MsSUFBSSxtQ0FBbUMsRUFDM0UsNEJBQTRCLElBQUksMkJBQTJCLEVBQzNELDZCQUE2QixJQUFJLDRCQUE0QixFQUM3RCxVQUFVLElBQUksU0FBUyxHQUN4QixNQUFNLGVBQWUsQ0FBQztBQUV2QixxQkFBcUI7QUFFckIsT0FBTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFFckQsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFekQsT0FBTyxFQUFDLDBCQUEwQixFQUFFLHdCQUF3QixFQUF5QiwwQ0FBMEMsRUFBaUIscUJBQXFCLEVBQThDLGlDQUFpQyxFQUFFLG1DQUFtQyxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFFcFQsSUFBSSxrQkFBa0IsR0FBRyxDQUFDLENBQUM7QUFHM0I7Ozs7Ozs7OztHQVNHO0FBQ0gsTUFBTSxPQUFPLGNBQWM7SUFBM0I7UUE0TEUsYUFBYTtRQUViLGFBQVEsR0FBZ0IsSUFBSyxDQUFDO1FBQzlCLGFBQVEsR0FBMEIsSUFBSyxDQUFDO1FBRWhDLGNBQVMsR0FBMkIsSUFBSSxDQUFDO1FBQ3pDLG1CQUFjLEdBQTBCLElB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b0JBQ3hELFNBQVMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVE7b0JBQ3ZDLFVBQVUsRUFBRSxDQUFDO2lCQUNkLENBQUMsQ0FBQzthQUNKO1NBQ0Y7Z0JBQVM7WUFDUixZQUFZLENBQUMscUJBQXFCLEVBQUUsRUFBRSxDQUFDO1NBQ3hDO0lBQ0gsQ0FBQztDQUNGO0FBRUQsSUFBSSxPQUF1QixDQUFDO0FBRTVCLE1BQU0sVUFBVSxrQkFBa0I7SUFDaEMsT0FBTyxPQUFPLEdBQUcsT0FBTyxJQUFJLElBQUksY0FBYyxFQUFFLENBQUM7QUFDbkQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vLyBUaGUgZm9ybWF0dGVyIGFuZCBDSSBkaXNhZ3JlZSBvbiBob3cgdGhpcyBpbXBvcnQgc3RhdGVtZW50IHNob3VsZCBiZSBmb3JtYXR0ZWQuIEJvdGggdHJ5IHRvIGtlZXBcbi8vIGl0IG9uIG9uZSBsaW5lLCB0b28sIHdoaWNoIGhhcyBnb3R0ZW4gdmVyeSBoYXJkIHRvIHJlYWQgJiBtYW5hZ2UuIFNvIGRpc2FibGUgdGhlIGZvcm1hdHRlciBmb3Jcbi8vIHRoaXMgc3RhdGVtZW50IG9ubHkuXG5cbi8qIGNsYW5nLWZvcm1hdCBvZmYgKi9cbmltcG9ydCB7XG4gIENvbXBvbmVudCxcbiAgRGlyZWN0aXZlLFxuICBJbmplY3RGbGFncyxcbiAgSW5qZWN0aW9uVG9rZW4sXG4gIEluamVjdG9yLFxuICBOZ01vZHVsZSxcbiAgTmdab25lLFxuICBQaXBlLFxuICBQbGF0Zm9ybVJlZixcbiAgUHJvdmlkZXJUb2tlbixcbiAgVHlwZSxcbiAgybVmbHVzaE1vZHVsZVNjb3BpbmdRdWV1ZUFzTXVjaEFzUG9zc2libGUgYXMgZmx1c2hNb2R1bGVTY29waW5nUXVldWVBc011Y2hBc1Bvc3NpYmxlLFxuICDJtWdldFVua25vd25FbGVtZW50U3RyaWN0TW9kZSBhcyBnZXRVbmtub3duRWxlbWVudFN0cmljdE1vZGUsXG4gIMm1Z2V0VW5rbm93blByb3BlcnR5U3RyaWN0TW9kZSBhcyBnZXRVbmtub3duUHJvcGVydHlTdHJpY3RNb2RlLFxuICDJtVJlbmRlcjNDb21wb25lbnRGYWN0b3J5IGFzIENvbXBvbmVudEZhY3RvcnksXG4gIMm1UmVuZGVyM05nTW9kdWxlUmVmIGFzIE5nTW9kdWxlUmVmLFxuICDJtXJlc2V0Q29tcGlsZWRDb21wb25lbnRzIGFzIHJlc2V0Q29tcGlsZWRDb21wb25lbnRzLFxuICDJtXNldEFsbG93RHVwbGljYXRlTmdNb2R1bGVJZHNGb3JUZXN0IGFzIHNldEFsbG93RHVwbGljYXRlTmdNb2R1bGVJZHNGb3JUZXN0LFxuICDJtXNldFVua25vd25FbGVtZW50U3RyaWN0TW9kZSBhcyBzZXRVbmtub3duRWxlbWVudFN0cmljdE1vZGUsXG4gIMm1c2V0VW5rbm93blByb3BlcnR5U3RyaWN0TW9kZSBhcyBzZXRVbmtub3duUHJvcGVydHlTdHJpY3RNb2RlLFxuICDJtXN0cmluZ2lmeSBhcyBzdHJpbmdpZnksXG59IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuXG4vKiBjbGFuZy1mb3JtYXQgb24gKi9cblxuaW1wb3J0IHtDb21wb25lbnRGaXh0dXJlfSBmcm9tICcuL2NvbXBvbmVudF9maXh0dXJlJztcbmltcG9ydCB7TWV0YWRhdGFPdmVycmlkZX0gZnJvbSAnLi9tZXRhZGF0YV9vdmVycmlkZSc7XG5pbXBvcnQge1IzVGVzdEJlZENvbXBpbGVyfSBmcm9tICcuL3IzX3Rlc3RfYmVkX2NvbXBpbGVyJztcbmltcG9ydCB7VGVzdEJlZH0gZnJvbSAnLi90ZXN0X2JlZCc7XG5pbXBvcnQge0NvbXBvbmVudEZpeHR1cmVBdXRvRGV0ZWN0LCBDb21wb25lbnRGaXh0dXJlTm9OZ1pvbmUsIE1vZHVsZVRlYXJkb3duT3B0aW9ucywgVEVBUkRPV05fVEVTVElOR19NT0RVTEVfT05fREVTVFJPWV9ERUZBVUxULCBUZXN0QmVkU3RhdGljLCBUZXN0Q29tcG9uZW50UmVuZGVyZXIsIFRlc3RFbnZpcm9ubWVudE9wdGlvbnMsIFRlc3RNb2R1bGVNZXRhZGF0YSwgVEhST1dfT05fVU5LTk9XTl9FTEVNRU5UU19ERUZBVUxULCBUSFJPV19PTl9VTktOT1dOX1BST1BFUlRJRVNfREVGQVVMVH0gZnJvbSAnLi90ZXN0X2JlZF9jb21tb24nO1xuXG5sZXQgX25leHRSb290RWxlbWVudElkID0gMDtcblxuXG4vKipcbiAqIEBkZXNjcmlwdGlvblxuICogQ29uZmlndXJlcyBhbmQgaW5pdGlhbGl6ZXMgZW52aXJvbm1lbnQgZm9yIHVuaXQgdGVzdGluZyBhbmQgcHJvdmlkZXMgbWV0aG9kcyBmb3JcbiAqIGNyZWF0aW5nIGNvbXBvbmVudHMgYW5kIHNlcnZpY2VzIGluIHVuaXQgdGVzdHMuXG4gKlxuICogVGVzdEJlZCBpcyB0aGUgcHJpbWFyeSBhcGkgZm9yIHdyaXRpbmcgdW5pdCB0ZXN0cyBmb3IgQW5ndWxhciBhcHBsaWNhdGlvbnMgYW5kIGxpYnJhcmllcy5cbiAqXG4gKiBOb3RlOiBVc2UgYFRlc3RCZWRgIGluIHRlc3RzLiBJdCB3aWxsIGJlIHNldCB0byBlaXRoZXIgYFRlc3RCZWRWaWV3RW5naW5lYCBvciBgVGVzdEJlZFJlbmRlcjNgXG4gKiBhY2NvcmRpbmcgdG8gdGhlIGNvbXBpbGVyIHVzZWQuXG4gKi9cbmV4cG9ydCBjbGFzcyBUZXN0QmVkUmVuZGVyMyBpbXBsZW1lbnRzIFRlc3RCZWQge1xuICAvKipcbiAgICogVGVhcmRvd24gb3B0aW9ucyB0aGF0IGhhdmUgYmVlbiBjb25maWd1cmVkIGF0IHRoZSBlbnZpcm9ubWVudCBsZXZlbC5cbiAgICogVXNlZCBhcyBhIGZhbGxiYWNrIGlmIG5vIGluc3RhbmNlLWxldmVsIG9wdGlvbnMgaGF2ZSBiZWVuIHByb3ZpZGVkLlxuICAgKi9cbiAgcHJpdmF0ZSBzdGF0aWMgX2Vudmlyb25tZW50VGVhcmRvd25PcHRpb25zOiBNb2R1bGVUZWFyZG93bk9wdGlvbnN8dW5kZWZpbmVkO1xuXG4gIC8qKlxuICAgKiBcIkVycm9yIG9uIHVua25vd24gZWxlbWVudHNcIiBvcHRpb24gdGhhdCBoYXMgYmVlbiBjb25maWd1cmVkIGF0IHRoZSBlbnZpcm9ubWVudCBsZXZlbC5cbiAgICogVXNlZCBhcyBhIGZhbGxiYWNrIGlmIG5vIGluc3RhbmNlLWxldmVsIG9wdGlvbiBoYXMgYmVlbiBwcm92aWRlZC5cbiAgICovXG4gIHByaXZhdGUgc3RhdGljIF9lbnZpcm9ubWVudEVycm9yT25Vbmtub3duRWxlbWVudHNPcHRpb246IGJvb2xlYW58dW5kZWZpbmVkO1xuXG4gIC8qKlxuICAgKiBcIkVycm9yIG9uIHVua25vd24gcHJvcGVydGllc1wiIG9wdGlvbiB0aGF0IGhhcyBiZWVuIGNvbmZpZ3VyZWQgYXQgdGhlIGVudmlyb25tZW50IGxldmVsLlxuICAgKiBVc2VkIGFzIGEgZmFsbGJhY2sgaWYgbm8gaW5zdGFuY2UtbGV2ZWwgb3B0aW9uIGhhcyBiZWVuIHByb3ZpZGVkLlxuICAgKi9cbiAgcHJpdmF0ZSBzdGF0aWMgX2Vudmlyb25tZW50RXJyb3JPblVua25vd25Qcm9wZXJ0aWVzT3B0aW9uOiBib29sZWFufHVuZGVmaW5lZDtcblxuICAvKipcbiAgICogVGVhcmRvd24gb3B0aW9ucyB0aGF0IGhhdmUgYmVlbiBjb25maWd1cmVkIGF0IHRoZSBgVGVzdEJlZGAgaW5zdGFuY2UgbGV2ZWwuXG4gICAqIFRoZXNlIG9wdGlvbnMgdGFrZSBwcmVjZWRlbmNlIG92ZXIgdGhlIGVudmlyb25tZW50LWxldmVsIG9uZXMuXG4gICAqL1xuICBwcml2YXRlIF9pbnN0YW5jZVRlYXJkb3duT3B0aW9uczogTW9kdWxlVGVhcmRvd25PcHRpb25zfHVuZGVmaW5lZDtcblxuICAvKipcbiAgICogXCJFcnJvciBvbiB1bmtub3duIGVsZW1lbnRzXCIgb3B0aW9uIHRoYXQgaGFzIGJlZW4gY29uZmlndXJlZCBhdCB0aGUgYFRlc3RCZWRgIGluc3RhbmNlIGxldmVsLlxuICAgKiBUaGlzIG9wdGlvbiB0YWtlcyBwcmVjZWRlbmNlIG92ZXIgdGhlIGVudmlyb25tZW50LWxldmVsIG9uZS5cbiAgICovXG4gIHByaXZhdGUgX2luc3RhbmNlRXJyb3JPblVua25vd25FbGVtZW50c09wdGlvbjogYm9vbGVhbnx1bmRlZmluZWQ7XG5cbiAgLyoqXG4gICAqIFwiRXJyb3Igb24gdW5rbm93biBwcm9wZXJ0aWVzXCIgb3B0aW9uIHRoYXQgaGFzIGJlZW4gY29uZmlndXJlZCBhdCB0aGUgYFRlc3RCZWRgIGluc3RhbmNlIGxldmVsLlxuICAgKiBUaGlzIG9wdGlvbiB0YWtlcyBwcmVjZWRlbmNlIG92ZXIgdGhlIGVudmlyb25tZW50LWxldmVsIG9uZS5cbiAgICovXG4gIHByaXZhdGUgX2luc3RhbmNlRXJyb3JPblVua25vd25Qcm9wZXJ0aWVzT3B0aW9uOiBib29sZWFufHVuZGVmaW5lZDtcblxuICAvKipcbiAgICogU3RvcmVzIHRoZSBwcmV2aW91cyBcIkVycm9yIG9uIHVua25vd24gZWxlbWVudHNcIiBvcHRpb24gdmFsdWUsXG4gICAqIGFsbG93aW5nIHRvIHJlc3RvcmUgaXQgaW4gdGhlIHJlc2V0IHRlc3RpbmcgbW9kdWxlIGxvZ2ljLlxuICAgKi9cbiAgcHJpdmF0ZSBfcHJldmlvdXNFcnJvck9uVW5rbm93bkVsZW1lbnRzT3B0aW9uOiBib29sZWFufHVuZGVmaW5lZDtcblxuICAvKipcbiAgICogU3RvcmVzIHRoZSBwcmV2aW91cyBcIkVycm9yIG9uIHVua25vd24gcHJvcGVydGllc1wiIG9wdGlvbiB2YWx1ZSxcbiAgICogYWxsb3dpbmcgdG8gcmVzdG9yZSBpdCBpbiB0aGUgcmVzZXQgdGVzdGluZyBtb2R1bGUgbG9naWMuXG4gICAqL1xuICBwcml2YXRlIF9wcmV2aW91c0Vycm9yT25Vbmtub3duUHJvcGVydGllc09wdGlvbjogYm9vbGVhbnx1bmRlZmluZWQ7XG5cbiAgLyoqXG4gICAqIEluaXRpYWxpemUgdGhlIGVudmlyb25tZW50IGZvciB0ZXN0aW5nIHdpdGggYSBjb21waWxlciBmYWN0b3J5LCBhIFBsYXRmb3JtUmVmLCBhbmQgYW5cbiAgICogYW5ndWxhciBtb2R1bGUuIFRoZXNlIGFyZSBjb21tb24gdG8gZXZlcnkgdGVzdCBpbiB0aGUgc3VpdGUuXG4gICAqXG4gICAqIFRoaXMgbWF5IG9ubHkgYmUgY2FsbGVkIG9uY2UsIHRvIHNldCB1cCB0aGUgY29tbW9uIHByb3ZpZGVycyBmb3IgdGhlIGN1cnJlbnQgdGVzdFxuICAgKiBzdWl0ZSBvbiB0aGUgY3VycmVudCBwbGF0Zm9ybS4gSWYgeW91IGFic29sdXRlbHkgbmVlZCB0byBjaGFuZ2UgdGhlIHByb3ZpZGVycyxcbiAgICogZmlyc3QgdXNlIGByZXNldFRlc3RFbnZpcm9ubWVudGAuXG4gICAqXG4gICAqIFRlc3QgbW9kdWxlcyBhbmQgcGxhdGZvcm1zIGZvciBpbmRpdmlkdWFsIHBsYXRmb3JtcyBhcmUgYXZhaWxhYmxlIGZyb21cbiAgICogJ0Bhbmd1bGFyLzxwbGF0Zm9ybV9uYW1lPi90ZXN0aW5nJy5cbiAgICpcbiAgICogQHB1YmxpY0FwaVxuICAgKi9cbiAgc3RhdGljIGluaXRUZXN0RW52aXJvbm1lbnQoXG4gICAgICBuZ01vZHVsZTogVHlwZTxhbnk+fFR5cGU8YW55PltdLCBwbGF0Zm9ybTogUGxhdGZvcm1SZWYsXG4gICAgICBvcHRpb25zPzogVGVzdEVudmlyb25tZW50T3B0aW9ucyk6IFRlc3RCZWQge1xuICAgIGNvbnN0IHRlc3RCZWQgPSBfZ2V0VGVzdEJlZFJlbmRlcjMoKTtcbiAgICB0ZXN0QmVkLmluaXRUZXN0RW52aXJvbm1lbnQobmdNb2R1bGUsIHBsYXRmb3JtLCBvcHRpb25zKTtcbiAgICByZXR1cm4gdGVzdEJlZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNldCB0aGUgcHJvdmlkZXJzIGZvciB0aGUgdGVzdCBpbmplY3Rvci5cbiAgICpcbiAgICogQHB1YmxpY0FwaVxuICAgKi9cbiAgc3RhdGljIHJlc2V0VGVzdEVudmlyb25tZW50KCk6IHZvaWQge1xuICAgIF9nZXRUZXN0QmVkUmVuZGVyMygpLnJlc2V0VGVzdEVudmlyb25tZW50KCk7XG4gIH1cblxuICBzdGF0aWMgY29uZmlndXJlQ29tcGlsZXIoY29uZmlnOiB7cHJvdmlkZXJzPzogYW55W107IHVzZUppdD86IGJvb2xlYW47fSk6IFRlc3RCZWRTdGF0aWMge1xuICAgIF9nZXRUZXN0QmVkUmVuZGVyMygpLmNvbmZpZ3VyZUNvbXBpbGVyKGNvbmZpZyk7XG4gICAgcmV0dXJuIFRlc3RCZWRSZW5kZXIzIGFzIGFueSBhcyBUZXN0QmVkU3RhdGljO1xuICB9XG5cbiAgLyoqXG4gICAqIEFsbG93cyBvdmVycmlkaW5nIGRlZmF1bHQgcHJvdmlkZXJzLCBkaXJlY3RpdmVzLCBwaXBlcywgbW9kdWxlcyBvZiB0aGUgdGVzdCBpbmplY3RvcixcbiAgICogd2hpY2ggYXJlIGRlZmluZWQgaW4gdGVzdF9pbmplY3Rvci5qc1xuICAgKi9cbiAgc3RhdGljIGNvbmZpZ3VyZVRlc3RpbmdNb2R1bGUobW9kdWxlRGVmOiBUZXN0TW9kdWxlTWV0YWRhdGEpOiBUZXN0QmVkU3RhdGljIHtcbiAgICBfZ2V0VGVzdEJlZFJlbmRlcjMoKS5jb25maWd1cmVUZXN0aW5nTW9kdWxlKG1vZHVsZURlZik7XG4gICAgcmV0dXJuIFRlc3RCZWRSZW5kZXIzIGFzIGFueSBhcyBUZXN0QmVkU3RhdGljO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbXBpbGUgY29tcG9uZW50cyB3aXRoIGEgYHRlbXBsYXRlVXJsYCBmb3IgdGhlIHRlc3QncyBOZ01vZHVsZS5cbiAgICogSXQgaXMgbmVjZXNzYXJ5IHRvIGNhbGwgdGhpcyBmdW5jdGlvblxuICAgKiBhcyBmZXRjaGluZyB1cmxzIGlzIGFzeW5jaHJvbm91cy5cbiAgICovXG4gIHN0YXRpYyBjb21waWxlQ29tcG9uZW50cygpOiBQcm9taXNlPGFueT4ge1xuICAgIHJldHVybiBfZ2V0VGVzdEJlZFJlbmRlcjMoKS5jb21waWxlQ29tcG9uZW50cygpO1xuICB9XG5cbiAgc3RhdGljIG92ZXJyaWRlTW9kdWxlKG5nTW9kdWxlOiBUeXBlPGFueT4sIG92ZXJyaWRlOiBNZXRhZGF0YU92ZXJyaWRlPE5nTW9kdWxlPik6IFRlc3RCZWRTdGF0aWMge1xuICAgIF9nZXRUZXN0QmVkUmVuZGVyMygpLm92ZXJyaWRlTW9kdWxlKG5nTW9kdWxlLCBvdmVycmlkZSk7XG4gICAgcmV0dXJuIFRlc3RCZWRSZW5kZXIzIGFzIGFueSBhcyBUZXN0QmVkU3RhdGljO1xuICB9XG5cbiAgc3RhdGljIG92ZXJyaWRlQ29tcG9uZW50KGNvbXBvbmVudDogVHlwZTxhbnk+LCBvdmVycmlkZTogTWV0YWRhdGFPdmVycmlkZTxDb21wb25lbnQ+KTpcbiAgICAgIFRlc3RCZWRTdGF0aWMge1xuICAgIF9nZXRUZXN0QmVkUmVuZGVyMygpLm92ZXJyaWRlQ29tcG9uZW50KGNvbXBvbmVudCwgb3ZlcnJpZGUpO1xuICAgIHJldHVybiBUZXN0QmVkUmVuZGVyMyBhcyBhbnkgYXMgVGVzdEJlZFN0YXRpYztcbiAgfVxuXG4gIHN0YXRpYyBvdmVycmlkZURpcmVjdGl2ZShkaXJlY3RpdmU6IFR5cGU8YW55Piwgb3ZlcnJpZGU6IE1ldGFkYXRhT3ZlcnJpZGU8RGlyZWN0aXZlPik6XG4gICAgICBUZXN0QmVkU3RhdGljIHtcbiAgICBfZ2V0VGVzdEJlZFJlbmRlcjMoKS5vdmVycmlkZURpcmVjdGl2ZShkaXJlY3RpdmUsIG92ZXJyaWRlKTtcbiAgICByZXR1cm4gVGVzdEJlZFJlbmRlcjMgYXMgYW55IGFzIFRlc3RCZWRTdGF0aWM7XG4gIH1cblxuICBzdGF0aWMgb3ZlcnJpZGVQaXBlKHBpcGU6IFR5cGU8YW55Piwgb3ZlcnJpZGU6IE1ldGFkYXRhT3ZlcnJpZGU8UGlwZT4pOiBUZXN0QmVkU3RhdGljIHtcbiAgICBfZ2V0VGVzdEJlZFJlbmRlcjMoKS5vdmVycmlkZVBpcGUocGlwZSwgb3ZlcnJpZGUpO1xuICAgIHJldHVybiBUZXN0QmVkUmVuZGVyMyBhcyBhbnkgYXMgVGVzdEJlZFN0YXRpYztcbiAgfVxuXG4gIHN0YXRpYyBvdmVycmlkZVRlbXBsYXRlKGNvbXBvbmVudDogVHlwZTxhbnk+LCB0ZW1wbGF0ZTogc3RyaW5nKTogVGVzdEJlZFN0YXRpYyB7XG4gICAgX2dldFRlc3RCZWRSZW5kZXIzKCkub3ZlcnJpZGVDb21wb25lbnQoY29tcG9uZW50LCB7c2V0OiB7dGVtcGxhdGUsIHRlbXBsYXRlVXJsOiBudWxsIX19KTtcbiAgICByZXR1cm4gVGVzdEJlZFJlbmRlcjMgYXMgYW55IGFzIFRlc3RCZWRTdGF0aWM7XG4gIH1cblxuICAvKipcbiAgICogT3ZlcnJpZGVzIHRoZSB0ZW1wbGF0ZSBvZiB0aGUgZ2l2ZW4gY29tcG9uZW50LCBjb21waWxpbmcgdGhlIHRlbXBsYXRlXG4gICAqIGluIHRoZSBjb250ZXh0IG9mIHRoZSBUZXN0aW5nTW9kdWxlLlxuICAgKlxuICAgKiBOb3RlOiBUaGlzIHdvcmtzIGZvciBKSVQgYW5kIEFPVGVkIGNvbXBvbmVudHMgYXMgd2VsbC5cbiAgICovXG4gIHN0YXRpYyBvdmVycmlkZVRlbXBsYXRlVXNpbmdUZXN0aW5nTW9kdWxlKGNvbXBvbmVudDogVHlwZTxhbnk+LCB0ZW1wbGF0ZTogc3RyaW5nKTogVGVzdEJlZFN0YXRpYyB7XG4gICAgX2dldFRlc3RCZWRSZW5kZXIzKCkub3ZlcnJpZGVUZW1wbGF0ZVVzaW5nVGVzdGluZ01vZHVsZShjb21wb25lbnQsIHRlbXBsYXRlKTtcbiAgICByZXR1cm4gVGVzdEJlZFJlbmRlcjMgYXMgYW55IGFzIFRlc3RCZWRTdGF0aWM7XG4gIH1cblxuICBzdGF0aWMgb3ZlcnJpZGVQcm92aWRlcih0b2tlbjogYW55LCBwcm92aWRlcjoge1xuICAgIHVzZUZhY3Rvcnk6IEZ1bmN0aW9uLFxuICAgIGRlcHM6IGFueVtdLFxuICB9KTogVGVzdEJlZFN0YXRpYztcbiAgc3RhdGljIG92ZXJyaWRlUHJvdmlkZXIodG9rZW46IGFueSwgcHJvdmlkZXI6IHt1c2VWYWx1ZTogYW55O30pOiBUZXN0QmVkU3RhdGljO1xuICBzdGF0aWMgb3ZlcnJpZGVQcm92aWRlcih0b2tlbjogYW55LCBwcm92aWRlcjoge1xuICAgIHVzZUZhY3Rvcnk/OiBGdW5jdGlvbixcbiAgICB1c2VWYWx1ZT86IGFueSxcbiAgICBkZXBzPzogYW55W10sXG4gIH0pOiBUZXN0QmVkU3RhdGljIHtcbiAgICBfZ2V0VGVzdEJlZFJlbmRlcjMoKS5vdmVycmlkZVByb3ZpZGVyKHRva2VuLCBwcm92aWRlcik7XG4gICAgcmV0dXJuIFRlc3RCZWRSZW5kZXIzIGFzIGFueSBhcyBUZXN0QmVkU3RhdGljO1xuICB9XG5cbiAgc3RhdGljIGluamVjdDxUPih0b2tlbjogUHJvdmlkZXJUb2tlbjxUPiwgbm90Rm91bmRWYWx1ZT86IFQsIGZsYWdzPzogSW5qZWN0RmxhZ3MpOiBUO1xuICBzdGF0aWMgaW5qZWN0PFQ+KHRva2VuOiBQcm92aWRlclRva2VuPFQ+LCBub3RGb3VuZFZhbHVlOiBudWxsLCBmbGFncz86IEluamVjdEZsYWdzKTogVHxudWxsO1xuICBzdGF0aWMgaW5qZWN0PFQ+KHRva2VuOiBQcm92aWRlclRva2VuPFQ+LCBub3RGb3VuZFZhbHVlPzogVHxudWxsLCBmbGFncz86IEluamVjdEZsYWdzKTogVHxudWxsIHtcbiAgICByZXR1cm4gX2dldFRlc3RCZWRSZW5kZXIzKCkuaW5qZWN0KHRva2VuLCBub3RGb3VuZFZhbHVlLCBmbGFncyk7XG4gIH1cblxuICAvKiogQGRlcHJlY2F0ZWQgZnJvbSB2OS4wLjAgdXNlIFRlc3RCZWQuaW5qZWN0ICovXG4gIHN0YXRpYyBnZXQ8VD4odG9rZW46IFByb3ZpZGVyVG9rZW48VD4sIG5vdEZvdW5kVmFsdWU/OiBULCBmbGFncz86IEluamVjdEZsYWdzKTogYW55O1xuICAvKiogQGRlcHJlY2F0ZWQgZnJvbSB2OS4wLjAgdXNlIFRlc3RCZWQuaW5qZWN0ICovXG4gIHN0YXRpYyBnZXQodG9rZW46IGFueSwgbm90Rm91bmRWYWx1ZT86IGFueSk6IGFueTtcbiAgLyoqIEBkZXByZWNhdGVkIGZyb20gdjkuMC4wIHVzZSBUZXN0QmVkLmluamVjdCAqL1xuICBzdGF0aWMgZ2V0KFxuICAgICAgdG9rZW46IGFueSwgbm90Rm91bmRWYWx1ZTogYW55ID0gSW5qZWN0b3IuVEhST1dfSUZfTk9UX0ZPVU5ELFxuICAgICAgZmxhZ3M6IEluamVjdEZsYWdzID0gSW5qZWN0RmxhZ3MuRGVmYXVsdCk6IGFueSB7XG4gICAgcmV0dXJuIF9nZXRUZXN0QmVkUmVuZGVyMygpLmluamVjdCh0b2tlbiwgbm90Rm91bmRWYWx1ZSwgZmxhZ3MpO1xuICB9XG5cbiAgc3RhdGljIGNyZWF0ZUNvbXBvbmVudDxUPihjb21wb25lbnQ6IFR5cGU8VD4pOiBDb21wb25lbnRGaXh0dXJlPFQ+IHtcbiAgICByZXR1cm4gX2dldFRlc3RCZWRSZW5kZXIzKCkuY3JlYXRlQ29tcG9uZW50KGNvbXBvbmVudCk7XG4gIH1cblxuICBzdGF0aWMgcmVzZXRUZXN0aW5nTW9kdWxlKCk6IFRlc3RCZWRTdGF0aWMge1xuICAgIF9nZXRUZXN0QmVkUmVuZGVyMygpLnJlc2V0VGVzdGluZ01vZHVsZSgpO1xuICAgIHJldHVybiBUZXN0QmVkUmVuZGVyMyBhcyBhbnkgYXMgVGVzdEJlZFN0YXRpYztcbiAgfVxuXG4gIHN0YXRpYyBzaG91bGRUZWFyRG93blRlc3RpbmdNb2R1bGUoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIF9nZXRUZXN0QmVkUmVuZGVyMygpLnNob3VsZFRlYXJEb3duVGVzdGluZ01vZHVsZSgpO1xuICB9XG5cbiAgc3RhdGljIHRlYXJEb3duVGVzdGluZ01vZHVsZSgpOiB2b2lkIHtcbiAgICBfZ2V0VGVzdEJlZFJlbmRlcjMoKS50ZWFyRG93blRlc3RpbmdNb2R1bGUoKTtcbiAgfVxuXG4gIC8vIFByb3BlcnRpZXNcblxuICBwbGF0Zm9ybTogUGxhdGZvcm1SZWYgPSBudWxsITtcbiAgbmdNb2R1bGU6IFR5cGU8YW55PnxUeXBlPGFueT5bXSA9IG51bGwhO1xuXG4gIHByaXZhdGUgX2NvbXBpbGVyOiBSM1Rlc3RCZWRDb21waWxlcnxudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBfdGVzdE1vZHVsZVJlZjogTmdNb2R1bGVSZWY8YW55PnxudWxsID0gbnVsbDtcblxuICBwcml2YXRlIF9hY3RpdmVGaXh0dXJlczogQ29tcG9uZW50Rml4dHVyZTxhbnk+W10gPSBbXTtcbiAgcHJpdmF0ZSBfZ2xvYmFsQ29tcGlsYXRpb25DaGVja2VkID0gZmFsc2U7XG5cbiAgLyoqXG4gICAqIEluaXRpYWxpemUgdGhlIGVudmlyb25tZW50IGZvciB0ZXN0aW5nIHdpdGggYSBjb21waWxlciBmYWN0b3J5LCBhIFBsYXRmb3JtUmVmLCBhbmQgYW5cbiAgICogYW5ndWxhciBtb2R1bGUuIFRoZXNlIGFyZSBjb21tb24gdG8gZXZlcnkgdGVzdCBpbiB0aGUgc3VpdGUuXG4gICAqXG4gICAqIFRoaXMgbWF5IG9ubHkgYmUgY2FsbGVkIG9uY2UsIHRvIHNldCB1cCB0aGUgY29tbW9uIHByb3ZpZGVycyBmb3IgdGhlIGN1cnJlbnQgdGVzdFxuICAgKiBzdWl0ZSBvbiB0aGUgY3VycmVudCBwbGF0Zm9ybS4gSWYgeW91IGFic29sdXRlbHkgbmVlZCB0byBjaGFuZ2UgdGhlIHByb3ZpZGVycyxcbiAgICogZmlyc3QgdXNlIGByZXNldFRlc3RFbnZpcm9ubWVudGAuXG4gICAqXG4gICAqIFRlc3QgbW9kdWxlcyBhbmQgcGxhdGZvcm1zIGZvciBpbmRpdmlkdWFsIHBsYXRmb3JtcyBhcmUgYXZhaWxhYmxlIGZyb21cbiAgICogJ0Bhbmd1bGFyLzxwbGF0Zm9ybV9uYW1lPi90ZXN0aW5nJy5cbiAgICpcbiAgICogQHB1YmxpY0FwaVxuICAgKi9cbiAgaW5pdFRlc3RFbnZpcm9ubWVudChcbiAgICAgIG5nTW9kdWxlOiBUeXBlPGFueT58VHlwZTxhbnk+W10sIHBsYXRmb3JtOiBQbGF0Zm9ybVJlZixcbiAgICAgIG9wdGlvbnM/OiBUZXN0RW52aXJvbm1lbnRPcHRpb25zKTogdm9pZCB7XG4gICAgaWYgKHRoaXMucGxhdGZvcm0gfHwgdGhpcy5uZ01vZHVsZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3Qgc2V0IGJhc2UgcHJvdmlkZXJzIGJlY2F1c2UgaXQgaGFzIGFscmVhZHkgYmVlbiBjYWxsZWQnKTtcbiAgICB9XG5cbiAgICBUZXN0QmVkUmVuZGVyMy5fZW52aXJvbm1lbnRUZWFyZG93bk9wdGlvbnMgPSBvcHRpb25zPy50ZWFyZG93bjtcblxuICAgIFRlc3RCZWRSZW5kZXIzLl9lbnZpcm9ubWVudEVycm9yT25Vbmtub3duRWxlbWVudHNPcHRpb24gPSBvcHRpb25zPy5lcnJvck9uVW5rbm93bkVsZW1lbnRzO1xuXG4gICAgVGVzdEJlZFJlbmRlcjMuX2Vudmlyb25tZW50RXJyb3JPblVua25vd25Qcm9wZXJ0aWVzT3B0aW9uID0gb3B0aW9ucz8uZXJyb3JPblVua25vd25Qcm9wZXJ0aWVzO1xuXG4gICAgdGhpcy5wbGF0Zm9ybSA9IHBsYXRmb3JtO1xuICAgIHRoaXMubmdNb2R1bGUgPSBuZ01vZHVsZTtcbiAgICB0aGlzLl9jb21waWxlciA9IG5ldyBSM1Rlc3RCZWRDb21waWxlcih0aGlzLnBsYXRmb3JtLCB0aGlzLm5nTW9kdWxlKTtcblxuICAgIC8vIFRlc3RCZWQgZG9lcyBub3QgaGF2ZSBhbiBBUEkgd2hpY2ggY2FuIHJlbGlhYmx5IGRldGVjdCB0aGUgc3RhcnQgb2YgYSB0ZXN0LCBhbmQgdGh1cyBjb3VsZCBiZVxuICAgIC8vIHVzZWQgdG8gdHJhY2sgdGhlIHN0YXRlIG9mIHRoZSBOZ01vZHVsZSByZWdpc3RyeSBhbmQgcmVzZXQgaXQgY29ycmVjdGx5LiBJbnN0ZWFkLCB3aGVuIHdlXG4gICAgLy8ga25vdyB3ZSdyZSBpbiBhIHRlc3Rpbmcgc2NlbmFyaW8sIHdlIGRpc2FibGUgdGhlIGNoZWNrIGZvciBkdXBsaWNhdGUgTmdNb2R1bGUgcmVnaXN0cmF0aW9uXG4gICAgLy8gY29tcGxldGVseS5cbiAgICBzZXRBbGxvd0R1cGxpY2F0ZU5nTW9kdWxlSWRzRm9yVGVzdCh0cnVlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNldCB0aGUgcHJvdmlkZXJzIGZvciB0aGUgdGVzdCBpbmplY3Rvci5cbiAgICpcbiAgICogQHB1YmxpY0FwaVxuICAgKi9cbiAgcmVzZXRUZXN0RW52aXJvbm1lbnQoKTogdm9pZCB7XG4gICAgdGhpcy5yZXNldFRlc3RpbmdNb2R1bGUoKTtcbiAgICB0aGlzLl9jb21waWxlciA9IG51bGw7XG4gICAgdGhpcy5wbGF0Zm9ybSA9IG51bGwhO1xuICAgIHRoaXMubmdNb2R1bGUgPSBudWxsITtcbiAgICBUZXN0QmVkUmVuZGVyMy5fZW52aXJvbm1lbnRUZWFyZG93bk9wdGlvbnMgPSB1bmRlZmluZWQ7XG4gICAgc2V0QWxsb3dEdXBsaWNhdGVOZ01vZHVsZUlkc0ZvclRlc3QoZmFsc2UpO1xuICB9XG5cbiAgcmVzZXRUZXN0aW5nTW9kdWxlKCk6IHZvaWQge1xuICAgIHRoaXMuY2hlY2tHbG9iYWxDb21waWxhdGlvbkZpbmlzaGVkKCk7XG4gICAgcmVzZXRDb21waWxlZENvbXBvbmVudHMoKTtcbiAgICBpZiAodGhpcy5fY29tcGlsZXIgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuY29tcGlsZXIucmVzdG9yZU9yaWdpbmFsU3RhdGUoKTtcbiAgICB9XG4gICAgdGhpcy5fY29tcGlsZXIgPSBuZXcgUjNUZXN0QmVkQ29tcGlsZXIodGhpcy5wbGF0Zm9ybSwgdGhpcy5uZ01vZHVsZSk7XG4gICAgLy8gUmVzdG9yZSB0aGUgcHJldmlvdXMgdmFsdWUgb2YgdGhlIFwiZXJyb3Igb24gdW5rbm93biBlbGVtZW50c1wiIG9wdGlvblxuICAgIHNldFVua25vd25FbGVtZW50U3RyaWN0TW9kZShcbiAgICAgICAgdGhpcy5fcHJldmlvdXNFcnJvck9uVW5rbm93bkVsZW1lbnRzT3B0aW9uID8/IFRIUk9XX09OX1VOS05PV05fRUxFTUVOVFNfREVGQVVMVCk7XG4gICAgLy8gUmVzdG9yZSB0aGUgcHJldmlvdXMgdmFsdWUgb2YgdGhlIFwiZXJyb3Igb24gdW5rbm93biBwcm9wZXJ0aWVzXCIgb3B0aW9uXG4gICAgc2V0VW5rbm93blByb3BlcnR5U3RyaWN0TW9kZShcbiAgICAgICAgdGhpcy5fcHJldmlvdXNFcnJvck9uVW5rbm93blByb3BlcnRpZXNPcHRpb24gPz8gVEhST1dfT05fVU5LTk9XTl9QUk9QRVJUSUVTX0RFRkFVTFQpO1xuXG4gICAgLy8gV2UgaGF2ZSB0byBjaGFpbiBhIGNvdXBsZSBvZiB0cnkvZmluYWxseSBibG9ja3MsIGJlY2F1c2UgZWFjaCBzdGVwIGNhblxuICAgIC8vIHRocm93IGVycm9ycyBhbmQgd2UgZG9uJ3Qgd2FudCBpdCB0byBpbnRlcnJ1cHQgdGhlIG5leHQgc3RlcCBhbmQgd2UgYWxzb1xuICAgIC8vIHdhbnQgYW4gZXJyb3IgdG8gYmUgdGhyb3duIGF0IHRoZSBlbmQuXG4gICAgdHJ5IHtcbiAgICAgIHRoaXMuZGVzdHJveUFjdGl2ZUZpeHR1cmVzKCk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGlmICh0aGlzLnNob3VsZFRlYXJEb3duVGVzdGluZ01vZHVsZSgpKSB7XG4gICAgICAgICAgdGhpcy50ZWFyRG93blRlc3RpbmdNb2R1bGUoKTtcbiAgICAgICAgfVxuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgdGhpcy5fdGVzdE1vZHVsZVJlZiA9IG51bGw7XG4gICAgICAgIHRoaXMuX2luc3RhbmNlVGVhcmRvd25PcHRpb25zID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLl9pbnN0YW5jZUVycm9yT25Vbmtub3duRWxlbWVudHNPcHRpb24gPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuX2luc3RhbmNlRXJyb3JPblVua25vd25Qcm9wZXJ0aWVzT3B0aW9uID0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGNvbmZpZ3VyZUNvbXBpbGVyKGNvbmZpZzoge3Byb3ZpZGVycz86IGFueVtdOyB1c2VKaXQ/OiBib29sZWFuO30pOiB2b2lkIHtcbiAgICBpZiAoY29uZmlnLnVzZUppdCAhPSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3RoZSBSZW5kZXIzIGNvbXBpbGVyIEppVCBtb2RlIGlzIG5vdCBjb25maWd1cmFibGUgIScpO1xuICAgIH1cblxuICAgIGlmIChjb25maWcucHJvdmlkZXJzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuY29tcGlsZXIuc2V0Q29tcGlsZXJQcm92aWRlcnMoY29uZmlnLnByb3ZpZGVycyk7XG4gICAgfVxuICB9XG5cbiAgY29uZmlndXJlVGVzdGluZ01vZHVsZShtb2R1bGVEZWY6IFRlc3RNb2R1bGVNZXRhZGF0YSk6IHZvaWQge1xuICAgIHRoaXMuYXNzZXJ0Tm90SW5zdGFudGlhdGVkKCdSM1Rlc3RCZWQuY29uZmlndXJlVGVzdGluZ01vZHVsZScsICdjb25maWd1cmUgdGhlIHRlc3QgbW9kdWxlJyk7XG5cbiAgICAvLyBUcmlnZ2VyIG1vZHVsZSBzY29waW5nIHF1ZXVlIGZsdXNoIGJlZm9yZSBleGVjdXRpbmcgb3RoZXIgVGVzdEJlZCBvcGVyYXRpb25zIGluIGEgdGVzdC5cbiAgICAvLyBUaGlzIGlzIG5lZWRlZCBmb3IgdGhlIGZpcnN0IHRlc3QgaW52b2NhdGlvbiB0byBlbnN1cmUgdGhhdCBnbG9iYWxseSBkZWNsYXJlZCBtb2R1bGVzIGhhdmVcbiAgICAvLyB0aGVpciBjb21wb25lbnRzIHNjb3BlZCBwcm9wZXJseS4gU2VlIHRoZSBgY2hlY2tHbG9iYWxDb21waWxhdGlvbkZpbmlzaGVkYCBmdW5jdGlvblxuICAgIC8vIGRlc2NyaXB0aW9uIGZvciBhZGRpdGlvbmFsIGluZm8uXG4gICAgdGhpcy5jaGVja0dsb2JhbENvbXBpbGF0aW9uRmluaXNoZWQoKTtcblxuICAgIC8vIEFsd2F5cyByZS1hc3NpZ24gdGhlIG9wdGlvbnMsIGV2ZW4gaWYgdGhleSdyZSB1bmRlZmluZWQuXG4gICAgLy8gVGhpcyBlbnN1cmVzIHRoYXQgd2UgZG9uJ3QgY2FycnkgdGhlbSBiZXR3ZWVuIHRlc3RzLlxuICAgIHRoaXMuX2luc3RhbmNlVGVhcmRvd25PcHRpb25zID0gbW9kdWxlRGVmLnRlYXJkb3duO1xuICAgIHRoaXMuX2luc3RhbmNlRXJyb3JPblVua25vd25FbGVtZW50c09wdGlvbiA9IG1vZHVsZURlZi5lcnJvck9uVW5rbm93bkVsZW1lbnRzO1xuICAgIHRoaXMuX2luc3RhbmNlRXJyb3JPblVua25vd25Qcm9wZXJ0aWVzT3B0aW9uID0gbW9kdWxlRGVmLmVycm9yT25Vbmtub3duUHJvcGVydGllcztcbiAgICAvLyBTdG9yZSB0aGUgY3VycmVudCB2YWx1ZSBvZiB0aGUgc3RyaWN0IG1vZGUgb3B0aW9uLFxuICAgIC8vIHNvIHdlIGNhbiByZXN0b3JlIGl0IGxhdGVyXG4gICAgdGhpcy5fcHJldmlvdXNFcnJvck9uVW5rbm93bkVsZW1lbnRzT3B0aW9uID0gZ2V0VW5rbm93bkVsZW1lbnRTdHJpY3RNb2RlKCk7XG4gICAgc2V0VW5rbm93bkVsZW1lbnRTdHJpY3RNb2RlKHRoaXMuc2hvdWxkVGhyb3dFcnJvck9uVW5rbm93bkVsZW1lbnRzKCkpO1xuICAgIHRoaXMuX3ByZXZpb3VzRXJyb3JPblVua25vd25Qcm9wZXJ0aWVzT3B0aW9uID0gZ2V0VW5rbm93blByb3BlcnR5U3RyaWN0TW9kZSgpO1xuICAgIHNldFVua25vd25Qcm9wZXJ0eVN0cmljdE1vZGUodGhpcy5zaG91bGRUaHJvd0Vycm9yT25Vbmtub3duUHJvcGVydGllcygpKTtcbiAgICB0aGlzLmNvbXBpbGVyLmNvbmZpZ3VyZVRlc3RpbmdNb2R1bGUobW9kdWxlRGVmKTtcbiAgfVxuXG4gIGNvbXBpbGVDb21wb25lbnRzKCk6IFByb21pc2U8YW55PiB7XG4gICAgcmV0dXJuIHRoaXMuY29tcGlsZXIuY29tcGlsZUNvbXBvbmVudHMoKTtcbiAgfVxuXG4gIGluamVjdDxUPih0b2tlbjogUHJvdmlkZXJUb2tlbjxUPiwgbm90Rm91bmRWYWx1ZT86IFQsIGZsYWdzPzogSW5qZWN0RmxhZ3MpOiBUO1xuICBpbmplY3Q8VD4odG9rZW46IFByb3ZpZGVyVG9rZW48VD4sIG5vdEZvdW5kVmFsdWU6IG51bGwsIGZsYWdzPzogSW5qZWN0RmxhZ3MpOiBUfG51bGw7XG4gIGluamVjdDxUPih0b2tlbjogUHJvdmlkZXJUb2tlbjxUPiwgbm90Rm91bmRWYWx1ZT86IFR8bnVsbCwgZmxhZ3M/OiBJbmplY3RGbGFncyk6IFR8bnVsbCB7XG4gICAgaWYgKHRva2VuIGFzIHVua25vd24gPT09IFRlc3RCZWRSZW5kZXIzKSB7XG4gICAgICByZXR1cm4gdGhpcyBhcyBhbnk7XG4gICAgfVxuICAgIGNvbnN0IFVOREVGSU5FRCA9IHt9IGFzIHVua25vd24gYXMgVDtcbiAgICBjb25zdCByZXN1bHQgPSB0aGlzLnRlc3RNb2R1bGVSZWYuaW5qZWN0b3IuZ2V0KHRva2VuLCBVTkRFRklORUQsIGZsYWdzKTtcbiAgICByZXR1cm4gcmVzdWx0ID09PSBVTkRFRklORUQgPyB0aGlzLmNvbXBpbGVyLmluamVjdG9yLmdldCh0b2tlbiwgbm90Rm91bmRWYWx1ZSwgZmxhZ3MpIGFzIGFueSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0O1xuICB9XG5cbiAgLyoqIEBkZXByZWNhdGVkIGZyb20gdjkuMC4wIHVzZSBUZXN0QmVkLmluamVjdCAqL1xuICBnZXQ8VD4odG9rZW46IFByb3ZpZGVyVG9rZW48VD4sIG5vdEZvdW5kVmFsdWU/OiBULCBmbGFncz86IEluamVjdEZsYWdzKTogYW55O1xuICAvKiogQGRlcHJlY2F0ZWQgZnJvbSB2OS4wLjAgdXNlIFRlc3RCZWQuaW5qZWN0ICovXG4gIGdldCh0b2tlbjogYW55LCBub3RGb3VuZFZhbHVlPzogYW55KTogYW55O1xuICAvKiogQGRlcHJlY2F0ZWQgZnJvbSB2OS4wLjAgdXNlIFRlc3RCZWQuaW5qZWN0ICovXG4gIGdldCh0b2tlbjogYW55LCBub3RGb3VuZFZhbHVlOiBhbnkgPSBJbmplY3Rvci5USFJPV19JRl9OT1RfRk9VTkQsXG4gICAgICBmbGFnczogSW5qZWN0RmxhZ3MgPSBJbmplY3RGbGFncy5EZWZhdWx0KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy5pbmplY3QodG9rZW4sIG5vdEZvdW5kVmFsdWUsIGZsYWdzKTtcbiAgfVxuXG4gIGV4ZWN1dGUodG9rZW5zOiBhbnlbXSwgZm46IEZ1bmN0aW9uLCBjb250ZXh0PzogYW55KTogYW55IHtcbiAgICBjb25zdCBwYXJhbXMgPSB0b2tlbnMubWFwKHQgPT4gdGhpcy5pbmplY3QodCkpO1xuICAgIHJldHVybiBmbi5hcHBseShjb250ZXh0LCBwYXJhbXMpO1xuICB9XG5cbiAgb3ZlcnJpZGVNb2R1bGUobmdNb2R1bGU6IFR5cGU8YW55Piwgb3ZlcnJpZGU6IE1ldGFkYXRhT3ZlcnJpZGU8TmdNb2R1bGU+KTogdm9pZCB7XG4gICAgdGhpcy5hc3NlcnROb3RJbnN0YW50aWF0ZWQoJ292ZXJyaWRlTW9kdWxlJywgJ292ZXJyaWRlIG1vZHVsZSBtZXRhZGF0YScpO1xuICAgIHRoaXMuY29tcGlsZXIub3ZlcnJpZGVNb2R1bGUobmdNb2R1bGUsIG92ZXJyaWRlKTtcbiAgfVxuXG4gIG92ZXJyaWRlQ29tcG9uZW50KGNvbXBvbmVudDogVHlwZTxhbnk+LCBvdmVycmlkZTogTWV0YWRhdGFPdmVycmlkZTxDb21wb25lbnQ+KTogdm9pZCB7XG4gICAgdGhpcy5hc3NlcnROb3RJbnN0YW50aWF0ZWQoJ292ZXJyaWRlQ29tcG9uZW50JywgJ292ZXJyaWRlIGNvbXBvbmVudCBtZXRhZGF0YScpO1xuICAgIHRoaXMuY29tcGlsZXIub3ZlcnJpZGVDb21wb25lbnQoY29tcG9uZW50LCBvdmVycmlkZSk7XG4gIH1cblxuICBvdmVycmlkZVRlbXBsYXRlVXNpbmdUZXN0aW5nTW9kdWxlKGNvbXBvbmVudDogVHlwZTxhbnk+LCB0ZW1wbGF0ZTogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5hc3NlcnROb3RJbnN0YW50aWF0ZWQoXG4gICAgICAgICdSM1Rlc3RCZWQub3ZlcnJpZGVUZW1wbGF0ZVVzaW5nVGVzdGluZ01vZHVsZScsXG4gICAgICAgICdDYW5ub3Qgb3ZlcnJpZGUgdGVtcGxhdGUgd2hlbiB0aGUgdGVzdCBtb2R1bGUgaGFzIGFscmVhZHkgYmVlbiBpbnN0YW50aWF0ZWQnKTtcbiAgICB0aGlzLmNvbXBpbGVyLm92ZXJyaWRlVGVtcGxhdGVVc2luZ1Rlc3RpbmdNb2R1bGUoY29tcG9uZW50LCB0ZW1wbGF0ZSk7XG4gIH1cblxuICBvdmVycmlkZURpcmVjdGl2ZShkaXJlY3RpdmU6IFR5cGU8YW55Piwgb3ZlcnJpZGU6IE1ldGFkYXRhT3ZlcnJpZGU8RGlyZWN0aXZlPik6IHZvaWQge1xuICAgIHRoaXMuYXNzZXJ0Tm90SW5zdGFudGlhdGVkKCdvdmVycmlkZURpcmVjdGl2ZScsICdvdmVycmlkZSBkaXJlY3RpdmUgbWV0YWRhdGEnKTtcbiAgICB0aGlzLmNvbXBpbGVyLm92ZXJyaWRlRGlyZWN0aXZlKGRpcmVjdGl2ZSwgb3ZlcnJpZGUpO1xuICB9XG5cbiAgb3ZlcnJpZGVQaXBlKHBpcGU6IFR5cGU8YW55Piwgb3ZlcnJpZGU6IE1ldGFkYXRhT3ZlcnJpZGU8UGlwZT4pOiB2b2lkIHtcbiAgICB0aGlzLmFzc2VydE5vdEluc3RhbnRpYXRlZCgnb3ZlcnJpZGVQaXBlJywgJ292ZXJyaWRlIHBpcGUgbWV0YWRhdGEnKTtcbiAgICB0aGlzLmNvbXBpbGVyLm92ZXJyaWRlUGlwZShwaXBlLCBvdmVycmlkZSk7XG4gIH1cblxuICAvKipcbiAgICogT3ZlcndyaXRlcyBhbGwgcHJvdmlkZXJzIGZvciB0aGUgZ2l2ZW4gdG9rZW4gd2l0aCB0aGUgZ2l2ZW4gcHJvdmlkZXIgZGVmaW5pdGlvbi5cbiAgICovXG4gIG92ZXJyaWRlUHJvdmlkZXIodG9rZW46IGFueSwgcHJvdmlkZXI6IHt1c2VGYWN0b3J5PzogRnVuY3Rpb24sIHVzZVZhbHVlPzogYW55LCBkZXBzPzogYW55W119KTpcbiAgICAgIHZvaWQge1xuICAgIHRoaXMuYXNzZXJ0Tm90SW5zdGFudGlhdGVkKCdvdmVycmlkZVByb3ZpZGVyJywgJ292ZXJyaWRlIHByb3ZpZGVyJyk7XG4gICAgdGhpcy5jb21waWxlci5vdmVycmlkZVByb3ZpZGVyKHRva2VuLCBwcm92aWRlcik7XG4gIH1cblxuICBjcmVhdGVDb21wb25lbnQ8VD4odHlwZTogVHlwZTxUPik6IENvbXBvbmVudEZpeHR1cmU8VD4ge1xuICAgIGNvbnN0IHRlc3RDb21wb25lbnRSZW5kZXJlciA9IHRoaXMuaW5qZWN0KFRlc3RDb21wb25lbnRSZW5kZXJlcik7XG4gICAgY29uc3Qgcm9vdEVsSWQgPSBgcm9vdCR7X25leHRSb290RWxlbWVudElkKyt9YDtcbiAgICB0ZXN0Q29tcG9uZW50UmVuZGVyZXIuaW5zZXJ0Um9vdEVsZW1lbnQocm9vdEVsSWQpO1xuXG4gICAgY29uc3QgY29tcG9uZW50RGVmID0gKHR5cGUgYXMgYW55KS7JtWNtcDtcblxuICAgIGlmICghY29tcG9uZW50RGVmKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEl0IGxvb2tzIGxpa2UgJyR7c3RyaW5naWZ5KHR5cGUpfScgaGFzIG5vdCBiZWVuIGNvbXBpbGVkLmApO1xuICAgIH1cblxuICAgIC8vIFRPRE86IERvbid0IGNhc3QgYXMgYEluamVjdGlvblRva2VuPGJvb2xlYW4+YCwgcHJvcGVyIHR5cGUgaXMgYm9vbGVhbltdXG4gICAgY29uc3Qgbm9OZ1pvbmUgPSB0aGlzLmluamVjdChDb21wb25lbnRGaXh0dXJlTm9OZ1pvbmUgYXMgSW5qZWN0aW9uVG9rZW48Ym9vbGVhbj4sIGZhbHNlKTtcbiAgICAvLyBUT0RPOiBEb24ndCBjYXN0IGFzIGBJbmplY3Rpb25Ub2tlbjxib29sZWFuPmAsIHByb3BlciB0eXBlIGlzIGJvb2xlYW5bXVxuICAgIGNvbnN0IGF1dG9EZXRlY3Q6IGJvb2xlYW4gPVxuICAgICAgICB0aGlzLmluamVjdChDb21wb25lbnRGaXh0dXJlQXV0b0RldGVjdCBhcyBJbmplY3Rpb25Ub2tlbjxib29sZWFuPiwgZmFsc2UpO1xuICAgIGNvbnN0IG5nWm9uZTogTmdab25lfG51bGwgPSBub05nWm9uZSA/IG51bGwgOiB0aGlzLmluamVjdChOZ1pvbmUsIG51bGwpO1xuICAgIGNvbnN0IGNvbXBvbmVudEZhY3RvcnkgPSBuZXcgQ29tcG9uZW50RmFjdG9yeShjb21wb25lbnREZWYpO1xuICAgIGNvbnN0IGluaXRDb21wb25lbnQgPSAoKSA9PiB7XG4gICAgICBjb25zdCBjb21wb25lbnRSZWYgPVxuICAgICAgICAgIGNvbXBvbmVudEZhY3RvcnkuY3JlYXRlKEluamVjdG9yLk5VTEwsIFtdLCBgIyR7cm9vdEVsSWR9YCwgdGhpcy50ZXN0TW9kdWxlUmVmKTtcbiAgICAgIHJldHVybiBuZXcgQ29tcG9uZW50Rml4dHVyZTxhbnk+KGNvbXBvbmVudFJlZiwgbmdab25lLCBhdXRvRGV0ZWN0KTtcbiAgICB9O1xuICAgIGNvbnN0IGZpeHR1cmUgPSBuZ1pvbmUgPyBuZ1pvbmUucnVuKGluaXRDb21wb25lbnQpIDogaW5pdENvbXBvbmVudCgpO1xuICAgIHRoaXMuX2FjdGl2ZUZpeHR1cmVzLnB1c2goZml4dHVyZSk7XG4gICAgcmV0dXJuIGZpeHR1cmU7XG4gIH1cblxuICAvKipcbiAgICogQGludGVybmFsIHN0cmlwIHRoaXMgZnJvbSBwdWJsaXNoZWQgZC50cyBmaWxlcyBkdWUgdG9cbiAgICogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy8zNjIxNlxuICAgKi9cbiAgcHJpdmF0ZSBnZXQgY29tcGlsZXIoKTogUjNUZXN0QmVkQ29tcGlsZXIge1xuICAgIGlmICh0aGlzLl9jb21waWxlciA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBOZWVkIHRvIGNhbGwgVGVzdEJlZC5pbml0VGVzdEVudmlyb25tZW50KCkgZmlyc3RgKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2NvbXBpbGVyO1xuICB9XG5cbiAgLyoqXG4gICAqIEBpbnRlcm5hbCBzdHJpcCB0aGlzIGZyb20gcHVibGlzaGVkIGQudHMgZmlsZXMgZHVlIHRvXG4gICAqIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvVHlwZVNjcmlwdC9pc3N1ZXMvMzYyMTZcbiAgICovXG4gIHByaXZhdGUgZ2V0IHRlc3RNb2R1bGVSZWYoKTogTmdNb2R1bGVSZWY8YW55PiB7XG4gICAgaWYgKHRoaXMuX3Rlc3RNb2R1bGVSZWYgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3Rlc3RNb2R1bGVSZWYgPSB0aGlzLmNvbXBpbGVyLmZpbmFsaXplKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl90ZXN0TW9kdWxlUmVmO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3NlcnROb3RJbnN0YW50aWF0ZWQobWV0aG9kTmFtZTogc3RyaW5nLCBtZXRob2REZXNjcmlwdGlvbjogc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMuX3Rlc3RNb2R1bGVSZWYgIT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgQ2Fubm90ICR7bWV0aG9kRGVzY3JpcHRpb259IHdoZW4gdGhlIHRlc3QgbW9kdWxlIGhhcyBhbHJlYWR5IGJlZW4gaW5zdGFudGlhdGVkLiBgICtcbiAgICAgICAgICBgTWFrZSBzdXJlIHlvdSBhcmUgbm90IHVzaW5nIFxcYGluamVjdFxcYCBiZWZvcmUgXFxgJHttZXRob2ROYW1lfVxcYC5gKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgd2hldGhlciB0aGUgbW9kdWxlIHNjb3BpbmcgcXVldWUgc2hvdWxkIGJlIGZsdXNoZWQsIGFuZCBmbHVzaCBpdCBpZiBuZWVkZWQuXG4gICAqXG4gICAqIFdoZW4gdGhlIFRlc3RCZWQgaXMgcmVzZXQsIGl0IGNsZWFycyB0aGUgSklUIG1vZHVsZSBjb21waWxhdGlvbiBxdWV1ZSwgY2FuY2VsbGluZyBhbnlcbiAgICogaW4tcHJvZ3Jlc3MgbW9kdWxlIGNvbXBpbGF0aW9uLiBUaGlzIGNyZWF0ZXMgYSBwb3RlbnRpYWwgaGF6YXJkIC0gdGhlIHZlcnkgZmlyc3QgdGltZSB0aGVcbiAgICogVGVzdEJlZCBpcyBpbml0aWFsaXplZCAob3IgaWYgaXQncyByZXNldCB3aXRob3V0IGJlaW5nIGluaXRpYWxpemVkKSwgdGhlcmUgbWF5IGJlIHBlbmRpbmdcbiAgICogY29tcGlsYXRpb25zIG9mIG1vZHVsZXMgZGVjbGFyZWQgaW4gZ2xvYmFsIHNjb3BlLiBUaGVzZSBjb21waWxhdGlvbnMgc2hvdWxkIGJlIGZpbmlzaGVkLlxuICAgKlxuICAgKiBUbyBlbnN1cmUgdGhhdCBnbG9iYWxseSBkZWNsYXJlZCBtb2R1bGVzIGhhdmUgdGhlaXIgY29tcG9uZW50cyBzY29wZWQgcHJvcGVybHksIHRoaXMgZnVuY3Rpb25cbiAgICogaXMgY2FsbGVkIHdoZW5ldmVyIFRlc3RCZWQgaXMgaW5pdGlhbGl6ZWQgb3IgcmVzZXQuIFRoZSBfZmlyc3RfIHRpbWUgdGhhdCB0aGlzIGhhcHBlbnMsIHByaW9yXG4gICAqIHRvIGFueSBvdGhlciBvcGVyYXRpb25zLCB0aGUgc2NvcGluZyBxdWV1ZSBpcyBmbHVzaGVkLlxuICAgKi9cbiAgcHJpdmF0ZSBjaGVja0dsb2JhbENvbXBpbGF0aW9uRmluaXNoZWQoKTogdm9pZCB7XG4gICAgLy8gQ2hlY2tpbmcgX3Rlc3ROZ01vZHVsZVJlZiBpcyBudWxsIHNob3VsZCBub3QgYmUgbmVjZXNzYXJ5LCBidXQgaXMgbGVmdCBpbiBhcyBhbiBhZGRpdGlvbmFsXG4gICAgLy8gZ3VhcmQgdGhhdCBjb21waWxhdGlvbnMgcXVldWVkIGluIHRlc3RzIChhZnRlciBpbnN0YW50aWF0aW9uKSBhcmUgbmV2ZXIgZmx1c2hlZCBhY2NpZGVudGFsbHkuXG4gICAgaWYgKCF0aGlzLl9nbG9iYWxDb21waWxhdGlvbkNoZWNrZWQgJiYgdGhpcy5fdGVzdE1vZHVsZVJlZiA9PT0gbnVsbCkge1xuICAgICAgZmx1c2hNb2R1bGVTY29waW5nUXVldWVBc011Y2hBc1Bvc3NpYmxlKCk7XG4gICAgfVxuICAgIHRoaXMuX2dsb2JhbENvbXBpbGF0aW9uQ2hlY2tlZCA9IHRydWU7XG4gIH1cblxuICBwcml2YXRlIGRlc3Ryb3lBY3RpdmVGaXh0dXJlcygpOiB2b2lkIHtcbiAgICBsZXQgZXJyb3JDb3VudCA9IDA7XG4gICAgdGhpcy5fYWN0aXZlRml4dHVyZXMuZm9yRWFjaCgoZml4dHVyZSkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgZml4dHVyZS5kZXN0cm95KCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGVycm9yQ291bnQrKztcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZHVyaW5nIGNsZWFudXAgb2YgY29tcG9uZW50Jywge1xuICAgICAgICAgIGNvbXBvbmVudDogZml4dHVyZS5jb21wb25lbnRJbnN0YW5jZSxcbiAgICAgICAgICBzdGFja3RyYWNlOiBlLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLl9hY3RpdmVGaXh0dXJlcyA9IFtdO1xuXG4gICAgaWYgKGVycm9yQ291bnQgPiAwICYmIHRoaXMuc2hvdWxkUmV0aHJvd1RlYXJkb3duRXJyb3JzKCkpIHtcbiAgICAgIHRocm93IEVycm9yKFxuICAgICAgICAgIGAke2Vycm9yQ291bnR9ICR7KGVycm9yQ291bnQgPT09IDEgPyAnY29tcG9uZW50JyA6ICdjb21wb25lbnRzJyl9IGAgK1xuICAgICAgICAgIGB0aHJldyBlcnJvcnMgZHVyaW5nIGNsZWFudXBgKTtcbiAgICB9XG4gIH1cblxuICBzaG91bGRSZXRocm93VGVhcmRvd25FcnJvcnMoKTogYm9vbGVhbiB7XG4gICAgY29uc3QgaW5zdGFuY2VPcHRpb25zID0gdGhpcy5faW5zdGFuY2VUZWFyZG93bk9wdGlvbnM7XG4gICAgY29uc3QgZW52aXJvbm1lbnRPcHRpb25zID0gVGVzdEJlZFJlbmRlcjMuX2Vudmlyb25tZW50VGVhcmRvd25PcHRpb25zO1xuXG4gICAgLy8gSWYgdGhlIG5ldyB0ZWFyZG93biBiZWhhdmlvciBoYXNuJ3QgYmVlbiBjb25maWd1cmVkLCBwcmVzZXJ2ZSB0aGUgb2xkIGJlaGF2aW9yLlxuICAgIGlmICghaW5zdGFuY2VPcHRpb25zICYmICFlbnZpcm9ubWVudE9wdGlvbnMpIHtcbiAgICAgIHJldHVybiBURUFSRE9XTl9URVNUSU5HX01PRFVMRV9PTl9ERVNUUk9ZX0RFRkFVTFQ7XG4gICAgfVxuXG4gICAgLy8gT3RoZXJ3aXNlIHVzZSB0aGUgY29uZmlndXJlZCBiZWhhdmlvciBvciBkZWZhdWx0IHRvIHJldGhyb3dpbmcuXG4gICAgcmV0dXJuIGluc3RhbmNlT3B0aW9ucz8ucmV0aHJvd0Vycm9ycyA/PyBlbnZpcm9ubWVudE9wdGlvbnM/LnJldGhyb3dFcnJvcnMgPz9cbiAgICAgICAgdGhpcy5zaG91bGRUZWFyRG93blRlc3RpbmdNb2R1bGUoKTtcbiAgfVxuXG4gIHNob3VsZFRocm93RXJyb3JPblVua25vd25FbGVtZW50cygpOiBib29sZWFuIHtcbiAgICAvLyBDaGVjayBpZiBhIGNvbmZpZ3VyYXRpb24gaGFzIGJlZW4gcHJvdmlkZWQgdG8gdGhyb3cgd2hlbiBhbiB1bmtub3duIGVsZW1lbnQgaXMgZm91bmRcbiAgICByZXR1cm4gdGhpcy5faW5zdGFuY2VFcnJvck9uVW5rbm93bkVsZW1lbnRzT3B0aW9uID8/XG4gICAgICAgIFRlc3RCZWRSZW5kZXIzLl9lbnZpcm9ubWVudEVycm9yT25Vbmtub3duRWxlbWVudHNPcHRpb24gPz9cbiAgICAgICAgVEhST1dfT05fVU5LTk9XTl9FTEVNRU5UU19ERUZBVUxUO1xuICB9XG5cbiAgc2hvdWxkVGhyb3dFcnJvck9uVW5rbm93blByb3BlcnRpZXMoKTogYm9vbGVhbiB7XG4gICAgLy8gQ2hlY2sgaWYgYSBjb25maWd1cmF0aW9uIGhhcyBiZWVuIHByb3ZpZGVkIHRvIHRocm93IHdoZW4gYW4gdW5rbm93biBwcm9wZXJ0eSBpcyBmb3VuZFxuICAgIHJldHVybiB0aGlzLl9pbnN0YW5jZUVycm9yT25Vbmtub3duUHJvcGVydGllc09wdGlvbiA/P1xuICAgICAgICBUZXN0QmVkUmVuZGVyMy5fZW52aXJvbm1lbnRFcnJvck9uVW5rbm93blByb3BlcnRpZXNPcHRpb24gPz9cbiAgICAgICAgVEhST1dfT05fVU5LTk9XTl9QUk9QRVJUSUVTX0RFRkFVTFQ7XG4gIH1cblxuICBzaG91bGRUZWFyRG93blRlc3RpbmdNb2R1bGUoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuX2luc3RhbmNlVGVhcmRvd25PcHRpb25zPy5kZXN0cm95QWZ0ZXJFYWNoID8/XG4gICAgICAgIFRlc3RCZWRSZW5kZXIzLl9lbnZpcm9ubWVudFRlYXJkb3duT3B0aW9ucz8uZGVzdHJveUFmdGVyRWFjaCA/P1xuICAgICAgICBURUFSRE9XTl9URVNUSU5HX01PRFVMRV9PTl9ERVNUUk9ZX0RFRkFVTFQ7XG4gIH1cblxuICB0ZWFyRG93blRlc3RpbmdNb2R1bGUoKSB7XG4gICAgLy8gSWYgdGhlIG1vZHVsZSByZWYgaGFzIGFscmVhZHkgYmVlbiBkZXN0cm95ZWQsIHdlIHdvbid0IGJlIGFibGUgdG8gZ2V0IGEgdGVzdCByZW5kZXJlci5cbiAgICBpZiAodGhpcy5fdGVzdE1vZHVsZVJlZiA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBSZXNvbHZlIHRoZSByZW5kZXJlciBhaGVhZCBvZiB0aW1lLCBiZWNhdXNlIHdlIHdhbnQgdG8gcmVtb3ZlIHRoZSByb290IGVsZW1lbnRzIGFzIHRoZSB2ZXJ5XG4gICAgLy8gbGFzdCBzdGVwLCBidXQgdGhlIGluamVjdG9yIHdpbGwgYmUgZGVzdHJveWVkIGFzIGEgcGFydCBvZiB0aGUgbW9kdWxlIHJlZiBkZXN0cnVjdGlvbi5cbiAgICBjb25zdCB0ZXN0UmVuZGVyZXIgPSB0aGlzLmluamVjdChUZXN0Q29tcG9uZW50UmVuZGVyZXIpO1xuICAgIHRyeSB7XG4gICAgICB0aGlzLl90ZXN0TW9kdWxlUmVmLmRlc3Ryb3koKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAodGhpcy5zaG91bGRSZXRocm93VGVhcmRvd25FcnJvcnMoKSkge1xuICAgICAgICB0aHJvdyBlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZHVyaW5nIGNsZWFudXAgb2YgYSB0ZXN0aW5nIG1vZHVsZScsIHtcbiAgICAgICAgICBjb21wb25lbnQ6IHRoaXMuX3Rlc3RNb2R1bGVSZWYuaW5zdGFuY2UsXG4gICAgICAgICAgc3RhY2t0cmFjZTogZSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRlc3RSZW5kZXJlci5yZW1vdmVBbGxSb290RWxlbWVudHM/LigpO1xuICAgIH1cbiAgfVxufVxuXG5sZXQgdGVzdEJlZDogVGVzdEJlZFJlbmRlcjM7XG5cbmV4cG9ydCBmdW5jdGlvbiBfZ2V0VGVzdEJlZFJlbmRlcjMoKTogVGVzdEJlZFJlbmRlcjMge1xuICByZXR1cm4gdGVzdEJlZCA9IHRlc3RCZWQgfHwgbmV3IFRlc3RCZWRSZW5kZXIzKCk7XG59XG4iXX0=
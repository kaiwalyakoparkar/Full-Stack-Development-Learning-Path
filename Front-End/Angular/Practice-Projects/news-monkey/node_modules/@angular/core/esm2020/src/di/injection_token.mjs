/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { assertLessThan } from '../util/assert';
import { ɵɵdefineInjectable } from './interface/defs';
/**
 * Creates a token that can be used in a DI Provider.
 *
 * Use an `InjectionToken` whenever the type you are injecting is not reified (does not have a
 * runtime representation) such as when injecting an interface, callable type, array or
 * parameterized type.
 *
 * `InjectionToken` is parameterized on `T` which is the type of object which will be returned by
 * the `Injector`. This provides an additional level of type safety.
 *
 * ```
 * interface MyInterface {...}
 * const myInterface = injector.get(new InjectionToken<MyInterface>('SomeToken'));
 * // myInterface is inferred to be MyInterface.
 * ```
 *
 * When creating an `InjectionToken`, you can optionally specify a factory function which returns
 * (possibly by creating) a default value of the parameterized type `T`. This sets up the
 * `InjectionToken` using this factory as a provider as if it was defined explicitly in the
 * application's root injector. If the factory function, which takes zero arguments, needs to inject
 * dependencies, it can do so using the `inject` function.
 * As you can see in the Tree-shakable InjectionToken example below.
 *
 * Additionally, if a `factory` is specified you can also specify the `providedIn` option, which
 * overrides the above behavior and marks the token as belonging to a particular `@NgModule`. As
 * mentioned above, `'root'` is the default value for `providedIn`.
 *
 * @usageNotes
 * ### Basic Examples
 *
 * ### Plain InjectionToken
 *
 * {@example core/di/ts/injector_spec.ts region='InjectionToken'}
 *
 * ### Tree-shakable InjectionToken
 *
 * {@example core/di/ts/injector_spec.ts region='ShakableInjectionToken'}
 *
 *
 * @publicApi
 */
export class InjectionToken {
    /**
     * @param _desc   Description for the token,
     *                used only for debugging purposes,
     *                it should but does not need to be unique
     * @param options Options for the token's usage, as described above
     */
    constructor(_desc, options) {
        this._desc = _desc;
        /** @internal */
        this.ngMetadataName = 'InjectionToken';
        this.ɵprov = undefined;
        if (typeof options == 'number') {
            (typeof ngDevMode === 'undefined' || ngDevMode) &&
                assertLessThan(options, 0, 'Only negative numbers are supported here');
            // This is a special hack to assign __NG_ELEMENT_ID__ to this instance.
            // See `InjectorMarkers`
            this.__NG_ELEMENT_ID__ = options;
        }
        else if (options !== undefined) {
            this.ɵprov = ɵɵdefineInjectable({
                token: this,
                providedIn: options.providedIn || 'root',
                factory: options.factory,
            });
        }
    }
    /**
     * @internal
     */
    get multi() {
        return this;
    }
    toString() {
        return `InjectionToken ${this._desc}`;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5qZWN0aW9uX3Rva2VuLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvZGkvaW5qZWN0aW9uX3Rva2VuLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUU5QyxPQUFPLEVBQUMsa0JBQWtCLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUVwRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXdDRztBQUNILE1BQU0sT0FBTyxjQUFjO0lBTXpCOzs7OztPQUtHO0lBQ0gsWUFBc0IsS0FBYSxFQUFFLE9BRXBDO1FBRnFCLFVBQUssR0FBTCxLQUFLLENBQVE7UUFYbkMsZ0JBQWdCO1FBQ1AsbUJBQWMsR0FBRyxnQkFBZ0IsQ0FBQztRQWF6QyxJQUFJLENBQUMsS0FBSyxHQUFHLFNBQVMsQ0FBQztRQUN2QixJQUFJLE9BQU8sT0FBTyxJQUFJLFFBQVEsRUFBRTtZQUM5QixDQUFDLE9BQU8sU0FBUyxLQUFLLFdBQVcsSUFBSSxTQUFTLENBQUM7Z0JBQzNDLGNBQWMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxFQUFFLDBDQUEwQyxDQUFDLENBQUM7WUFDM0UsdUVBQXVFO1lBQ3ZFLHdCQUF3QjtZQUN2QixJQUFZLENBQUMsaUJBQWlCLEdBQUcsT0FBTyxDQUFDO1NBQzNDO2FBQU0sSUFBSSxPQUFPLEtBQUssU0FBUyxFQUFFO1lBQ2hDLElBQUksQ0FBQyxLQUFLLEdBQUcsa0JBQWtCLENBQUM7Z0JBQzlCLEtBQUssRUFBRSxJQUFJO2dCQUNYLFVBQVUsRUFBRSxPQUFPLENBQUMsVUFBVSxJQUFJLE1BQU07Z0JBQ3hDLE9BQU8sRUFBRSxPQUFPLENBQUMsT0FBTzthQUN6QixDQUFDLENBQUM7U0FDSjtJQUNILENBQUM7SUFFRDs7T0FFRztJQUNILElBQUksS0FBSztRQUNQLE9BQU8sSUFBZ0MsQ0FBQztJQUMxQyxDQUFDO0lBRUQsUUFBUTtRQUNOLE9BQU8sa0JBQWtCLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUN4QyxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtUeXBlfSBmcm9tICcuLi9pbnRlcmZhY2UvdHlwZSc7XG5pbXBvcnQge2Fzc2VydExlc3NUaGFufSBmcm9tICcuLi91dGlsL2Fzc2VydCc7XG5cbmltcG9ydCB7ybXJtWRlZmluZUluamVjdGFibGV9IGZyb20gJy4vaW50ZXJmYWNlL2RlZnMnO1xuXG4vKipcbiAqIENyZWF0ZXMgYSB0b2tlbiB0aGF0IGNhbiBiZSB1c2VkIGluIGEgREkgUHJvdmlkZXIuXG4gKlxuICogVXNlIGFuIGBJbmplY3Rpb25Ub2tlbmAgd2hlbmV2ZXIgdGhlIHR5cGUgeW91IGFyZSBpbmplY3RpbmcgaXMgbm90IHJlaWZpZWQgKGRvZXMgbm90IGhhdmUgYVxuICogcnVudGltZSByZXByZXNlbnRhdGlvbikgc3VjaCBhcyB3aGVuIGluamVjdGluZyBhbiBpbnRlcmZhY2UsIGNhbGxhYmxlIHR5cGUsIGFycmF5IG9yXG4gKiBwYXJhbWV0ZXJpemVkIHR5cGUuXG4gKlxuICogYEluamVjdGlvblRva2VuYCBpcyBwYXJhbWV0ZXJpemVkIG9uIGBUYCB3aGljaCBpcyB0aGUgdHlwZSBvZiBvYmplY3Qgd2hpY2ggd2lsbCBiZSByZXR1cm5lZCBieVxuICogdGhlIGBJbmplY3RvcmAuIFRoaXMgcHJvdmlkZXMgYW4gYWRkaXRpb25hbCBsZXZlbCBvZiB0eXBlIHNhZmV0eS5cbiAqXG4gKiBgYGBcbiAqIGludGVyZmFjZSBNeUludGVyZmFjZSB7Li4ufVxuICogY29uc3QgbXlJbnRlcmZhY2UgPSBpbmplY3Rvci5nZXQobmV3IEluamVjdGlvblRva2VuPE15SW50ZXJmYWNlPignU29tZVRva2VuJykpO1xuICogLy8gbXlJbnRlcmZhY2UgaXMgaW5mZXJyZWQgdG8gYmUgTXlJbnRlcmZhY2UuXG4gKiBgYGBcbiAqXG4gKiBXaGVuIGNyZWF0aW5nIGFuIGBJbmplY3Rpb25Ub2tlbmAsIHlvdSBjYW4gb3B0aW9uYWxseSBzcGVjaWZ5IGEgZmFjdG9yeSBmdW5jdGlvbiB3aGljaCByZXR1cm5zXG4gKiAocG9zc2libHkgYnkgY3JlYXRpbmcpIGEgZGVmYXVsdCB2YWx1ZSBvZiB0aGUgcGFyYW1ldGVyaXplZCB0eXBlIGBUYC4gVGhpcyBzZXRzIHVwIHRoZVxuICogYEluamVjdGlvblRva2VuYCB1c2luZyB0aGlzIGZhY3RvcnkgYXMgYSBwcm92aWRlciBhcyBpZiBpdCB3YXMgZGVmaW5lZCBleHBsaWNpdGx5IGluIHRoZVxuICogYXBwbGljYXRpb24ncyByb290IGluamVjdG9yLiBJZiB0aGUgZmFjdG9yeSBmdW5jdGlvbiwgd2hpY2ggdGFrZXMgemVybyBhcmd1bWVudHMsIG5lZWRzIHRvIGluamVjdFxuICogZGVwZW5kZW5jaWVzLCBpdCBjYW4gZG8gc28gdXNpbmcgdGhlIGBpbmplY3RgIGZ1bmN0aW9uLlxuICogQXMgeW91IGNhbiBzZWUgaW4gdGhlIFRyZWUtc2hha2FibGUgSW5qZWN0aW9uVG9rZW4gZXhhbXBsZSBiZWxvdy5cbiAqXG4gKiBBZGRpdGlvbmFsbHksIGlmIGEgYGZhY3RvcnlgIGlzIHNwZWNpZmllZCB5b3UgY2FuIGFsc28gc3BlY2lmeSB0aGUgYHByb3ZpZGVkSW5gIG9wdGlvbiwgd2hpY2hcbiAqIG92ZXJyaWRlcyB0aGUgYWJvdmUgYmVoYXZpb3IgYW5kIG1hcmtzIHRoZSB0b2tlbiBhcyBiZWxvbmdpbmcgdG8gYSBwYXJ0aWN1bGFyIGBATmdNb2R1bGVgLiBBc1xuICogbWVudGlvbmVkIGFib3ZlLCBgJ3Jvb3QnYCBpcyB0aGUgZGVmYXVsdCB2YWx1ZSBmb3IgYHByb3ZpZGVkSW5gLlxuICpcbiAqIEB1c2FnZU5vdGVzXG4gKiAjIyMgQmFzaWMgRXhhbXBsZXNcbiAqXG4gKiAjIyMgUGxhaW4gSW5qZWN0aW9uVG9rZW5cbiAqXG4gKiB7QGV4YW1wbGUgY29yZS9kaS90cy9pbmplY3Rvcl9zcGVjLnRzIHJlZ2lvbj0nSW5qZWN0aW9uVG9rZW4nfVxuICpcbiAqICMjIyBUcmVlLXNoYWthYmxlIEluamVjdGlvblRva2VuXG4gKlxuICoge0BleGFtcGxlIGNvcmUvZGkvdHMvaW5qZWN0b3Jfc3BlYy50cyByZWdpb249J1NoYWthYmxlSW5qZWN0aW9uVG9rZW4nfVxuICpcbiAqXG4gKiBAcHVibGljQXBpXG4gKi9cbmV4cG9ydCBjbGFzcyBJbmplY3Rpb25Ub2tlbjxUPiB7XG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgcmVhZG9ubHkgbmdNZXRhZGF0YU5hbWUgPSAnSW5qZWN0aW9uVG9rZW4nO1xuXG4gIHJlYWRvbmx5IMm1cHJvdjogdW5rbm93bjtcblxuICAvKipcbiAgICogQHBhcmFtIF9kZXNjICAgRGVzY3JpcHRpb24gZm9yIHRoZSB0b2tlbixcbiAgICogICAgICAgICAgICAgICAgdXNlZCBvbmx5IGZvciBkZWJ1Z2dpbmcgcHVycG9zZXMsXG4gICAqICAgICAgICAgICAgICAgIGl0IHNob3VsZCBidXQgZG9lcyBub3QgbmVlZCB0byBiZSB1bmlxdWVcbiAgICogQHBhcmFtIG9wdGlvbnMgT3B0aW9ucyBmb3IgdGhlIHRva2VuJ3MgdXNhZ2UsIGFzIGRlc2NyaWJlZCBhYm92ZVxuICAgKi9cbiAgY29uc3RydWN0b3IocHJvdGVjdGVkIF9kZXNjOiBzdHJpbmcsIG9wdGlvbnM/OiB7XG4gICAgcHJvdmlkZWRJbj86IFR5cGU8YW55Pnwncm9vdCd8J3BsYXRmb3JtJ3wnYW55J3xudWxsLCBmYWN0b3J5OiAoKSA9PiBUXG4gIH0pIHtcbiAgICB0aGlzLsm1cHJvdiA9IHVuZGVmaW5lZDtcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMgPT0gJ251bWJlcicpIHtcbiAgICAgICh0eXBlb2YgbmdEZXZNb2RlID09PSAndW5kZWZpbmVkJyB8fCBuZ0Rldk1vZGUpICYmXG4gICAgICAgICAgYXNzZXJ0TGVzc1RoYW4ob3B0aW9ucywgMCwgJ09ubHkgbmVnYXRpdmUgbnVtYmVycyBhcmUgc3VwcG9ydGVkIGhlcmUnKTtcbiAgICAgIC8vIFRoaXMgaXMgYSBzcGVjaWFsIGhhY2sgdG8gYXNzaWduIF9fTkdfRUxFTUVOVF9JRF9fIHRvIHRoaXMgaW5zdGFuY2UuXG4gICAgICAvLyBTZWUgYEluamVjdG9yTWFya2Vyc2BcbiAgICAgICh0aGlzIGFzIGFueSkuX19OR19FTEVNRU5UX0lEX18gPSBvcHRpb25zO1xuICAgIH0gZWxzZSBpZiAob3B0aW9ucyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLsm1cHJvdiA9IMm1ybVkZWZpbmVJbmplY3RhYmxlKHtcbiAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgIHByb3ZpZGVkSW46IG9wdGlvbnMucHJvdmlkZWRJbiB8fCAncm9vdCcsXG4gICAgICAgIGZhY3Rvcnk6IG9wdGlvbnMuZmFjdG9yeSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIGdldCBtdWx0aSgpOiBJbmplY3Rpb25Ub2tlbjxBcnJheTxUPj4ge1xuICAgIHJldHVybiB0aGlzIGFzIEluamVjdGlvblRva2VuPEFycmF5PFQ+PjtcbiAgfVxuXG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGBJbmplY3Rpb25Ub2tlbiAke3RoaXMuX2Rlc2N9YDtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEluamVjdGFibGVEZWZUb2tlbjxUPiBleHRlbmRzIEluamVjdGlvblRva2VuPFQ+IHtcbiAgybVwcm92OiB1bmtub3duO1xufVxuIl19
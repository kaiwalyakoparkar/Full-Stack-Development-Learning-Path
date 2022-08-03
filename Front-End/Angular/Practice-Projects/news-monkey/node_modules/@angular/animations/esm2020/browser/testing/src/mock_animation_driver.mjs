/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { AUTO_STYLE, NoopAnimationPlayer } from '@angular/animations';
import { ɵallowPreviousPlayerStylesMerge as allowPreviousPlayerStylesMerge, ɵcontainsElement as containsElement, ɵgetParentElement as getParentElement, ɵinvokeQuery as invokeQuery, ɵnormalizeKeyframes as normalizeKeyframes, ɵvalidateStyleProperty as validateStyleProperty, } from '@angular/animations/browser';
import { validateWebAnimatableStyleProperty } from '../../src/render/shared';
import { camelCaseToDashCase } from '../../src/util';
/**
 * @publicApi
 */
export class MockAnimationDriver {
    validateStyleProperty(prop) {
        return validateStyleProperty(prop);
    }
    validateAnimatableStyleProperty(prop) {
        const cssProp = camelCaseToDashCase(prop);
        return validateWebAnimatableStyleProperty(cssProp);
    }
    matchesElement(_element, _selector) {
        return false;
    }
    containsElement(elm1, elm2) {
        return containsElement(elm1, elm2);
    }
    getParentElement(element) {
        return getParentElement(element);
    }
    query(element, selector, multi) {
        return invokeQuery(element, selector, multi);
    }
    computeStyle(element, prop, defaultValue) {
        return defaultValue || '';
    }
    animate(element, keyframes, duration, delay, easing, previousPlayers = []) {
        const player = new MockAnimationPlayer(element, keyframes, duration, delay, easing, previousPlayers);
        MockAnimationDriver.log.push(player);
        return player;
    }
}
MockAnimationDriver.log = [];
/**
 * @publicApi
 */
export class MockAnimationPlayer extends NoopAnimationPlayer {
    constructor(element, keyframes, duration, delay, easing, previousPlayers) {
        super(duration, delay);
        this.element = element;
        this.keyframes = keyframes;
        this.duration = duration;
        this.delay = delay;
        this.easing = easing;
        this.previousPlayers = previousPlayers;
        this.__finished = false;
        this.__started = false;
        this.previousStyles = new Map();
        this._onInitFns = [];
        this.currentSnapshot = new Map();
        this._keyframes = [];
        this._keyframes = normalizeKeyframes(keyframes);
        if (allowPreviousPlayerStylesMerge(duration, delay)) {
            previousPlayers.forEach(player => {
                if (player instanceof MockAnimationPlayer) {
                    const styles = player.currentSnapshot;
                    styles.forEach((val, prop) => this.previousStyles.set(prop, val));
                }
            });
        }
    }
    /* @internal */
    onInit(fn) {
        this._onInitFns.push(fn);
    }
    /* @internal */
    init() {
        super.init();
        this._onInitFns.forEach(fn => fn());
        this._onInitFns = [];
    }
    reset() {
        super.reset();
        this.__started = false;
    }
    finish() {
        super.finish();
        this.__finished = true;
    }
    destroy() {
        super.destroy();
        this.__finished = true;
    }
    /* @internal */
    triggerMicrotask() { }
    play() {
        super.play();
        this.__started = true;
    }
    hasStarted() {
        return this.__started;
    }
    beforeDestroy() {
        const captures = new Map();
        this.previousStyles.forEach((val, prop) => captures.set(prop, val));
        if (this.hasStarted()) {
            // when assembling the captured styles, it's important that
            // we build the keyframe styles in the following order:
            // {other styles within keyframes, ... previousStyles }
            this._keyframes.forEach(kf => {
                for (let [prop, val] of kf) {
                    if (prop !== 'offset') {
                        captures.set(prop, this.__finished ? val : AUTO_STYLE);
                    }
                }
            });
        }
        this.currentSnapshot = captures;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja19hbmltYXRpb25fZHJpdmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5pbWF0aW9ucy9icm93c2VyL3Rlc3Rpbmcvc3JjL21vY2tfYW5pbWF0aW9uX2RyaXZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFDSCxPQUFPLEVBQWtCLFVBQVUsRUFBRSxtQkFBbUIsRUFBZ0IsTUFBTSxxQkFBcUIsQ0FBQztBQUNwRyxPQUFPLEVBQWtCLCtCQUErQixJQUFJLDhCQUE4QixFQUFFLGdCQUFnQixJQUFJLGVBQWUsRUFBRSxpQkFBaUIsSUFBSSxnQkFBZ0IsRUFBRSxZQUFZLElBQUksV0FBVyxFQUFFLG1CQUFtQixJQUFJLGtCQUFrQixFQUFFLHNCQUFzQixJQUFJLHFCQUFxQixHQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFFclUsT0FBTyxFQUFDLGtDQUFrQyxFQUFDLE1BQU0seUJBQXlCLENBQUM7QUFDM0UsT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFFbkQ7O0dBRUc7QUFDSCxNQUFNLE9BQU8sbUJBQW1CO0lBRzlCLHFCQUFxQixDQUFDLElBQVk7UUFDaEMsT0FBTyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNyQyxDQUFDO0lBRUQsK0JBQStCLENBQUMsSUFBWTtRQUMxQyxNQUFNLE9BQU8sR0FBRyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMxQyxPQUFPLGtDQUFrQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3JELENBQUM7SUFFRCxjQUFjLENBQUMsUUFBYSxFQUFFLFNBQWlCO1FBQzdDLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVELGVBQWUsQ0FBQyxJQUFTLEVBQUUsSUFBUztRQUNsQyxPQUFPLGVBQWUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDckMsQ0FBQztJQUVE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Q0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7QW5pbWF0aW9uUGxheWVyLCBBVVRPX1NUWUxFLCBOb29wQW5pbWF0aW9uUGxheWVyLCDJtVN0eWxlRGF0YU1hcH0gZnJvbSAnQGFuZ3VsYXIvYW5pbWF0aW9ucyc7XG5pbXBvcnQge0FuaW1hdGlvbkRyaXZlciwgybVhbGxvd1ByZXZpb3VzUGxheWVyU3R5bGVzTWVyZ2UgYXMgYWxsb3dQcmV2aW91c1BsYXllclN0eWxlc01lcmdlLCDJtWNvbnRhaW5zRWxlbWVudCBhcyBjb250YWluc0VsZW1lbnQsIMm1Z2V0UGFyZW50RWxlbWVudCBhcyBnZXRQYXJlbnRFbGVtZW50LCDJtWludm9rZVF1ZXJ5IGFzIGludm9rZVF1ZXJ5LCDJtW5vcm1hbGl6ZUtleWZyYW1lcyBhcyBub3JtYWxpemVLZXlmcmFtZXMsIMm1dmFsaWRhdGVTdHlsZVByb3BlcnR5IGFzIHZhbGlkYXRlU3R5bGVQcm9wZXJ0eSx9IGZyb20gJ0Bhbmd1bGFyL2FuaW1hdGlvbnMvYnJvd3Nlcic7XG5cbmltcG9ydCB7dmFsaWRhdGVXZWJBbmltYXRhYmxlU3R5bGVQcm9wZXJ0eX0gZnJvbSAnLi4vLi4vc3JjL3JlbmRlci9zaGFyZWQnO1xuaW1wb3J0IHtjYW1lbENhc2VUb0Rhc2hDYXNlfSBmcm9tICcuLi8uLi9zcmMvdXRpbCc7XG5cbi8qKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgY2xhc3MgTW9ja0FuaW1hdGlvbkRyaXZlciBpbXBsZW1lbnRzIEFuaW1hdGlvbkRyaXZlciB7XG4gIHN0YXRpYyBsb2c6IEFuaW1hdGlvblBsYXllcltdID0gW107XG5cbiAgdmFsaWRhdGVTdHlsZVByb3BlcnR5KHByb3A6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB2YWxpZGF0ZVN0eWxlUHJvcGVydHkocHJvcCk7XG4gIH1cblxuICB2YWxpZGF0ZUFuaW1hdGFibGVTdHlsZVByb3BlcnR5KHByb3A6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGNzc1Byb3AgPSBjYW1lbENhc2VUb0Rhc2hDYXNlKHByb3ApO1xuICAgIHJldHVybiB2YWxpZGF0ZVdlYkFuaW1hdGFibGVTdHlsZVByb3BlcnR5KGNzc1Byb3ApO1xuICB9XG5cbiAgbWF0Y2hlc0VsZW1lbnQoX2VsZW1lbnQ6IGFueSwgX3NlbGVjdG9yOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBjb250YWluc0VsZW1lbnQoZWxtMTogYW55LCBlbG0yOiBhbnkpOiBib29sZWFuIHtcbiAgICByZXR1cm4gY29udGFpbnNFbGVtZW50KGVsbTEsIGVsbTIpO1xuICB9XG5cbiAgZ2V0UGFyZW50RWxlbWVudChlbGVtZW50OiB1bmtub3duKTogdW5rbm93biB7XG4gICAgcmV0dXJuIGdldFBhcmVudEVsZW1lbnQoZWxlbWVudCk7XG4gIH1cblxuICBxdWVyeShlbGVtZW50OiBhbnksIHNlbGVjdG9yOiBzdHJpbmcsIG11bHRpOiBib29sZWFuKTogYW55W10ge1xuICAgIHJldHVybiBpbnZva2VRdWVyeShlbGVtZW50LCBzZWxlY3RvciwgbXVsdGkpO1xuICB9XG5cbiAgY29tcHV0ZVN0eWxlKGVsZW1lbnQ6IGFueSwgcHJvcDogc3RyaW5nLCBkZWZhdWx0VmFsdWU/OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBkZWZhdWx0VmFsdWUgfHwgJyc7XG4gIH1cblxuICBhbmltYXRlKFxuICAgICAgZWxlbWVudDogYW55LCBrZXlmcmFtZXM6IEFycmF5PMm1U3R5bGVEYXRhTWFwPiwgZHVyYXRpb246IG51bWJlciwgZGVsYXk6IG51bWJlcixcbiAgICAgIGVhc2luZzogc3RyaW5nLCBwcmV2aW91c1BsYXllcnM6IGFueVtdID0gW10pOiBNb2NrQW5pbWF0aW9uUGxheWVyIHtcbiAgICBjb25zdCBwbGF5ZXIgPVxuICAgICAgICBuZXcgTW9ja0FuaW1hdGlvblBsYXllcihlbGVtZW50LCBrZXlmcmFtZXMsIGR1cmF0aW9uLCBkZWxheSwgZWFzaW5nLCBwcmV2aW91c1BsYXllcnMpO1xuICAgIE1vY2tBbmltYXRpb25Ecml2ZXIubG9nLnB1c2goPEFuaW1hdGlvblBsYXllcj5wbGF5ZXIpO1xuICAgIHJldHVybiBwbGF5ZXI7XG4gIH1cbn1cblxuLyoqXG4gKiBAcHVibGljQXBpXG4gKi9cbmV4cG9ydCBjbGFzcyBNb2NrQW5pbWF0aW9uUGxheWVyIGV4dGVuZHMgTm9vcEFuaW1hdGlvblBsYXllciB7XG4gIHByaXZhdGUgX19maW5pc2hlZCA9IGZhbHNlO1xuICBwcml2YXRlIF9fc3RhcnRlZCA9IGZhbHNlO1xuICBwdWJsaWMgcHJldmlvdXNTdHlsZXM6IMm1U3R5bGVEYXRhTWFwID0gbmV3IE1hcCgpO1xuICBwcml2YXRlIF9vbkluaXRGbnM6ICgoKSA9PiBhbnkpW10gPSBbXTtcbiAgcHVibGljIGN1cnJlbnRTbmFwc2hvdDogybVTdHlsZURhdGFNYXAgPSBuZXcgTWFwKCk7XG4gIHByaXZhdGUgX2tleWZyYW1lczogQXJyYXk8ybVTdHlsZURhdGFNYXA+ID0gW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgZWxlbWVudDogYW55LCBwdWJsaWMga2V5ZnJhbWVzOiBBcnJheTzJtVN0eWxlRGF0YU1hcD4sIHB1YmxpYyBkdXJhdGlvbjogbnVtYmVyLFxuICAgICAgcHVibGljIGRlbGF5OiBudW1iZXIsIHB1YmxpYyBlYXNpbmc6IHN0cmluZywgcHVibGljIHByZXZpb3VzUGxheWVyczogYW55W10pIHtcbiAgICBzdXBlcihkdXJhdGlvbiwgZGVsYXkpO1xuXG4gICAgdGhpcy5fa2V5ZnJhbWVzID0gbm9ybWFsaXplS2V5ZnJhbWVzKGtleWZyYW1lcyk7XG5cbiAgICBpZiAoYWxsb3dQcmV2aW91c1BsYXllclN0eWxlc01lcmdlKGR1cmF0aW9uLCBkZWxheSkpIHtcbiAgICAgIHByZXZpb3VzUGxheWVycy5mb3JFYWNoKHBsYXllciA9PiB7XG4gICAgICAgIGlmIChwbGF5ZXIgaW5zdGFuY2VvZiBNb2NrQW5pbWF0aW9uUGxheWVyKSB7XG4gICAgICAgICAgY29uc3Qgc3R5bGVzID0gcGxheWVyLmN1cnJlbnRTbmFwc2hvdDtcbiAgICAgICAgICBzdHlsZXMuZm9yRWFjaCgodmFsLCBwcm9wKSA9PiB0aGlzLnByZXZpb3VzU3R5bGVzLnNldChwcm9wLCB2YWwpKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyogQGludGVybmFsICovXG4gIG9uSW5pdChmbjogKCkgPT4gYW55KSB7XG4gICAgdGhpcy5fb25Jbml0Rm5zLnB1c2goZm4pO1xuICB9XG5cbiAgLyogQGludGVybmFsICovXG4gIG92ZXJyaWRlIGluaXQoKSB7XG4gICAgc3VwZXIuaW5pdCgpO1xuICAgIHRoaXMuX29uSW5pdEZucy5mb3JFYWNoKGZuID0+IGZuKCkpO1xuICAgIHRoaXMuX29uSW5pdEZucyA9IFtdO1xuICB9XG5cbiAgb3ZlcnJpZGUgcmVzZXQoKSB7XG4gICAgc3VwZXIucmVzZXQoKTtcbiAgICB0aGlzLl9fc3RhcnRlZCA9IGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgZmluaXNoKCk6IHZvaWQge1xuICAgIHN1cGVyLmZpbmlzaCgpO1xuICAgIHRoaXMuX19maW5pc2hlZCA9IHRydWU7XG4gIH1cblxuICBvdmVycmlkZSBkZXN0cm95KCk6IHZvaWQge1xuICAgIHN1cGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLl9fZmluaXNoZWQgPSB0cnVlO1xuICB9XG5cbiAgLyogQGludGVybmFsICovXG4gIHRyaWdnZXJNaWNyb3Rhc2soKSB7fVxuXG4gIG92ZXJyaWRlIHBsYXkoKTogdm9pZCB7XG4gICAgc3VwZXIucGxheSgpO1xuICAgIHRoaXMuX19zdGFydGVkID0gdHJ1ZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGhhc1N0YXJ0ZWQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX19zdGFydGVkO1xuICB9XG5cbiAgYmVmb3JlRGVzdHJveSgpIHtcbiAgICBjb25zdCBjYXB0dXJlczogybVTdHlsZURhdGFNYXAgPSBuZXcgTWFwKCk7XG5cbiAgICB0aGlzLnByZXZpb3VzU3R5bGVzLmZvckVhY2goKHZhbCwgcHJvcCkgPT4gY2FwdHVyZXMuc2V0KHByb3AsIHZhbCkpO1xuXG4gICAgaWYgKHRoaXMuaGFzU3RhcnRlZCgpKSB7XG4gICAgICAvLyB3aGVuIGFzc2VtYmxpbmcgdGhlIGNhcHR1cmVkIHN0eWxlcywgaXQncyBpbXBvcnRhbnQgdGhhdFxuICAgICAgLy8gd2UgYnVpbGQgdGhlIGtleWZyYW1lIHN0eWxlcyBpbiB0aGUgZm9sbG93aW5nIG9yZGVyOlxuICAgICAgLy8ge290aGVyIHN0eWxlcyB3aXRoaW4ga2V5ZnJhbWVzLCAuLi4gcHJldmlvdXNTdHlsZXMgfVxuICAgICAgdGhpcy5fa2V5ZnJhbWVzLmZvckVhY2goa2YgPT4ge1xuICAgICAgICBmb3IgKGxldCBbcHJvcCwgdmFsXSBvZiBrZikge1xuICAgICAgICAgIGlmIChwcm9wICE9PSAnb2Zmc2V0Jykge1xuICAgICAgICAgICAgY2FwdHVyZXMuc2V0KHByb3AsIHRoaXMuX19maW5pc2hlZCA/IHZhbCA6IEFVVE9fU1RZTEUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdGhpcy5jdXJyZW50U25hcHNob3QgPSBjYXB0dXJlcztcbiAgfVxufVxuIl19
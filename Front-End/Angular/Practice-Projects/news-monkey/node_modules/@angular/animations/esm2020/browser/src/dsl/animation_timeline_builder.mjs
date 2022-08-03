/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { AUTO_STYLE, ɵPRE_STYLE as PRE_STYLE } from '@angular/animations';
import { invalidQuery } from '../error_helpers';
import { copyStyles, interpolateParams, iteratorToArray, resolveTiming, resolveTimingValue, visitDslNode } from '../util';
import { createTimelineInstruction } from './animation_timeline_instruction';
import { ElementInstructionMap } from './element_instruction_map';
const ONE_FRAME_IN_MILLISECONDS = 1;
const ENTER_TOKEN = ':enter';
const ENTER_TOKEN_REGEX = new RegExp(ENTER_TOKEN, 'g');
const LEAVE_TOKEN = ':leave';
const LEAVE_TOKEN_REGEX = new RegExp(LEAVE_TOKEN, 'g');
/*
 * The code within this file aims to generate web-animations-compatible keyframes from Angular's
 * animation DSL code.
 *
 * The code below will be converted from:
 *
 * ```
 * sequence([
 *   style({ opacity: 0 }),
 *   animate(1000, style({ opacity: 0 }))
 * ])
 * ```
 *
 * To:
 * ```
 * keyframes = [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }]
 * duration = 1000
 * delay = 0
 * easing = ''
 * ```
 *
 * For this operation to cover the combination of animation verbs (style, animate, group, etc...) a
 * combination of AST traversal and merge-sort-like algorithms are used.
 *
 * [AST Traversal]
 * Each of the animation verbs, when executed, will return an string-map object representing what
 * type of action it is (style, animate, group, etc...) and the data associated with it. This means
 * that when functional composition mix of these functions is evaluated (like in the example above)
 * then it will end up producing a tree of objects representing the animation itself.
 *
 * When this animation object tree is processed by the visitor code below it will visit each of the
 * verb statements within the visitor. And during each visit it will build the context of the
 * animation keyframes by interacting with the `TimelineBuilder`.
 *
 * [TimelineBuilder]
 * This class is responsible for tracking the styles and building a series of keyframe objects for a
 * timeline between a start and end time. The builder starts off with an initial timeline and each
 * time the AST comes across a `group()`, `keyframes()` or a combination of the two within a
 * `sequence()` then it will generate a sub timeline for each step as well as a new one after
 * they are complete.
 *
 * As the AST is traversed, the timing state on each of the timelines will be incremented. If a sub
 * timeline was created (based on one of the cases above) then the parent timeline will attempt to
 * merge the styles used within the sub timelines into itself (only with group() this will happen).
 * This happens with a merge operation (much like how the merge works in mergeSort) and it will only
 * copy the most recently used styles from the sub timelines into the parent timeline. This ensures
 * that if the styles are used later on in another phase of the animation then they will be the most
 * up-to-date values.
 *
 * [How Missing Styles Are Updated]
 * Each timeline has a `backFill` property which is responsible for filling in new styles into
 * already processed keyframes if a new style shows up later within the animation sequence.
 *
 * ```
 * sequence([
 *   style({ width: 0 }),
 *   animate(1000, style({ width: 100 })),
 *   animate(1000, style({ width: 200 })),
 *   animate(1000, style({ width: 300 }))
 *   animate(1000, style({ width: 400, height: 400 })) // notice how `height` doesn't exist anywhere
 * else
 * ])
 * ```
 *
 * What is happening here is that the `height` value is added later in the sequence, but is missing
 * from all previous animation steps. Therefore when a keyframe is created it would also be missing
 * from all previous keyframes up until where it is first used. For the timeline keyframe generation
 * to properly fill in the style it will place the previous value (the value from the parent
 * timeline) or a default value of `*` into the backFill map. The `copyStyles` method in util.ts
 * handles propagating that backfill map to the styles object.
 *
 * When a sub-timeline is created it will have its own backFill property. This is done so that
 * styles present within the sub-timeline do not accidentally seep into the previous/future timeline
 * keyframes
 *
 * [Validation]
 * The code in this file is not responsible for validation. That functionality happens with within
 * the `AnimationValidatorVisitor` code.
 */
export function buildAnimationTimelines(driver, rootElement, ast, enterClassName, leaveClassName, startingStyles = new Map(), finalStyles = new Map(), options, subInstructions, errors = []) {
    return new AnimationTimelineBuilderVisitor().buildKeyframes(driver, rootElement, ast, enterClassName, leaveClassName, startingStyles, finalStyles, options, subInstructions, errors);
}
export class AnimationTimelineBuilderVisitor {
    buildKeyframes(driver, rootElement, ast, enterClassName, leaveClassName, startingStyles, finalStyles, options, subInstructions, errors = []) {
        subInstructions = subInstructions || new ElementInstructionMap();
        const context = new AnimationTimelineContext(driver, rootElement, subInstructions, enterClassName, leaveClassName, errors, []);
        context.options = options;
        const delay = options.delay ? resolveTimingValue(options.delay) : 0;
        context.currentTimeline.delayNextStep(delay);
        context.currentTimeline.setStyles([startingStyles], null, context.errors, options);
        visitDslNode(this, ast, context);
        // this checks to see if an actual animation happened
        const timelines = context.timelines.filter(timeline => timeline.containsAnimation());
        // note: we just want to apply the final styles for the rootElement, so we do not
        //       just apply the styles to the last timeline but the last timeline which
        //       element is the root one (basically `*`-styles are replaced with the actual
        //       state style values only for the root element)
        if (timelines.length && finalStyles.size) {
            let lastRootTimeline;
            for (let i = timelines.length - 1; i >= 0; i--) {
                const timeline = timelines[i];
                if (timeline.element === rootElement) {
                    lastRootTimeline = timeline;
                    break;
                }
            }
            if (lastRootTimeline && !lastRootTimeline.allowOnlyTimelineStyles()) {
                lastRootTimeline.setStyles([finalStyles], null, context.errors, options);
            }
        }
        return timelines.length ?
            timelines.map(timeline => timeline.buildKeyframes()) :
            [createTimelineInstruction(rootElement, [], [], [], 0, delay, '', false)];
    }
    visitTrigger(ast, context) {
        // these values are not visited in this AST
    }
    visitState(ast, context) {
        // these values are not visited in this AST
    }
    visitTransition(ast, context) {
        // these values are not visited in this AST
    }
    visitAnimateChild(ast, context) {
        const elementInstructions = context.subInstructions.get(context.element);
        if (elementInstructions) {
            const innerContext = context.createSubContext(ast.options);
            const startTime = context.currentTimeline.currentTime;
            const endTime = this._visitSubInstructions(elementInstructions, innerContext, innerContext.options);
            if (startTime != endTime) {
                // we do this on the upper context because we created a sub context for
                // the sub child animations
                context.transformIntoNewTimeline(endTime);
            }
        }
        context.previousNode = ast;
    }
    visitAnimateRef(ast, context) {
        const innerContext = context.createSubContext(ast.options);
        innerContext.transformIntoNewTimeline();
        this.visitReference(ast.animation, innerContext);
        context.transformIntoNewTimeline(innerContext.currentTimeline.currentTime);
        context.previousNode = ast;
    }
    _visitSubInstructions(instructions, context, options) {
        const startTime = context.currentTimeline.currentTime;
        let furthestTime = startTime;
        // this is a special-case for when a user wants to skip a sub
        // animation from being fired entirely.
        const duration = options.duration != null ? resolveTimingValue(options.duration) : null;
        const delay = options.delay != null ? resolveTimingValue(options.delay) : null;
        if (duration !== 0) {
            instructions.forEach(instruction => {
                const instructionTimings = context.appendInstructionToTimeline(instruction, duration, delay);
                furthestTime =
                    Math.max(furthestTime, instructionTimings.duration + instructionTimings.delay);
            });
        }
        return furthestTime;
    }
    visitReference(ast, context) {
        context.updateOptions(ast.options, true);
        visitDslNode(this, ast.animation, context);
        context.previousNode = ast;
    }
    visitSequence(ast, context) {
        const subContextCount = context.subContextCount;
        let ctx = context;
        const options = ast.options;
        if (options && (options.params || options.delay)) {
            ctx = context.createSubContext(options);
            ctx.transformIntoNewTimeline();
            if (options.delay != null) {
                if (ctx.previousNode.type == 6 /* AnimationMetadataType.Style */) {
                    ctx.currentTimeline.snapshotCurrentStyles();
                    ctx.previousNode = DEFAULT_NOOP_PREVIOUS_NODE;
                }
                const delay = resolveTimingValue(options.delay);
                ctx.delayNextStep(delay);
            }
        }
        if (ast.steps.length) {
            ast.steps.forEach(s => visitDslNode(this, s, ctx));
            // this is here just in case the inner steps only contain or end with a style() call
            ctx.currentTimeline.applyStylesToKeyframe();
            // this means that some animation function within the sequence
            // ended up creating a sub timeline (which means the current
            // timeline cannot overlap with the contents of the sequence)
            if (ctx.subContextCount > subContextCount) {
                ctx.transformIntoNewTimeline();
            }
        }
        context.previousNode = ast;
    }
    visitGroup(ast, context) {
        const innerTimelines = [];
        let furthestTime = context.currentTimeline.currentTime;
        const delay = ast.options && ast.options.delay ? resolveTimingValue(ast.options.delay) : 0;
        ast.steps.forEach(s => {
            const innerContext = context.createSubContext(ast.options);
            if (delay) {
                innerContext.delayNextStep(delay);
            }
            visitDslNode(this, s, innerContext);
            furthestTime = Math.max(furthestTime, innerContext.currentTimeline.currentTime);
            innerTimelines.push(innerContext.currentTimeline);
        });
        // this operation is run after the AST loop because otherwise
        // if the parent timeline's collected styles were updated then
        // it would pass in invalid data into the new-to-be forked items
        innerTimelines.forEach(timeline => context.currentTimeline.mergeTimelineCollectedStyles(timeline));
        context.transformIntoNewTimeline(furthestTime);
        context.previousNode = ast;
    }
    _visitTiming(ast, context) {
        if (ast.dynamic) {
            const strValue = ast.strValue;
            const timingValue = context.params ? interpolateParams(strValue, context.params, context.errors) : strValue;
            return resolveTiming(timingValue, context.errors);
        }
        else {
            return { duration: ast.duration, delay: ast.delay, easing: ast.easing };
        }
    }
    visitAnimate(ast, context) {
        const timings = context.currentAnimateTimings = this._visitTiming(ast.timings, context);
        const timeline = context.currentTimeline;
        if (timings.delay) {
            context.incrementTime(timings.delay);
            timeline.snapshotCurrentStyles();
        }
        const style = ast.style;
        if (style.type == 5 /* AnimationMetadataType.Keyframes */) {
            this.visitKeyframes(style, context);
        }
        else {
            context.incrementTime(timings.duration);
            this.visitStyle(style, context);
            timeline.applyStylesToKeyframe();
        }
        context.currentAnimateTimings = null;
        context.previousNode = ast;
    }
    visitStyle(ast, context) {
        const timeline = context.currentTimeline;
        const timings = context.currentAnimateTimings;
        // this is a special case for when a style() call
        // directly follows  an animate() call (but not inside of an animate() call)
        if (!timings && timeline.hasCurrentStyleProperties()) {
            timeline.forwardFrame();
        }
        const easing = (timings && timings.easing) || ast.easing;
        if (ast.isEmptyStep) {
            timeline.applyEmptyStep(easing);
        }
        else {
            timeline.setStyles(ast.styles, easing, context.errors, context.options);
        }
        context.previousNode = ast;
    }
    visitKeyframes(ast, context) {
        const currentAnimateTimings = context.currentAnimateTimings;
        const startTime = (context.currentTimeline).duration;
        const duration = currentAnimateTimings.duration;
        const innerContext = context.createSubContext();
        const innerTimeline = innerContext.currentTimeline;
        innerTimeline.easing = currentAnimateTimings.easing;
        ast.styles.forEach(step => {
            const offset = step.offset || 0;
            innerTimeline.forwardTime(offset * duration);
            innerTimeline.setStyles(step.styles, step.easing, context.errors, context.options);
            innerTimeline.applyStylesToKeyframe();
        });
        // this will ensure that the parent timeline gets all the styles from
        // the child even if the new timeline below is not used
        context.currentTimeline.mergeTimelineCollectedStyles(innerTimeline);
        // we do this because the window between this timeline and the sub timeline
        // should ensure that the styles within are exactly the same as they were before
        context.transformIntoNewTimeline(startTime + duration);
        context.previousNode = ast;
    }
    visitQuery(ast, context) {
        // in the event that the first step before this is a style step we need
        // to ensure the styles are applied before the children are animated
        const startTime = context.currentTimeline.currentTime;
        const options = (ast.options || {});
        const delay = options.delay ? resolveTimingValue(options.delay) : 0;
        if (delay &&
            (context.previousNode.type === 6 /* AnimationMetadataType.Style */ ||
                (startTime == 0 && context.currentTimeline.hasCurrentStyleProperties()))) {
            context.currentTimeline.snapshotCurrentStyles();
            context.previousNode = DEFAULT_NOOP_PREVIOUS_NODE;
        }
        let furthestTime = startTime;
        const elms = context.invokeQuery(ast.selector, ast.originalSelector, ast.limit, ast.includeSelf, options.optional ? true : false, context.errors);
        context.currentQueryTotal = elms.length;
        let sameElementTimeline = null;
        elms.forEach((element, i) => {
            context.currentQueryIndex = i;
            const innerContext = context.createSubContext(ast.options, element);
            if (delay) {
                innerContext.delayNextStep(delay);
            }
            if (element === context.element) {
                sameElementTimeline = innerContext.currentTimeline;
            }
            visitDslNode(this, ast.animation, innerContext);
            // this is here just incase the inner steps only contain or end
            // with a style() call (which is here to signal that this is a preparatory
            // call to style an element before it is animated again)
            innerContext.currentTimeline.applyStylesToKeyframe();
            const endTime = innerContext.currentTimeline.currentTime;
            furthestTime = Math.max(furthestTime, endTime);
        });
        context.currentQueryIndex = 0;
        context.currentQueryTotal = 0;
        context.transformIntoNewTimeline(furthestTime);
        if (sameElementTimeline) {
            context.currentTimeline.mergeTimelineCollectedStyles(sameElementTimeline);
            context.currentTimeline.snapshotCurrentStyles();
        }
        context.previousNode = ast;
    }
    visitStagger(ast, context) {
        const parentContext = context.parentContext;
        const tl = context.currentTimeline;
        const timings = ast.timings;
        const duration = Math.abs(timings.duration);
        const maxTime = duration * (context.currentQueryTotal - 1);
        let delay = duration * context.currentQueryIndex;
        let staggerTransformer = timings.duration < 0 ? 'reverse' : timings.easing;
        switch (staggerTransformer) {
            case 'reverse':
                delay = maxTime - delay;
                break;
            case 'full':
                delay = parentContext.currentStaggerTime;
                break;
        }
        const timeline = context.currentTimeline;
        if (delay) {
            timeline.delayNextStep(delay);
        }
        const startingTime = timeline.currentTime;
        visitDslNode(this, ast.animation, context);
        context.previousNode = ast;
        // time = duration + delay
        // the reason why this computation is so complex is because
        // the inner timeline may either have a delay value or a stretched
        // keyframe depending on if a subtimeline is not used or is used.
        parentContext.currentStaggerTime =
            (tl.currentTime - startingTime) + (tl.startTime - parentContext.currentTimeline.startTime);
    }
}
const DEFAULT_NOOP_PREVIOUS_NODE = {};
export class AnimationTimelineContext {
    constructor(_driver, element, subInstructions, _enterClassName, _leaveClassName, errors, timelines, initialTimeline) {
        this._driver = _driver;
        this.element = element;
        this.subInstructions = subInstructions;
        this._enterClassName = _enterClassName;
        this._leaveClassName = _leaveClassName;
        this.errors = errors;
        this.timelines = timelines;
        this.parentContext = null;
        this.currentAnimateTimings = null;
        this.previousNode = DEFAULT_NOOP_PREVIOUS_NODE;
        this.subContextCount = 0;
        this.options = {};
        this.currentQueryIndex = 0;
        this.currentQueryTotal = 0;
        this.currentStaggerTime = 0;
        this.currentTimeline = initialTimeline || new TimelineBuilder(this._driver, element, 0);
        timelines.push(this.currentTimeline);
    }
    get params() {
        return this.options.params;
    }
    updateOptions(options, skipIfExists) {
        if (!options)
            return;
        const newOptions = options;
        let optionsToUpdate = this.options;
        // NOTE: this will get patched up when other animation methods support duration overrides
        if (newOptions.duration != null) {
            optionsToUpdate.duration = resolveTimingValue(newOptions.duration);
        }
        if (newOptions.delay != null) {
            optionsToUpdate.delay = resolveTimingValue(newOptions.delay);
        }
        const newParams = newOptions.params;
        if (newParams) {
            let paramsToUpdate = optionsToUpdate.params;
            if (!paramsToUpdate) {
                paramsToUpdate = this.options.params = {};
            }
            Object.keys(newParams).forEach(name => {
                if (!skipIfExists || !paramsToUpdate.hasOwnProperty(name)) {
                    paramsToUpdate[name] = interpolateParams(newParams[name], paramsToUpdate, this.errors);
                }
            });
        }
    }
    _copyOptions() {
        const options = {};
        if (this.options) {
            const oldParams = this.options.params;
            if (oldParams) {
                const params = options['params'] = {};
                Object.keys(oldParams).forEach(name => {
                    params[name] = oldParams[name];
                });
            }
        }
        return options;
    }
    createSubContext(options = null, element, newTime) {
        const target = element || this.element;
        const context = new AnimationTimelineContext(this._driver, target, this.subInstructions, this._enterClassName, this._leaveClassName, this.errors, this.timelines, this.currentTimeline.fork(target, newTime || 0));
        context.previousNode = this.previousNode;
        context.currentAnimateTimings = this.currentAnimateTimings;
        context.options = this._copyOptions();
        context.updateOptions(options);
        context.currentQueryIndex = this.currentQueryIndex;
        context.currentQueryTotal = this.currentQueryTotal;
        context.parentContext = this;
        this.subContextCount++;
        return context;
    }
    transformIntoNewTimeline(newTime) {
        this.previousNode = DEFAULT_NOOP_PREVIOUS_NODE;
        this.currentTimeline = this.currentTimeline.fork(this.element, newTime);
        this.timelines.push(this.currentTimeline);
        return this.currentTimeline;
    }
    appendInstructionToTimeline(instruction, duration, delay) {
        const updatedTimings = {
            duration: duration != null ? duration : instruction.duration,
            delay: this.currentTimeline.currentTime + (delay != null ? delay : 0) + instruction.delay,
            easing: ''
        };
        const builder = new SubTimelineBuilder(this._driver, instruction.element, instruction.keyframes, instruction.preStyleProps, instruction.postStyleProps, updatedTimings, instruction.stretchStartingKeyframe);
        this.timelines.push(builder);
        return updatedTimings;
    }
    incrementTime(time) {
        this.currentTimeline.forwardTime(this.currentTimeline.duration + time);
    }
    delayNextStep(delay) {
        // negative delays are not yet supported
        if (delay > 0) {
            this.currentTimeline.delayNextStep(delay);
        }
    }
    invokeQuery(selector, originalSelector, limit, includeSelf, optional, errors) {
        let results = [];
        if (includeSelf) {
            results.push(this.element);
        }
        if (selector.length > 0) { // only if :self is used then the selector can be empty
            selector = selector.replace(ENTER_TOKEN_REGEX, '.' + this._enterClassName);
            selector = selector.replace(LEAVE_TOKEN_REGEX, '.' + this._leaveClassName);
            const multi = limit != 1;
            let elements = this._driver.query(this.element, selector, multi);
            if (limit !== 0) {
                elements = limit < 0 ? elements.slice(elements.length + limit, elements.length) :
                    elements.slice(0, limit);
            }
            results.push(...elements);
        }
        if (!optional && results.length == 0) {
            errors.push(invalidQuery(originalSelector));
        }
        return results;
    }
}
export class TimelineBuilder {
    constructor(_driver, element, startTime, _elementTimelineStylesLookup) {
        this._driver = _driver;
        this.element = element;
        this.startTime = startTime;
        this._elementTimelineStylesLookup = _elementTimelineStylesLookup;
        this.duration = 0;
        this._previousKeyframe = new Map();
        this._currentKeyframe = new Map();
        this._keyframes = new Map();
        this._styleSummary = new Map();
        this._localTimelineStyles = new Map();
        this._pendingStyles = new Map();
        this._backFill = new Map();
        this._currentEmptyStepKeyframe = null;
        if (!this._elementTimelineStylesLookup) {
            this._elementTimelineStylesLookup = new Map();
        }
        this._globalTimelineStyles = this._elementTimelineStylesLookup.get(element);
        if (!this._globalTimelineStyles) {
            this._globalTimelineStyles = this._localTimelineStyles;
            this._elementTimelineStylesLookup.set(element, this._localTimelineStyles);
        }
        this._loadKeyframe();
    }
    containsAnimation() {
        switch (this._keyframes.size) {
            case 0:
                return false;
            case 1:
                return this.hasCurrentStyleProperties();
            default:
                return true;
        }
    }
    hasCurrentStyleProperties() {
        return this._currentKeyframe.size > 0;
    }
    get currentTime() {
        return this.startTime + this.duration;
    }
    delayNextStep(delay) {
        // in the event that a style() step is placed right before a stagger()
        // and that style() step is the very first style() value in the animation
        // then we need to make a copy of the keyframe [0, copy, 1] so that the delay
        // properly applies the style() values to work with the stagger...
        const hasPreStyleStep = this._keyframes.size === 1 && this._pendingStyles.size;
        if (this.duration || hasPreStyleStep) {
            this.forwardTime(this.currentTime + delay);
            if (hasPreStyleStep) {
                this.snapshotCurrentStyles();
            }
        }
        else {
            this.startTime += delay;
        }
    }
    fork(element, currentTime) {
        this.applyStylesToKeyframe();
        return new TimelineBuilder(this._driver, element, currentTime || this.currentTime, this._elementTimelineStylesLookup);
    }
    _loadKeyframe() {
        if (this._currentKeyframe) {
            this._previousKeyframe = this._currentKeyframe;
        }
        this._currentKeyframe = this._keyframes.get(this.duration);
        if (!this._currentKeyframe) {
            this._currentKeyframe = new Map();
            this._keyframes.set(this.duration, this._currentKeyframe);
        }
    }
    forwardFrame() {
        this.duration += ONE_FRAME_IN_MILLISECONDS;
        this._loadKeyframe();
    }
    forwardTime(time) {
        this.applyStylesToKeyframe();
        this.duration = time;
        this._loadKeyframe();
    }
    _updateStyle(prop, value) {
        this._localTimelineStyles.set(prop, value);
        this._globalTimelineStyles.set(prop, value);
        this._styleSummary.set(prop, { time: this.currentTime, value });
    }
    allowOnlyTimelineStyles() {
        return this._currentEmptyStepKeyframe !== this._currentKeyframe;
    }
    applyEmptyStep(easing) {
        if (easing) {
            this._previousKeyframe.set('easing', easing);
        }
        // special case for animate(duration):
        // all missing styles are filled with a `*` value then
        // if any destination styles are filled in later on the same
        // keyframe then they will override the overridden styles
        // We use `_globalTimelineStyles` here because there may be
        // styles in previous keyframes that are not present in this timeline
        for (let [prop, value] of this._globalTimelineStyles) {
            this._backFill.set(prop, value || AUTO_STYLE);
            this._currentKeyframe.set(prop, AUTO_STYLE);
        }
        this._currentEmptyStepKeyframe = this._currentKeyframe;
    }
    setStyles(input, easing, errors, options) {
        if (easing) {
            this._previousKeyframe.set('easing', easing);
        }
        const params = (options && options.params) || {};
        const styles = flattenStyles(input, this._globalTimelineStyles);
        for (let [prop, value] of styles) {
            const val = interpolateParams(value, params, errors);
            this._pendingStyles.set(prop, val);
            if (!this._localTimelineStyles.has(prop)) {
                this._backFill.set(prop, this._globalTimelineStyles.get(prop) ?? AUTO_STYLE);
            }
            this._updateStyle(prop, val);
        }
    }
    applyStylesToKeyframe() {
        if (this._pendingStyles.size == 0)
            return;
        this._pendingStyles.forEach((val, prop) => {
            this._currentKeyframe.set(prop, val);
        });
        this._pendingStyles.clear();
        this._localTimelineStyles.forEach((val, prop) => {
            if (!this._currentKeyframe.has(prop)) {
                this._currentKeyframe.set(prop, val);
            }
        });
    }
    snapshotCurrentStyles() {
        for (let [prop, val] of this._localTimelineStyles) {
            this._pendingStyles.set(prop, val);
            this._updateStyle(prop, val);
        }
    }
    getFinalKeyframe() {
        return this._keyframes.get(this.duration);
    }
    get properties() {
        const properties = [];
        for (let prop in this._currentKeyframe) {
            properties.push(prop);
        }
        return properties;
    }
    mergeTimelineCollectedStyles(timeline) {
        timeline._styleSummary.forEach((details1, prop) => {
            const details0 = this._styleSummary.get(prop);
            if (!details0 || details1.time > details0.time) {
                this._updateStyle(prop, details1.value);
            }
        });
    }
    buildKeyframes() {
        this.applyStylesToKeyframe();
        const preStyleProps = new Set();
        const postStyleProps = new Set();
        const isEmpty = this._keyframes.size === 1 && this.duration === 0;
        let finalKeyframes = [];
        this._keyframes.forEach((keyframe, time) => {
            const finalKeyframe = copyStyles(keyframe, new Map(), this._backFill);
            finalKeyframe.forEach((value, prop) => {
                if (value === PRE_STYLE) {
                    preStyleProps.add(prop);
                }
                else if (value === AUTO_STYLE) {
                    postStyleProps.add(prop);
                }
            });
            if (!isEmpty) {
                finalKeyframe.set('offset', time / this.duration);
            }
            finalKeyframes.push(finalKeyframe);
        });
        const preProps = preStyleProps.size ? iteratorToArray(preStyleProps.values()) : [];
        const postProps = postStyleProps.size ? iteratorToArray(postStyleProps.values()) : [];
        // special case for a 0-second animation (which is designed just to place styles onscreen)
        if (isEmpty) {
            const kf0 = finalKeyframes[0];
            const kf1 = new Map(kf0);
            kf0.set('offset', 0);
            kf1.set('offset', 1);
            finalKeyframes = [kf0, kf1];
        }
        return createTimelineInstruction(this.element, finalKeyframes, preProps, postProps, this.duration, this.startTime, this.easing, false);
    }
}
class SubTimelineBuilder extends TimelineBuilder {
    constructor(driver, element, keyframes, preStyleProps, postStyleProps, timings, _stretchStartingKeyframe = false) {
        super(driver, element, timings.delay);
        this.keyframes = keyframes;
        this.preStyleProps = preStyleProps;
        this.postStyleProps = postStyleProps;
        this._stretchStartingKeyframe = _stretchStartingKeyframe;
        this.timings = { duration: timings.duration, delay: timings.delay, easing: timings.easing };
    }
    containsAnimation() {
        return this.keyframes.length > 1;
    }
    buildKeyframes() {
        let keyframes = this.keyframes;
        let { delay, duration, easing } = this.timings;
        if (this._stretchStartingKeyframe && delay) {
            const newKeyframes = [];
            const totalTime = duration + delay;
            const startingGap = delay / totalTime;
            // the original starting keyframe now starts once the delay is done
            const newFirstKeyframe = copyStyles(keyframes[0]);
            newFirstKeyframe.set('offset', 0);
            newKeyframes.push(newFirstKeyframe);
            const oldFirstKeyframe = copyStyles(keyframes[0]);
            oldFirstKeyframe.set('offset', roundOffset(startingGap));
            newKeyframes.push(oldFirstKeyframe);
            /*
              When the keyframe is stretched then it means that the delay before the animation
              starts is gone. Instead the first keyframe is placed at the start of the animation
              and it is then copied to where it starts when the original delay is over. This basically
              means nothing animates during that delay, but the styles are still rendered. For this
              to work the original offset values that exist in the original keyframes must be "warped"
              so that they can take the new keyframe + delay into account.
      
              delay=1000, duration=1000, keyframes = 0 .5 1
      
              turns into
      
              delay=0, duration=2000, keyframes = 0 .33 .66 1
             */
            // offsets between 1 ... n -1 are all warped by the keyframe stretch
            const limit = keyframes.length - 1;
            for (let i = 1; i <= limit; i++) {
                let kf = copyStyles(keyframes[i]);
                const oldOffset = kf.get('offset');
                const timeAtKeyframe = delay + oldOffset * duration;
                kf.set('offset', roundOffset(timeAtKeyframe / totalTime));
                newKeyframes.push(kf);
            }
            // the new starting keyframe should be added at the start
            duration = totalTime;
            delay = 0;
            easing = '';
            keyframes = newKeyframes;
        }
        return createTimelineInstruction(this.element, keyframes, this.preStyleProps, this.postStyleProps, duration, delay, easing, true);
    }
}
function roundOffset(offset, decimalPoints = 3) {
    const mult = Math.pow(10, decimalPoints - 1);
    return Math.round(offset * mult) / mult;
}
function flattenStyles(input, allStyles) {
    const styles = new Map();
    let allProperties;
    input.forEach(token => {
        if (token === '*') {
            allProperties = allProperties || allStyles.keys();
            for (let prop of allProperties) {
                styles.set(prop, AUTO_STYLE);
            }
        }
        else {
            copyStyles(token, styles);
        }
    });
    return styles;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5pbWF0aW9uX3RpbWVsaW5lX2J1aWxkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmltYXRpb25zL2Jyb3dzZXIvc3JjL2RzbC9hbmltYXRpb25fdGltZWxpbmVfYnVpbGRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFDSCxPQUFPLEVBQXNHLFVBQVUsRUFBRSxVQUFVLElBQUksU0FBUyxFQUFnQixNQUFNLHFCQUFxQixDQUFDO0FBRTVMLE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUU5QyxPQUFPLEVBQUMsVUFBVSxFQUFFLGlCQUFpQixFQUFFLGVBQWUsRUFBRSxhQUFhLEVBQUUsa0JBQWtCLEVBQUUsWUFBWSxFQUFDLE1BQU0sU0FBUyxDQUFDO0FBR3hILE9BQU8sRUFBK0IseUJBQXlCLEVBQUMsTUFBTSxrQ0FBa0MsQ0FBQztBQUN6RyxPQUFPLEVBQUMscUJBQXFCLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUVoRSxNQUFNLHlCQUF5QixHQUFHLENBQUMsQ0FBQztBQUNwQyxNQUFNLFdBQVcsR0FBRyxRQUFRLENBQUM7QUFDN0IsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxXQUFXLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDdkQsTUFBTSxXQUFXLEdBQUcsUUFBUSxDQUFDO0FBQzdCLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxNQUFNLENBQUMsV0FBVyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBRXZEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0E4RUc7QUFDSCxNQUFNLFVBQVUsdUJBQXVCLENBQ25DLE1BQXVCLEVBQUUsV0FBZ0IsRUFBRSxHQUErQixFQUMxRSxjQUFzQixFQUFFLGNBQXNCLEVBQUUsaUJB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QUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQ3BCLElBQUksS0FBSyxLQUFLLEdBQUcsRUFBRTtZQUNqQixhQUFhLEdBQUcsYUFBYSxJQUFJLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNsRCxLQUFLLElBQUksSUFBSSxJQUFJLGFBQWEsRUFBRTtnQkFDOUIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7YUFDOUI7U0FDRjthQUFNO1lBQ0wsVUFBVSxDQUFDLEtBQXNCLEVBQUUsTUFBTSxDQUFDLENBQUM7U0FDNUM7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUNILE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7QW5pbWF0ZUNoaWxkT3B0aW9ucywgQW5pbWF0ZVRpbWluZ3MsIEFuaW1hdGlvbk1ldGFkYXRhVHlwZSwgQW5pbWF0aW9uT3B0aW9ucywgQW5pbWF0aW9uUXVlcnlPcHRpb25zLCBBVVRPX1NUWUxFLCDJtVBSRV9TVFlMRSBhcyBQUkVfU1RZTEUsIMm1U3R5bGVEYXRhTWFwfSBmcm9tICdAYW5ndWxhci9hbmltYXRpb25zJztcblxuaW1wb3J0IHtpbnZhbGlkUXVlcnl9IGZyb20gJy4uL2Vycm9yX2hlbHBlcnMnO1xuaW1wb3J0IHtBbmltYXRpb25Ecml2ZXJ9IGZyb20gJy4uL3JlbmRlci9hbmltYXRpb25fZHJpdmVyJztcbmltcG9ydCB7Y29weVN0eWxlcywgaW50ZXJwb2xhdGVQYXJhbXMsIGl0ZXJhdG9yVG9BcnJheSwgcmVzb2x2ZVRpbWluZywgcmVzb2x2ZVRpbWluZ1ZhbHVlLCB2aXNpdERzbE5vZGV9IGZyb20gJy4uL3V0aWwnO1xuXG5pbXBvcnQge0FuaW1hdGVBc3QsIEFuaW1hdGVDaGlsZEFzdCwgQW5pbWF0ZVJlZkFzdCwgQXN0LCBBc3RWaXNpdG9yLCBEeW5hbWljVGltaW5nQXN0LCBHcm91cEFzdCwgS2V5ZnJhbWVzQXN0LCBRdWVyeUFzdCwgUmVmZXJlbmNlQXN0LCBTZXF1ZW5jZUFzdCwgU3RhZ2dlckFzdCwgU3RhdGVBc3QsIFN0eWxlQXN0LCBUaW1pbmdBc3QsIFRyYW5zaXRpb25Bc3QsIFRyaWdnZXJBc3R9IGZyb20gJy4vYW5pbWF0aW9uX2FzdCc7XG5pbXBvcnQge0FuaW1hdGlvblRpbWVsaW5lSW5zdHJ1Y3Rpb24sIGNyZWF0ZVRpbWVsaW5lSW5zdHJ1Y3Rpb259IGZyb20gJy4vYW5pbWF0aW9uX3RpbWVsaW5lX2luc3RydWN0aW9uJztcbmltcG9ydCB7RWxlbWVudEluc3RydWN0aW9uTWFwfSBmcm9tICcuL2VsZW1lbnRfaW5zdHJ1Y3Rpb25fbWFwJztcblxuY29uc3QgT05FX0ZSQU1FX0lOX01JTExJU0VDT05EUyA9IDE7XG5jb25zdCBFTlRFUl9UT0tFTiA9ICc6ZW50ZXInO1xuY29uc3QgRU5URVJfVE9LRU5fUkVHRVggPSBuZXcgUmVnRXhwKEVOVEVSX1RPS0VOLCAnZycpO1xuY29uc3QgTEVBVkVfVE9LRU4gPSAnOmxlYXZlJztcbmNvbnN0IExFQVZFX1RPS0VOX1JFR0VYID0gbmV3IFJlZ0V4cChMRUFWRV9UT0tFTiwgJ2cnKTtcblxuLypcbiAqIFRoZSBjb2RlIHdpdGhpbiB0aGlzIGZpbGUgYWltcyB0byBnZW5lcmF0ZSB3ZWItYW5pbWF0aW9ucy1jb21wYXRpYmxlIGtleWZyYW1lcyBmcm9tIEFuZ3VsYXInc1xuICogYW5pbWF0aW9uIERTTCBjb2RlLlxuICpcbiAqIFRoZSBjb2RlIGJlbG93IHdpbGwgYmUgY29udmVydGVkIGZyb206XG4gKlxuICogYGBgXG4gKiBzZXF1ZW5jZShbXG4gKiAgIHN0eWxlKHsgb3BhY2l0eTogMCB9KSxcbiAqICAgYW5pbWF0ZSgxMDAwLCBzdHlsZSh7IG9wYWNpdHk6IDAgfSkpXG4gKiBdKVxuICogYGBgXG4gKlxuICogVG86XG4gKiBgYGBcbiAqIGtleWZyYW1lcyA9IFt7IG9wYWNpdHk6IDAsIG9mZnNldDogMCB9LCB7IG9wYWNpdHk6IDEsIG9mZnNldDogMSB9XVxuICogZHVyYXRpb24gPSAxMDAwXG4gKiBkZWxheSA9IDBcbiAqIGVhc2luZyA9ICcnXG4gKiBgYGBcbiAqXG4gKiBGb3IgdGhpcyBvcGVyYXRpb24gdG8gY292ZXIgdGhlIGNvbWJpbmF0aW9uIG9mIGFuaW1hdGlvbiB2ZXJicyAoc3R5bGUsIGFuaW1hdGUsIGdyb3VwLCBldGMuLi4pIGFcbiAqIGNvbWJpbmF0aW9uIG9mIEFTVCB0cmF2ZXJzYWwgYW5kIG1lcmdlLXNvcnQtbGlrZSBhbGdvcml0aG1zIGFyZSB1c2VkLlxuICpcbiAqIFtBU1QgVHJhdmVyc2FsXVxuICogRWFjaCBvZiB0aGUgYW5pbWF0aW9uIHZlcmJzLCB3aGVuIGV4ZWN1dGVkLCB3aWxsIHJldHVybiBhbiBzdHJpbmctbWFwIG9iamVjdCByZXByZXNlbnRpbmcgd2hhdFxuICogdHlwZSBvZiBhY3Rpb24gaXQgaXMgKHN0eWxlLCBhbmltYXRlLCBncm91cCwgZXRjLi4uKSBhbmQgdGhlIGRhdGEgYXNzb2NpYXRlZCB3aXRoIGl0LiBUaGlzIG1lYW5zXG4gKiB0aGF0IHdoZW4gZnVuY3Rpb25hbCBjb21wb3NpdGlvbiBtaXggb2YgdGhlc2UgZnVuY3Rpb25zIGlzIGV2YWx1YXRlZCAobGlrZSBpbiB0aGUgZXhhbXBsZSBhYm92ZSlcbiAqIHRoZW4gaXQgd2lsbCBlbmQgdXAgcHJvZHVjaW5nIGEgdHJlZSBvZiBvYmplY3RzIHJlcHJlc2VudGluZyB0aGUgYW5pbWF0aW9uIGl0c2VsZi5cbiAqXG4gKiBXaGVuIHRoaXMgYW5pbWF0aW9uIG9iamVjdCB0cmVlIGlzIHByb2Nlc3NlZCBieSB0aGUgdmlzaXRvciBjb2RlIGJlbG93IGl0IHdpbGwgdmlzaXQgZWFjaCBvZiB0aGVcbiAqIHZlcmIgc3RhdGVtZW50cyB3aXRoaW4gdGhlIHZpc2l0b3IuIEFuZCBkdXJpbmcgZWFjaCB2aXNpdCBpdCB3aWxsIGJ1aWxkIHRoZSBjb250ZXh0IG9mIHRoZVxuICogYW5pbWF0aW9uIGtleWZyYW1lcyBieSBpbnRlcmFjdGluZyB3aXRoIHRoZSBgVGltZWxpbmVCdWlsZGVyYC5cbiAqXG4gKiBbVGltZWxpbmVCdWlsZGVyXVxuICogVGhpcyBjbGFzcyBpcyByZXNwb25zaWJsZSBmb3IgdHJhY2tpbmcgdGhlIHN0eWxlcyBhbmQgYnVpbGRpbmcgYSBzZXJpZXMgb2Yga2V5ZnJhbWUgb2JqZWN0cyBmb3IgYVxuICogdGltZWxpbmUgYmV0d2VlbiBhIHN0YXJ0IGFuZCBlbmQgdGltZS4gVGhlIGJ1aWxkZXIgc3RhcnRzIG9mZiB3aXRoIGFuIGluaXRpYWwgdGltZWxpbmUgYW5kIGVhY2hcbiAqIHRpbWUgdGhlIEFTVCBjb21lcyBhY3Jvc3MgYSBgZ3JvdXAoKWAsIGBrZXlmcmFtZXMoKWAgb3IgYSBjb21iaW5hdGlvbiBvZiB0aGUgdHdvIHdpdGhpbiBhXG4gKiBgc2VxdWVuY2UoKWAgdGhlbiBpdCB3aWxsIGdlbmVyYXRlIGEgc3ViIHRpbWVsaW5lIGZvciBlYWNoIHN0ZXAgYXMgd2VsbCBhcyBhIG5ldyBvbmUgYWZ0ZXJcbiAqIHRoZXkgYXJlIGNvbXBsZXRlLlxuICpcbiAqIEFzIHRoZSBBU1QgaXMgdHJhdmVyc2VkLCB0aGUgdGltaW5nIHN0YXRlIG9uIGVhY2ggb2YgdGhlIHRpbWVsaW5lcyB3aWxsIGJlIGluY3JlbWVudGVkLiBJZiBhIHN1YlxuICogdGltZWxpbmUgd2FzIGNyZWF0ZWQgKGJhc2VkIG9uIG9uZSBvZiB0aGUgY2FzZXMgYWJvdmUpIHRoZW4gdGhlIHBhcmVudCB0aW1lbGluZSB3aWxsIGF0dGVtcHQgdG9cbiAqIG1lcmdlIHRoZSBzdHlsZXMgdXNlZCB3aXRoaW4gdGhlIHN1YiB0aW1lbGluZXMgaW50byBpdHNlbGYgKG9ubHkgd2l0aCBncm91cCgpIHRoaXMgd2lsbCBoYXBwZW4pLlxuICogVGhpcyBoYXBwZW5zIHdpdGggYSBtZXJnZSBvcGVyYXRpb24gKG11Y2ggbGlrZSBob3cgdGhlIG1lcmdlIHdvcmtzIGluIG1lcmdlU29ydCkgYW5kIGl0IHdpbGwgb25seVxuICogY29weSB0aGUgbW9zdCByZWNlbnRseSB1c2VkIHN0eWxlcyBmcm9tIHRoZSBzdWIgdGltZWxpbmVzIGludG8gdGhlIHBhcmVudCB0aW1lbGluZS4gVGhpcyBlbnN1cmVzXG4gKiB0aGF0IGlmIHRoZSBzdHlsZXMgYXJlIHVzZWQgbGF0ZXIgb24gaW4gYW5vdGhlciBwaGFzZSBvZiB0aGUgYW5pbWF0aW9uIHRoZW4gdGhleSB3aWxsIGJlIHRoZSBtb3N0XG4gKiB1cC10by1kYXRlIHZhbHVlcy5cbiAqXG4gKiBbSG93IE1pc3NpbmcgU3R5bGVzIEFyZSBVcGRhdGVkXVxuICogRWFjaCB0aW1lbGluZSBoYXMgYSBgYmFja0ZpbGxgIHByb3BlcnR5IHdoaWNoIGlzIHJlc3BvbnNpYmxlIGZvciBmaWxsaW5nIGluIG5ldyBzdHlsZXMgaW50b1xuICogYWxyZWFkeSBwcm9jZXNzZWQga2V5ZnJhbWVzIGlmIGEgbmV3IHN0eWxlIHNob3dzIHVwIGxhdGVyIHdpdGhpbiB0aGUgYW5pbWF0aW9uIHNlcXVlbmNlLlxuICpcbiAqIGBgYFxuICogc2VxdWVuY2UoW1xuICogICBzdHlsZSh7IHdpZHRoOiAwIH0pLFxuICogICBhbmltYXRlKDEwMDAsIHN0eWxlKHsgd2lkdGg6IDEwMCB9KSksXG4gKiAgIGFuaW1hdGUoMTAwMCwgc3R5bGUoeyB3aWR0aDogMjAwIH0pKSxcbiAqICAgYW5pbWF0ZSgxMDAwLCBzdHlsZSh7IHdpZHRoOiAzMDAgfSkpXG4gKiAgIGFuaW1hdGUoMTAwMCwgc3R5bGUoeyB3aWR0aDogNDAwLCBoZWlnaHQ6IDQwMCB9KSkgLy8gbm90aWNlIGhvdyBgaGVpZ2h0YCBkb2Vzbid0IGV4aXN0IGFueXdoZXJlXG4gKiBlbHNlXG4gKiBdKVxuICogYGBgXG4gKlxuICogV2hhdCBpcyBoYXBwZW5pbmcgaGVyZSBpcyB0aGF0IHRoZSBgaGVpZ2h0YCB2YWx1ZSBpcyBhZGRlZCBsYXRlciBpbiB0aGUgc2VxdWVuY2UsIGJ1dCBpcyBtaXNzaW5nXG4gKiBmcm9tIGFsbCBwcmV2aW91cyBhbmltYXRpb24gc3RlcHMuIFRoZXJlZm9yZSB3aGVuIGEga2V5ZnJhbWUgaXMgY3JlYXRlZCBpdCB3b3VsZCBhbHNvIGJlIG1pc3NpbmdcbiAqIGZyb20gYWxsIHByZXZpb3VzIGtleWZyYW1lcyB1cCB1bnRpbCB3aGVyZSBpdCBpcyBmaXJzdCB1c2VkLiBGb3IgdGhlIHRpbWVsaW5lIGtleWZyYW1lIGdlbmVyYXRpb25cbiAqIHRvIHByb3Blcmx5IGZpbGwgaW4gdGhlIHN0eWxlIGl0IHdpbGwgcGxhY2UgdGhlIHByZXZpb3VzIHZhbHVlICh0aGUgdmFsdWUgZnJvbSB0aGUgcGFyZW50XG4gKiB0aW1lbGluZSkgb3IgYSBkZWZhdWx0IHZhbHVlIG9mIGAqYCBpbnRvIHRoZSBiYWNrRmlsbCBtYXAuIFRoZSBgY29weVN0eWxlc2AgbWV0aG9kIGluIHV0aWwudHNcbiAqIGhhbmRsZXMgcHJvcGFnYXRpbmcgdGhhdCBiYWNrZmlsbCBtYXAgdG8gdGhlIHN0eWxlcyBvYmplY3QuXG4gKlxuICogV2hlbiBhIHN1Yi10aW1lbGluZSBpcyBjcmVhdGVkIGl0IHdpbGwgaGF2ZSBpdHMgb3duIGJhY2tGaWxsIHByb3BlcnR5LiBUaGlzIGlzIGRvbmUgc28gdGhhdFxuICogc3R5bGVzIHByZXNlbnQgd2l0aGluIHRoZSBzdWItdGltZWxpbmUgZG8gbm90IGFjY2lkZW50YWxseSBzZWVwIGludG8gdGhlIHByZXZpb3VzL2Z1dHVyZSB0aW1lbGluZVxuICoga2V5ZnJhbWVzXG4gKlxuICogW1ZhbGlkYXRpb25dXG4gKiBUaGUgY29kZSBpbiB0aGlzIGZpbGUgaXMgbm90IHJlc3BvbnNpYmxlIGZvciB2YWxpZGF0aW9uLiBUaGF0IGZ1bmN0aW9uYWxpdHkgaGFwcGVucyB3aXRoIHdpdGhpblxuICogdGhlIGBBbmltYXRpb25WYWxpZGF0b3JWaXNpdG9yYCBjb2RlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRBbmltYXRpb25UaW1lbGluZXMoXG4gICAgZHJpdmVyOiBBbmltYXRpb25Ecml2ZXIsIHJvb3RFbGVtZW50OiBhbnksIGFzdDogQXN0PEFuaW1hdGlvbk1ldGFkYXRhVHlwZT4sXG4gICAgZW50ZXJDbGFzc05hbWU6IHN0cmluZywgbGVhdmVDbGFzc05hbWU6IHN0cmluZywgc3RhcnRpbmdTdHlsZXM6IMm1U3R5bGVEYXRhTWFwID0gbmV3IE1hcCgpLFxuICAgIGZpbmFsU3R5bGVzOiDJtVN0eWxlRGF0YU1hcCA9IG5ldyBNYXAoKSwgb3B0aW9uczogQW5pbWF0aW9uT3B0aW9ucyxcbiAgICBzdWJJbnN0cnVjdGlvbnM/OiBFbGVtZW50SW5zdHJ1Y3Rpb25NYXAsIGVycm9yczogRXJyb3JbXSA9IFtdKTogQW5pbWF0aW9uVGltZWxpbmVJbnN0cnVjdGlvbltdIHtcbiAgcmV0dXJuIG5ldyBBbmltYXRpb25UaW1lbGluZUJ1aWxkZXJWaXNpdG9yKCkuYnVpbGRLZXlmcmFtZXMoXG4gICAgICBkcml2ZXIsIHJvb3RFbGVtZW50LCBhc3QsIGVudGVyQ2xhc3NOYW1lLCBsZWF2ZUNsYXNzTmFtZSwgc3RhcnRpbmdTdHlsZXMsIGZpbmFsU3R5bGVzLFxuICAgICAgb3B0aW9ucywgc3ViSW5zdHJ1Y3Rpb25zLCBlcnJvcnMpO1xufVxuXG5leHBvcnQgY2xhc3MgQW5pbWF0aW9uVGltZWxpbmVCdWlsZGVyVmlzaXRvciBpbXBsZW1lbnRzIEFzdFZpc2l0b3Ige1xuICBidWlsZEtleWZyYW1lcyhcbiAgICAgIGRyaXZlcjogQW5pbWF0aW9uRHJpdmVyLCByb290RWxlbWVudDogYW55LCBhc3Q6IEFzdDxBbmltYXRpb25NZXRhZGF0YVR5cGU+LFxuICAgICAgZW50ZXJDbGFzc05hbWU6IHN0cmluZywgbGVhdmVDbGFzc05hbWU6IHN0cmluZywgc3RhcnRpbmdTdHlsZXM6IMm1U3R5bGVEYXRhTWFwLFxuICAgICAgZmluYWxTdHlsZXM6IMm1U3R5bGVEYXRhTWFwLCBvcHRpb25zOiBBbmltYXRpb25PcHRpb25zLFxuICAgICAgc3ViSW5zdHJ1Y3Rpb25zPzogRWxlbWVudEluc3RydWN0aW9uTWFwLFxuICAgICAgZXJyb3JzOiBFcnJvcltdID0gW10pOiBBbmltYXRpb25UaW1lbGluZUluc3RydWN0aW9uW10ge1xuICAgIHN1Ykluc3RydWN0aW9ucyA9IHN1Ykluc3RydWN0aW9ucyB8fCBuZXcgRWxlbWVudEluc3RydWN0aW9uTWFwKCk7XG4gICAgY29uc3QgY29udGV4dCA9IG5ldyBBbmltYXRpb25UaW1lbGluZUNvbnRleHQoXG4gICAgICAgIGRyaXZlciwgcm9vdEVsZW1lbnQsIHN1Ykluc3RydWN0aW9ucywgZW50ZXJDbGFzc05hbWUsIGxlYXZlQ2xhc3NOYW1lLCBlcnJvcnMsIFtdKTtcbiAgICBjb250ZXh0Lm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIGNvbnN0IGRlbGF5ID0gb3B0aW9ucy5kZWxheSA/IHJlc29sdmVUaW1pbmdWYWx1ZShvcHRpb25zLmRlbGF5KSA6IDA7XG4gICAgY29udGV4dC5jdXJyZW50VGltZWxpbmUuZGVsYXlOZXh0U3RlcChkZWxheSk7XG4gICAgY29udGV4dC5jdXJyZW50VGltZWxpbmUuc2V0U3R5bGVzKFtzdGFydGluZ1N0eWxlc10sIG51bGwsIGNvbnRleHQuZXJyb3JzLCBvcHRpb25zKTtcblxuICAgIHZpc2l0RHNsTm9kZSh0aGlzLCBhc3QsIGNvbnRleHQpO1xuXG4gICAgLy8gdGhpcyBjaGVja3MgdG8gc2VlIGlmIGFuIGFjdHVhbCBhbmltYXRpb24gaGFwcGVuZWRcbiAgICBjb25zdCB0aW1lbGluZXMgPSBjb250ZXh0LnRpbWVsaW5lcy5maWx0ZXIodGltZWxpbmUgPT4gdGltZWxpbmUuY29udGFpbnNBbmltYXRpb24oKSk7XG5cbiAgICAvLyBub3RlOiB3ZSBqdXN0IHdhbnQgdG8gYXBwbHkgdGhlIGZpbmFsIHN0eWxlcyBmb3IgdGhlIHJvb3RFbGVtZW50LCBzbyB3ZSBkbyBub3RcbiAgICAvLyAgICAgICBqdXN0IGFwcGx5IHRoZSBzdHlsZXMgdG8gdGhlIGxhc3QgdGltZWxpbmUgYnV0IHRoZSBsYXN0IHRpbWVsaW5lIHdoaWNoXG4gICAgLy8gICAgICAgZWxlbWVudCBpcyB0aGUgcm9vdCBvbmUgKGJhc2ljYWxseSBgKmAtc3R5bGVzIGFyZSByZXBsYWNlZCB3aXRoIHRoZSBhY3R1YWxcbiAgICAvLyAgICAgICBzdGF0ZSBzdHlsZSB2YWx1ZXMgb25seSBmb3IgdGhlIHJvb3QgZWxlbWVudClcbiAgICBpZiAodGltZWxpbmVzLmxlbmd0aCAmJiBmaW5hbFN0eWxlcy5zaXplKSB7XG4gICAgICBsZXQgbGFzdFJvb3RUaW1lbGluZTogVGltZWxpbmVCdWlsZGVyfHVuZGVmaW5lZDtcbiAgICAgIGZvciAobGV0IGkgPSB0aW1lbGluZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgY29uc3QgdGltZWxpbmUgPSB0aW1lbGluZXNbaV07XG4gICAgICAgIGlmICh0aW1lbGluZS5lbGVtZW50ID09PSByb290RWxlbWVudCkge1xuICAgICAgICAgIGxhc3RSb290VGltZWxpbmUgPSB0aW1lbGluZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGxhc3RSb290VGltZWxpbmUgJiYgIWxhc3RSb290VGltZWxpbmUuYWxsb3dPbmx5VGltZWxpbmVTdHlsZXMoKSkge1xuICAgICAgICBsYXN0Um9vdFRpbWVsaW5lLnNldFN0eWxlcyhbZmluYWxTdHlsZXNdLCBudWxsLCBjb250ZXh0LmVycm9ycywgb3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aW1lbGluZXMubGVuZ3RoID9cbiAgICAgICAgdGltZWxpbmVzLm1hcCh0aW1lbGluZSA9PiB0aW1lbGluZS5idWlsZEtleWZyYW1lcygpKSA6XG4gICAgICAgIFtjcmVhdGVUaW1lbGluZUluc3RydWN0aW9uKHJvb3RFbGVtZW50LCBbXSwgW10sIFtdLCAwLCBkZWxheSwgJycsIGZhbHNlKV07XG4gIH1cblxuICB2aXNpdFRyaWdnZXIoYXN0OiBUcmlnZ2VyQXN0LCBjb250ZXh0OiBBbmltYXRpb25UaW1lbGluZUNvbnRleHQpOiBhbnkge1xuICAgIC8vIHRoZXNlIHZhbHVlcyBhcmUgbm90IHZpc2l0ZWQgaW4gdGhpcyBBU1RcbiAgfVxuXG4gIHZpc2l0U3RhdGUoYXN0OiBTdGF0ZUFzdCwgY29udGV4dDogQW5pbWF0aW9uVGltZWxpbmVDb250ZXh0KTogYW55IHtcbiAgICAvLyB0aGVzZSB2YWx1ZXMgYXJlIG5vdCB2aXNpdGVkIGluIHRoaXMgQVNUXG4gIH1cblxuICB2aXNpdFRyYW5zaXRpb24oYXN0OiBUcmFuc2l0aW9uQXN0LCBjb250ZXh0OiBBbmltYXRpb25UaW1lbGluZUNvbnRleHQpOiBhbnkge1xuICAgIC8vIHRoZXNlIHZhbHVlcyBhcmUgbm90IHZpc2l0ZWQgaW4gdGhpcyBBU1RcbiAgfVxuXG4gIHZpc2l0QW5pbWF0ZUNoaWxkKGFzdDogQW5pbWF0ZUNoaWxkQXN0LCBjb250ZXh0OiBBbmltYXRpb25UaW1lbGluZUNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IGVsZW1lbnRJbnN0cnVjdGlvbnMgPSBjb250ZXh0LnN1Ykluc3RydWN0aW9ucy5nZXQoY29udGV4dC5lbGVtZW50KTtcbiAgICBpZiAoZWxlbWVudEluc3RydWN0aW9ucykge1xuICAgICAgY29uc3QgaW5uZXJDb250ZXh0ID0gY29udGV4dC5jcmVhdGVTdWJDb250ZXh0KGFzdC5vcHRpb25zKTtcbiAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IGNvbnRleHQuY3VycmVudFRpbWVsaW5lLmN1cnJlbnRUaW1lO1xuICAgICAgY29uc3QgZW5kVGltZSA9IHRoaXMuX3Zpc2l0U3ViSW5zdHJ1Y3Rpb25zKFxuICAgICAgICAgIGVsZW1lbnRJbnN0cnVjdGlvbnMsIGlubmVyQ29udGV4dCwgaW5uZXJDb250ZXh0Lm9wdGlvbnMgYXMgQW5pbWF0ZUNoaWxkT3B0aW9ucyk7XG4gICAgICBpZiAoc3RhcnRUaW1lICE9IGVuZFRpbWUpIHtcbiAgICAgICAgLy8gd2UgZG8gdGhpcyBvbiB0aGUgdXBwZXIgY29udGV4dCBiZWNhdXNlIHdlIGNyZWF0ZWQgYSBzdWIgY29udGV4dCBmb3JcbiAgICAgICAgLy8gdGhlIHN1YiBjaGlsZCBhbmltYXRpb25zXG4gICAgICAgIGNvbnRleHQudHJhbnNmb3JtSW50b05ld1RpbWVsaW5lKGVuZFRpbWUpO1xuICAgICAgfVxuICAgIH1cbiAgICBjb250ZXh0LnByZXZpb3VzTm9kZSA9IGFzdDtcbiAgfVxuXG4gIHZpc2l0QW5pbWF0ZVJlZihhc3Q6IEFuaW1hdGVSZWZBc3QsIGNvbnRleHQ6IEFuaW1hdGlvblRpbWVsaW5lQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgaW5uZXJDb250ZXh0ID0gY29udGV4dC5jcmVhdGVTdWJDb250ZXh0KGFzdC5vcHRpb25zKTtcbiAgICBpbm5lckNvbnRleHQudHJhbnNmb3JtSW50b05ld1RpbWVsaW5lKCk7XG4gICAgdGhpcy52aXNpdFJlZmVyZW5jZShhc3QuYW5pbWF0aW9uLCBpbm5lckNvbnRleHQpO1xuICAgIGNvbnRleHQudHJhbnNmb3JtSW50b05ld1RpbWVsaW5lKGlubmVyQ29udGV4dC5jdXJyZW50VGltZWxpbmUuY3VycmVudFRpbWUpO1xuICAgIGNvbnRleHQucHJldmlvdXNOb2RlID0gYXN0O1xuICB9XG5cbiAgcHJpdmF0ZSBfdmlzaXRTdWJJbnN0cnVjdGlvbnMoXG4gICAgICBpbnN0cnVjdGlvbnM6IEFuaW1hdGlvblRpbWVsaW5lSW5zdHJ1Y3Rpb25bXSwgY29udGV4dDogQW5pbWF0aW9uVGltZWxpbmVDb250ZXh0LFxuICAgICAgb3B0aW9uczogQW5pbWF0ZUNoaWxkT3B0aW9ucyk6IG51bWJlciB7XG4gICAgY29uc3Qgc3RhcnRUaW1lID0gY29udGV4dC5jdXJyZW50VGltZWxpbmUuY3VycmVudFRpbWU7XG4gICAgbGV0IGZ1cnRoZXN0VGltZSA9IHN0YXJ0VGltZTtcblxuICAgIC8vIHRoaXMgaXMgYSBzcGVjaWFsLWNhc2UgZm9yIHdoZW4gYSB1c2VyIHdhbnRzIHRvIHNraXAgYSBzdWJcbiAgICAvLyBhbmltYXRpb24gZnJvbSBiZWluZyBmaXJlZCBlbnRpcmVseS5cbiAgICBjb25zdCBkdXJhdGlvbiA9IG9wdGlvbnMuZHVyYXRpb24gIT0gbnVsbCA/IHJlc29sdmVUaW1pbmdWYWx1ZShvcHRpb25zLmR1cmF0aW9uKSA6IG51bGw7XG4gICAgY29uc3QgZGVsYXkgPSBvcHRpb25zLmRlbGF5ICE9IG51bGwgPyByZXNvbHZlVGltaW5nVmFsdWUob3B0aW9ucy5kZWxheSkgOiBudWxsO1xuICAgIGlmIChkdXJhdGlvbiAhPT0gMCkge1xuICAgICAgaW5zdHJ1Y3Rpb25zLmZvckVhY2goaW5zdHJ1Y3Rpb24gPT4ge1xuICAgICAgICBjb25zdCBpbnN0cnVjdGlvblRpbWluZ3MgPVxuICAgICAgICAgICAgY29udGV4dC5hcHBlbmRJbnN0cnVjdGlvblRvVGltZWxpbmUoaW5zdHJ1Y3Rpb24sIGR1cmF0aW9uLCBkZWxheSk7XG4gICAgICAgIGZ1cnRoZXN0VGltZSA9XG4gICAgICAgICAgICBNYXRoLm1heChmdXJ0aGVzdFRpbWUsIGluc3RydWN0aW9uVGltaW5ncy5kdXJhdGlvbiArIGluc3RydWN0aW9uVGltaW5ncy5kZWxheSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnVydGhlc3RUaW1lO1xuICB9XG5cbiAgdmlzaXRSZWZlcmVuY2UoYXN0OiBSZWZlcmVuY2VBc3QsIGNvbnRleHQ6IEFuaW1hdGlvblRpbWVsaW5lQ29udGV4dCkge1xuICAgIGNvbnRleHQudXBkYXRlT3B0aW9ucyhhc3Qub3B0aW9ucywgdHJ1ZSk7XG4gICAgdmlzaXREc2xOb2RlKHRoaXMsIGFzdC5hbmltYXRpb24sIGNvbnRleHQpO1xuICAgIGNvbnRleHQucHJldmlvdXNOb2RlID0gYXN0O1xuICB9XG5cbiAgdmlzaXRTZXF1ZW5jZShhc3Q6IFNlcXVlbmNlQXN0LCBjb250ZXh0OiBBbmltYXRpb25UaW1lbGluZUNvbnRleHQpIHtcbiAgICBjb25zdCBzdWJDb250ZXh0Q291bnQgPSBjb250ZXh0LnN1YkNvbnRleHRDb3VudDtcbiAgICBsZXQgY3R4ID0gY29udGV4dDtcbiAgICBjb25zdCBvcHRpb25zID0gYXN0Lm9wdGlvbnM7XG5cbiAgICBpZiAob3B0aW9ucyAmJiAob3B0aW9ucy5wYXJhbXMgfHwgb3B0aW9ucy5kZWxheSkpIHtcbiAgICAgIGN0eCA9IGNvbnRleHQuY3JlYXRlU3ViQ29udGV4dChvcHRpb25zKTtcbiAgICAgIGN0eC50cmFuc2Zvcm1JbnRvTmV3VGltZWxpbmUoKTtcblxuICAgICAgaWYgKG9wdGlvbnMuZGVsYXkgIT0gbnVsbCkge1xuICAgICAgICBpZiAoY3R4LnByZXZpb3VzTm9kZS50eXBlID09IEFuaW1hdGlvbk1ldGFkYXRhVHlwZS5TdHlsZSkge1xuICAgICAgICAgIGN0eC5jdXJyZW50VGltZWxpbmUuc25hcHNob3RDdXJyZW50U3R5bGVzKCk7XG4gICAgICAgICAgY3R4LnByZXZpb3VzTm9kZSA9IERFRkFVTFRfTk9PUF9QUkVWSU9VU19OT0RFO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZGVsYXkgPSByZXNvbHZlVGltaW5nVmFsdWUob3B0aW9ucy5kZWxheSk7XG4gICAgICAgIGN0eC5kZWxheU5leHRTdGVwKGRlbGF5KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoYXN0LnN0ZXBzLmxlbmd0aCkge1xuICAgICAgYXN0LnN0ZXBzLmZvckVhY2gocyA9PiB2aXNpdERzbE5vZGUodGhpcywgcywgY3R4KSk7XG5cbiAgICAgIC8vIHRoaXMgaXMgaGVyZSBqdXN0IGluIGNhc2UgdGhlIGlubmVyIHN0ZXBzIG9ubHkgY29udGFpbiBvciBlbmQgd2l0aCBhIHN0eWxlKCkgY2FsbFxuICAgICAgY3R4LmN1cnJlbnRUaW1lbGluZS5hcHBseVN0eWxlc1RvS2V5ZnJhbWUoKTtcblxuICAgICAgLy8gdGhpcyBtZWFucyB0aGF0IHNvbWUgYW5pbWF0aW9uIGZ1bmN0aW9uIHdpdGhpbiB0aGUgc2VxdWVuY2VcbiAgICAgIC8vIGVuZGVkIHVwIGNyZWF0aW5nIGEgc3ViIHRpbWVsaW5lICh3aGljaCBtZWFucyB0aGUgY3VycmVudFxuICAgICAgLy8gdGltZWxpbmUgY2Fubm90IG92ZXJsYXAgd2l0aCB0aGUgY29udGVudHMgb2YgdGhlIHNlcXVlbmNlKVxuICAgICAgaWYgKGN0eC5zdWJDb250ZXh0Q291bnQgPiBzdWJDb250ZXh0Q291bnQpIHtcbiAgICAgICAgY3R4LnRyYW5zZm9ybUludG9OZXdUaW1lbGluZSgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnRleHQucHJldmlvdXNOb2RlID0gYXN0O1xuICB9XG5cbiAgdmlzaXRHcm91cChhc3Q6IEdyb3VwQXN0LCBjb250ZXh0OiBBbmltYXRpb25UaW1lbGluZUNvbnRleHQpIHtcbiAgICBjb25zdCBpbm5lclRpbWVsaW5lczogVGltZWxpbmVCdWlsZGVyW10gPSBbXTtcbiAgICBsZXQgZnVydGhlc3RUaW1lID0gY29udGV4dC5jdXJyZW50VGltZWxpbmUuY3VycmVudFRpbWU7XG4gICAgY29uc3QgZGVsYXkgPSBhc3Qub3B0aW9ucyAmJiBhc3Qub3B0aW9ucy5kZWxheSA/IHJlc29sdmVUaW1pbmdWYWx1ZShhc3Qub3B0aW9ucy5kZWxheSkgOiAwO1xuXG4gICAgYXN0LnN0ZXBzLmZvckVhY2gocyA9PiB7XG4gICAgICBjb25zdCBpbm5lckNvbnRleHQgPSBjb250ZXh0LmNyZWF0ZVN1YkNvbnRleHQoYXN0Lm9wdGlvbnMpO1xuICAgICAgaWYgKGRlbGF5KSB7XG4gICAgICAgIGlubmVyQ29udGV4dC5kZWxheU5leHRTdGVwKGRlbGF5KTtcbiAgICAgIH1cblxuICAgICAgdmlzaXREc2xOb2RlKHRoaXMsIHMsIGlubmVyQ29udGV4dCk7XG4gICAgICBmdXJ0aGVzdFRpbWUgPSBNYXRoLm1heChmdXJ0aGVzdFRpbWUsIGlubmVyQ29udGV4dC5jdXJyZW50VGltZWxpbmUuY3VycmVudFRpbWUpO1xuICAgICAgaW5uZXJUaW1lbGluZXMucHVzaChpbm5lckNvbnRleHQuY3VycmVudFRpbWVsaW5lKTtcbiAgICB9KTtcblxuICAgIC8vIHRoaXMgb3BlcmF0aW9uIGlzIHJ1biBhZnRlciB0aGUgQVNUIGxvb3AgYmVjYXVzZSBvdGhlcndpc2VcbiAgICAvLyBpZiB0aGUgcGFyZW50IHRpbWVsaW5lJ3MgY29sbGVjdGVkIHN0eWxlcyB3ZXJlIHVwZGF0ZWQgdGhlblxuICAgIC8vIGl0IHdvdWxkIHBhc3MgaW4gaW52YWxpZCBkYXRhIGludG8gdGhlIG5ldy10by1iZSBmb3JrZWQgaXRlbXNcbiAgICBpbm5lclRpbWVsaW5lcy5mb3JFYWNoKFxuICAgICAgICB0aW1lbGluZSA9PiBjb250ZXh0LmN1cnJlbnRUaW1lbGluZS5tZXJnZVRpbWVsaW5lQ29sbGVjdGVkU3R5bGVzKHRpbWVsaW5lKSk7XG4gICAgY29udGV4dC50cmFuc2Zvcm1JbnRvTmV3VGltZWxpbmUoZnVydGhlc3RUaW1lKTtcbiAgICBjb250ZXh0LnByZXZpb3VzTm9kZSA9IGFzdDtcbiAgfVxuXG4gIHByaXZhdGUgX3Zpc2l0VGltaW5nKGFzdDogVGltaW5nQXN0LCBjb250ZXh0OiBBbmltYXRpb25UaW1lbGluZUNvbnRleHQpOiBBbmltYXRlVGltaW5ncyB7XG4gICAgaWYgKChhc3QgYXMgRHluYW1pY1RpbWluZ0FzdCkuZHluYW1pYykge1xuICAgICAgY29uc3Qgc3RyVmFsdWUgPSAoYXN0IGFzIER5bmFtaWNUaW1pbmdBc3QpLnN0clZhbHVlO1xuICAgICAgY29uc3QgdGltaW5nVmFsdWUgPVxuICAgICAgICAgIGNvbnRleHQucGFyYW1zID8gaW50ZXJwb2xhdGVQYXJhbXMoc3RyVmFsdWUsIGNvbnRleHQucGFyYW1zLCBjb250ZXh0LmVycm9ycykgOiBzdHJWYWx1ZTtcbiAgICAgIHJldHVybiByZXNvbHZlVGltaW5nKHRpbWluZ1ZhbHVlLCBjb250ZXh0LmVycm9ycyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB7ZHVyYXRpb246IGFzdC5kdXJhdGlvbiwgZGVsYXk6IGFzdC5kZWxheSwgZWFzaW5nOiBhc3QuZWFzaW5nfTtcbiAgICB9XG4gIH1cblxuICB2aXNpdEFuaW1hdGUoYXN0OiBBbmltYXRlQXN0LCBjb250ZXh0OiBBbmltYXRpb25UaW1lbGluZUNvbnRleHQpIHtcbiAgICBjb25zdCB0aW1pbmdzID0gY29udGV4dC5jdXJyZW50QW5pbWF0ZVRpbWluZ3MgPSB0aGlzLl92aXNpdFRpbWluZyhhc3QudGltaW5ncywgY29udGV4dCk7XG4gICAgY29uc3QgdGltZWxpbmUgPSBjb250ZXh0LmN1cnJlbnRUaW1lbGluZTtcbiAgICBpZiAodGltaW5ncy5kZWxheSkge1xuICAgICAgY29udGV4dC5pbmNyZW1lbnRUaW1lKHRpbWluZ3MuZGVsYXkpO1xuICAgICAgdGltZWxpbmUuc25hcHNob3RDdXJyZW50U3R5bGVzKCk7XG4gICAgfVxuXG4gICAgY29uc3Qgc3R5bGUgPSBhc3Quc3R5bGU7XG4gICAgaWYgKHN0eWxlLnR5cGUgPT0gQW5pbWF0aW9uTWV0YWRhdGFUeXBlLktleWZyYW1lcykge1xuICAgICAgdGhpcy52aXNpdEtleWZyYW1lcyhzdHlsZSwgY29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnRleHQuaW5jcmVtZW50VGltZSh0aW1pbmdzLmR1cmF0aW9uKTtcbiAgICAgIHRoaXMudmlzaXRTdHlsZShzdHlsZSBhcyBTdHlsZUFzdCwgY29udGV4dCk7XG4gICAgICB0aW1lbGluZS5hcHBseVN0eWxlc1RvS2V5ZnJhbWUoKTtcbiAgICB9XG5cbiAgICBjb250ZXh0LmN1cnJlbnRBbmltYXRlVGltaW5ncyA9IG51bGw7XG4gICAgY29udGV4dC5wcmV2aW91c05vZGUgPSBhc3Q7XG4gIH1cblxuICB2aXNpdFN0eWxlKGFzdDogU3R5bGVBc3QsIGNvbnRleHQ6IEFuaW1hdGlvblRpbWVsaW5lQ29udGV4dCkge1xuICAgIGNvbnN0IHRpbWVsaW5lID0gY29udGV4dC5jdXJyZW50VGltZWxpbmU7XG4gICAgY29uc3QgdGltaW5ncyA9IGNvbnRleHQuY3VycmVudEFuaW1hdGVUaW1pbmdzITtcblxuICAgIC8vIHRoaXMgaXMgYSBzcGVjaWFsIGNhc2UgZm9yIHdoZW4gYSBzdHlsZSgpIGNhbGxcbiAgICAvLyBkaXJlY3RseSBmb2xsb3dzICBhbiBhbmltYXRlKCkgY2FsbCAoYnV0IG5vdCBpbnNpZGUgb2YgYW4gYW5pbWF0ZSgpIGNhbGwpXG4gICAgaWYgKCF0aW1pbmdzICYmIHRpbWVsaW5lLmhhc0N1cnJlbnRTdHlsZVByb3BlcnRpZXMoKSkge1xuICAgICAgdGltZWxpbmUuZm9yd2FyZEZyYW1lKCk7XG4gICAgfVxuXG4gICAgY29uc3QgZWFzaW5nID0gKHRpbWluZ3MgJiYgdGltaW5ncy5lYXNpbmcpIHx8IGFzdC5lYXNpbmc7XG4gICAgaWYgKGFzdC5pc0VtcHR5U3RlcCkge1xuICAgICAgdGltZWxpbmUuYXBwbHlFbXB0eVN0ZXAoZWFzaW5nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGltZWxpbmUuc2V0U3R5bGVzKGFzdC5zdHlsZXMsIGVhc2luZywgY29udGV4dC5lcnJvcnMsIGNvbnRleHQub3B0aW9ucyk7XG4gICAgfVxuXG4gICAgY29udGV4dC5wcmV2aW91c05vZGUgPSBhc3Q7XG4gIH1cblxuICB2aXNpdEtleWZyYW1lcyhhc3Q6IEtleWZyYW1lc0FzdCwgY29udGV4dDogQW5pbWF0aW9uVGltZWxpbmVDb250ZXh0KSB7XG4gICAgY29uc3QgY3VycmVudEFuaW1hdGVUaW1pbmdzID0gY29udGV4dC5jdXJyZW50QW5pbWF0ZVRpbWluZ3MhO1xuICAgIGNvbnN0IHN0YXJ0VGltZSA9IChjb250ZXh0LmN1cnJlbnRUaW1lbGluZSEpLmR1cmF0aW9uO1xuICAgIGNvbnN0IGR1cmF0aW9uID0gY3VycmVudEFuaW1hdGVUaW1pbmdzLmR1cmF0aW9uO1xuICAgIGNvbnN0IGlubmVyQ29udGV4dCA9IGNvbnRleHQuY3JlYXRlU3ViQ29udGV4dCgpO1xuICAgIGNvbnN0IGlubmVyVGltZWxpbmUgPSBpbm5lckNvbnRleHQuY3VycmVudFRpbWVsaW5lO1xuICAgIGlubmVyVGltZWxpbmUuZWFzaW5nID0gY3VycmVudEFuaW1hdGVUaW1pbmdzLmVhc2luZztcblxuICAgIGFzdC5zdHlsZXMuZm9yRWFjaChzdGVwID0+IHtcbiAgICAgIGNvbnN0IG9mZnNldDogbnVtYmVyID0gc3RlcC5vZmZzZXQgfHwgMDtcbiAgICAgIGlubmVyVGltZWxpbmUuZm9yd2FyZFRpbWUob2Zmc2V0ICogZHVyYXRpb24pO1xuICAgICAgaW5uZXJUaW1lbGluZS5zZXRTdHlsZXMoc3RlcC5zdHlsZXMsIHN0ZXAuZWFzaW5nLCBjb250ZXh0LmVycm9ycywgY29udGV4dC5vcHRpb25zKTtcbiAgICAgIGlubmVyVGltZWxpbmUuYXBwbHlTdHlsZXNUb0tleWZyYW1lKCk7XG4gICAgfSk7XG5cbiAgICAvLyB0aGlzIHdpbGwgZW5zdXJlIHRoYXQgdGhlIHBhcmVudCB0aW1lbGluZSBnZXRzIGFsbCB0aGUgc3R5bGVzIGZyb21cbiAgICAvLyB0aGUgY2hpbGQgZXZlbiBpZiB0aGUgbmV3IHRpbWVsaW5lIGJlbG93IGlzIG5vdCB1c2VkXG4gICAgY29udGV4dC5jdXJyZW50VGltZWxpbmUubWVyZ2VUaW1lbGluZUNvbGxlY3RlZFN0eWxlcyhpbm5lclRpbWVsaW5lKTtcblxuICAgIC8vIHdlIGRvIHRoaXMgYmVjYXVzZSB0aGUgd2luZG93IGJldHdlZW4gdGhpcyB0aW1lbGluZSBhbmQgdGhlIHN1YiB0aW1lbGluZVxuICAgIC8vIHNob3VsZCBlbnN1cmUgdGhhdCB0aGUgc3R5bGVzIHdpdGhpbiBhcmUgZXhhY3RseSB0aGUgc2FtZSBhcyB0aGV5IHdlcmUgYmVmb3JlXG4gICAgY29udGV4dC50cmFuc2Zvcm1JbnRvTmV3VGltZWxpbmUoc3RhcnRUaW1lICsgZHVyYXRpb24pO1xuICAgIGNvbnRleHQucHJldmlvdXNOb2RlID0gYXN0O1xuICB9XG5cbiAgdmlzaXRRdWVyeShhc3Q6IFF1ZXJ5QXN0LCBjb250ZXh0OiBBbmltYXRpb25UaW1lbGluZUNvbnRleHQpIHtcbiAgICAvLyBpbiB0aGUgZXZlbnQgdGhhdCB0aGUgZmlyc3Qgc3RlcCBiZWZvcmUgdGhpcyBpcyBhIHN0eWxlIHN0ZXAgd2UgbmVlZFxuICAgIC8vIHRvIGVuc3VyZSB0aGUgc3R5bGVzIGFyZSBhcHBsaWVkIGJlZm9yZSB0aGUgY2hpbGRyZW4gYXJlIGFuaW1hdGVkXG4gICAgY29uc3Qgc3RhcnRUaW1lID0gY29udGV4dC5jdXJyZW50VGltZWxpbmUuY3VycmVudFRpbWU7XG4gICAgY29uc3Qgb3B0aW9ucyA9IChhc3Qub3B0aW9ucyB8fCB7fSkgYXMgQW5pbWF0aW9uUXVlcnlPcHRpb25zO1xuICAgIGNvbnN0IGRlbGF5ID0gb3B0aW9ucy5kZWxheSA/IHJlc29sdmVUaW1pbmdWYWx1ZShvcHRpb25zLmRlbGF5KSA6IDA7XG5cbiAgICBpZiAoZGVsYXkgJiZcbiAgICAgICAgKGNvbnRleHQucHJldmlvdXNOb2RlLnR5cGUgPT09IEFuaW1hdGlvbk1ldGFkYXRhVHlwZS5TdHlsZSB8fFxuICAgICAgICAgKHN0YXJ0VGltZSA9PSAwICYmIGNvbnRleHQuY3VycmVudFRpbWVsaW5lLmhhc0N1cnJlbnRTdHlsZVByb3BlcnRpZXMoKSkpKSB7XG4gICAgICBjb250ZXh0LmN1cnJlbnRUaW1lbGluZS5zbmFwc2hvdEN1cnJlbnRTdHlsZXMoKTtcbiAgICAgIGNvbnRleHQucHJldmlvdXNOb2RlID0gREVGQVVMVF9OT09QX1BSRVZJT1VTX05PREU7XG4gICAgfVxuXG4gICAgbGV0IGZ1cnRoZXN0VGltZSA9IHN0YXJ0VGltZTtcbiAgICBjb25zdCBlbG1zID0gY29udGV4dC5pbnZva2VRdWVyeShcbiAgICAgICAgYXN0LnNlbGVjdG9yLCBhc3Qub3JpZ2luYWxTZWxlY3RvciwgYXN0LmxpbWl0LCBhc3QuaW5jbHVkZVNlbGYsXG4gICAgICAgIG9wdGlvbnMub3B0aW9uYWwgPyB0cnVlIDogZmFsc2UsIGNvbnRleHQuZXJyb3JzKTtcblxuICAgIGNvbnRleHQuY3VycmVudFF1ZXJ5VG90YWwgPSBlbG1zLmxlbmd0aDtcbiAgICBsZXQgc2FtZUVsZW1lbnRUaW1lbGluZTogVGltZWxpbmVCdWlsZGVyfG51bGwgPSBudWxsO1xuICAgIGVsbXMuZm9yRWFjaCgoZWxlbWVudCwgaSkgPT4ge1xuICAgICAgY29udGV4dC5jdXJyZW50UXVlcnlJbmRleCA9IGk7XG4gICAgICBjb25zdCBpbm5lckNvbnRleHQgPSBjb250ZXh0LmNyZWF0ZVN1YkNvbnRleHQoYXN0Lm9wdGlvbnMsIGVsZW1lbnQpO1xuICAgICAgaWYgKGRlbGF5KSB7XG4gICAgICAgIGlubmVyQ29udGV4dC5kZWxheU5leHRTdGVwKGRlbGF5KTtcbiAgICAgIH1cblxuICAgICAgaWYgKGVsZW1lbnQgPT09IGNvbnRleHQuZWxlbWVudCkge1xuICAgICAgICBzYW1lRWxlbWVudFRpbWVsaW5lID0gaW5uZXJDb250ZXh0LmN1cnJlbnRUaW1lbGluZTtcbiAgICAgIH1cblxuICAgICAgdmlzaXREc2xOb2RlKHRoaXMsIGFzdC5hbmltYXRpb24sIGlubmVyQ29udGV4dCk7XG5cbiAgICAgIC8vIHRoaXMgaXMgaGVyZSBqdXN0IGluY2FzZSB0aGUgaW5uZXIgc3RlcHMgb25seSBjb250YWluIG9yIGVuZFxuICAgICAgLy8gd2l0aCBhIHN0eWxlKCkgY2FsbCAod2hpY2ggaXMgaGVyZSB0byBzaWduYWwgdGhhdCB0aGlzIGlzIGEgcHJlcGFyYXRvcnlcbiAgICAgIC8vIGNhbGwgdG8gc3R5bGUgYW4gZWxlbWVudCBiZWZvcmUgaXQgaXMgYW5pbWF0ZWQgYWdhaW4pXG4gICAgICBpbm5lckNvbnRleHQuY3VycmVudFRpbWVsaW5lLmFwcGx5U3R5bGVzVG9LZXlmcmFtZSgpO1xuXG4gICAgICBjb25zdCBlbmRUaW1lID0gaW5uZXJDb250ZXh0LmN1cnJlbnRUaW1lbGluZS5jdXJyZW50VGltZTtcbiAgICAgIGZ1cnRoZXN0VGltZSA9IE1hdGgubWF4KGZ1cnRoZXN0VGltZSwgZW5kVGltZSk7XG4gICAgfSk7XG5cbiAgICBjb250ZXh0LmN1cnJlbnRRdWVyeUluZGV4ID0gMDtcbiAgICBjb250ZXh0LmN1cnJlbnRRdWVyeVRvdGFsID0gMDtcbiAgICBjb250ZXh0LnRyYW5zZm9ybUludG9OZXdUaW1lbGluZShmdXJ0aGVzdFRpbWUpO1xuXG4gICAgaWYgKHNhbWVFbGVtZW50VGltZWxpbmUpIHtcbiAgICAgIGNvbnRleHQuY3VycmVudFRpbWVsaW5lLm1lcmdlVGltZWxpbmVDb2xsZWN0ZWRTdHlsZXMoc2FtZUVsZW1lbnRUaW1lbGluZSk7XG4gICAgICBjb250ZXh0LmN1cnJlbnRUaW1lbGluZS5zbmFwc2hvdEN1cnJlbnRTdHlsZXMoKTtcbiAgICB9XG5cbiAgICBjb250ZXh0LnByZXZpb3VzTm9kZSA9IGFzdDtcbiAgfVxuXG4gIHZpc2l0U3RhZ2dlcihhc3Q6IFN0YWdnZXJBc3QsIGNvbnRleHQ6IEFuaW1hdGlvblRpbWVsaW5lQ29udGV4dCkge1xuICAgIGNvbnN0IHBhcmVudENvbnRleHQgPSBjb250ZXh0LnBhcmVudENvbnRleHQhO1xuICAgIGNvbnN0IHRsID0gY29udGV4dC5jdXJyZW50VGltZWxpbmU7XG4gICAgY29uc3QgdGltaW5ncyA9IGFzdC50aW1pbmdzO1xuICAgIGNvbnN0IGR1cmF0aW9uID0gTWF0aC5hYnModGltaW5ncy5kdXJhdGlvbik7XG4gICAgY29uc3QgbWF4VGltZSA9IGR1cmF0aW9uICogKGNvbnRleHQuY3VycmVudFF1ZXJ5VG90YWwgLSAxKTtcbiAgICBsZXQgZGVsYXkgPSBkdXJhdGlvbiAqIGNvbnRleHQuY3VycmVudFF1ZXJ5SW5kZXg7XG5cbiAgICBsZXQgc3RhZ2dlclRyYW5zZm9ybWVyID0gdGltaW5ncy5kdXJhdGlvbiA8IDAgPyAncmV2ZXJzZScgOiB0aW1pbmdzLmVhc2luZztcbiAgICBzd2l0Y2ggKHN0YWdnZXJUcmFuc2Zvcm1lcikge1xuICAgICAgY2FzZSAncmV2ZXJzZSc6XG4gICAgICAgIGRlbGF5ID0gbWF4VGltZSAtIGRlbGF5O1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2Z1bGwnOlxuICAgICAgICBkZWxheSA9IHBhcmVudENvbnRleHQuY3VycmVudFN0YWdnZXJUaW1lO1xuICAgICAgICBicmVhaztcbiAgICB9XG5cbiAgICBjb25zdCB0aW1lbGluZSA9IGNvbnRleHQuY3VycmVudFRpbWVsaW5lO1xuICAgIGlmIChkZWxheSkge1xuICAgICAgdGltZWxpbmUuZGVsYXlOZXh0U3RlcChkZWxheSk7XG4gICAgfVxuXG4gICAgY29uc3Qgc3RhcnRpbmdUaW1lID0gdGltZWxpbmUuY3VycmVudFRpbWU7XG4gICAgdmlzaXREc2xOb2RlKHRoaXMsIGFzdC5hbmltYXRpb24sIGNvbnRleHQpO1xuICAgIGNvbnRleHQucHJldmlvdXNOb2RlID0gYXN0O1xuXG4gICAgLy8gdGltZSA9IGR1cmF0aW9uICsgZGVsYXlcbiAgICAvLyB0aGUgcmVhc29uIHdoeSB0aGlzIGNvbXB1dGF0aW9uIGlzIHNvIGNvbXBsZXggaXMgYmVjYXVzZVxuICAgIC8vIHRoZSBpbm5lciB0aW1lbGluZSBtYXkgZWl0aGVyIGhhdmUgYSBkZWxheSB2YWx1ZSBvciBhIHN0cmV0Y2hlZFxuICAgIC8vIGtleWZyYW1lIGRlcGVuZGluZyBvbiBpZiBhIHN1YnRpbWVsaW5lIGlzIG5vdCB1c2VkIG9yIGlzIHVzZWQuXG4gICAgcGFyZW50Q29udGV4dC5jdXJyZW50U3RhZ2dlclRpbWUgPVxuICAgICAgICAodGwuY3VycmVudFRpbWUgLSBzdGFydGluZ1RpbWUpICsgKHRsLnN0YXJ0VGltZSAtIHBhcmVudENvbnRleHQuY3VycmVudFRpbWVsaW5lLnN0YXJ0VGltZSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlY2xhcmUgdHlwZSBTdHlsZUF0VGltZSA9IHtcbiAgdGltZTogbnVtYmVyOyB2YWx1ZTogc3RyaW5nIHwgbnVtYmVyO1xufTtcblxuY29uc3QgREVGQVVMVF9OT09QX1BSRVZJT1VTX05PREUgPSA8QXN0PEFuaW1hdGlvbk1ldGFkYXRhVHlwZT4+e307XG5leHBvcnQgY2xhc3MgQW5pbWF0aW9uVGltZWxpbmVDb250ZXh0IHtcbiAgcHVibGljIHBhcmVudENvbnRleHQ6IEFuaW1hdGlvblRpbWVsaW5lQ29udGV4dHxudWxsID0gbnVsbDtcbiAgcHVibGljIGN1cnJlbnRUaW1lbGluZTogVGltZWxpbmVCdWlsZGVyO1xuICBwdWJsaWMgY3VycmVudEFuaW1hdGVUaW1pbmdzOiBBbmltYXRlVGltaW5nc3xudWxsID0gbnVsbDtcbiAgcHVibGljIHByZXZpb3VzTm9kZTogQXN0PEFuaW1hdGlvbk1ldGFkYXRhVHlwZT4gPSBERUZBVUxUX05PT1BfUFJFVklPVVNfTk9ERTtcbiAgcHVibGljIHN1YkNvbnRleHRDb3VudCA9IDA7XG4gIHB1YmxpYyBvcHRpb25zOiBBbmltYXRpb25PcHRpb25zID0ge307XG4gIHB1YmxpYyBjdXJyZW50UXVlcnlJbmRleDogbnVtYmVyID0gMDtcbiAgcHVibGljIGN1cnJlbnRRdWVyeVRvdGFsOiBudW1iZXIgPSAwO1xuICBwdWJsaWMgY3VycmVudFN0YWdnZXJUaW1lOiBudW1iZXIgPSAwO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBfZHJpdmVyOiBBbmltYXRpb25Ecml2ZXIsIHB1YmxpYyBlbGVtZW50OiBhbnksXG4gICAgICBwdWJsaWMgc3ViSW5zdHJ1Y3Rpb25zOiBFbGVtZW50SW5zdHJ1Y3Rpb25NYXAsIHByaXZhdGUgX2VudGVyQ2xhc3NOYW1lOiBzdHJpbmcsXG4gICAgICBwcml2YXRlIF9sZWF2ZUNsYXNzTmFtZTogc3RyaW5nLCBwdWJsaWMgZXJyb3JzOiBFcnJvcltdLCBwdWJsaWMgdGltZWxpbmVzOiBUaW1lbGluZUJ1aWxkZXJbXSxcbiAgICAgIGluaXRpYWxUaW1lbGluZT86IFRpbWVsaW5lQnVpbGRlcikge1xuICAgIHRoaXMuY3VycmVudFRpbWVsaW5lID0gaW5pdGlhbFRpbWVsaW5lIHx8IG5ldyBUaW1lbGluZUJ1aWxkZXIodGhpcy5fZHJpdmVyLCBlbGVtZW50LCAwKTtcbiAgICB0aW1lbGluZXMucHVzaCh0aGlzLmN1cnJlbnRUaW1lbGluZSk7XG4gIH1cblxuICBnZXQgcGFyYW1zKCkge1xuICAgIHJldHVybiB0aGlzLm9wdGlvbnMucGFyYW1zO1xuICB9XG5cbiAgdXBkYXRlT3B0aW9ucyhvcHRpb25zOiBBbmltYXRpb25PcHRpb25zfG51bGwsIHNraXBJZkV4aXN0cz86IGJvb2xlYW4pIHtcbiAgICBpZiAoIW9wdGlvbnMpIHJldHVybjtcblxuICAgIGNvbnN0IG5ld09wdGlvbnMgPSBvcHRpb25zIGFzIGFueTtcbiAgICBsZXQgb3B0aW9uc1RvVXBkYXRlID0gdGhpcy5vcHRpb25zO1xuXG4gICAgLy8gTk9URTogdGhpcyB3aWxsIGdldCBwYXRjaGVkIHVwIHdoZW4gb3RoZXIgYW5pbWF0aW9uIG1ldGhvZHMgc3VwcG9ydCBkdXJhdGlvbiBvdmVycmlkZXNcbiAgICBpZiAobmV3T3B0aW9ucy5kdXJhdGlvbiAhPSBudWxsKSB7XG4gICAgICAob3B0aW9uc1RvVXBkYXRlIGFzIGFueSkuZHVyYXRpb24gPSByZXNvbHZlVGltaW5nVmFsdWUobmV3T3B0aW9ucy5kdXJhdGlvbik7XG4gICAgfVxuXG4gICAgaWYgKG5ld09wdGlvbnMuZGVsYXkgIT0gbnVsbCkge1xuICAgICAgb3B0aW9uc1RvVXBkYXRlLmRlbGF5ID0gcmVzb2x2ZVRpbWluZ1ZhbHVlKG5ld09wdGlvbnMuZGVsYXkpO1xuICAgIH1cblxuICAgIGNvbnN0IG5ld1BhcmFtcyA9IG5ld09wdGlvbnMucGFyYW1zO1xuICAgIGlmIChuZXdQYXJhbXMpIHtcbiAgICAgIGxldCBwYXJhbXNUb1VwZGF0ZToge1tuYW1lOiBzdHJpbmddOiBhbnl9ID0gb3B0aW9uc1RvVXBkYXRlLnBhcmFtcyE7XG4gICAgICBpZiAoIXBhcmFtc1RvVXBkYXRlKSB7XG4gICAgICAgIHBhcmFtc1RvVXBkYXRlID0gdGhpcy5vcHRpb25zLnBhcmFtcyA9IHt9O1xuICAgICAgfVxuXG4gICAgICBPYmplY3Qua2V5cyhuZXdQYXJhbXMpLmZvckVhY2gobmFtZSA9PiB7XG4gICAgICAgIGlmICghc2tpcElmRXhpc3RzIHx8ICFwYXJhbXNUb1VwZGF0ZS5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgIHBhcmFtc1RvVXBkYXRlW25hbWVdID0gaW50ZXJwb2xhdGVQYXJhbXMobmV3UGFyYW1zW25hbWVdLCBwYXJhbXNUb1VwZGF0ZSwgdGhpcy5lcnJvcnMpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9jb3B5T3B0aW9ucygpIHtcbiAgICBjb25zdCBvcHRpb25zOiBBbmltYXRpb25PcHRpb25zID0ge307XG4gICAgaWYgKHRoaXMub3B0aW9ucykge1xuICAgICAgY29uc3Qgb2xkUGFyYW1zID0gdGhpcy5vcHRpb25zLnBhcmFtcztcbiAgICAgIGlmIChvbGRQYXJhbXMpIHtcbiAgICAgICAgY29uc3QgcGFyYW1zOiB7W25hbWU6IHN0cmluZ106IGFueX0gPSBvcHRpb25zWydwYXJhbXMnXSA9IHt9O1xuICAgICAgICBPYmplY3Qua2V5cyhvbGRQYXJhbXMpLmZvckVhY2gobmFtZSA9PiB7XG4gICAgICAgICAgcGFyYW1zW25hbWVdID0gb2xkUGFyYW1zW25hbWVdO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9wdGlvbnM7XG4gIH1cblxuICBjcmVhdGVTdWJDb250ZXh0KG9wdGlvbnM6IEFuaW1hdGlvbk9wdGlvbnN8bnVsbCA9IG51bGwsIGVsZW1lbnQ/OiBhbnksIG5ld1RpbWU/OiBudW1iZXIpOlxuICAgICAgQW5pbWF0aW9uVGltZWxpbmVDb250ZXh0IHtcbiAgICBjb25zdCB0YXJnZXQgPSBlbGVtZW50IHx8IHRoaXMuZWxlbWVudDtcbiAgICBjb25zdCBjb250ZXh0ID0gbmV3IEFuaW1hdGlvblRpbWVsaW5lQ29udGV4dChcbiAgICAgICAgdGhpcy5fZHJpdmVyLCB0YXJnZXQsIHRoaXMuc3ViSW5zdHJ1Y3Rpb25zLCB0aGlzLl9lbnRlckNsYXNzTmFtZSwgdGhpcy5fbGVhdmVDbGFzc05hbWUsXG4gICAgICAgIHRoaXMuZXJyb3JzLCB0aGlzLnRpbWVsaW5lcywgdGhpcy5jdXJyZW50VGltZWxpbmUuZm9yayh0YXJnZXQsIG5ld1RpbWUgfHwgMCkpO1xuICAgIGNvbnRleHQucHJldmlvdXNOb2RlID0gdGhpcy5wcmV2aW91c05vZGU7XG4gICAgY29udGV4dC5jdXJyZW50QW5pbWF0ZVRpbWluZ3MgPSB0aGlzLmN1cnJlbnRBbmltYXRlVGltaW5ncztcblxuICAgIGNvbnRleHQub3B0aW9ucyA9IHRoaXMuX2NvcHlPcHRpb25zKCk7XG4gICAgY29udGV4dC51cGRhdGVPcHRpb25zKG9wdGlvbnMpO1xuXG4gICAgY29udGV4dC5jdXJyZW50UXVlcnlJbmRleCA9IHRoaXMuY3VycmVudFF1ZXJ5SW5kZXg7XG4gICAgY29udGV4dC5jdXJyZW50UXVlcnlUb3RhbCA9IHRoaXMuY3VycmVudFF1ZXJ5VG90YWw7XG4gICAgY29udGV4dC5wYXJlbnRDb250ZXh0ID0gdGhpcztcbiAgICB0aGlzLnN1YkNvbnRleHRDb3VudCsrO1xuICAgIHJldHVybiBjb250ZXh0O1xuICB9XG5cbiAgdHJhbnNmb3JtSW50b05ld1RpbWVsaW5lKG5ld1RpbWU/OiBudW1iZXIpIHtcbiAgICB0aGlzLnByZXZpb3VzTm9kZSA9IERFRkFVTFRfTk9PUF9QUkVWSU9VU19OT0RFO1xuICAgIHRoaXMuY3VycmVudFRpbWVsaW5lID0gdGhpcy5jdXJyZW50VGltZWxpbmUuZm9yayh0aGlzLmVsZW1lbnQsIG5ld1RpbWUpO1xuICAgIHRoaXMudGltZWxpbmVzLnB1c2godGhpcy5jdXJyZW50VGltZWxpbmUpO1xuICAgIHJldHVybiB0aGlzLmN1cnJlbnRUaW1lbGluZTtcbiAgfVxuXG4gIGFwcGVuZEluc3RydWN0aW9uVG9UaW1lbGluZShcbiAgICAgIGluc3RydWN0aW9uOiBBbmltYXRpb25UaW1lbGluZUluc3RydWN0aW9uLCBkdXJhdGlvbjogbnVtYmVyfG51bGwsXG4gICAgICBkZWxheTogbnVtYmVyfG51bGwpOiBBbmltYXRlVGltaW5ncyB7XG4gICAgY29uc3QgdXBkYXRlZFRpbWluZ3M6IEFuaW1hdGVUaW1pbmdzID0ge1xuICAgICAgZHVyYXRpb246IGR1cmF0aW9uICE9IG51bGwgPyBkdXJhdGlvbiA6IGluc3RydWN0aW9uLmR1cmF0aW9uLFxuICAgICAgZGVsYXk6IHRoaXMuY3VycmVudFRpbWVsaW5lLmN1cnJlbnRUaW1lICsgKGRlbGF5ICE9IG51bGwgPyBkZWxheSA6IDApICsgaW5zdHJ1Y3Rpb24uZGVsYXksXG4gICAgICBlYXNpbmc6ICcnXG4gICAgfTtcbiAgICBjb25zdCBidWlsZGVyID0gbmV3IFN1YlRpbWVsaW5lQnVpbGRlcihcbiAgICAgICAgdGhpcy5fZHJpdmVyLCBpbnN0cnVjdGlvbi5lbGVtZW50LCBpbnN0cnVjdGlvbi5rZXlmcmFtZXMsIGluc3RydWN0aW9uLnByZVN0eWxlUHJvcHMsXG4gICAgICAgIGluc3RydWN0aW9uLnBvc3RTdHlsZVByb3BzLCB1cGRhdGVkVGltaW5ncywgaW5zdHJ1Y3Rpb24uc3RyZXRjaFN0YXJ0aW5nS2V5ZnJhbWUpO1xuICAgIHRoaXMudGltZWxpbmVzLnB1c2goYnVpbGRlcik7XG4gICAgcmV0dXJuIHVwZGF0ZWRUaW1pbmdzO1xuICB9XG5cbiAgaW5jcmVtZW50VGltZSh0aW1lOiBudW1iZXIpIHtcbiAgICB0aGlzLmN1cnJlbnRUaW1lbGluZS5mb3J3YXJkVGltZSh0aGlzLmN1cnJlbnRUaW1lbGluZS5kdXJhdGlvbiArIHRpbWUpO1xuICB9XG5cbiAgZGVsYXlOZXh0U3RlcChkZWxheTogbnVtYmVyKSB7XG4gICAgLy8gbmVnYXRpdmUgZGVsYXlzIGFyZSBub3QgeWV0IHN1cHBvcnRlZFxuICAgIGlmIChkZWxheSA+IDApIHtcbiAgICAgIHRoaXMuY3VycmVudFRpbWVsaW5lLmRlbGF5TmV4dFN0ZXAoZGVsYXkpO1xuICAgIH1cbiAgfVxuXG4gIGludm9rZVF1ZXJ5KFxuICAgICAgc2VsZWN0b3I6IHN0cmluZywgb3JpZ2luYWxTZWxlY3Rvcjogc3RyaW5nLCBsaW1pdDogbnVtYmVyLCBpbmNsdWRlU2VsZjogYm9vbGVhbixcbiAgICAgIG9wdGlvbmFsOiBib29sZWFuLCBlcnJvcnM6IEVycm9yW10pOiBhbnlbXSB7XG4gICAgbGV0IHJlc3VsdHM6IGFueVtdID0gW107XG4gICAgaWYgKGluY2x1ZGVTZWxmKSB7XG4gICAgICByZXN1bHRzLnB1c2godGhpcy5lbGVtZW50KTtcbiAgICB9XG4gICAgaWYgKHNlbGVjdG9yLmxlbmd0aCA+IDApIHsgIC8vIG9ubHkgaWYgOnNlbGYgaXMgdXNlZCB0aGVuIHRoZSBzZWxlY3RvciBjYW4gYmUgZW1wdHlcbiAgICAgIHNlbGVjdG9yID0gc2VsZWN0b3IucmVwbGFjZShFTlRFUl9UT0tFTl9SRUdFWCwgJy4nICsgdGhpcy5fZW50ZXJDbGFzc05hbWUpO1xuICAgICAgc2VsZWN0b3IgPSBzZWxlY3Rvci5yZXBsYWNlKExFQVZFX1RPS0VOX1JFR0VYLCAnLicgKyB0aGlzLl9sZWF2ZUNsYXNzTmFtZSk7XG4gICAgICBjb25zdCBtdWx0aSA9IGxpbWl0ICE9IDE7XG4gICAgICBsZXQgZWxlbWVudHMgPSB0aGlzLl9kcml2ZXIucXVlcnkodGhpcy5lbGVtZW50LCBzZWxlY3RvciwgbXVsdGkpO1xuICAgICAgaWYgKGxpbWl0ICE9PSAwKSB7XG4gICAgICAgIGVsZW1lbnRzID0gbGltaXQgPCAwID8gZWxlbWVudHMuc2xpY2UoZWxlbWVudHMubGVuZ3RoICsgbGltaXQsIGVsZW1lbnRzLmxlbmd0aCkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLnNsaWNlKDAsIGxpbWl0KTtcbiAgICAgIH1cbiAgICAgIHJlc3VsdHMucHVzaCguLi5lbGVtZW50cyk7XG4gICAgfVxuXG4gICAgaWYgKCFvcHRpb25hbCAmJiByZXN1bHRzLmxlbmd0aCA9PSAwKSB7XG4gICAgICBlcnJvcnMucHVzaChpbnZhbGlkUXVlcnkob3JpZ2luYWxTZWxlY3RvcikpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVGltZWxpbmVCdWlsZGVyIHtcbiAgcHVibGljIGR1cmF0aW9uOiBudW1iZXIgPSAwO1xuICAvLyBUT0RPKGlzc3VlLzI0NTcxKTogcmVtb3ZlICchJy5cbiAgcHVibGljIGVhc2luZyE6IHN0cmluZ3xudWxsO1xuICBwcml2YXRlIF9wcmV2aW91c0tleWZyYW1lOiDJtVN0eWxlRGF0YU1hcCA9IG5ldyBNYXAoKTtcbiAgcHJpdmF0ZSBfY3VycmVudEtleWZyYW1lOiDJtVN0eWxlRGF0YU1hcCA9IG5ldyBNYXAoKTtcbiAgcHJpdmF0ZSBfa2V5ZnJhbWVzID0gbmV3IE1hcDxudW1iZXIsIMm1U3R5bGVEYXRhTWFwPigpO1xuICBwcml2YXRlIF9zdHlsZVN1bW1hcnkgPSBuZXcgTWFwPHN0cmluZywgU3R5bGVBdFRpbWU+KCk7XG4gIHByaXZhdGUgX2xvY2FsVGltZWxpbmVTdHlsZXM6IMm1U3R5bGVEYXRhTWFwID0gbmV3IE1hcCgpO1xuICBwcml2YXRlIF9nbG9iYWxUaW1lbGluZVN0eWxlczogybVTdHlsZURhdGFNYXA7XG4gIHByaXZhdGUgX3BlbmRpbmdTdHlsZXM6IMm1U3R5bGVEYXRhTWFwID0gbmV3IE1hcCgpO1xuICBwcml2YXRlIF9iYWNrRmlsbDogybVTdHlsZURhdGFNYXAgPSBuZXcgTWFwKCk7XG4gIHByaXZhdGUgX2N1cnJlbnRFbXB0eVN0ZXBLZXlmcmFtZTogybVTdHlsZURhdGFNYXB8bnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIF9kcml2ZXI6IEFuaW1hdGlvbkRyaXZlciwgcHVibGljIGVsZW1lbnQ6IGFueSwgcHVibGljIHN0YXJ0VGltZTogbnVtYmVyLFxuICAgICAgcHJpdmF0ZSBfZWxlbWVudFRpbWVsaW5lU3R5bGVzTG9va3VwPzogTWFwPGFueSwgybVTdHlsZURhdGFNYXA+KSB7XG4gICAgaWYgKCF0aGlzLl9lbGVtZW50VGltZWxpbmVTdHlsZXNMb29rdXApIHtcbiAgICAgIHRoaXMuX2VsZW1lbnRUaW1lbGluZVN0eWxlc0xvb2t1cCA9IG5ldyBNYXA8YW55LCDJtVN0eWxlRGF0YU1hcD4oKTtcbiAgICB9XG5cbiAgICB0aGlzLl9nbG9iYWxUaW1lbGluZVN0eWxlcyA9IHRoaXMuX2VsZW1lbnRUaW1lbGluZVN0eWxlc0xvb2t1cC5nZXQoZWxlbWVudCkhO1xuICAgIGlmICghdGhpcy5fZ2xvYmFsVGltZWxpbmVTdHlsZXMpIHtcbiAgICAgIHRoaXMuX2dsb2JhbFRpbWVsaW5lU3R5bGVzID0gdGhpcy5fbG9jYWxUaW1lbGluZVN0eWxlcztcbiAgICAgIHRoaXMuX2VsZW1lbnRUaW1lbGluZVN0eWxlc0xvb2t1cC5zZXQoZWxlbWVudCwgdGhpcy5fbG9jYWxUaW1lbGluZVN0eWxlcyk7XG4gICAgfVxuICAgIHRoaXMuX2xvYWRLZXlmcmFtZSgpO1xuICB9XG5cbiAgY29udGFpbnNBbmltYXRpb24oKTogYm9vbGVhbiB7XG4gICAgc3dpdGNoICh0aGlzLl9rZXlmcmFtZXMuc2l6ZSkge1xuICAgICAgY2FzZSAwOlxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICBjYXNlIDE6XG4gICAgICAgIHJldHVybiB0aGlzLmhhc0N1cnJlbnRTdHlsZVByb3BlcnRpZXMoKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIGhhc0N1cnJlbnRTdHlsZVByb3BlcnRpZXMoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuX2N1cnJlbnRLZXlmcmFtZS5zaXplID4gMDtcbiAgfVxuXG4gIGdldCBjdXJyZW50VGltZSgpIHtcbiAgICByZXR1cm4gdGhpcy5zdGFydFRpbWUgKyB0aGlzLmR1cmF0aW9uO1xuICB9XG5cbiAgZGVsYXlOZXh0U3RlcChkZWxheTogbnVtYmVyKSB7XG4gICAgLy8gaW4gdGhlIGV2ZW50IHRoYXQgYSBzdHlsZSgpIHN0ZXAgaXMgcGxhY2VkIHJpZ2h0IGJlZm9yZSBhIHN0YWdnZXIoKVxuICAgIC8vIGFuZCB0aGF0IHN0eWxlKCkgc3RlcCBpcyB0aGUgdmVyeSBmaXJzdCBzdHlsZSgpIHZhbHVlIGluIHRoZSBhbmltYXRpb25cbiAgICAvLyB0aGVuIHdlIG5lZWQgdG8gbWFrZSBhIGNvcHkgb2YgdGhlIGtleWZyYW1lIFswLCBjb3B5LCAxXSBzbyB0aGF0IHRoZSBkZWxheVxuICAgIC8vIHByb3Blcmx5IGFwcGxpZXMgdGhlIHN0eWxlKCkgdmFsdWVzIHRvIHdvcmsgd2l0aCB0aGUgc3RhZ2dlci4uLlxuICAgIGNvbnN0IGhhc1ByZVN0eWxlU3RlcCA9IHRoaXMuX2tleWZyYW1lcy5zaXplID09PSAxICYmIHRoaXMuX3BlbmRpbmdTdHlsZXMuc2l6ZTtcblxuICAgIGlmICh0aGlzLmR1cmF0aW9uIHx8IGhhc1ByZVN0eWxlU3RlcCkge1xuICAgICAgdGhpcy5mb3J3YXJkVGltZSh0aGlzLmN1cnJlbnRUaW1lICsgZGVsYXkpO1xuICAgICAgaWYgKGhhc1ByZVN0eWxlU3RlcCkge1xuICAgICAgICB0aGlzLnNuYXBzaG90Q3VycmVudFN0eWxlcygpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnN0YXJ0VGltZSArPSBkZWxheTtcbiAgICB9XG4gIH1cblxuICBmb3JrKGVsZW1lbnQ6IGFueSwgY3VycmVudFRpbWU/OiBudW1iZXIpOiBUaW1lbGluZUJ1aWxkZXIge1xuICAgIHRoaXMuYXBwbHlTdHlsZXNUb0tleWZyYW1lKCk7XG4gICAgcmV0dXJuIG5ldyBUaW1lbGluZUJ1aWxkZXIoXG4gICAgICAgIHRoaXMuX2RyaXZlciwgZWxlbWVudCwgY3VycmVudFRpbWUgfHwgdGhpcy5jdXJyZW50VGltZSwgdGhpcy5fZWxlbWVudFRpbWVsaW5lU3R5bGVzTG9va3VwKTtcbiAgfVxuXG4gIHByaXZhdGUgX2xvYWRLZXlmcmFtZSgpIHtcbiAgICBpZiAodGhpcy5fY3VycmVudEtleWZyYW1lKSB7XG4gICAgICB0aGlzLl9wcmV2aW91c0tleWZyYW1lID0gdGhpcy5fY3VycmVudEtleWZyYW1lO1xuICAgIH1cbiAgICB0aGlzLl9jdXJyZW50S2V5ZnJhbWUgPSB0aGlzLl9rZXlmcmFtZXMuZ2V0KHRoaXMuZHVyYXRpb24pITtcbiAgICBpZiAoIXRoaXMuX2N1cnJlbnRLZXlmcmFtZSkge1xuICAgICAgdGhpcy5fY3VycmVudEtleWZyYW1lID0gbmV3IE1hcCgpO1xuICAgICAgdGhpcy5fa2V5ZnJhbWVzLnNldCh0aGlzLmR1cmF0aW9uLCB0aGlzLl9jdXJyZW50S2V5ZnJhbWUpO1xuICAgIH1cbiAgfVxuXG4gIGZvcndhcmRGcmFtZSgpIHtcbiAgICB0aGlzLmR1cmF0aW9uICs9IE9ORV9GUkFNRV9JTl9NSUxMSVNFQ09ORFM7XG4gICAgdGhpcy5fbG9hZEtleWZyYW1lKCk7XG4gIH1cblxuICBmb3J3YXJkVGltZSh0aW1lOiBudW1iZXIpIHtcbiAgICB0aGlzLmFwcGx5U3R5bGVzVG9LZXlmcmFtZSgpO1xuICAgIHRoaXMuZHVyYXRpb24gPSB0aW1lO1xuICAgIHRoaXMuX2xvYWRLZXlmcmFtZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBfdXBkYXRlU3R5bGUocHJvcDogc3RyaW5nLCB2YWx1ZTogc3RyaW5nfG51bWJlcikge1xuICAgIHRoaXMuX2xvY2FsVGltZWxpbmVTdHlsZXMuc2V0KHByb3AsIHZhbHVlKTtcbiAgICB0aGlzLl9nbG9iYWxUaW1lbGluZVN0eWxlcy5zZXQocHJvcCwgdmFsdWUpO1xuICAgIHRoaXMuX3N0eWxlU3VtbWFyeS5zZXQocHJvcCwge3RpbWU6IHRoaXMuY3VycmVudFRpbWUsIHZhbHVlfSk7XG4gIH1cblxuICBhbGxvd09ubHlUaW1lbGluZVN0eWxlcygpIHtcbiAgICByZXR1cm4gdGhpcy5fY3VycmVudEVtcHR5U3RlcEtleWZyYW1lICE9PSB0aGlzLl9jdXJyZW50S2V5ZnJhbWU7XG4gIH1cblxuICBhcHBseUVtcHR5U3RlcChlYXNpbmc6IHN0cmluZ3xudWxsKSB7XG4gICAgaWYgKGVhc2luZykge1xuICAgICAgdGhpcy5fcHJldmlvdXNLZXlmcmFtZS5zZXQoJ2Vhc2luZycsIGVhc2luZyk7XG4gICAgfVxuXG4gICAgLy8gc3BlY2lhbCBjYXNlIGZvciBhbmltYXRlKGR1cmF0aW9uKTpcbiAgICAvLyBhbGwgbWlzc2luZyBzdHlsZXMgYXJlIGZpbGxlZCB3aXRoIGEgYCpgIHZhbHVlIHRoZW5cbiAgICAvLyBpZiBhbnkgZGVzdGluYXRpb24gc3R5bGVzIGFyZSBmaWxsZWQgaW4gbGF0ZXIgb24gdGhlIHNhbWVcbiAgICAvLyBrZXlmcmFtZSB0aGVuIHRoZXkgd2lsbCBvdmVycmlkZSB0aGUgb3ZlcnJpZGRlbiBzdHlsZXNcbiAgICAvLyBXZSB1c2UgYF9nbG9iYWxUaW1lbGluZVN0eWxlc2AgaGVyZSBiZWNhdXNlIHRoZXJlIG1heSBiZVxuICAgIC8vIHN0eWxlcyBpbiBwcmV2aW91cyBrZXlmcmFtZXMgdGhhdCBhcmUgbm90IHByZXNlbnQgaW4gdGhpcyB0aW1lbGluZVxuICAgIGZvciAobGV0IFtwcm9wLCB2YWx1ZV0gb2YgdGhpcy5fZ2xvYmFsVGltZWxpbmVTdHlsZXMpIHtcbiAgICAgIHRoaXMuX2JhY2tGaWxsLnNldChwcm9wLCB2YWx1ZSB8fCBBVVRPX1NUWUxFKTtcbiAgICAgIHRoaXMuX2N1cnJlbnRLZXlmcmFtZS5zZXQocHJvcCwgQVVUT19TVFlMRSk7XG4gICAgfVxuICAgIHRoaXMuX2N1cnJlbnRFbXB0eVN0ZXBLZXlmcmFtZSA9IHRoaXMuX2N1cnJlbnRLZXlmcmFtZTtcbiAgfVxuXG4gIHNldFN0eWxlcyhcbiAgICAgIGlucHV0OiBBcnJheTwoybVTdHlsZURhdGFNYXAgfCBzdHJpbmcpPiwgZWFzaW5nOiBzdHJpbmd8bnVsbCwgZXJyb3JzOiBFcnJvcltdLFxuICAgICAgb3B0aW9ucz86IEFuaW1hdGlvbk9wdGlvbnMpIHtcbiAgICBpZiAoZWFzaW5nKSB7XG4gICAgICB0aGlzLl9wcmV2aW91c0tleWZyYW1lLnNldCgnZWFzaW5nJywgZWFzaW5nKTtcbiAgICB9XG4gICAgY29uc3QgcGFyYW1zID0gKG9wdGlvbnMgJiYgb3B0aW9ucy5wYXJhbXMpIHx8IHt9O1xuICAgIGNvbnN0IHN0eWxlcyA9IGZsYXR0ZW5TdHlsZXMoaW5wdXQsIHRoaXMuX2dsb2JhbFRpbWVsaW5lU3R5bGVzKTtcbiAgICBmb3IgKGxldCBbcHJvcCwgdmFsdWVdIG9mIHN0eWxlcykge1xuICAgICAgY29uc3QgdmFsID0gaW50ZXJwb2xhdGVQYXJhbXModmFsdWUsIHBhcmFtcywgZXJyb3JzKTtcbiAgICAgIHRoaXMuX3BlbmRpbmdTdHlsZXMuc2V0KHByb3AsIHZhbCk7XG4gICAgICBpZiAoIXRoaXMuX2xvY2FsVGltZWxpbmVTdHlsZXMuaGFzKHByb3ApKSB7XG4gICAgICAgIHRoaXMuX2JhY2tGaWxsLnNldChwcm9wLCB0aGlzLl9nbG9iYWxUaW1lbGluZVN0eWxlcy5nZXQocHJvcCkgPz8gQVVUT19TVFlMRSk7XG4gICAgICB9XG4gICAgICB0aGlzLl91cGRhdGVTdHlsZShwcm9wLCB2YWwpO1xuICAgIH1cbiAgfVxuXG4gIGFwcGx5U3R5bGVzVG9LZXlmcmFtZSgpIHtcbiAgICBpZiAodGhpcy5fcGVuZGluZ1N0eWxlcy5zaXplID09IDApIHJldHVybjtcblxuICAgIHRoaXMuX3BlbmRpbmdTdHlsZXMuZm9yRWFjaCgodmFsLCBwcm9wKSA9PiB7XG4gICAgICB0aGlzLl9jdXJyZW50S2V5ZnJhbWUuc2V0KHByb3AsIHZhbCk7XG4gICAgfSk7XG4gICAgdGhpcy5fcGVuZGluZ1N0eWxlcy5jbGVhcigpO1xuXG4gICAgdGhpcy5fbG9jYWxUaW1lbGluZVN0eWxlcy5mb3JFYWNoKCh2YWwsIHByb3ApID0+IHtcbiAgICAgIGlmICghdGhpcy5fY3VycmVudEtleWZyYW1lLmhhcyhwcm9wKSkge1xuICAgICAgICB0aGlzLl9jdXJyZW50S2V5ZnJhbWUuc2V0KHByb3AsIHZhbCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBzbmFwc2hvdEN1cnJlbnRTdHlsZXMoKSB7XG4gICAgZm9yIChsZXQgW3Byb3AsIHZhbF0gb2YgdGhpcy5fbG9jYWxUaW1lbGluZVN0eWxlcykge1xuICAgICAgdGhpcy5fcGVuZGluZ1N0eWxlcy5zZXQocHJvcCwgdmFsKTtcbiAgICAgIHRoaXMuX3VwZGF0ZVN0eWxlKHByb3AsIHZhbCk7XG4gICAgfVxuICB9XG5cbiAgZ2V0RmluYWxLZXlmcmFtZSgpIHtcbiAgICByZXR1cm4gdGhpcy5fa2V5ZnJhbWVzLmdldCh0aGlzLmR1cmF0aW9uKTtcbiAgfVxuXG4gIGdldCBwcm9wZXJ0aWVzKCkge1xuICAgIGNvbnN0IHByb3BlcnRpZXM6IHN0cmluZ1tdID0gW107XG4gICAgZm9yIChsZXQgcHJvcCBpbiB0aGlzLl9jdXJyZW50S2V5ZnJhbWUpIHtcbiAgICAgIHByb3BlcnRpZXMucHVzaChwcm9wKTtcbiAgICB9XG4gICAgcmV0dXJuIHByb3BlcnRpZXM7XG4gIH1cblxuICBtZXJnZVRpbWVsaW5lQ29sbGVjdGVkU3R5bGVzKHRpbWVsaW5lOiBUaW1lbGluZUJ1aWxkZXIpIHtcbiAgICB0aW1lbGluZS5fc3R5bGVTdW1tYXJ5LmZvckVhY2goKGRldGFpbHMxLCBwcm9wKSA9PiB7XG4gICAgICBjb25zdCBkZXRhaWxzMCA9IHRoaXMuX3N0eWxlU3VtbWFyeS5nZXQocHJvcCk7XG4gICAgICBpZiAoIWRldGFpbHMwIHx8IGRldGFpbHMxLnRpbWUgPiBkZXRhaWxzMC50aW1lKSB7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVN0eWxlKHByb3AsIGRldGFpbHMxLnZhbHVlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGJ1aWxkS2V5ZnJhbWVzKCk6IEFuaW1hdGlvblRpbWVsaW5lSW5zdHJ1Y3Rpb24ge1xuICAgIHRoaXMuYXBwbHlTdHlsZXNUb0tleWZyYW1lKCk7XG4gICAgY29uc3QgcHJlU3R5bGVQcm9wcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGNvbnN0IHBvc3RTdHlsZVByb3BzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3QgaXNFbXB0eSA9IHRoaXMuX2tleWZyYW1lcy5zaXplID09PSAxICYmIHRoaXMuZHVyYXRpb24gPT09IDA7XG5cbiAgICBsZXQgZmluYWxLZXlmcmFtZXM6IEFycmF5PMm1U3R5bGVEYXRhTWFwPiA9IFtdO1xuICAgIHRoaXMuX2tleWZyYW1lcy5mb3JFYWNoKChrZXlmcmFtZSwgdGltZSkgPT4ge1xuICAgICAgY29uc3QgZmluYWxLZXlmcmFtZSA9IGNvcHlTdHlsZXMoa2V5ZnJhbWUsIG5ldyBNYXAoKSwgdGhpcy5fYmFja0ZpbGwpO1xuICAgICAgZmluYWxLZXlmcmFtZS5mb3JFYWNoKCh2YWx1ZSwgcHJvcCkgPT4ge1xuICAgICAgICBpZiAodmFsdWUgPT09IFBSRV9TVFlMRSkge1xuICAgICAgICAgIHByZVN0eWxlUHJvcHMuYWRkKHByb3ApO1xuICAgICAgICB9IGVsc2UgaWYgKHZhbHVlID09PSBBVVRPX1NUWUxFKSB7XG4gICAgICAgICAgcG9zdFN0eWxlUHJvcHMuYWRkKHByb3ApO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGlmICghaXNFbXB0eSkge1xuICAgICAgICBmaW5hbEtleWZyYW1lLnNldCgnb2Zmc2V0JywgdGltZSAvIHRoaXMuZHVyYXRpb24pO1xuICAgICAgfVxuICAgICAgZmluYWxLZXlmcmFtZXMucHVzaChmaW5hbEtleWZyYW1lKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IHByZVByb3BzOiBzdHJpbmdbXSA9IHByZVN0eWxlUHJvcHMuc2l6ZSA/IGl0ZXJhdG9yVG9BcnJheShwcmVTdHlsZVByb3BzLnZhbHVlcygpKSA6IFtdO1xuICAgIGNvbnN0IHBvc3RQcm9wczogc3RyaW5nW10gPSBwb3N0U3R5bGVQcm9wcy5zaXplID8gaXRlcmF0b3JUb0FycmF5KHBvc3RTdHlsZVByb3BzLnZhbHVlcygpKSA6IFtdO1xuXG4gICAgLy8gc3BlY2lhbCBjYXNlIGZvciBhIDAtc2Vjb25kIGFuaW1hdGlvbiAod2hpY2ggaXMgZGVzaWduZWQganVzdCB0byBwbGFjZSBzdHlsZXMgb25zY3JlZW4pXG4gICAgaWYgKGlzRW1wdHkpIHtcbiAgICAgIGNvbnN0IGtmMCA9IGZpbmFsS2V5ZnJhbWVzWzBdO1xuICAgICAgY29uc3Qga2YxID0gbmV3IE1hcChrZjApO1xuICAgICAga2YwLnNldCgnb2Zmc2V0JywgMCk7XG4gICAgICBrZjEuc2V0KCdvZmZzZXQnLCAxKTtcbiAgICAgIGZpbmFsS2V5ZnJhbWVzID0gW2tmMCwga2YxXTtcbiAgICB9XG5cbiAgICByZXR1cm4gY3JlYXRlVGltZWxpbmVJbnN0cnVjdGlvbihcbiAgICAgICAgdGhpcy5lbGVtZW50LCBmaW5hbEtleWZyYW1lcywgcHJlUHJvcHMsIHBvc3RQcm9wcywgdGhpcy5kdXJhdGlvbiwgdGhpcy5zdGFydFRpbWUsXG4gICAgICAgIHRoaXMuZWFzaW5nLCBmYWxzZSk7XG4gIH1cbn1cblxuY2xhc3MgU3ViVGltZWxpbmVCdWlsZGVyIGV4dGVuZHMgVGltZWxpbmVCdWlsZGVyIHtcbiAgcHVibGljIHRpbWluZ3M6IEFuaW1hdGVUaW1pbmdzO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgZHJpdmVyOiBBbmltYXRpb25Ecml2ZXIsIGVsZW1lbnQ6IGFueSwgcHVibGljIGtleWZyYW1lczogQXJyYXk8ybVTdHlsZURhdGFNYXA+LFxuICAgICAgcHVibGljIHByZVN0eWxlUHJvcHM6IHN0cmluZ1tdLCBwdWJsaWMgcG9zdFN0eWxlUHJvcHM6IHN0cmluZ1tdLCB0aW1pbmdzOiBBbmltYXRlVGltaW5ncyxcbiAgICAgIHByaXZhdGUgX3N0cmV0Y2hTdGFydGluZ0tleWZyYW1lOiBib29sZWFuID0gZmFsc2UpIHtcbiAgICBzdXBlcihkcml2ZXIsIGVsZW1lbnQsIHRpbWluZ3MuZGVsYXkpO1xuICAgIHRoaXMudGltaW5ncyA9IHtkdXJhdGlvbjogdGltaW5ncy5kdXJhdGlvbiwgZGVsYXk6IHRpbWluZ3MuZGVsYXksIGVhc2luZzogdGltaW5ncy5lYXNpbmd9O1xuICB9XG5cbiAgb3ZlcnJpZGUgY29udGFpbnNBbmltYXRpb24oKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMua2V5ZnJhbWVzLmxlbmd0aCA+IDE7XG4gIH1cblxuICBvdmVycmlkZSBidWlsZEtleWZyYW1lcygpOiBBbmltYXRpb25UaW1lbGluZUluc3RydWN0aW9uIHtcbiAgICBsZXQga2V5ZnJhbWVzID0gdGhpcy5rZXlmcmFtZXM7XG4gICAgbGV0IHtkZWxheSwgZHVyYXRpb24sIGVhc2luZ30gPSB0aGlzLnRpbWluZ3M7XG4gICAgaWYgKHRoaXMuX3N0cmV0Y2hTdGFydGluZ0tleWZyYW1lICYmIGRlbGF5KSB7XG4gICAgICBjb25zdCBuZXdLZXlmcmFtZXM6IEFycmF5PMm1U3R5bGVEYXRhTWFwPiA9IFtdO1xuICAgICAgY29uc3QgdG90YWxUaW1lID0gZHVyYXRpb24gKyBkZWxheTtcbiAgICAgIGNvbnN0IHN0YXJ0aW5nR2FwID0gZGVsYXkgLyB0b3RhbFRpbWU7XG5cbiAgICAgIC8vIHRoZSBvcmlnaW5hbCBzdGFydGluZyBrZXlmcmFtZSBub3cgc3RhcnRzIG9uY2UgdGhlIGRlbGF5IGlzIGRvbmVcbiAgICAgIGNvbnN0IG5ld0ZpcnN0S2V5ZnJhbWUgPSBjb3B5U3R5bGVzKGtleWZyYW1lc1swXSk7XG4gICAgICBuZXdGaXJzdEtleWZyYW1lLnNldCgnb2Zmc2V0JywgMCk7XG4gICAgICBuZXdLZXlmcmFtZXMucHVzaChuZXdGaXJzdEtleWZyYW1lKTtcblxuICAgICAgY29uc3Qgb2xkRmlyc3RLZXlmcmFtZSA9IGNvcHlTdHlsZXMoa2V5ZnJhbWVzWzBdKTtcbiAgICAgIG9sZEZpcnN0S2V5ZnJhbWUuc2V0KCdvZmZzZXQnLCByb3VuZE9mZnNldChzdGFydGluZ0dhcCkpO1xuICAgICAgbmV3S2V5ZnJhbWVzLnB1c2gob2xkRmlyc3RLZXlmcmFtZSk7XG5cbiAgICAgIC8qXG4gICAgICAgIFdoZW4gdGhlIGtleWZyYW1lIGlzIHN0cmV0Y2hlZCB0aGVuIGl0IG1lYW5zIHRoYXQgdGhlIGRlbGF5IGJlZm9yZSB0aGUgYW5pbWF0aW9uXG4gICAgICAgIHN0YXJ0cyBpcyBnb25lLiBJbnN0ZWFkIHRoZSBmaXJzdCBrZXlmcmFtZSBpcyBwbGFjZWQgYXQgdGhlIHN0YXJ0IG9mIHRoZSBhbmltYXRpb25cbiAgICAgICAgYW5kIGl0IGlzIHRoZW4gY29waWVkIHRvIHdoZXJlIGl0IHN0YXJ0cyB3aGVuIHRoZSBvcmlnaW5hbCBkZWxheSBpcyBvdmVyLiBUaGlzIGJhc2ljYWxseVxuICAgICAgICBtZWFucyBub3RoaW5nIGFuaW1hdGVzIGR1cmluZyB0aGF0IGRlbGF5LCBidXQgdGhlIHN0eWxlcyBhcmUgc3RpbGwgcmVuZGVyZWQuIEZvciB0aGlzXG4gICAgICAgIHRvIHdvcmsgdGhlIG9yaWdpbmFsIG9mZnNldCB2YWx1ZXMgdGhhdCBleGlzdCBpbiB0aGUgb3JpZ2luYWwga2V5ZnJhbWVzIG11c3QgYmUgXCJ3YXJwZWRcIlxuICAgICAgICBzbyB0aGF0IHRoZXkgY2FuIHRha2UgdGhlIG5ldyBrZXlmcmFtZSArIGRlbGF5IGludG8gYWNjb3VudC5cblxuICAgICAgICBkZWxheT0xMDAwLCBkdXJhdGlvbj0xMDAwLCBrZXlmcmFtZXMgPSAwIC41IDFcblxuICAgICAgICB0dXJucyBpbnRvXG5cbiAgICAgICAgZGVsYXk9MCwgZHVyYXRpb249MjAwMCwga2V5ZnJhbWVzID0gMCAuMzMgLjY2IDFcbiAgICAgICAqL1xuXG4gICAgICAvLyBvZmZzZXRzIGJldHdlZW4gMSAuLi4gbiAtMSBhcmUgYWxsIHdhcnBlZCBieSB0aGUga2V5ZnJhbWUgc3RyZXRjaFxuICAgICAgY29uc3QgbGltaXQgPSBrZXlmcmFtZXMubGVuZ3RoIC0gMTtcbiAgICAgIGZvciAobGV0IGkgPSAxOyBpIDw9IGxpbWl0OyBpKyspIHtcbiAgICAgICAgbGV0IGtmID0gY29weVN0eWxlcyhrZXlmcmFtZXNbaV0pO1xuICAgICAgICBjb25zdCBvbGRPZmZzZXQgPSBrZi5nZXQoJ29mZnNldCcpIGFzIG51bWJlcjtcbiAgICAgICAgY29uc3QgdGltZUF0S2V5ZnJhbWUgPSBkZWxheSArIG9sZE9mZnNldCAqIGR1cmF0aW9uO1xuICAgICAgICBrZi5zZXQoJ29mZnNldCcsIHJvdW5kT2Zmc2V0KHRpbWVBdEtleWZyYW1lIC8gdG90YWxUaW1lKSk7XG4gICAgICAgIG5ld0tleWZyYW1lcy5wdXNoKGtmKTtcbiAgICAgIH1cblxuICAgICAgLy8gdGhlIG5ldyBzdGFydGluZyBrZXlmcmFtZSBzaG91bGQgYmUgYWRkZWQgYXQgdGhlIHN0YXJ0XG4gICAgICBkdXJhdGlvbiA9IHRvdGFsVGltZTtcbiAgICAgIGRlbGF5ID0gMDtcbiAgICAgIGVhc2luZyA9ICcnO1xuXG4gICAgICBrZXlmcmFtZXMgPSBuZXdLZXlmcmFtZXM7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNyZWF0ZVRpbWVsaW5lSW5zdHJ1Y3Rpb24oXG4gICAgICAgIHRoaXMuZWxlbWVudCwga2V5ZnJhbWVzLCB0aGlzLnByZVN0eWxlUHJvcHMsIHRoaXMucG9zdFN0eWxlUHJvcHMsIGR1cmF0aW9uLCBkZWxheSwgZWFzaW5nLFxuICAgICAgICB0cnVlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiByb3VuZE9mZnNldChvZmZzZXQ6IG51bWJlciwgZGVjaW1hbFBvaW50cyA9IDMpOiBudW1iZXIge1xuICBjb25zdCBtdWx0ID0gTWF0aC5wb3coMTAsIGRlY2ltYWxQb2ludHMgLSAxKTtcbiAgcmV0dXJuIE1hdGgucm91bmQob2Zmc2V0ICogbXVsdCkgLyBtdWx0O1xufVxuXG5mdW5jdGlvbiBmbGF0dGVuU3R5bGVzKGlucHV0OiBBcnJheTwoybVTdHlsZURhdGFNYXAgfCBzdHJpbmcpPiwgYWxsU3R5bGVzOiDJtVN0eWxlRGF0YU1hcCkge1xuICBjb25zdCBzdHlsZXM6IMm1U3R5bGVEYXRhTWFwID0gbmV3IE1hcCgpO1xuICBsZXQgYWxsUHJvcGVydGllczogc3RyaW5nW118SXRlcmFibGVJdGVyYXRvcjxzdHJpbmc+O1xuICBpbnB1dC5mb3JFYWNoKHRva2VuID0+IHtcbiAgICBpZiAodG9rZW4gPT09ICcqJykge1xuICAgICAgYWxsUHJvcGVydGllcyA9IGFsbFByb3BlcnRpZXMgfHwgYWxsU3R5bGVzLmtleXMoKTtcbiAgICAgIGZvciAobGV0IHByb3Agb2YgYWxsUHJvcGVydGllcykge1xuICAgICAgICBzdHlsZXMuc2V0KHByb3AsIEFVVE9fU1RZTEUpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb3B5U3R5bGVzKHRva2VuIGFzIMm1U3R5bGVEYXRhTWFwLCBzdHlsZXMpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBzdHlsZXM7XG59XG4iXX0=
'use strict';
/**
 * @license Angular v14.2.0-next.0
 * (c) 2010-2022 Google LLC. https://angular.io/
 * License: MIT
 */
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
class AsyncStackTaggingZoneSpec {
    constructor(namePrefix, consoleAsyncStackTaggingImpl = console) {
        var _a, _b, _c, _d;
        this.name = 'asyncStackTagging for ' + namePrefix;
        this.scheduleAsyncTask = (_a = consoleAsyncStackTaggingImpl === null || consoleAsyncStackTaggingImpl === void 0 ? void 0 : consoleAsyncStackTaggingImpl.scheduleAsyncTask) !== null && _a !== void 0 ? _a : (() => { });
        this.startAsyncTask = (_b = consoleAsyncStackTaggingImpl === null || consoleAsyncStackTaggingImpl === void 0 ? void 0 : consoleAsyncStackTaggingImpl.startAsyncTask) !== null && _b !== void 0 ? _b : (() => { });
        this.finishAsyncTask = (_c = consoleAsyncStackTaggingImpl === null || consoleAsyncStackTaggingImpl === void 0 ? void 0 : consoleAsyncStackTaggingImpl.finishAsyncTask) !== null && _c !== void 0 ? _c : (() => { });
        this.cancelAsyncTask = (_d = consoleAsyncStackTaggingImpl === null || consoleAsyncStackTaggingImpl === void 0 ? void 0 : consoleAsyncStackTaggingImpl.cancelAsyncTask) !== null && _d !== void 0 ? _d : (() => { });
    }
    onScheduleTask(delegate, current, target, task) {
        var _a;
        task.asyncId = this.scheduleAsyncTask(task.source || task.type, ((_a = task.data) === null || _a === void 0 ? void 0 : _a.isPeriodic) || task.type === 'eventTask');
        return delegate.scheduleTask(target, task);
    }
    onInvokeTask(delegate, currentZone, targetZone, task, applyThis, applyArgs) {
        var _a;
        task.asyncId && this.startAsyncTask(task.asyncId);
        try {
            return delegate.invokeTask(targetZone, task, applyThis, applyArgs);
        }
        finally {
            task.asyncId && this.finishAsyncTask(task.asyncId);
            if (task.type !== 'eventTask' && !((_a = task.data) === null || _a === void 0 ? void 0 : _a.isPeriodic)) {
                task.asyncId = undefined;
            }
        }
    }
    onCancelTask(delegate, currentZone, targetZone, task) {
        task.asyncId && this.cancelAsyncTask(task.asyncId);
        task.asyncId = undefined;
        return delegate.cancelTask(targetZone, task);
    }
}
// Export the class so that new instances can be created with proper
// constructor params.
Zone['AsyncStackTaggingZoneSpec'] = AsyncStackTaggingZoneSpec;

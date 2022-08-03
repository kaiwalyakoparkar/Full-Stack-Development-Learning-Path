/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { analytics } from '@angular-devkit/core';
import { AnalyticsCollector } from './analytics-collector';
export declare const AnalyticsProperties: {
    AngularCliProd: string;
    AngularCliStaging: string;
    readonly AngularCliDefault: string;
};
/**
 * This is the ultimate safelist for checking if a package name is safe to report to analytics.
 */
export declare const analyticsPackageSafelist: (string | RegExp)[];
export declare function isPackageNameSafeForAnalytics(name: string): boolean;
/**
 * Set analytics settings. This does not work if the user is not inside a project.
 * @param global Which config to use. "global" for user-level, and "local" for project-level.
 * @param value Either a user ID, true to generate a new User ID, or false to disable analytics.
 */
export declare function setAnalyticsConfig(global: boolean, value: string | boolean): Promise<void>;
/**
 * Prompt the user for usage gathering permission.
 * @param force Whether to ask regardless of whether or not the user is using an interactive shell.
 * @return Whether or not the user was shown a prompt.
 */
export declare function promptAnalytics(global: boolean, force?: boolean): Promise<boolean>;
/**
 * Get the analytics object for the user.
 *
 * @returns
 * - `AnalyticsCollector` when enabled.
 * - `analytics.NoopAnalytics` when disabled.
 * - `undefined` when not configured.
 */
export declare function getAnalytics(level: 'local' | 'global'): Promise<AnalyticsCollector | analytics.NoopAnalytics | undefined>;
/**
 * Return the usage analytics sharing setting, which is either a property string (GA-XXXXXXX-XX),
 * or undefined if no sharing.
 */
export declare function getSharedAnalytics(): Promise<AnalyticsCollector | undefined>;
export declare function createAnalytics(workspace: boolean, skipPrompt?: boolean): Promise<analytics.Analytics>;
export declare function getAnalyticsInfoString(): Promise<string>;

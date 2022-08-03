/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <amd-module name="@angular/compiler-cli/src/ngtsc/annotations/component/src/handler" />
import { ConstantPool } from '@angular/compiler';
import ts from 'typescript';
import { CycleAnalyzer, CycleHandlingStrategy } from '../../../cycles';
import { ModuleResolver, ReferenceEmitter } from '../../../imports';
import { DependencyTracker } from '../../../incremental/api';
import { SemanticDepGraphUpdater } from '../../../incremental/semantic_graph';
import { IndexingContext } from '../../../indexer';
import { InjectableClassRegistry, MetadataReader, MetadataRegistry, ResourceRegistry } from '../../../metadata';
import { PartialEvaluator } from '../../../partial_evaluator';
import { PerfRecorder } from '../../../perf';
import { ClassDeclaration, Decorator, ReflectionHost } from '../../../reflection';
import { ComponentScopeReader, DtsModuleScopeResolver, LocalModuleScopeRegistry, TypeCheckScopeRegistry } from '../../../scope';
import { AnalysisOutput, CompileResult, DecoratorHandler, DetectResult, HandlerFlags, HandlerPrecedence, ResolveResult } from '../../../transform';
import { TypeCheckContext } from '../../../typecheck/api';
import { ExtendedTemplateChecker } from '../../../typecheck/extended/api';
import { Xi18nContext } from '../../../xi18n';
import { ResourceLoader } from '../../common';
import { ComponentAnalysisData, ComponentResolutionData } from './metadata';
import { ComponentSymbol } from './symbol';
/**
 * `DecoratorHandler` which handles the `@Component` annotation.
 */
export declare class ComponentDecoratorHandler implements DecoratorHandler<Decorator, ComponentAnalysisData, ComponentSymbol, ComponentResolutionData> {
    private reflector;
    private evaluator;
    private metaRegistry;
    private metaReader;
    private scopeReader;
    private dtsScopeReader;
    private scopeRegistry;
    private typeCheckScopeRegistry;
    private resourceRegistry;
    private isCore;
    private resourceLoader;
    private rootDirs;
    private defaultPreserveWhitespaces;
    private i18nUseExternalIds;
    private enableI18nLegacyMessageIdFormat;
    private usePoisonedData;
    private i18nNormalizeLineEndingsInICUs;
    private moduleResolver;
    private cycleAnalyzer;
    private cycleHandlingStrategy;
    private refEmitter;
    private depTracker;
    private injectableRegistry;
    private semanticDepGraphUpdater;
    private annotateForClosureCompiler;
    private perf;
    constructor(reflector: ReflectionHost, evaluator: PartialEvaluator, metaRegistry: MetadataRegistry, metaReader: MetadataReader, scopeReader: ComponentScopeReader, dtsScopeReader: DtsModuleScopeResolver, scopeRegistry: LocalModuleScopeRegistry, typeCheckScopeRegistry: TypeCheckScopeRegistry, resourceRegistry: ResourceRegistry, isCore: boolean, resourceLoader: ResourceLoader, rootDirs: ReadonlyArray<string>, defaultPreserveWhitespaces: boolean, i18nUseExternalIds: boolean, enableI18nLegacyMessageIdFormat: boolean, usePoisonedData: boolean, i18nNormalizeLineEndingsInICUs: boolean, moduleResolver: ModuleResolver, cycleAnalyzer: CycleAnalyzer, cycleHandlingStrategy: CycleHandlingStrategy, refEmitter: ReferenceEmitter, depTracker: DependencyTracker | null, injectableRegistry: InjectableClassRegistry, semanticDepGraphUpdater: SemanticDepGraphUpdater | null, annotateForClosureCompiler: boolean, perf: PerfRecorder);
    private literalCache;
    private elementSchemaRegistry;
    /**
     * During the asynchronous preanalyze phase, it's necessary to parse the template to extract
     * any potential <link> tags which might need to be loaded. This cache ensures that work is not
     * thrown away, and the parsed template is reused during the analyze phase.
     */
    private preanalyzeTemplateCache;
    private preanalyzeStylesCache;
    private extractTemplateOptions;
    readonly precedence = HandlerPrecedence.PRIMARY;
    readonly name: string;
    detect(node: ClassDeclaration, decorators: Decorator[] | null): DetectResult<Decorator> | undefined;
    preanalyze(node: ClassDeclaration, decorator: Readonly<Decorator>): Promise<void> | undefined;
    analyze(node: ClassDeclaration, decorator: Readonly<Decorator>, flags?: HandlerFlags): AnalysisOutput<ComponentAnalysisData>;
    symbol(node: ClassDeclaration, analysis: Readonly<ComponentAnalysisData>): ComponentSymbol;
    register(node: ClassDeclaration, analysis: ComponentAnalysisData): void;
    index(context: IndexingContext, node: ClassDeclaration, analysis: Readonly<ComponentAnalysisData>): null | undefined;
    typeCheck(ctx: TypeCheckContext, node: ClassDeclaration, meta: Readonly<ComponentAnalysisData>): void;
    extendedTemplateCheck(component: ts.ClassDeclaration, extendedTemplateChecker: ExtendedTemplateChecker): ts.Diagnostic[];
    resolve(node: ClassDeclaration, analysis: Readonly<ComponentAnalysisData>, symbol: ComponentSymbol): ResolveResult<ComponentResolutionData>;
    xi18n(ctx: Xi18nContext, node: ClassDeclaration, analysis: Readonly<ComponentAnalysisData>): void;
    updateResources(node: ClassDeclaration, analysis: ComponentAnalysisData): void;
    compileFull(node: ClassDeclaration, analysis: Readonly<ComponentAnalysisData>, resolution: Readonly<ComponentResolutionData>, pool: ConstantPool): CompileResult[];
    compilePartial(node: ClassDeclaration, analysis: Readonly<ComponentAnalysisData>, resolution: Readonly<ComponentResolutionData>): CompileResult[];
    /**
     * Check whether adding an import from `origin` to the source-file corresponding to `expr` would
     * create a cyclic import.
     *
     * @returns a `Cycle` object if a cycle would be created, otherwise `null`.
     */
    private _checkForCyclicImport;
    private maybeRecordSyntheticImport;
}

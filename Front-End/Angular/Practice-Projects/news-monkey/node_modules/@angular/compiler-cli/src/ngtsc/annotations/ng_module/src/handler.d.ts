/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <amd-module name="@angular/compiler-cli/src/ngtsc/annotations/ng_module/src/handler" />
import { Expression, R3ClassMetadata, R3FactoryMetadata, R3InjectorMetadata, R3NgModuleMetadata, SchemaMetadata } from '@angular/compiler';
import ts from 'typescript';
import { Reference, ReferenceEmitter } from '../../../imports';
import { SemanticReference, SemanticSymbol } from '../../../incremental/semantic_graph';
import { InjectableClassRegistry, MetadataReader, MetadataRegistry } from '../../../metadata';
import { PartialEvaluator } from '../../../partial_evaluator';
import { PerfRecorder } from '../../../perf';
import { ClassDeclaration, Decorator, ReflectionHost } from '../../../reflection';
import { LocalModuleScopeRegistry } from '../../../scope';
import { FactoryTracker } from '../../../shims/api';
import { AnalysisOutput, CompileResult, DecoratorHandler, DetectResult, HandlerPrecedence, ResolveResult } from '../../../transform';
import { ReferencesRegistry } from '../../common';
export interface NgModuleAnalysis {
    mod: R3NgModuleMetadata;
    inj: Omit<R3InjectorMetadata, 'imports'>;
    fac: R3FactoryMetadata;
    classMetadata: R3ClassMetadata | null;
    declarations: Reference<ClassDeclaration>[];
    rawDeclarations: ts.Expression | null;
    schemas: SchemaMetadata[];
    imports: TopLevelImportedExpression[];
    importRefs: Reference<ClassDeclaration>[];
    rawImports: ts.Expression | null;
    exports: Reference<ClassDeclaration>[];
    rawExports: ts.Expression | null;
    id: Expression | null;
    factorySymbolName: string;
    providersRequiringFactory: Set<Reference<ClassDeclaration>> | null;
    providers: ts.Expression | null;
    remoteScopesMayRequireCycleProtection: boolean;
}
export interface NgModuleResolution {
    injectorImports: Expression[];
}
/**
 * Represents an Angular NgModule.
 */
export declare class NgModuleSymbol extends SemanticSymbol {
    private remotelyScopedComponents;
    isPublicApiAffected(previousSymbol: SemanticSymbol): boolean;
    isEmitAffected(previousSymbol: SemanticSymbol): boolean;
    isTypeCheckApiAffected(previousSymbol: SemanticSymbol): boolean;
    addRemotelyScopedComponent(component: SemanticSymbol, usedDirectives: SemanticReference[], usedPipes: SemanticReference[]): void;
}
/**
 * Compiles @NgModule annotations to ngModuleDef fields.
 */
export declare class NgModuleDecoratorHandler implements DecoratorHandler<Decorator, NgModuleAnalysis, NgModuleSymbol, NgModuleResolution> {
    private reflector;
    private evaluator;
    private metaReader;
    private metaRegistry;
    private scopeRegistry;
    private referencesRegistry;
    private isCore;
    private refEmitter;
    private factoryTracker;
    private annotateForClosureCompiler;
    private onlyPublishPublicTypings;
    private injectableRegistry;
    private perf;
    constructor(reflector: ReflectionHost, evaluator: PartialEvaluator, metaReader: MetadataReader, metaRegistry: MetadataRegistry, scopeRegistry: LocalModuleScopeRegistry, referencesRegistry: ReferencesRegistry, isCore: boolean, refEmitter: ReferenceEmitter, factoryTracker: FactoryTracker | null, annotateForClosureCompiler: boolean, onlyPublishPublicTypings: boolean, injectableRegistry: InjectableClassRegistry, perf: PerfRecorder);
    readonly precedence = HandlerPrecedence.PRIMARY;
    readonly name: string;
    detect(node: ClassDeclaration, decorators: Decorator[] | null): DetectResult<Decorator> | undefined;
    analyze(node: ClassDeclaration, decorator: Readonly<Decorator>): AnalysisOutput<NgModuleAnalysis>;
    symbol(node: ClassDeclaration): NgModuleSymbol;
    register(node: ClassDeclaration, analysis: NgModuleAnalysis): void;
    resolve(node: ClassDeclaration, analysis: Readonly<NgModuleAnalysis>): ResolveResult<NgModuleResolution>;
    compileFull(node: ClassDeclaration, { inj, mod, fac, classMetadata, declarations, remoteScopesMayRequireCycleProtection }: Readonly<NgModuleAnalysis>, { injectorImports }: Readonly<NgModuleResolution>): CompileResult[];
    compilePartial(node: ClassDeclaration, { inj, fac, mod, classMetadata }: Readonly<NgModuleAnalysis>, { injectorImports }: Readonly<NgModuleResolution>): CompileResult[];
    /**
     * Add class metadata statements, if provided, to the `ngModuleStatements`.
     */
    private insertMetadataStatement;
    /**
     * Add remote scoping statements, as needed, to the `ngModuleStatements`.
     */
    private appendRemoteScopingStatements;
    private compileNgModule;
    private _toR3Reference;
    private isClassDeclarationReference;
    /**
     * Compute a list of `Reference`s from a resolved metadata value.
     */
    private resolveTypeList;
}
export interface TopLevelImportedExpression {
    expression: ts.Expression;
    resolvedReferences: Array<Reference<ClassDeclaration>>;
    hasModuleWithProviders: boolean;
}

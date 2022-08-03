/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/core/schematics/utils/typescript/imports", ["require", "exports", "typescript"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.findImportSpecifier = exports.replaceImport = exports.getImportSpecifier = exports.getImportOfIdentifier = void 0;
    const typescript_1 = __importDefault(require("typescript"));
    /** Gets import information about the specified identifier by using the Type checker. */
    function getImportOfIdentifier(typeChecker, node) {
        const symbol = typeChecker.getSymbolAtLocation(node);
        if (!symbol || symbol.declarations === undefined || !symbol.declarations.length) {
            return null;
        }
        const decl = symbol.declarations[0];
        if (!typescript_1.default.isImportSpecifier(decl)) {
            return null;
        }
        const importDecl = decl.parent.parent.parent;
        if (!typescript_1.default.isStringLiteral(importDecl.moduleSpecifier)) {
            return null;
        }
        return {
            // Handles aliased imports: e.g. "import {Component as myComp} from ...";
            name: decl.propertyName ? decl.propertyName.text : decl.name.text,
            importModule: importDecl.moduleSpecifier.text,
            node: importDecl
        };
    }
    exports.getImportOfIdentifier = getImportOfIdentifier;
    /**
     * Gets a top-level import specifier with a specific name that is imported from a particular module.
     * E.g. given a file that looks like:
     *
     * ```
     * import { Component, Directive } from '@angular/core';
     * import { Foo } from './foo';
     * ```
     *
     * Calling `getImportSpecifier(sourceFile, '@angular/core', 'Directive')` will yield the node
     * referring to `Directive` in the top import.
     *
     * @param sourceFile File in which to look for imports.
     * @param moduleName Name of the import's module.
     * @param specifierName Original name of the specifier to look for. Aliases will be resolved to
     *    their original name.
     */
    function getImportSpecifier(sourceFile, moduleName, specifierName) {
        for (const node of sourceFile.statements) {
            if (typescript_1.default.isImportDeclaration(node) && typescript_1.default.isStringLiteral(node.moduleSpecifier) &&
                node.moduleSpecifier.text === moduleName) {
                const namedBindings = node.importClause && node.importClause.namedBindings;
                if (namedBindings && typescript_1.default.isNamedImports(namedBindings)) {
                    const match = findImportSpecifier(namedBindings.elements, specifierName);
                    if (match) {
                        return match;
                    }
                }
            }
        }
        return null;
    }
    exports.getImportSpecifier = getImportSpecifier;
    /**
     * Replaces an import inside a named imports node with a different one.
     * @param node Node that contains the imports.
     * @param existingImport Import that should be replaced.
     * @param newImportName Import that should be inserted.
     */
    function replaceImport(node, existingImport, newImportName) {
        const isAlreadyImported = findImportSpecifier(node.elements, newImportName);
        if (isAlreadyImported) {
            return node;
        }
        const existingImportNode = findImportSpecifier(node.elements, existingImport);
        if (!existingImportNode) {
            return node;
        }
        const importPropertyName = existingImportNode.propertyName ? typescript_1.default.factory.createIdentifier(newImportName) : undefined;
        const importName = existingImportNode.propertyName ? existingImportNode.name :
            typescript_1.default.factory.createIdentifier(newImportName);
        return typescript_1.default.factory.updateNamedImports(node, [
            ...node.elements.filter(current => current !== existingImportNode),
            // Create a new import while trying to preserve the alias of the old one.
            typescript_1.default.factory.createImportSpecifier(false, importPropertyName, importName)
        ]);
    }
    exports.replaceImport = replaceImport;
    /** Finds an import specifier with a particular name. */
    function findImportSpecifier(nodes, specifierName) {
        return nodes.find(element => {
            const { name, propertyName } = element;
            return propertyName ? propertyName.text === specifierName : name.text === specifierName;
        });
    }
    exports.findImportSpecifier = findImportSpecifier;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1wb3J0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc2NoZW1hdGljcy91dGlscy90eXBlc2NyaXB0L2ltcG9ydHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7O0lBRUgsNERBQTRCO0lBUTVCLHdGQUF3RjtJQUN4RixTQUFnQixxQkFBcUIsQ0FBQyxXQUEyQixFQUFFLElBQW1CO1FBRXBGLE1BQU0sTUFBTSxHQUFHLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVyRCxJQUFJLENBQUMsTUFBTSxJQUFJLE1BQU0sQ0FBQyxZQUFZLEtBQUssU0FBUyxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUU7WUFDL0UsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUVELE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFcEMsSUFBSSxDQUFDLG9CQUFFLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDL0IsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUVELE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUU3QyxJQUFJLENBQUMsb0JBQUUsQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxFQUFFO1lBQ25ELE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFFRCxPQUFPO1lBQ0wseUVBQXlFO1lBQ3pFLElBQUksRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJO1lBQ2pFLFlBQVksRUFBRSxVQUFVLENBQUMsZUFBZSxDQUFDLElBQUk7WUFDN0MsSUFB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aHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5leHBvcnQgdHlwZSBJbXBvcnQgPSB7XG4gIG5hbWU6IHN0cmluZyxcbiAgaW1wb3J0TW9kdWxlOiBzdHJpbmcsXG4gIG5vZGU6IHRzLkltcG9ydERlY2xhcmF0aW9uXG59O1xuXG4vKiogR2V0cyBpbXBvcnQgaW5mb3JtYXRpb24gYWJvdXQgdGhlIHNwZWNpZmllZCBpZGVudGlmaWVyIGJ5IHVzaW5nIHRoZSBUeXBlIGNoZWNrZXIuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW1wb3J0T2ZJZGVudGlmaWVyKHR5cGVDaGVja2VyOiB0cy5UeXBlQ2hlY2tlciwgbm9kZTogdHMuSWRlbnRpZmllcik6IEltcG9ydHxcbiAgICBudWxsIHtcbiAgY29uc3Qgc3ltYm9sID0gdHlwZUNoZWNrZXIuZ2V0U3ltYm9sQXRMb2NhdGlvbihub2RlKTtcblxuICBpZiAoIXN5bWJvbCB8fCBzeW1ib2wuZGVjbGFyYXRpb25zID09PSB1bmRlZmluZWQgfHwgIXN5bWJvbC5kZWNsYXJhdGlvbnMubGVuZ3RoKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBkZWNsID0gc3ltYm9sLmRlY2xhcmF0aW9uc1swXTtcblxuICBpZiAoIXRzLmlzSW1wb3J0U3BlY2lmaWVyKGRlY2wpKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBpbXBvcnREZWNsID0gZGVjbC5wYXJlbnQucGFyZW50LnBhcmVudDtcblxuICBpZiAoIXRzLmlzU3RyaW5nTGl0ZXJhbChpbXBvcnREZWNsLm1vZHVsZVNwZWNpZmllcikpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgLy8gSGFuZGxlcyBhbGlhc2VkIGltcG9ydHM6IGUuZy4gXCJpbXBvcnQge0NvbXBvbmVudCBhcyBteUNvbXB9IGZyb20gLi4uXCI7XG4gICAgbmFtZTogZGVjbC5wcm9wZXJ0eU5hbWUgPyBkZWNsLnByb3BlcnR5TmFtZS50ZXh0IDogZGVjbC5uYW1lLnRleHQsXG4gICAgaW1wb3J0TW9kdWxlOiBpbXBvcnREZWNsLm1vZHVsZVNwZWNpZmllci50ZXh0LFxuICAgIG5vZGU6IGltcG9ydERlY2xcbiAgfTtcbn1cblxuXG4vKipcbiAqIEdldHMgYSB0b3AtbGV2ZWwgaW1wb3J0IHNwZWNpZmllciB3aXRoIGEgc3BlY2lmaWMgbmFtZSB0aGF0IGlzIGltcG9ydGVkIGZyb20gYSBwYXJ0aWN1bGFyIG1vZHVsZS5cbiAqIEUuZy4gZ2l2ZW4gYSBmaWxlIHRoYXQgbG9va3MgbGlrZTpcbiAqXG4gKiBgYGBcbiAqIGltcG9ydCB7IENvbXBvbmVudCwgRGlyZWN0aXZlIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG4gKiBpbXBvcnQgeyBGb28gfSBmcm9tICcuL2Zvbyc7XG4gKiBgYGBcbiAqXG4gKiBDYWxsaW5nIGBnZXRJbXBvcnRTcGVjaWZpZXIoc291cmNlRmlsZSwgJ0Bhbmd1bGFyL2NvcmUnLCAnRGlyZWN0aXZlJylgIHdpbGwgeWllbGQgdGhlIG5vZGVcbiAqIHJlZmVycmluZyB0byBgRGlyZWN0aXZlYCBpbiB0aGUgdG9wIGltcG9ydC5cbiAqXG4gKiBAcGFyYW0gc291cmNlRmlsZSBGaWxlIGluIHdoaWNoIHRvIGxvb2sgZm9yIGltcG9ydHMuXG4gKiBAcGFyYW0gbW9kdWxlTmFtZSBOYW1lIG9mIHRoZSBpbXBvcnQncyBtb2R1bGUuXG4gKiBAcGFyYW0gc3BlY2lmaWVyTmFtZSBPcmlnaW5hbCBuYW1lIG9mIHRoZSBzcGVjaWZpZXIgdG8gbG9vayBmb3IuIEFsaWFzZXMgd2lsbCBiZSByZXNvbHZlZCB0b1xuICogICAgdGhlaXIgb3JpZ2luYWwgbmFtZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEltcG9ydFNwZWNpZmllcihcbiAgICBzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlLCBtb2R1bGVOYW1lOiBzdHJpbmcsIHNwZWNpZmllck5hbWU6IHN0cmluZyk6IHRzLkltcG9ydFNwZWNpZmllcnxudWxsIHtcbiAgZm9yIChjb25zdCBub2RlIG9mIHNvdXJjZUZpbGUuc3RhdGVtZW50cykge1xuICAgIGlmICh0cy5pc0ltcG9ydERlY2xhcmF0aW9uKG5vZGUpICYmIHRzLmlzU3RyaW5nTGl0ZXJhbChub2RlLm1vZHVsZVNwZWNpZmllcikgJiZcbiAgICAgICAgbm9kZS5tb2R1bGVTcGVjaWZpZXIudGV4dCA9PT0gbW9kdWxlTmFtZSkge1xuICAgICAgY29uc3QgbmFtZWRCaW5kaW5ncyA9IG5vZGUuaW1wb3J0Q2xhdXNlICYmIG5vZGUuaW1wb3J0Q2xhdXNlLm5hbWVkQmluZGluZ3M7XG4gICAgICBpZiAobmFtZWRCaW5kaW5ncyAmJiB0cy5pc05hbWVkSW1wb3J0cyhuYW1lZEJpbmRpbmdzKSkge1xuICAgICAgICBjb25zdCBtYXRjaCA9IGZpbmRJbXBvcnRTcGVjaWZpZXIobmFtZWRCaW5kaW5ncy5lbGVtZW50cywgc3BlY2lmaWVyTmFtZSk7XG4gICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgIHJldHVybiBtYXRjaDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5cbi8qKlxuICogUmVwbGFjZXMgYW4gaW1wb3J0IGluc2lkZSBhIG5hbWVkIGltcG9ydHMgbm9kZSB3aXRoIGEgZGlmZmVyZW50IG9uZS5cbiAqIEBwYXJhbSBub2RlIE5vZGUgdGhhdCBjb250YWlucyB0aGUgaW1wb3J0cy5cbiAqIEBwYXJhbSBleGlzdGluZ0ltcG9ydCBJbXBvcnQgdGhhdCBzaG91bGQgYmUgcmVwbGFjZWQuXG4gKiBAcGFyYW0gbmV3SW1wb3J0TmFtZSBJbXBvcnQgdGhhdCBzaG91bGQgYmUgaW5zZXJ0ZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXBsYWNlSW1wb3J0KFxuICAgIG5vZGU6IHRzLk5hbWVkSW1wb3J0cywgZXhpc3RpbmdJbXBvcnQ6IHN0cmluZywgbmV3SW1wb3J0TmFtZTogc3RyaW5nKSB7XG4gIGNvbnN0IGlzQWxyZWFkeUltcG9ydGVkID0gZmluZEltcG9ydFNwZWNpZmllcihub2RlLmVsZW1lbnRzLCBuZXdJbXBvcnROYW1lKTtcbiAgaWYgKGlzQWxyZWFkeUltcG9ydGVkKSB7XG4gICAgcmV0dXJuIG5vZGU7XG4gIH1cblxuICBjb25zdCBleGlzdGluZ0ltcG9ydE5vZGUgPSBmaW5kSW1wb3J0U3BlY2lmaWVyKG5vZGUuZWxlbWVudHMsIGV4aXN0aW5nSW1wb3J0KTtcbiAgaWYgKCFleGlzdGluZ0ltcG9ydE5vZGUpIHtcbiAgICByZXR1cm4gbm9kZTtcbiAgfVxuXG4gIGNvbnN0IGltcG9ydFByb3BlcnR5TmFtZSA9XG4gICAgICBleGlzdGluZ0ltcG9ydE5vZGUucHJvcGVydHlOYW1lID8gdHMuZmFjdG9yeS5jcmVhdGVJZGVudGlmaWVyKG5ld0ltcG9ydE5hbWUpIDogdW5kZWZpbmVkO1xuICBjb25zdCBpbXBvcnROYW1lID0gZXhpc3RpbmdJbXBvcnROb2RlLnByb3BlcnR5TmFtZSA/IGV4aXN0aW5nSW1wb3J0Tm9kZS5uYW1lIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cy5mYWN0b3J5LmNyZWF0ZUlkZW50aWZpZXIobmV3SW1wb3J0TmFtZSk7XG5cbiAgcmV0dXJuIHRzLmZhY3RvcnkudXBkYXRlTmFtZWRJbXBvcnRzKG5vZGUsIFtcbiAgICAuLi5ub2RlLmVsZW1lbnRzLmZpbHRlcihjdXJyZW50ID0+IGN1cnJlbnQgIT09IGV4aXN0aW5nSW1wb3J0Tm9kZSksXG4gICAgLy8gQ3JlYXRlIGEgbmV3IGltcG9ydCB3aGlsZSB0cnlpbmcgdG8gcHJlc2VydmUgdGhlIGFsaWFzIG9mIHRoZSBvbGQgb25lLlxuICAgIHRzLmZhY3RvcnkuY3JlYXRlSW1wb3J0U3BlY2lmaWVyKGZhbHNlLCBpbXBvcnRQcm9wZXJ0eU5hbWUsIGltcG9ydE5hbWUpXG4gIF0pO1xufVxuXG5cbi8qKiBGaW5kcyBhbiBpbXBvcnQgc3BlY2lmaWVyIHdpdGggYSBwYXJ0aWN1bGFyIG5hbWUuICovXG5leHBvcnQgZnVuY3Rpb24gZmluZEltcG9ydFNwZWNpZmllcihcbiAgICBub2RlczogdHMuTm9kZUFycmF5PHRzLkltcG9ydFNwZWNpZmllcj4sIHNwZWNpZmllck5hbWU6IHN0cmluZyk6IHRzLkltcG9ydFNwZWNpZmllcnx1bmRlZmluZWQge1xuICByZXR1cm4gbm9kZXMuZmluZChlbGVtZW50ID0+IHtcbiAgICBjb25zdCB7bmFtZSwgcHJvcGVydHlOYW1lfSA9IGVsZW1lbnQ7XG4gICAgcmV0dXJuIHByb3BlcnR5TmFtZSA/IHByb3BlcnR5TmFtZS50ZXh0ID09PSBzcGVjaWZpZXJOYW1lIDogbmFtZS50ZXh0ID09PSBzcGVjaWZpZXJOYW1lO1xuICB9KTtcbn1cbiJdfQ==
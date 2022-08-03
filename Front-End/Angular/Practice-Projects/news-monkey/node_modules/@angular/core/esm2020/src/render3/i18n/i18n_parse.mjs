/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import '../../util/ng_dev_mode';
import '../../util/ng_i18n_closure_mode';
import { getTemplateContent, SRCSET_ATTRS, URI_ATTRS, VALID_ATTRS, VALID_ELEMENTS } from '../../sanitization/html_sanitizer';
import { getInertBodyHelper } from '../../sanitization/inert_body';
import { _sanitizeUrl, sanitizeSrcset } from '../../sanitization/url_sanitizer';
import { assertDefined, assertEqual, assertGreaterThanOrEqual, assertOneOf, assertString } from '../../util/assert';
import { loadIcuContainerVisitor } from '../instructions/i18n_icu_container_visitor';
import { allocExpando, createTNodeAtIndex } from '../instructions/shared';
import { getDocument } from '../interfaces/document';
import { ELEMENT_MARKER, I18nCreateOpCode, ICU_MARKER } from '../interfaces/i18n';
import { HEADER_OFFSET } from '../interfaces/view';
import { getCurrentParentTNode, getCurrentTNode, setCurrentTNode } from '../state';
import { attachDebugGetter } from '../util/debug_utils';
import { i18nCreateOpCodesToString, i18nRemoveOpCodesToString, i18nUpdateOpCodesToString, icuCreateOpCodesToString } from './i18n_debug';
import { addTNodeAndUpdateInsertBeforeIndex } from './i18n_insert_before_index';
import { ensureIcuContainerVisitorLoaded } from './i18n_tree_shaking';
import { createTNodePlaceholder, icuCreateOpCode, setTIcu, setTNodeInsertBeforeIndex } from './i18n_util';
const BINDING_REGEXP = /�(\d+):?\d*�/gi;
const ICU_REGEXP = /({\s*�\d+:?\d*�\s*,\s*\S{6}\s*,[\s\S]*})/gi;
const NESTED_ICU = /�(\d+)�/;
const ICU_BLOCK_REGEXP = /^\s*(�\d+:?\d*�)\s*,\s*(select|plural)\s*,/;
const MARKER = `�`;
const SUBTEMPLATE_REGEXP = /�\/?\*(\d+:\d+)�/gi;
const PH_REGEXP = /�(\/?[#*]\d+):?\d*�/gi;
/**
 * Angular Dart introduced &ngsp; as a placeholder for non-removable space, see:
 * https://github.com/dart-lang/angular/blob/0bb611387d29d65b5af7f9d2515ab571fd3fbee4/_tests/test/compiler/preserve_whitespace_test.dart#L25-L32
 * In Angular Dart &ngsp; is converted to the 0xE500 PUA (Private Use Areas) unicode character
 * and later on replaced by a space. We are re-implementing the same idea here, since translations
 * might contain this special character.
 */
const NGSP_UNICODE_REGEXP = /\uE500/g;
function replaceNgsp(value) {
    return value.replace(NGSP_UNICODE_REGEXP, ' ');
}
/**
 * Create dynamic nodes from i18n translation block.
 *
 * - Text nodes are created synchronously
 * - TNodes are linked into tree lazily
 *
 * @param tView Current `TView`
 * @parentTNodeIndex index to the parent TNode of this i18n block
 * @param lView Current `LView`
 * @param index Index of `ɵɵi18nStart` instruction.
 * @param message Message to translate.
 * @param subTemplateIndex Index into the sub template of message translation. (ie in case of
 *     `ngIf`) (-1 otherwise)
 */
export function i18nStartFirstCreatePass(tView, parentTNodeIndex, lView, index, message, subTemplateIndex) {
    const rootTNode = getCurrentParentTNode();
    const createOpCodes = [];
    const updateOpCodes = [];
    const existingTNodeStack = [[]];
    if (ngDevMode) {
        attachDebugGetter(createOpCodes, i18nCreateOpCodesToString);
        attachDebugGetter(updateOpCodes, i18nUpdateOpCodesToString);
    }
    message = getTranslationForTemplate(message, subTemplateIndex);
    const msgParts = replaceNgsp(message).split(PH_REGEXP);
    for (let i = 0; i < msgParts.length; i++) {
        let value = msgParts[i];
        if ((i & 1) === 0) {
            // Even indexes are text (including bindings & ICU expressions)
            const parts = i18nParseTextIntoPartsAndICU(value);
            for (let j = 0; j < parts.length; j++) {
                let part = parts[j];
                if ((j & 1) === 0) {
                    // `j` is odd therefore `part` is string
                    const text = part;
                    ngDevMode && assertString(text, 'Parsed ICU part should be string');
                    if (text !== '') {
                        i18nStartFirstCreatePassProcessTextNode(tView, rootTNode, existingTNodeStack[0], createOpCodes, updateOpCodes, lView, text);
                    }
                }
                else {
                    // `j` is Even therefor `part` is an `ICUExpression`
                    const icuExpression = part;
                    // Verify that ICU expression has the right shape. Translations might contain invalid
                    // constructions (while original messages were correct), so ICU parsing at runtime may
                    // not succeed (thus `icuExpression` remains a string).
                    // Note: we intentionally retain the error here by not using `ngDevMode`, because
                    // the value can change based on the locale and users aren't guaranteed to hit
                    // an invalid string while they're developing.
                    if (typeof icuExpression !== 'object') {
                        throw new Error(`Unable to parse ICU expression in "${message}" message.`);
                    }
                    const icuContainerTNode = createTNodeAndAddOpCode(tView, rootTNode, existingTNodeStack[0], lView, createOpCodes, ngDevMode ? `ICU ${index}:${icuExpression.mainBinding}` : '', true);
                    const icuNodeIndex = icuContainerTNode.index;
                    ngDevMode &&
                        assertGreaterThanOrEqual(icuNodeIndex, HEADER_OFFSET, 'Index must be in absolute LView offset');
                    icuStart(tView, lView, updateOpCodes, parentTNodeIndex, icuExpression, icuNodeIndex);
                }
            }
        }
        else {
            // Odd indexes are placeholders (elements and sub-templates)
            // At this point value is something like: '/#1:2' (originally coming from '�/#1:2�')
            const isClosing = value.charCodeAt(0) === 47 /* CharCode.SLASH */;
            const type = value.charCodeAt(isClosing ? 1 : 0);
            ngDevMode && assertOneOf(type, 42 /* CharCode.STAR */, 35 /* CharCode.HASH */);
            const index = HEADER_OFFSET + Number.parseInt(value.substring((isClosing ? 2 : 1)));
            if (isClosing) {
                existingTNodeStack.shift();
                setCurrentTNode(getCurrentParentTNode(), false);
            }
            else {
                const tNode = createTNodePlaceholder(tView, existingTNodeStack[0], index);
                existingTNodeStack.unshift([]);
                setCurrentTNode(tNode, true);
            }
        }
    }
    tView.data[index] = {
        create: createOpCodes,
        update: updateOpCodes,
    };
}
/**
 * Allocate space in i18n Range add create OpCode instruction to create a text or comment node.
 *
 * @param tView Current `TView` needed to allocate space in i18n range.
 * @param rootTNode Root `TNode` of the i18n block. This node determines if the new TNode will be
 *     added as part of the `i18nStart` instruction or as part of the `TNode.insertBeforeIndex`.
 * @param existingTNodes internal state for `addTNodeAndUpdateInsertBeforeIndex`.
 * @param lView Current `LView` needed to allocate space in i18n range.
 * @param createOpCodes Array storing `I18nCreateOpCodes` where new opCodes will be added.
 * @param text Text to be added when the `Text` or `Comment` node will be created.
 * @param isICU true if a `Comment` node for ICU (instead of `Text`) node should be created.
 */
function createTNodeAndAddOpCode(tView, rootTNode, existingTNodes, lView, createOpCodes, text, isICU) {
    const i18nNodeIdx = allocExpando(tView, lView, 1, null);
    let opCode = i18nNodeIdx << I18nCreateOpCode.SHIFT;
    let parentTNode = getCurrentParentTNode();
    if (rootTNode === parentTNode) {
        // FIXME(misko): A null `parentTNode` should represent when we fall of the `LView` boundary.
        // (there is no parent), but in some circumstances (because we are inconsistent about how we set
        // `previousOrParentTNode`) it could point to `rootTNode` So this is a work around.
        parentTNode = null;
    }
    if (parentTNode === null) {
        // If we don't have a parent that means that we can eagerly add nodes.
        // If we have a parent than these nodes can't be added now (as the parent has not been created
        // yet) and instead the `parentTNode` is responsible for adding it. See
        // `TNode.insertBeforeIndex`
        opCode |= I18nCreateOpCode.APPEND_EAGERLY;
    }
    if (isICU) {
        opCode |= I18nCreateOpCode.COMMENT;
        ensureIcuContainerVisitorLoaded(loadIcuContainerVisitor);
    }
    createOpCodes.push(opCode, text === null ? '' : text);
    // We store `{{?}}` so that when looking at debug `TNodeType.template` we can see where the
    // bindings are.
    const tNode = createTNodeAtIndex(tView, i18nNodeIdx, isICU ? 32 /* TNodeType.Icu */ : 1 /* TNodeType.Text */, text === null ? (ngDevMode ? '{{?}}' : '') : text, null);
    addTNodeAndUpdateInsertBeforeIndex(existingTNodes, tNode);
    const tNodeIdx = tNode.index;
    setCurrentTNode(tNode, false /* Text nodes are self closing */);
    if (parentTNode !== null && rootTNode !== parentTNode) {
        // We are a child of deeper node (rather than a direct child of `i18nStart` instruction.)
        // We have to make sure to add ourselves to the parent.
        setTNodeInsertBeforeIndex(parentTNode, tNodeIdx);
    }
    return tNode;
}
/**
 * Processes text node in i18n block.
 *
 * Text nodes can have:
 * - Create instruction in `createOpCodes` for creating the text node.
 * - Allocate spec for text node in i18n range of `LView`
 * - If contains binding:
 *    - bindings => allocate space in i18n range of `LView` to store the binding value.
 *    - populate `updateOpCodes` with update instructions.
 *
 * @param tView Current `TView`
 * @param rootTNode Root `TNode` of the i18n block. This node determines if the new TNode will
 *     be added as part of the `i18nStart` instruction or as part of the
 *     `TNode.insertBeforeIndex`.
 * @param existingTNodes internal state for `addTNodeAndUpdateInsertBeforeIndex`.
 * @param createOpCodes Location where the creation OpCodes will be stored.
 * @param lView Current `LView`
 * @param text The translated text (which may contain binding)
 */
function i18nStartFirstCreatePassProcessTextNode(tView, rootTNode, existingTNodes, createOpCodes, updateOpCodes, lView, text) {
    const hasBinding = text.match(BINDING_REGEXP);
    const tNode = createTNodeAndAddOpCode(tView, rootTNode, existingTNodes, lView, createOpCodes, hasBinding ? null : text, false);
    if (hasBinding) {
        generateBindingUpdateOpCodes(updateOpCodes, text, tNode.index, null, 0, null);
    }
}
/**
 * See `i18nAttributes` above.
 */
export function i18nAttributesFirstPass(tView, index, values) {
    const previousElement = getCurrentTNode();
    const previousElementIndex = previousElement.index;
    const updateOpCodes = [];
    if (ngDevMode) {
        attachDebugGetter(updateOpCodes, i18nUpdateOpCodesToString);
    }
    if (tView.firstCreatePass && tView.data[index] === null) {
        for (let i = 0; i < values.length; i += 2) {
            const attrName = values[i];
            const message = values[i + 1];
            if (message !== '') {
                // Check if attribute value contains an ICU and throw an error if that's the case.
                // ICUs in element attributes are not supported.
                // Note: we intentionally retain the error here by not using `ngDevMode`, because
                // the `value` can change based on the locale and users aren't guaranteed to hit
                // an invalid string while they're developing.
                if (ICU_REGEXP.test(message)) {
                    throw new Error(`ICU expressions are not supported in attributes. Message: "${message}".`);
                }
                // i18n attributes that hit this code path are guaranteed to have bindings, because
                // the compiler treats static i18n attributes as regular attribute bindings.
                // Since this may not be the first i18n attribute on this element we need to pass in how
                // many previous bindings there have already been.
                generateBindingUpdateOpCodes(updateOpCodes, message, previousElementIndex, attrName, countBindings(updateOpCodes), null);
            }
        }
        tView.data[index] = updateOpCodes;
    }
}
/**
 * Generate the OpCodes to update the bindings of a string.
 *
 * @param updateOpCodes Place where the update opcodes will be stored.
 * @param str The string containing the bindings.
 * @param destinationNode Index of the destination node which will receive the binding.
 * @param attrName Name of the attribute, if the string belongs to an attribute.
 * @param sanitizeFn Sanitization function used to sanitize the string after update, if necessary.
 * @param bindingStart The lView index of the next expression that can be bound via an opCode.
 * @returns The mask value for these bindings
 */
function generateBindingUpdateOpCodes(updateOpCodes, str, destinationNode, attrName, bindingStart, sanitizeFn) {
    ngDevMode &&
        assertGreaterThanOrEqual(destinationNode, HEADER_OFFSET, 'Index must be in absolute LView offset');
    const maskIndex = updateOpCodes.length; // Location of mask
    const sizeIndex = maskIndex + 1; // location of size for skipping
    updateOpCodes.push(null, null); // Alloc space for mask and size
    const startIndex = maskIndex + 2; // location of first allocation.
    if (ngDevMode) {
        attachDebugGetter(updateOpCodes, i18nUpdateOpCodesToString);
    }
    const textParts = str.split(BINDING_REGEXP);
    let mask = 0;
    for (let j = 0; j < textParts.length; j++) {
        const textValue = textParts[j];
        if (j & 1) {
            // Odd indexes are bindings
            const bindingIndex = bindingStart + parseInt(textValue, 10);
            updateOpCodes.push(-1 - bindingIndex);
            mask = mask | toMaskBit(bindingIndex);
        }
        else if (textValue !== '') {
            // Even indexes are text
            updateOpCodes.push(textValue);
        }
    }
    updateOpCodes.push(destinationNode << 2 /* I18nUpdateOpCode.SHIFT_REF */ |
        (attrName ? 1 /* I18nUpdateOpCode.Attr */ : 0 /* I18nUpdateOpCode.Text */));
    if (attrName) {
        updateOpCodes.push(attrName, sanitizeFn);
    }
    updateOpCodes[maskIndex] = mask;
    updateOpCodes[sizeIndex] = updateOpCodes.length - startIndex;
    return mask;
}
/**
 * Count the number of bindings in the given `opCodes`.
 *
 * It could be possible to speed this up, by passing the number of bindings found back from
 * `generateBindingUpdateOpCodes()` to `i18nAttributesFirstPass()` but this would then require more
 * complexity in the code and/or transient objects to be created.
 *
 * Since this function is only called once when the template is instantiated, is trivial in the
 * first instance (since `opCodes` will be an empty array), and it is not common for elements to
 * contain multiple i18n bound attributes, it seems like this is a reasonable compromise.
 */
function countBindings(opCodes) {
    let count = 0;
    for (let i = 0; i < opCodes.length; i++) {
        const opCode = opCodes[i];
        // Bindings are negative numbers.
        if (typeof opCode === 'number' && opCode < 0) {
            count++;
        }
    }
    return count;
}
/**
 * Convert binding index to mask bit.
 *
 * Each index represents a single bit on the bit-mask. Because bit-mask only has 32 bits, we make
 * the 32nd bit share all masks for all bindings higher than 32. Since it is extremely rare to
 * have more than 32 bindings this will be hit very rarely. The downside of hitting this corner
 * case is that we will execute binding code more often than necessary. (penalty of performance)
 */
function toMaskBit(bindingIndex) {
    return 1 << Math.min(bindingIndex, 31);
}
export function isRootTemplateMessage(subTemplateIndex) {
    return subTemplateIndex === -1;
}
/**
 * Removes everything inside the sub-templates of a message.
 */
function removeInnerTemplateTranslation(message) {
    let match;
    let res = '';
    let index = 0;
    let inTemplate = false;
    let tagMatched;
    while ((match = SUBTEMPLATE_REGEXP.exec(message)) !== null) {
        if (!inTemplate) {
            res += message.substring(index, match.index + match[0].length);
            tagMatched = match[1];
            inTemplate = true;
        }
        else {
            if (match[0] === `${MARKER}/*${tagMatched}${MARKER}`) {
                index = match.index;
                inTemplate = false;
            }
        }
    }
    ngDevMode &&
        assertEqual(inTemplate, false, `Tag mismatch: unable to find the end of the sub-template in the translation "${message}"`);
    res += message.slice(index);
    return res;
}
/**
 * Extracts a part of a message and removes the rest.
 *
 * This method is used for extracting a part of the message associated with a template. A
 * translated message can span multiple templates.
 *
 * Example:
 * ```
 * <div i18n>Translate <span *ngIf>me</span>!</div>
 * ```
 *
 * @param message The message to crop
 * @param subTemplateIndex Index of the sub-template to extract. If undefined it returns the
 * external template and removes all sub-templates.
 */
export function getTranslationForTemplate(message, subTemplateIndex) {
    if (isRootTemplateMessage(subTemplateIndex)) {
        // We want the root template message, ignore all sub-templates
        return removeInnerTemplateTranslation(message);
    }
    else {
        // We want a specific sub-template
        const start = message.indexOf(`:${subTemplateIndex}${MARKER}`) + 2 + subTemplateIndex.toString().length;
        const end = message.search(new RegExp(`${MARKER}\\/\\*\\d+:${subTemplateIndex}${MARKER}`));
        return removeInnerTemplateTranslation(message.substring(start, end));
    }
}
/**
 * Generate the OpCodes for ICU expressions.
 *
 * @param icuExpression
 * @param index Index where the anchor is stored and an optional `TIcuContainerNode`
 *   - `lView[anchorIdx]` points to a `Comment` node representing the anchor for the ICU.
 *   - `tView.data[anchorIdx]` points to the `TIcuContainerNode` if ICU is root (`null` otherwise)
 */
export function icuStart(tView, lView, updateOpCodes, parentIdx, icuExpression, anchorIdx) {
    ngDevMode && assertDefined(icuExpression, 'ICU expression must be defined');
    let bindingMask = 0;
    const tIcu = {
        type: icuExpression.type,
        currentCaseLViewIndex: allocExpando(tView, lView, 1, null),
        anchorIdx,
        cases: [],
        create: [],
        remove: [],
        update: []
    };
    addUpdateIcuSwitch(updateOpCodes, icuExpression, anchorIdx);
    setTIcu(tView, anchorIdx, tIcu);
    const values = icuExpression.values;
    for (let i = 0; i < values.length; i++) {
        // Each value is an array of strings & other ICU expressions
        const valueArr = values[i];
        const nestedIcus = [];
        for (let j = 0; j < valueArr.length; j++) {
            const value = valueArr[j];
            if (typeof value !== 'string') {
                // It is an nested ICU expression
                const icuIndex = nestedIcus.push(value) - 1;
                // Replace nested ICU expression by a comment node
                valueArr[j] = `<!--�${icuIndex}�-->`;
            }
        }
        bindingMask = parseIcuCase(tView, tIcu, lView, updateOpCodes, parentIdx, icuExpression.cases[i], valueArr.join(''), nestedIcus) |
            bindingMask;
    }
    if (bindingMask) {
        addUpdateIcuUpdate(updateOpCodes, bindingMask, anchorIdx);
    }
}
/**
 * Parses text containing an ICU expression and produces a JSON object for it.
 * Original code from closure library, modified for Angular.
 *
 * @param pattern Text containing an ICU expression that needs to be parsed.
 *
 */
export function parseICUBlock(pattern) {
    const cases = [];
    const values = [];
    let icuType = 1 /* IcuType.plural */;
    let mainBinding = 0;
    pattern = pattern.replace(ICU_BLOCK_REGEXP, function (str, binding, type) {
        if (type === 'select') {
            icuType = 0 /* IcuType.select */;
        }
        else {
            icuType = 1 /* IcuType.plural */;
        }
        mainBinding = parseInt(binding.slice(1), 10);
        return '';
    });
    const parts = i18nParseTextIntoPartsAndICU(pattern);
    // Looking for (key block)+ sequence. One of the keys has to be "other".
    for (let pos = 0; pos < parts.length;) {
        let key = parts[pos++].trim();
        if (icuType === 1 /* IcuType.plural */) {
            // Key can be "=x", we just want "x"
            key = key.replace(/\s*(?:=)?(\w+)\s*/, '$1');
        }
        if (key.length) {
            cases.push(key);
        }
        const blocks = i18nParseTextIntoPartsAndICU(parts[pos++]);
        if (cases.length > values.length) {
            values.push(blocks);
        }
    }
    // TODO(ocombe): support ICU expressions in attributes, see #21615
    return { type: icuType, mainBinding: mainBinding, cases, values };
}
/**
 * Breaks pattern into strings and top level {...} blocks.
 * Can be used to break a message into text and ICU expressions, or to break an ICU expression
 * into keys and cases. Original code from closure library, modified for Angular.
 *
 * @param pattern (sub)Pattern to be broken.
 * @returns An `Array<string|IcuExpression>` where:
 *   - odd positions: `string` => text between ICU expressions
 *   - even positions: `ICUExpression` => ICU expression parsed into `ICUExpression` record.
 */
export function i18nParseTextIntoPartsAndICU(pattern) {
    if (!pattern) {
        return [];
    }
    let prevPos = 0;
    const braceStack = [];
    const results = [];
    const braces = /[{}]/g;
    // lastIndex doesn't get set to 0 so we have to.
    braces.lastIndex = 0;
    let match;
    while (match = braces.exec(pattern)) {
        const pos = match.index;
        if (match[0] == '}') {
            braceStack.pop();
            if (braceStack.length == 0) {
                // End of the block.
                const block = pattern.substring(prevPos, pos);
                if (ICU_BLOCK_REGEXP.test(block)) {
                    results.push(parseICUBlock(block));
                }
                else {
                    results.push(block);
                }
                prevPos = pos + 1;
            }
        }
        else {
            if (braceStack.length == 0) {
                const substring = pattern.substring(prevPos, pos);
                results.push(substring);
                prevPos = pos + 1;
            }
            braceStack.push('{');
        }
    }
    const substring = pattern.substring(prevPos);
    results.push(substring);
    return results;
}
/**
 * Parses a node, its children and its siblings, and generates the mutate & update OpCodes.
 *
 */
export function parseIcuCase(tView, tIcu, lView, updateOpCodes, parentIdx, caseName, unsafeCaseHtml, nestedIcus) {
    const create = [];
    const remove = [];
    const update = [];
    if (ngDevMode) {
        attachDebugGetter(create, icuCreateOpCodesToString);
        attachDebugGetter(remove, i18nRemoveOpCodesToString);
        attachDebugGetter(update, i18nUpdateOpCodesToString);
    }
    tIcu.cases.push(caseName);
    tIcu.create.push(create);
    tIcu.remove.push(remove);
    tIcu.update.push(update);
    const inertBodyHelper = getInertBodyHelper(getDocument());
    const inertBodyElement = inertBodyHelper.getInertBodyElement(unsafeCaseHtml);
    ngDevMode && assertDefined(inertBodyElement, 'Unable to generate inert body element');
    const inertRootNode = getTemplateContent(inertBodyElement) || inertBodyElement;
    if (inertRootNode) {
        return walkIcuTree(tView, tIcu, lView, updateOpCodes, create, remove, update, inertRootNode, parentIdx, nestedIcus, 0);
    }
    else {
        return 0;
    }
}
function walkIcuTree(tView, tIcu, lView, sharedUpdateOpCodes, create, remove, update, parentNode, parentIdx, nestedIcus, depth) {
    let bindingMask = 0;
    let currentNode = parentNode.firstChild;
    while (currentNode) {
        const newIndex = allocExpando(tView, lView, 1, null);
        switch (currentNode.nodeType) {
            case Node.ELEMENT_NODE:
                const element = currentNode;
                const tagName = element.tagName.toLowerCase();
                if (VALID_ELEMENTS.hasOwnProperty(tagName)) {
                    addCreateNodeAndAppend(create, ELEMENT_MARKER, tagName, parentIdx, newIndex);
                    tView.data[newIndex] = tagName;
                    const elAttrs = element.attributes;
                    for (let i = 0; i < elAttrs.length; i++) {
                        const attr = elAttrs.item(i);
                        const lowerAttrName = attr.name.toLowerCase();
                        const hasBinding = !!attr.value.match(BINDING_REGEXP);
                        // we assume the input string is safe, unless it's using a binding
                        if (hasBinding) {
                            if (VALID_ATTRS.hasOwnProperty(lowerAttrName)) {
                                if (URI_ATTRS[lowerAttrName]) {
                                    generateBindingUpdateOpCodes(update, attr.value, newIndex, attr.name, 0, _sanitizeUrl);
                                }
                                else if (SRCSET_ATTRS[lowerAttrName]) {
                                    generateBindingUpdateOpCodes(update, attr.value, newIndex, attr.name, 0, sanitizeSrcset);
                                }
                                else {
                                    generateBindingUpdateOpCodes(update, attr.value, newIndex, attr.name, 0, null);
                                }
                            }
                            else {
                                ngDevMode &&
                                    console.warn(`WARNING: ignoring unsafe attribute value ` +
                                        `${lowerAttrName} on element ${tagName} ` +
                                        `(see https://g.co/ng/security#xss)`);
                            }
                        }
                        else {
                            addCreateAttribute(create, newIndex, attr);
                        }
                    }
                    // Parse the children of this node (if any)
                    bindingMask = walkIcuTree(tView, tIcu, lView, sharedUpdateOpCodes, create, remove, update, currentNode, newIndex, nestedIcus, depth + 1) |
                        bindingMask;
                    addRemoveNode(remove, newIndex, depth);
                }
                break;
            case Node.TEXT_NODE:
                const value = currentNode.textContent || '';
                const hasBinding = value.match(BINDING_REGEXP);
                addCreateNodeAndAppend(create, null, hasBinding ? '' : value, parentIdx, newIndex);
                addRemoveNode(remove, newIndex, depth);
                if (hasBinding) {
                    bindingMask =
                        generateBindingUpdateOpCodes(update, value, newIndex, null, 0, null) | bindingMask;
                }
                break;
            case Node.COMMENT_NODE:
                // Check if the comment node is a placeholder for a nested ICU
                const isNestedIcu = NESTED_ICU.exec(currentNode.textContent || '');
                if (isNestedIcu) {
                    const nestedIcuIndex = parseInt(isNestedIcu[1], 10);
                    const icuExpression = nestedIcus[nestedIcuIndex];
                    // Create the comment node that will anchor the ICU expression
                    addCreateNodeAndAppend(create, ICU_MARKER, ngDevMode ? `nested ICU ${nestedIcuIndex}` : '', parentIdx, newIndex);
                    icuStart(tView, lView, sharedUpdateOpCodes, parentIdx, icuExpression, newIndex);
                    addRemoveNestedIcu(remove, newIndex, depth);
                }
                break;
        }
        currentNode = currentNode.nextSibling;
    }
    return bindingMask;
}
function addRemoveNode(remove, index, depth) {
    if (depth === 0) {
        remove.push(index);
    }
}
function addRemoveNestedIcu(remove, index, depth) {
    if (depth === 0) {
        remove.push(~index); // remove ICU at `index`
        remove.push(index); // remove ICU comment at `index`
    }
}
function addUpdateIcuSwitch(update, icuExpression, index) {
    update.push(toMaskBit(icuExpression.mainBinding), 2, -1 - icuExpression.mainBinding, index << 2 /* I18nUpdateOpCode.SHIFT_REF */ | 2 /* I18nUpdateOpCode.IcuSwitch */);
}
function addUpdateIcuUpdate(update, bindingMask, index) {
    update.push(bindingMask, 1, index << 2 /* I18nUpdateOpCode.SHIFT_REF */ | 3 /* I18nUpdateOpCode.IcuUpdate */);
}
function addCreateNodeAndAppend(create, marker, text, appendToParentIdx, createAtIdx) {
    if (marker !== null) {
        create.push(marker);
    }
    create.push(text, createAtIdx, icuCreateOpCode(0 /* IcuCreateOpCode.AppendChild */, appendToParentIdx, createAtIdx));
}
function addCreateAttribute(create, newIndex, attr) {
    create.push(newIndex << 1 /* IcuCreateOpCode.SHIFT_REF */ | 1 /* IcuCreateOpCode.Attr */, attr.name, attr.value);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl9wYXJzZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL3JlbmRlcjMvaTE4bi9pMThuX3BhcnNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUNILE9BQU8sd0JBQXdCLENBQUM7QUFDaEMsT0FBTyxpQ0FBaUMsQ0FBQztBQUV6QyxPQUFPLEVBQUMsa0JBQWtCLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUUsY0FBYyxFQUFDLE1BQU0sbUNBQW1DLENBQUM7QUFDM0gsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDakUsT0FBTyxFQUFDLFlBQVksRUFBRSxjQUFjLEVBQUMsTUFBTSxrQ0FBa0MsQ0FBQztBQUM5RSxPQUFPLEVBQUMsYUFBYSxFQUFFLFdBQVcsRUFBRSx3QkFBd0IsRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFFbEgsT0FBTyxFQUFDLHVCQUF1QixFQUFDLE1BQU0sNENBQTRDLENBQUM7QUFDbkYsT0FBTyxFQUFDLFlBQVksRUFBRSxrQkFBa0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQ3hFLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUNuRCxPQUFPLEVBQUMsY0FBYyxFQUFFLGdCQUFnQixFQUE2RSxVQUFVLEVBQXlFLE1BQU0sb0JBQW9CLENBQUM7QUFHbk8sT0FBTyxFQUFDLGFBQWEsRUFBZSxNQUFNLG9CQUFvQixDQUFDO0FBQy9ELE9BQU8sRUFBQyxxQkFBcUIsRUFBRSxlQUFlLEVBQUUsZUFBZSxFQUFDLE1BQU0sVUFBVSxDQUFDO0FBQ2pGLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBRXRELE9BQU8sRUFBQyx5QkFBeUIsRUFBRSx5QkFBeUIsRUFBRSx5QkFBeUIsRUFBRSx3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RUFBRSxLQUFLLHNDQUE4QixxQ0FBNkIsQ0FBQyxDQUFDO0FBQ2hHLENBQUM7QUFFRCxTQUFTLHNCQUFzQixDQUMzQixNQUF3QixFQUFFLE1BQXNDLEVBQUUsSUFBWSxFQUM5RSxpQkFBeUIsRUFBRSxXQUFtQjtJQUNoRCxJQUFJLE1BQU0sS0FBSyxJQUFJLEVBQUU7UUFDbkIsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUNyQjtJQUNELE1BQU0sQ0FBQyxJQUFJLENBQ1AsSUFBSSxFQUFFLFdBQVcsRUFDakIsZUFBZSxzQ0FBOEIsaUJBQWlCLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQztBQUNwRixDQUFDO0FBRUQsU0FBUyxrQkFBa0IsQ0FBQyxNQUF3QixFQUFFLFFBQWdCLEVBQUUsSUFBVTtJQUNoRixNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEscUNBQTZCLCtCQUF1QixFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ25HLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAnLi4vLi4vdXRpbC9uZ19kZXZfbW9kZSc7XG5pbXBvcnQgJy4uLy4uL3V0aWwvbmdfaTE4bl9jbG9zdXJlX21vZGUnO1xuXG5pbXBvcnQge2dldFRlbXBsYXRlQ29udGVudCwgU1JDU0VUX0FUVFJTLCBVUklfQVRUUlMsIFZBTElEX0FUVFJTLCBWQUxJRF9FTEVNRU5UU30gZnJvbSAnLi4vLi4vc2FuaXRpemF0aW9uL2h0bWxfc2FuaXRpemVyJztcbmltcG9ydCB7Z2V0SW5lcnRCb2R5SGVscGVyfSBmcm9tICcuLi8uLi9zYW5pdGl6YXRpb24vaW5lcnRfYm9keSc7XG5pbXBvcnQge19zYW5pdGl6ZVVybCwgc2FuaXRpemVTcmNzZXR9IGZyb20gJy4uLy4uL3Nhbml0aXphdGlvbi91cmxfc2FuaXRpemVyJztcbmltcG9ydCB7YXNzZXJ0RGVmaW5lZCwgYXNzZXJ0RXF1YWwsIGFzc2VydEdyZWF0ZXJUaGFuT3JFcXVhbCwgYXNzZXJ0T25lT2YsIGFzc2VydFN0cmluZ30gZnJvbSAnLi4vLi4vdXRpbC9hc3NlcnQnO1xuaW1wb3J0IHtDaGFyQ29kZX0gZnJvbSAnLi4vLi4vdXRpbC9jaGFyX2NvZGUnO1xuaW1wb3J0IHtsb2FkSWN1Q29udGFpbmVyVmlzaXRvcn0gZnJvbSAnLi4vaW5zdHJ1Y3Rpb25zL2kxOG5faWN1X2NvbnRhaW5lcl92aXNpdG9yJztcbmltcG9ydCB7YWxsb2NFeHBhbmRvLCBjcmVhdGVUTm9kZUF0SW5kZXh9IGZyb20gJy4uL2luc3RydWN0aW9ucy9zaGFyZWQnO1xuaW1wb3J0IHtnZXREb2N1bWVudH0gZnJvbSAnLi4vaW50ZXJmYWNlcy9kb2N1bWVudCc7XG5pbXBvcnQge0VMRU1FTlRfTUFSS0VSLCBJMThuQ3JlYXRlT3BDb2RlLCBJMThuQ3JlYXRlT3BDb2RlcywgSTE4blJlbW92ZU9wQ29kZXMsIEkxOG5VcGRhdGVPcENvZGUsIEkxOG5VcGRhdGVPcENvZGVzLCBJQ1VfTUFSS0VSLCBJY3VDcmVhdGVPcENvZGUsIEljdUNyZWF0ZU9wQ29kZXMsIEljdUV4cHJlc3Npb24sIEljdVR5cGUsIFRJMThuLCBUSWN1fSBmcm9tICcuLi9pbnRlcmZhY2VzL2kxOG4nO1xuaW1wb3J0IHtUTm9kZSwgVE5vZGVUeXBlfSBmcm9tICcuLi9pbnRlcmZhY2VzL25vZGUnO1xuaW1wb3J0IHtTYW5pdGl6ZXJGbn0gZnJvbSAnLi4vaW50ZXJmYWNlcy9zYW5pdGl6YXRpb24nO1xuaW1wb3J0IHtIRUFERVJfT0ZGU0VULCBMVmlldywgVFZpZXd9IGZyb20gJy4uL2ludGVyZmFjZXMvdmlldyc7XG5pbXBvcnQge2dldEN1cnJlbnRQYXJlbnRUTm9kZSwgZ2V0Q3VycmVudFROb2RlLCBzZXRDdXJyZW50VE5vZGV9IGZyb20gJy4uL3N0YXRlJztcbmltcG9ydCB7YXR0YWNoRGVidWdHZXR0ZXJ9IGZyb20gJy4uL3V0aWwvZGVidWdfdXRpbHMnO1xuXG5pbXBvcnQge2kxOG5DcmVhdGVPcENvZGVzVG9TdHJpbmcsIGkxOG5SZW1vdmVPcENvZGVzVG9TdHJpbmcsIGkxOG5VcGRhdGVPcENvZGVzVG9TdHJpbmcsIGljdUNyZWF0ZU9wQ29kZXNUb1N0cmluZ30gZnJvbSAnLi9pMThuX2RlYnVnJztcbmltcG9ydCB7YWRkVE5vZGVBbmRVcGRhdGVJbnNlcnRCZWZvcmVJbmRleH0gZnJvbSAnLi9pMThuX2luc2VydF9iZWZvcmVfaW5kZXgnO1xuaW1wb3J0IHtlbnN1cmVJY3VDb250YWluZXJWaXNpdG9yTG9hZGVkfSBmcm9tICcuL2kxOG5fdHJlZV9zaGFraW5nJztcbmltcG9ydCB7Y3JlYXRlVE5vZGVQbGFjZWhvbGRlciwgaWN1Q3JlYXRlT3BDb2RlLCBzZXRUSWN1LCBzZXRUTm9kZUluc2VydEJlZm9yZUluZGV4fSBmcm9tICcuL2kxOG5fdXRpbCc7XG5cblxuXG5jb25zdCBCSU5ESU5HX1JFR0VYUCA9IC/vv70oXFxkKyk6P1xcZCrvv70vZ2k7XG5jb25zdCBJQ1VfUkVHRVhQID0gLyh7XFxzKu+/vVxcZCs6P1xcZCrvv71cXHMqLFxccypcXFN7Nn1cXHMqLFtcXHNcXFNdKn0pL2dpO1xuY29uc3QgTkVTVEVEX0lDVSA9IC/vv70oXFxkKynvv70vO1xuY29uc3QgSUNVX0JMT0NLX1JFR0VYUCA9IC9eXFxzKijvv71cXGQrOj9cXGQq77+9KVxccyosXFxzKihzZWxlY3R8cGx1cmFsKVxccyosLztcblxuY29uc3QgTUFSS0VSID0gYO+/vWA7XG5jb25zdCBTVUJURU1QTEFURV9SRUdFWFAgPSAv77+9XFwvP1xcKihcXGQrOlxcZCsp77+9L2dpO1xuY29uc3QgUEhfUkVHRVhQID0gL++/vShcXC8/WyMqXVxcZCspOj9cXGQq77+9L2dpO1xuXG4vKipcbiAqIEFuZ3VsYXIgRGFydCBpbnRyb2R1Y2VkICZuZ3NwOyBhcyBhIHBsYWNlaG9sZGVyIGZvciBub24tcmVtb3ZhYmxlIHNwYWNlLCBzZWU6XG4gKiBodHRwczovL2dpdGh1Yi5jb20vZGFydC1sYW5nL2FuZ3VsYXIvYmxvYi8wYmI2MTEzODdkMjlkNjViNWFmN2Y5ZDI1MTVhYjU3MWZkM2ZiZWU0L190ZXN0cy90ZXN0L2NvbXBpbGVyL3ByZXNlcnZlX3doaXRlc3BhY2VfdGVzdC5kYXJ0I0wyNS1MMzJcbiAqIEluIEFuZ3VsYXIgRGFydCAmbmdzcDsgaXMgY29udmVydGVkIHRvIHRoZSAweEU1MDAgUFVBIChQcml2YXRlIFVzZSBBcmVhcykgdW5pY29kZSBjaGFyYWN0ZXJcbiAqIGFuZCBsYXRlciBvbiByZXBsYWNlZCBieSBhIHNwYWNlLiBXZSBhcmUgcmUtaW1wbGVtZW50aW5nIHRoZSBzYW1lIGlkZWEgaGVyZSwgc2luY2UgdHJhbnNsYXRpb25zXG4gKiBtaWdodCBjb250YWluIHRoaXMgc3BlY2lhbCBjaGFyYWN0ZXIuXG4gKi9cbmNvbnN0IE5HU1BfVU5JQ09ERV9SRUdFWFAgPSAvXFx1RTUwMC9nO1xuZnVuY3Rpb24gcmVwbGFjZU5nc3AodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB2YWx1ZS5yZXBsYWNlKE5HU1BfVU5JQ09ERV9SRUdFWFAsICcgJyk7XG59XG5cbi8qKlxuICogQ3JlYXRlIGR5bmFtaWMgbm9kZXMgZnJvbSBpMThuIHRyYW5zbGF0aW9uIGJsb2NrLlxuICpcbiAqIC0gVGV4dCBub2RlcyBhcmUgY3JlYXRlZCBzeW5jaHJvbm91c2x5XG4gKiAtIFROb2RlcyBhcmUgbGlua2VkIGludG8gdHJlZSBsYXppbHlcbiAqXG4gKiBAcGFyYW0gdFZpZXcgQ3VycmVudCBgVFZpZXdgXG4gKiBAcGFyZW50VE5vZGVJbmRleCBpbmRleCB0byB0aGUgcGFyZW50IFROb2RlIG9mIHRoaXMgaTE4biBibG9ja1xuICogQHBhcmFtIGxWaWV3IEN1cnJlbnQgYExWaWV3YFxuICogQHBhcmFtIGluZGV4IEluZGV4IG9mIGDJtcm1aTE4blN0YXJ0YCBpbnN0cnVjdGlvbi5cbiAqIEBwYXJhbSBtZXNzYWdlIE1lc3NhZ2UgdG8gdHJhbnNsYXRlLlxuICogQHBhcmFtIHN1YlRlbXBsYXRlSW5kZXggSW5kZXggaW50byB0aGUgc3ViIHRlbXBsYXRlIG9mIG1lc3NhZ2UgdHJhbnNsYXRpb24uIChpZSBpbiBjYXNlIG9mXG4gKiAgICAgYG5nSWZgKSAoLTEgb3RoZXJ3aXNlKVxuICovXG5leHBvcnQgZnVuY3Rpb24gaTE4blN0YXJ0Rmlyc3RDcmVhdGVQYXNzKFxuICAgIHRWaWV3OiBUVmlldywgcGFyZW50VE5vZGVJbmRleDogbnVtYmVyLCBsVmlldzogTFZpZXcsIGluZGV4OiBudW1iZXIsIG1lc3NhZ2U6IHN0cmluZyxcbiAgICBzdWJUZW1wbGF0ZUluZGV4OiBudW1iZXIpIHtcbiAgY29uc3Qgcm9vdFROb2RlID0gZ2V0Q3VycmVudFBhcmVudFROb2RlKCk7XG4gIGNvbnN0IGNyZWF0ZU9wQ29kZXM6IEkxOG5DcmVhdGVPcENvZGVzID0gW10gYXMgYW55O1xuICBjb25zdCB1cGRhdGVPcENvZGVzOiBJMThuVXBkYXRlT3BDb2RlcyA9IFtdIGFzIGFueTtcbiAgY29uc3QgZXhpc3RpbmdUTm9kZVN0YWNrOiBUTm9kZVtdW10gPSBbW11dO1xuICBpZiAobmdEZXZNb2RlKSB7XG4gICAgYXR0YWNoRGVidWdHZXR0ZXIoY3JlYXRlT3BDb2RlcywgaTE4bkNyZWF0ZU9wQ29kZXNUb1N0cmluZyk7XG4gICAgYXR0YWNoRGVidWdHZXR0ZXIodXBkYXRlT3BDb2RlcywgaTE4blVwZGF0ZU9wQ29kZXNUb1N0cmluZyk7XG4gIH1cblxuICBtZXNzYWdlID0gZ2V0VHJhbnNsYXRpb25Gb3JUZW1wbGF0ZShtZXNzYWdlLCBzdWJUZW1wbGF0ZUluZGV4KTtcbiAgY29uc3QgbXNnUGFydHMgPSByZXBsYWNlTmdzcChtZXNzYWdlKS5zcGxpdChQSF9SRUdFWFApO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG1zZ1BhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgbGV0IHZhbHVlID0gbXNnUGFydHNbaV07XG4gICAgaWYgKChpICYgMSkgPT09IDApIHtcbiAgICAgIC8vIEV2ZW4gaW5kZXhlcyBhcmUgdGV4dCAoaW5jbHVkaW5nIGJpbmRpbmdzICYgSUNVIGV4cHJlc3Npb25zKVxuICAgICAgY29uc3QgcGFydHMgPSBpMThuUGFyc2VUZXh0SW50b1BhcnRzQW5kSUNVKHZhbHVlKTtcbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgcGFydHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgbGV0IHBhcnQgPSBwYXJ0c1tqXTtcbiAgICAgICAgaWYgKChqICYgMSkgPT09IDApIHtcbiAgICAgICAgICAvLyBgamAgaXMgb2RkIHRoZXJlZm9yZSBgcGFydGAgaXMgc3RyaW5nXG4gICAgICAgICAgY29uc3QgdGV4dCA9IHBhcnQgYXMgc3RyaW5nO1xuICAgICAgICAgIG5nRGV2TW9kZSAmJiBhc3NlcnRTdHJpbmcodGV4dCwgJ1BhcnNlZCBJQ1UgcGFydCBzaG91bGQgYmUgc3RyaW5nJyk7XG4gICAgICAgICAgaWYgKHRleHQgIT09ICcnKSB7XG4gICAgICAgICAgICBpMThuU3RhcnRGaXJzdENyZWF0ZVBhc3NQcm9jZXNzVGV4dE5vZGUoXG4gICAgICAgICAgICAgICAgdFZpZXcsIHJvb3RUTm9kZSwgZXhpc3RpbmdUTm9kZVN0YWNrWzBdLCBjcmVhdGVPcENvZGVzLCB1cGRhdGVPcENvZGVzLCBsVmlldywgdGV4dCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIGBqYCBpcyBFdmVuIHRoZXJlZm9yIGBwYXJ0YCBpcyBhbiBgSUNVRXhwcmVzc2lvbmBcbiAgICAgICAgICBjb25zdCBpY3VFeHByZXNzaW9uOiBJY3VFeHByZXNzaW9uID0gcGFydCBhcyBJY3VFeHByZXNzaW9uO1xuICAgICAgICAgIC8vIFZlcmlmeSB0aGF0IElDVSBleHByZXNzaW9uIGhhcyB0aGUgcmlnaHQgc2hhcGUuIFRyYW5zbGF0aW9ucyBtaWdodCBjb250YWluIGludmFsaWRcbiAgICAgICAgICAvLyBjb25zdHJ1Y3Rpb25zICh3aGlsZSBvcmlnaW5hbCBtZXNzYWdlcyB3ZXJlIGNvcnJlY3QpLCBzbyBJQ1UgcGFyc2luZyBhdCBydW50aW1lIG1heVxuICAgICAgICAgIC8vIG5vdCBzdWNjZWVkICh0aHVzIGBpY3VFeHByZXNzaW9uYCByZW1haW5zIGEgc3RyaW5nKS5cbiAgICAgICAgICAvLyBOb3RlOiB3ZSBpbnRlbnRpb25hbGx5IHJldGFpbiB0aGUgZXJyb3IgaGVyZSBieSBub3QgdXNpbmcgYG5nRGV2TW9kZWAsIGJlY2F1c2VcbiAgICAgICAgICAvLyB0aGUgdmFsdWUgY2FuIGNoYW5nZSBiYXNlZCBvbiB0aGUgbG9jYWxlIGFuZCB1c2VycyBhcmVuJ3QgZ3VhcmFudGVlZCB0byBoaXRcbiAgICAgICAgICAvLyBhbiBpbnZhbGlkIHN0cmluZyB3aGlsZSB0aGV5J3JlIGRldmVsb3BpbmcuXG4gICAgICAgICAgaWYgKHR5cGVvZiBpY3VFeHByZXNzaW9uICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gcGFyc2UgSUNVIGV4cHJlc3Npb24gaW4gXCIke21lc3NhZ2V9XCIgbWVzc2FnZS5gKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgaWN1Q29udGFpbmVyVE5vZGUgPSBjcmVhdGVUTm9kZUFuZEFkZE9wQ29kZShcbiAgICAgICAgICAgICAgdFZpZXcsIHJvb3RUTm9kZSwgZXhpc3RpbmdUTm9kZVN0YWNrWzBdLCBsVmlldywgY3JlYXRlT3BDb2RlcyxcbiAgICAgICAgICAgICAgbmdEZXZNb2RlID8gYElDVSAke2luZGV4fToke2ljdUV4cHJlc3Npb24ubWFpbkJpbmRpbmd9YCA6ICcnLCB0cnVlKTtcbiAgICAgICAgICBjb25zdCBpY3VOb2RlSW5kZXggPSBpY3VDb250YWluZXJUTm9kZS5pbmRleDtcbiAgICAgICAgICBuZ0Rldk1vZGUgJiZcbiAgICAgICAgICAgICAgYXNzZXJ0R3JlYXRlclRoYW5PckVxdWFsKFxuICAgICAgICAgICAgICAgICAgaWN1Tm9kZUluZGV4LCBIRUFERVJfT0ZGU0VULCAnSW5kZXggbXVzdCBiZSBpbiBhYnNvbHV0ZSBMVmlldyBvZmZzZXQnKTtcbiAgICAgICAgICBpY3VTdGFydCh0VmlldywgbFZpZXcsIHVwZGF0ZU9wQ29kZXMsIHBhcmVudFROb2RlSW5kZXgsIGljdUV4cHJlc3Npb24sIGljdU5vZGVJbmRleCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gT2RkIGluZGV4ZXMgYXJlIHBsYWNlaG9sZGVycyAoZWxlbWVudHMgYW5kIHN1Yi10ZW1wbGF0ZXMpXG4gICAgICAvLyBBdCB0aGlzIHBvaW50IHZhbHVlIGlzIHNvbWV0aGluZyBsaWtlOiAnLyMxOjInIChvcmlnaW5hbGx5IGNvbWluZyBmcm9tICfvv70vIzE6Mu+/vScpXG4gICAgICBjb25zdCBpc0Nsb3NpbmcgPSB2YWx1ZS5jaGFyQ29kZUF0KDApID09PSBDaGFyQ29kZS5TTEFTSDtcbiAgICAgIGNvbnN0IHR5cGUgPSB2YWx1ZS5jaGFyQ29kZUF0KGlzQ2xvc2luZyA/IDEgOiAwKTtcbiAgICAgIG5nRGV2TW9kZSAmJiBhc3NlcnRPbmVPZih0eXBlLCBDaGFyQ29kZS5TVEFSLCBDaGFyQ29kZS5IQVNIKTtcbiAgICAgIGNvbnN0IGluZGV4ID0gSEVBREVSX09GRlNFVCArIE51bWJlci5wYXJzZUludCh2YWx1ZS5zdWJzdHJpbmcoKGlzQ2xvc2luZyA/IDIgOiAxKSkpO1xuICAgICAgaWYgKGlzQ2xvc2luZykge1xuICAgICAgICBleGlzdGluZ1ROb2RlU3RhY2suc2hpZnQoKTtcbiAgICAgICAgc2V0Q3VycmVudFROb2RlKGdldEN1cnJlbnRQYXJlbnRUTm9kZSgpISwgZmFsc2UpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgdE5vZGUgPSBjcmVhdGVUTm9kZVBsYWNlaG9sZGVyKHRWaWV3LCBleGlzdGluZ1ROb2RlU3RhY2tbMF0sIGluZGV4KTtcbiAgICAgICAgZXhpc3RpbmdUTm9kZVN0YWNrLnVuc2hpZnQoW10pO1xuICAgICAgICBzZXRDdXJyZW50VE5vZGUodE5vZGUsIHRydWUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHRWaWV3LmRhdGFbaW5kZXhdID0gPFRJMThuPntcbiAgICBjcmVhdGU6IGNyZWF0ZU9wQ29kZXMsXG4gICAgdXBkYXRlOiB1cGRhdGVPcENvZGVzLFxuICB9O1xufVxuXG4vKipcbiAqIEFsbG9jYXRlIHNwYWNlIGluIGkxOG4gUmFuZ2UgYWRkIGNyZWF0ZSBPcENvZGUgaW5zdHJ1Y3Rpb24gdG8gY3JlYXRlIGEgdGV4dCBvciBjb21tZW50IG5vZGUuXG4gKlxuICogQHBhcmFtIHRWaWV3IEN1cnJlbnQgYFRWaWV3YCBuZWVkZWQgdG8gYWxsb2NhdGUgc3BhY2UgaW4gaTE4biByYW5nZS5cbiAqIEBwYXJhbSByb290VE5vZGUgUm9vdCBgVE5vZGVgIG9mIHRoZSBpMThuIGJsb2NrLiBUaGlzIG5vZGUgZGV0ZXJtaW5lcyBpZiB0aGUgbmV3IFROb2RlIHdpbGwgYmVcbiAqICAgICBhZGRlZCBhcyBwYXJ0IG9mIHRoZSBgaTE4blN0YXJ0YCBpbnN0cnVjdGlvbiBvciBhcyBwYXJ0IG9mIHRoZSBgVE5vZGUuaW5zZXJ0QmVmb3JlSW5kZXhgLlxuICogQHBhcmFtIGV4aXN0aW5nVE5vZGVzIGludGVybmFsIHN0YXRlIGZvciBgYWRkVE5vZGVBbmRVcGRhdGVJbnNlcnRCZWZvcmVJbmRleGAuXG4gKiBAcGFyYW0gbFZpZXcgQ3VycmVudCBgTFZpZXdgIG5lZWRlZCB0byBhbGxvY2F0ZSBzcGFjZSBpbiBpMThuIHJhbmdlLlxuICogQHBhcmFtIGNyZWF0ZU9wQ29kZXMgQXJyYXkgc3RvcmluZyBgSTE4bkNyZWF0ZU9wQ29kZXNgIHdoZXJlIG5ldyBvcENvZGVzIHdpbGwgYmUgYWRkZWQuXG4gKiBAcGFyYW0gdGV4dCBUZXh0IHRvIGJlIGFkZGVkIHdoZW4gdGhlIGBUZXh0YCBvciBgQ29tbWVudGAgbm9kZSB3aWxsIGJlIGNyZWF0ZWQuXG4gKiBAcGFyYW0gaXNJQ1UgdHJ1ZSBpZiBhIGBDb21tZW50YCBub2RlIGZvciBJQ1UgKGluc3RlYWQgb2YgYFRleHRgKSBub2RlIHNob3VsZCBiZSBjcmVhdGVkLlxuICovXG5mdW5jdGlvbiBjcmVhdGVUTm9kZUFuZEFkZE9wQ29kZShcbiAgICB0VmlldzogVFZpZXcsIHJvb3RUTm9kZTogVE5vZGV8bnVsbCwgZXhpc3RpbmdUTm9kZXM6IFROb2RlW10sIGxWaWV3OiBMVmlldyxcbiAgICBjcmVhdGVPcENvZGVzOiBJMThuQ3JlYXRlT3BDb2RlcywgdGV4dDogc3RyaW5nfG51bGwsIGlzSUNVOiBib29sZWFuKTogVE5vZGUge1xuICBjb25zdCBpMThuTm9kZUlkeCA9IGFsbG9jRXhwYW5kbyh0VmlldywgbFZpZXcsIDEsIG51bGwpO1xuICBsZXQgb3BDb2RlID0gaTE4bk5vZGVJZHggPDwgSTE4bkNyZWF0ZU9wQ29kZS5TSElGVDtcbiAgbGV0IHBhcmVudFROb2RlID0gZ2V0Q3VycmVudFBhcmVudFROb2RlKCk7XG5cbiAgaWYgKHJvb3RUTm9kZSA9PT0gcGFyZW50VE5vZGUpIHtcbiAgICAvLyBGSVhNRShtaXNrbyk6IEEgbnVsbCBgcGFyZW50VE5vZGVgIHNob3VsZCByZXByZXNlbnQgd2hlbiB3ZSBmYWxsIG9mIHRoZSBgTFZpZXdgIGJvdW5kYXJ5LlxuICAgIC8vICh0aGVyZSBpcyBubyBwYXJlbnQpLCBidXQgaW4gc29tZSBjaXJjdW1zdGFuY2VzIChiZWNhdXNlIHdlIGFyZSBpbmNvbnNpc3RlbnQgYWJvdXQgaG93IHdlIHNldFxuICAgIC8vIGBwcmV2aW91c09yUGFyZW50VE5vZGVgKSBpdCBjb3VsZCBwb2ludCB0byBgcm9vdFROb2RlYCBTbyB0aGlzIGlzIGEgd29yayBhcm91bmQuXG4gICAgcGFyZW50VE5vZGUgPSBudWxsO1xuICB9XG4gIGlmIChwYXJlbnRUTm9kZSA9PT0gbnVsbCkge1xuICAgIC8vIElmIHdlIGRvbid0IGhhdmUgYSBwYXJlbnQgdGhhdCBtZWFucyB0aGF0IHdlIGNhbiBlYWdlcmx5IGFkZCBub2Rlcy5cbiAgICAvLyBJZiB3ZSBoYXZlIGEgcGFyZW50IHRoYW4gdGhlc2Ugbm9kZXMgY2FuJ3QgYmUgYWRkZWQgbm93IChhcyB0aGUgcGFyZW50IGhhcyBub3QgYmVlbiBjcmVhdGVkXG4gICAgLy8geWV0KSBhbmQgaW5zdGVhZCB0aGUgYHBhcmVudFROb2RlYCBpcyByZXNwb25zaWJsZSBmb3IgYWRkaW5nIGl0LiBTZWVcbiAgICAvLyBgVE5vZGUuaW5zZXJ0QmVmb3JlSW5kZXhgXG4gICAgb3BDb2RlIHw9IEkxOG5DcmVhdGVPcENvZGUuQVBQRU5EX0VBR0VSTFk7XG4gIH1cbiAgaWYgKGlzSUNVKSB7XG4gICAgb3BDb2RlIHw9IEkxOG5DcmVhdGVPcENvZGUuQ09NTUVOVDtcbiAgICBlbnN1cmVJY3VDb250YWluZXJWaXNpdG9yTG9hZGVkKGxvYWRJY3VDb250YWluZXJWaXNpdG9yKTtcbiAgfVxuICBjcmVhdGVPcENvZGVzLnB1c2gob3BDb2RlLCB0ZXh0ID09PSBudWxsID8gJycgOiB0ZXh0KTtcbiAgLy8gV2Ugc3RvcmUgYHt7P319YCBzbyB0aGF0IHdoZW4gbG9va2luZyBhdCBkZWJ1ZyBgVE5vZGVUeXBlLnRlbXBsYXRlYCB3ZSBjYW4gc2VlIHdoZXJlIHRoZVxuICAvLyBiaW5kaW5ncyBhcmUuXG4gIGNvbnN0IHROb2RlID0gY3JlYXRlVE5vZGVBdEluZGV4KFxuICAgICAgdFZpZXcsIGkxOG5Ob2RlSWR4LCBpc0lDVSA/IFROb2RlVHlwZS5JY3UgOiBUTm9kZVR5cGUuVGV4dCxcbiAgICAgIHRleHQgPT09IG51bGwgPyAobmdEZXZNb2RlID8gJ3t7P319JyA6ICcnKSA6IHRleHQsIG51bGwpO1xuICBhZGRUTm9kZUFuZFVwZGF0ZUluc2VydEJlZm9yZUluZGV4KGV4aXN0aW5nVE5vZGVzLCB0Tm9kZSk7XG4gIGNvbnN0IHROb2RlSWR4ID0gdE5vZGUuaW5kZXg7XG4gIHNldEN1cnJlbnRUTm9kZSh0Tm9kZSwgZmFsc2UgLyogVGV4dCBub2RlcyBhcmUgc2VsZiBjbG9zaW5nICovKTtcbiAgaWYgKHBhcmVudFROb2RlICE9PSBudWxsICYmIHJvb3RUTm9kZSAhPT0gcGFyZW50VE5vZGUpIHtcbiAgICAvLyBXZSBhcmUgYSBjaGlsZCBvZiBkZWVwZXIgbm9kZSAocmF0aGVyIHRoYW4gYSBkaXJlY3QgY2hpbGQgb2YgYGkxOG5TdGFydGAgaW5zdHJ1Y3Rpb24uKVxuICAgIC8vIFdlIGhhdmUgdG8gbWFrZSBzdXJlIHRvIGFkZCBvdXJzZWx2ZXMgdG8gdGhlIHBhcmVudC5cbiAgICBzZXRUTm9kZUluc2VydEJlZm9yZUluZGV4KHBhcmVudFROb2RlLCB0Tm9kZUlkeCk7XG4gIH1cbiAgcmV0dXJuIHROb2RlO1xufVxuXG4vKipcbiAqIFByb2Nlc3NlcyB0ZXh0IG5vZGUgaW4gaTE4biBibG9jay5cbiAqXG4gKiBUZXh0IG5vZGVzIGNhbiBoYXZlOlxuICogLSBDcmVhdGUgaW5zdHJ1Y3Rpb24gaW4gYGNyZWF0ZU9wQ29kZXNgIGZvciBjcmVhdGluZyB0aGUgdGV4dCBub2RlLlxuICogLSBBbGxvY2F0ZSBzcGVjIGZvciB0ZXh0IG5vZGUgaW4gaTE4biByYW5nZSBvZiBgTFZpZXdgXG4gKiAtIElmIGNvbnRhaW5zIGJpbmRpbmc6XG4gKiAgICAtIGJpbmRpbmdzID0+IGFsbG9jYXRlIHNwYWNlIGluIGkxOG4gcmFuZ2Ugb2YgYExWaWV3YCB0byBzdG9yZSB0aGUgYmluZGluZyB2YWx1ZS5cbiAqICAgIC0gcG9wdWxhdGUgYHVwZGF0ZU9wQ29kZXNgIHdpdGggdXBkYXRlIGluc3RydWN0aW9ucy5cbiAqXG4gKiBAcGFyYW0gdFZpZXcgQ3VycmVudCBgVFZpZXdgXG4gKiBAcGFyYW0gcm9vdFROb2RlIFJvb3QgYFROb2RlYCBvZiB0aGUgaTE4biBibG9jay4gVGhpcyBub2RlIGRldGVybWluZXMgaWYgdGhlIG5ldyBUTm9kZSB3aWxsXG4gKiAgICAgYmUgYWRkZWQgYXMgcGFydCBvZiB0aGUgYGkxOG5TdGFydGAgaW5zdHJ1Y3Rpb24gb3IgYXMgcGFydCBvZiB0aGVcbiAqICAgICBgVE5vZGUuaW5zZXJ0QmVmb3JlSW5kZXhgLlxuICogQHBhcmFtIGV4aXN0aW5nVE5vZGVzIGludGVybmFsIHN0YXRlIGZvciBgYWRkVE5vZGVBbmRVcGRhdGVJbnNlcnRCZWZvcmVJbmRleGAuXG4gKiBAcGFyYW0gY3JlYXRlT3BDb2RlcyBMb2NhdGlvbiB3aGVyZSB0aGUgY3JlYXRpb24gT3BDb2RlcyB3aWxsIGJlIHN0b3JlZC5cbiAqIEBwYXJhbSBsVmlldyBDdXJyZW50IGBMVmlld2BcbiAqIEBwYXJhbSB0ZXh0IFRoZSB0cmFuc2xhdGVkIHRleHQgKHdoaWNoIG1heSBjb250YWluIGJpbmRpbmcpXG4gKi9cbmZ1bmN0aW9uIGkxOG5TdGFydEZpcnN0Q3JlYXRlUGFzc1Byb2Nlc3NUZXh0Tm9kZShcbiAgICB0VmlldzogVFZpZXcsIHJvb3RUTm9kZTogVE5vZGV8bnVsbCwgZXhpc3RpbmdUTm9kZXM6IFROb2RlW10sIGNyZWF0ZU9wQ29kZXM6IEkxOG5DcmVhdGVPcENvZGVzLFxuICAgIHVwZGF0ZU9wQ29kZXM6IEkxOG5VcGRhdGVPcENvZGVzLCBsVmlldzogTFZpZXcsIHRleHQ6IHN0cmluZyk6IHZvaWQge1xuICBjb25zdCBoYXNCaW5kaW5nID0gdGV4dC5tYXRjaChCSU5ESU5HX1JFR0VYUCk7XG4gIGNvbnN0IHROb2RlID0gY3JlYXRlVE5vZGVBbmRBZGRPcENvZGUoXG4gICAgICB0Vmlldywgcm9vdFROb2RlLCBleGlzdGluZ1ROb2RlcywgbFZpZXcsIGNyZWF0ZU9wQ29kZXMsIGhhc0JpbmRpbmcgPyBudWxsIDogdGV4dCwgZmFsc2UpO1xuICBpZiAoaGFzQmluZGluZykge1xuICAgIGdlbmVyYXRlQmluZGluZ1VwZGF0ZU9wQ29kZXModXBkYXRlT3BDb2RlcywgdGV4dCwgdE5vZGUuaW5kZXgsIG51bGwsIDAsIG51bGwpO1xuICB9XG59XG5cbi8qKlxuICogU2VlIGBpMThuQXR0cmlidXRlc2AgYWJvdmUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpMThuQXR0cmlidXRlc0ZpcnN0UGFzcyh0VmlldzogVFZpZXcsIGluZGV4OiBudW1iZXIsIHZhbHVlczogc3RyaW5nW10pIHtcbiAgY29uc3QgcHJldmlvdXNFbGVtZW50ID0gZ2V0Q3VycmVudFROb2RlKCkhO1xuICBjb25zdCBwcmV2aW91c0VsZW1lbnRJbmRleCA9IHByZXZpb3VzRWxlbWVudC5pbmRleDtcbiAgY29uc3QgdXBkYXRlT3BDb2RlczogSTE4blVwZGF0ZU9wQ29kZXMgPSBbXSBhcyBhbnk7XG4gIGlmIChuZ0Rldk1vZGUpIHtcbiAgICBhdHRhY2hEZWJ1Z0dldHRlcih1cGRhdGVPcENvZGVzLCBpMThuVXBkYXRlT3BDb2Rlc1RvU3RyaW5nKTtcbiAgfVxuICBpZiAodFZpZXcuZmlyc3RDcmVhdGVQYXNzICYmIHRWaWV3LmRhdGFbaW5kZXhdID09PSBudWxsKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZXMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICAgIGNvbnN0IGF0dHJOYW1lID0gdmFsdWVzW2ldO1xuICAgICAgY29uc3QgbWVzc2FnZSA9IHZhbHVlc1tpICsgMV07XG5cbiAgICAgIGlmIChtZXNzYWdlICE9PSAnJykge1xuICAgICAgICAvLyBDaGVjayBpZiBhdHRyaWJ1dGUgdmFsdWUgY29udGFpbnMgYW4gSUNVIGFuZCB0aHJvdyBhbiBlcnJvciBpZiB0aGF0J3MgdGhlIGNhc2UuXG4gICAgICAgIC8vIElDVXMgaW4gZWxlbWVudCBhdHRyaWJ1dGVzIGFyZSBub3Qgc3VwcG9ydGVkLlxuICAgICAgICAvLyBOb3RlOiB3ZSBpbnRlbnRpb25hbGx5IHJldGFpbiB0aGUgZXJyb3IgaGVyZSBieSBub3QgdXNpbmcgYG5nRGV2TW9kZWAsIGJlY2F1c2VcbiAgICAgICAgLy8gdGhlIGB2YWx1ZWAgY2FuIGNoYW5nZSBiYXNlZCBvbiB0aGUgbG9jYWxlIGFuZCB1c2VycyBhcmVuJ3QgZ3VhcmFudGVlZCB0byBoaXRcbiAgICAgICAgLy8gYW4gaW52YWxpZCBzdHJpbmcgd2hpbGUgdGhleSdyZSBkZXZlbG9waW5nLlxuICAgICAgICBpZiAoSUNVX1JFR0VYUC50ZXN0KG1lc3NhZ2UpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICBgSUNVIGV4cHJlc3Npb25zIGFyZSBub3Qgc3VwcG9ydGVkIGluIGF0dHJpYnV0ZXMuIE1lc3NhZ2U6IFwiJHttZXNzYWdlfVwiLmApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaTE4biBhdHRyaWJ1dGVzIHRoYXQgaGl0IHRoaXMgY29kZSBwYXRoIGFyZSBndWFyYW50ZWVkIHRvIGhhdmUgYmluZGluZ3MsIGJlY2F1c2VcbiAgICAgICAgLy8gdGhlIGNvbXBpbGVyIHRyZWF0cyBzdGF0aWMgaTE4biBhdHRyaWJ1dGVzIGFzIHJlZ3VsYXIgYXR0cmlidXRlIGJpbmRpbmdzLlxuICAgICAgICAvLyBTaW5jZSB0aGlzIG1heSBub3QgYmUgdGhlIGZpcnN0IGkxOG4gYXR0cmlidXRlIG9uIHRoaXMgZWxlbWVudCB3ZSBuZWVkIHRvIHBhc3MgaW4gaG93XG4gICAgICAgIC8vIG1hbnkgcHJldmlvdXMgYmluZGluZ3MgdGhlcmUgaGF2ZSBhbHJlYWR5IGJlZW4uXG4gICAgICAgIGdlbmVyYXRlQmluZGluZ1VwZGF0ZU9wQ29kZXMoXG4gICAgICAgICAgICB1cGRhdGVPcENvZGVzLCBtZXNzYWdlLCBwcmV2aW91c0VsZW1lbnRJbmRleCwgYXR0ck5hbWUsIGNvdW50QmluZGluZ3ModXBkYXRlT3BDb2RlcyksXG4gICAgICAgICAgICBudWxsKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdFZpZXcuZGF0YVtpbmRleF0gPSB1cGRhdGVPcENvZGVzO1xuICB9XG59XG5cblxuLyoqXG4gKiBHZW5lcmF0ZSB0aGUgT3BDb2RlcyB0byB1cGRhdGUgdGhlIGJpbmRpbmdzIG9mIGEgc3RyaW5nLlxuICpcbiAqIEBwYXJhbSB1cGRhdGVPcENvZGVzIFBsYWNlIHdoZXJlIHRoZSB1cGRhdGUgb3Bjb2RlcyB3aWxsIGJlIHN0b3JlZC5cbiAqIEBwYXJhbSBzdHIgVGhlIHN0cmluZyBjb250YWluaW5nIHRoZSBiaW5kaW5ncy5cbiAqIEBwYXJhbSBkZXN0aW5hdGlvbk5vZGUgSW5kZXggb2YgdGhlIGRlc3RpbmF0aW9uIG5vZGUgd2hpY2ggd2lsbCByZWNlaXZlIHRoZSBiaW5kaW5nLlxuICogQHBhcmFtIGF0dHJOYW1lIE5hbWUgb2YgdGhlIGF0dHJpYnV0ZSwgaWYgdGhlIHN0cmluZyBiZWxvbmdzIHRvIGFuIGF0dHJpYnV0ZS5cbiAqIEBwYXJhbSBzYW5pdGl6ZUZuIFNhbml0aXphdGlvbiBmdW5jdGlvbiB1c2VkIHRvIHNhbml0aXplIHRoZSBzdHJpbmcgYWZ0ZXIgdXBkYXRlLCBpZiBuZWNlc3NhcnkuXG4gKiBAcGFyYW0gYmluZGluZ1N0YXJ0IFRoZSBsVmlldyBpbmRleCBvZiB0aGUgbmV4dCBleHByZXNzaW9uIHRoYXQgY2FuIGJlIGJvdW5kIHZpYSBhbiBvcENvZGUuXG4gKiBAcmV0dXJucyBUaGUgbWFzayB2YWx1ZSBmb3IgdGhlc2UgYmluZGluZ3NcbiAqL1xuZnVuY3Rpb24gZ2VuZXJhdGVCaW5kaW5nVXBkYXRlT3BDb2RlcyhcbiAgICB1cGRhdGVPcENvZGVzOiBJMThuVXBkYXRlT3BDb2Rlcywgc3RyOiBzdHJpbmcsIGRlc3RpbmF0aW9uTm9kZTogbnVtYmVyLCBhdHRyTmFtZTogc3RyaW5nfG51bGwsXG4gICAgYmluZGluZ1N0YXJ0OiBudW1iZXIsIHNhbml0aXplRm46IFNhbml0aXplckZufG51bGwpOiBudW1iZXIge1xuICBuZ0Rldk1vZGUgJiZcbiAgICAgIGFzc2VydEdyZWF0ZXJUaGFuT3JFcXVhbChcbiAgICAgICAgICBkZXN0aW5hdGlvbk5vZGUsIEhFQURFUl9PRkZTRVQsICdJbmRleCBtdXN0IGJlIGluIGFic29sdXRlIExWaWV3IG9mZnNldCcpO1xuICBjb25zdCBtYXNrSW5kZXggPSB1cGRhdGVPcENvZGVzLmxlbmd0aDsgIC8vIExvY2F0aW9uIG9mIG1hc2tcbiAgY29uc3Qgc2l6ZUluZGV4ID0gbWFza0luZGV4ICsgMTsgICAgICAgICAvLyBsb2NhdGlvbiBvZiBzaXplIGZvciBza2lwcGluZ1xuICB1cGRhdGVPcENvZGVzLnB1c2gobnVsbCwgbnVsbCk7ICAgICAgICAgIC8vIEFsbG9jIHNwYWNlIGZvciBtYXNrIGFuZCBzaXplXG4gIGNvbnN0IHN0YXJ0SW5kZXggPSBtYXNrSW5kZXggKyAyOyAgICAgICAgLy8gbG9jYXRpb24gb2YgZmlyc3QgYWxsb2NhdGlvbi5cbiAgaWYgKG5nRGV2TW9kZSkge1xuICAgIGF0dGFjaERlYnVnR2V0dGVyKHVwZGF0ZU9wQ29kZXMsIGkxOG5VcGRhdGVPcENvZGVzVG9TdHJpbmcpO1xuICB9XG4gIGNvbnN0IHRleHRQYXJ0cyA9IHN0ci5zcGxpdChCSU5ESU5HX1JFR0VYUCk7XG4gIGxldCBtYXNrID0gMDtcblxuICBmb3IgKGxldCBqID0gMDsgaiA8IHRleHRQYXJ0cy5sZW5ndGg7IGorKykge1xuICAgIGNvbnN0IHRleHRWYWx1ZSA9IHRleHRQYXJ0c1tqXTtcblxuICAgIGlmIChqICYgMSkge1xuICAgICAgLy8gT2RkIGluZGV4ZXMgYXJlIGJpbmRpbmdzXG4gICAgICBjb25zdCBiaW5kaW5nSW5kZXggPSBiaW5kaW5nU3RhcnQgKyBwYXJzZUludCh0ZXh0VmFsdWUsIDEwKTtcbiAgICAgIHVwZGF0ZU9wQ29kZXMucHVzaCgtMSAtIGJpbmRpbmdJbmRleCk7XG4gICAgICBtYXNrID0gbWFzayB8IHRvTWFza0JpdChiaW5kaW5nSW5kZXgpO1xuICAgIH0gZWxzZSBpZiAodGV4dFZhbHVlICE9PSAnJykge1xuICAgICAgLy8gRXZlbiBpbmRleGVzIGFyZSB0ZXh0XG4gICAgICB1cGRhdGVPcENvZGVzLnB1c2godGV4dFZhbHVlKTtcbiAgICB9XG4gIH1cblxuICB1cGRhdGVPcENvZGVzLnB1c2goXG4gICAgICBkZXN0aW5hdGlvbk5vZGUgPDwgSTE4blVwZGF0ZU9wQ29kZS5TSElGVF9SRUYgfFxuICAgICAgKGF0dHJOYW1lID8gSTE4blVwZGF0ZU9wQ29kZS5BdHRyIDogSTE4blVwZGF0ZU9wQ29kZS5UZXh0KSk7XG4gIGlmIChhdHRyTmFtZSkge1xuICAgIHVwZGF0ZU9wQ29kZXMucHVzaChhdHRyTmFtZSwgc2FuaXRpemVGbik7XG4gIH1cbiAgdXBkYXRlT3BDb2Rlc1ttYXNrSW5kZXhdID0gbWFzaztcbiAgdXBkYXRlT3BDb2Rlc1tzaXplSW5kZXhdID0gdXBkYXRlT3BDb2Rlcy5sZW5ndGggLSBzdGFydEluZGV4O1xuICByZXR1cm4gbWFzaztcbn1cblxuLyoqXG4gKiBDb3VudCB0aGUgbnVtYmVyIG9mIGJpbmRpbmdzIGluIHRoZSBnaXZlbiBgb3BDb2Rlc2AuXG4gKlxuICogSXQgY291bGQgYmUgcG9zc2libGUgdG8gc3BlZWQgdGhpcyB1cCwgYnkgcGFzc2luZyB0aGUgbnVtYmVyIG9mIGJpbmRpbmdzIGZvdW5kIGJhY2sgZnJvbVxuICogYGdlbmVyYXRlQmluZGluZ1VwZGF0ZU9wQ29kZXMoKWAgdG8gYGkxOG5BdHRyaWJ1dGVzRmlyc3RQYXNzKClgIGJ1dCB0aGlzIHdvdWxkIHRoZW4gcmVxdWlyZSBtb3JlXG4gKiBjb21wbGV4aXR5IGluIHRoZSBjb2RlIGFuZC9vciB0cmFuc2llbnQgb2JqZWN0cyB0byBiZSBjcmVhdGVkLlxuICpcbiAqIFNpbmNlIHRoaXMgZnVuY3Rpb24gaXMgb25seSBjYWxsZWQgb25jZSB3aGVuIHRoZSB0ZW1wbGF0ZSBpcyBpbnN0YW50aWF0ZWQsIGlzIHRyaXZpYWwgaW4gdGhlXG4gKiBmaXJzdCBpbnN0YW5jZSAoc2luY2UgYG9wQ29kZXNgIHdpbGwgYmUgYW4gZW1wdHkgYXJyYXkpLCBhbmQgaXQgaXMgbm90IGNvbW1vbiBmb3IgZWxlbWVudHMgdG9cbiAqIGNvbnRhaW4gbXVsdGlwbGUgaTE4biBib3VuZCBhdHRyaWJ1dGVzLCBpdCBzZWVtcyBsaWtlIHRoaXMgaXMgYSByZWFzb25hYmxlIGNvbXByb21pc2UuXG4gKi9cbmZ1bmN0aW9uIGNvdW50QmluZGluZ3Mob3BDb2RlczogSTE4blVwZGF0ZU9wQ29kZXMpOiBudW1iZXIge1xuICBsZXQgY291bnQgPSAwO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG9wQ29kZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBvcENvZGUgPSBvcENvZGVzW2ldO1xuICAgIC8vIEJpbmRpbmdzIGFyZSBuZWdhdGl2ZSBudW1iZXJzLlxuICAgIGlmICh0eXBlb2Ygb3BDb2RlID09PSAnbnVtYmVyJyAmJiBvcENvZGUgPCAwKSB7XG4gICAgICBjb3VudCsrO1xuICAgIH1cbiAgfVxuICByZXR1cm4gY291bnQ7XG59XG5cbi8qKlxuICogQ29udmVydCBiaW5kaW5nIGluZGV4IHRvIG1hc2sgYml0LlxuICpcbiAqIEVhY2ggaW5kZXggcmVwcmVzZW50cyBhIHNpbmdsZSBiaXQgb24gdGhlIGJpdC1tYXNrLiBCZWNhdXNlIGJpdC1tYXNrIG9ubHkgaGFzIDMyIGJpdHMsIHdlIG1ha2VcbiAqIHRoZSAzMm5kIGJpdCBzaGFyZSBhbGwgbWFza3MgZm9yIGFsbCBiaW5kaW5ncyBoaWdoZXIgdGhhbiAzMi4gU2luY2UgaXQgaXMgZXh0cmVtZWx5IHJhcmUgdG9cbiAqIGhhdmUgbW9yZSB0aGFuIDMyIGJpbmRpbmdzIHRoaXMgd2lsbCBiZSBoaXQgdmVyeSByYXJlbHkuIFRoZSBkb3duc2lkZSBvZiBoaXR0aW5nIHRoaXMgY29ybmVyXG4gKiBjYXNlIGlzIHRoYXQgd2Ugd2lsbCBleGVjdXRlIGJpbmRpbmcgY29kZSBtb3JlIG9mdGVuIHRoYW4gbmVjZXNzYXJ5LiAocGVuYWx0eSBvZiBwZXJmb3JtYW5jZSlcbiAqL1xuZnVuY3Rpb24gdG9NYXNrQml0KGJpbmRpbmdJbmRleDogbnVtYmVyKTogbnVtYmVyIHtcbiAgcmV0dXJuIDEgPDwgTWF0aC5taW4oYmluZGluZ0luZGV4LCAzMSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1Jvb3RUZW1wbGF0ZU1lc3NhZ2Uoc3ViVGVtcGxhdGVJbmRleDogbnVtYmVyKTogc3ViVGVtcGxhdGVJbmRleCBpcyAtIDEge1xuICByZXR1cm4gc3ViVGVtcGxhdGVJbmRleCA9PT0gLTE7XG59XG5cblxuLyoqXG4gKiBSZW1vdmVzIGV2ZXJ5dGhpbmcgaW5zaWRlIHRoZSBzdWItdGVtcGxhdGVzIG9mIGEgbWVzc2FnZS5cbiAqL1xuZnVuY3Rpb24gcmVtb3ZlSW5uZXJUZW1wbGF0ZVRyYW5zbGF0aW9uKG1lc3NhZ2U6IHN0cmluZyk6IHN0cmluZyB7XG4gIGxldCBtYXRjaDtcbiAgbGV0IHJlcyA9ICcnO1xuICBsZXQgaW5kZXggPSAwO1xuICBsZXQgaW5UZW1wbGF0ZSA9IGZhbHNlO1xuICBsZXQgdGFnTWF0Y2hlZDtcblxuICB3aGlsZSAoKG1hdGNoID0gU1VCVEVNUExBVEVfUkVHRVhQLmV4ZWMobWVzc2FnZSkpICE9PSBudWxsKSB7XG4gICAgaWYgKCFpblRlbXBsYXRlKSB7XG4gICAgICByZXMgKz0gbWVzc2FnZS5zdWJzdHJpbmcoaW5kZXgsIG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoKTtcbiAgICAgIHRhZ01hdGNoZWQgPSBtYXRjaFsxXTtcbiAgICAgIGluVGVtcGxhdGUgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAobWF0Y2hbMF0gPT09IGAke01BUktFUn0vKiR7dGFnTWF0Y2hlZH0ke01BUktFUn1gKSB7XG4gICAgICAgIGluZGV4ID0gbWF0Y2guaW5kZXg7XG4gICAgICAgIGluVGVtcGxhdGUgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBuZ0Rldk1vZGUgJiZcbiAgICAgIGFzc2VydEVxdWFsKFxuICAgICAgICAgIGluVGVtcGxhdGUsIGZhbHNlLFxuICAgICAgICAgIGBUYWcgbWlzbWF0Y2g6IHVuYWJsZSB0byBmaW5kIHRoZSBlbmQgb2YgdGhlIHN1Yi10ZW1wbGF0ZSBpbiB0aGUgdHJhbnNsYXRpb24gXCIke1xuICAgICAgICAgICAgICBtZXNzYWdlfVwiYCk7XG5cbiAgcmVzICs9IG1lc3NhZ2Uuc2xpY2UoaW5kZXgpO1xuICByZXR1cm4gcmVzO1xufVxuXG5cbi8qKlxuICogRXh0cmFjdHMgYSBwYXJ0IG9mIGEgbWVzc2FnZSBhbmQgcmVtb3ZlcyB0aGUgcmVzdC5cbiAqXG4gKiBUaGlzIG1ldGhvZCBpcyB1c2VkIGZvciBleHRyYWN0aW5nIGEgcGFydCBvZiB0aGUgbWVzc2FnZSBhc3NvY2lhdGVkIHdpdGggYSB0ZW1wbGF0ZS4gQVxuICogdHJhbnNsYXRlZCBtZXNzYWdlIGNhbiBzcGFuIG11bHRpcGxlIHRlbXBsYXRlcy5cbiAqXG4gKiBFeGFtcGxlOlxuICogYGBgXG4gKiA8ZGl2IGkxOG4+VHJhbnNsYXRlIDxzcGFuICpuZ0lmPm1lPC9zcGFuPiE8L2Rpdj5cbiAqIGBgYFxuICpcbiAqIEBwYXJhbSBtZXNzYWdlIFRoZSBtZXNzYWdlIHRvIGNyb3BcbiAqIEBwYXJhbSBzdWJUZW1wbGF0ZUluZGV4IEluZGV4IG9mIHRoZSBzdWItdGVtcGxhdGUgdG8gZXh0cmFjdC4gSWYgdW5kZWZpbmVkIGl0IHJldHVybnMgdGhlXG4gKiBleHRlcm5hbCB0ZW1wbGF0ZSBhbmQgcmVtb3ZlcyBhbGwgc3ViLXRlbXBsYXRlcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFRyYW5zbGF0aW9uRm9yVGVtcGxhdGUobWVzc2FnZTogc3RyaW5nLCBzdWJUZW1wbGF0ZUluZGV4OiBudW1iZXIpIHtcbiAgaWYgKGlzUm9vdFRlbXBsYXRlTWVzc2FnZShzdWJUZW1wbGF0ZUluZGV4KSkge1xuICAgIC8vIFdlIHdhbnQgdGhlIHJvb3QgdGVtcGxhdGUgbWVzc2FnZSwgaWdub3JlIGFsbCBzdWItdGVtcGxhdGVzXG4gICAgcmV0dXJuIHJlbW92ZUlubmVyVGVtcGxhdGVUcmFuc2xhdGlvbihtZXNzYWdlKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBXZSB3YW50IGEgc3BlY2lmaWMgc3ViLXRlbXBsYXRlXG4gICAgY29uc3Qgc3RhcnQgPVxuICAgICAgICBtZXNzYWdlLmluZGV4T2YoYDoke3N1YlRlbXBsYXRlSW5kZXh9JHtNQVJLRVJ9YCkgKyAyICsgc3ViVGVtcGxhdGVJbmRleC50b1N0cmluZygpLmxlbmd0aDtcbiAgICBjb25zdCBlbmQgPSBtZXNzYWdlLnNlYXJjaChuZXcgUmVnRXhwKGAke01BUktFUn1cXFxcL1xcXFwqXFxcXGQrOiR7c3ViVGVtcGxhdGVJbmRleH0ke01BUktFUn1gKSk7XG4gICAgcmV0dXJuIHJlbW92ZUlubmVyVGVtcGxhdGVUcmFuc2xhdGlvbihtZXNzYWdlLnN1YnN0cmluZyhzdGFydCwgZW5kKSk7XG4gIH1cbn1cblxuLyoqXG4gKiBHZW5lcmF0ZSB0aGUgT3BDb2RlcyBmb3IgSUNVIGV4cHJlc3Npb25zLlxuICpcbiAqIEBwYXJhbSBpY3VFeHByZXNzaW9uXG4gKiBAcGFyYW0gaW5kZXggSW5kZXggd2hlcmUgdGhlIGFuY2hvciBpcyBzdG9yZWQgYW5kIGFuIG9wdGlvbmFsIGBUSWN1Q29udGFpbmVyTm9kZWBcbiAqICAgLSBgbFZpZXdbYW5jaG9ySWR4XWAgcG9pbnRzIHRvIGEgYENvbW1lbnRgIG5vZGUgcmVwcmVzZW50aW5nIHRoZSBhbmNob3IgZm9yIHRoZSBJQ1UuXG4gKiAgIC0gYHRWaWV3LmRhdGFbYW5jaG9ySWR4XWAgcG9pbnRzIHRvIHRoZSBgVEljdUNvbnRhaW5lck5vZGVgIGlmIElDVSBpcyByb290IChgbnVsbGAgb3RoZXJ3aXNlKVxuICovXG5leHBvcnQgZnVuY3Rpb24gaWN1U3RhcnQoXG4gICAgdFZpZXc6IFRWaWV3LCBsVmlldzogTFZpZXcsIHVwZGF0ZU9wQ29kZXM6IEkxOG5VcGRhdGVPcENvZGVzLCBwYXJlbnRJZHg6IG51bWJlcixcbiAgICBpY3VFeHByZXNzaW9uOiBJY3VFeHByZXNzaW9uLCBhbmNob3JJZHg6IG51bWJlcikge1xuICBuZ0Rldk1vZGUgJiYgYXNzZXJ0RGVmaW5lZChpY3VFeHByZXNzaW9uLCAnSUNVIGV4cHJlc3Npb24gbXVzdCBiZSBkZWZpbmVkJyk7XG4gIGxldCBiaW5kaW5nTWFzayA9IDA7XG4gIGNvbnN0IHRJY3U6IFRJY3UgPSB7XG4gICAgdHlwZTogaWN1RXhwcmVzc2lvbi50eXBlLFxuICAgIGN1cnJlbnRDYXNlTFZpZXdJbmRleDogYWxsb2NFeHBhbmRvKHRWaWV3LCBsVmlldywgMSwgbnVsbCksXG4gICAgYW5jaG9ySWR4LFxuICAgIGNhc2VzOiBbXSxcbiAgICBjcmVhdGU6IFtdLFxuICAgIHJlbW92ZTogW10sXG4gICAgdXBkYXRlOiBbXVxuICB9O1xuICBhZGRVcGRhdGVJY3VTd2l0Y2godXBkYXRlT3BDb2RlcywgaWN1RXhwcmVzc2lvbiwgYW5jaG9ySWR4KTtcbiAgc2V0VEljdSh0VmlldywgYW5jaG9ySWR4LCB0SWN1KTtcbiAgY29uc3QgdmFsdWVzID0gaWN1RXhwcmVzc2lvbi52YWx1ZXM7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgLy8gRWFjaCB2YWx1ZSBpcyBhbiBhcnJheSBvZiBzdHJpbmdzICYgb3RoZXIgSUNVIGV4cHJlc3Npb25zXG4gICAgY29uc3QgdmFsdWVBcnIgPSB2YWx1ZXNbaV07XG4gICAgY29uc3QgbmVzdGVkSWN1czogSWN1RXhwcmVzc2lvbltdID0gW107XG4gICAgZm9yIChsZXQgaiA9IDA7IGogPCB2YWx1ZUFyci5sZW5ndGg7IGorKykge1xuICAgICAgY29uc3QgdmFsdWUgPSB2YWx1ZUFycltqXTtcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIC8vIEl0IGlzIGFuIG5lc3RlZCBJQ1UgZXhwcmVzc2lvblxuICAgICAgICBjb25zdCBpY3VJbmRleCA9IG5lc3RlZEljdXMucHVzaCh2YWx1ZSBhcyBJY3VFeHByZXNzaW9uKSAtIDE7XG4gICAgICAgIC8vIFJlcGxhY2UgbmVzdGVkIElDVSBleHByZXNzaW9uIGJ5IGEgY29tbWVudCBub2RlXG4gICAgICAgIHZhbHVlQXJyW2pdID0gYDwhLS3vv70ke2ljdUluZGV4fe+/vS0tPmA7XG4gICAgICB9XG4gICAgfVxuICAgIGJpbmRpbmdNYXNrID0gcGFyc2VJY3VDYXNlKFxuICAgICAgICAgICAgICAgICAgICAgIHRWaWV3LCB0SWN1LCBsVmlldywgdXBkYXRlT3BDb2RlcywgcGFyZW50SWR4LCBpY3VFeHByZXNzaW9uLmNhc2VzW2ldLFxuICAgICAgICAgICAgICAgICAgICAgIHZhbHVlQXJyLmpvaW4oJycpLCBuZXN0ZWRJY3VzKSB8XG4gICAgICAgIGJpbmRpbmdNYXNrO1xuICB9XG4gIGlmIChiaW5kaW5nTWFzaykge1xuICAgIGFkZFVwZGF0ZUljdVVwZGF0ZSh1cGRhdGVPcENvZGVzLCBiaW5kaW5nTWFzaywgYW5jaG9ySWR4KTtcbiAgfVxufVxuXG4vKipcbiAqIFBhcnNlcyB0ZXh0IGNvbnRhaW5pbmcgYW4gSUNVIGV4cHJlc3Npb24gYW5kIHByb2R1Y2VzIGEgSlNPTiBvYmplY3QgZm9yIGl0LlxuICogT3JpZ2luYWwgY29kZSBmcm9tIGNsb3N1cmUgbGlicmFyeSwgbW9kaWZpZWQgZm9yIEFuZ3VsYXIuXG4gKlxuICogQHBhcmFtIHBhdHRlcm4gVGV4dCBjb250YWluaW5nIGFuIElDVSBleHByZXNzaW9uIHRoYXQgbmVlZHMgdG8gYmUgcGFyc2VkLlxuICpcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSUNVQmxvY2socGF0dGVybjogc3RyaW5nKTogSWN1RXhwcmVzc2lvbiB7XG4gIGNvbnN0IGNhc2VzID0gW107XG4gIGNvbnN0IHZhbHVlczogKHN0cmluZ3xJY3VFeHByZXNzaW9uKVtdW10gPSBbXTtcbiAgbGV0IGljdVR5cGUgPSBJY3VUeXBlLnBsdXJhbDtcbiAgbGV0IG1haW5CaW5kaW5nID0gMDtcbiAgcGF0dGVybiA9IHBhdHRlcm4ucmVwbGFjZShJQ1VfQkxPQ0tfUkVHRVhQLCBmdW5jdGlvbihzdHI6IHN0cmluZywgYmluZGluZzogc3RyaW5nLCB0eXBlOiBzdHJpbmcpIHtcbiAgICBpZiAodHlwZSA9PT0gJ3NlbGVjdCcpIHtcbiAgICAgIGljdVR5cGUgPSBJY3VUeXBlLnNlbGVjdDtcbiAgICB9IGVsc2Uge1xuICAgICAgaWN1VHlwZSA9IEljdVR5cGUucGx1cmFsO1xuICAgIH1cbiAgICBtYWluQmluZGluZyA9IHBhcnNlSW50KGJpbmRpbmcuc2xpY2UoMSksIDEwKTtcbiAgICByZXR1cm4gJyc7XG4gIH0pO1xuXG4gIGNvbnN0IHBhcnRzID0gaTE4blBhcnNlVGV4dEludG9QYXJ0c0FuZElDVShwYXR0ZXJuKSBhcyBzdHJpbmdbXTtcbiAgLy8gTG9va2luZyBmb3IgKGtleSBibG9jaykrIHNlcXVlbmNlLiBPbmUgb2YgdGhlIGtleXMgaGFzIHRvIGJlIFwib3RoZXJcIi5cbiAgZm9yIChsZXQgcG9zID0gMDsgcG9zIDwgcGFydHMubGVuZ3RoOykge1xuICAgIGxldCBrZXkgPSBwYXJ0c1twb3MrK10udHJpbSgpO1xuICAgIGlmIChpY3VUeXBlID09PSBJY3VUeXBlLnBsdXJhbCkge1xuICAgICAgLy8gS2V5IGNhbiBiZSBcIj14XCIsIHdlIGp1c3Qgd2FudCBcInhcIlxuICAgICAga2V5ID0ga2V5LnJlcGxhY2UoL1xccyooPzo9KT8oXFx3KylcXHMqLywgJyQxJyk7XG4gICAgfVxuICAgIGlmIChrZXkubGVuZ3RoKSB7XG4gICAgICBjYXNlcy5wdXNoKGtleSk7XG4gICAgfVxuXG4gICAgY29uc3QgYmxvY2tzID0gaTE4blBhcnNlVGV4dEludG9QYXJ0c0FuZElDVShwYXJ0c1twb3MrK10pIGFzIHN0cmluZ1tdO1xuICAgIGlmIChjYXNlcy5sZW5ndGggPiB2YWx1ZXMubGVuZ3RoKSB7XG4gICAgICB2YWx1ZXMucHVzaChibG9ja3MpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFRPRE8ob2NvbWJlKTogc3VwcG9ydCBJQ1UgZXhwcmVzc2lvbnMgaW4gYXR0cmlidXRlcywgc2VlICMyMTYxNVxuICByZXR1cm4ge3R5cGU6IGljdVR5cGUsIG1haW5CaW5kaW5nOiBtYWluQmluZGluZywgY2FzZXMsIHZhbHVlc307XG59XG5cblxuLyoqXG4gKiBCcmVha3MgcGF0dGVybiBpbnRvIHN0cmluZ3MgYW5kIHRvcCBsZXZlbCB7Li4ufSBibG9ja3MuXG4gKiBDYW4gYmUgdXNlZCB0byBicmVhayBhIG1lc3NhZ2UgaW50byB0ZXh0IGFuZCBJQ1UgZXhwcmVzc2lvbnMsIG9yIHRvIGJyZWFrIGFuIElDVSBleHByZXNzaW9uXG4gKiBpbnRvIGtleXMgYW5kIGNhc2VzLiBPcmlnaW5hbCBjb2RlIGZyb20gY2xvc3VyZSBsaWJyYXJ5LCBtb2RpZmllZCBmb3IgQW5ndWxhci5cbiAqXG4gKiBAcGFyYW0gcGF0dGVybiAoc3ViKVBhdHRlcm4gdG8gYmUgYnJva2VuLlxuICogQHJldHVybnMgQW4gYEFycmF5PHN0cmluZ3xJY3VFeHByZXNzaW9uPmAgd2hlcmU6XG4gKiAgIC0gb2RkIHBvc2l0aW9uczogYHN0cmluZ2AgPT4gdGV4dCBiZXR3ZWVuIElDVSBleHByZXNzaW9uc1xuICogICAtIGV2ZW4gcG9zaXRpb25zOiBgSUNVRXhwcmVzc2lvbmAgPT4gSUNVIGV4cHJlc3Npb24gcGFyc2VkIGludG8gYElDVUV4cHJlc3Npb25gIHJlY29yZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGkxOG5QYXJzZVRleHRJbnRvUGFydHNBbmRJQ1UocGF0dGVybjogc3RyaW5nKTogKHN0cmluZ3xJY3VFeHByZXNzaW9uKVtdIHtcbiAgaWYgKCFwYXR0ZXJuKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgbGV0IHByZXZQb3MgPSAwO1xuICBjb25zdCBicmFjZVN0YWNrID0gW107XG4gIGNvbnN0IHJlc3VsdHM6IChzdHJpbmd8SWN1RXhwcmVzc2lvbilbXSA9IFtdO1xuICBjb25zdCBicmFjZXMgPSAvW3t9XS9nO1xuICAvLyBsYXN0SW5kZXggZG9lc24ndCBnZXQgc2V0IHRvIDAgc28gd2UgaGF2ZSB0by5cbiAgYnJhY2VzLmxhc3RJbmRleCA9IDA7XG5cbiAgbGV0IG1hdGNoO1xuICB3aGlsZSAobWF0Y2ggPSBicmFjZXMuZXhlYyhwYXR0ZXJuKSkge1xuICAgIGNvbnN0IHBvcyA9IG1hdGNoLmluZGV4O1xuICAgIGlmIChtYXRjaFswXSA9PSAnfScpIHtcbiAgICAgIGJyYWNlU3RhY2sucG9wKCk7XG5cbiAgICAgIGlmIChicmFjZVN0YWNrLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgIC8vIEVuZCBvZiB0aGUgYmxvY2suXG4gICAgICAgIGNvbnN0IGJsb2NrID0gcGF0dGVybi5zdWJzdHJpbmcocHJldlBvcywgcG9zKTtcbiAgICAgICAgaWYgKElDVV9CTE9DS19SRUdFWFAudGVzdChibG9jaykpIHtcbiAgICAgICAgICByZXN1bHRzLnB1c2gocGFyc2VJQ1VCbG9jayhibG9jaykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc3VsdHMucHVzaChibG9jayk7XG4gICAgICAgIH1cblxuICAgICAgICBwcmV2UG9zID0gcG9zICsgMTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGJyYWNlU3RhY2subGVuZ3RoID09IDApIHtcbiAgICAgICAgY29uc3Qgc3Vic3RyaW5nID0gcGF0dGVybi5zdWJzdHJpbmcocHJldlBvcywgcG9zKTtcbiAgICAgICAgcmVzdWx0cy5wdXNoKHN1YnN0cmluZyk7XG4gICAgICAgIHByZXZQb3MgPSBwb3MgKyAxO1xuICAgICAgfVxuICAgICAgYnJhY2VTdGFjay5wdXNoKCd7Jyk7XG4gICAgfVxuICB9XG5cbiAgY29uc3Qgc3Vic3RyaW5nID0gcGF0dGVybi5zdWJzdHJpbmcocHJldlBvcyk7XG4gIHJlc3VsdHMucHVzaChzdWJzdHJpbmcpO1xuICByZXR1cm4gcmVzdWx0cztcbn1cblxuXG4vKipcbiAqIFBhcnNlcyBhIG5vZGUsIGl0cyBjaGlsZHJlbiBhbmQgaXRzIHNpYmxpbmdzLCBhbmQgZ2VuZXJhdGVzIHRoZSBtdXRhdGUgJiB1cGRhdGUgT3BDb2Rlcy5cbiAqXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUljdUNhc2UoXG4gICAgdFZpZXc6IFRWaWV3LCB0SWN1OiBUSWN1LCBsVmlldzogTFZpZXcsIHVwZGF0ZU9wQ29kZXM6IEkxOG5VcGRhdGVPcENvZGVzLCBwYXJlbnRJZHg6IG51bWJlcixcbiAgICBjYXNlTmFtZTogc3RyaW5nLCB1bnNhZmVDYXNlSHRtbDogc3RyaW5nLCBuZXN0ZWRJY3VzOiBJY3VFeHByZXNzaW9uW10pOiBudW1iZXIge1xuICBjb25zdCBjcmVhdGU6IEljdUNyZWF0ZU9wQ29kZXMgPSBbXSBhcyBhbnk7XG4gIGNvbnN0IHJlbW92ZTogSTE4blJlbW92ZU9wQ29kZXMgPSBbXSBhcyBhbnk7XG4gIGNvbnN0IHVwZGF0ZTogSTE4blVwZGF0ZU9wQ29kZXMgPSBbXSBhcyBhbnk7XG4gIGlmIChuZ0Rldk1vZGUpIHtcbiAgICBhdHRhY2hEZWJ1Z0dldHRlcihjcmVhdGUsIGljdUNyZWF0ZU9wQ29kZXNUb1N0cmluZyk7XG4gICAgYXR0YWNoRGVidWdHZXR0ZXIocmVtb3ZlLCBpMThuUmVtb3ZlT3BDb2Rlc1RvU3RyaW5nKTtcbiAgICBhdHRhY2hEZWJ1Z0dldHRlcih1cGRhdGUsIGkxOG5VcGRhdGVPcENvZGVzVG9TdHJpbmcpO1xuICB9XG4gIHRJY3UuY2FzZXMucHVzaChjYXNlTmFtZSk7XG4gIHRJY3UuY3JlYXRlLnB1c2goY3JlYXRlKTtcbiAgdEljdS5yZW1vdmUucHVzaChyZW1vdmUpO1xuICB0SWN1LnVwZGF0ZS5wdXNoKHVwZGF0ZSk7XG5cbiAgY29uc3QgaW5lcnRCb2R5SGVscGVyID0gZ2V0SW5lcnRCb2R5SGVscGVyKGdldERvY3VtZW50KCkpO1xuICBjb25zdCBpbmVydEJvZHlFbGVtZW50ID0gaW5lcnRCb2R5SGVscGVyLmdldEluZXJ0Qm9keUVsZW1lbnQodW5zYWZlQ2FzZUh0bWwpO1xuICBuZ0Rldk1vZGUgJiYgYXNzZXJ0RGVmaW5lZChpbmVydEJvZHlFbGVtZW50LCAnVW5hYmxlIHRvIGdlbmVyYXRlIGluZXJ0IGJvZHkgZWxlbWVudCcpO1xuICBjb25zdCBpbmVydFJvb3ROb2RlID0gZ2V0VGVtcGxhdGVDb250ZW50KGluZXJ0Qm9keUVsZW1lbnQhKSBhcyBFbGVtZW50IHx8IGluZXJ0Qm9keUVsZW1lbnQ7XG4gIGlmIChpbmVydFJvb3ROb2RlKSB7XG4gICAgcmV0dXJuIHdhbGtJY3VUcmVlKFxuICAgICAgICB0VmlldywgdEljdSwgbFZpZXcsIHVwZGF0ZU9wQ29kZXMsIGNyZWF0ZSwgcmVtb3ZlLCB1cGRhdGUsIGluZXJ0Um9vdE5vZGUsIHBhcmVudElkeCxcbiAgICAgICAgbmVzdGVkSWN1cywgMCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIDA7XG4gIH1cbn1cblxuZnVuY3Rpb24gd2Fsa0ljdVRyZWUoXG4gICAgdFZpZXc6IFRWaWV3LCB0SWN1OiBUSWN1LCBsVmlldzogTFZpZXcsIHNoYXJlZFVwZGF0ZU9wQ29kZXM6IEkxOG5VcGRhdGVPcENvZGVzLFxuICAgIGNyZWF0ZTogSWN1Q3JlYXRlT3BDb2RlcywgcmVtb3ZlOiBJMThuUmVtb3ZlT3BDb2RlcywgdXBkYXRlOiBJMThuVXBkYXRlT3BDb2RlcyxcbiAgICBwYXJlbnROb2RlOiBFbGVtZW50LCBwYXJlbnRJZHg6IG51bWJlciwgbmVzdGVkSWN1czogSWN1RXhwcmVzc2lvbltdLCBkZXB0aDogbnVtYmVyKTogbnVtYmVyIHtcbiAgbGV0IGJpbmRpbmdNYXNrID0gMDtcbiAgbGV0IGN1cnJlbnROb2RlID0gcGFyZW50Tm9kZS5maXJzdENoaWxkO1xuICB3aGlsZSAoY3VycmVudE5vZGUpIHtcbiAgICBjb25zdCBuZXdJbmRleCA9IGFsbG9jRXhwYW5kbyh0VmlldywgbFZpZXcsIDEsIG51bGwpO1xuICAgIHN3aXRjaCAoY3VycmVudE5vZGUubm9kZVR5cGUpIHtcbiAgICAgIGNhc2UgTm9kZS5FTEVNRU5UX05PREU6XG4gICAgICAgIGNvbnN0IGVsZW1lbnQgPSBjdXJyZW50Tm9kZSBhcyBFbGVtZW50O1xuICAgICAgICBjb25zdCB0YWdOYW1lID0gZWxlbWVudC50YWdOYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGlmIChWQUxJRF9FTEVNRU5UUy5oYXNPd25Qcm9wZXJ0eSh0YWdOYW1lKSkge1xuICAgICAgICAgIGFkZENyZWF0ZU5vZGVBbmRBcHBlbmQoY3JlYXRlLCBFTEVNRU5UX01BUktFUiwgdGFnTmFtZSwgcGFyZW50SWR4LCBuZXdJbmRleCk7XG4gICAgICAgICAgdFZpZXcuZGF0YVtuZXdJbmRleF0gPSB0YWdOYW1lO1xuICAgICAgICAgIGNvbnN0IGVsQXR0cnMgPSBlbGVtZW50LmF0dHJpYnV0ZXM7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBlbEF0dHJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBhdHRyID0gZWxBdHRycy5pdGVtKGkpITtcbiAgICAgICAgICAgIGNvbnN0IGxvd2VyQXR0ck5hbWUgPSBhdHRyLm5hbWUudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgIGNvbnN0IGhhc0JpbmRpbmcgPSAhIWF0dHIudmFsdWUubWF0Y2goQklORElOR19SRUdFWFApO1xuICAgICAgICAgICAgLy8gd2UgYXNzdW1lIHRoZSBpbnB1dCBzdHJpbmcgaXMgc2FmZSwgdW5sZXNzIGl0J3MgdXNpbmcgYSBiaW5kaW5nXG4gICAgICAgICAgICBpZiAoaGFzQmluZGluZykge1xuICAgICAgICAgICAgICBpZiAoVkFMSURfQVRUUlMuaGFzT3duUHJvcGVydHkobG93ZXJBdHRyTmFtZSkpIHtcbiAgICAgICAgICAgICAgICBpZiAoVVJJX0FUVFJTW2xvd2VyQXR0ck5hbWVdKSB7XG4gICAgICAgICAgICAgICAgICBnZW5lcmF0ZUJpbmRpbmdVcGRhdGVPcENvZGVzKFxuICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZSwgYXR0ci52YWx1ZSwgbmV3SW5kZXgsIGF0dHIubmFtZSwgMCwgX3Nhbml0aXplVXJsKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKFNSQ1NFVF9BVFRSU1tsb3dlckF0dHJOYW1lXSkge1xuICAgICAgICAgICAgICAgICAgZ2VuZXJhdGVCaW5kaW5nVXBkYXRlT3BDb2RlcyhcbiAgICAgICAgICAgICAgICAgICAgICB1cGRhdGUsIGF0dHIudmFsdWUsIG5ld0luZGV4LCBhdHRyLm5hbWUsIDAsIHNhbml0aXplU3Jjc2V0KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgZ2VuZXJhdGVCaW5kaW5nVXBkYXRlT3BDb2Rlcyh1cGRhdGUsIGF0dHIudmFsdWUsIG5ld0luZGV4LCBhdHRyLm5hbWUsIDAsIG51bGwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBuZ0Rldk1vZGUgJiZcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgICAgICAgICAgICAgYFdBUk5JTkc6IGlnbm9yaW5nIHVuc2FmZSBhdHRyaWJ1dGUgdmFsdWUgYCArXG4gICAgICAgICAgICAgICAgICAgICAgICBgJHtsb3dlckF0dHJOYW1lfSBvbiBlbGVtZW50ICR7dGFnTmFtZX0gYCArXG4gICAgICAgICAgICAgICAgICAgICAgICBgKHNlZSBodHRwczovL2cuY28vbmcvc2VjdXJpdHkjeHNzKWApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBhZGRDcmVhdGVBdHRyaWJ1dGUoY3JlYXRlLCBuZXdJbmRleCwgYXR0cik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFBhcnNlIHRoZSBjaGlsZHJlbiBvZiB0aGlzIG5vZGUgKGlmIGFueSlcbiAgICAgICAgICBiaW5kaW5nTWFzayA9IHdhbGtJY3VUcmVlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRWaWV3LCB0SWN1LCBsVmlldywgc2hhcmVkVXBkYXRlT3BDb2RlcywgY3JlYXRlLCByZW1vdmUsIHVwZGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50Tm9kZSBhcyBFbGVtZW50LCBuZXdJbmRleCwgbmVzdGVkSWN1cywgZGVwdGggKyAxKSB8XG4gICAgICAgICAgICAgIGJpbmRpbmdNYXNrO1xuICAgICAgICAgIGFkZFJlbW92ZU5vZGUocmVtb3ZlLCBuZXdJbmRleCwgZGVwdGgpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBOb2RlLlRFWFRfTk9ERTpcbiAgICAgICAgY29uc3QgdmFsdWUgPSBjdXJyZW50Tm9kZS50ZXh0Q29udGVudCB8fCAnJztcbiAgICAgICAgY29uc3QgaGFzQmluZGluZyA9IHZhbHVlLm1hdGNoKEJJTkRJTkdfUkVHRVhQKTtcbiAgICAgICAgYWRkQ3JlYXRlTm9kZUFuZEFwcGVuZChjcmVhdGUsIG51bGwsIGhhc0JpbmRpbmcgPyAnJyA6IHZhbHVlLCBwYXJlbnRJZHgsIG5ld0luZGV4KTtcbiAgICAgICAgYWRkUmVtb3ZlTm9kZShyZW1vdmUsIG5ld0luZGV4LCBkZXB0aCk7XG4gICAgICAgIGlmIChoYXNCaW5kaW5nKSB7XG4gICAgICAgICAgYmluZGluZ01hc2sgPVxuICAgICAgICAgICAgICBnZW5lcmF0ZUJpbmRpbmdVcGRhdGVPcENvZGVzKHVwZGF0ZSwgdmFsdWUsIG5ld0luZGV4LCBudWxsLCAwLCBudWxsKSB8IGJpbmRpbmdNYXNrO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBOb2RlLkNPTU1FTlRfTk9ERTpcbiAgICAgICAgLy8gQ2hlY2sgaWYgdGhlIGNvbW1lbnQgbm9kZSBpcyBhIHBsYWNlaG9sZGVyIGZvciBhIG5lc3RlZCBJQ1VcbiAgICAgICAgY29uc3QgaXNOZXN0ZWRJY3UgPSBORVNURURfSUNVLmV4ZWMoY3VycmVudE5vZGUudGV4dENvbnRlbnQgfHwgJycpO1xuICAgICAgICBpZiAoaXNOZXN0ZWRJY3UpIHtcbiAgICAgICAgICBjb25zdCBuZXN0ZWRJY3VJbmRleCA9IHBhcnNlSW50KGlzTmVzdGVkSWN1WzFdLCAxMCk7XG4gICAgICAgICAgY29uc3QgaWN1RXhwcmVzc2lvbjogSWN1RXhwcmVzc2lvbiA9IG5lc3RlZEljdXNbbmVzdGVkSWN1SW5kZXhdO1xuICAgICAgICAgIC8vIENyZWF0ZSB0aGUgY29tbWVudCBub2RlIHRoYXQgd2lsbCBhbmNob3IgdGhlIElDVSBleHByZXNzaW9uXG4gICAgICAgICAgYWRkQ3JlYXRlTm9kZUFuZEFwcGVuZChcbiAgICAgICAgICAgICAgY3JlYXRlLCBJQ1VfTUFSS0VSLCBuZ0Rldk1vZGUgPyBgbmVzdGVkIElDVSAke25lc3RlZEljdUluZGV4fWAgOiAnJywgcGFyZW50SWR4LFxuICAgICAgICAgICAgICBuZXdJbmRleCk7XG4gICAgICAgICAgaWN1U3RhcnQodFZpZXcsIGxWaWV3LCBzaGFyZWRVcGRhdGVPcENvZGVzLCBwYXJlbnRJZHgsIGljdUV4cHJlc3Npb24sIG5ld0luZGV4KTtcbiAgICAgICAgICBhZGRSZW1vdmVOZXN0ZWRJY3UocmVtb3ZlLCBuZXdJbmRleCwgZGVwdGgpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjdXJyZW50Tm9kZSA9IGN1cnJlbnROb2RlLm5leHRTaWJsaW5nO1xuICB9XG4gIHJldHVybiBiaW5kaW5nTWFzaztcbn1cblxuZnVuY3Rpb24gYWRkUmVtb3ZlTm9kZShyZW1vdmU6IEkxOG5SZW1vdmVPcENvZGVzLCBpbmRleDogbnVtYmVyLCBkZXB0aDogbnVtYmVyKSB7XG4gIGlmIChkZXB0aCA9PT0gMCkge1xuICAgIHJlbW92ZS5wdXNoKGluZGV4KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhZGRSZW1vdmVOZXN0ZWRJY3UocmVtb3ZlOiBJMThuUmVtb3ZlT3BDb2RlcywgaW5kZXg6IG51bWJlciwgZGVwdGg6IG51bWJlcikge1xuICBpZiAoZGVwdGggPT09IDApIHtcbiAgICByZW1vdmUucHVzaCh+aW5kZXgpOyAgLy8gcmVtb3ZlIElDVSBhdCBgaW5kZXhgXG4gICAgcmVtb3ZlLnB1c2goaW5kZXgpOyAgIC8vIHJlbW92ZSBJQ1UgY29tbWVudCBhdCBgaW5kZXhgXG4gIH1cbn1cblxuZnVuY3Rpb24gYWRkVXBkYXRlSWN1U3dpdGNoKFxuICAgIHVwZGF0ZTogSTE4blVwZGF0ZU9wQ29kZXMsIGljdUV4cHJlc3Npb246IEljdUV4cHJlc3Npb24sIGluZGV4OiBudW1iZXIpIHtcbiAgdXBkYXRlLnB1c2goXG4gICAgICB0b01hc2tCaXQoaWN1RXhwcmVzc2lvbi5tYWluQmluZGluZyksIDIsIC0xIC0gaWN1RXhwcmVzc2lvbi5tYWluQmluZGluZyxcbiAgICAgIGluZGV4IDw8IEkxOG5VcGRhdGVPcENvZGUuU0hJRlRfUkVGIHwgSTE4blVwZGF0ZU9wQ29kZS5JY3VTd2l0Y2gpO1xufVxuXG5mdW5jdGlvbiBhZGRVcGRhdGVJY3VVcGRhdGUodXBkYXRlOiBJMThuVXBkYXRlT3BDb2RlcywgYmluZGluZ01hc2s6IG51bWJlciwgaW5kZXg6IG51bWJlcikge1xuICB1cGRhdGUucHVzaChiaW5kaW5nTWFzaywgMSwgaW5kZXggPDwgSTE4blVwZGF0ZU9wQ29kZS5TSElGVF9SRUYgfCBJMThuVXBkYXRlT3BDb2RlLkljdVVwZGF0ZSk7XG59XG5cbmZ1bmN0aW9uIGFkZENyZWF0ZU5vZGVBbmRBcHBlbmQoXG4gICAgY3JlYXRlOiBJY3VDcmVhdGVPcENvZGVzLCBtYXJrZXI6IG51bGx8SUNVX01BUktFUnxFTEVNRU5UX01BUktFUiwgdGV4dDogc3RyaW5nLFxuICAgIGFwcGVuZFRvUGFyZW50SWR4OiBudW1iZXIsIGNyZWF0ZUF0SWR4OiBudW1iZXIpIHtcbiAgaWYgKG1hcmtlciAhPT0gbnVsbCkge1xuICAgIGNyZWF0ZS5wdXNoKG1hcmtlcik7XG4gIH1cbiAgY3JlYXRlLnB1c2goXG4gICAgICB0ZXh0LCBjcmVhdGVBdElkeCxcbiAgICAgIGljdUNyZWF0ZU9wQ29kZShJY3VDcmVhdGVPcENvZGUuQXBwZW5kQ2hpbGQsIGFwcGVuZFRvUGFyZW50SWR4LCBjcmVhdGVBdElkeCkpO1xufVxuXG5mdW5jdGlvbiBhZGRDcmVhdGVBdHRyaWJ1dGUoY3JlYXRlOiBJY3VDcmVhdGVPcENvZGVzLCBuZXdJbmRleDogbnVtYmVyLCBhdHRyOiBBdHRyKSB7XG4gIGNyZWF0ZS5wdXNoKG5ld0luZGV4IDw8IEljdUNyZWF0ZU9wQ29kZS5TSElGVF9SRUYgfCBJY3VDcmVhdGVPcENvZGUuQXR0ciwgYXR0ci5uYW1lLCBhdHRyLnZhbHVlKTtcbn1cbiJdfQ==
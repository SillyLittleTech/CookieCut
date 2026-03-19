import { COMMON_ICONS } from './constants.js';

// --- HELPER FUNCTIONS ---

export function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}

export function renderIconCodes(text) {
    if (typeof text !== 'string') return '';
    const parts = text.split(/:([a-z0-9_]+):/g);
    let result = '';
    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
            const p = document.createElement('p');
            p.textContent = parts[i];
            result += p.innerHTML.replace(/\n/g, '<br>');
        } else {
            if (COMMON_ICONS.includes(parts[i])) {
                // Render icons as non-editable spans so the caret cannot be placed inside them
                result += `<span class="material-icons" contenteditable="false" data-icon="${parts[i]}">${parts[i]}</span>`;
            } else {
                const p = document.createElement('p');
                p.textContent = `:${parts[i]}:`;
                result += p.innerHTML;
            }
        }
    }
    return result;
}

export function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).catch(() => copyFallback(text));
    } else {
        copyFallback(text);
    }
}

export function copyFallback(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
    } catch (err) {
        console.error('Fallback copy failed: ', err);
    }
    document.body.removeChild(ta);
}

/**
 * Walk the editable element and return a plain "code text" where
 * icon spans are represented as :icon: tokens, plus the caret offset
 * (character index) inside that code text corresponding to the current
 * selection end.
 */
export function getTextAndCaret(rootEl) {
    const sel = window.getSelection();
    let focusNode = null, focusOffset = 0;
    if (sel && sel.rangeCount > 0) {
        focusNode = sel.getRangeAt(0).endContainer;
        focusOffset = sel.getRangeAt(0).endOffset;
    }

    let text = '';
    let caret = 0;
    let foundCaret = false;

    function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const nodeText = node.nodeValue || '';
            if (!foundCaret && node === focusNode) {
                caret = text.length + Math.min(focusOffset, nodeText.length);
                foundCaret = true;
            }
            text += nodeText;
            return;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node;
            // If this element is an icon span, represent it as :name:
            if (el.classList && el.classList.contains('material-icons')) {
                const token = `:${(el.textContent || '').trim()}:`;
                // If focus is inside this element (or the element itself), approximate caret
                if (!foundCaret && (el === focusNode || el.contains(focusNode))) {
                    // If focusNode is the element itself, use focusOffset to choose before/after
                    if (focusNode === el) {
                        caret = text.length + (focusOffset === 0 ? 0 : token.length);
                    } else {
                        // if focus is inside a descendant text node, walk that descendant to set caret
                        // but here we simply set caret to end of token to be safe
                        caret = text.length + token.length;
                    }
                    foundCaret = true;
                }
                text += token;
                return;
            }

            // Normal element: walk children
            for (let i = 0; i < el.childNodes.length; i++) {
                walk(el.childNodes[i]);
            }
        }
    }

    walk(rootEl);

    if (!foundCaret) caret = text.length;
    return { text, caret };
}

/**
 * Set caret (character) position within an element. Walk text nodes until
 * we locate the correct offset and set the range there.
 * Returns early without throwing if chars is not a non-negative number.
 */
export function setCaretPosition(element, chars) {
    if (typeof chars !== 'number' || chars < 0) return;
    const selection = window.getSelection();
    const range = document.createRange();
    let nodeStack = [element];
    let node, found = false;
    let charCount = 0;

    while (nodeStack.length && !found) {
        node = nodeStack.shift();
        if (node.nodeType === 3) { // text node
            const nextCharCount = charCount + node.length;
            if (chars <= nextCharCount) {
                range.setStart(node, Math.max(0, chars - charCount));
                range.collapse(true);
                found = true;
                break;
            }
            charCount = nextCharCount;
        } else {
            // push child nodes in order
            for (let i = 0; i < node.childNodes.length; i++) {
                nodeStack.push(node.childNodes[i]);
            }
        }
    }

    if (!found) {
        range.selectNodeContents(element);
        range.collapse(false);
    }

    // If the computed start is inside a material-icons span, move it to after that span
    try {
        let sc = range.startContainer;
        // If the start is a text node, get its parent element
        let ancestor = sc.nodeType === Node.TEXT_NODE ? sc.parentElement : sc;
        while (ancestor && ancestor !== element && !(ancestor.classList && ancestor.classList.contains && ancestor.classList.contains('material-icons'))) {
            ancestor = ancestor.parentElement;
        }
        if (ancestor && ancestor !== element && ancestor.classList && ancestor.classList.contains('material-icons')) {
            // place caret after the icon element
            range.setStartAfter(ancestor);
            range.collapse(true);
        }
    } catch (err) {
        // ignore and use original range
    }

    selection.removeAllRanges();
    selection.addRange(range);
}

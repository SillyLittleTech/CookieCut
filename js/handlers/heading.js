import { escapeHTML } from '../helpers.js';

/**
 * Returns the builder input configuration for a heading item.
 * @param {object} item
 * @returns {{ label: string, inputHtml: string }}
 */
export function getBuilderInput(item) {
    return {
        label: 'Heading (H2)',
        inputHtml: `
            <input type="text" data-key="content" value="${escapeHTML(item.content)}" class="w-full p-2 border border-gray-300 rounded-md" placeholder="Enter heading text">
        `
    };
}

/**
 * Creates and returns a heading preview DOM element.
 * @param {object} item
 * @param {string} fontStyle
 * @param {string} contentWithIcons - pre-rendered HTML with icon spans
 * @returns {HTMLElement}
 */
export function renderPreviewElement(item, fontStyle, contentWithIcons) {
    const el = document.createElement('h2');
    el.innerHTML = contentWithIcons;
    el.className = `font-style-${fontStyle}`;
    return el;
}

/**
 * Creates and returns an inline-editable heading element.
 * @param {object} item
 * @param {string} fontStyle
 * @param {string} contentWithIcons - pre-rendered HTML with icon spans
 * @returns {HTMLElement}
 */
export function renderInlineElement(item, fontStyle, contentWithIcons) {
    const el = document.createElement('h2');
    el.className = `font-style-${fontStyle} text-2xl font-bold mt-6`;
    el.contentEditable = true;
    el.dataset.id = item.id;
    el.dataset.key = 'content';
    el.innerHTML = contentWithIcons;
    return el;
}

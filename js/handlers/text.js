import { escapeHTML } from '../helpers.js';

/**
 * Returns the builder input configuration for a text (paragraph) item.
 * @param {object} item
 * @returns {{ label: string, inputHtml: string }}
 */
export function getBuilderInput(item) {
    return {
        label: 'Text (Paragraph)',
        inputHtml: `
            <textarea data-key="content" class="w-full p-2 border border-gray-300 rounded-md" rows="3" placeholder="Enter plain text">${escapeHTML(item.content)}</textarea>
        `
    };
}

/**
 * Creates and returns a paragraph preview DOM element.
 * @param {object} item
 * @param {string} fontStyle
 * @param {string} contentWithIcons - pre-rendered HTML with icon spans
 * @returns {HTMLElement}
 */
export function renderPreviewElement(item, fontStyle, contentWithIcons) {
    const el = document.createElement('p');
    el.className = 'recipe-text-block';
    el.innerHTML = contentWithIcons;
    return el;
}

/**
 * Creates and returns an inline-editable paragraph element.
 * @param {object} item
 * @param {string} fontStyle
 * @param {string} contentWithIcons - pre-rendered HTML with icon spans
 * @returns {HTMLElement}
 */
export function renderInlineElement(item, fontStyle, contentWithIcons) {
    const el = document.createElement('p');
    el.className = 'recipe-text-block';
    el.contentEditable = true;
    el.dataset.id = item.id;
    el.dataset.key = 'content';
    el.innerHTML = contentWithIcons;
    return el;
}

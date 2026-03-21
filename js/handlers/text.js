import { escapeHTML } from '../helpers.js';

/**
 * Returns the builder input configuration for a text (paragraph) item.
 * @param {object} item
 * @returns {{ label: string, inputHtml: string }}
 */
export function getBuilderInput(item) {
    const scale = item.scale != null ? Number(item.scale) : 100;
    return {
        label: 'Text (Paragraph)',
        inputHtml: `
            <textarea data-key="content" class="w-full p-2 border border-gray-300 rounded-md" rows="3" placeholder="Enter plain text">${escapeHTML(item.content)}</textarea>
            <div class="scale-input-container mt-2">
                <label class="block text-xs font-medium text-gray-600">Text Scale</label>
                <div class="flex items-center gap-3 mt-1">
                    <input type="range" data-key="scale" min="50" max="300" step="5" value="${scale}" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                    <span class="text-sm text-gray-600 font-mono w-12 text-right" data-role="scale-display">${scale}%</span>
                </div>
                <p class="scale-preview text-gray-500 mt-1 truncate" data-role="scale-preview" style="font-size: ${scale / 100}em">${escapeHTML(item.content) || 'Sample text'}</p>
            </div>
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
    const scale = item.scale != null ? Number(item.scale) : 100;
    if (scale !== 100) {
        el.style.fontSize = `${scale / 100}em`;
    }
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
    const scale = item.scale != null ? Number(item.scale) : 100;
    if (scale !== 100) {
        el.style.fontSize = `${scale / 100}em`;
    }
    return el;
}

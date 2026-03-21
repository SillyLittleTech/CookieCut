import { escapeHTML } from '../helpers.js';

/**
 * Returns the builder input configuration for a step item.
 * @param {object} item
 * @returns {{ label: string, inputHtml: string }}
 */
export function getBuilderInput(item) {
    const scale = item.scale != null ? Number(item.scale) : 100;
    return {
        label: 'Step',
        inputHtml: `
            <textarea data-key="content" class="w-full p-2 border border-gray-300 rounded-md" rows="3" placeholder="Enter step instructions">${escapeHTML(item.content)}</textarea>
            <div class="scale-input-container mt-2">
                <label class="block text-xs font-medium text-gray-600">Text Scale</label>
                <div class="flex items-center gap-3 mt-1">
                    <input type="range" data-key="scale" min="50" max="300" step="5" value="${scale}" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                    <span class="text-sm text-gray-600 font-mono w-12 text-right" data-role="scale-display">${scale}%</span>
                </div>
                <p class="scale-preview text-gray-500 mt-1 truncate" data-role="scale-preview" style="font-size: ${scale / 100}em">${escapeHTML(item.content) || 'Sample step'}</p>
            </div>
        `
    };
}

/**
 * Creates and returns a step list item for the classic preview.
 * Note: the caller is responsible for appending this to an <ol> element.
 * @param {object} item
 * @param {string} fontStyle
 * @param {string} contentWithIcons - pre-rendered HTML with icon spans
 * @returns {HTMLElement}
 */
export function renderPreviewElement(item, fontStyle, contentWithIcons) {
    const el = document.createElement('li');
    el.innerHTML = contentWithIcons;
    const scale = item.scale != null ? Number(item.scale) : 100;
    if (scale !== 100) {
        el.style.fontSize = `${scale / 100}em`;
    }
    return el;
}

/**
 * Creates and returns the inline-editable elements for a step item.
 * Returns an object with badge and contentSpan for the caller to assemble.
 * @param {object} item
 * @param {string} fontStyle
 * @param {string} contentWithIcons - pre-rendered HTML with icon spans
 * @param {number} stepNumber - the step's display number
 * @returns {{ badge: HTMLElement, contentSpan: HTMLElement }}
 */
export function renderInlineElement(item, fontStyle, contentWithIcons, stepNumber) {
    // Badge (number) - non-editable
    const badge = document.createElement('span');
    badge.className = 'step-badge';
    badge.textContent = String(stepNumber);

    // Editable content span inside the li so the badge itself isn't editable
    const contentSpan = document.createElement('span');
    contentSpan.className = 'step-content';
    contentSpan.contentEditable = true;
    contentSpan.dataset.id = item.id;
    contentSpan.dataset.key = 'content';
    contentSpan.innerHTML = contentWithIcons;
    const scale = item.scale != null ? Number(item.scale) : 100;
    if (scale !== 100) {
        contentSpan.style.fontSize = `${scale / 100}em`;
    }

    return { badge, contentSpan };
}

import { escapeHTML } from '../helpers.js';

/**
 * Returns the builder input configuration for a bubble/toast item.
 * @param {object} item
 * @returns {{ label: string, inputHtml: string }}
 */
export function getBuilderInput(item) {
    let label;
    switch (item.subtype) {
        case 'tip':     label = 'Toast (Tip)';     break;
        case 'warning': label = 'Toast (Warning)'; break;
        default:        label = 'Toast (Note)';
    }
    const scale = item.scale != null ? Number(item.scale) : 100;
    return {
        label,
        inputHtml: `
            <textarea data-key="content" class="w-full p-2 border border-gray-300 rounded-md" rows="2" placeholder="Enter tip or note">${escapeHTML(item.content)}</textarea>
            <div class="scale-input-container mt-2">
                <label class="block text-xs font-medium text-gray-600">Text Scale</label>
                <div class="flex items-center gap-3 mt-1">
                    <input type="range" data-key="scale" min="50" max="300" step="5" value="${scale}" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                    <span class="text-sm text-gray-600 font-mono w-12 text-right" data-role="scale-display">${scale}%</span>
                </div>
                <p class="scale-preview text-gray-500 mt-1 truncate" data-role="scale-preview" style="font-size: ${scale / 100}em">${escapeHTML(item.content) || 'Sample toast'}</p>
            </div>
        `
    };
}

/**
 * Creates and returns a bubble/toast preview DOM element.
 * @param {object} item
 * @param {string} fontStyle
 * @param {string} contentWithIcons - pre-rendered HTML with icon spans
 * @returns {HTMLElement}
 */
export function renderPreviewElement(item, fontStyle, contentWithIcons) {
    const el = document.createElement('div');
    el.className = 'toast-base';
    switch (item.subtype) {
        case 'tip':     el.classList.add('toast-tip');     break;
        case 'warning': el.classList.add('toast-warning'); break;
        default:        el.classList.add('toast-note');
    }
    el.innerHTML = contentWithIcons;
    const scale = item.scale != null ? Number(item.scale) : 100;
    if (scale !== 100) {
        el.style.fontSize = `${scale / 100}em`;
    }
    return el;
}

/**
 * Creates and returns an inline-editable bubble/toast element.
 * @param {object} item
 * @param {string} fontStyle
 * @param {string} contentWithIcons - pre-rendered HTML with icon spans
 * @returns {HTMLElement}
 */
export function renderInlineElement(item, fontStyle, contentWithIcons) {
    const el = document.createElement('div');
    el.className = 'toast-base';
    switch (item.subtype) {
        case 'tip':     el.classList.add('toast-tip');     break;
        case 'warning': el.classList.add('toast-warning'); break;
        default:        el.classList.add('toast-note');
    }
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

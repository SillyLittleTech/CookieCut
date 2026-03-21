import { escapeHTML } from '../helpers.js';

/**
 * Returns the builder input configuration for an image item.
 * @param {object} item
 * @returns {{ label: string, inputHtml: string }}
 */
export function getBuilderInput(item) {
    const imageFlowMode = item.inlineImageFlow || 'around';
    return {
        label: 'Image',
        inputHtml: `
            <div class="space-y-2">
                <label class="block text-xs font-medium text-gray-600">Image URL</label>
                <input type="url" data-key="src" value="${escapeHTML(item.src)}" class="w-full p-2 border border-gray-300 rounded-md" placeholder="https://...">
                <label class="block text-xs font-medium text-gray-600">Alt Text (for accessibility)</label>
                <input type="text" data-key="alt" value="${escapeHTML(item.alt)}" class="w-full p-2 border border-gray-300 rounded-md" placeholder="e.g., 'A bowl of pasta'">

                <label class="block text-xs font-medium text-gray-600 pt-2">Image Size</label>
                <div class="flex items-center gap-3">
                    <input type="range" data-key="size" min="100" max="600" step="1" value="${item.size}" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                    <span class="text-sm text-gray-600 font-mono w-12 text-right" data-role="size-display">${item.size}px</span>
                </div>
                <!-- Added back the visual labels -->
                <div class="flex justify-between text-xs text-gray-500 px-1">
                    <span>Tiny</span>
                    <span>Small</span>
                    <span>Medium</span>
                    <span>Large</span>
                </div>
                <label class="block text-xs font-medium text-gray-600 pt-2">Inline Text Flow</label>
                <select data-key="inlineImageFlow" class="w-full p-2 border border-gray-300 rounded-md bg-white">
                    <option value="around" ${imageFlowMode === 'around' ? 'selected' : ''}>Around text</option>
                    <option value="over" ${imageFlowMode === 'over' ? 'selected' : ''}>Over text</option>
                    <option value="under" ${imageFlowMode === 'under' ? 'selected' : ''}>Under text</option>
                </select>
            </div>
        `
    };
}

/**
 * Creates and returns an image preview DOM element.
 * @param {object} item
 * @param {string} fontStyle
 * @param {string} contentWithIcons - unused for images
 * @returns {HTMLElement}
 */
export function renderPreviewElement(item, fontStyle, contentWithIcons) {
    const el = document.createElement('img');
    el.src = item.src || 'https://placehold.co/400x300?text=Image+Preview';
    el.alt = item.alt;
    el.style.maxWidth = `${item.size}px`;
    el.onerror = function() { this.src = 'https://placehold.co/400x300?text=Invalid+Image'; this.onerror = null; };
    return el;
}

/**
 * Creates and returns an inline-editable image element.
 * The caller (inline.js) attaches the click/resizer event listener.
 * @param {object} item
 * @param {string} fontStyle
 * @param {string} contentWithIcons - unused for images
 * @returns {HTMLElement}
 */
export function renderInlineElement(item, fontStyle, contentWithIcons) {
    const el = document.createElement('img');
    el.src = item.src || 'https://placehold.co/400x300?text=Image+Preview';
    el.alt = item.alt || '';
    el.style.width = '100%';
    el.style.maxWidth = '100%';
    el.style.height = 'auto';
    el.dataset.id = item.id;
    el.className = 'inline-edit-image';
    return el;
}

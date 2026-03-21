import { escapeHTML } from '../helpers.js';

const ALLOWED_LINK_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

/**
 * Normalize and validate a link href, allowing only safe URL schemes.
 * Falls back to '#' if the URL is invalid or uses a disallowed scheme.
 * @param {string} href
 * @returns {string}
 */
function sanitizeHref(href) {
    if (!href) {
        return '#';
    }

    try {
        const url = new URL(href, window.location.origin);
        if (ALLOWED_LINK_SCHEMES.includes(url.protocol)) {
            return url.href;
        }
    } catch {
        // Invalid URL, fall through to return '#'
    }

    return '#';
}

/**
 * Returns the builder input configuration for a link item.
 * @param {object} item
 * @returns {{ label: string, inputHtml: string }}
 */
export function getBuilderInput(item) {
    const scale = item.scale != null ? Number(item.scale) : 100;
    return {
        label: '<span class="material-icons align-middle text-base">link</span> Link',
        inputHtml: `
            <div class="space-y-2">
                <input type="text" data-key="content" class="w-full p-2 border border-gray-300 rounded-md" placeholder="Link text" value="${escapeHTML(item.content || '')}">
                <input type="url" data-key="href" class="w-full p-2 border border-gray-300 rounded-md" placeholder="https://example.com" value="${escapeHTML(item.href || '')}">
            </div>
            <div class="scale-input-container mt-2">
                <label class="block text-xs font-medium text-gray-600">Text Scale</label>
                <div class="flex items-center gap-3 mt-1">
                    <input type="range" data-key="scale" min="50" max="300" step="5" value="${scale}" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                    <span class="text-sm text-gray-600 font-mono w-12 text-right" data-role="scale-display">${scale}%</span>
                </div>
                <p class="scale-preview text-blue-600 underline mt-1 truncate" data-role="scale-preview" style="font-size: ${scale / 100}em">${escapeHTML(item.content || item.href || 'Link text')}</p>
            </div>
        `
    };
}

/**
 * Build a shared link block used by preview + inline renderers.
 * @param {object} item
 * @param {string} contentWithIcons - pre-rendered HTML with icon spans
 * @returns {HTMLElement}
 */
function createLinkBlock(item, contentWithIcons) {
    const wrapper = document.createElement('p');
    wrapper.className = 'recipe-text-block flex items-center gap-1';

    const icon = document.createElement('span');
    icon.className = 'material-icons text-base align-middle';
    icon.textContent = 'link';

    const anchorElement = document.createElement('a');
    anchorElement.href = sanitizeHref(item.href);
    anchorElement.target = '_blank';
    anchorElement.rel = 'noopener noreferrer';
    anchorElement.className = 'underline text-blue-600 hover:text-blue-800';
    anchorElement.innerHTML = contentWithIcons || escapeHTML(item.content || item.href || 'Link');

    wrapper.appendChild(icon);
    wrapper.appendChild(anchorElement);

    const scale = item.scale != null ? Number(item.scale) : 100;
    if (scale !== 100) {
        wrapper.style.fontSize = `${scale / 100}em`;
    }

    return wrapper;
}

/**
 * Creates and returns a link preview DOM element.
 * @param {object} item
 * @param {string} fontStyle
 * @param {string} contentWithIcons - pre-rendered HTML with icon spans
 * @returns {HTMLElement}
 */
export function renderPreviewElement(item, fontStyle, contentWithIcons) {
    return createLinkBlock(item, contentWithIcons);
}

/**
 * Creates and returns an inline-editable link element.
 * @param {object} item
 * @param {string} fontStyle
 * @param {string} contentWithIcons - pre-rendered HTML with icon spans
 * @returns {HTMLElement}
 */
export function renderInlineElement(item, fontStyle, contentWithIcons) {
    return createLinkBlock(item, contentWithIcons);
}

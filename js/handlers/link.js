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
    } catch (e) {
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
    return {
        label: '<span class="material-icons align-middle text-base">link</span> Link',
        inputHtml: `
            <div class="space-y-2">
                <input type="text" data-key="content" class="w-full p-2 border border-gray-300 rounded-md" placeholder="Link text" value="${escapeHTML(item.content || '')}">
                <input type="url" data-key="href" class="w-full p-2 border border-gray-300 rounded-md" placeholder="https://example.com" value="${escapeHTML(item.href || '')}">
            </div>
        `
    };
}

/**
 * Creates and returns a link preview DOM element.
 * @param {object} item
 * @param {string} fontStyle
 * @param {string} contentWithIcons - pre-rendered HTML with icon spans
 * @returns {HTMLElement}
 */
export function renderPreviewElement(item, fontStyle, contentWithIcons) {
    const wrapper = document.createElement('p');
    wrapper.className = 'recipe-text-block flex items-center gap-1';

    const icon = document.createElement('span');
    icon.className = 'material-icons text-base align-middle';
    icon.textContent = 'link';

    const a = document.createElement('a');
    a.href = sanitizeHref(item.href);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'underline text-blue-600 hover:text-blue-800';
    a.innerHTML = contentWithIcons || escapeHTML(item.content || item.href || 'Link');

    wrapper.appendChild(icon);
    wrapper.appendChild(a);
    return wrapper;
}

/**
 * Creates and returns an inline-editable link element.
 * @param {object} item
 * @param {string} fontStyle
 * @param {string} contentWithIcons - pre-rendered HTML with icon spans
 * @returns {HTMLElement}
 */
export function renderInlineElement(item, fontStyle, contentWithIcons) {
    const wrapper = document.createElement('p');
    wrapper.className = 'recipe-text-block flex items-center gap-1';

    const icon = document.createElement('span');
    icon.className = 'material-icons text-base align-middle';
    icon.textContent = 'link';

    const a = document.createElement('a');
    a.href = sanitizeHref(item.href);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'underline text-blue-600 hover:text-blue-800';
    a.innerHTML = contentWithIcons || escapeHTML(item.content || item.href || 'Link');

    wrapper.appendChild(icon);
    wrapper.appendChild(a);
    return wrapper;
}

import { escapeHTML } from '../helpers.js'

const ALLOWED_FRAME_SCHEMES = ['http:', 'https:']

/**
 * Validate an iframe src URL, allowing only http/https schemes.
 * Returns an empty string for invalid or unsafe URLs.
 * @param {string} src
 * @returns {string}
 */
function sanitizeFrameSrc (src) {
  if (!src) return ''
  try {
    const url = new URL(src)
    if (ALLOWED_FRAME_SCHEMES.includes(url.protocol)) return url.href
  } catch {
    // Invalid URL
  }
  return ''
}

/**
 * Returns the builder input configuration for a frame (iframe) item.
 * @param {object} item
 * @returns {{ label: string, inputHtml: string }}
 */
export function getBuilderInput (item) {
  return {
    label:
      '<span class="material-icons align-middle text-base">web</span> Frame',
    inputHtml: `
      <div class="space-y-2">
        <input type="url" data-key="src" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100" placeholder="https://example.com" value="${escapeHTML(item.src || '')}">
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Height (px)</label>
        <input type="number" data-key="frameHeight" min="48" max="1200" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100" placeholder="400" value="${escapeHTML(String(item.frameHeight || ''))}">
      </div>
    `
  }
}

/**
 * Creates a frame element (shared by preview and inline renderers).
 * @param {object} item
 * @returns {HTMLElement}
 */
function createFrameElement (item) {
  const wrapper = document.createElement('div')
  wrapper.className = 'html-frame-wrapper'

  const safeSrc = sanitizeFrameSrc(item.src)
  if (safeSrc) {
    const iframe = document.createElement('iframe')
    iframe.src = safeSrc
    iframe.style.width = '100%'
    iframe.style.height = `${item.frameHeight || 400}px`
    iframe.style.border = 'none'
    iframe.setAttribute('loading', 'lazy')
    wrapper.appendChild(iframe)
  } else {
    const placeholder = document.createElement('div')
    placeholder.className = 'html-frame-placeholder'
    placeholder.textContent = 'Frame: enter an https:// URL above'
    wrapper.appendChild(placeholder)
  }

  return wrapper
}

/**
 * Creates and returns a frame preview DOM element.
 * @param {object} item
 * @returns {HTMLElement}
 */
export function renderPreviewElement (item) {
  return createFrameElement(item)
}

/**
 * Creates and returns an inline frame element.
 * @param {object} item
 * @returns {HTMLElement}
 */
export function renderInlineElement (item) {
  return createFrameElement(item)
}

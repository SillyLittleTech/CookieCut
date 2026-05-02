import { escapeHTML } from '../helpers.js'
import { createScaleInputHtml, applyItemScale } from './scale.js'

const ALLOWED_LINK_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:']

/**
 * Normalize and validate a button href, allowing only safe URL schemes.
 * Falls back to '#' if the URL is invalid or uses a disallowed scheme.
 * @param {string} href
 * @returns {string}
 */
function sanitizeHref (href) {
  if (!href) return '#'
  try {
    const url = new URL(href, window.location.origin)
    if (ALLOWED_LINK_SCHEMES.includes(url.protocol)) return url.href
  } catch {
    // Invalid URL, fall through to return '#'
  }
  return '#'
}

function getButtonClasses (style) {
  switch (style) {
    case 'secondary':
      return 'html-btn html-btn--secondary'
    case 'danger':
      return 'html-btn html-btn--danger'
    case 'ghost':
      return 'html-btn html-btn--ghost'
    default:
      return 'html-btn html-btn--primary'
  }
}

/**
 * Returns the builder input configuration for a button item.
 * @param {object} item
 * @returns {{ label: string, inputHtml: string }}
 */
export function getBuilderInput (item) {
  const styles = [
    { value: 'primary', label: 'Primary' },
    { value: 'secondary', label: 'Secondary' },
    { value: 'danger', label: 'Danger' },
    { value: 'ghost', label: 'Ghost' }
  ]
  const styleOptions = styles
    .map(
      (s) =>
        `<option value="${s.value}" ${(item.buttonStyle || 'primary') === s.value ? 'selected' : ''}>${s.label}</option>`
    )
    .join('')

  return {
    label:
      '<span class="material-icons align-middle text-base">ads_click</span> Button',
    inputHtml: `
      <div class="space-y-2">
        <input type="text" data-key="content" class="w-full p-2 border border-gray-300 rounded-md" placeholder="Button label" value="${escapeHTML(item.content || '')}">
        <input type="url" data-key="href" class="w-full p-2 border border-gray-300 rounded-md" placeholder="https://example.com (optional)" value="${escapeHTML(item.href || '')}">
        <select data-key="buttonStyle" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-gray-100">
          ${styleOptions}
        </select>
      </div>
      ${createScaleInputHtml({
        item,
        previewText: item.content || 'Button',
        previewFallback: 'Button',
        previewClass: 'html-btn html-btn--primary'
      })}
    `
  }
}

/**
 * Creates a button element (shared by preview and inline renderers).
 * @param {object} item
 * @returns {HTMLElement}
 */
function createButtonElement (item) {
  const wrapper = document.createElement('p')
  wrapper.className = 'recipe-text-block'

  const btn = document.createElement('a')
  btn.href = sanitizeHref(item.href)
  if (item.href) {
    btn.target = '_blank'
    btn.rel = 'noopener noreferrer'
  }
  btn.className = getButtonClasses(item.buttonStyle)
  btn.textContent = item.content || 'Button'

  applyItemScale(wrapper, item, 'preview')
  wrapper.appendChild(btn)
  return wrapper
}

/**
 * Creates and returns a button preview DOM element.
 * @param {object} item
 * @returns {HTMLElement}
 */
export function renderPreviewElement (item) {
  return createButtonElement(item)
}

/**
 * Creates and returns an inline-editable button element.
 * @param {object} item
 * @returns {HTMLElement}
 */
export function renderInlineElement (item) {
  return createButtonElement(item)
}

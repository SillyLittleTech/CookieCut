const MIN_SPACER_SIZE = 20
const MAX_SPACER_SIZE = 600
const DEFAULT_SPACER_SIZE = 80

/**
 * Clamp a spacer size value to the valid range.
 * @param {number} value
 * @returns {number}
 */
function normalizeSpacer (value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_SPACER_SIZE
  return Math.max(MIN_SPACER_SIZE, Math.min(MAX_SPACER_SIZE, Math.round(parsed)))
}

/**
 * Returns the builder input configuration for a spacer item.
 * @param {object} item
 * @returns {{ label: string, inputHtml: string }}
 */
export function getBuilderInput (item) {
  const size = normalizeSpacer(item.size ?? DEFAULT_SPACER_SIZE)
  return {
    label: 'Spacer',
    inputHtml: `
            <label class="block text-sm font-medium text-gray-700 mt-2">Height (px)</label>
            <div class="flex items-center gap-2 mt-1">
              <input type="range" data-key="size" min="${MIN_SPACER_SIZE}" max="${MAX_SPACER_SIZE}" step="4" value="${size}" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
              <span class="text-sm text-gray-600 w-12 text-right" data-role="size-display">${size}px</span>
            </div>
        `
  }
}

/**
 * Creates and returns a spacer element for the classic preview.
 * Renders as an empty block with the configured height.
 * @param {object} item
 * @returns {HTMLElement}
 */
export function renderPreviewElement (item) {
  const size = normalizeSpacer(item.size ?? DEFAULT_SPACER_SIZE)
  const el = document.createElement('div')
  el.style.height = `${size}px`
  el.style.display = 'block'
  return el
}

/**
 * Creates and returns an inline-editable spacer element.
 * @param {object} item
 * @returns {HTMLElement}
 */
export function renderInlineElement (item) {
  const size = normalizeSpacer(item.size ?? DEFAULT_SPACER_SIZE)
  const el = document.createElement('div')
  el.className = 'inline-spacer'
  el.style.height = `${size}px`
  el.dataset.id = item.id
  return el
}

export { normalizeSpacer, DEFAULT_SPACER_SIZE, MIN_SPACER_SIZE, MAX_SPACER_SIZE }

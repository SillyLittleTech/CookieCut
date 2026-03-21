import { escapeHTML } from '../helpers.js'

export const DEFAULT_SCALE = 100
export const MIN_SCALE = 50
export const MAX_SCALE = 300
export const SCALE_STEP = 5

export const PREVIEW_HEADING_BASE_REM = 1.875
export const INLINE_HEADING_BASE_REM = 1.5

/**
 * Normalize a scale value into the supported slider range and step.
 * @param {unknown} rawScale
 * @returns {number}
 */
export function normalizeScale (rawScale) {
  const parsed = Number(rawScale)
  if (!Number.isFinite(parsed)) return DEFAULT_SCALE

  const stepped = Math.round(parsed / SCALE_STEP) * SCALE_STEP
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, stepped))
}

/**
 * Returns a normalized item scale.
 * @param {object} item
 * @returns {number}
 */
export function getItemScale (item) {
  return normalizeScale(item?.scale)
}

/**
 * Returns a font-size string for a normalized scale.
 * @param {number} scale
 * @param {{ baseRem?: number }} [options]
 * @returns {string}
 */
export function getScaleFontSize (scale, options = {}) {
  const normalizedScale = normalizeScale(scale)
  if (Number.isFinite(options.baseRem)) {
    return `${(options.baseRem * normalizedScale) / 100}rem`
  }
  return `${normalizedScale / 100}em`
}

/**
 * Applies text scaling to an element. If scale is 100, inline font-size is removed.
 * @param {HTMLElement} el
 * @param {number} scale
 * @param {{ baseRem?: number }} [options]
 */
export function applyScaleToElement (el, scale, options = {}) {
  if (!el) return
  const normalizedScale = normalizeScale(scale)
  if (normalizedScale === DEFAULT_SCALE) {
    el.style.removeProperty('font-size')
    return
  }
  el.style.fontSize = getScaleFontSize(normalizedScale, options)
}

function getScaleOptions (item, context) {
  if (item?.type !== 'heading') return {}
  if (context === 'preview') return { baseRem: PREVIEW_HEADING_BASE_REM }
  if (context === 'inline') return { baseRem: INLINE_HEADING_BASE_REM }
  return {}
}

/**
 * Applies item scale using context-specific defaults (e.g. heading base sizes).
 * @param {HTMLElement} el
 * @param {object} item
 * @param {'preview'|'inline'|'builder'} context
 */
export function applyItemScale (el, item, context = 'preview') {
  applyScaleToElement(el, getItemScale(item), getScaleOptions(item, context))
}

/**
 * Returns shared "Text Scale" slider HTML for builder inputs.
 * @param {{
 *   item: object,
 *   previewText: string,
 *   previewFallback: string,
 *   previewClass?: string,
 *   previewBaseRem?: number
 * }} config
 * @returns {string}
 */
export function createScaleInputHtml ({
  item,
  previewText,
  previewFallback,
  previewClass = 'text-gray-500',
  previewBaseRem
}) {
  const scale = getItemScale(item)
  const safeFallback = escapeHTML(previewFallback || 'Sample text')
  const safePreview = escapeHTML(previewText || '') || safeFallback
  const previewScaleOptions = Number.isFinite(previewBaseRem)
    ? { baseRem: previewBaseRem }
    : {}
  const previewScaleStyle = getScaleFontSize(scale, previewScaleOptions)
  const previewBaseAttr = Number.isFinite(previewBaseRem)
    ? ` data-scale-base-rem="${previewBaseRem}"`
    : ''

  return `
            <div class="scale-input-container mt-2">
                <label class="block text-xs font-medium text-gray-600">Text Scale</label>
                <div class="flex items-center gap-3 mt-1">
                    <input type="range" data-key="scale" min="${MIN_SCALE}" max="${MAX_SCALE}" step="${SCALE_STEP}" value="${scale}" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                    <span class="text-sm text-gray-600 font-mono w-12 text-right" data-role="scale-display">${scale}%</span>
                </div>
                <p class="scale-preview ${previewClass} mt-1 truncate" data-role="scale-preview" data-empty-preview="${safeFallback}"${previewBaseAttr} style="font-size: ${previewScaleStyle}">${safePreview}</p>
            </div>
        `
}

/**
 * Sync the scale slider display and sample preview size for a builder item.
 * @param {HTMLElement} itemEl
 * @param {number} scale
 */
export function syncScalePreviewSize (itemEl, scale) {
  if (!itemEl) return
  const normalizedScale = normalizeScale(scale)
  const display = itemEl.querySelector('[data-role="scale-display"]')
  const preview = itemEl.querySelector('[data-role="scale-preview"]')
  if (display) display.textContent = `${normalizedScale}%`
  if (!preview) return

  const baseRem = Number(preview.dataset.scaleBaseRem)
  const options = Number.isFinite(baseRem) ? { baseRem } : {}
  applyScaleToElement(preview, normalizedScale, options)
}

/**
 * Sync the scale sample preview text for a builder item.
 * @param {HTMLElement} itemEl
 * @param {string} content
 */
export function syncScalePreviewText (itemEl, content) {
  if (!itemEl) return
  const preview = itemEl.querySelector('[data-role="scale-preview"]')
  if (!preview) return

  const fallback = preview.dataset.emptyPreview || ''
  const nextText = content?.trim() ? content : fallback
  preview.textContent = nextText
}

import { recipeData } from '../state.js'

const MIN_SPACER_SIZE = 0
const MAX_SPACER_SIZE = 600
const DEFAULT_SPACER_SIZE = 80

const VALID_VARIANTS = new Set(['blank', 'line', 'page', 'container'])
const VALID_LAYOUTS = new Set(['flow', 'grid'])

/**
 * Clamp a spacer size value to the valid range.
 * @param {number} value
 * @returns {number}
 */
function normalizeSpacer (value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_SPACER_SIZE
  return Math.max(
    MIN_SPACER_SIZE,
    Math.min(MAX_SPACER_SIZE, Math.round(parsed))
  )
}

function normalizeVariant (value) {
  const variantValue = typeof value === 'string' ? value : 'blank'
  return VALID_VARIANTS.has(variantValue) ? variantValue : 'blank'
}

function normalizeContainerLayout (value) {
  const layoutValue = typeof value === 'string' ? value : 'flow'
  return VALID_LAYOUTS.has(layoutValue) ? layoutValue : 'flow'
}

function normalizeContainerColumns (value) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return 2
  return Math.min(4, Math.max(1, n))
}

/**
 * Returns the builder input configuration for a spacer item.
 * @param {object} item
 * @returns {{ label: string, inputHtml: string }}
 */
export function getBuilderInput (item) {
  const variant = normalizeVariant(item.variant)
  const size = normalizeSpacer(item.size ?? DEFAULT_SPACER_SIZE)
  const layout = normalizeContainerLayout(item.containerLayout)
  const columns = normalizeContainerColumns(item.containerColumns)

  const isPaged = recipeData.settings?.previewMode === 'paged'
  const variantOptions = [
    { value: 'blank', label: 'Blank (gap / line break)' },
    { value: 'line', label: 'Line (horizontal rule)' },
    { value: 'page', label: 'Page break (paged preview only)' },
    { value: 'container', label: 'Container (group items)' }
  ]

  const variantSelect = variantOptions
    .map((opt) => {
      const disabled = opt.value === 'page' && !isPaged
      return `<option value="${opt.value}"${opt.value === variant ? ' selected' : ''}${disabled ? ' disabled' : ''}>${opt.label}</option>`
    })
    .join('')

  const shouldShowSize =
    variant === 'blank' || variant === 'line' || variant === 'container'

  const sizeBlock = shouldShowSize
    ? `
            <label class="block text-sm font-medium text-gray-700 mt-2">Height (px)</label>
            <div class="flex items-center gap-2 mt-1">
              <input type="range" data-key="size" min="${MIN_SPACER_SIZE}" max="${MAX_SPACER_SIZE}" step="2" value="${size}" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
              <span class="text-sm text-gray-600 w-12 text-right" data-role="size-display">${size}px</span>
            </div>`
    : ''

  const flowSelectedAttr = layout === 'flow' ? ' selected' : ''
  const gridSelectedAttr = layout === 'grid' ? ' selected' : ''
  const columnsSelectOptions = [1, 2, 3, 4]
    .map((n) => {
      const selectedAttr = n === columns ? ' selected' : ''
      return `<option value="${n}"${selectedAttr}>${n}</option>`
    })
    .join('')

  const containerBlock =
    variant === 'container'
      ? `
            <label class="block text-sm font-medium text-gray-700 mt-2">Inner layout</label>
            <select data-key="containerLayout" class="w-full mt-1 p-2 border border-gray-300 rounded-md text-sm">
              <option value="flow"${flowSelectedAttr}>Flow (flex wrap)</option>
              <option value="grid"${gridSelectedAttr}>Grid</option>
            </select>
            <label class="block text-sm font-medium text-gray-700 mt-2">Columns</label>
            <select data-key="containerColumns" class="w-full mt-1 p-2 border border-gray-300 rounded-md text-sm">
              ${columnsSelectOptions}
            </select>`
      : ''

  return {
    label: 'Spacer',
    inputHtml: `
            <label class="block text-sm font-medium text-gray-700 mt-2">Type</label>
            <select data-key="variant" class="w-full mt-1 p-2 border border-gray-300 rounded-md text-sm">
              ${variantSelect}
            </select>
            ${sizeBlock}
            ${containerBlock}
        `
  }
}

/**
 * Creates and returns a spacer element for the classic preview.
 * @param {object} item
 * @returns {HTMLElement}
 */
export function renderPreviewElement (item) {
  const variant = normalizeVariant(item.variant)
  const size = normalizeSpacer(item.size ?? DEFAULT_SPACER_SIZE)

  if (variant === 'page') {
    const el = document.createElement('div')
    el.className = 'recipe-spacer-page-break'
    el.setAttribute('aria-hidden', 'true')
    return el
  }

  if (variant === 'container') {
    const el = document.createElement('div')
    el.className = 'recipe-spacer-container'
    el.dataset.containerId = String(item.id)
    const layout = normalizeContainerLayout(item.containerLayout)
    const cols = normalizeContainerColumns(item.containerColumns)
    el.dataset.containerLayout = layout
    el.dataset.containerColumns = String(cols)
    return el
  }

  if (variant === 'line') {
    const wrap = document.createElement('div')
    wrap.className = 'recipe-spacer-line-wrap'
    wrap.style.height = `${size}px`
    const hr = document.createElement('hr')
    hr.className = 'recipe-spacer-hr'
    wrap.appendChild(hr)
    return wrap
  }

  const el = document.createElement('div')
  el.className = 'recipe-spacer-blank'
  el.style.height = `${size}px`
  el.style.display = 'block'
  return el
}

/**
 * Creates and returns an inline spacer element (inner content; wrapper added by inline builder).
 * @param {object} item
 * @returns {HTMLElement}
 */
export function renderInlineElement (item) {
  const variant = normalizeVariant(item.variant)
  const size = normalizeSpacer(item.size ?? DEFAULT_SPACER_SIZE)

  if (variant === 'page') {
    const el = document.createElement('div')
    el.className = 'inline-spacer inline-spacer--page'
    el.dataset.id = item.id
    el.style.minHeight = `${Math.max(12, size)}px`
    return el
  }

  if (variant === 'container') {
    const el = document.createElement('div')
    el.className = 'inline-spacer inline-spacer--container'
    el.dataset.id = item.id
    const layout = normalizeContainerLayout(item.containerLayout)
    const cols = normalizeContainerColumns(item.containerColumns)
    el.dataset.containerLayout = layout
    el.dataset.containerColumns = String(cols)
    return el
  }

  if (variant === 'line') {
    const wrap = document.createElement('div')
    wrap.className = 'inline-spacer inline-spacer--line'
    wrap.style.height = `${Math.max(size, 12)}px`
    wrap.dataset.id = item.id
    const hr = document.createElement('hr')
    hr.className = 'inline-spacer-hr'
    wrap.appendChild(hr)
    return wrap
  }

  const el = document.createElement('div')
  el.className = 'inline-spacer inline-spacer--blank'
  el.style.height = `${size}px`
  el.dataset.id = item.id
  return el
}

export {
  normalizeSpacer,
  normalizeVariant,
  DEFAULT_SPACER_SIZE,
  MIN_SPACER_SIZE,
  MAX_SPACER_SIZE
}

import { recipeData } from '../state.js'
import { dom } from '../dom.js'
import {
  renderRichText,
  getTextAndCaret,
  setCaretPosition,
  getDocumentTextStats
} from '../helpers.js'
import {
  applyItemScale,
  normalizeScale,
  syncScalePreviewSize
} from '../handlers/scale.js'
import { renderInlineElement as renderInlineHeadingElement } from '../handlers/heading.js'
import { renderInlineElement as renderInlineStepElement } from '../handlers/step.js'
import { renderInlineElement as renderInlineBulletElement } from '../handlers/bullet.js'
import { renderInlineElement as renderInlineTextElement } from '../handlers/text.js'
import { renderInlineElement as renderInlineImageElement } from '../handlers/image.js'
import { renderInlineElement as renderInlineBubbleElement } from '../handlers/bubble.js'
import { renderInlineElement as renderInlineLinkElement } from '../handlers/link.js'
import {
  renderInlineElement as renderInlineSpacerElement,
  normalizeSpacer
} from '../handlers/spacer.js'
// renderBuilderInputs is imported lazily inside function bodies to avoid
// circular-import issues at module evaluation time.

// --- Image Resizer State ---
let currentResizer = null
let currentLinkEditor = null
let linkEditorInputIdCounter = 0
let currentDeleteConfirm = null
let currentDeleteResolve = null
let currentDeleteKeydownHandler = null
let inlinePagedFlow = null
let inlineStatNodes = null
let inlineIsPagedMode = false
const INLINE_BOX_MIN_WIDTH = 180
const INLINE_BOX_MAX_WIDTH = 1200
const INLINE_BOX_MIN_HEIGHT = 48
const INLINE_BOX_MAX_HEIGHT = 860
const INLINE_BOX_DEFAULT_FLEX_BASIS = 340
const INLINE_IMAGE_FLOW_MODES = new Set(['around', 'over', 'under'])

function normalizeInlineImageFlowMode (mode) {
  if (INLINE_IMAGE_FLOW_MODES.has(mode)) return mode
  return 'around'
}

function getInlineImageFlowMode (item) {
  const mode = normalizeInlineImageFlowMode(item.inlineImageFlow)
  item.inlineImageFlow = mode
  return mode
}

function getInlineSurface () {
  if (!dom.inlinePreview) return null
  return (
    dom.inlinePreview.querySelector('.inline-preview-flow') || dom.inlinePreview
  )
}

function rectsOverlap (a, b) {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  )
}

function moveItemNearVerticalAnchor (itemId, anchorY) {
  const movingIndex = recipeData.items.findIndex(
    (entry) => String(entry.id) === String(itemId)
  )
  if (movingIndex === -1) return
  const surface = getInlineSurface()
  if (!surface) return

  const candidates = Array.from(surface.querySelectorAll('.inline-item'))
    .map((node) => {
      const id = node.dataset.id
      const candidate = recipeData.items.find(
        (entry) => String(entry.id) === id
      )
      return { node, id, candidate }
    })
    .filter(
      ({ id, candidate }) =>
        id &&
        String(id) !== String(itemId) &&
        candidate &&
        (candidate.type !== 'image' ||
          getInlineImageFlowMode(candidate) === 'around')
    )
    .map(({ node, id }) => ({ id, rect: node.getBoundingClientRect() }))
    .sort((a, b) => {
      const topDelta = a.rect.top - b.rect.top
      if (Math.abs(topDelta) > 2) return topDelta
      return a.rect.left - b.rect.left
    })

  if (!candidates.length) return
  const [movingItem] = recipeData.items.splice(movingIndex, 1)

  let insertBeforeId = null
  for (const candidate of candidates) {
    const midpointY = candidate.rect.top + candidate.rect.height / 2
    if (anchorY < midpointY) {
      insertBeforeId = candidate.id
      break
    }
  }

  if (!insertBeforeId) {
    recipeData.items.push(movingItem)
    return
  }

  const insertIndex = recipeData.items.findIndex(
    (entry) => String(entry.id) === String(insertBeforeId)
  )
  if (insertIndex === -1) recipeData.items.push(movingItem)
  else recipeData.items.splice(insertIndex, 0, movingItem)
}

function doesImageOverlapTextItems (imageWrapper, imageItemId) {
  const surface = getInlineSurface()
  if (!surface || !imageWrapper) return false
  const imageRect = imageWrapper.getBoundingClientRect()

  return Array.from(surface.querySelectorAll('.inline-item')).some((node) => {
    if (String(node.dataset.id) === String(imageItemId)) return false
    const nodeItem = recipeData.items.find(
      (entry) => String(entry.id) === String(node.dataset.id)
    )
    if (!nodeItem || nodeItem.type === 'image') return false
    return rectsOverlap(imageRect, node.getBoundingClientRect())
  })
}

function applyFloatingImagePlacement (wrapper, item) {
  const flowMode = getInlineImageFlowMode(item)
  const isFloating = flowMode !== 'around'
  wrapper.classList.toggle('inline-item--floating-image', isFloating)
  wrapper.classList.toggle('inline-item--image-over', flowMode === 'over')
  wrapper.classList.toggle('inline-item--image-under', flowMode === 'under')
  wrapper.dataset.freeMove = isFloating ? 'true' : 'false'

  if (!isFloating) {
    wrapper.style.removeProperty('position')
    wrapper.style.removeProperty('left')
    wrapper.style.removeProperty('top')
    wrapper.style.removeProperty('z-index')
    wrapper.draggable = true
    return
  }

  wrapper.draggable = false
  wrapper.style.position = 'absolute'

  const currentX = Number.parseFloat(item.inlineX)
  const currentY = Number.parseFloat(item.inlineY)
  const nextX = Number.isFinite(currentX) ? currentX : 24
  const nextY = Number.isFinite(currentY) ? currentY : 24
  item.inlineX = nextX
  item.inlineY = nextY
  wrapper.style.left = `${nextX}px`
  wrapper.style.top = `${nextY}px`
  wrapper.style.zIndex = flowMode === 'over' ? '9' : '1'
}

function attachFloatingImageMoveInteraction (wrapper, frame, item) {
  let startX = 0
  let startY = 0
  let startLeft = 0
  let startTop = 0
  let active = false
  let moved = false

  frame.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.inline-frame-handle')) return
    if (event.target.closest('.inline-edit-image')) return
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    startX = event.clientX
    startY = event.clientY
    startLeft = Number.parseFloat(item.inlineX) || 0
    startTop = Number.parseFloat(item.inlineY) || 0
    active = true
    moved = false
    try {
      frame.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture may be unavailable.
    }
  })

  frame.addEventListener('pointermove', (event) => {
    if (!active || !event.buttons) return
    const deltaX = event.clientX - startX
    const deltaY = event.clientY - startY
    moved = moved || Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2

    const nextX = startLeft + deltaX
    const nextY = startTop + deltaY

    item.inlineX = nextX
    item.inlineY = nextY
    wrapper.style.left = `${nextX}px`
    wrapper.style.top = `${nextY}px`
  })

  const stopMove = (event) => {
    if (!active) return
    active = false
    if (event?.pointerId != null) {
      try {
        frame.releasePointerCapture(event.pointerId)
      } catch {
        // Pointer capture may already be released.
      }
    }
    if (moved) {
      wrapper.dataset.suppressImageClick = 'true'
      setTimeout(() => {
        if (wrapper.dataset.suppressImageClick === 'true') {
          delete wrapper.dataset.suppressImageClick
        }
      }, 0)
    }
  }

  frame.addEventListener('pointerup', stopMove)
  frame.addEventListener('pointercancel', stopMove)
}

function normalizeInlineBoxMeasurement (value, min, max) {
  const numeric = Number.parseFloat(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return Math.min(max, Math.max(min, Math.round(numeric)))
}

function syncInlineBoxSizing (item, sizeTargetEl, frameEl) {
  const width = normalizeInlineBoxMeasurement(
    item.inlineWidth,
    INLINE_BOX_MIN_WIDTH,
    INLINE_BOX_MAX_WIDTH
  )
  const minHeight = normalizeInlineBoxMeasurement(
    item.inlineMinHeight,
    INLINE_BOX_MIN_HEIGHT,
    INLINE_BOX_MAX_HEIGHT
  )

  if (width) {
    item.inlineWidth = width
    sizeTargetEl.style.width = `${width}px`
    if (inlineIsPagedMode) {
      sizeTargetEl.style.removeProperty('flex')
    } else {
      sizeTargetEl.style.flex = '0 0 auto'
    }
  } else {
    delete item.inlineWidth
    if (inlineIsPagedMode) {
      sizeTargetEl.style.width = `${INLINE_BOX_DEFAULT_FLEX_BASIS}px`
      sizeTargetEl.style.removeProperty('flex')
    } else {
      sizeTargetEl.style.removeProperty('width')
      sizeTargetEl.style.flex = `1 1 ${INLINE_BOX_DEFAULT_FLEX_BASIS}px`
    }
  }

  if (minHeight) {
    item.inlineMinHeight = minHeight
    frameEl.style.minHeight = `${minHeight}px`
  } else {
    delete item.inlineMinHeight
    frameEl.style.removeProperty('min-height')
  }
}

function createInlineBorderHandle (item, frameEl, sizeTargetEl, direction) {
  const handle = document.createElement('div')
  handle.className = `inline-frame-handle inline-frame-handle--${direction}`
  handle.draggable = false
  handle.title = 'Resize block'

  let pointerStartX = 0
  let pointerStartY = 0
  let widthAtStart = 0
  let heightAtStart = 0
  let isResizing = false
  let dragHost = null
  let dragHostWasDraggable = false

  const restoreDragHost = () => {
    if (!dragHost) return
    dragHost.draggable = dragHostWasDraggable
    dragHost = null
  }

  const updateSizing = (width, minHeight) => {
    const spacerResize =
      item.type === 'spacer' && (item.variant || 'blank') !== 'container'

    if (spacerResize) {
      if (minHeight != null) {
        item.size = Math.max(0, Math.min(600, Math.round(minHeight)))
        item.inlineMinHeight = Math.max(
          INLINE_BOX_MIN_HEIGHT,
          Math.min(INLINE_BOX_MAX_HEIGHT, normalizeSpacer(item.size))
        )
      }
    } else {
      if (width != null) item.inlineWidth = width
      if (minHeight != null) item.inlineMinHeight = minHeight
    }
    syncInlineBoxSizing(item, sizeTargetEl, frameEl)
    refreshInlinePreviewMetrics()
  }

  handle.addEventListener('dragstart', (e) => {
    e.preventDefault()
    e.stopPropagation()
  })
  handle.addEventListener('dblclick', (e) => {
    e.preventDefault()
    e.stopPropagation()
  })
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    isResizing = true
    pointerStartX = e.clientX
    pointerStartY = e.clientY
    widthAtStart = sizeTargetEl.getBoundingClientRect().width
    heightAtStart = frameEl.getBoundingClientRect().height
    frameEl.classList.add('inline-item-frame--resizing')
    dragHost = handle.closest('.inline-item')
    if (dragHost) {
      dragHostWasDraggable = Boolean(dragHost.draggable)
      dragHost.draggable = false
    }
    try {
      handle.setPointerCapture(e.pointerId)
    } catch {
      // Pointer capture may be unavailable; drag still works.
    }
  })

  handle.addEventListener('pointermove', (e) => {
    if (!isResizing || !e.buttons) return
    const deltaX = e.clientX - pointerStartX
    const deltaY = e.clientY - pointerStartY
    let widthArg = null
    let minHeightArg = null

    const spacerNoHorizontal =
      item.type === 'spacer' && (item.variant || 'blank') !== 'container'

    if (!spacerNoHorizontal) {
      if (direction.includes('east')) {
        const nextWidth = widthAtStart + deltaX
        widthArg = Math.min(
          INLINE_BOX_MAX_WIDTH,
          Math.max(INLINE_BOX_MIN_WIDTH, nextWidth)
        )
      } else if (direction.includes('west')) {
        const nextWidth = widthAtStart - deltaX
        widthArg = Math.min(
          INLINE_BOX_MAX_WIDTH,
          Math.max(INLINE_BOX_MIN_WIDTH, nextWidth)
        )
      }
    }

    if (direction.includes('south')) {
      const nextMinHeight = heightAtStart + deltaY
      minHeightArg = Math.min(
        INLINE_BOX_MAX_HEIGHT,
        Math.max(INLINE_BOX_MIN_HEIGHT, nextMinHeight)
      )
    }

    updateSizing(widthArg, minHeightArg)
  })

  const stopResizing = (e) => {
    isResizing = false
    frameEl.classList.remove('inline-item-frame--resizing')
    if (e?.pointerId != null) {
      try {
        handle.releasePointerCapture(e.pointerId)
      } catch {
        // Pointer capture may already be released.
      }
    }
    restoreDragHost()
    if (item.type === 'spacer' && (item.variant || 'blank') !== 'container') {
      import('./classic.js').then(({ renderBuilderInputs }) => {
        renderBuilderInputs()
      })
    }
  }

  handle.addEventListener('pointerup', stopResizing)
  handle.addEventListener('pointercancel', stopResizing)
  handle.addEventListener('lostpointercapture', () => {
    isResizing = false
    frameEl.classList.remove('inline-item-frame--resizing')
    restoreDragHost()
  })

  return handle
}

function attachInlineBorderHandles (item, frameEl, sizeTargetEl) {
  ['east', 'west', 'south-east', 'south-west'].forEach((direction) => {
    frameEl.appendChild(
      createInlineBorderHandle(item, frameEl, sizeTargetEl, direction)
    )
  })
}

// --- Inline Scale Handle ---

/**
 * Creates a drag handle that allows resizing text scale by dragging vertically.
 * Dragging up increases scale; dragging down decreases it.
 * @param {object} item - the recipe item (mutated in place)
 * @param {HTMLElement} textEl - the rendered text element whose fontSize to update
 * @returns {HTMLElement}
 */
function createScaleHandle (item, textEl) {
  const handle = document.createElement('div')
  handle.className = 'inline-scale-handle no-print'
  const currentScale = normalizeScale(item.scale)
  handle.title = `Scale: ${currentScale}% — drag up/down to resize`
  handle.draggable = false

  handle.addEventListener('dragstart', (e) => {
    e.preventDefault()
    e.stopPropagation()
  })
  handle.addEventListener('dblclick', (e) => {
    e.stopPropagation()
  })

  let pointerStartY = 0
  let scaleAtStart = 0
  let isResizing = false
  let dragHost = null
  let dragHostWasDraggable = false

  const restoreDragHost = () => {
    if (!dragHost) return
    dragHost.draggable = dragHostWasDraggable
    dragHost = null
  }

  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    isResizing = true
    pointerStartY = e.clientY
    scaleAtStart = normalizeScale(item.scale)
    dragHost = handle.closest('.inline-item')
    if (dragHost) {
      dragHostWasDraggable = Boolean(dragHost.draggable)
      dragHost.draggable = false
    }
    try {
      handle.setPointerCapture(e.pointerId)
    } catch {
      // Pointer capture unavailable (e.g. synthetic events); drag still works
    }
  })

  handle.addEventListener('pointermove', (e) => {
    if (!isResizing || !e.buttons) return
    const delta = pointerStartY - e.clientY // drag up = bigger scale
    const newScale = normalizeScale(scaleAtStart + delta)
    if (newScale !== normalizeScale(item.scale)) {
      item.scale = newScale
      applyItemScale(textEl, item, 'inline')
      handle.title = `Scale: ${newScale}% — drag up/down to resize`
      // Sync the builder panel inputs if visible
      const itemEl = dom.contentInputs.querySelector(`[data-id="${item.id}"]`)
      if (itemEl) {
        const slider = itemEl.querySelector('[data-key="scale"]')
        if (slider) slider.value = newScale
        syncScalePreviewSize(itemEl, newScale)
      }
      refreshInlinePreviewMetrics()
    }
  })

  const stopResizing = (e) => {
    isResizing = false
    if (e?.pointerId != null) {
      try {
        handle.releasePointerCapture(e.pointerId)
      } catch {
        // Pointer capture may already be released.
      }
    }
    restoreDragHost()
  }

  handle.addEventListener('pointerup', stopResizing)
  handle.addEventListener('pointercancel', stopResizing)
  handle.addEventListener('lostpointercapture', () => {
    isResizing = false
    restoreDragHost()
  })

  return handle
}

function getInlinePagedPageCount () {
  if (!inlinePagedFlow) return 1

  const styles = globalThis.getComputedStyle(inlinePagedFlow)
  const columnWidth = Number.parseFloat(styles.columnWidth)
  const columnGap = Number.parseFloat(styles.columnGap) || 0

  if (!Number.isFinite(columnWidth) || columnWidth <= 0) {
    return 1
  }

  const estimatedPages = Math.ceil(
    (inlinePagedFlow.scrollWidth + columnGap) / (columnWidth + columnGap)
  )
  return Math.max(1, estimatedPages)
}

function updateInlinePreviewStats (pageCount = 1) {
  if (!inlineStatNodes) return

  const stats = getDocumentTextStats(recipeData)
  inlineStatNodes.word.textContent = String(stats.words)
  inlineStatNodes.sentence.textContent = String(stats.sentences)
  inlineStatNodes.paragraph.textContent = String(stats.paragraphs)
  inlineStatNodes.page.textContent = String(Math.max(1, pageCount))
}

function scheduleInlinePreviewStatsUpdate () {
  if (!inlinePagedFlow || !inlineStatNodes) return

  const recalculate = () => {
    updateInlinePreviewStats(getInlinePagedPageCount())
  }

  requestAnimationFrame(() => {
    recalculate()
    requestAnimationFrame(recalculate)
  })
  setTimeout(recalculate, 140)
}

export function refreshInlinePreviewMetrics () {
  if (!inlinePagedFlow || !inlineStatNodes) return
  updateInlinePreviewStats(getInlinePagedPageCount())
}

function closeInlineDeleteConfirm (confirmed = false) {
  if (currentDeleteConfirm) {
    currentDeleteConfirm.remove()
    currentDeleteConfirm = null
  }
  if (currentDeleteKeydownHandler) {
    document.removeEventListener('keydown', currentDeleteKeydownHandler)
    currentDeleteKeydownHandler = null
  }
  if (currentDeleteResolve) {
    const resolve = currentDeleteResolve
    currentDeleteResolve = null
    resolve(Boolean(confirmed))
  }
}

function openInlineDeleteConfirm (message = 'Remove this item?') {
  closeInlineDeleteConfirm(false)

  return new Promise((resolve) => {
    currentDeleteResolve = resolve

    const overlay = document.createElement('div')
    overlay.className = 'inline-delete-confirm-overlay'
    overlay.style.position = 'fixed'
    overlay.style.inset = '0'
    overlay.style.zIndex = 62
    overlay.style.background = 'rgba(0,0,0,0.45)'
    overlay.style.display = 'flex'
    overlay.style.alignItems = 'center'
    overlay.style.justifyContent = 'center'
    overlay.style.padding = '16px'

    const dialog = document.createElement('div')
    dialog.className = 'inline-delete-confirm-dialog'
    dialog.style.width = 'min(360px, calc(100vw - 32px))'
    dialog.style.borderRadius = '10px'
    dialog.style.boxShadow = '0 14px 30px rgba(0,0,0,0.18)'
    dialog.style.padding = '14px'

    const title = document.createElement('p')
    title.className = 'inline-delete-confirm-title'
    title.textContent = message
    title.style.marginBottom = '12px'
    title.style.fontSize = '14px'

    const actions = document.createElement('div')
    actions.style.display = 'flex'
    actions.style.justifyContent = 'flex-end'
    actions.style.gap = '8px'

    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = 'Cancel'
    cancelBtn.className = 'inline-overlay-btn inline-overlay-btn-cancel'
    cancelBtn.addEventListener('click', () => closeInlineDeleteConfirm(false))

    const removeBtn = document.createElement('button')
    removeBtn.textContent = 'Remove'
    removeBtn.className = 'inline-overlay-btn inline-overlay-btn-danger'
    removeBtn.addEventListener('click', () => closeInlineDeleteConfirm(true))

    actions.appendChild(cancelBtn)
    actions.appendChild(removeBtn)
    dialog.appendChild(title)
    dialog.appendChild(actions)
    overlay.appendChild(dialog)

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeInlineDeleteConfirm(false)
    })

    currentDeleteKeydownHandler = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeInlineDeleteConfirm(false)
      }
    }
    document.addEventListener('keydown', currentDeleteKeydownHandler)

    document.body.appendChild(overlay)
    currentDeleteConfirm = overlay
    removeBtn.focus()
  })
}

function closeActiveInlineEditors () {
  closeImageResizer()
  closeLinkEditor()
  closeInlineDeleteConfirm(false)
}

function syncLinkInputs (item) {
  const itemEl = dom.contentInputs.querySelector(`[data-id="${item.id}"]`)
  if (!itemEl) return
  const contentInput = itemEl.querySelector('[data-key="content"]')
  const hrefInput = itemEl.querySelector('[data-key="href"]')
  if (contentInput) contentInput.value = item.content || ''
  if (hrefInput) hrefInput.value = item.href || ''
}

function syncImageInputs (item) {
  const itemEl = dom.contentInputs.querySelector(`[data-id="${item.id}"]`)
  if (!itemEl) return
  const srcInput = itemEl.querySelector('[data-key="src"]')
  const altInput = itemEl.querySelector('[data-key="alt"]')
  const sizeSlider = itemEl.querySelector('[data-key="size"]')
  const sizeDisplay = itemEl.querySelector('[data-role="size-display"]')
  const flowSelect = itemEl.querySelector('[data-key="inlineImageFlow"]')

  if (srcInput) srcInput.value = item.src || ''
  if (altInput) altInput.value = item.alt || ''
  if (sizeSlider) sizeSlider.value = String(item.size || 350)
  if (sizeDisplay) sizeDisplay.textContent = `${item.size || 350}px`
  if (flowSelect) flowSelect.value = getInlineImageFlowMode(item)
}

function persistLinkChanges (item, text, href) {
  item.content = text.trim()
  item.href = href.trim()
  syncLinkInputs(item)
}

function saveLinkAndRerender (item, text, href) {
  persistLinkChanges(item, text, href)
  closeLinkEditor()
  import('./classic.js').then(({ renderBuilderInputs }) => {
    renderBuilderInputs()
  })
}

export function openImageResizer (imgEl, item, wrapperEl = null) {
  closeActiveInlineEditors()
  const resizer = document.createElement('div')
  resizer.className = 'image-resizer-overlay'
  resizer.style.position = 'fixed'
  resizer.style.left = '50%'
  resizer.style.transform = 'translateX(-50%)'
  resizer.style.bottom = '20px'
  resizer.style.zIndex = 60
  resizer.style.padding = '8px 12px'
  resizer.style.borderRadius = '8px'
  resizer.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)'

  const input = document.createElement('input')
  input.type = 'range'
  input.min = 100
  input.max = 1200
  input.step = 1
  const initialSize = Math.round(
    normalizeInlineBoxMeasurement(item.inlineWidth, 100, 1200) ||
      normalizeInlineBoxMeasurement(item.size, 100, 1200) ||
      350
  )
  input.value = initialSize
  input.style.width = '300px'
  const label = document.createElement('span')
  label.className = 'image-resizer-size-label'
  label.textContent = `${initialSize}px`
  label.style.marginLeft = '10px'
  item.size = initialSize
  item.inlineWidth = initialSize

  input.addEventListener('input', () => {
    const sizeValue = Math.round(Number.parseFloat(input.value) || 350)
    item.size = sizeValue
    item.inlineWidth = sizeValue
    label.textContent = `${sizeValue}px`
    if (wrapperEl) {
      const frameEl = wrapperEl.querySelector('.inline-item-frame')
      if (frameEl) {
        syncInlineBoxSizing(item, wrapperEl, frameEl)
      }
    }
    syncImageInputs(item)
    refreshInlinePreviewMetrics()
  })

  // URL and alt inputs
  const urlLabel = document.createElement('label')
  urlLabel.className = 'image-resizer-label'
  urlLabel.textContent = 'Image URL'
  urlLabel.style.display = 'block'
  urlLabel.style.marginTop = '8px'
  const urlInput = document.createElement('input')
  urlInput.className = 'image-resizer-input'
  urlInput.type = 'url'
  urlInput.value = item.src || ''
  urlInput.placeholder = 'https://...'
  urlInput.style.width = '420px'
  urlInput.style.display = 'block'
  urlInput.style.marginTop = '4px'

  const altLabel = document.createElement('label')
  altLabel.className = 'image-resizer-label'
  altLabel.textContent = 'Alt text'
  altLabel.style.display = 'block'
  altLabel.style.marginTop = '6px'
  const altInput = document.createElement('input')
  altInput.className = 'image-resizer-input'
  altInput.type = 'text'
  altInput.value = item.alt || ''
  altInput.style.width = '420px'
  altInput.style.display = 'block'
  altInput.style.marginTop = '4px'

  const flowLabel = document.createElement('label')
  flowLabel.className = 'image-resizer-label'
  flowLabel.textContent = 'Inline text flow'
  flowLabel.style.display = 'block'
  flowLabel.style.marginTop = '8px'

  const flowSelect = document.createElement('select')
  flowSelect.className = 'image-resizer-input image-resizer-select'
  flowSelect.style.width = '420px'
  flowSelect.style.display = 'block'
  flowSelect.style.marginTop = '4px'
  flowSelect.style.padding = '6px 8px';
  [
    { value: 'around', label: 'Around text' },
    { value: 'over', label: 'Over text' },
    { value: 'under', label: 'Under text' }
  ].forEach((entry) => {
    const option = document.createElement('option')
    option.value = entry.value
    option.textContent = entry.label
    flowSelect.appendChild(option)
  })
  flowSelect.value = getInlineImageFlowMode(item)

  const applyBtn = document.createElement('button')
  applyBtn.textContent = 'Apply'
  applyBtn.className = 'inline-overlay-btn inline-overlay-btn-primary ml-3'
  applyBtn.addEventListener('click', () => {
    const previousFlow = getInlineImageFlowMode(item)
    const nextFlow = normalizeInlineImageFlowMode(flowSelect.value)
    const newUrl = urlInput.value.trim()
    const newAlt = altInput.value.trim()
    if (newUrl) {
      item.src = newUrl
      imgEl.src = newUrl
      imgEl.addEventListener('load', refreshInlinePreviewMetrics, {
        once: true
      })
      imgEl.addEventListener('error', refreshInlinePreviewMetrics, {
        once: true
      })
    }
    item.alt = newAlt
    imgEl.alt = newAlt

    if (previousFlow === 'around' && nextFlow !== 'around' && wrapperEl) {
      const surface = getInlineSurface()
      if (surface) {
        const surfaceRect = surface.getBoundingClientRect()
        const wrapperRect = wrapperEl.getBoundingClientRect()
        item.inlineX = wrapperRect.left - surfaceRect.left
        item.inlineY = wrapperRect.top - surfaceRect.top
      }
    }

    if (previousFlow !== 'around' && nextFlow === 'around') {
      const anchorY = wrapperEl
        ? wrapperEl.getBoundingClientRect().top +
          wrapperEl.getBoundingClientRect().height / 2
        : 0
      const overlapsText = wrapperEl
        ? doesImageOverlapTextItems(wrapperEl, item.id)
        : false
      delete item.inlineX
      delete item.inlineY
      if (overlapsText) {
        moveItemNearVerticalAnchor(item.id, anchorY)
      }
    }

    item.inlineImageFlow = nextFlow
    syncImageInputs(item)
    closeImageResizer()
    renderInlinePreview()
    refreshInlinePreviewMetrics()
  })

  const closeBtn = document.createElement('button')
  closeBtn.textContent = 'Done'
  closeBtn.className = 'inline-overlay-btn inline-overlay-btn-cancel ml-3'
  closeBtn.addEventListener('click', closeImageResizer)

  resizer.appendChild(input)
  resizer.appendChild(label)
  resizer.appendChild(urlLabel)
  resizer.appendChild(urlInput)
  resizer.appendChild(altLabel)
  resizer.appendChild(altInput)
  resizer.appendChild(flowLabel)
  resizer.appendChild(flowSelect)
  resizer.appendChild(applyBtn)
  resizer.appendChild(closeBtn)
  document.body.appendChild(resizer)
  currentResizer = resizer
}

export function closeImageResizer () {
  if (currentResizer) {
    currentResizer.remove()
    currentResizer = null
  }
}

export function openLinkEditor (item) {
  closeActiveInlineEditors()
  const editor = document.createElement('div')
  editor.className = 'inline-link-editor-overlay'
  editor.style.position = 'fixed'
  editor.style.left = '50%'
  editor.style.transform = 'translateX(-50%)'
  editor.style.bottom = '20px'
  editor.style.zIndex = 61
  editor.style.padding = '12px'
  editor.style.borderRadius = '8px'
  editor.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)'
  editor.style.width = 'min(560px, calc(100vw - 32px))'

  const title = document.createElement('p')
  title.className = 'inline-link-editor-title'
  title.textContent = 'Edit link'
  title.style.fontWeight = '700'
  title.style.marginBottom = '8px'
  title.style.fontSize = '14px'

  const textLabel = document.createElement('label')
  textLabel.className = 'inline-link-editor-label'
  textLabel.textContent = 'Link text'
  textLabel.style.display = 'block'
  textLabel.style.fontSize = '12px'

  const textInput = document.createElement('input')
  textInput.className = 'inline-link-editor-input'
  textInput.type = 'text'
  textInput.value = item.content || ''
  textInput.placeholder = 'Link text'
  textInput.style.width = '100%'
  textInput.style.marginTop = '4px'
  textInput.style.marginBottom = '8px'

  const hrefLabel = document.createElement('label')
  hrefLabel.className = 'inline-link-editor-label'
  hrefLabel.textContent = 'URL'
  hrefLabel.style.display = 'block'
  hrefLabel.style.fontSize = '12px'

  const hrefInput = document.createElement('input')
  hrefInput.className = 'inline-link-editor-input'
  const hrefInputId = `link-editor-href-${++linkEditorInputIdCounter}`
  hrefInput.type = 'url'
  hrefInput.id = hrefInputId
  hrefInput.value = item.href || ''
  hrefInput.placeholder = 'https://example.com'
  hrefInput.style.width = '100%'
  hrefInput.style.marginTop = '4px'
  hrefInput.style.marginBottom = '10px'
  hrefLabel.htmlFor = hrefInputId

  const actions = document.createElement('div')
  actions.style.display = 'flex'
  actions.style.justifyContent = 'flex-end'
  actions.style.gap = '8px'

  const cancelBtn = document.createElement('button')
  cancelBtn.textContent = 'Cancel'
  cancelBtn.className = 'inline-overlay-btn inline-overlay-btn-cancel'
  cancelBtn.addEventListener('click', closeLinkEditor)

  const saveBtn = document.createElement('button')
  saveBtn.textContent = 'Save'
  saveBtn.className = 'inline-overlay-btn inline-overlay-btn-primary'
  saveBtn.addEventListener('click', () => {
    saveLinkAndRerender(item, textInput.value, hrefInput.value)
  })

  actions.appendChild(cancelBtn)
  actions.appendChild(saveBtn)
  editor.appendChild(title)
  editor.appendChild(textLabel)
  editor.appendChild(textInput)
  editor.appendChild(hrefLabel)
  editor.appendChild(hrefInput)
  editor.appendChild(actions)

  const handleKeyboardSave = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      saveLinkAndRerender(item, textInput.value, hrefInput.value)
    }
  }
  textInput.addEventListener('keydown', handleKeyboardSave)
  hrefInput.addEventListener('keydown', handleKeyboardSave)

  document.body.appendChild(editor)
  currentLinkEditor = editor
  textInput.focus()
}

export function closeLinkEditor () {
  if (currentLinkEditor) {
    currentLinkEditor.remove()
    currentLinkEditor = null
  }
}

// --- Drag/Drop Reorder Helper ---

function reorderItems (dragId, targetId) {
  const dragIndex = recipeData.items.findIndex(
    (i) => String(i.id) === String(dragId)
  )
  if (dragIndex === -1) return
  const [dragItem] = recipeData.items.splice(dragIndex, 1)
  delete dragItem.parentId
  // find current index of target (after removal)
  const newTargetIndex = recipeData.items.findIndex(
    (i) => String(i.id) === String(targetId)
  )
  if (newTargetIndex === -1) {
    recipeData.items.push(dragItem)
  } else {
    recipeData.items.splice(newTargetIndex, 0, dragItem)
  }
}

function hasValidParentInRecipe (item) {
  if (item.parentId == null || item.parentId === '') return false
  return recipeData.items.some((p) => String(p.id) === String(item.parentId))
}

function getChildItemsInDocumentOrder (parentId) {
  return recipeData.items
    .map((it, idx) => ({ it, idx }))
    .filter(({ it }) => String(it.parentId) === String(parentId))
    .sort((a, b) => a.idx - b.idx)
    .map(({ it }) => it)
}

function assignItemToContainer (dragId, containerId) {
  if (String(dragId) === String(containerId)) return
  const dragItem = recipeData.items.find(
    (i) => String(i.id) === String(dragId)
  )
  const containerItem = recipeData.items.find(
    (i) => String(i.id) === String(containerId)
  )
  if (!dragItem || !containerItem) return
  if (
    containerItem.type !== 'spacer' ||
    (containerItem.variant || 'blank') !== 'container'
  ) {
    return
  }
  if (
    dragItem.type === 'spacer' &&
    (dragItem.variant || 'blank') === 'container'
  ) {
    return
  }
  const dragIndex = recipeData.items.findIndex(
    (i) => String(i.id) === String(dragId)
  )
  if (dragIndex === -1) return
  const [moved] = recipeData.items.splice(dragIndex, 1)
  moved.parentId = containerId
  const containerIdx = recipeData.items.findIndex(
    (i) => String(i.id) === String(containerId)
  )
  let insertAt = containerIdx + 1
  for (let i = containerIdx + 1; i < recipeData.items.length; i += 1) {
    if (String(recipeData.items[i].parentId) === String(containerId)) {
      insertAt = i + 1
    }
  }
  recipeData.items.splice(insertAt, 0, moved)
}

function buildInlineStandardElement ({
  item,
  fontStyle,
  contentWithIcons,
  applyToText,
  applyToTips
}) {
  let renderedElement = null

  switch (item.type) {
    case 'heading':
      renderedElement = renderInlineHeadingElement(
        item,
        fontStyle,
        contentWithIcons
      )
      break
    case 'text':
      renderedElement = renderInlineTextElement(
        item,
        fontStyle,
        contentWithIcons
      )
      if (applyToText) renderedElement.classList.add(`font-style-${fontStyle}`)
      break
    case 'image':
      renderedElement = renderInlineImageElement(
        item,
        fontStyle,
        contentWithIcons
      )
      break
    case 'bubble':
      renderedElement = renderInlineBubbleElement(
        item,
        fontStyle,
        contentWithIcons
      )
      if (applyToTips) renderedElement.classList.add(`font-style-${fontStyle}`)
      break
    case 'link': {
      renderedElement = renderInlineLinkElement(
        item,
        fontStyle,
        contentWithIcons
      )
      if (applyToText) renderedElement.classList.add(`font-style-${fontStyle}`)
      const anchorEl = renderedElement.querySelector('a')
      if (anchorEl) {
        anchorEl.classList.add('inline-edit-link')
        // Disable native dragging on the anchor so the wrapper remains the drag source.
        anchorEl.draggable = false
        anchorEl.addEventListener('dragstart', (e) => {
          e.preventDefault()
          e.stopPropagation()
        })
        anchorEl.addEventListener('click', (e) => {
          e.preventDefault()
          e.stopPropagation()
          openLinkEditor(item)
        })
      }
      break
    }
    case 'spacer':
      renderedElement = renderInlineSpacerElement(item)
      break
    default:
      break
  }

  return renderedElement
}

// --- Inline Input / Blur Handlers ---

export function handleInlineInput (e) {
  const el = e.target
  const key = el.dataset.key
  const id = el.dataset.id

  if (!key) return

  if (key === 'title' || key === 'description') {
    const { text, caret } = getTextAndCaret(el)
    if (key === 'title') recipeData.title = text
    else recipeData.description = text
    // keep the builder inputs in sync
    dom.titleInput.value = recipeData.title
    dom.descInput.value = recipeData.description
    // also update preview title/desc if needed
    dom.titlePreview.innerHTML = renderRichText(recipeData.title)
    dom.descPreview.innerHTML = renderRichText(recipeData.description)
    // update the editable node's HTML to show icons and restore caret
    const newHtml = renderRichText(text)
    el.innerHTML = newHtml
    setCaretPosition(el, caret)
    refreshInlinePreviewMetrics()
    return
  }

  // content for items
  const item = recipeData.items.find((i) => String(i.id) === String(id))
  if (!item) return
  const { text: codeText, caret: newCaret } = getTextAndCaret(el)
  item.content = codeText || ''
  const newHtml = renderRichText(item.content)
  el.innerHTML = newHtml
  setCaretPosition(el, newCaret)

  // reflect changes into builder inputs if present
  const itemEl = dom.contentInputs.querySelector(`[data-id="${item.id}"]`)
  if (itemEl) {
    const input = itemEl.querySelector('[data-key="content"]')
    if (input) input.value = item.content
  }
  refreshInlinePreviewMetrics()
}

export function handleInlineBlur (e) {
  const el = e.target
  if (!el) return
  const { text } = getTextAndCaret(el)
  const key = el.dataset.key
  const id = el.dataset.id
  if (key === 'title') {
    recipeData.title = text
    dom.titleInput.value = recipeData.title
    dom.titlePreview.innerHTML = renderRichText(recipeData.title)
  } else if (key === 'description') {
    recipeData.description = text
    dom.descInput.value = recipeData.description
    dom.descPreview.innerHTML = renderRichText(recipeData.description)
  } else if (id) {
    const item = recipeData.items.find((i) => String(i.id) === String(id))
    if (item) {
      item.content = text
      const itemEl = dom.contentInputs.querySelector(`[data-id="${item.id}"]`)
      if (itemEl) {
        const input = itemEl.querySelector('[data-key="content"]')
        if (input) input.value = item.content
      }
    }
  }

  const newHtml = renderRichText(text || '')
  el.innerHTML = newHtml
  refreshInlinePreviewMetrics()
}

// --- Inline Preview Renderer ---

function createInlineRerenderAllEditors () {
  return () => {
    import('./classic.js').then(({ renderBuilderInputs }) => {
      renderBuilderInputs()
      renderInlinePreview()
    })
  }
}

function buildInlineMainEditableNode ({
  tag,
  key,
  html,
  className,
  emptyValue,
  emptyAutofocus = false,
  confirmPrompt,
  onHide
}) {
  const node = document.createElement(tag)
  node.className = className
  node.classList.add('inline-full-span')
  node.contentEditable = true
  node.dataset.key = key
  node.innerHTML = html

  if (!emptyValue || emptyValue.trim() === '') {
    node.classList.add('new-text-outline')
    const removeOutline = () => {
      node.classList.remove('new-text-outline')
      node.removeEventListener('input', removeOutline)
    }
    node.addEventListener('input', removeOutline)
    if (emptyAutofocus) setTimeout(() => node.focus(), 20)
  }

  node.addEventListener('dblclick', async (event) => {
    event.stopPropagation()
    if (!(await openInlineDeleteConfirm(confirmPrompt))) return
    onHide()
    createInlineRerenderAllEditors()()
  })

  return node
}

function buildPagedInlinePreviewSurface () {
  const layout = document.createElement('div')
  layout.className = 'inline-preview-layout'

  const stats = document.createElement('aside')
  stats.className = 'preview-stats inline-preview-stats'

  const statsTitle = document.createElement('h2')
  statsTitle.className = 'preview-stats-title'
  statsTitle.textContent = 'Document Stats'

  const statsList = document.createElement('dl')
  statsList.className = 'preview-stats-list'

  const createStatsRow = (labelText, valueText) => {
    const row = document.createElement('div')
    row.className = 'preview-stats-row'

    const label = document.createElement('dt')
    label.textContent = labelText

    const value = document.createElement('dd')
    value.textContent = valueText

    row.appendChild(label)
    row.appendChild(value)
    statsList.appendChild(row)
    return value
  }

  const wordValue = createStatsRow('Words', '0')
  const sentenceValue = createStatsRow('Sentences', '0')
  const paragraphValue = createStatsRow('Paragraphs', '0')
  const pageValue = createStatsRow('Pages', '1')

  inlineStatNodes = {
    word: wordValue,
    sentence: sentenceValue,
    paragraph: paragraphValue,
    page: pageValue
  }

  stats.appendChild(statsTitle)
  stats.appendChild(statsList)

  const canvas = document.createElement('div')
  canvas.className = 'inline-preview-canvas'

  const flow = document.createElement('div')
  flow.className = 'inline-preview-flow'
  canvas.appendChild(flow)

  layout.appendChild(stats)
  layout.appendChild(canvas)
  dom.inlinePreview.appendChild(layout)

  inlinePagedFlow = flow
  return { contentRoot: flow, dropSurface: flow }
}

function createInlineItemInteractionsBinder (rerenderAllEditors) {
  return (node, itemId) => {
    node.addEventListener('dblclick', async (event) => {
      event.stopPropagation()
      if (!(await openInlineDeleteConfirm('Remove this item?'))) return

      const stringId = String(itemId)
      recipeData.items.forEach((entry) => {
        if (String(entry.parentId) === stringId) delete entry.parentId
      })
      recipeData.items = recipeData.items.filter(
        (entry) => String(entry.id) !== stringId
      )
      rerenderAllEditors()
    })

    if (node.dataset.freeMove === 'true') return

    node.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', String(itemId))
      node.classList.add('dragging')
    })
    node.addEventListener('dragend', () => {
      node.classList.remove('dragging')
      if (!dom.inlinePreview) return
      dom.inlinePreview
        .querySelectorAll(
          '.inline-item.drop-target, .inline-container-surface.drop-target'
        )
        .forEach((n) => n.classList.remove('drop-target'))
    })
    node.addEventListener('dragover', (event) => {
      event.preventDefault()
      node.classList.add('drop-target')
    })
    node.addEventListener('dragleave', () => {
      node.classList.remove('drop-target')
    })
    node.addEventListener('drop', (event) => {
      event.preventDefault()
      const dragId = event.dataTransfer.getData('text/plain')
      const targetId = node.dataset.id
      if (dragId && targetId && dragId !== targetId) {
        reorderItems(dragId, targetId)
        rerenderAllEditors()
      }
    })
  }
}

function resetInlineListState (state) {
  state.currentList = null
  state.currentListType = null
  state.stepCounter = 0
}

function ensureInlineListContainer (rootEl, state, type) {
  if (state.currentList && state.currentListType === type) {
    return state.currentList
  }

  state.currentList = document.createElement(type === 'step' ? 'ol' : 'ul')
  state.currentList.className =
    type === 'step' ? 'inline-step-list' : 'inline-bullet-list'
  state.currentList.classList.add('inline-layout-item')
  state.currentListType = type
  rootEl.appendChild(state.currentList)
  return state.currentList
}

function renderInlineSpacerItem ({
  rootEl,
  item,
  attachInlineItemInteractions,
  rerenderAllEditors,
  renderItemsInto
}) {
  const variant = item.variant || 'blank'
  const spacerEl = renderInlineSpacerElement(item)
  const wrapper = document.createElement('div')
  wrapper.className = 'inline-item inline-full-span'
  wrapper.dataset.id = item.id
  wrapper.draggable = true

  if (variant === 'container') {
    wrapper.appendChild(spacerEl)
    wrapper.classList.add('inline-item--container-host')
    const surface = document.createElement('div')
    surface.className = 'inline-container-surface'
    const layout = item.containerLayout === 'grid' ? 'grid' : 'flow'
    surface.classList.add(
      layout === 'grid'
        ? 'inline-container-surface--grid'
        : 'inline-container-surface--flow'
    )
    const cols = Math.min(
      4,
      Math.max(1, Math.round(Number(item.containerColumns)) || 2)
    )
    surface.style.setProperty('--inline-container-cols', String(cols))
    surface.addEventListener('dragover', (event) => {
      event.preventDefault()
      event.stopPropagation()
      surface.classList.add('drop-target')
    })
    surface.addEventListener('dragleave', () => {
      surface.classList.remove('drop-target')
    })
    surface.addEventListener('drop', (event) => {
      event.preventDefault()
      event.stopPropagation()
      surface.classList.remove('drop-target')
      const dragId = event.dataTransfer.getData('text/plain')
      if (dragId) assignItemToContainer(dragId, item.id)
      rerenderAllEditors()
    })
    renderItemsInto(surface, getChildItemsInDocumentOrder(item.id))
    wrapper.appendChild(surface)
  } else {
    item.inlineMinHeight = Math.max(
      INLINE_BOX_MIN_HEIGHT,
      Math.min(INLINE_BOX_MAX_HEIGHT, normalizeSpacer(item.size))
    )
    const frame = document.createElement('div')
    frame.className =
      'inline-item-frame inline-item-frame-resizable inline-item-frame--spacer'
    frame.appendChild(spacerEl)
    wrapper.appendChild(frame)
    syncInlineBoxSizing(item, wrapper, frame)
    attachInlineBorderHandles(item, frame, wrapper)
  }

  rootEl.appendChild(wrapper)
  attachInlineItemInteractions(wrapper, item.id)
}

function renderInlineListItem ({
  rootEl,
  item,
  state,
  fontStyle,
  applyToText,
  attachInlineItemInteractions,
  contentWithIcons
}) {
  const isStep = item.type === 'step'
  if (isStep) {
    if (state.currentListType !== 'step') state.stepCounter = 0
    state.stepCounter += 1
  }

  const list = ensureInlineListContainer(
    rootEl,
    state,
    isStep ? 'step' : 'bullet'
  )
  const li = document.createElement('li')
  li.className = 'inline-item inline-list-item'
  li.dataset.id = item.id
  li.draggable = true

  const { badge, contentSpan } = isStep
    ? renderInlineStepElement(
      item,
      fontStyle,
      contentWithIcons,
      state.stepCounter
    )
    : renderInlineBulletElement(item, fontStyle, contentWithIcons)

  li.appendChild(badge)
  if (applyToText) contentSpan.classList.add(`font-style-${fontStyle}`)

  const contentWrap = document.createElement('div')
  contentWrap.className = 'inline-list-content-wrap'
  const contentFrame = document.createElement('div')
  contentFrame.className = 'inline-item-frame inline-item-frame-resizable'
  contentFrame.appendChild(contentSpan)
  contentWrap.appendChild(contentFrame)
  contentWrap.appendChild(createScaleHandle(item, contentSpan))
  syncInlineBoxSizing(item, contentWrap, contentFrame)
  attachInlineBorderHandles(item, contentFrame, contentWrap)
  li.appendChild(contentWrap)
  list.appendChild(li)
  attachInlineItemInteractions(li, item.id)
}

function renderInlineStandardItem ({
  rootEl,
  item,
  fontStyle,
  contentWithIcons,
  applyToText,
  applyToTips,
  attachInlineItemInteractions
}) {
  const renderedElement = buildInlineStandardElement({
    item,
    fontStyle,
    contentWithIcons,
    applyToText,
    applyToTips
  })

  if (!renderedElement) return

  const wrapper = document.createElement('div')
  wrapper.className = 'inline-item inline-layout-item'
  wrapper.dataset.id = item.id
  wrapper.draggable = true
  const frame = document.createElement('div')
  frame.className = 'inline-item-frame'
  frame.appendChild(renderedElement)
  wrapper.appendChild(frame)

  if (['text', 'heading', 'bubble', 'link', 'image'].includes(item.type)) {
    if (item.type === 'image') {
      const normalizedImageWidth = normalizeInlineBoxMeasurement(
        item.inlineWidth || item.size,
        INLINE_BOX_MIN_WIDTH,
        INLINE_BOX_MAX_WIDTH
      )
      if (normalizedImageWidth) {
        item.inlineWidth = normalizedImageWidth
        item.size = normalizedImageWidth
      }
    }
    frame.classList.add('inline-item-frame-resizable')
    syncInlineBoxSizing(item, wrapper, frame)
    attachInlineBorderHandles(item, frame, wrapper)
  }

  if (['text', 'heading', 'bubble', 'link'].includes(item.type)) {
    wrapper.appendChild(createScaleHandle(item, renderedElement))
  }

  if (
    (item.type === 'text' || item.type === 'heading') &&
    (!item.content || item.content.trim() === '')
  ) {
    renderedElement.classList.add('new-text-outline')
    const onFirstInput = () => {
      renderedElement.classList.remove('new-text-outline')
      renderedElement.removeEventListener('input', onFirstInput)
    }
    renderedElement.addEventListener('input', onFirstInput)
    setTimeout(() => renderedElement.focus(), 20)
  }
  rootEl.appendChild(wrapper)

  if (item.type === 'image') {
    applyFloatingImagePlacement(wrapper, item)
    if (wrapper.dataset.freeMove === 'true') {
      attachFloatingImageMoveInteraction(wrapper, frame, item)
    }
    renderedElement.addEventListener('click', (event) => {
      event.stopPropagation()
      if (wrapper.dataset.suppressImageClick === 'true') {
        delete wrapper.dataset.suppressImageClick
        return
      }
      openImageResizer(renderedElement, item, wrapper)
    })
  }

  attachInlineItemInteractions(wrapper, item.id)
}

export function renderInlinePreview () {
  if (!dom.inlinePreview) return
  if (!recipeData.settings || recipeData.settings.editorMode !== 'inline') {
    return
  }
  closeLinkEditor()
  dom.inlinePreview.innerHTML = ''
  inlinePagedFlow = null
  inlineStatNodes = null

  const fontStyle = recipeData.settings.fontStyle || 'display'
  const isPagedMode = recipeData.settings.previewMode === 'paged'
  inlineIsPagedMode = isPagedMode
  const applyToText = Boolean(recipeData.settings.fontApplyToText)
  const applyToTips = Boolean(recipeData.settings.fontApplyToTips)
  dom.inlinePreview.classList.toggle(
    'inline-paged-preview-active',
    isPagedMode
  )
  dom.inlinePreview.classList.toggle('inline-content-surface', !isPagedMode)

  const { contentRoot, dropSurface } = isPagedMode
    ? buildPagedInlinePreviewSurface()
    : { contentRoot: dom.inlinePreview, dropSurface: dom.inlinePreview }

  // Title (editable) — skip if hidden
  if (!recipeData.settings?.hideTitle) {
    contentRoot.appendChild(
      buildInlineMainEditableNode({
        tag: 'h1',
        key: 'title',
        html: renderRichText(recipeData.title),
        className: `text-4xl font-bold mb-4 font-style-${fontStyle}`,
        emptyValue: recipeData.title,
        emptyAutofocus: true,
        onHide: () => {
          recipeData.settings.hideTitle = true
          if (dom.hideTitleCheckbox) dom.hideTitleCheckbox.checked = true
        },
        confirmPrompt: 'Hide the title from preview?'
      })
    )
  }

  // Description (editable) — skip if hidden
  if (!recipeData.settings?.hideDescription) {
    contentRoot.appendChild(
      buildInlineMainEditableNode({
        tag: 'p',
        key: 'description',
        html: renderRichText(recipeData.description),
        className: `text-gray-600 italic mb-4 ${
          applyToText ? `font-style-${fontStyle}` : ''
        }`.trim(),
        emptyValue: recipeData.description,
        onHide: () => {
          recipeData.settings.hideDescription = true
          if (dom.hideDescCheckbox) dom.hideDescCheckbox.checked = true
        },
        confirmPrompt: 'Hide the description from preview?'
      })
    )
  }

  const rerenderAllEditors = createInlineRerenderAllEditors()

  const attachInlineItemInteractions =
    createInlineItemInteractionsBinder(rerenderAllEditors)

  const renderItemsInto = (rootEl, items) => {
    const state = { currentList: null, currentListType: null, stepCounter: 0 }

    for (const item of items) {
      const contentWithIcons = renderRichText(item.content || '')

      if (item.type === 'spacer') {
        resetInlineListState(state)
        renderInlineSpacerItem({
          rootEl,
          item,
          attachInlineItemInteractions,
          rerenderAllEditors,
          renderItemsInto
        })
        continue
      }

      if (item.type === 'step' || item.type === 'bullet') {
        renderInlineListItem({
          rootEl,
          item,
          state,
          fontStyle,
          applyToText,
          attachInlineItemInteractions,
          contentWithIcons
        })
        continue
      }

      resetInlineListState(state)
      renderInlineStandardItem({
        rootEl,
        item,
        fontStyle,
        contentWithIcons,
        applyToText,
        applyToTips,
        attachInlineItemInteractions
      })
    }
  }

  const topLevelItems = recipeData.items.filter(
    (it) => !hasValidParentInRecipe(it)
  )
  renderItemsInto(contentRoot, topLevelItems)

  // Attach input listeners for editable regions
  dom.inlinePreview
    .querySelectorAll('[contenteditable=true]')
    .forEach((node) => {
      node.addEventListener('input', handleInlineInput)
      node.addEventListener('blur', handleInlineBlur)
    })

  dom.inlinePreview.ondragover = null
  dom.inlinePreview.ondrop = null

  // Container-level drag/drop: drop to append at end
  dropSurface.ondragover = function (e) {
    e.preventDefault()
  }
  dropSurface.ondrop = function (e) {
    e.preventDefault()
    const dragId = e.dataTransfer.getData('text/plain')
    if (!dragId) return
    const idx = recipeData.items.findIndex(
      (i) => String(i.id) === String(dragId)
    )
    if (idx === -1) return
    const [draggedItem] = recipeData.items.splice(idx, 1)
    delete draggedItem.parentId
    recipeData.items.push(draggedItem)
    import('./classic.js').then(({ renderBuilderInputs }) => {
      renderBuilderInputs()
      renderInlinePreview()
    })
  }

  if (isPagedMode) {
    scheduleInlinePreviewStatsUpdate()
  }
}

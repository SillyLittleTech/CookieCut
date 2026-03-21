import { recipeData } from '../state.js'
import { dom } from '../dom.js'
import {
  renderIconCodes,
  getTextAndCaret,
  setCaretPosition,
  getDocumentTextStats
} from '../helpers.js'
import {
  applyItemScale,
  normalizeScale,
  syncScalePreviewSize
} from '../handlers/scale.js'
import * as headingHandler from '../handlers/heading.js'
import * as stepHandler from '../handlers/step.js'
import { renderInlineElement as renderInlineBulletElement } from '../handlers/bullet.js'
import * as textHandler from '../handlers/text.js'
import * as imageHandler from '../handlers/image.js'
import * as bubbleHandler from '../handlers/bubble.js'
import { renderInlineElement as renderInlineLinkElement } from '../handlers/link.js'
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
    dialog.style.background = 'white'
    dialog.style.width = 'min(360px, calc(100vw - 32px))'
    dialog.style.borderRadius = '10px'
    dialog.style.boxShadow = '0 14px 30px rgba(0,0,0,0.18)'
    dialog.style.padding = '14px'

    const title = document.createElement('p')
    title.textContent = message
    title.style.marginBottom = '12px'
    title.style.fontSize = '14px'
    title.style.color = '#111827'

    const actions = document.createElement('div')
    actions.style.display = 'flex'
    actions.style.justifyContent = 'flex-end'
    actions.style.gap = '8px'

    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = 'Cancel'
    cancelBtn.className = 'px-3 py-1 bg-gray-100 rounded'
    cancelBtn.addEventListener('click', () => closeInlineDeleteConfirm(false))

    const removeBtn = document.createElement('button')
    removeBtn.textContent = 'Remove'
    removeBtn.className = 'px-3 py-1 bg-red-600 text-white rounded'
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

export function openImageResizer (imgEl, item) {
  closeActiveInlineEditors()
  const resizer = document.createElement('div')
  resizer.className = 'image-resizer-overlay'
  resizer.style.position = 'fixed'
  resizer.style.left = '50%'
  resizer.style.transform = 'translateX(-50%)'
  resizer.style.bottom = '20px'
  resizer.style.zIndex = 60
  resizer.style.background = 'white'
  resizer.style.padding = '8px 12px'
  resizer.style.borderRadius = '8px'
  resizer.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)'

  const input = document.createElement('input')
  input.type = 'range'
  input.min = 100
  input.max = 1200
  input.step = 1
  input.value = item.size || 350
  input.style.width = '300px'
  const label = document.createElement('span')
  label.textContent = `${input.value}px`
  label.style.marginLeft = '10px'

  input.addEventListener('input', () => {
    const sizeValue = input.value
    item.size = Number(sizeValue)
    imgEl.style.maxWidth = `${sizeValue}px`
    label.textContent = `${sizeValue}px`
    // update builder input display if visible
    const itemEl = dom.contentInputs.querySelector(`[data-id="${item.id}"]`)
    if (itemEl) {
      const display = itemEl.querySelector('[data-role="size-display"]')
      const slider = itemEl.querySelector('[data-key="size"]')
      if (display) display.textContent = `${sizeValue}px`
      if (slider) slider.value = sizeValue
    }
    refreshInlinePreviewMetrics()
  })

  // URL and alt inputs
  const urlLabel = document.createElement('label')
  urlLabel.textContent = 'Image URL'
  urlLabel.style.display = 'block'
  urlLabel.style.marginTop = '8px'
  const urlInput = document.createElement('input')
  urlInput.type = 'url'
  urlInput.value = item.src || ''
  urlInput.placeholder = 'https://...'
  urlInput.style.width = '420px'
  urlInput.style.display = 'block'
  urlInput.style.marginTop = '4px'

  const altLabel = document.createElement('label')
  altLabel.textContent = 'Alt text'
  altLabel.style.display = 'block'
  altLabel.style.marginTop = '6px'
  const altInput = document.createElement('input')
  altInput.type = 'text'
  altInput.value = item.alt || ''
  altInput.style.width = '420px'
  altInput.style.display = 'block'
  altInput.style.marginTop = '4px'

  const applyBtn = document.createElement('button')
  applyBtn.textContent = 'Apply'
  applyBtn.className = 'ml-3 px-3 py-1 bg-blue-600 text-white rounded'
  applyBtn.addEventListener('click', () => {
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
    // update builder inputs if visible
    const itemEl = dom.contentInputs.querySelector(`[data-id="${item.id}"]`)
    if (itemEl) {
      const srcInput = itemEl.querySelector('[data-key="src"]')
      const altInputEl = itemEl.querySelector('[data-key="alt"]')
      if (srcInput) srcInput.value = item.src
      if (altInputEl) altInputEl.value = item.alt
    }
    refreshInlinePreviewMetrics()
  })

  const closeBtn = document.createElement('button')
  closeBtn.textContent = 'Done'
  closeBtn.className = 'ml-3 px-3 py-1 bg-gray-100 rounded'
  closeBtn.addEventListener('click', closeImageResizer)

  resizer.appendChild(input)
  resizer.appendChild(label)
  resizer.appendChild(urlLabel)
  resizer.appendChild(urlInput)
  resizer.appendChild(altLabel)
  resizer.appendChild(altInput)
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
  editor.style.background = 'white'
  editor.style.padding = '12px'
  editor.style.borderRadius = '8px'
  editor.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)'
  editor.style.width = 'min(560px, calc(100vw - 32px))'

  const title = document.createElement('p')
  title.textContent = 'Edit link'
  title.style.fontWeight = '700'
  title.style.marginBottom = '8px'
  title.style.fontSize = '14px'

  const textLabel = document.createElement('label')
  textLabel.textContent = 'Link text'
  textLabel.style.display = 'block'
  textLabel.style.fontSize = '12px'
  textLabel.style.color = '#374151'

  const textInput = document.createElement('input')
  textInput.type = 'text'
  textInput.value = item.content || ''
  textInput.placeholder = 'Link text'
  textInput.style.width = '100%'
  textInput.style.marginTop = '4px'
  textInput.style.marginBottom = '8px'

  const hrefLabel = document.createElement('label')
  hrefLabel.textContent = 'URL'
  hrefLabel.style.display = 'block'
  hrefLabel.style.fontSize = '12px'
  hrefLabel.style.color = '#374151'

  const hrefInput = document.createElement('input')
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
  cancelBtn.className = 'px-3 py-1 bg-gray-100 rounded'
  cancelBtn.addEventListener('click', closeLinkEditor)

  const saveBtn = document.createElement('button')
  saveBtn.textContent = 'Save'
  saveBtn.className = 'px-3 py-1 bg-blue-600 text-white rounded'
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
    dom.titlePreview.innerHTML = renderIconCodes(recipeData.title)
    dom.descPreview.innerHTML = renderIconCodes(recipeData.description)
    // update the editable node's HTML to show icons and restore caret
    const newHtml = renderIconCodes(text)
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
  const newHtml = renderIconCodes(item.content)
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
    dom.titlePreview.innerHTML = renderIconCodes(recipeData.title)
  } else if (key === 'description') {
    recipeData.description = text
    dom.descInput.value = recipeData.description
    dom.descPreview.innerHTML = renderIconCodes(recipeData.description)
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

  const newHtml = renderIconCodes(text || '')
  el.innerHTML = newHtml
  refreshInlinePreviewMetrics()
}

// --- Inline Preview Renderer ---

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
  const isPaged = recipeData.settings.previewMode === 'paged'
  dom.inlinePreview.classList.toggle('inline-paged-preview-active', isPaged)

  let contentRoot = dom.inlinePreview
  let dropSurface = dom.inlinePreview

  if (isPaged) {
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

    contentRoot = flow
    dropSurface = flow
    inlinePagedFlow = flow
  }

  // Title (editable)
  const h1 = document.createElement('h1')
  h1.className = `text-4xl font-bold mb-4 font-style-${fontStyle}`
  h1.contentEditable = true
  h1.dataset.key = 'title'
  h1.innerHTML = renderIconCodes(recipeData.title)
  // Outline for empty title so users notice it's editable
  if (!recipeData.title || recipeData.title.trim() === '') {
    h1.classList.add('new-text-outline')
    const removeOutline = () => {
      h1.classList.remove('new-text-outline')
      h1.removeEventListener('input', removeOutline)
    }
    h1.addEventListener('input', removeOutline)
    setTimeout(() => h1.focus(), 20)
  }
  contentRoot.appendChild(h1)

  // Description (editable)
  const descriptionParagraph = document.createElement('p')
  descriptionParagraph.className = 'text-gray-600 italic mb-4'
  descriptionParagraph.contentEditable = true
  descriptionParagraph.dataset.key = 'description'
  descriptionParagraph.innerHTML = renderIconCodes(recipeData.description)
  // Outline for empty description
  if (!recipeData.description || recipeData.description.trim() === '') {
    descriptionParagraph.classList.add('new-text-outline')
    const removeOutlineDesc = () => {
      descriptionParagraph.classList.remove('new-text-outline')
      descriptionParagraph.removeEventListener('input', removeOutlineDesc)
    }
    descriptionParagraph.addEventListener('input', removeOutlineDesc)
  }
  contentRoot.appendChild(descriptionParagraph)

  // Content (wrap in draggable inline-item wrappers; support dblclick removal and drag/drop reordering)
  let currentList = null
  let currentListType = null
  let stepCounter = 0

  const rerenderAllEditors = () => {
    import('./classic.js').then(({ renderBuilderInputs }) => {
      renderBuilderInputs()
      renderInlinePreview()
    })
  }

  const attachInlineItemInteractions = (node, itemId) => {
    node.addEventListener('dblclick', async (ev) => {
      ev.stopPropagation()
      if (await openInlineDeleteConfirm('Remove this item?')) {
        recipeData.items = recipeData.items.filter(
          (i) => String(i.id) !== String(itemId)
        )
        rerenderAllEditors()
      }
    })

    node.addEventListener('dragstart', (ev) => {
      ev.dataTransfer.setData('text/plain', String(itemId))
      node.classList.add('dragging')
    })
    node.addEventListener('dragend', () => {
      node.classList.remove('dragging')
      contentRoot
        .querySelectorAll('.inline-item.drop-target')
        .forEach((n) => n.classList.remove('drop-target'))
    })
    node.addEventListener('dragover', (ev) => {
      ev.preventDefault()
      node.classList.add('drop-target')
    })
    node.addEventListener('dragleave', () => {
      node.classList.remove('drop-target')
    })
    node.addEventListener('drop', (ev) => {
      ev.preventDefault()
      const dragId = ev.dataTransfer.getData('text/plain')
      const targetId = node.dataset.id
      if (dragId && targetId && dragId !== targetId) {
        reorderItems(dragId, targetId)
        rerenderAllEditors()
      }
    })
  }

  const ensureListContainer = (type) => {
    if (currentList && currentListType === type) return currentList

    currentList = document.createElement(type === 'step' ? 'ol' : 'ul')
    currentList.className =
      type === 'step' ? 'inline-step-list' : 'inline-bullet-list'
    currentListType = type
    contentRoot.appendChild(currentList)
    return currentList
  }

  recipeData.items.forEach((item) => {
    const contentWithIcons = renderIconCodes(item.content || '')

    if (item.type === 'step') {
      if (currentListType !== 'step') stepCounter = 0
      stepCounter += 1

      const list = ensureListContainer('step')
      const li = document.createElement('li')
      li.className = 'inline-item inline-list-item'
      li.dataset.id = item.id
      li.draggable = true

      const { badge, contentSpan } = stepHandler.renderInlineElement(
        item,
        fontStyle,
        contentWithIcons,
        stepCounter
      )
      li.appendChild(badge)
      const contentWrap = document.createElement('div')
      contentWrap.className = 'inline-list-content-wrap'
      contentWrap.appendChild(contentSpan)
      contentWrap.appendChild(createScaleHandle(item, contentSpan))
      li.appendChild(contentWrap)
      list.appendChild(li)
      attachInlineItemInteractions(li, item.id)
      return
    }

    if (item.type === 'bullet') {
      const list = ensureListContainer('bullet')
      const li = document.createElement('li')
      li.className = 'inline-item inline-list-item'
      li.dataset.id = item.id
      li.draggable = true

      const { badge, contentSpan } = renderInlineBulletElement(
        item,
        fontStyle,
        contentWithIcons
      )
      li.appendChild(badge)
      const contentWrap = document.createElement('div')
      contentWrap.className = 'inline-list-content-wrap'
      contentWrap.appendChild(contentSpan)
      contentWrap.appendChild(createScaleHandle(item, contentSpan))
      li.appendChild(contentWrap)
      list.appendChild(li)
      attachInlineItemInteractions(li, item.id)
      return
    }

    currentList = null
    currentListType = null
    stepCounter = 0

    {
      let renderedElement = null

      switch (item.type) {
        case 'heading':
          renderedElement = headingHandler.renderInlineElement(
            item,
            fontStyle,
            contentWithIcons
          )
          break
        case 'text':
          renderedElement = textHandler.renderInlineElement(
            item,
            fontStyle,
            contentWithIcons
          )
          break
        case 'image':
          renderedElement = imageHandler.renderInlineElement(
            item,
            fontStyle,
            contentWithIcons
          )
          renderedElement.addEventListener('click', (e) => {
            e.stopPropagation()
            openImageResizer(renderedElement, item)
          })
          break
        case 'bubble':
          renderedElement = bubbleHandler.renderInlineElement(
            item,
            fontStyle,
            contentWithIcons
          )
          break
        case 'link': {
          renderedElement = renderInlineLinkElement(
            item,
            fontStyle,
            contentWithIcons
          )
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
        default:
          break
      }

      if (!renderedElement) return

      const wrapper = document.createElement('div')
      wrapper.className = 'inline-item'
      wrapper.dataset.id = item.id
      wrapper.draggable = true
      wrapper.appendChild(renderedElement)

      // Add scale handle for all text-containing elements
      if (['text', 'heading', 'bubble', 'link'].includes(item.type)) {
        wrapper.appendChild(createScaleHandle(item, renderedElement))
      }

      // mark new text with outline to make it visible
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
      contentRoot.appendChild(wrapper)

      attachInlineItemInteractions(wrapper, item.id)
    }
  })

  // Attach input listeners for editable regions
  contentRoot.querySelectorAll('[contenteditable=true]').forEach((node) => {
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
    recipeData.items.push(draggedItem)
    import('./classic.js').then(({ renderBuilderInputs }) => {
      renderBuilderInputs()
      renderInlinePreview()
    })
  }

  if (isPaged) {
    scheduleInlinePreviewStatsUpdate()
  }
}

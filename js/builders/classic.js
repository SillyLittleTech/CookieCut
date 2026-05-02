import { recipeData } from '../state.js'
import { dom } from '../dom.js'
import { renderRichText, getDocumentTextStats } from '../helpers.js'
import {
  getBuilderInput as getHeadingBuilderInput,
  renderPreviewElement as renderHeadingPreviewElement
} from '../handlers/heading.js'
import {
  getBuilderInput as getStepBuilderInput,
  renderPreviewElement as renderStepPreviewElement
} from '../handlers/step.js'
import {
  getBuilderInput as getBulletBuilderInput,
  renderPreviewElement as renderBulletPreviewElement
} from '../handlers/bullet.js'
import {
  getBuilderInput as getTextBuilderInput,
  renderPreviewElement as renderTextPreviewElement
} from '../handlers/text.js'
import {
  getBuilderInput as getImageBuilderInput,
  renderPreviewElement as renderImagePreviewElement
} from '../handlers/image.js'
import {
  getBuilderInput as getBubbleBuilderInput,
  renderPreviewElement as renderBubblePreviewElement
} from '../handlers/bubble.js'
import {
  getBuilderInput as getLinkBuilderInput,
  renderPreviewElement as renderLinkPreviewElement
} from '../handlers/link.js'
import {
  getBuilderInput as getSpacerBuilderInput,
  renderPreviewElement as renderSpacerPreviewElement
} from '../handlers/spacer.js'
// Note: renderInlinePreview is imported lazily inside the function body to avoid
// circular-import issues at module evaluation time.
let inlineRenderRequestId = 0

/**
 * Re-draws the entire builder input form based on recipeData.
 */
export function renderBuilderInputs () {
  dom.contentInputs.innerHTML = ''

  recipeData.items.forEach((item, index) => {
    const el = document.createElement('div')
    el.setAttribute('data-id', item.id)
    el.className =
      'p-4 bg-white border border-gray-300 rounded-lg shadow-sm animate-fade-in-down'

    let inputHtml = ''
    let itemLabel = ''

    switch (item.type) {
      case 'heading': {
        const result = getHeadingBuilderInput(item)
        itemLabel = result.label
        inputHtml = result.inputHtml
        break
      }
      case 'step': {
        const result = getStepBuilderInput(item)
        itemLabel = result.label
        inputHtml = result.inputHtml
        break
      }
      case 'bullet': {
        const result = getBulletBuilderInput(item)
        itemLabel = result.label
        inputHtml = result.inputHtml
        break
      }
      case 'text': {
        const result = getTextBuilderInput(item)
        itemLabel = result.label
        inputHtml = result.inputHtml
        break
      }
      case 'image': {
        const result = getImageBuilderInput(item)
        itemLabel = result.label
        inputHtml = result.inputHtml
        break
      }
      case 'bubble': {
        const result = getBubbleBuilderInput(item)
        itemLabel = result.label
        inputHtml = result.inputHtml
        break
      }
      case 'link': {
        const result = getLinkBuilderInput(item)
        itemLabel = result.label
        inputHtml = result.inputHtml
        break
      }
      case 'spacer': {
        const result = getSpacerBuilderInput(item)
        itemLabel = result.label
        inputHtml = result.inputHtml
        break
      }
      default:
        break
    }

    const isFirst = index === 0
    const isLast = index === recipeData.items.length - 1

    el.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <label class="font-bold text-gray-700">${itemLabel}</label>
                <div class="flex items-center space-x-3">
                    <button type="button" class="item-btn move-up-btn ${isFirst ? 'hidden-arrow' : ''}" title="Move up">▲</button>
                    <button type="button" class="item-btn move-down-btn ${isLast ? 'hidden-arrow' : ''}" title="Move down">▼</button>
                    <button type="button" class="item-btn delete-btn no-print" title="Delete item">&times;</button>
                </div>
            </div>
            ${inputHtml}
        `
    dom.contentInputs.appendChild(el)
  })

  // If inline editor is active, update its preview too
  if (recipeData.settings && recipeData.settings.editorMode === 'inline') {
    const requestId = ++inlineRenderRequestId
    // Import lazily to avoid circular dependency at evaluation time
    import('./inline.js')
      .then(({ renderInlinePreview }) => {
        if (requestId !== inlineRenderRequestId) return
        if (
          !recipeData.settings ||
          recipeData.settings.editorMode !== 'inline'
        ) {
          return
        }
        renderInlinePreview()
      })
      .catch((error) => {
        // Handle failures to load the inline builder module gracefully
        console.error('Failed to load inline builder module:', error)
        // Invalidate this request if it is still the active one
        if (requestId === inlineRenderRequestId) {
          inlineRenderRequestId += 1
        }
      })
  } else {
    // invalidate queued inline rerenders after mode flips to classic
    inlineRenderRequestId += 1
  }
}

function hasValidParentItem (item) {
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

function appendClassicPreviewNodeForItem ({
  item,
  fontStyle,
  contentWithIcons,
  applyToText,
  applyToTips,
  nodes,
  listState
}) {
  switch (item.type) {
    case 'heading': {
      nodes.push(
        renderHeadingPreviewElement(item, fontStyle, contentWithIcons)
      )
      break
    }
    case 'step': {
      if (!listState.currentList) {
        listState.currentList = document.createElement('ol')
        listState.currentListType = 'step'
      }
      const el = renderStepPreviewElement(item, fontStyle, contentWithIcons)
      if (applyToText) el.classList.add(`font-style-${fontStyle}`)
      listState.currentList.appendChild(el)
      break
    }
    case 'bullet': {
      if (!listState.currentList) {
        listState.currentList = document.createElement('ul')
        listState.currentListType = 'bullet'
      }
      const el = renderBulletPreviewElement(item, fontStyle, contentWithIcons)
      if (applyToText) el.classList.add(`font-style-${fontStyle}`)
      listState.currentList.appendChild(el)
      break
    }
    case 'text': {
      const el = renderTextPreviewElement(item, fontStyle, contentWithIcons)
      if (applyToText) el.classList.add(`font-style-${fontStyle}`)
      nodes.push(el)
      break
    }
    case 'image': {
      nodes.push(renderImagePreviewElement(item, fontStyle, contentWithIcons))
      break
    }
    case 'bubble': {
      const el = renderBubblePreviewElement(item, fontStyle, contentWithIcons)
      if (applyToTips) el.classList.add(`font-style-${fontStyle}`)
      nodes.push(el)
      break
    }
    case 'link': {
      const el = renderLinkPreviewElement(item, fontStyle, contentWithIcons)
      if (applyToText) el.classList.add(`font-style-${fontStyle}`)
      nodes.push(el)
      break
    }
    case 'spacer': {
      const el = renderSpacerPreviewElement(item)
      const variant = item.variant || 'blank'
      if (variant === 'container') {
        const kids = getChildItemsInDocumentOrder(item.id)
        collectPreviewNodesFromItems(kids, fontStyle).forEach((childNode) => {
          el.appendChild(childNode)
        })
      }
      nodes.push(el)
      break
    }
    default:
      break
  }
}

/**
 * Build preview DOM nodes for a linear sequence of items (used for root and
 * inside spacer containers). Mutates list-grouping state via closure.
 */
function collectPreviewNodesFromItems (items, fontStyle) {
  const nodes = []
  const listState = { currentList: null, currentListType: null }
  const applyToText = Boolean(recipeData.settings.fontApplyToText)
  const applyToTips = Boolean(recipeData.settings.fontApplyToTips)

  const flushCurrentList = () => {
    if (!listState.currentList) return
    nodes.push(listState.currentList)
    listState.currentList = null
    listState.currentListType = null
  }

  items.forEach((item) => {
    const isListItem = item.type === 'step' || item.type === 'bullet'

    if (
      (!isListItem || listState.currentListType !== item.type) &&
      listState.currentList
    ) {
      flushCurrentList()
    }

    const contentWithIcons = renderRichText(item.content || '')
    appendClassicPreviewNodeForItem({
      item,
      fontStyle,
      contentWithIcons,
      applyToText,
      applyToTips,
      nodes,
      listState
    })
  })

  flushCurrentList()

  return nodes
}

/**
 * Re-draws the entire recipe preview based on recipeData.
 */
function collectPreviewNodes (fontStyle) {
  // Ensure the description preview reflects the current font style setting.
  const applyToText = Boolean(recipeData.settings.fontApplyToText)
  if (dom?.descPreview) {
    Array.from(dom.descPreview.classList).forEach((cls) => {
      if (cls.startsWith('font-style-')) {
        dom.descPreview.classList.remove(cls)
      }
    })
    if (applyToText && fontStyle) {
      dom.descPreview.classList.add(`font-style-${fontStyle}`)
    }
  }

  const topLevel = recipeData.items.filter((it) => !hasValidParentItem(it))
  return collectPreviewNodesFromItems(topLevel, fontStyle)
}

function getPagedPageCount () {
  if (!dom.recipeFlow) return 1
  const styles = globalThis.getComputedStyle(dom.recipeFlow)
  const columnWidth = Number.parseFloat(styles.columnWidth)
  const columnGap = Number.parseFloat(styles.columnGap) || 0

  if (!Number.isFinite(columnWidth) || columnWidth <= 0) {
    return 1
  }

  const estimatedPages = Math.ceil(
    (dom.recipeFlow.scrollWidth + columnGap) / (columnWidth + columnGap)
  )

  return Math.max(1, estimatedPages)
}

function updatePreviewStats (pageCount = 1) {
  const stats = getDocumentTextStats(recipeData)

  if (dom.wordCountValue) dom.wordCountValue.textContent = String(stats.words)
  if (dom.sentenceCountValue) {
    dom.sentenceCountValue.textContent = String(stats.sentences)
  }
  if (dom.paragraphCountValue) {
    dom.paragraphCountValue.textContent = String(stats.paragraphs)
  }
  if (dom.pageCountValue) {
    dom.pageCountValue.textContent = String(Math.max(1, pageCount))
  }
}

function applyPreviewModeLayout (isPaged) {
  dom.recipePanel?.classList.toggle('paged-preview-active', isPaged)
  dom.previewStats?.classList.toggle('hidden', !isPaged)
}

function schedulePreviewStatsUpdate (isPaged) {
  if (!isPaged) {
    updatePreviewStats(1)
    return
  }

  const recalculate = () => {
    updatePreviewStats(getPagedPageCount())
  }

  // Run multiple recalculations so page counts remain accurate
  // after reflow from font loading and viewport scaling.
  requestAnimationFrame(() => {
    recalculate()
    requestAnimationFrame(recalculate)
  })
  setTimeout(recalculate, 140)
}

export function refreshPagedPreviewMetrics () {
  const isPaged = recipeData.settings?.previewMode === 'paged'
  const isPreviewVisible =
    dom.recipePanel && !dom.recipePanel.classList.contains('hidden')
  if (!isPaged || !isPreviewVisible) return
  updatePreviewStats(getPagedPageCount())
}

export function renderPreview () {
  const fontStyle = recipeData.settings.fontStyle || 'display'
  const isPaged = recipeData.settings?.previewMode === 'paged'
  const applyToText = Boolean(recipeData.settings?.fontApplyToText)
  const descFontClass = applyToText ? `font-style-${fontStyle}` : ''

  applyPreviewModeLayout(isPaged)

  dom.titlePreview.innerHTML = renderRichText(recipeData.title)
  dom.titlePreview.className = `font-style-${fontStyle}`
  dom.titlePreview.classList.toggle(
    'hidden',
    Boolean(recipeData.settings?.hideTitle)
  )

  dom.descPreview.innerHTML = renderRichText(recipeData.description)
  dom.descPreview.className = descFontClass
  dom.descPreview.classList.toggle(
    'hidden',
    Boolean(recipeData.settings?.hideDescription)
  )
  dom.contentPreview.innerHTML = ''

  const nodes = collectPreviewNodes(fontStyle)
  nodes.forEach((node) => dom.contentPreview.appendChild(node))
  schedulePreviewStatsUpdate(isPaged)
}

import { recipeData } from '../state.js'
import { dom } from '../dom.js'
import {
  renderRichText,
  getDocumentTextStats,
  sanitizeHtmlContent,
  escapeHTML
} from '../helpers.js'
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
  getBuilderInput as getButtonBuilderInput,
  renderPreviewElement as renderButtonPreviewElement
} from '../handlers/button.js'
import {
  getBuilderInput as getNavmenuBuilderInput,
  renderPreviewElement as renderNavmenuPreviewElement
} from '../handlers/navmenu.js'
import {
  getBuilderInput as getDropdownBuilderInput,
  renderPreviewElement as renderDropdownPreviewElement
} from '../handlers/dropdown.js'
import {
  getBuilderInput as getFrameBuilderInput,
  renderPreviewElement as renderFramePreviewElement
} from '../handlers/frame.js'
import {
  getBuilderInput as getCodescriptBuilderInput,
  renderPreviewElement as renderCodescriptPreviewElement
} from '../handlers/codescript.js'
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

  const isHtmlOnlyType = (type) =>
    ['button', 'navmenu', 'dropdown', 'frame', 'codescript'].includes(type)

  const getCodeViewBuilderInput = (item) => {
    const targetKey = isHtmlOnlyType(item.type) ? 'htmlOverride' : 'content'
    const label = isHtmlOnlyType(item.type) ? 'HTML override' : 'HTML source'
    const placeholder = isHtmlOnlyType(item.type)
      ? '<div>Custom HTML for this element…</div>'
      : '<div>Custom HTML for this item…</div>'
    const value = escapeHTML(item[targetKey] || '')
    return {
      label: `${label}`,
      inputHtml: `
        <div class="space-y-2">
          <textarea data-key="${targetKey}" rows="8" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md font-mono text-xs dark:bg-gray-700 dark:text-gray-100" placeholder="${escapeHTML(
            placeholder
          )}">${value}</textarea>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            ${
              isHtmlOnlyType(item.type)
                ? 'Overrides the rendered HTML for this element.'
                : 'Edits this item as HTML (enables the HTML toggle automatically when used).'
            }
          </p>
        </div>
      `
    }
  }

  recipeData.items.forEach((item, index) => {
    const el = document.createElement('div')
    el.setAttribute('data-id', item.id)
    el.className =
      'p-4 bg-white border border-gray-300 rounded-lg shadow-sm animate-fade-in-down'

    let inputHtml = ''
    let itemLabel = ''

    const inCodeView = Boolean(
      recipeData.settings?.showHtmlTools && item && item.codeView
    )

    if (inCodeView) {
      const result = getCodeViewBuilderInput(item)
      itemLabel = result.label
      inputHtml = result.inputHtml
    } else {
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
        case 'button': {
          const result = getButtonBuilderInput(item)
          itemLabel = result.label
          inputHtml = result.inputHtml
          break
        }
        case 'navmenu': {
          const result = getNavmenuBuilderInput(item)
          itemLabel = result.label
          inputHtml = result.inputHtml
          break
        }
        case 'dropdown': {
          const result = getDropdownBuilderInput(item)
          itemLabel = result.label
          inputHtml = result.inputHtml
          break
        }
        case 'frame': {
          const result = getFrameBuilderInput(item)
          itemLabel = result.label
          inputHtml = result.inputHtml
          break
        }
        case 'codescript': {
          const result = getCodescriptBuilderInput(item)
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
    }

    const isFirst = index === 0
    const isLast = index === recipeData.items.length - 1
    const htmlToolsEnabled = Boolean(recipeData.settings?.showHtmlTools)
    // HTML-enabled items render their content as sanitized HTML in the preview
    const htmlEnabled = Boolean(item.htmlEnabled)
    const htmlToggleEligible =
      htmlToolsEnabled &&
      !['button', 'navmenu', 'dropdown', 'frame', 'codescript'].includes(
        item.type
      )
    const htmlToggleBtn = htmlToggleEligible
      ? `<button type="button" class="html-code-toggle-btn item-btn${htmlEnabled ? ' active' : ''}" title="Toggle HTML editing for this item">{}</button>`
      : ''
    const codeViewToggleBtn = htmlToolsEnabled
      ? `<div class="code-view-toggle-group" role="group" aria-label="Code view toggle">
          <button type="button" class="code-view-toggle-btn${item.codeView ? ' active' : ''}" data-mode="code" title="Code view">
            <span class="material-icons">code</span>
          </button>
          <button type="button" class="code-view-toggle-btn${!item.codeView ? ' active' : ''}" data-mode="form" title="Form view">
            <span class="material-icons">edit</span>
          </button>
        </div>`
      : ''

    el.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <label class="font-bold text-gray-700">${itemLabel}</label>
                <div class="flex items-center space-x-2">
                    ${htmlToggleBtn}
                    ${codeViewToggleBtn}
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

function pushClassicHtmlOverridePreview (nodes, item, className) {
  if (!(recipeData.settings?.showHtmlTools && item.htmlOverride)) return false
  const el = document.createElement('div')
  if (className) el.className = className
  el.innerHTML = sanitizeHtmlContent(item.htmlOverride || '')
  nodes.push(el)
  return true
}

const CLASSIC_PREVIEW_APPEND_HANDLERS = {
  heading ({ item, fontStyle, contentWithIcons, nodes }) {
    nodes.push(renderHeadingPreviewElement(item, fontStyle, contentWithIcons))
  },
  step ({ item, fontStyle, contentWithIcons, applyToText, listState }) {
    if (!listState.currentList) {
      listState.currentList = document.createElement('ol')
      listState.currentListType = 'step'
    }
    const el = renderStepPreviewElement(item, fontStyle, contentWithIcons)
    if (applyToText) el.classList.add(`font-style-${fontStyle}`)
    listState.currentList.appendChild(el)
  },
  bullet ({ item, fontStyle, contentWithIcons, applyToText, listState }) {
    if (!listState.currentList) {
      listState.currentList = document.createElement('ul')
      listState.currentListType = 'bullet'
    }
    const el = renderBulletPreviewElement(item, fontStyle, contentWithIcons)
    if (applyToText) el.classList.add(`font-style-${fontStyle}`)
    listState.currentList.appendChild(el)
  },
  text ({ item, fontStyle, contentWithIcons, applyToText, nodes }) {
    const el = renderTextPreviewElement(item, fontStyle, contentWithIcons)
    if (applyToText) el.classList.add(`font-style-${fontStyle}`)
    nodes.push(el)
  },
  image ({ item, fontStyle, contentWithIcons, nodes }) {
    nodes.push(renderImagePreviewElement(item, fontStyle, contentWithIcons))
  },
  bubble ({ item, fontStyle, contentWithIcons, applyToTips, nodes }) {
    const el = renderBubblePreviewElement(item, fontStyle, contentWithIcons)
    if (applyToTips) el.classList.add(`font-style-${fontStyle}`)
    nodes.push(el)
  },
  link ({ item, fontStyle, contentWithIcons, applyToText, nodes }) {
    const el = renderLinkPreviewElement(item, fontStyle, contentWithIcons)
    if (applyToText) el.classList.add(`font-style-${fontStyle}`)
    nodes.push(el)
  },
  button ({ item, nodes }) {
    if (pushClassicHtmlOverridePreview(nodes, item, 'recipe-text-block')) return
    nodes.push(renderButtonPreviewElement(item))
  },
  navmenu ({ item, nodes }) {
    if (pushClassicHtmlOverridePreview(nodes, item, '')) return
    nodes.push(renderNavmenuPreviewElement(item))
  },
  dropdown ({ item, nodes }) {
    if (pushClassicHtmlOverridePreview(nodes, item, 'recipe-text-block')) return
    nodes.push(renderDropdownPreviewElement(item))
  },
  frame ({ item, nodes }) {
    if (pushClassicHtmlOverridePreview(nodes, item, 'recipe-text-block')) return
    nodes.push(renderFramePreviewElement(item))
  },
  codescript ({ item, nodes }) {
    nodes.push(renderCodescriptPreviewElement(item))
  },
  spacer ({ item, fontStyle, nodes }) {
    const el = renderSpacerPreviewElement(item)
    const variant = item.variant || 'blank'
    if (variant === 'container') {
      const kids = getChildItemsInDocumentOrder(item.id)
      collectPreviewNodesFromItems(kids, fontStyle).forEach((childNode) => {
        el.appendChild(childNode)
      })
    }
    nodes.push(el)
  }
}

function appendClassicPreviewNodeForItem (params) {
  const handler = CLASSIC_PREVIEW_APPEND_HANDLERS[params.item.type]
  if (handler) handler(params)
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
  const htmlToolsEnabled = Boolean(recipeData.settings?.showHtmlTools)

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

    const contentWithIcons =
      htmlToolsEnabled && item.htmlEnabled
        ? sanitizeHtmlContent(item.content || '')
        : renderRichText(item.content || '')
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

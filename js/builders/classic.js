import { recipeData } from '../state.js'
import { dom } from '../dom.js'
import {
  renderRichText,
  getDocumentTextStats,
  sanitizeHtmlContent
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
      default:
        break
    }

    const isFirst = index === 0
    const isLast = index === recipeData.items.length - 1
    const isHtmlMode =
      recipeData.settings && recipeData.settings.editorMode === 'html'
    // HTML-enabled items render their content as sanitized HTML in the preview
    const htmlEnabled = Boolean(item.htmlEnabled)
    const htmlToggleBtn = isHtmlMode
      ? `<button type="button" class="html-code-toggle-btn item-btn${htmlEnabled ? ' active' : ''}" title="Toggle HTML editing for this item">{}</button>`
      : ''

    el.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <label class="font-bold text-gray-700">${itemLabel}</label>
                <div class="flex items-center space-x-2">
                    ${htmlToggleBtn}
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

/**
 * Re-draws the entire recipe preview based on recipeData.
 */
function collectPreviewNodes (fontStyle) {
  const nodes = []
  let currentList = null
  let currentListType = null
  const applyToText = Boolean(recipeData.settings.fontApplyToText)
  const applyToTips = Boolean(recipeData.settings.fontApplyToTips)

  // Ensure the description preview reflects the current font style setting.
  if (dom?.descPreview) {
    // Remove any existing font-style-* classes from the description.
    Array.from(dom.descPreview.classList).forEach((cls) => {
      if (cls.startsWith('font-style-')) {
        dom.descPreview.classList.remove(cls)
      }
    })
    // Apply the current font style if the setting is enabled.
    if (applyToText && fontStyle) {
      dom.descPreview.classList.add(`font-style-${fontStyle}`)
    }
  }
  const flushCurrentList = () => {
    if (!currentList) return
    nodes.push(currentList)
    currentList = null
    currentListType = null
  }

  recipeData.items.forEach((item) => {
    const isListItem = item.type === 'step' || item.type === 'bullet'

    if ((!isListItem || currentListType !== item.type) && currentList) {
      flushCurrentList()
    }

    const isHtmlMode =
      recipeData.settings && recipeData.settings.editorMode === 'html'
    // When HTML mode and item has htmlEnabled, render content as raw HTML
    const contentWithIcons =
      isHtmlMode && item.htmlEnabled
        ? sanitizeHtmlContent(item.content || '')
        : renderRichText(item.content || '')

    switch (item.type) {
      case 'heading': {
        const el = renderHeadingPreviewElement(
          item,
          fontStyle,
          contentWithIcons
        )
        nodes.push(el)
        break
      }
      case 'step': {
        if (!currentList) {
          currentList = document.createElement('ol')
          currentListType = 'step'
        }
        const el = renderStepPreviewElement(item, fontStyle, contentWithIcons)
        if (applyToText) el.classList.add(`font-style-${fontStyle}`)
        currentList.appendChild(el)
        break
      }
      case 'bullet': {
        if (!currentList) {
          currentList = document.createElement('ul')
          currentListType = 'bullet'
        }
        const el = renderBulletPreviewElement(
          item,
          fontStyle,
          contentWithIcons
        )
        if (applyToText) el.classList.add(`font-style-${fontStyle}`)
        currentList.appendChild(el)
        break
      }
      case 'text': {
        const el = renderTextPreviewElement(item, fontStyle, contentWithIcons)
        if (applyToText) el.classList.add(`font-style-${fontStyle}`)
        nodes.push(el)
        break
      }
      case 'image': {
        const el = renderImagePreviewElement(item, fontStyle, contentWithIcons)
        nodes.push(el)
        break
      }
      case 'bubble': {
        const el = renderBubblePreviewElement(
          item,
          fontStyle,
          contentWithIcons
        )
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
      case 'button': {
        const el = renderButtonPreviewElement(item)
        nodes.push(el)
        break
      }
      case 'navmenu': {
        const el = renderNavmenuPreviewElement(item)
        nodes.push(el)
        break
      }
      case 'dropdown': {
        const el = renderDropdownPreviewElement(item)
        nodes.push(el)
        break
      }
      case 'frame': {
        const el = renderFramePreviewElement(item)
        nodes.push(el)
        break
      }
      default:
        break
    }
  })

  if (currentList) {
    flushCurrentList()
  }

  return nodes
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

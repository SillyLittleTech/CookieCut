import { recipeData } from './state.js'
import { dom } from './dom.js'
import {
  getCodeSelection,
  getHighlightOptions,
  RICH_TEXT_SCALE_MIN_PX,
  RICH_TEXT_SCALE_MAX_PX,
  RICH_TEXT_DEFAULT_SCALE_PX
} from './helpers.js'
import { renderBuilderInputs, renderPreview } from './builders/classic.js'
let visibilityRefreshRafId = 0

const toolbarState = {
  element: null,
  mode: null,
  classicSelection: null,
  inlineTarget: null,
  visible: false
}

function clampScale (value) {
  return Math.max(
    RICH_TEXT_SCALE_MIN_PX,
    Math.min(RICH_TEXT_SCALE_MAX_PX, value)
  )
}

function normalizeRange (start, end) {
  return {
    start: Math.min(start, end),
    end: Math.max(start, end)
  }
}

function getEditableNodeFromEventTarget (targetNode) {
  if (!targetNode) return null
  if (targetNode.nodeType === Node.TEXT_NODE) return targetNode.parentElement
  if (targetNode.nodeType === Node.ELEMENT_NODE) return targetNode
  return null
}

function isClassicFormattingField (element) {
  if (!element) return false
  if (
    element.id === 'recipe-title-input' ||
    element.id === 'recipe-desc-input'
  ) {
    return true
  }
  const key = element.dataset?.key
  return key === 'content'
}

function getClassicSelectionTarget () {
  const activeElement = document.activeElement
  if (!activeElement) return null
  const tagName = activeElement.tagName
  if (tagName !== 'INPUT' && tagName !== 'TEXTAREA') return null
  if (activeElement.readOnly || activeElement.disabled) return null
  if (!isClassicFormattingField(activeElement)) return null

  const start = activeElement.selectionStart
  const end = activeElement.selectionEnd
  if (typeof start !== 'number' || typeof end !== 'number' || start === end) {
    return null
  }

  const range = normalizeRange(start, end)
  return {
    element: activeElement,
    ...range
  }
}

function getInlineSelectionTarget () {
  const selection = globalThis.getSelection?.()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null
  }

  const range = selection.getRangeAt(0)
  const commonNode = getEditableNodeFromEventTarget(
    range.commonAncestorContainer
  )
  const editableRoot = commonNode?.closest(
    '#inline-preview [contenteditable="true"]'
  )

  if (!editableRoot) return null
  if (
    !editableRoot.contains(range.startContainer) ||
    !editableRoot.contains(range.endContainer)
  ) {
    return null
  }

  const rect = range.getBoundingClientRect()
  if (!rect || (rect.width === 0 && rect.height === 0)) return null

  return { root: editableRoot, rect }
}

function showToolbarAtRect (rect) {
  if (!toolbarState.element) return
  const toolbar = toolbarState.element
  toolbar.classList.remove('hidden')
  const toolbarWidth = toolbar.offsetWidth || 360
  const toolbarHeight = toolbar.offsetHeight || 42

  const viewportPadding = 8
  const desiredTop = rect.top + globalThis.scrollY - toolbarHeight - 10
  const fallbackTop = rect.bottom + globalThis.scrollY + 10
  const top =
    desiredTop < globalThis.scrollY + viewportPadding
      ? fallbackTop
      : desiredTop

  const centeredLeft = rect.left + globalThis.scrollX + rect.width / 2
  const minLeft = globalThis.scrollX + viewportPadding
  const maxLeft =
    globalThis.scrollX +
    document.documentElement.clientWidth -
    toolbarWidth -
    viewportPadding
  const left = Math.min(
    Math.max(minLeft, centeredLeft - toolbarWidth / 2),
    Math.max(minLeft, maxLeft)
  )

  toolbar.style.top = `${Math.round(top)}px`
  toolbar.style.left = `${Math.round(left)}px`
  toolbarState.visible = true
}

function hideToolbar () {
  if (!toolbarState.element) return
  toolbarState.element.classList.add('hidden')
  toolbarState.mode = null
  toolbarState.classicSelection = null
  toolbarState.inlineTarget = null
  toolbarState.visible = false
}

function wrapSelectionWithTokens (text, start, end, openToken, closeToken) {
  const selected = text.slice(start, end)
  const nextText =
    text.slice(0, start) + openToken + selected + closeToken + text.slice(end)
  const wrappedStart = start + openToken.length
  const wrappedEnd = wrappedStart + selected.length
  return { text: nextText, start: wrappedStart, end: wrappedEnd }
}

function toggleSymmetricTokens (text, start, end, token) {
  const isWrapped =
    start >= token.length &&
    end + token.length <= text.length &&
    text.slice(start - token.length, start) === token &&
    text.slice(end, end + token.length) === token

  if (isWrapped) {
    const nextText =
      text.slice(0, start - token.length) +
      text.slice(start, end) +
      text.slice(end + token.length)
    return {
      text: nextText,
      start: start - token.length,
      end: end - token.length
    }
  }

  return wrapSelectionWithTokens(text, start, end, token, token)
}

function applyScaleDelta (text, start, end, deltaPx) {
  const selected = text.slice(start, end)

  const selectedScaleMatch = selected.match(/^\{(\d{1,3})\{([\s\S]*)\}\}$/u)
  if (selectedScaleMatch) {
    const innerText = selectedScaleMatch[2]
    const nextScale = clampScale(
      Number.parseInt(selectedScaleMatch[1], 10) + deltaPx
    )
    const openToken = `{${nextScale}{`
    const replacement = `${openToken}${innerText}}}`
    const nextText = text.slice(0, start) + replacement + text.slice(end)
    const nextStart = start + openToken.length
    return {
      text: nextText,
      start: nextStart,
      end: nextStart + innerText.length
    }
  }

  const openScaleMatch = text.slice(0, start).match(/\{(\d{1,3})\{$/u)
  const hasScaleCloser = text.slice(end, end + 2) === '}}'
  if (openScaleMatch && hasScaleCloser) {
    const priorOpenToken = openScaleMatch[0]
    const priorScale = Number.parseInt(openScaleMatch[1], 10)
    const nextScale = clampScale(priorScale + deltaPx)
    const nextOpenToken = `{${nextScale}{`
    const openTokenStart = start - priorOpenToken.length
    const nextText =
      text.slice(0, openTokenStart) +
      nextOpenToken +
      text.slice(start, end) +
      text.slice(end)
    const nextStart = openTokenStart + nextOpenToken.length
    return {
      text: nextText,
      start: nextStart,
      end: nextStart + selected.length
    }
  }

  const nextScale = clampScale(RICH_TEXT_DEFAULT_SCALE_PX + deltaPx)
  const openToken = `{${nextScale}{`
  return wrapSelectionWithTokens(text, start, end, openToken, '}}')
}

function applyCommandToText (command, value, text, start, end) {
  switch (command) {
    case 'bold':
      return toggleSymmetricTokens(text, start, end, '**')
    case 'italic':
      return toggleSymmetricTokens(text, start, end, '*')
    case 'underline':
      return toggleSymmetricTokens(text, start, end, '__')
    case 'strike':
      return toggleSymmetricTokens(text, start, end, '~~')
    case 'highlight':
      return wrapSelectionWithTokens(
        text,
        start,
        end,
        `[${value || 'y'}[`,
        ']]'
      )
    case 'scale-up':
      return applyScaleDelta(text, start, end, 5)
    case 'scale-down':
      return applyScaleDelta(text, start, end, -5)
    default:
      return { text, start, end }
  }
}

function syncClassicModelValue (element, nextValue) {
  if (element.id === 'recipe-title-input') {
    recipeData.title = nextValue
    return
  }
  if (element.id === 'recipe-desc-input') {
    recipeData.description = nextValue
    return
  }

  const itemElement = element.closest('[data-id]')
  if (!itemElement) return
  const itemId = itemElement.dataset.id
  const item = recipeData.items.find(
    (entry) => String(entry.id) === String(itemId)
  )
  if (!item) return

  const key = element.dataset?.key
  if (key) {
    item[key] = nextValue
  }
}

function syncInlineModelValue (editableRoot, nextValue) {
  const key = editableRoot.dataset?.key
  if (key === 'title') {
    recipeData.title = nextValue
    if (dom.titleInput) dom.titleInput.value = nextValue
    return
  }
  if (key === 'description') {
    recipeData.description = nextValue
    if (dom.descInput) dom.descInput.value = nextValue
    return
  }

  const itemId = editableRoot.dataset?.id
  if (!itemId) return
  const item = recipeData.items.find(
    (entry) => String(entry.id) === String(itemId)
  )
  if (!item) return
  item.content = nextValue
}

function applyCommandToClassicSelection (command, value) {
  const selectionState = toolbarState.classicSelection
  if (!selectionState) return

  const inputElement = selectionState.element
  const text = inputElement.value || ''
  const { start, end } = selectionState
  if (start === end) return

  const next = applyCommandToText(command, value, text, start, end)
  if (next.text === text) return

  inputElement.value = next.text
  syncClassicModelValue(inputElement, next.text)
  inputElement.focus()
  inputElement.setSelectionRange(next.start, next.end)
  toolbarState.classicSelection = {
    element: inputElement,
    start: next.start,
    end: next.end
  }

  inputElement.dispatchEvent(new Event('input', { bubbles: true }))

  if (
    recipeData.settings?.editorMode !== 'inline' &&
    dom.recipePanel &&
    !dom.recipePanel.classList.contains('hidden')
  ) {
    renderPreview()
  }
}

function applyCommandToInlineSelection (command, value) {
  const inlineTarget = toolbarState.inlineTarget
  if (!inlineTarget?.root) return

  const { text, start, end } = getCodeSelection(inlineTarget.root)
  if (start === end) return
  const next = applyCommandToText(command, value, text, start, end)
  if (next.text === text) return

  syncInlineModelValue(inlineTarget.root, next.text)
  renderBuilderInputs()
  hideToolbar()
}

function handleToolbarCommand (event) {
  const commandButton = event.target.closest('[data-command]')
  if (!commandButton) return

  const command = commandButton.dataset.command
  const value = commandButton.dataset.value || ''

  if (toolbarState.mode === 'inline') {
    applyCommandToInlineSelection(command, value)
    return
  }
  if (toolbarState.mode === 'classic') {
    applyCommandToClassicSelection(command, value)
  }
}

function buildToolbarButton (
  label,
  command,
  title,
  extraClass = '',
  ariaLabel = title
) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = label
  button.className = `selection-toolbar-btn ${extraClass}`.trim()
  button.dataset.command = command
  button.title = title
  button.setAttribute('aria-label', ariaLabel)
  return button
}

function ensureToolbar () {
  if (toolbarState.element) return toolbarState.element

  const toolbar = document.createElement('div')
  toolbar.id = 'selection-format-toolbar'
  toolbar.className = 'selection-format-toolbar hidden no-print'
  toolbar.setAttribute('role', 'toolbar')
  toolbar.setAttribute('aria-label', 'Text formatting toolbar')

  const controls = document.createElement('div')
  controls.className = 'selection-toolbar-controls'
  controls.setAttribute('role', 'group')
  controls.setAttribute('aria-label', 'Text style controls')

  controls.appendChild(
    buildToolbarButton('A-', 'scale-down', 'Decrease text size by 5px')
  )
  controls.appendChild(
    buildToolbarButton('A+', 'scale-up', 'Increase text size by 5px')
  )
  controls.appendChild(buildToolbarButton('B', 'bold', 'Bold'))
  controls.appendChild(buildToolbarButton('I', 'italic', 'Italic'))
  controls.appendChild(buildToolbarButton('U', 'underline', 'Underline'))
  controls.appendChild(buildToolbarButton('S', 'strike', 'Strikethrough'))

  const palette = document.createElement('div')
  palette.className = 'selection-toolbar-palette'
  palette.setAttribute('role', 'group')
  palette.setAttribute('aria-label', 'Highlight color controls')
  for (const option of getHighlightOptions()) {
    const swatch = document.createElement('button')
    swatch.type = 'button'
    swatch.className = `selection-toolbar-swatch swatch-${option.code}`
    swatch.dataset.command = 'highlight'
    swatch.dataset.value = option.code
    swatch.title = `Highlight: ${option.label}`
    swatch.setAttribute('aria-label', `Highlight ${option.label}`)
    palette.appendChild(swatch)
  }

  toolbar.appendChild(controls)
  toolbar.appendChild(palette)

  toolbar.addEventListener('mousedown', (event) => {
    // Keep selection active while using toolbar controls.
    event.preventDefault()
  })
  toolbar.addEventListener('click', handleToolbarCommand)

  document.body.appendChild(toolbar)
  toolbarState.element = toolbar
  return toolbar
}

function refreshToolbarVisibility () {
  ensureToolbar()
  const inlineTarget = getInlineSelectionTarget()
  if (inlineTarget) {
    toolbarState.mode = 'inline'
    toolbarState.inlineTarget = inlineTarget
    toolbarState.classicSelection = null
    showToolbarAtRect(inlineTarget.rect)
    return
  }

  const classicTarget = getClassicSelectionTarget()
  if (classicTarget) {
    toolbarState.mode = 'classic'
    toolbarState.classicSelection = classicTarget
    toolbarState.inlineTarget = null
    showToolbarAtRect(classicTarget.element.getBoundingClientRect())
    return
  }

  hideToolbar()
}

function scheduleToolbarVisibilityRefresh () {
  if (visibilityRefreshRafId) return
  visibilityRefreshRafId = requestAnimationFrame(() => {
    visibilityRefreshRafId = 0
    refreshToolbarVisibility()
  })
}

export function initSelectionToolbar () {
  ensureToolbar()
  document.addEventListener('selectionchange', scheduleToolbarVisibilityRefresh)
  window.addEventListener('scroll', () => {
    if (toolbarState.visible) scheduleToolbarVisibilityRefresh()
  })
  window.addEventListener('resize', () => {
    if (toolbarState.visible) scheduleToolbarVisibilityRefresh()
  })
  document.addEventListener('mousedown', (event) => {
    if (!toolbarState.element?.contains(event.target)) return
    scheduleToolbarVisibilityRefresh()
  })
}

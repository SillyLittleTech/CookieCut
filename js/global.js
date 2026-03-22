import { recipeData } from './state.js'
import { dom } from './dom.js'
import { renderRichText, copyToClipboard } from './helpers.js'
import { COMMON_ICONS } from './constants.js'
import {
  normalizeScale,
  syncScalePreviewSize,
  syncScalePreviewText
} from './handlers/scale.js'
import {
  renderBuilderInputs,
  renderPreview,
  refreshPagedPreviewMetrics
} from './builders/classic.js'
import {
  renderInlinePreview,
  closeImageResizer,
  closeLinkEditor,
  refreshInlinePreviewMetrics
} from './builders/inline.js'
import { initSelectionToolbar } from './toolbar.js'

// --- ACTIONS ---
let nextItemId = Date.now()
let floatingAddMenuCloseHandler = null
let documentTransferMessageTimer = null
const COOKIE_DOCUMENT_VERSION = 1
const VALID_ITEM_TYPES = new Set([
  'heading',
  'step',
  'bullet',
  'text',
  'image',
  'bubble',
  'link'
])
const VALID_BUBBLE_SUBTYPES = new Set(['tip', 'warning', 'note'])
const VALID_INLINE_IMAGE_FLOWS = new Set(['around', 'over', 'under'])
const DEFAULT_RECIPE_SETTINGS = Object.freeze({ ...recipeData.settings })
const PRINT_MODAL_ACTION_PRINT = 'print'
const PRINT_MODAL_ACTION_EXPORT = 'export'
let printModalAction = PRINT_MODAL_ACTION_PRINT

function createItemId () {
  nextItemId = Math.max(nextItemId + 1, Date.now())
  return nextItemId
}

function toStringOrFallback (value, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function toFiniteNumberOrFallback (value, fallback) {
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : fallback
}

function toItemScale (value) {
  return normalizeScale(toFiniteNumberOrFallback(value, 100))
}

function syncNextItemIdToRecipeItems () {
  const maxImportedId = recipeData.items.reduce((maxId, item) => {
    const normalizedId = Number(item?.id)
    if (!Number.isFinite(normalizedId)) return maxId
    return Math.max(maxId, normalizedId)
  }, 0)
  nextItemId = Math.max(nextItemId, maxImportedId)
}

function showDocumentTransferMessage (message, isError = false) {
  if (!dom.documentTransferStatus) return
  dom.documentTransferStatus.textContent = message
  dom.documentTransferStatus.style.color = isError ? '#b91c1c' : '#374151'
  clearTimeout(documentTransferMessageTimer)
  documentTransferMessageTimer = setTimeout(() => {
    if (dom.documentTransferStatus?.textContent === message) {
      dom.documentTransferStatus.textContent = ''
    }
  }, 5000)
}

function normalizeImportedSettings (rawSettings) {
  const source =
    rawSettings && typeof rawSettings === 'object' ? rawSettings : {}
  return {
    ...DEFAULT_RECIPE_SETTINGS,
    ...source,
    fontStyle:
      source.fontStyle === 'serif' || source.fontStyle === 'sans'
        ? source.fontStyle
        : 'display',
    fontApplyToText: Boolean(source.fontApplyToText),
    fontApplyToTips: Boolean(source.fontApplyToTips),
    editorMode: source.editorMode === 'inline' ? 'inline' : 'classic',
    previewMode: source.previewMode === 'paged' ? 'paged' : 'continuous',
    fileName: toStringOrFallback(source.fileName, '')
  }
}

function normalizeImportedItem (rawItem, fallbackId) {
  if (!rawItem || typeof rawItem !== 'object') return null
  const type = toStringOrFallback(rawItem.type, '')
  if (!VALID_ITEM_TYPES.has(type)) return null

  const normalized = {
    ...rawItem,
    id: rawItem.id ?? fallbackId,
    type
  }

  if (type === 'image') {
    const size = toFiniteNumberOrFallback(rawItem.size, 350)
    normalized.src = toStringOrFallback(rawItem.src, '')
    normalized.alt = toStringOrFallback(rawItem.alt, '')
    normalized.size = size
    normalized.inlineWidth = toFiniteNumberOrFallback(
      rawItem.inlineWidth,
      size
    )
    normalized.inlineImageFlow = VALID_INLINE_IMAGE_FLOWS.has(
      rawItem.inlineImageFlow
    )
      ? rawItem.inlineImageFlow
      : 'around'
    return normalized
  }

  normalized.content = toStringOrFallback(rawItem.content, '')

  if (type === 'bubble') {
    normalized.subtype = VALID_BUBBLE_SUBTYPES.has(rawItem.subtype)
      ? rawItem.subtype
      : 'note'
  }
  if (type === 'link') {
    normalized.href = toStringOrFallback(rawItem.href, '')
  }
  normalized.scale = toItemScale(rawItem.scale)
  return normalized
}

function normalizeImportedRecipeData (rawRecipeData) {
  if (!rawRecipeData || typeof rawRecipeData !== 'object') return null

  const fallbackIdBase = Date.now()
  const normalizedItems = Array.isArray(rawRecipeData.items)
    ? rawRecipeData.items
      .map((item, index) =>
        normalizeImportedItem(item, fallbackIdBase + index)
      )
      .filter(Boolean)
    : []

  return {
    title: toStringOrFallback(rawRecipeData.title, ''),
    description: toStringOrFallback(rawRecipeData.description, ''),
    items: normalizedItems,
    settings: normalizeImportedSettings(rawRecipeData.settings)
  }
}

function isSafeExportFileNameChar (char) {
  const code = char.codePointAt(0)
  if (!Number.isFinite(code)) return false
  if (code >= 48 && code <= 57) return true // 0-9
  if (code >= 65 && code <= 90) return true // A-Z
  if (code >= 97 && code <= 122) return true // a-z
  return char === '_' || char === '-' || char === '.'
}

function getExportFileNameBase (preferredNameInput = '') {
  const explicitName = toStringOrFallback(preferredNameInput, '').trim()
  const fallbackName = toStringOrFallback(
    recipeData.settings.fileName,
    recipeData.title
  ).trim()
  const preferredName = explicitName || fallbackName
  let safeName = ''
  let previousWasUnderscore = false
  for (const char of preferredName) {
    if (isSafeExportFileNameChar(char)) {
      safeName += char
      previousWasUnderscore = false
      continue
    }
    if (!previousWasUnderscore) {
      safeName += '_'
      previousWasUnderscore = true
    }
  }
  while (safeName.startsWith('_')) {
    safeName = safeName.slice(1)
  }
  while (safeName.endsWith('_')) {
    safeName = safeName.slice(0, -1)
  }
  return safeName || 'cookiecut_document'
}

function buildDocumentPayload () {
  return {
    app: 'CookieCut',
    format: 'cookie_document',
    version: COOKIE_DOCUMENT_VERSION,
    exportedAt: new Date().toISOString(),
    recipeData: {
      title: recipeData.title,
      description: recipeData.description,
      items: recipeData.items.map((item) => ({ ...item })),
      settings: { ...recipeData.settings }
    }
  }
}

function exportDocumentFile (preferredFileName = '') {
  const payloadText = JSON.stringify(buildDocumentPayload(), null, 2)
  const blob = new Blob([payloadText], { type: 'application/json' })
  const objectUrl = URL.createObjectURL(blob)
  const linkEl = document.createElement('a')
  const exportFileName = `${getExportFileNameBase(preferredFileName)}.cookie`
  linkEl.href = objectUrl
  linkEl.download = exportFileName
  document.body.appendChild(linkEl)
  linkEl.click()
  linkEl.remove()
  URL.revokeObjectURL(objectUrl)
  showDocumentTransferMessage(`Exported ${exportFileName}`)
}

function readTextFile (file) {
  return file.text()
}

function syncUiFromRecipeData () {
  renderBuilderInputs()
  dom.titleInput.value = recipeData.title
  dom.descInput.value = recipeData.description
  dom.titlePreview.innerHTML = renderRichText(recipeData.title)
  dom.descPreview.innerHTML = renderRichText(recipeData.description)

  if (dom.globalFontStyleSelect) {
    dom.globalFontStyleSelect.value = recipeData.settings.fontStyle
  }
  if (dom.editorModeSelect) {
    dom.editorModeSelect.value = recipeData.settings.editorMode
  }
  if (dom.previewModeSelect) {
    dom.previewModeSelect.value = recipeData.settings.previewMode
  }

  dom.titlePreview.className = `font-style-${recipeData.settings.fontStyle}`
  setEditorMode(recipeData.settings.editorMode)

  if (isInlineMode()) {
    renderInlinePreview()
  } else if (!dom.recipePanel.classList.contains('hidden')) {
    renderPreview()
  }
  updateAppLayoutForPreviewMode()
}

async function importDocumentFile (file) {
  const rawText = await readTextFile(file)
  const parsedPayload = JSON.parse(rawText)
  const payloadRecipeData =
    parsedPayload &&
    typeof parsedPayload === 'object' &&
    parsedPayload.recipeData
      ? parsedPayload.recipeData
      : parsedPayload

  const normalizedRecipeData = normalizeImportedRecipeData(payloadRecipeData)
  if (!normalizedRecipeData) {
    throw new Error('Invalid CookieCut document format.')
  }

  recipeData.title = normalizedRecipeData.title
  recipeData.description = normalizedRecipeData.description
  recipeData.items = normalizedRecipeData.items
  recipeData.settings = normalizedRecipeData.settings
  syncNextItemIdToRecipeItems()
  syncUiFromRecipeData()
  showDocumentTransferMessage(`Imported ${file.name}`)
}

export function addItem (type, subtype = null) {
  const newItem = { id: createItemId() }
  switch (type) {
    case 'heading':
      newItem.type = 'heading'
      newItem.content = 'New Heading'
      newItem.scale = 100
      break
    case 'step':
    case 'bullet':
      newItem.type = type
      newItem.content = ''
      newItem.scale = 100
      break
    case 'text':
      newItem.type = 'text'
      newItem.content = ''
      newItem.scale = 100
      break
    case 'image':
      newItem.type = 'image'
      newItem.src = ''
      newItem.alt = ''
      newItem.size = 350
      newItem.inlineWidth = 350
      newItem.inlineImageFlow = 'around'
      break
    case 'bubble':
      newItem.type = 'bubble'
      newItem.subtype = subtype || 'note'
      newItem.content = ''
      newItem.scale = 100
      break
    case 'link':
      newItem.type = 'link'
      newItem.content = ''
      newItem.href = ''
      newItem.scale = 100
      break
    default:
      break
  }
  recipeData.items.push(newItem)
  renderBuilderInputs()

  const newEl = dom.contentInputs.querySelector(`[data-id="${newItem.id}"]`)
  if (newEl) {
    const input = newEl.querySelector('input, textarea')
    if (input) input.focus()
  }
}

function moveItem (id, direction) {
  const index = recipeData.items.findIndex((i) => String(i.id) === String(id))
  if (direction === 'up' && index > 0) {
    [recipeData.items[index], recipeData.items[index - 1]] = [
      recipeData.items[index - 1],
      recipeData.items[index]
    ]
  } else if (direction === 'down' && index < recipeData.items.length - 1) {
    [recipeData.items[index], recipeData.items[index + 1]] = [
      recipeData.items[index + 1],
      recipeData.items[index]
    ]
  }
}

// --- MODE HELPERS ---

function isInlineMode () {
  return recipeData.settings && recipeData.settings.editorMode === 'inline'
}

function closeFloatingAddMenu () {
  const menu = document.getElementById('floating-add-menu')
  if (menu) menu.remove()

  if (floatingAddMenuCloseHandler) {
    document.removeEventListener('click', floatingAddMenuCloseHandler)
    floatingAddMenuCloseHandler = null
  }
}

function toggleOldUIVisibility (hide) {
  // Hide most of the old controls when inline mode is active,
  // but keep the badges (icon-key-btn) and settings (settings-btn).
  const elementsToToggle = [
    dom.addTextBtn,
    dom.addImageBtn,
    dom.addToastBtn,
    dom.previewBtn,
    dom.editBtn,
    dom.printBtn,
    dom.contentInputs,
    dom.titleInput,
    dom.descInput
  ]
  // Also hide the labels for the title/description inputs
  const titleLabel = document.querySelector('label[for="recipe-title-input"]')
  const descLabel = document.querySelector('label[for="recipe-desc-input"]')
  if (titleLabel) elementsToToggle.push(titleLabel)
  if (descLabel) elementsToToggle.push(descLabel)

  elementsToToggle.forEach((el) => {
    if (!el) return
    if (hide) el.classList.add('hidden')
    else el.classList.remove('hidden')
  })
}

export function enableInlineEditor () {
  if (dom.inlinePreview) dom.inlinePreview.classList.remove('hidden')
  if (dom.floatingAddBtn) dom.floatingAddBtn.classList.remove('hidden')
  toggleOldUIVisibility(true)
  try {
    renderInlinePreview()
  } catch (err) {
    console.error(
      'Inline preview render failed while enabling inline mode:',
      err
    )
    // Fall back to classic editor so the user is not left with a broken inline UI.
    try {
      setEditorMode('classic')
    } catch (fallbackErr) {
      console.error(
        'Failed to fall back to classic editor mode after inline render failure:',
        fallbackErr
      )
      // As a last resort, at least restore the classic UI visibility.
      disableInlineEditor()
    }
  }
}

export function disableInlineEditor () {
  if (dom.inlinePreview) {
    dom.inlinePreview.classList.add('hidden')
    // Reset mode-specific inline preview classes so .hidden always wins.
    dom.inlinePreview.classList.remove(
      'inline-content-surface',
      'inline-paged-preview-active'
    )
  }
  if (dom.floatingAddBtn) dom.floatingAddBtn.classList.add('hidden')
  closeFloatingAddMenu()
  closeImageResizer()
  closeLinkEditor()
  toggleOldUIVisibility(false)
}

function setEditorMode (mode) {
  const normalizedMode = mode === 'inline' ? 'inline' : 'classic'
  recipeData.settings.editorMode = normalizedMode
  if (dom.editorModeSelect && dom.editorModeSelect.value !== normalizedMode) {
    dom.editorModeSelect.value = normalizedMode
  }
  if (normalizedMode === 'inline') enableInlineEditor()
  else disableInlineEditor()
}

// --- VIEW TOGGLE ---

function updateAppLayoutForPreviewMode () {
  if (!dom.appContainer) return

  const isPagedPreviewVisible =
    !dom.recipePanel.classList.contains('hidden') &&
    recipeData.settings.previewMode === 'paged'

  dom.appContainer.classList.toggle(
    'paged-preview-shell',
    isPagedPreviewVisible
  )
}

function showPreview () {
  renderPreview()
  dom.builderPanel.classList.add('hidden')
  dom.recipePanel.classList.remove('hidden')
  updateAppLayoutForPreviewMode()
  window.scrollTo(0, 0)
}

function showEditor () {
  dom.builderPanel.classList.remove('hidden')
  dom.recipePanel.classList.add('hidden')
  updateAppLayoutForPreviewMode()
  window.scrollTo(0, 0)
}

// --- PRINT ---

function executePrint (fileName) {
  const isInline = isInlineMode()
  if (isInline) document.body.classList.add('print-inline-only')
  else document.body.classList.add('print-recipe-only')

  const originalTitle = document.title
  const printTitle = fileName?.trim() || recipeData.title || originalTitle
  document.title = printTitle

  function cleanup () {
    document.title = originalTitle
    document.body.classList.remove('print-inline-only', 'print-recipe-only')
    window.removeEventListener('afterprint', cleanup)
  }

  window.addEventListener('afterprint', cleanup)
  window.print()
  setTimeout(cleanup, 1500)
}

function updatePrintModalContentForAction (action) {
  if (dom.printModalTitle) {
    dom.printModalTitle.textContent =
      action === PRINT_MODAL_ACTION_EXPORT
        ? 'Export .cookie'
        : 'Print / Download'
  }
  if (dom.printFileNameHelp) {
    dom.printFileNameHelp.textContent =
      action === PRINT_MODAL_ACTION_EXPORT
        ? 'Sets the filename for your .cookie export. Defaults to the recipe title if left blank.'
        : 'Sets the suggested filename when saving as PDF. Defaults to the recipe title if left blank.'
  }
  if (dom.confirmPrintBtn) {
    const isExport = action === PRINT_MODAL_ACTION_EXPORT
    dom.confirmPrintBtn.textContent = isExport
      ? 'Export .cookie'
      : 'Print Recipe'
    dom.confirmPrintBtn.classList.toggle('bg-red-600', !isExport)
    dom.confirmPrintBtn.classList.toggle('hover:bg-red-700', !isExport)
    dom.confirmPrintBtn.classList.toggle('bg-indigo-600', isExport)
    dom.confirmPrintBtn.classList.toggle('hover:bg-indigo-700', isExport)
  }
}

function openPrintModal (action = PRINT_MODAL_ACTION_PRINT) {
  printModalAction =
    action === PRINT_MODAL_ACTION_EXPORT
      ? PRINT_MODAL_ACTION_EXPORT
      : PRINT_MODAL_ACTION_PRINT
  updatePrintModalContentForAction(printModalAction)
  if (dom.printFileNameInput) {
    dom.printFileNameInput.value = recipeData.settings.fileName || ''
  }
  dom.printModal.classList.remove('hidden')
}

function closePrintModal () {
  dom.printModal.classList.add('hidden')
}

function handlePrint () {
  openPrintModal(PRINT_MODAL_ACTION_PRINT)
}

function handleExportRequest () {
  openPrintModal(PRINT_MODAL_ACTION_EXPORT)
}

// --- MAIN INPUT HANDLERS ---

function handleUpdateMain (e) {
  recipeData[e.target.id === 'recipe-title-input' ? 'title' : 'description'] =
    e.target.value
}

function handleLiveInput (e) {
  const itemEl = e.target.closest('[data-id]')
  if (!itemEl) return

  const id = itemEl.dataset.id
  const key = e.target.dataset.key
  const value = e.target.value
  const item = recipeData.items.find((i) => String(i.id) === String(id))

  if (!item || !key) return

  item[key] = value

  // If it's the size slider, also update the live pixel display
  if (key === 'size') {
    if (item.type === 'image') {
      item.inlineWidth = Number(value)
    }
    const display = itemEl.querySelector('[data-role="size-display"]')
    if (display) {
      display.textContent = `${value}px`
    }
  }

  if (key === 'content') {
    const previewText =
      item.type === 'link' ? value.trim() || item.href || '' : value
    syncScalePreviewText(itemEl, previewText)
  }

  // If it's the scale slider, update the percentage display and live preview sample
  if (key === 'scale') {
    const normalizedScale = normalizeScale(value)
    item.scale = normalizedScale
    if (e.target.value !== String(normalizedScale)) {
      e.target.value = String(normalizedScale)
    }
    syncScalePreviewSize(itemEl, normalizedScale)
  }

  if (key === 'href' && (!item.content || item.content.trim() === '')) {
    syncScalePreviewText(itemEl, item.href || '')
  }

  if (
    isInlineMode() &&
    item.type === 'image' &&
    ['size', 'src', 'alt', 'inlineImageFlow'].includes(key)
  ) {
    renderInlinePreview()
  }
}

function handleContentInputClick (e) {
  const itemEl = e.target.closest('[data-id]')
  if (!itemEl) return

  const id = itemEl.dataset.id

  const deleteBtn = e.target.closest('.delete-btn')
  const moveUpBtn = e.target.closest('.move-up-btn')
  const moveDownBtn = e.target.closest('.move-down-btn')

  let actionTaken = false

  if (deleteBtn) {
    recipeData.items = recipeData.items.filter(
      (i) => String(i.id) !== String(id)
    )
    actionTaken = true
  } else if (moveUpBtn) {
    moveItem(id, 'up')
    actionTaken = true
  } else if (moveDownBtn) {
    moveItem(id, 'down')
    actionTaken = true
  }

  if (actionTaken) {
    renderBuilderInputs()
    if (isInlineMode()) renderInlinePreview()
  }
}

// --- MODAL FUNCTIONS ---

function openToastModal () {
  dom.toastModal.classList.remove('hidden')
}
function closeToastModal () {
  dom.toastModal.classList.add('hidden')
}
function handleToastSelection (subtype) {
  closeToastModal()
  addItem('bubble', subtype)
}

function openTextModal () {
  dom.textModal.classList.remove('hidden')
}
function closeTextModal () {
  dom.textModal.classList.add('hidden')
}
function handleTextSelection (type) {
  closeTextModal()
  addItem(type)
}

function openIconKeyModal () {
  renderIconList()
  dom.iconKeyModal.classList.remove('hidden')
  dom.iconSearchInput.focus()
}
function closeIconKeyModal () {
  dom.iconKeyModal.classList.add('hidden')
  dom.iconSearchInput.value = ''
}

function renderIconList (filter = '') {
  dom.iconListContainer.innerHTML = ''
  const lowerFilter = filter.toLowerCase()
  const filteredIcons = COMMON_ICONS.filter((icon) =>
    icon.includes(lowerFilter)
  )

  if (filteredIcons.length === 0) {
    dom.iconListContainer.innerHTML =
      '<p class="text-gray-500 italic">No icons found.</p>'
    return
  }

  filteredIcons.forEach((icon) => {
    const code = `:${icon}:`
    const el = document.createElement('div')
    el.className =
      'flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg transition-colors duration-100'
    el.innerHTML = `
            <span class="material-icons text-gray-700">${icon}</span>
            <code class="text-sm text-gray-900 font-mono">${code}</code>
            <button class="copy-icon-btn ml-auto text-xs font-medium bg-blue-100 hover:bg-blue-200 text-blue-700 py-1 px-2 rounded-md transition-all duration-150 active:scale-95" data-code="${code}">Copy</button>
        `
    dom.iconListContainer.appendChild(el)
  })
}

function handleIconListClick (e) {
  const copyBtn = e.target.closest('.copy-icon-btn')
  if (copyBtn) {
    const code = copyBtn.dataset.code
    copyToClipboard(code)
    copyBtn.textContent = 'Copied!'
    copyBtn.classList.add('bg-green-200', 'text-green-800')
    setTimeout(() => {
      copyBtn.textContent = 'Copy'
      copyBtn.classList.remove('bg-green-200', 'text-green-800')
    }, 1500)
  }
}

function openSettingsModal () {
  dom.globalFontStyleSelect.value = recipeData.settings.fontStyle
  if (dom.fontApplyTextCheckbox) {
    dom.fontApplyTextCheckbox.checked = Boolean(
      recipeData.settings.fontApplyToText
    )
  }
  if (dom.fontApplyTipsCheckbox) {
    dom.fontApplyTipsCheckbox.checked = Boolean(
      recipeData.settings.fontApplyToTips
    )
  }
  if (dom.editorModeSelect) {
    dom.editorModeSelect.value = recipeData.settings.editorMode || 'classic'
  }
  if (dom.previewModeSelect) {
    dom.previewModeSelect.value =
      recipeData.settings.previewMode || 'continuous'
  }
  dom.settingsModal.classList.remove('hidden')
}
function closeSettingsModal () {
  dom.settingsModal.classList.add('hidden')
}
function handleGlobalFontChange (e) {
  recipeData.settings.fontStyle = e.target.value
  dom.titlePreview.className = `font-style-${recipeData.settings.fontStyle}`
  if (isInlineMode()) {
    renderInlinePreview()
  } else if (!dom.recipePanel.classList.contains('hidden')) {
    renderPreview()
  }
}

function handleFontScopeChange () {
  recipeData.settings.fontApplyToText = dom.fontApplyTextCheckbox
    ? dom.fontApplyTextCheckbox.checked
    : false
  recipeData.settings.fontApplyToTips = dom.fontApplyTipsCheckbox
    ? dom.fontApplyTipsCheckbox.checked
    : false
  if (isInlineMode()) {
    renderInlinePreview()
  } else if (!dom.recipePanel.classList.contains('hidden')) {
    renderPreview()
  }
}

function handlePreviewModeChange (e) {
  const nextMode = e.target.value === 'paged' ? 'paged' : 'continuous'
  recipeData.settings.previewMode = nextMode
  if (isInlineMode()) {
    renderInlinePreview()
    return
  }
  if (!dom.recipePanel.classList.contains('hidden')) {
    renderPreview()
    updateAppLayoutForPreviewMode()
  }
}

// --- INIT ---

export function init () {
  if (!recipeData.settings.previewMode) {
    recipeData.settings.previewMode = 'continuous'
  }

  // Main info
  dom.titleInput.addEventListener('input', handleUpdateMain)
  dom.descInput.addEventListener('input', handleUpdateMain)

  // "Add" buttons
  dom.addTextBtn.addEventListener('click', openTextModal)
  dom.addImageBtn.addEventListener('click', () => addItem('image'))
  dom.addToastBtn.addEventListener('click', openToastModal)
  if (dom.exportDocBtn) {
    dom.exportDocBtn.addEventListener('click', () => {
      handleExportRequest()
    })
  }
  if (dom.importDocBtn && dom.importDocInput) {
    dom.importDocBtn.addEventListener('click', () => {
      dom.importDocInput.click()
    })
    dom.importDocInput.addEventListener('change', async (event) => {
      const selectedFile = event.target.files?.[0]
      event.target.value = ''
      if (!selectedFile) return
      try {
        await importDocumentFile(selectedFile)
      } catch (error) {
        console.error('Failed to import CookieCut document:', error)
        showDocumentTransferMessage(
          'Could not import that file. Please choose a valid .cookie document exported from CookieCut.',
          true
        )
      }
    })
  }

  // Toast Modal Listeners
  dom.closeModalBtn.addEventListener('click', closeToastModal)
  dom.toastModalOverlay.addEventListener('click', closeToastModal)
  dom.toastTypeTipBtn.addEventListener('click', () =>
    handleToastSelection('tip')
  )
  dom.toastTypeWarningBtn.addEventListener('click', () =>
    handleToastSelection('warning')
  )
  dom.toastTypeNoteBtn.addEventListener('click', () =>
    handleToastSelection('note')
  )

  // Text Modal Listeners
  dom.closeTextModalBtn.addEventListener('click', closeTextModal)
  dom.textModalOverlay.addEventListener('click', closeTextModal)
  dom.textTypeHeadingBtn.addEventListener('click', () =>
    handleTextSelection('heading')
  )
  dom.textTypeStepBtn.addEventListener('click', () =>
    handleTextSelection('step')
  )
  dom.textTypeBulletBtn.addEventListener('click', () =>
    handleTextSelection('bullet')
  )
  dom.textTypeTextBtn.addEventListener('click', () =>
    handleTextSelection('text')
  )
  dom.textTypeLinkBtn.addEventListener('click', () =>
    handleTextSelection('link')
  )

  // Icon Key Modal Listeners
  dom.iconKeyBtn.addEventListener('click', openIconKeyModal)
  dom.closeIconKeyModalBtn.addEventListener('click', closeIconKeyModal)
  dom.iconKeyModalOverlay.addEventListener('click', closeIconKeyModal)
  dom.iconSearchInput.addEventListener('input', (e) =>
    renderIconList(e.target.value)
  )
  dom.iconListContainer.addEventListener('click', handleIconListClick)

  // Settings Modal Listeners
  dom.settingsBtn.addEventListener('click', openSettingsModal)
  dom.closeSettingsModalBtn.addEventListener('click', closeSettingsModal)
  dom.settingsModalOverlay.addEventListener('click', closeSettingsModal)
  dom.globalFontStyleSelect.addEventListener('change', handleGlobalFontChange)
  if (dom.fontApplyTextCheckbox) {
    dom.fontApplyTextCheckbox.addEventListener('change', handleFontScopeChange)
  }
  if (dom.fontApplyTipsCheckbox) {
    dom.fontApplyTipsCheckbox.addEventListener('change', handleFontScopeChange)
  }

  // Print Modal Listeners
  dom.closePrintModalBtn.addEventListener('click', closePrintModal)
  dom.printModalOverlay.addEventListener('click', closePrintModal)
  dom.cancelPrintBtn.addEventListener('click', closePrintModal)
  dom.confirmPrintBtn.addEventListener('click', () => {
    const fileName = dom.printFileNameInput ? dom.printFileNameInput.value : ''
    recipeData.settings.fileName = fileName
    closePrintModal()
    if (printModalAction === PRINT_MODAL_ACTION_EXPORT) {
      exportDocumentFile(fileName)
      return
    }
    executePrint(fileName)
  })
  if (dom.printFileNameInput) {
    dom.printFileNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        dom.confirmPrintBtn.click()
      }
      if (e.key === 'Escape') closePrintModal()
    })
  }

  // Editor Mode select
  if (dom.editorModeSelect) {
    dom.editorModeSelect.addEventListener('change', (e) => {
      setEditorMode(e.target.value)
    })
    dom.editorModeSelect.value = recipeData.settings.editorMode || 'classic'
  }
  if (dom.previewModeSelect) {
    dom.previewModeSelect.addEventListener('change', handlePreviewModeChange)
    dom.previewModeSelect.value =
      recipeData.settings.previewMode || 'continuous'
  }

  updateAppLayoutForPreviewMode()

  // Floating add button behavior
  if (dom.floatingAddBtn) {
    dom.floatingAddBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      let menu = document.getElementById('floating-add-menu')
      if (menu) {
        menu.remove()
        return
      }
      menu = document.createElement('div')
      menu.id = 'floating-add-menu'
      menu.style.position = 'fixed'
      menu.style.right = '96px'
      menu.style.bottom = '24px'
      menu.style.zIndex = 70
      menu.style.background = 'white'
      menu.style.padding = '8px'
      menu.style.borderRadius = '8px'
      menu.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)'

      const makeBtn = (label, cb) => {
        const buttonEl = document.createElement('button')
        buttonEl.textContent = label
        buttonEl.className = 'px-3 py-2 block w-full text-left'
        buttonEl.addEventListener('click', () => {
          cb()
          menu.remove()
        })
        return buttonEl
      }

      menu.appendChild(makeBtn('Add Text', () => openTextModal()))
      menu.appendChild(makeBtn('Add Image', () => addItem('image')))
      menu.appendChild(makeBtn('Add Toast', () => openToastModal()))
      menu.appendChild(makeBtn('Print', () => handlePrint()))

      document.body.appendChild(menu)
      // click outside to close
      setTimeout(() => {
        document.addEventListener('click', function _close (ev) {
          const menuEl = document.getElementById('floating-add-menu')
          if (
            menuEl &&
            !menuEl.contains(ev.target) &&
            ev.target !== dom.floatingAddBtn
          ) {
            menuEl.remove()
          }
          document.removeEventListener('click', _close)
        })
      }, 10)
    })
  }

  // Dynamic item handlers
  dom.contentInputs.addEventListener('input', handleLiveInput)
  dom.contentInputs.addEventListener('click', handleContentInputClick)
  initSelectionToolbar()

  // View Toggle Listeners
  dom.previewBtn.addEventListener('click', showPreview)
  dom.editBtn.addEventListener('click', showEditor)
  dom.printBtn.addEventListener('click', () => handlePrint())

  let previewResizeTimer = null
  window.addEventListener('resize', () => {
    const inPagedClassicPreview =
      !dom.recipePanel.classList.contains('hidden') &&
      recipeData.settings.previewMode === 'paged'
    const inPagedInlinePreview =
      isInlineMode() && recipeData.settings.previewMode === 'paged'
    if (!inPagedClassicPreview && !inPagedInlinePreview) return
    clearTimeout(previewResizeTimer)
    previewResizeTimer = setTimeout(() => {
      if (inPagedClassicPreview) refreshPagedPreviewMetrics()
      if (inPagedInlinePreview) refreshInlinePreviewMetrics()
    }, 120)
  })

  // Initial render
  renderBuilderInputs()
  dom.titleInput.value = recipeData.title
  dom.descInput.value = recipeData.description
  dom.titlePreview.innerHTML = renderRichText(recipeData.title)
  dom.descPreview.innerHTML = renderRichText(recipeData.description)
  dom.globalFontStyleSelect.value = recipeData.settings.fontStyle
  dom.titlePreview.className = `font-style-${recipeData.settings.fontStyle}`
  // Initialize editor mode (inline is experimental and OFF by default)
  setEditorMode(recipeData.settings.editorMode)
}

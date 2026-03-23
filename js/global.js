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
import {
  tabsState,
  saveCurrentTabSnapshot,
  createTab,
  switchToTab,
  closeTab,
  renameTab,
  initTabsState,
  persistTabsToCache,
  restoreTabsFromCache
} from './tabs.js'

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
const TEMPLATE_SLOT_COUNT = 12
const TEMPLATE_SLOT_STORAGE_PREFIX = 'cookiecut_template_slot_'
const TEMPLATE_SLOT_COOKIE_PREFIX = 'cookiecut_template_slot_'
const TEMPLATE_SLOT_COOKIE_MAX_CHARS = 3600
const WORKING_DOCUMENT_STORAGE_KEY = 'cookiecut_working_document'
const WORKING_DOCUMENT_COOKIE_KEY = 'cookiecut_working_document'
const WORKING_DOCUMENT_COOKIE_MAX_CHARS = 3600
const KEYSTROKES_PER_AUTOSAVE = 3
const HISTORY_LIMIT = 5
const HISTORY_OBSERVER_INTERVAL_MS = 250
const BUILTIN_TEMPLATE_SLOTS = Object.freeze([
  {
    slot: 1,
    name: 'All Item Types',
    subtitle: 'One sample for every item type',
    path: 'templates/default/all-items.cookie'
  },
  {
    slot: 2,
    name: 'Heading Starter',
    subtitle: 'Single heading block',
    path: 'templates/default/heading.cookie'
  },
  {
    slot: 3,
    name: 'Step Starter',
    subtitle: 'Single numbered step',
    path: 'templates/default/step.cookie'
  },
  {
    slot: 4,
    name: 'Bullet Starter',
    subtitle: 'Single bullet point',
    path: 'templates/default/bullet.cookie'
  },
  {
    slot: 5,
    name: 'Text Starter',
    subtitle: 'Single paragraph block',
    path: 'templates/default/text.cookie'
  },
  {
    slot: 6,
    name: 'Image Starter',
    subtitle: 'Single image block',
    path: 'templates/default/image.cookie'
  },
  {
    slot: 7,
    name: 'Toast Starter',
    subtitle: 'Single note/tip block',
    path: 'templates/default/bubble.cookie'
  },
  {
    slot: 8,
    name: 'Link Starter',
    subtitle: 'Single link block',
    path: 'templates/default/link.cookie'
  }
])
let printModalAction = PRINT_MODAL_ACTION_PRINT
let templateGalleryMessageTimer = null
let autosaveKeystrokeCounter = 0
let undoHistory = []
let redoHistory = []
let lastTrackedRecipeSnapshot = ''
let isApplyingHistorySnapshot = false
let historyObserverTimerId = null

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

function showTemplateGalleryMessage (message, isError = false) {
  if (!dom.templateGalleryStatus) return
  dom.templateGalleryStatus.textContent = message
  dom.templateGalleryStatus.style.color = isError ? '#b91c1c' : '#334155'
  clearTimeout(templateGalleryMessageTimer)
  templateGalleryMessageTimer = setTimeout(() => {
    if (dom.templateGalleryStatus?.textContent === message) {
      dom.templateGalleryStatus.textContent = ''
    }
  }, 5000)
}

function createRecipeSnapshot () {
  return {
    title: recipeData.title,
    description: recipeData.description,
    items: recipeData.items.map((item) => ({ ...item })),
    settings: { ...recipeData.settings }
  }
}

function serializeRecipeSnapshot (snapshot) {
  return JSON.stringify(snapshot)
}

function getCurrentRecipeSnapshotSerialized () {
  return serializeRecipeSnapshot(createRecipeSnapshot())
}

function resetHistoryTracking () {
  undoHistory = []
  redoHistory = []
  lastTrackedRecipeSnapshot = getCurrentRecipeSnapshotSerialized()
}

function observeRecipeMutations () {
  const currentSnapshotSerialized = getCurrentRecipeSnapshotSerialized()
  if (isApplyingHistorySnapshot) {
    lastTrackedRecipeSnapshot = currentSnapshotSerialized
    return
  }
  if (!lastTrackedRecipeSnapshot) {
    lastTrackedRecipeSnapshot = currentSnapshotSerialized
    return
  }
  if (currentSnapshotSerialized === lastTrackedRecipeSnapshot) return

  try {
    undoHistory.push(JSON.parse(lastTrackedRecipeSnapshot))
    if (undoHistory.length > HISTORY_LIMIT) undoHistory.shift()
  } catch {
    // Ignore invalid historical snapshot payloads.
  }
  redoHistory = []
  lastTrackedRecipeSnapshot = currentSnapshotSerialized
}

function startHistoryObserver () {
  if (historyObserverTimerId) return
  const runMutationObserver = () => {
    if (typeof document.hasFocus === 'function' && !document.hasFocus()) return
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(
        () => {
          observeRecipeMutations()
        },
        { timeout: HISTORY_OBSERVER_INTERVAL_MS }
      )
      return
    }
    observeRecipeMutations()
  }
  historyObserverTimerId = setInterval(
    runMutationObserver,
    HISTORY_OBSERVER_INTERVAL_MS
  )
}

function applyRecipeSnapshot (snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return
  isApplyingHistorySnapshot = true
  recipeData.title = toStringOrFallback(snapshot.title, '')
  recipeData.description = toStringOrFallback(snapshot.description, '')
  recipeData.items = Array.isArray(snapshot.items)
    ? snapshot.items.map((item) => ({ ...item }))
    : []
  recipeData.settings = normalizeImportedSettings(snapshot.settings)
  syncNextItemIdToRecipeItems()
  syncUiFromRecipeData()
  isApplyingHistorySnapshot = false
  lastTrackedRecipeSnapshot = getCurrentRecipeSnapshotSerialized()
}

function handleUndoAction () {
  if (!undoHistory.length) return false
  const currentSnapshot = createRecipeSnapshot()
  redoHistory.push(currentSnapshot)
  if (redoHistory.length > HISTORY_LIMIT) redoHistory.shift()
  const priorSnapshot = undoHistory.pop()
  applyRecipeSnapshot(priorSnapshot)
  persistWorkingDocumentToCache()
  showDocumentTransferMessage('Undo applied.')
  return true
}

function handleRedoAction () {
  if (!redoHistory.length) return false
  const currentSnapshot = createRecipeSnapshot()
  undoHistory.push(currentSnapshot)
  if (undoHistory.length > HISTORY_LIMIT) undoHistory.shift()
  const nextSnapshot = redoHistory.pop()
  applyRecipeSnapshot(nextSnapshot)
  persistWorkingDocumentToCache()
  showDocumentTransferMessage('Redo applied.')
  return true
}

function isEditableKeyTarget (event) {
  const target = event.target
  if (!target || target === document.body) return false
  const element =
    target.nodeType === Node.TEXT_NODE ? target.parentElement : target
  if (element?.nodeType !== Node.ELEMENT_NODE) return false
  if (element.isContentEditable) return true
  if (element.matches('input, textarea')) return true
  return Boolean(element.closest('[contenteditable="true"]'))
}

function isMeaningfulKeystroke (event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return false
  if (event.key.length === 1) return true
  return ['Backspace', 'Delete', 'Enter', 'Tab'].includes(event.key)
}

function getTemplateSlotStorageKey (slot) {
  return `${TEMPLATE_SLOT_STORAGE_PREFIX}${slot}`
}

function getTemplateSlotCookieKey (slot) {
  return `${TEMPLATE_SLOT_COOKIE_PREFIX}${slot}`
}

function safeLocalStorageGet (key) {
  try {
    return globalThis.localStorage?.getItem(key) || ''
  } catch {
    return ''
  }
}

function safeLocalStorageSet (key, value) {
  try {
    globalThis.localStorage?.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function safeLocalStorageRemove (key) {
  try {
    globalThis.localStorage?.removeItem(key)
    return true
  } catch {
    return false
  }
}

function setCookieValue (name, value) {
  document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`
}

function removeCookieValue (name) {
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`
}

function getCookieValue (name) {
  const cookieParts = document.cookie ? document.cookie.split('; ') : []
  const encodedPrefix = `${name}=`
  for (const part of cookieParts) {
    if (part.startsWith(encodedPrefix)) {
      return part.slice(encodedPrefix.length)
    }
  }
  return ''
}

function saveJsonCookie (name, payloadObject, maxChars) {
  const payloadText = JSON.stringify(payloadObject)
  const encoded = encodeURIComponent(payloadText)
  if (encoded.length <= maxChars) {
    setCookieValue(name, encoded)
    return true
  }
  const fallback = encodeURIComponent(
    JSON.stringify({
      truncated: true,
      savedAt: new Date().toISOString()
    })
  )
  setCookieValue(name, fallback)
  return false
}

function clearWorkingDocumentCache () {
  safeLocalStorageRemove(WORKING_DOCUMENT_STORAGE_KEY)
  removeCookieValue(WORKING_DOCUMENT_COOKIE_KEY)
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

function parseImportedRecipeDataText (rawText) {
  const parsedPayload = JSON.parse(rawText)
  const payloadRecipeData =
    parsedPayload &&
    typeof parsedPayload === 'object' &&
    parsedPayload.recipeData
      ? parsedPayload.recipeData
      : parsedPayload
  return normalizeImportedRecipeData(payloadRecipeData)
}

function applyNormalizedRecipeData (normalizedRecipeData) {
  recipeData.title = normalizedRecipeData.title
  recipeData.description = normalizedRecipeData.description
  recipeData.items = normalizedRecipeData.items
  recipeData.settings = normalizedRecipeData.settings
  syncNextItemIdToRecipeItems()
  syncUiFromRecipeData()
}

function persistWorkingDocumentToCache () {
  persistTabsToCache()
  const payload = buildDocumentPayload()
  const payloadText = JSON.stringify(payload)
  safeLocalStorageSet(WORKING_DOCUMENT_STORAGE_KEY, payloadText)
  saveJsonCookie(
    WORKING_DOCUMENT_COOKIE_KEY,
    {
      type: 'working_document',
      payload
    },
    WORKING_DOCUMENT_COOKIE_MAX_CHARS
  )
}

function restoreWorkingDocumentFromCache () {
  // Try tabs state first (highest priority — restores multi-document session)
  const tabsRecipeData = restoreTabsFromCache()
  if (tabsRecipeData) {
    try {
      const normalized = normalizeImportedRecipeData(tabsRecipeData)
      if (normalized) {
        applyNormalizedRecipeData(normalized)
        renderTabBar()
        showDocumentTransferMessage('Recovered session from local autosave.')
        return true
      }
    } catch {
      // Fall through to single-document fallbacks.
    }
    // Reset invalid tabs state before falling through.
    tabsState.tabs = []
    tabsState.activeTabId = null
  }

  // Fall back to old single-document working document key.
  const cachedText = safeLocalStorageGet(WORKING_DOCUMENT_STORAGE_KEY)
  if (cachedText) {
    try {
      const normalizedRecipeData = parseImportedRecipeDataText(cachedText)
      if (normalizedRecipeData) {
        initTabsState(normalizedRecipeData)
        applyNormalizedRecipeData(normalizedRecipeData)
        renderTabBar()
        showDocumentTransferMessage(
          'Recovered document from local autosave cache.'
        )
        return true
      }
    } catch {
      // Ignore invalid cached local-storage data.
    }
  }

  const cookieValue = getCookieValue(WORKING_DOCUMENT_COOKIE_KEY)
  if (!cookieValue) {
    initTabsState()
    renderTabBar()
    return false
  }

  try {
    const parsedCookie = JSON.parse(decodeURIComponent(cookieValue))
    if (!parsedCookie || typeof parsedCookie !== 'object') {
      initTabsState()
      renderTabBar()
      return false
    }
    const payloadText = JSON.stringify(
      parsedCookie.payload ? parsedCookie.payload : parsedCookie
    )
    const normalizedRecipeData = parseImportedRecipeDataText(payloadText)
    if (!normalizedRecipeData) {
      initTabsState()
      renderTabBar()
      return false
    }
    initTabsState(normalizedRecipeData)
    applyNormalizedRecipeData(normalizedRecipeData)
    renderTabBar()
    showDocumentTransferMessage('Recovered document from cookie backup.')
    return true
  } catch {
    initTabsState()
    renderTabBar()
    return false
  }
}

// --- TAB BAR UI ---

function renderTabBar () {
  const tabBar = dom.tabBar
  if (!tabBar) return
  tabBar.innerHTML = ''

  tabsState.tabs.forEach((tab) => {
    const isActive = tab.id === tabsState.activeTabId

    const tabEl = document.createElement('div')
    tabEl.className = isActive ? 'tab-item tab-item--active' : 'tab-item'
    tabEl.dataset.tabId = tab.id
    tabEl.setAttribute('role', 'tab')
    tabEl.setAttribute('aria-selected', isActive ? 'true' : 'false')
    tabEl.title = tab.label

    const labelEl = document.createElement('span')
    labelEl.className = 'tab-label'
    labelEl.textContent = tab.label
    labelEl.title = 'Double-click to rename'
    labelEl.addEventListener('dblclick', (e) => {
      e.stopPropagation()
      startTabRename(tab.id, labelEl)
    })

    const closeBtn = document.createElement('button')
    closeBtn.className = 'tab-close-btn'
    closeBtn.setAttribute('aria-label', `Close ${tab.label}`)
    closeBtn.innerHTML =
      '<span class="material-icons" style="font-size:14px;line-height:1;">close</span>'
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      handleCloseTab(tab.id)
    })

    tabEl.appendChild(labelEl)
    tabEl.appendChild(closeBtn)
    tabEl.addEventListener('click', () => handleSwitchTab(tab.id))
    tabBar.appendChild(tabEl)
  })

  const newTabBtn = document.createElement('button')
  newTabBtn.className = 'tab-new-btn'
  newTabBtn.title = 'New document'
  newTabBtn.setAttribute('aria-label', 'New document')
  newTabBtn.innerHTML =
    '<span class="material-icons" style="font-size:16px;line-height:1;">add</span>'
  newTabBtn.addEventListener('click', handleNewTab)
  tabBar.appendChild(newTabBtn)
}

function startTabRename (tabId, labelEl) {
  const input = document.createElement('input')
  input.type = 'text'
  input.value = labelEl.textContent
  input.className = 'tab-rename-input'
  labelEl.replaceWith(input)
  input.focus()
  input.select()

  let committed = false
  const commit = () => {
    if (committed) return
    committed = true
    const newLabel = input.value.trim()
    if (newLabel) renameTab(tabId, newLabel)
    renderTabBar()
    persistTabsToCache()
  }

  input.addEventListener('blur', commit)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      input.blur()
    } else if (e.key === 'Escape') {
      committed = true
      renderTabBar()
    }
  })
}

function handleSwitchTab (id) {
  const newRecipeData = switchToTab(id)
  if (!newRecipeData) return
  applyNormalizedRecipeData(newRecipeData)
  resetHistoryTracking()
  renderTabBar()
  persistTabsToCache()
}

function handleNewTab () {
  saveCurrentTabSnapshot()
  const newTab = createTab()
  tabsState.activeTabId = newTab.id
  applyNormalizedRecipeData(newTab.savedRecipeData)
  resetHistoryTracking()
  renderTabBar()
  persistTabsToCache()
}

function handleCloseTab (id) {
  const result = closeTab(id)
  if (result) {
    applyNormalizedRecipeData(result.recipeData)
    resetHistoryTracking()
  }
  renderTabBar()
  persistTabsToCache()
}

function getTemplateSlotBuiltin (slot) {
  return BUILTIN_TEMPLATE_SLOTS.find((entry) => entry.slot === slot) || null
}

function getTemplateSlotCached (slot) {
  const cacheText = safeLocalStorageGet(getTemplateSlotStorageKey(slot))
  if (!cacheText) return null
  try {
    const parsed = JSON.parse(cacheText)
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.payloadText !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

function saveTemplateSlotToCache (slot, payloadText, sourceName = '') {
  const slotEntry = {
    slot,
    sourceName,
    savedAt: new Date().toISOString(),
    payloadText
  }
  const slotEntryText = JSON.stringify(slotEntry)
  const savedLocally = safeLocalStorageSet(
    getTemplateSlotStorageKey(slot),
    slotEntryText
  )
  const savedInCookie = saveJsonCookie(
    getTemplateSlotCookieKey(slot),
    {
      slot,
      sourceName,
      payloadText
    },
    TEMPLATE_SLOT_COOKIE_MAX_CHARS
  )
  return {
    savedLocally,
    savedInCookie
  }
}

async function readTemplatePayloadForSlot (slot) {
  const cachedSlot = getTemplateSlotCached(slot)
  if (cachedSlot) {
    return {
      name: cachedSlot.sourceName || `Custom Slot ${slot}`,
      payloadText: cachedSlot.payloadText,
      sourceType: 'cached'
    }
  }

  const cookieBackupValue = getCookieValue(getTemplateSlotCookieKey(slot))
  if (cookieBackupValue) {
    try {
      const parsedCookieBackup = JSON.parse(
        decodeURIComponent(cookieBackupValue)
      )
      if (typeof parsedCookieBackup.payloadText === 'string') {
        return {
          name: parsedCookieBackup.sourceName || `Custom Slot ${slot}`,
          payloadText: parsedCookieBackup.payloadText,
          sourceType: 'cookie'
        }
      }
    } catch {
      // Ignore invalid cookie backup payloads for this slot.
    }
  }

  const builtinTemplate = getTemplateSlotBuiltin(slot)
  if (!builtinTemplate) return null

  const response = await fetch(builtinTemplate.path)
  if (!response.ok) {
    throw new Error(`Template file not found: ${builtinTemplate.path}`)
  }
  const payloadText = await response.text()
  return {
    name: builtinTemplate.name,
    payloadText,
    sourceType: 'builtin'
  }
}

function createTemplateSlotCard ({
  slot,
  title,
  subtitle,
  categoryLabel,
  buttonLabel,
  buttonClassName,
  isEmpty
}) {
  const card = document.createElement('div')
  card.className = 'template-slot-card'
  card.dataset.slot = String(slot)

  const head = document.createElement('div')
  head.className = 'template-slot-head'

  const slotIndex = document.createElement('span')
  slotIndex.className = 'template-slot-index'
  slotIndex.textContent = `Slot ${slot}`

  const badge = document.createElement('span')
  badge.className = 'template-slot-badge'
  badge.textContent = categoryLabel

  head.appendChild(slotIndex)
  head.appendChild(badge)

  const titleEl = document.createElement('h3')
  titleEl.className = 'template-slot-title'
  titleEl.textContent = title

  const subtitleEl = document.createElement('p')
  subtitleEl.className = 'template-slot-subtitle'
  subtitleEl.textContent = subtitle

  const action = document.createElement('button')
  action.type = 'button'
  action.className = `template-slot-action ${buttonClassName}`
  action.textContent = buttonLabel

  card.appendChild(head)
  card.appendChild(titleEl)
  card.appendChild(subtitleEl)
  card.appendChild(action)

  if (isEmpty) {
    card.classList.add('template-slot-empty')
    action.textContent = '+'
    action.setAttribute('aria-label', `Upload template for slot ${slot}`)
    action.title = `Upload .cookie to slot ${slot}`
  }
  return card
}

function renderTemplateGallerySlots () {
  if (!dom.templateGalleryGrid) return
  dom.templateGalleryGrid.innerHTML = ''

  for (let slot = 1; slot <= TEMPLATE_SLOT_COUNT; slot += 1) {
    const cached = getTemplateSlotCached(slot)
    const builtin = getTemplateSlotBuiltin(slot)
    if (cached) {
      dom.templateGalleryGrid.appendChild(
        createTemplateSlotCard({
          slot,
          title: cached.sourceName || `Custom Template ${slot}`,
          subtitle: 'Saved locally in this browser cache.',
          categoryLabel: 'Custom',
          buttonLabel: 'Load',
          buttonClassName: 'template-slot-action-load',
          isEmpty: false
        })
      )
      continue
    }

    if (builtin) {
      dom.templateGalleryGrid.appendChild(
        createTemplateSlotCard({
          slot,
          title: builtin.name,
          subtitle: builtin.subtitle,
          categoryLabel: 'Default',
          buttonLabel: 'Load',
          buttonClassName: 'template-slot-action-load',
          isEmpty: false
        })
      )
      continue
    }

    dom.templateGalleryGrid.appendChild(
      createTemplateSlotCard({
        slot,
        title: 'Empty Slot',
        subtitle: 'Upload a .cookie file to save a local template.',
        categoryLabel: 'Open',
        buttonLabel: '+',
        buttonClassName: 'template-slot-action-add',
        isEmpty: true
      })
    )
  }
}

function importDocumentPayloadText (
  rawText,
  sourceLabel = 'CookieCut document'
) {
  const normalizedRecipeData = parseImportedRecipeDataText(rawText)
  if (!normalizedRecipeData) {
    throw new Error('Invalid CookieCut document format.')
  }
  applyNormalizedRecipeData(normalizedRecipeData)
  persistWorkingDocumentToCache()
  resetHistoryTracking()
  showDocumentTransferMessage(`Imported ${sourceLabel}`)
}

async function handleTemplateSlotUpload (slot, file) {
  const rawText = await readTextFile(file)
  const normalizedRecipeData = parseImportedRecipeDataText(rawText)
  if (!normalizedRecipeData) {
    throw new Error('That file is not a valid CookieCut template.')
  }
  const payloadText = JSON.stringify(
    {
      app: 'CookieCut',
      format: 'cookie_document',
      version: COOKIE_DOCUMENT_VERSION,
      exportedAt: new Date().toISOString(),
      recipeData: normalizedRecipeData
    },
    null,
    2
  )
  const saveResult = saveTemplateSlotToCache(slot, payloadText, file.name)
  renderTemplateGallerySlots()
  if (!saveResult.savedLocally) {
    showTemplateGalleryMessage(
      `Saved slot ${slot} cookie backup, but local cache write failed.`,
      true
    )
    return
  }
  if (!saveResult.savedInCookie) {
    showTemplateGalleryMessage(
      `Saved slot ${slot} locally. Cookie backup truncated due to size.`,
      true
    )
    return
  }
  showTemplateGalleryMessage(`Saved "${file.name}" to slot ${slot}.`)
}

async function loadTemplateFromSlot (slot) {
  const templatePayload = await readTemplatePayloadForSlot(slot)
  if (!templatePayload) {
    showTemplateGalleryMessage(`Slot ${slot} is empty. Use + to upload.`)
    return
  }
  importDocumentPayloadText(templatePayload.payloadText, templatePayload.name)
  showEditor()
}

function requestTemplateFileForSlot (slot) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.cookie,application/json'
  input.className = 'hidden'
  input.addEventListener('change', async (event) => {
    const selectedFile = event.target.files?.[0]
    input.remove()
    if (!selectedFile) return
    try {
      await handleTemplateSlotUpload(slot, selectedFile)
    } catch (error) {
      console.error('Failed to cache template slot file:', error)
      showTemplateGalleryMessage(
        'Could not save that file to the slot. Please choose a valid .cookie document.',
        true
      )
    }
  })
  document.body.appendChild(input)
  input.click()
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

function buildDocumentPayload (options = {}) {
  const payload = {
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
  if (options.marketplaceTemplate) {
    payload.marketplaceTemplate = options.marketplaceTemplate
  }
  return payload
}

function exportDocumentFile (preferredFileName = '', options = {}) {
  const payloadText = JSON.stringify(buildDocumentPayload(options), null, 2)
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
  importDocumentPayloadText(rawText, file.name)
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

function showTemplateGallery () {
  renderTemplateGallerySlots()
  if (dom.builderPanel) dom.builderPanel.classList.add('hidden')
  if (dom.recipePanel) dom.recipePanel.classList.add('hidden')
  if (dom.templateGalleryPanel) {
    dom.templateGalleryPanel.classList.remove('hidden')
  }
  if (dom.inlinePreview) dom.inlinePreview.classList.add('hidden')
  if (dom.floatingAddBtn) dom.floatingAddBtn.classList.add('hidden')
  updateAppLayoutForPreviewMode()
  window.scrollTo(0, 0)
}

function showPreview () {
  if (dom.templateGalleryPanel) {
    dom.templateGalleryPanel.classList.add('hidden')
  }
  renderPreview()
  dom.builderPanel.classList.add('hidden')
  dom.recipePanel.classList.remove('hidden')
  updateAppLayoutForPreviewMode()
  window.scrollTo(0, 0)
}

function showEditor () {
  if (dom.templateGalleryPanel) {
    dom.templateGalleryPanel.classList.add('hidden')
  }
  dom.builderPanel.classList.remove('hidden')
  dom.recipePanel.classList.add('hidden')
  if (isInlineMode()) {
    renderInlinePreview()
    if (dom.inlinePreview) dom.inlinePreview.classList.remove('hidden')
    if (dom.floatingAddBtn) dom.floatingAddBtn.classList.remove('hidden')
  }
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

function setMarketplaceOptionsVisibility (visible) {
  if (dom.printMarketplaceOptions) {
    dom.printMarketplaceOptions.classList.toggle('hidden', !visible)
  }
}

function resetMarketplaceOptionsInputs () {
  if (dom.printTemplateCheckbox) dom.printTemplateCheckbox.checked = false
  if (dom.printMarketplaceTitleInput) dom.printMarketplaceTitleInput.value = ''
  if (dom.printMarketplaceSummaryInput) {
    dom.printMarketplaceSummaryInput.value = ''
  }
  setMarketplaceOptionsVisibility(false)
}

function buildMarketplaceTemplateMetadataFromModal () {
  if (!dom.printTemplateCheckbox || !dom.printTemplateCheckbox.checked) {
    return null
  }
  const templateTitle =
    toStringOrFallback(dom.printMarketplaceTitleInput?.value, '').trim() ||
    toStringOrFallback(recipeData.title, '').trim()
  const summary = toStringOrFallback(
    dom.printMarketplaceSummaryInput?.value,
    ''
  ).trim()

  return {
    isTemplate: true,
    title: templateTitle,
    summary
  }
}

function openClearDocumentModal () {
  if (!dom.clearDocModal) return
  dom.clearDocModal.classList.remove('hidden')
}

function closeClearDocumentModal () {
  if (!dom.clearDocModal) return
  dom.clearDocModal.classList.add('hidden')
}

function clearCurrentDocumentData () {
  recipeData.title = ''
  recipeData.description = ''
  recipeData.items = []
  recipeData.settings = { ...DEFAULT_RECIPE_SETTINGS }
  closeClearDocumentModal()
  syncUiFromRecipeData()
  resetHistoryTracking()
  autosaveKeystrokeCounter = 0
  clearWorkingDocumentCache()
  persistWorkingDocumentToCache()
  showDocumentTransferMessage('Cleared the current working document.')
}

function updatePrintModalContentForAction (action) {
  const isExport = action === PRINT_MODAL_ACTION_EXPORT
  if (dom.printModalTitle) {
    dom.printModalTitle.textContent = isExport
      ? 'Export .cookie'
      : 'Print / Download'
  }
  if (dom.printFileNameHelp) {
    dom.printFileNameHelp.textContent = isExport
      ? 'Sets the filename for your .cookie export. Defaults to the recipe title if left blank.'
      : 'Sets the suggested filename when saving as PDF. Defaults to the recipe title if left blank.'
  }
  if (dom.printTemplateCheckbox) {
    const templateToggleRow = dom.printTemplateCheckbox.closest(
      '#print-template-toggle-wrap'
    )
    if (templateToggleRow) {
      templateToggleRow.classList.toggle('hidden', !isExport)
    }
    if (!isExport) resetMarketplaceOptionsInputs()
  }
  if (dom.confirmPrintBtn) {
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
  if (printModalAction === PRINT_MODAL_ACTION_EXPORT) {
    resetMarketplaceOptionsInputs()
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

function handleHistoryKeyboardShortcut (event) {
  const hasPrimaryModifier = event.ctrlKey || event.metaKey
  if (!hasPrimaryModifier || event.altKey) return false
  const key = event.key.toLowerCase()
  if (key === 'z') {
    if (event.shiftKey) {
      if (handleRedoAction()) event.preventDefault()
      return true
    }
    if (handleUndoAction()) event.preventDefault()
    return true
  }
  if (key === 'y') {
    if (handleRedoAction()) event.preventDefault()
    return true
  }
  return false
}

function handleGlobalKeydown (event) {
  if (handleHistoryKeyboardShortcut(event)) return
  if (!isEditableKeyTarget(event)) return
  if (!isMeaningfulKeystroke(event)) return

  autosaveKeystrokeCounter += 1
  if (autosaveKeystrokeCounter < KEYSTROKES_PER_AUTOSAVE) return
  autosaveKeystrokeCounter = 0
  persistWorkingDocumentToCache()
}

async function handleTemplateGalleryGridClick (event) {
  const clickTarget =
    event.target instanceof Element
      ? event.target
      : event.target?.parentElement
  if (!clickTarget) return
  const card = clickTarget.closest('.template-slot-card')
  if (!card) return
  const slot = Number.parseInt(card.dataset.slot || '', 10)
  if (!Number.isFinite(slot) || slot < 1 || slot > TEMPLATE_SLOT_COUNT) return
  if (card.classList.contains('template-slot-empty')) {
    requestTemplateFileForSlot(slot)
    return
  }
  try {
    await loadTemplateFromSlot(slot)
  } catch (error) {
    console.error('Failed loading template slot:', error)
    showTemplateGalleryMessage(
      'Failed to load that template slot. Please try another slot.',
      true
    )
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
  if (dom.templateBrowserBtn) {
    dom.templateBrowserBtn.addEventListener('click', showTemplateGallery)
  }
  if (dom.exportDocBtn) {
    dom.exportDocBtn.addEventListener('click', () => {
      handleExportRequest()
    })
  }
  if (dom.clearDocBtn) {
    dom.clearDocBtn.addEventListener('click', openClearDocumentModal)
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
      exportDocumentFile(fileName, {
        marketplaceTemplate: buildMarketplaceTemplateMetadataFromModal()
      })
      return
    }
    executePrint(fileName)
  })
  if (dom.printTemplateCheckbox) {
    dom.printTemplateCheckbox.addEventListener('change', (event) => {
      setMarketplaceOptionsVisibility(Boolean(event.target.checked))
      if (
        event.target.checked &&
        dom.printMarketplaceTitleInput &&
        !dom.printMarketplaceTitleInput.value
      ) {
        dom.printMarketplaceTitleInput.value = recipeData.title || ''
      }
    })
  }
  if (dom.printFileNameInput) {
    dom.printFileNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        dom.confirmPrintBtn.click()
      }
      if (e.key === 'Escape') closePrintModal()
    })
  }

  // Clear Document Modal Listeners
  if (dom.closeClearDocModalBtn) {
    dom.closeClearDocModalBtn.addEventListener(
      'click',
      closeClearDocumentModal
    )
  }
  if (dom.clearDocModalOverlay) {
    dom.clearDocModalOverlay.addEventListener('click', closeClearDocumentModal)
  }
  if (dom.cancelClearDocBtn) {
    dom.cancelClearDocBtn.addEventListener('click', closeClearDocumentModal)
  }
  if (dom.confirmClearDocBtn) {
    dom.confirmClearDocBtn.addEventListener('click', clearCurrentDocumentData)
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
  if (dom.templateGalleryBackBtn) {
    dom.templateGalleryBackBtn.addEventListener('click', showEditor)
  }
  if (dom.templateGalleryGrid) {
    dom.templateGalleryGrid.addEventListener('click', (event) => {
      handleTemplateGalleryGridClick(event)
    })
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
  document.addEventListener('keydown', handleGlobalKeydown)

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
  renderTemplateGallerySlots()
  restoreWorkingDocumentFromCache()
  resetHistoryTracking()
  startHistoryObserver()
}

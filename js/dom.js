// --- DOM REFERENCES ---
// Populated by initDom() after HTML partials are loaded.
export const dom = {
  appContainer: null,
  builderPanel: null,
  recipePanel: null,
  titleInput: null,
  descInput: null,
  titlePreview: null,
  descPreview: null,
  contentInputs: null,
  contentPreview: null,
  addTextBtn: null,
  addImageBtn: null,
  addToastBtn: null,
  exportDocBtn: null,
  importDocBtn: null,
  importDocInput: null,
  documentTransferStatus: null,
  previewBtn: null,
  editBtn: null,
  printBtn: null,
  // Toast Modal
  toastModal: null,
  toastModalOverlay: null,
  closeModalBtn: null,
  toastTypeTipBtn: null,
  toastTypeWarningBtn: null,
  toastTypeNoteBtn: null,
  // Text Modal
  textModal: null,
  textModalOverlay: null,
  closeTextModalBtn: null,
  textTypeHeadingBtn: null,
  textTypeStepBtn: null,
  textTypeBulletBtn: null,
  textTypeTextBtn: null,
  textTypeLinkBtn: null,
  // Icon Key Modal
  iconKeyBtn: null,
  iconKeyModal: null,
  iconKeyModalOverlay: null,
  closeIconKeyModalBtn: null,
  iconSearchInput: null,
  iconListContainer: null,
  // Settings Modal
  settingsBtn: null,
  settingsModal: null,
  settingsModalOverlay: null,
  closeSettingsModalBtn: null,
  globalFontStyleSelect: null,
  fontApplyTextCheckbox: null,
  fontApplyTipsCheckbox: null,
  editorModeSelect: null,
  previewModeSelect: null,
  // Print Modal
  printModal: null,
  printModalOverlay: null,
  closePrintModalBtn: null,
  printModalTitle: null,
  printFileNameInput: null,
  printFileNameHelp: null,
  cancelPrintBtn: null,
  confirmPrintBtn: null,
  // Inline editor
  floatingAddBtn: null,
  inlinePreview: null,
  // Preview mode / stats
  recipeFlow: null,
  previewStats: null,
  wordCountValue: null,
  sentenceCountValue: null,
  paragraphCountValue: null,
  pageCountValue: null
}

export function initDom () {
  dom.appContainer = document.getElementById('app-container')
  dom.builderPanel = document.getElementById('builder-panel')
  dom.recipePanel = document.getElementById('recipe-panel')
  dom.titleInput = document.getElementById('recipe-title-input')
  dom.descInput = document.getElementById('recipe-desc-input')
  dom.titlePreview = document.getElementById('recipe-title-preview')
  dom.descPreview = document.getElementById('recipe-desc-preview')
  dom.contentInputs = document.getElementById('content-inputs')
  dom.contentPreview = document.getElementById('recipe-content-preview')
  dom.addTextBtn = document.getElementById('add-text-btn')
  dom.addImageBtn = document.getElementById('add-image-btn')
  dom.addToastBtn = document.getElementById('add-toast-btn')
  dom.exportDocBtn = document.getElementById('export-doc-btn')
  dom.importDocBtn = document.getElementById('import-doc-btn')
  dom.importDocInput = document.getElementById('import-doc-input')
  dom.documentTransferStatus = document.getElementById('doc-transfer-status')
  dom.previewBtn = document.getElementById('preview-btn')
  dom.editBtn = document.getElementById('edit-btn')
  dom.printBtn = document.getElementById('print-btn')
  // Toast Modal
  dom.toastModal = document.getElementById('toast-modal')
  dom.toastModalOverlay = document.getElementById('modal-overlay')
  dom.closeModalBtn = document.getElementById('close-modal-btn')
  dom.toastTypeTipBtn = document.getElementById('toast-type-tip')
  dom.toastTypeWarningBtn = document.getElementById('toast-type-warning')
  dom.toastTypeNoteBtn = document.getElementById('toast-type-note')
  // Text Modal
  dom.textModal = document.getElementById('text-modal')
  dom.textModalOverlay = document.getElementById('modal-overlay-text')
  dom.closeTextModalBtn = document.getElementById('close-text-modal-btn')
  dom.textTypeHeadingBtn = document.getElementById('text-type-heading')
  dom.textTypeStepBtn = document.getElementById('text-type-step')
  dom.textTypeBulletBtn = document.getElementById('text-type-bullet')
  dom.textTypeTextBtn = document.getElementById('text-type-text')
  dom.textTypeLinkBtn = document.getElementById('text-type-link')
  // Icon Key Modal
  dom.iconKeyBtn = document.getElementById('icon-key-btn')
  dom.iconKeyModal = document.getElementById('icon-key-modal')
  dom.iconKeyModalOverlay = document.getElementById('icon-key-modal-overlay')
  dom.closeIconKeyModalBtn = document.getElementById(
    'close-icon-key-modal-btn'
  )
  dom.iconSearchInput = document.getElementById('icon-search-input')
  dom.iconListContainer = document.getElementById('icon-list-container')
  // Settings Modal
  dom.settingsBtn = document.getElementById('settings-btn')
  dom.settingsModal = document.getElementById('settings-modal')
  dom.settingsModalOverlay = document.getElementById('settings-modal-overlay')
  dom.closeSettingsModalBtn = document.getElementById(
    'close-settings-modal-btn'
  )
  dom.globalFontStyleSelect = document.getElementById(
    'global-font-style-select'
  )
  dom.fontApplyTextCheckbox = document.getElementById(
    'font-apply-text-checkbox'
  )
  dom.fontApplyTipsCheckbox = document.getElementById(
    'font-apply-tips-checkbox'
  )
  dom.editorModeSelect = document.getElementById('editor-mode-select')
  dom.previewModeSelect = document.getElementById('preview-mode-select')
  // Print Modal
  dom.printModal = document.getElementById('print-modal')
  dom.printModalOverlay = document.getElementById('print-modal-overlay')
  dom.closePrintModalBtn = document.getElementById('close-print-modal-btn')
  dom.printModalTitle = document.getElementById('print-modal-title')
  dom.printFileNameInput = document.getElementById('print-file-name-input')
  dom.printFileNameHelp = document.getElementById('print-file-name-help')
  dom.cancelPrintBtn = document.getElementById('cancel-print-btn')
  dom.confirmPrintBtn = document.getElementById('confirm-print-btn')
  // Inline editor
  dom.floatingAddBtn = document.getElementById('floating-add-btn')
  dom.inlinePreview = document.getElementById('inline-preview')
  // Preview mode / stats
  dom.recipeFlow = document.getElementById('recipe-flow')
  dom.previewStats = document.getElementById('preview-stats')
  dom.wordCountValue = document.getElementById('word-count-value')
  dom.sentenceCountValue = document.getElementById('sentence-count-value')
  dom.paragraphCountValue = document.getElementById('paragraph-count-value')
  dom.pageCountValue = document.getElementById('page-count-value')
}

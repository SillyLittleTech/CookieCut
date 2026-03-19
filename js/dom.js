// --- DOM REFERENCES ---
// Populated by initDom() after HTML partials are loaded.
export const dom = {
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
    editorModeSelect: null,
    // Inline editor
    floatingAddBtn: null,
    inlinePreview: null,
};

export function initDom() {
    dom.builderPanel = document.getElementById('builder-panel');
    dom.recipePanel = document.getElementById('recipe-panel');
    dom.titleInput = document.getElementById('recipe-title-input');
    dom.descInput = document.getElementById('recipe-desc-input');
    dom.titlePreview = document.getElementById('recipe-title-preview');
    dom.descPreview = document.getElementById('recipe-desc-preview');
    dom.contentInputs = document.getElementById('content-inputs');
    dom.contentPreview = document.getElementById('recipe-content-preview');
    dom.addTextBtn = document.getElementById('add-text-btn');
    dom.addImageBtn = document.getElementById('add-image-btn');
    dom.addToastBtn = document.getElementById('add-toast-btn');
    dom.previewBtn = document.getElementById('preview-btn');
    dom.editBtn = document.getElementById('edit-btn');
    dom.printBtn = document.getElementById('print-btn');
    // Toast Modal
    dom.toastModal = document.getElementById('toast-modal');
    dom.toastModalOverlay = document.getElementById('modal-overlay');
    dom.closeModalBtn = document.getElementById('close-modal-btn');
    dom.toastTypeTipBtn = document.getElementById('toast-type-tip');
    dom.toastTypeWarningBtn = document.getElementById('toast-type-warning');
    dom.toastTypeNoteBtn = document.getElementById('toast-type-note');
    // Text Modal
    dom.textModal = document.getElementById('text-modal');
    dom.textModalOverlay = document.getElementById('modal-overlay-text');
    dom.closeTextModalBtn = document.getElementById('close-text-modal-btn');
    dom.textTypeHeadingBtn = document.getElementById('text-type-heading');
    dom.textTypeStepBtn = document.getElementById('text-type-step');
    dom.textTypeTextBtn = document.getElementById('text-type-text');
    dom.textTypeLinkBtn = document.getElementById('text-type-link');
    // Icon Key Modal
    dom.iconKeyBtn = document.getElementById('icon-key-btn');
    dom.iconKeyModal = document.getElementById('icon-key-modal');
    dom.iconKeyModalOverlay = document.getElementById('icon-key-modal-overlay');
    dom.closeIconKeyModalBtn = document.getElementById('close-icon-key-modal-btn');
    dom.iconSearchInput = document.getElementById('icon-search-input');
    dom.iconListContainer = document.getElementById('icon-list-container');
    // Settings Modal
    dom.settingsBtn = document.getElementById('settings-btn');
    dom.settingsModal = document.getElementById('settings-modal');
    dom.settingsModalOverlay = document.getElementById('settings-modal-overlay');
    dom.closeSettingsModalBtn = document.getElementById('close-settings-modal-btn');
    dom.globalFontStyleSelect = document.getElementById('global-font-style-select');
    dom.editorModeSelect = document.getElementById('editor-mode-select');
    // Inline editor
    dom.floatingAddBtn = document.getElementById('floating-add-btn');
    dom.inlinePreview = document.getElementById('inline-preview');
}

import { recipeData } from './state.js';
import { dom } from './dom.js';
import { renderIconCodes, copyToClipboard } from './helpers.js';
import { COMMON_ICONS } from './constants.js';
import { renderBuilderInputs, renderPreview } from './builders/classic.js';
import { renderInlinePreview, closeImageResizer } from './builders/inline.js';

// --- ACTIONS ---
let nextItemId = Date.now();
let floatingAddMenuCloseHandler = null;

function createItemId() {
    nextItemId = Math.max(nextItemId + 1, Date.now());
    return nextItemId;
}

export function addItem(type, subtype = null) {
    const newItem = { id: createItemId() };
    switch (type) {
        case 'heading':
            newItem.type = 'heading';
            newItem.content = 'New Heading';
            break;
        case 'step':
        case 'text':
            newItem.type = type;
            newItem.content = '';
            break;
        case 'image':
            newItem.type = 'image';
            newItem.src = '';
            newItem.alt = '';
            newItem.size = 350;
            break;
        case 'bubble':
            newItem.type = 'bubble';
            newItem.subtype = subtype || 'note';
            newItem.content = '';
            break;
    }
    recipeData.items.push(newItem);
    renderBuilderInputs();

    const newEl = dom.contentInputs.querySelector(`[data-id="${newItem.id}"]`);
    if (newEl) {
        const input = newEl.querySelector('input, textarea');
        if (input) input.focus();
    }
}

function moveItem(id, direction) {
    const index = recipeData.items.findIndex(i => i.id == id);
    if (direction === 'up' && index > 0) {
        [recipeData.items[index], recipeData.items[index - 1]] = [recipeData.items[index - 1], recipeData.items[index]];
    } else if (direction === 'down' && index < recipeData.items.length - 1) {
        [recipeData.items[index], recipeData.items[index + 1]] = [recipeData.items[index + 1], recipeData.items[index]];
    }
}

// --- MODE HELPERS ---

function isInlineMode() {
    return recipeData.settings && recipeData.settings.editorMode === 'inline';
}

function closeFloatingAddMenu() {
    const menu = document.getElementById('floating-add-menu');
    if (menu) menu.remove();

    if (floatingAddMenuCloseHandler) {
        document.removeEventListener('click', floatingAddMenuCloseHandler);
        floatingAddMenuCloseHandler = null;
    }
}

function toggleOldUIVisibility(hide) {
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
    ];
    // Also hide the labels for the title/description inputs
    const titleLabel = document.querySelector('label[for="recipe-title-input"]');
    const descLabel = document.querySelector('label[for="recipe-desc-input"]');
    if (titleLabel) elementsToToggle.push(titleLabel);
    if (descLabel) elementsToToggle.push(descLabel);

    elementsToToggle.forEach(el => {
        if (!el) return;
        if (hide) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
}

export function enableInlineEditor() {
    if (dom.inlinePreview) dom.inlinePreview.classList.remove('hidden');
    if (dom.floatingAddBtn) dom.floatingAddBtn.classList.remove('hidden');
    toggleOldUIVisibility(true);
    try {
        renderInlinePreview();
    } catch (err) {
        console.error('Inline preview render failed while enabling inline mode:', err);
        // Fall back to classic editor so the user is not left with a broken inline UI.
        try {
            setEditorMode('classic');
        } catch (fallbackErr) {
            console.error('Failed to fall back to classic editor mode after inline render failure:', fallbackErr);
            // As a last resort, at least restore the classic UI visibility.
            disableInlineEditor();
        }
    }
}

export function disableInlineEditor() {
    if (dom.inlinePreview) dom.inlinePreview.classList.add('hidden');
    if (dom.floatingAddBtn) dom.floatingAddBtn.classList.add('hidden');
    closeFloatingAddMenu();
    closeImageResizer();
    toggleOldUIVisibility(false);
}

function setEditorMode(mode) {
    const normalizedMode = mode === 'inline' ? 'inline' : 'classic';
    recipeData.settings.editorMode = normalizedMode;
    if (dom.editorModeSelect && dom.editorModeSelect.value !== normalizedMode) {
        dom.editorModeSelect.value = normalizedMode;
    }
    if (normalizedMode === 'inline') enableInlineEditor();
    else disableInlineEditor();
}

// --- VIEW TOGGLE ---

function showPreview() {
    renderPreview();
    dom.builderPanel.classList.add('hidden');
    dom.recipePanel.classList.remove('hidden');
    window.scrollTo(0, 0);
}

function showEditor() {
    dom.builderPanel.classList.remove('hidden');
    dom.recipePanel.classList.add('hidden');
    window.scrollTo(0, 0);
}

// --- PRINT ---

function handlePrint() {
    const isInline = isInlineMode();
    if (isInline) document.body.classList.add('print-inline-only');
    else document.body.classList.add('print-recipe-only');

    function cleanup() {
        document.body.classList.remove('print-inline-only', 'print-recipe-only');
        window.removeEventListener('afterprint', cleanup);
    }

    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 1500);
}

// --- MAIN INPUT HANDLERS ---

function handleUpdateMain(e) {
    recipeData[e.target.id === 'recipe-title-input' ? 'title' : 'description'] = e.target.value;
}

function handleLiveInput(e) {
    const itemEl = e.target.closest('[data-id]');
    if (!itemEl) return;

    const id = itemEl.dataset.id;
    const key = e.target.dataset.key;
    const value = e.target.value;
    const item = recipeData.items.find(i => i.id == id);

    if (!item || !key) return;

    item[key] = value;

    // If it's the size slider, also update the live pixel display
    if (key === 'size') {
        const display = itemEl.querySelector('[data-role="size-display"]');
        if (display) {
            display.textContent = `${value}px`;
        }
    }
}

function handleContentInputClick(e) {
    const itemEl = e.target.closest('[data-id]');
    if (!itemEl) return;

    const id = itemEl.dataset.id;

    const deleteBtn = e.target.closest('.delete-btn');
    const moveUpBtn = e.target.closest('.move-up-btn');
    const moveDownBtn = e.target.closest('.move-down-btn');

    let actionTaken = false;

    if (deleteBtn) {
        recipeData.items = recipeData.items.filter(i => i.id != id);
        actionTaken = true;
    } else if (moveUpBtn) {
        moveItem(id, 'up');
        actionTaken = true;
    } else if (moveDownBtn) {
        moveItem(id, 'down');
        actionTaken = true;
    }

    if (actionTaken) {
        renderBuilderInputs();
        if (isInlineMode()) renderInlinePreview();
    }
}

// --- MODAL FUNCTIONS ---

function openToastModal() { dom.toastModal.classList.remove('hidden'); }
function closeToastModal() { dom.toastModal.classList.add('hidden'); }
function handleToastSelection(subtype) {
    closeToastModal();
    addItem('bubble', subtype);
}

function openTextModal() { dom.textModal.classList.remove('hidden'); }
function closeTextModal() { dom.textModal.classList.add('hidden'); }
function handleTextSelection(type) {
    closeTextModal();
    addItem(type);
}

function openIconKeyModal() {
    renderIconList();
    dom.iconKeyModal.classList.remove('hidden');
    dom.iconSearchInput.focus();
}
function closeIconKeyModal() {
    dom.iconKeyModal.classList.add('hidden');
    dom.iconSearchInput.value = '';
}

function renderIconList(filter = '') {
    dom.iconListContainer.innerHTML = '';
    const lowerFilter = filter.toLowerCase();
    const filteredIcons = COMMON_ICONS.filter(icon => icon.includes(lowerFilter));

    if (filteredIcons.length === 0) {
        dom.iconListContainer.innerHTML = `<p class="text-gray-500 italic">No icons found.</p>`;
        return;
    }

    filteredIcons.forEach(icon => {
        const code = `:${icon}:`;
        const el = document.createElement('div');
        el.className = 'flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg transition-colors duration-100';
        el.innerHTML = `
            <span class="material-icons text-gray-700">${icon}</span>
            <code class="text-sm text-gray-900 font-mono">${code}</code>
            <button class="copy-icon-btn ml-auto text-xs font-medium bg-blue-100 hover:bg-blue-200 text-blue-700 py-1 px-2 rounded-md transition-all duration-150 active:scale-95" data-code="${code}">Copy</button>
        `;
        dom.iconListContainer.appendChild(el);
    });
}

function handleIconListClick(e) {
    const copyBtn = e.target.closest('.copy-icon-btn');
    if (copyBtn) {
        const code = copyBtn.dataset.code;
        copyToClipboard(code);
        copyBtn.textContent = 'Copied!';
        copyBtn.classList.add('bg-green-200', 'text-green-800');
        setTimeout(() => {
            copyBtn.textContent = 'Copy';
            copyBtn.classList.remove('bg-green-200', 'text-green-800');
        }, 1500);
    }
}

function openSettingsModal() {
    dom.globalFontStyleSelect.value = recipeData.settings.fontStyle;
    if (dom.editorModeSelect) dom.editorModeSelect.value = recipeData.settings.editorMode || 'classic';
    dom.settingsModal.classList.remove('hidden');
}
function closeSettingsModal() {
    dom.settingsModal.classList.add('hidden');
}
function handleGlobalFontChange(e) {
    recipeData.settings.fontStyle = e.target.value;
    dom.titlePreview.className = `font-style-${recipeData.settings.fontStyle}`;
    if (isInlineMode()) {
        renderInlinePreview();
    }
}

// --- INIT ---

export function init() {
    // Main info
    dom.titleInput.addEventListener('input', handleUpdateMain);
    dom.descInput.addEventListener('input', handleUpdateMain);

    // "Add" buttons
    dom.addTextBtn.addEventListener('click', openTextModal);
    dom.addImageBtn.addEventListener('click', () => addItem('image'));
    dom.addToastBtn.addEventListener('click', openToastModal);

    // Toast Modal Listeners
    dom.closeModalBtn.addEventListener('click', closeToastModal);
    dom.toastModalOverlay.addEventListener('click', closeToastModal);
    dom.toastTypeTipBtn.addEventListener('click', () => handleToastSelection('tip'));
    dom.toastTypeWarningBtn.addEventListener('click', () => handleToastSelection('warning'));
    dom.toastTypeNoteBtn.addEventListener('click', () => handleToastSelection('note'));

    // Text Modal Listeners
    dom.closeTextModalBtn.addEventListener('click', closeTextModal);
    dom.textModalOverlay.addEventListener('click', closeTextModal);
    dom.textTypeHeadingBtn.addEventListener('click', () => handleTextSelection('heading'));
    dom.textTypeStepBtn.addEventListener('click', () => handleTextSelection('step'));
    dom.textTypeTextBtn.addEventListener('click', () => handleTextSelection('text'));

    // Icon Key Modal Listeners
    dom.iconKeyBtn.addEventListener('click', openIconKeyModal);
    dom.closeIconKeyModalBtn.addEventListener('click', closeIconKeyModal);
    dom.iconKeyModalOverlay.addEventListener('click', closeIconKeyModal);
    dom.iconSearchInput.addEventListener('input', (e) => renderIconList(e.target.value));
    dom.iconListContainer.addEventListener('click', handleIconListClick);

    // Settings Modal Listeners
    dom.settingsBtn.addEventListener('click', openSettingsModal);
    dom.closeSettingsModalBtn.addEventListener('click', closeSettingsModal);
    dom.settingsModalOverlay.addEventListener('click', closeSettingsModal);
    dom.globalFontStyleSelect.addEventListener('change', handleGlobalFontChange);

    // Editor Mode select
    if (dom.editorModeSelect) {
        dom.editorModeSelect.addEventListener('change', (e) => {
            setEditorMode(e.target.value);
        });
        dom.editorModeSelect.value = recipeData.settings.editorMode || 'classic';
    }

    // Floating add button behavior
    if (dom.floatingAddBtn) {
        dom.floatingAddBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            let menu = document.getElementById('floating-add-menu');
            if (menu) { menu.remove(); return; }
            menu = document.createElement('div');
            menu.id = 'floating-add-menu';
            menu.style.position = 'fixed';
            menu.style.right = '96px';
            menu.style.bottom = '24px';
            menu.style.zIndex = 70;
            menu.style.background = 'white';
            menu.style.padding = '8px';
            menu.style.borderRadius = '8px';
            menu.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';

            const makeBtn = (label, cb) => {
                const b = document.createElement('button');
                b.textContent = label;
                b.className = 'px-3 py-2 block w-full text-left';
                b.addEventListener('click', () => { cb(); menu.remove(); });
                return b;
            };

            menu.appendChild(makeBtn('Add Text', () => openTextModal()));
            menu.appendChild(makeBtn('Add Image', () => addItem('image')));
            menu.appendChild(makeBtn('Add Toast', () => openToastModal()));
            menu.appendChild(makeBtn('Print', () => handlePrint()));

            document.body.appendChild(menu);
            // click outside to close
            setTimeout(() => {
                document.addEventListener('click', function _close(e) {
                    const m = document.getElementById('floating-add-menu');
                    if (m && !m.contains(e.target) && e.target !== dom.floatingAddBtn) m.remove();
                    document.removeEventListener('click', _close);
                });
            }, 10);
        });
    }

    // Dynamic item handlers
    dom.contentInputs.addEventListener('input', handleLiveInput);
    dom.contentInputs.addEventListener('click', handleContentInputClick);

    // View Toggle Listeners
    dom.previewBtn.addEventListener('click', showPreview);
    dom.editBtn.addEventListener('click', showEditor);
    dom.printBtn.addEventListener('click', () => handlePrint());

    // Initial render
    renderBuilderInputs();
    dom.titleInput.value = recipeData.title;
    dom.descInput.value = recipeData.description;
    dom.titlePreview.innerHTML = renderIconCodes(recipeData.title);
    dom.descPreview.innerHTML = renderIconCodes(recipeData.description);
    dom.globalFontStyleSelect.value = recipeData.settings.fontStyle;
    dom.titlePreview.className = `font-style-${recipeData.settings.fontStyle}`;
    // Initialize editor mode (inline is experimental and OFF by default)
    setEditorMode(recipeData.settings.editorMode);
}

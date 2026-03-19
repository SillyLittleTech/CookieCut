import { recipeData } from '../state.js';
import { dom } from '../dom.js';
import { renderIconCodes, getTextAndCaret, setCaretPosition } from '../helpers.js';
import * as headingHandler from '../handlers/heading.js';
import * as stepHandler from '../handlers/step.js';
import * as textHandler from '../handlers/text.js';
import * as imageHandler from '../handlers/image.js';
import * as bubbleHandler from '../handlers/bubble.js';
import { renderInlineElement as renderInlineLinkElement } from '../handlers/link.js';
// renderBuilderInputs is imported lazily inside function bodies to avoid
// circular-import issues at module evaluation time.

// --- Image Resizer State ---
let currentResizer = null;
let currentLinkEditor = null;
let linkEditorInputIdCounter = 0;
let currentDeleteConfirm = null;
let currentDeleteResolve = null;
let currentDeleteKeydownHandler = null;

function closeInlineDeleteConfirm(confirmed = false) {
    if (currentDeleteConfirm) {
        currentDeleteConfirm.remove();
        currentDeleteConfirm = null;
    }
    if (currentDeleteKeydownHandler) {
        document.removeEventListener('keydown', currentDeleteKeydownHandler);
        currentDeleteKeydownHandler = null;
    }
    if (currentDeleteResolve) {
        const resolve = currentDeleteResolve;
        currentDeleteResolve = null;
        resolve(Boolean(confirmed));
    }
}

function openInlineDeleteConfirm(message = 'Remove this item?') {
    closeInlineDeleteConfirm(false);

    return new Promise((resolve) => {
        currentDeleteResolve = resolve;

        const overlay = document.createElement('div');
        overlay.className = 'inline-delete-confirm-overlay';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.zIndex = 62;
        overlay.style.background = 'rgba(0,0,0,0.45)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.padding = '16px';

        const dialog = document.createElement('div');
        dialog.style.background = 'white';
        dialog.style.width = 'min(360px, calc(100vw - 32px))';
        dialog.style.borderRadius = '10px';
        dialog.style.boxShadow = '0 14px 30px rgba(0,0,0,0.18)';
        dialog.style.padding = '14px';

        const title = document.createElement('p');
        title.textContent = message;
        title.style.marginBottom = '12px';
        title.style.fontSize = '14px';
        title.style.color = '#111827';

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.justifyContent = 'flex-end';
        actions.style.gap = '8px';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'px-3 py-1 bg-gray-100 rounded';
        cancelBtn.addEventListener('click', () => closeInlineDeleteConfirm(false));

        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.className = 'px-3 py-1 bg-red-600 text-white rounded';
        removeBtn.addEventListener('click', () => closeInlineDeleteConfirm(true));

        actions.appendChild(cancelBtn);
        actions.appendChild(removeBtn);
        dialog.appendChild(title);
        dialog.appendChild(actions);
        overlay.appendChild(dialog);

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) closeInlineDeleteConfirm(false);
        });

        currentDeleteKeydownHandler = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeInlineDeleteConfirm(false);
            }
        };
        document.addEventListener('keydown', currentDeleteKeydownHandler);

        document.body.appendChild(overlay);
        currentDeleteConfirm = overlay;
        removeBtn.focus();
    });
}

function closeActiveInlineEditors() {
    closeImageResizer();
    closeLinkEditor();
    closeInlineDeleteConfirm(false);
}

function syncLinkInputs(item) {
    const itemEl = dom.contentInputs.querySelector(`[data-id="${item.id}"]`);
    if (!itemEl) return;
    const contentInput = itemEl.querySelector('[data-key="content"]');
    const hrefInput = itemEl.querySelector('[data-key="href"]');
    if (contentInput) contentInput.value = item.content || '';
    if (hrefInput) hrefInput.value = item.href || '';
}

function persistLinkChanges(item, text, href) {
    item.content = text.trim();
    item.href = href.trim();
    syncLinkInputs(item);
}

function saveLinkAndRerender(item, text, href) {
    persistLinkChanges(item, text, href);
    closeLinkEditor();
    import('./classic.js').then(({ renderBuilderInputs }) => {
        renderBuilderInputs();
    });
}

export function openImageResizer(imgEl, item) {
    closeActiveInlineEditors();
    const resizer = document.createElement('div');
    resizer.className = 'image-resizer-overlay';
    resizer.style.position = 'fixed';
    resizer.style.left = '50%';
    resizer.style.transform = 'translateX(-50%)';
    resizer.style.bottom = '20px';
    resizer.style.zIndex = 60;
    resizer.style.background = 'white';
    resizer.style.padding = '8px 12px';
    resizer.style.borderRadius = '8px';
    resizer.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';

    const input = document.createElement('input');
    input.type = 'range';
    input.min = 100;
    input.max = 1200;
    input.step = 1;
    input.value = item.size || 350;
    input.style.width = '300px';
    const label = document.createElement('span');
    label.textContent = `${input.value}px`;
    label.style.marginLeft = '10px';

    input.addEventListener('input', () => {
        const v = input.value;
        item.size = Number(v);
        imgEl.style.maxWidth = `${v}px`;
        label.textContent = `${v}px`;
        // update builder input display if visible
        const itemEl = dom.contentInputs.querySelector(`[data-id="${item.id}"]`);
        if (itemEl) {
            const display = itemEl.querySelector('[data-role="size-display"]');
            const slider = itemEl.querySelector('[data-key="size"]');
            if (display) display.textContent = `${v}px`;
            if (slider) slider.value = v;
        }
    });

    // URL and alt inputs
    const urlLabel = document.createElement('label');
    urlLabel.textContent = 'Image URL';
    urlLabel.style.display = 'block';
    urlLabel.style.marginTop = '8px';
    const urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.value = item.src || '';
    urlInput.placeholder = 'https://...';
    urlInput.style.width = '420px';
    urlInput.style.display = 'block';
    urlInput.style.marginTop = '4px';

    const altLabel = document.createElement('label');
    altLabel.textContent = 'Alt text';
    altLabel.style.display = 'block';
    altLabel.style.marginTop = '6px';
    const altInput = document.createElement('input');
    altInput.type = 'text';
    altInput.value = item.alt || '';
    altInput.style.width = '420px';
    altInput.style.display = 'block';
    altInput.style.marginTop = '4px';

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply';
    applyBtn.className = 'ml-3 px-3 py-1 bg-blue-600 text-white rounded';
    applyBtn.addEventListener('click', () => {
        const newUrl = urlInput.value.trim();
        const newAlt = altInput.value.trim();
        if (newUrl) {
            item.src = newUrl;
            imgEl.src = newUrl;
        }
        item.alt = newAlt;
        imgEl.alt = newAlt;
        // update builder inputs if visible
        const itemEl = dom.contentInputs.querySelector(`[data-id="${item.id}"]`);
        if (itemEl) {
            const srcInput = itemEl.querySelector('[data-key="src"]');
            const altInputEl = itemEl.querySelector('[data-key="alt"]');
            if (srcInput) srcInput.value = item.src;
            if (altInputEl) altInputEl.value = item.alt;
        }
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Done';
    closeBtn.className = 'ml-3 px-3 py-1 bg-gray-100 rounded';
    closeBtn.addEventListener('click', closeImageResizer);

    resizer.appendChild(input);
    resizer.appendChild(label);
    resizer.appendChild(urlLabel);
    resizer.appendChild(urlInput);
    resizer.appendChild(altLabel);
    resizer.appendChild(altInput);
    resizer.appendChild(applyBtn);
    resizer.appendChild(closeBtn);
    document.body.appendChild(resizer);
    currentResizer = resizer;
}

export function closeImageResizer() {
    if (currentResizer) {
        currentResizer.remove();
        currentResizer = null;
    }
}

export function openLinkEditor(item) {
    closeActiveInlineEditors();
    const editor = document.createElement('div');
    editor.className = 'inline-link-editor-overlay';
    editor.style.position = 'fixed';
    editor.style.left = '50%';
    editor.style.transform = 'translateX(-50%)';
    editor.style.bottom = '20px';
    editor.style.zIndex = 61;
    editor.style.background = 'white';
    editor.style.padding = '12px';
    editor.style.borderRadius = '8px';
    editor.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
    editor.style.width = 'min(560px, calc(100vw - 32px))';

    const title = document.createElement('p');
    title.textContent = 'Edit link';
    title.style.fontWeight = '700';
    title.style.marginBottom = '8px';
    title.style.fontSize = '14px';

    const textLabel = document.createElement('label');
    textLabel.textContent = 'Link text';
    textLabel.style.display = 'block';
    textLabel.style.fontSize = '12px';
    textLabel.style.color = '#374151';

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.value = item.content || '';
    textInput.placeholder = 'Link text';
    textInput.style.width = '100%';
    textInput.style.marginTop = '4px';
    textInput.style.marginBottom = '8px';

    const hrefLabel = document.createElement('label');
    hrefLabel.textContent = 'URL';
    hrefLabel.style.display = 'block';
    hrefLabel.style.fontSize = '12px';
    hrefLabel.style.color = '#374151';

    const hrefInput = document.createElement('input');
    const hrefInputId = `link-editor-href-${++linkEditorInputIdCounter}`;
    hrefInput.type = 'url';
    hrefInput.id = hrefInputId;
    hrefInput.value = item.href || '';
    hrefInput.placeholder = 'https://example.com';
    hrefInput.style.width = '100%';
    hrefInput.style.marginTop = '4px';
    hrefInput.style.marginBottom = '10px';
    hrefLabel.htmlFor = hrefInputId;

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'flex-end';
    actions.style.gap = '8px';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'px-3 py-1 bg-gray-100 rounded';
    cancelBtn.addEventListener('click', closeLinkEditor);

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.className = 'px-3 py-1 bg-blue-600 text-white rounded';
    saveBtn.addEventListener('click', () => {
        saveLinkAndRerender(item, textInput.value, hrefInput.value);
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    editor.appendChild(title);
    editor.appendChild(textLabel);
    editor.appendChild(textInput);
    editor.appendChild(hrefLabel);
    editor.appendChild(hrefInput);
    editor.appendChild(actions);

    const handleKeyboardSave = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            saveLinkAndRerender(item, textInput.value, hrefInput.value);
        }
    };
    textInput.addEventListener('keydown', handleKeyboardSave);
    hrefInput.addEventListener('keydown', handleKeyboardSave);

    document.body.appendChild(editor);
    currentLinkEditor = editor;
    textInput.focus();
}

export function closeLinkEditor() {
    if (currentLinkEditor) {
        currentLinkEditor.remove();
        currentLinkEditor = null;
    }
}

// --- Drag/Drop Reorder Helper ---

function reorderItems(dragId, targetId) {
    const dragIndex = recipeData.items.findIndex(i => String(i.id) === String(dragId));
    if (dragIndex === -1) return;
    const [dragItem] = recipeData.items.splice(dragIndex, 1);
    // find current index of target (after removal)
    const newTargetIndex = recipeData.items.findIndex(i => String(i.id) === String(targetId));
    if (newTargetIndex === -1) {
        recipeData.items.push(dragItem);
    } else {
        recipeData.items.splice(newTargetIndex, 0, dragItem);
    }
}

// --- Inline Input / Blur Handlers ---

export function handleInlineInput(e) {
    const el = e.target;
    const key = el.dataset.key;
    const id = el.dataset.id;

    if (!key) return;

    if (key === 'title' || key === 'description') {
        const { text, caret } = getTextAndCaret(el);
        if (key === 'title') recipeData.title = text;
        else recipeData.description = text;
        // keep the builder inputs in sync
        dom.titleInput.value = recipeData.title;
        dom.descInput.value = recipeData.description;
        // also update preview title/desc if needed
        dom.titlePreview.innerHTML = renderIconCodes(recipeData.title);
        dom.descPreview.innerHTML = renderIconCodes(recipeData.description);
        // update the editable node's HTML to show icons and restore caret
        const newHtml = renderIconCodes(text);
        el.innerHTML = newHtml;
        setCaretPosition(el, caret);
        return;
    }

    // content for items
    const item = recipeData.items.find(i => String(i.id) === String(id));
    if (!item) return;
    const { text: codeText, caret: newCaret } = getTextAndCaret(el);
    item.content = codeText || '';
    const newHtml = renderIconCodes(item.content);
    el.innerHTML = newHtml;
    setCaretPosition(el, newCaret);

    // reflect changes into builder inputs if present
    const itemEl = dom.contentInputs.querySelector(`[data-id="${item.id}"]`);
    if (itemEl) {
        const input = itemEl.querySelector('[data-key="content"]');
        if (input) input.value = item.content;
    }
}

export function handleInlineBlur(e) {
    const el = e.target;
    if (!el) return;
    const { text } = getTextAndCaret(el);
    const key = el.dataset.key;
    const id = el.dataset.id;
    if (key === 'title') {
        recipeData.title = text;
        dom.titleInput.value = recipeData.title;
        dom.titlePreview.innerHTML = renderIconCodes(recipeData.title);
    } else if (key === 'description') {
        recipeData.description = text;
        dom.descInput.value = recipeData.description;
        dom.descPreview.innerHTML = renderIconCodes(recipeData.description);
    } else if (id) {
        const item = recipeData.items.find(i => String(i.id) === String(id));
        if (item) {
            item.content = text;
            const itemEl = dom.contentInputs.querySelector(`[data-id="${item.id}"]`);
            if (itemEl) {
                const input = itemEl.querySelector('[data-key="content"]');
                if (input) input.value = item.content;
            }
        }
    }

    const newHtml = renderIconCodes(text || '');
    el.innerHTML = newHtml;
}

// --- Inline Preview Renderer ---

export function renderInlinePreview() {
    if (!dom.inlinePreview) return;
    if (!recipeData.settings || recipeData.settings.editorMode !== 'inline') return;
    closeLinkEditor();
    dom.inlinePreview.innerHTML = '';

    const fontStyle = recipeData.settings.fontStyle || 'display';

    // Title (editable)
    const h1 = document.createElement('h1');
    h1.className = `text-4xl font-bold mb-4 font-style-${fontStyle}`;
    h1.contentEditable = true;
    h1.dataset.key = 'title';
    h1.innerHTML = renderIconCodes(recipeData.title);
    // Outline for empty title so users notice it's editable
    if (!recipeData.title || recipeData.title.trim() === '') {
        h1.classList.add('new-text-outline');
        const removeOutline = () => { h1.classList.remove('new-text-outline'); h1.removeEventListener('input', removeOutline); };
        h1.addEventListener('input', removeOutline);
        setTimeout(() => h1.focus(), 20);
    }
    dom.inlinePreview.appendChild(h1);

    // Description (editable)
    const p = document.createElement('p');
    p.className = 'text-gray-600 italic mb-4';
    p.contentEditable = true;
    p.dataset.key = 'description';
    p.innerHTML = renderIconCodes(recipeData.description);
    // Outline for empty description
    if (!recipeData.description || recipeData.description.trim() === '') {
        p.classList.add('new-text-outline');
        const removeOutlineDesc = () => { p.classList.remove('new-text-outline'); p.removeEventListener('input', removeOutlineDesc); };
        p.addEventListener('input', removeOutlineDesc);
    }
    dom.inlinePreview.appendChild(p);

    // Content (wrap in draggable inline-item wrappers; support dblclick removal and drag/drop reordering)
    // stepCounter persists across the entire forEach to track consecutive step numbers correctly
    let stepCounter = 0;

    recipeData.items.forEach(item => {
        const contentWithIcons = renderIconCodes(item.content || '');

        if (item.type === 'step') {
            stepCounter += 1;
            // ensure an ordered list container exists
            let ol = dom.inlinePreview.querySelector('ol');
            if (!ol) {
                ol = document.createElement('ol');
                dom.inlinePreview.appendChild(ol);
            }

            const li = document.createElement('li');
            li.className = 'inline-item';
            li.dataset.id = item.id;
            li.draggable = true;

            const { badge, contentSpan } = stepHandler.renderInlineElement(item, fontStyle, contentWithIcons, stepCounter);
            li.appendChild(badge);
            li.appendChild(contentSpan);
            ol.appendChild(li);

            // dblclick to remove
            li.addEventListener('dblclick', async (ev) => {
                ev.stopPropagation();
                if (await openInlineDeleteConfirm('Remove this item?')) {
                    recipeData.items = recipeData.items.filter(i => String(i.id) !== String(item.id));
                    // Import lazily to avoid circular dependency at evaluation time
                    import('./classic.js').then(({ renderBuilderInputs }) => {
                        renderBuilderInputs();
                        renderInlinePreview();
                    });
                }
            });

            // drag handlers for li
            li.addEventListener('dragstart', (ev) => {
                ev.dataTransfer.setData('text/plain', String(item.id));
                li.classList.add('dragging');
            });
            li.addEventListener('dragend', () => {
                li.classList.remove('dragging');
                dom.inlinePreview.querySelectorAll('.inline-item.drop-target').forEach(n => n.classList.remove('drop-target'));
            });
            li.addEventListener('dragover', (ev) => { ev.preventDefault(); li.classList.add('drop-target'); });
            li.addEventListener('dragleave', () => { li.classList.remove('drop-target'); });
            li.addEventListener('drop', (ev) => {
                ev.preventDefault();
                const dragId = ev.dataTransfer.getData('text/plain');
                const targetId = li.dataset.id;
                if (dragId && targetId && dragId !== targetId) {
                    reorderItems(dragId, targetId);
                    import('./classic.js').then(({ renderBuilderInputs }) => {
                        renderBuilderInputs();
                        renderInlinePreview();
                    });
                }
            });
        } else {
            let el;

            switch (item.type) {
                case 'heading':
                    el = headingHandler.renderInlineElement(item, fontStyle, contentWithIcons);
                    break;
                case 'text':
                    el = textHandler.renderInlineElement(item, fontStyle, contentWithIcons);
                    break;
                case 'image':
                    el = imageHandler.renderInlineElement(item, fontStyle, contentWithIcons);
                    el.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openImageResizer(el, item);
                    });
                    break;
                case 'bubble':
                    el = bubbleHandler.renderInlineElement(item, fontStyle, contentWithIcons);
                    break;
                case 'link': {
                    el = renderInlineLinkElement(item, fontStyle, contentWithIcons);
                    const anchorEl = el.querySelector('a');
                    if (anchorEl) {
                        anchorEl.classList.add('inline-edit-link');
                        // Disable native dragging on the anchor so the wrapper remains the drag source.
                        anchorEl.draggable = false;
                        anchorEl.addEventListener('dragstart', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        });
                        anchorEl.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openLinkEditor(item);
                        });
                    }
                    break;
                }
            }

            if (!el) return;

            const wrapper = document.createElement('div');
            wrapper.className = 'inline-item';
            wrapper.dataset.id = item.id;
            wrapper.draggable = true;
            wrapper.appendChild(el);

            // mark new text with outline to make it visible
            if ((item.type === 'text' || item.type === 'heading') && (!item.content || item.content.trim() === '')) {
                el.classList.add('new-text-outline');
                const onFirstInput = () => { el.classList.remove('new-text-outline'); el.removeEventListener('input', onFirstInput); };
                el.addEventListener('input', onFirstInput);
                setTimeout(() => el.focus(), 20);
            }
            dom.inlinePreview.appendChild(wrapper);

            // dblclick to remove
            wrapper.addEventListener('dblclick', async (ev) => {
                ev.stopPropagation();
                if (await openInlineDeleteConfirm('Remove this item?')) {
                    recipeData.items = recipeData.items.filter(i => String(i.id) !== String(item.id));
                    import('./classic.js').then(({ renderBuilderInputs }) => {
                        renderBuilderInputs();
                        renderInlinePreview();
                    });
                }
            });

            // drag handlers
            wrapper.addEventListener('dragstart', (ev) => {
                ev.dataTransfer.setData('text/plain', String(item.id));
                wrapper.classList.add('dragging');
            });
            wrapper.addEventListener('dragend', () => {
                wrapper.classList.remove('dragging');
                dom.inlinePreview.querySelectorAll('.inline-item.drop-target').forEach(n => n.classList.remove('drop-target'));
            });
            wrapper.addEventListener('dragover', (ev) => { ev.preventDefault(); wrapper.classList.add('drop-target'); });
            wrapper.addEventListener('dragleave', () => { wrapper.classList.remove('drop-target'); });
            wrapper.addEventListener('drop', (ev) => {
                ev.preventDefault();
                const dragId = ev.dataTransfer.getData('text/plain');
                const targetId = wrapper.dataset.id;
                if (dragId && targetId && dragId !== targetId) {
                    reorderItems(dragId, targetId);
                    import('./classic.js').then(({ renderBuilderInputs }) => {
                        renderBuilderInputs();
                        renderInlinePreview();
                    });
                }
            });
        }
    });

    // Attach input listeners for editable regions
    dom.inlinePreview.querySelectorAll('[contenteditable=true]').forEach(node => {
        node.addEventListener('input', handleInlineInput);
        node.addEventListener('blur', handleInlineBlur);
    });

    // Container-level drag/drop: drop to append at end
    dom.inlinePreview.ondragover = function(e) { e.preventDefault(); };
    dom.inlinePreview.ondrop = function(e) {
        e.preventDefault();
        const dragId = e.dataTransfer.getData('text/plain');
        if (!dragId) return;
        const idx = recipeData.items.findIndex(i => String(i.id) === String(dragId));
        if (idx === -1) return;
        const [draggedItem] = recipeData.items.splice(idx, 1);
        recipeData.items.push(draggedItem);
        import('./classic.js').then(({ renderBuilderInputs }) => {
            renderBuilderInputs();
            renderInlinePreview();
        });
    };
}

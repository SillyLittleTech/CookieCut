document.addEventListener('DOMContentLoaded', () => {
    
    // --- STATE ---
    let recipeData = {
        title: '',
        description: '',
        items: [],
        settings: {
            fontStyle: 'display',
            editorMode: 'classic' // 'classic' or 'inline'
        }
    };

    // --- CONSTANTS ---
     const COMMON_ICONS = [
        // General
        'home', 'settings', 'search', 'add', 'delete', 'edit', 'check', 'close', 'menu', 'star', 'favorite', 'lightbulb', 'info', 'warning', 'error', 'list_alt', 'menu_book', 'restaurant_menu',
        // Food & Drink
        'restaurant', 'local_dining', 'local_bar', 'local_cafe', 'kitchen', 'cake', 'fastfood', 'icecream', 'ramen_dining', 'brunch_dining', 'dinner_dining', 'lunch_dining', 'local_pizza', 'set_meal', 'bakery_dining', 'cookie', 'egg', 'egg_alt', 'rice_bowl', 'food_bank', 'takeout_dining', 'tapas', 'kebab_dining', 'breakfast_dining', 'emoji_food_beverage', 'coffee_maker', 'coffee', 'liquor', 'wine_bar', 'local_drink', 'water_drop',
        // Utensils & Tools
        'oven', 'microwave', 'blender', 'countertops', 'skillet', 'soup_kitchen', 'cutting_board', 'room_service', 'outdoor_grill', 'dining', 'flatware', 'pan_tool', 'microwave_gen',
        // Time & Temp
        'timer', 'schedule', 'hourglass_empty', 'hourglass_full', 'history', 'watch_later', 'thermostat', 'device_thermostat', 'local_fire_department', 'whatshot', 'bolt', 'ac_unit', 'severe_cold',
        // Misc
        'eco', 'grass', 'science', 'receipt_long', 'shopping_cart', 'storefront', 'payment', 'credit_card', 'sell', 'account_circle', 'person', 'people', 'group', 'share', 'link', 'public', 'visibility', 'visibility_off', 'lock', 'key', 'print', 'download', 'upload', 'save', 'content_copy', 'content_paste', 'cut', 'flag', 'report', 'mail', 'phone', 'location_on', 'place', 'map', 'explore', 'pets', 'park', 'forest', 'hiking', 'nightlife', 'celebration', 'emoji_nature', 'emoji_objects', 'emoji_people'
    ];


    // --- DOM ELEMENTS ---
    const builderPanel = document.getElementById('builder-panel');
    const recipePanel = document.getElementById('recipe-panel');
    
    const titleInput = document.getElementById('recipe-title-input');
    const descInput = document.getElementById('recipe-desc-input');
    const titlePreview = document.getElementById('recipe-title-preview');
    const descPreview = document.getElementById('recipe-desc-preview');
    
    const contentInputs = document.getElementById('content-inputs');
    const contentPreview = document.getElementById('recipe-content-preview');

    const addTextBtn = document.getElementById('add-text-btn');
    const addImageBtn = document.getElementById('add-image-btn');
    const addToastBtn = document.getElementById('add-toast-btn');
    
    const previewBtn = document.getElementById('preview-btn');
    const editBtn = document.getElementById('edit-btn');
    const printBtn = document.getElementById('print-btn');

    // --- Modal DOM Elements ---
    const toastModal = document.getElementById('toast-modal');
    const toastModalOverlay = document.getElementById('modal-overlay');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const toastTypeTipBtn = document.getElementById('toast-type-tip');
    const toastTypeWarningBtn = document.getElementById('toast-type-warning');
    const toastTypeNoteBtn = document.getElementById('toast-type-note');

    const textModal = document.getElementById('text-modal');
    const textModalOverlay = document.getElementById('modal-overlay-text');
    const closeTextModalBtn = document.getElementById('close-text-modal-btn');
    const textTypeHeadingBtn = document.getElementById('text-type-heading');
    const textTypeStepBtn = document.getElementById('text-type-step');
    const textTypeTextBtn = document.getElementById('text-type-text');

    // --- NEW: Icon Key Modal DOM Elements ---
    const iconKeyBtn = document.getElementById('icon-key-btn');
    const iconKeyModal = document.getElementById('icon-key-modal');
    const iconKeyModalOverlay = document.getElementById('icon-key-modal-overlay');
    const closeIconKeyModalBtn = document.getElementById('close-icon-key-modal-btn');
    const iconSearchInput = document.getElementById('icon-search-input');
    const iconListContainer = document.getElementById('icon-list-container');

    // --- NEW: Settings Modal DOM Elements ---
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsModalOverlay = document.getElementById('settings-modal-overlay');
    const closeSettingsModalBtn = document.getElementById('close-settings-modal-btn');
    const globalFontStyleSelect = document.getElementById('global-font-style-select');
    const editorModeSelect = document.getElementById('editor-mode-select');
    const floatingAddBtn = document.getElementById('floating-add-btn');
    const inlinePreview = document.getElementById('inline-preview');


    // --- RENDER FUNCTIONS ---

    /**
     * Re-draws the entire builder input form based on recipeData
     */
    function renderBuilderInputs() {
        contentInputs.innerHTML = ''; // Clear existing inputs
        
        recipeData.items.forEach((item, index) => {
            const el = document.createElement('div');
            el.setAttribute('data-id', item.id);
            el.className = 'p-4 bg-white border border-gray-300 rounded-lg shadow-sm animate-fade-in-down';
            
            let inputHtml = '';
            let itemLabel = '';

            switch (item.type) {
                case 'heading':
                    itemLabel = 'Heading (H2)';
                    inputHtml = `
                        <input type="text" data-key="content" value="${escapeHTML(item.content)}" class="w-full p-2 border border-gray-300 rounded-md" placeholder="Enter heading text">
                    `;
                    break;
                case 'step':
                    itemLabel = 'Step';
                    inputHtml = `
                        <textarea data-key="content" class="w-full p-2 border border-gray-300 rounded-md" rows="3" placeholder="Enter step instructions">${escapeHTML(item.content)}</textarea>
                    `;
                    break;
                case 'text':
                    itemLabel = 'Text (Paragraph)';
                    inputHtml = `
                        <textarea data-key="content" class="w-full p-2 border border-gray-300 rounded-md" rows="3" placeholder="Enter plain text">${escapeHTML(item.content)}</textarea>
                    `;
                    break;
                case 'image':
                    itemLabel = 'Image';
                    inputHtml = `
                        <div class="space-y-2">
                            <label class="block text-xs font-medium text-gray-600">Image URL</label>
                            <input type="url" data-key="src" value="${escapeHTML(item.src)}" class="w-full p-2 border border-gray-300 rounded-md" placeholder="https://...">
                            <label class="block text-xs font-medium text-gray-600">Alt Text (for accessibility)</label>
                            <input type="text" data-key="alt" value="${escapeHTML(item.alt)}" class="w-full p-2 border border-gray-300 rounded-md" placeholder="e.g., 'A bowl of pasta'">
                            
                            <label class="block text-xs font-medium text-gray-600 pt-2">Image Size</label>
                            <div class="flex items-center gap-3">
                                <input type="range" data-key="size" min="100" max="600" step="1" value="${item.size}" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                                <span class="text-sm text-gray-600 font-mono w-12 text-right" data-role="size-display">${item.size}px</span>
                            </div>
                            <!-- Added back the visual labels -->
                            <div class="flex justify-between text-xs text-gray-500 px-1">
                                <span>Tiny</span>
                                <span>Small</span>
                                <span>Medium</span>
                                <span>Large</span>
                            </div>
                        </div>
                    `;
                    break;
                case 'bubble':
                    switch(item.subtype) {
                        case 'tip': itemLabel = 'Toast (Tip)'; break;
                        case 'warning': itemLabel = 'Toast (Warning)'; break;
                        default: itemLabel = 'Toast (Note)';
                    }
                    inputHtml = `
                        <textarea data-key="content" class="w-full p-2 border border-gray-300 rounded-md" rows="2" placeholder="Enter tip or note">${escapeHTML(item.content)}</textarea>
                    `;
                    break;
            }

            const isFirst = index === 0;
            const isLast = index === recipeData.items.length - 1;

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
            `;
            contentInputs.appendChild(el);
        });
        // If inline editor is active, update its preview too
        if (recipeData.settings && recipeData.settings.editorMode === 'inline') {
            renderInlinePreview();
        }
    }

    /**
     * Re-draws the entire recipe preview based on recipeData
     */
    function renderPreview() {
        const fontStyle = recipeData.settings.fontStyle || 'display';

    // Counter for step numbering in the inline preview
    let stepCounter = 0;

        titlePreview.innerHTML = renderIconCodes(recipeData.title);
        titlePreview.className = `font-style-${fontStyle}`; 
        
        descPreview.innerHTML = renderIconCodes(recipeData.description);
        contentPreview.innerHTML = ''; 
        
        let currentList = null;

        recipeData.items.forEach(item => {
            if (item.type !== 'step' && currentList) {
                contentPreview.appendChild(currentList);
                currentList = null;
            }

            let el;
            let contentWithIcons = renderIconCodes(item.content || '');

            switch (item.type) {
                case 'heading':
                    el = document.createElement('h2');
                    el.innerHTML = contentWithIcons;
                    el.className = `font-style-${fontStyle}`;
                    contentPreview.appendChild(el);
                    break;
                case 'step':
                    if (!currentList) {
                        currentList = document.createElement('ol');
                    }
                    el = document.createElement('li');
                    el.innerHTML = contentWithIcons;
                    currentList.appendChild(el);
                    break;
                case 'text':
                    el = document.createElement('p');
                    el.className = 'recipe-text-block';
                    el.innerHTML = contentWithIcons;
                    contentPreview.appendChild(el);
                    break;
                case 'image':
                    el = document.createElement('img');
                    el.src = item.src || 'https://placehold.co/400x300?text=Image+Preview';
                    el.alt = item.alt;
                    el.style.maxWidth = `${item.size}px`; // Apply size directly
                    el.onerror = function() { this.src='https://placehold.co/400x300?text=Invalid+Image'; this.onerror=null; };
                    contentPreview.appendChild(el);
                    break;
                case 'bubble':
                    el = document.createElement('div');
                    el.className = 'toast-base';
                    switch(item.subtype) {
                        case 'tip': el.classList.add('toast-tip'); break;
                        case 'warning': el.classList.add('toast-warning'); break;
                        default: el.classList.add('toast-note');
                    }
                    el.innerHTML = contentWithIcons;
                    contentPreview.appendChild(el);
                    break;
            }
        });

        if (currentList) {
            contentPreview.appendChild(currentList);
        }
    }

    /** Inline editor rendering (live, editable preview on same page) */
    function renderInlinePreview() {
        if (!inlinePreview) return;
        inlinePreview.innerHTML = '';

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
        inlinePreview.appendChild(h1);

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
        inlinePreview.appendChild(p);

        // Content (wrap in draggable inline-item wrappers; support dblclick removal and drag/drop reordering)
        recipeData.items.forEach(item => {
            let el; 
            const contentWithIcons = renderIconCodes(item.content || '');

            switch (item.type) {
                case 'heading':
                    el = document.createElement('h2');
                    el.className = `font-style-${fontStyle} text-2xl font-bold mt-6`;
                    el.contentEditable = true;
                    el.dataset.id = item.id;
                    el.dataset.key = 'content';
                    el.innerHTML = contentWithIcons;
                    break;
                case 'step':
                    // Numbered step: create a list item with a non-editable numeric badge
                    stepCounter += 1;
                    el = document.createElement('li');
                    el.className = 'inline-item';
                    el.dataset.id = item.id;
                    el.draggable = true;

                    // Badge (number) - non-editable
                    const badge = document.createElement('span');
                    badge.className = 'step-badge';
                    badge.textContent = String(stepCounter);

                    // Editable content span inside the li so the badge itself isn't editable
                    const contentSpan = document.createElement('span');
                    contentSpan.className = 'step-content';
                    contentSpan.contentEditable = true;
                    contentSpan.dataset.id = item.id;
                    contentSpan.dataset.key = 'content';
                    contentSpan.innerHTML = contentWithIcons;

                    el.appendChild(badge);
                    el.appendChild(contentSpan);
                    break;
                case 'text':
                    el = document.createElement('p');
                    el.className = 'recipe-text-block';
                    el.contentEditable = true;
                    el.dataset.id = item.id;
                    el.dataset.key = 'content';
                    el.innerHTML = contentWithIcons;
                    break;
                case 'image':
                    el = document.createElement('img');
                    el.src = item.src || 'https://placehold.co/400x300?text=Image+Preview';
                    el.alt = item.alt || '';
                    el.style.maxWidth = `${item.size}px`;
                    el.dataset.id = item.id;
                    el.className = 'inline-edit-image';
                    el.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openImageResizer(el, item);
                    });
                    break;
                case 'bubble':
                    el = document.createElement('div');
                    el.className = 'toast-base';
                    switch(item.subtype) {
                        case 'tip': el.classList.add('toast-tip'); break;
                        case 'warning': el.classList.add('toast-warning'); break;
                        default: el.classList.add('toast-note');
                    }
                    el.contentEditable = true;
                    el.dataset.id = item.id;
                    el.dataset.key = 'content';
                    el.innerHTML = contentWithIcons;
                    break;
            }

            if (!el) return;

            // Wrap non-li items
            if (item.type === 'step') {
                // ensure an ordered list container exists
                let ol = inlinePreview.querySelector('ol');
                if (!ol) {
                    ol = document.createElement('ol');
                    inlinePreview.appendChild(ol);
                }
                // make li draggable and act as inline-item
                el.classList.add('inline-item');
                el.draggable = true;
                ol.appendChild(el);
                // dblclick to remove
                el.addEventListener('dblclick', (ev) => {
                    ev.stopPropagation();
                    if (confirm('Remove this item?')) {
                        recipeData.items = recipeData.items.filter(i => String(i.id) !== String(item.id));
                        renderBuilderInputs();
                        renderInlinePreview();
                    }
                });
                // drag handlers for li
                el.addEventListener('dragstart', (ev) => {
                    ev.dataTransfer.setData('text/plain', String(item.id));
                    el.classList.add('dragging');
                });
                el.addEventListener('dragend', (ev) => {
                    el.classList.remove('dragging');
                    inlinePreview.querySelectorAll('.inline-item.drop-target').forEach(n => n.classList.remove('drop-target'));
                });
                el.addEventListener('dragover', (ev) => { ev.preventDefault(); el.classList.add('drop-target'); });
                el.addEventListener('dragleave', (ev) => { el.classList.remove('drop-target'); });
                el.addEventListener('drop', (ev) => {
                    ev.preventDefault();
                    const dragId = ev.dataTransfer.getData('text/plain');
                    const targetId = el.dataset.id;
                    if (dragId && targetId && dragId !== targetId) {
                        reorderItems(dragId, targetId);
                        renderBuilderInputs();
                        renderInlinePreview();
                    }
                });
            } else {
                const wrapper = document.createElement('div');
                wrapper.className = 'inline-item';
                wrapper.dataset.id = item.id;
                wrapper.draggable = true;
                wrapper.appendChild(el);
                // mark new text with outline to make it visible
                if ((item.type === 'text' || item.type === 'heading' || item.type === 'step') && (!item.content || item.content.trim() === '')) {
                    el.classList.add('new-text-outline');
                    // remove outline on first input
                    const onFirstInput = () => { el.classList.remove('new-text-outline'); el.removeEventListener('input', onFirstInput); };
                    el.addEventListener('input', onFirstInput);
                    // focus newly empty elements so the user can type
                    setTimeout(() => el.focus(), 20);
                }
                inlinePreview.appendChild(wrapper);

                // dblclick to remove
                wrapper.addEventListener('dblclick', (ev) => {
                    ev.stopPropagation();
                    if (confirm('Remove this item?')) {
                        recipeData.items = recipeData.items.filter(i => String(i.id) !== String(item.id));
                        renderBuilderInputs();
                        renderInlinePreview();
                    }
                });

                // drag handlers
                wrapper.addEventListener('dragstart', (ev) => {
                    ev.dataTransfer.setData('text/plain', String(item.id));
                    wrapper.classList.add('dragging');
                });
                wrapper.addEventListener('dragend', (ev) => {
                    wrapper.classList.remove('dragging');
                    // cleanup drop-target classes
                    inlinePreview.querySelectorAll('.inline-item.drop-target').forEach(n => n.classList.remove('drop-target'));
                });
                wrapper.addEventListener('dragover', (ev) => { ev.preventDefault(); wrapper.classList.add('drop-target'); });
                wrapper.addEventListener('dragleave', (ev) => { wrapper.classList.remove('drop-target'); });
                wrapper.addEventListener('drop', (ev) => {
                    ev.preventDefault();
                    const dragId = ev.dataTransfer.getData('text/plain');
                    const targetId = wrapper.dataset.id;
                    if (dragId && targetId && dragId !== targetId) {
                        reorderItems(dragId, targetId);
                        renderBuilderInputs();
                        renderInlinePreview();
                    }
                });
            }
        });

        // Attach input listeners for editable regions
        inlinePreview.querySelectorAll('[contenteditable=true]').forEach(node => {
            node.addEventListener('input', handleInlineInput);
            node.addEventListener('blur', handleInlineBlur);
        });
        // container-level drag/drop: drop to append at end
        inlinePreview.ondragover = function(e) { e.preventDefault(); };
        inlinePreview.ondrop = function(e) {
            e.preventDefault();
            const dragId = e.dataTransfer.getData('text/plain');
            if (!dragId) return;
            // move dragged item to end
            const idx = recipeData.items.findIndex(i => String(i.id) === String(dragId));
            if (idx === -1) return;
            const [item] = recipeData.items.splice(idx,1);
            recipeData.items.push(item);
            renderBuilderInputs();
            renderInlinePreview();
        };
    }

    function handleInlineInput(e) {
        const el = e.target;
        const key = el.dataset.key;
        const id = el.dataset.id;

        if (!key) return;

        if (key === 'title' || key === 'description') {
            // Update main title/description live
            // Extract the user's text but convert any icon spans back to :icon: tokens
                const { text, caret } = getTextAndCaret(el);
                if (key === 'title') recipeData.title = text;
                else recipeData.description = text;
                // keep the builder inputs in sync
                titleInput.value = recipeData.title;
                descInput.value = recipeData.description;
                // also update preview title/desc if needed
                titlePreview.innerHTML = renderIconCodes(recipeData.title);
                descPreview.innerHTML = renderIconCodes(recipeData.description);
                // update the editable node's HTML to show icons and restore caret
                const newHtml = renderIconCodes(text);
                el.innerHTML = newHtml;
                setCaretPosition(el, caret);
            return;
        }

        // content for items
        const item = recipeData.items.find(i => String(i.id) === String(id));
        if (!item) return;
    // Preserve caret and extract code-text where icon spans become :icon: tokens
    const { text: codeText, caret: newCaret } = getTextAndCaret(el);
    item.content = codeText || '';
    const newHtml = renderIconCodes(item.content);
    el.innerHTML = newHtml;
    // restore caret to approximately the same character offset within code-text
    setCaretPosition(el, newCaret);

        // reflect changes into builder inputs if present
        const itemEl = contentInputs.querySelector(`[data-id="${item.id}"]`);
        if (itemEl) {
            const input = itemEl.querySelector('[data-key="content"]');
            if (input) input.value = item.content;
        }
    }

    /**
     * Returns the caret (character) offset within an element
     * Source pattern: compute length of range from start of element to caret
     */
    function getCaretCharacterOffsetWithin(element) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return 0;
        const range = sel.getRangeAt(0).cloneRange();
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        return preCaretRange.toString().length;
    }

    /**
     * Walk the editable element and return a plain "code text" where
     * icon spans are represented as :icon: tokens, plus the caret offset
     * (character index) inside that code text corresponding to the current
     * selection end.
     */
    function getTextAndCaret(rootEl) {
        const sel = window.getSelection();
        let focusNode = null, focusOffset = 0;
        if (sel && sel.rangeCount > 0) {
            focusNode = sel.getRangeAt(0).endContainer;
            focusOffset = sel.getRangeAt(0).endOffset;
        }

        let text = '';
        let caret = 0;
        let foundCaret = false;

        function walk(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                const nodeText = node.nodeValue || '';
                if (!foundCaret && node === focusNode) {
                    caret = text.length + Math.min(focusOffset, nodeText.length);
                    foundCaret = true;
                }
                text += nodeText;
                return;
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node;
                // If this element is an icon span, represent it as :name:
                if (el.classList && el.classList.contains('material-icons')) {
                    const token = `:${(el.textContent || '').trim()}:`;
                    // If focus is inside this element (or the element itself), approximate caret
                    if (!foundCaret && (el === focusNode || el.contains(focusNode))) {
                        // If focusNode is the element itself, use focusOffset to choose before/after
                        if (focusNode === el) {
                            caret = text.length + (focusOffset === 0 ? 0 : token.length);
                        } else {
                            // if focus is inside a descendant text node, walk that descendant to set caret
                            // but here we simply set caret to end of token to be safe
                            caret = text.length + token.length;
                        }
                        foundCaret = true;
                    }
                    text += token;
                    return;
                }

                // Normal element: walk children
                for (let i = 0; i < el.childNodes.length; i++) {
                    walk(el.childNodes[i]);
                }
            }
        }

        walk(rootEl);

        if (!foundCaret) caret = text.length;
        return { text, caret };
    }

    /**
     * Set caret (character) position within an element. Walk text nodes until
     * we locate the correct offset and set the range there.
     */
    function setCaretPosition(element, chars) {
        if (typeof chars !== 'number' || chars < 0) return;
        const selection = window.getSelection();
        const range = document.createRange();
        let nodeStack = [element];
        let node, found = false;
        let charCount = 0;

        while (nodeStack.length && !found) {
            node = nodeStack.shift();
            if (node.nodeType === 3) { // text node
                const nextCharCount = charCount + node.length;
                if (chars <= nextCharCount) {
                    range.setStart(node, Math.max(0, chars - charCount));
                    range.collapse(true);
                    found = true;
                    break;
                }
                charCount = nextCharCount;
            } else {
                // push child nodes in order
                for (let i = 0; i < node.childNodes.length; i++) {
                    nodeStack.push(node.childNodes[i]);
                }
            }
        }

        if (!found) {
            range.selectNodeContents(element);
            range.collapse(false);
        }

        // If the computed start is inside a material-icons span, move it to after that span
        try {
            let sc = range.startContainer;
            // If the start is a text node, get its parent element
            let ancestor = sc.nodeType === Node.TEXT_NODE ? sc.parentElement : sc;
            while (ancestor && ancestor !== element && !(ancestor.classList && ancestor.classList.contains && ancestor.classList.contains('material-icons'))) {
                ancestor = ancestor.parentElement;
            }
            if (ancestor && ancestor !== element && ancestor.classList && ancestor.classList.contains('material-icons')) {
                // place caret after the icon element
                range.setStartAfter(ancestor);
                range.collapse(true);
            }
        } catch (err) {
            // ignore and use original range
        }

        selection.removeAllRanges();
        selection.addRange(range);
    }

    function handleInlineBlur(e) {
        // On blur, sanitize or re-render parts if required and update model
        const el = e.target;
        if (!el) return;
        // Extract code-text (preserving :icon: tokens) and update model
        const { text } = getTextAndCaret(el);
        // Update the appropriate model field
        const key = el.dataset.key;
        const id = el.dataset.id;
        if (key === 'title') {
            recipeData.title = text;
            titleInput.value = recipeData.title;
            titlePreview.innerHTML = renderIconCodes(recipeData.title);
        } else if (key === 'description') {
            recipeData.description = text;
            descInput.value = recipeData.description;
            descPreview.innerHTML = renderIconCodes(recipeData.description);
        } else if (id) {
            const item = recipeData.items.find(i => String(i.id) === String(id));
            if (item) {
                item.content = text;
                // reflect changes into builder inputs if present
                const itemEl = contentInputs.querySelector(`[data-id="${item.id}"]`);
                if (itemEl) {
                    const input = itemEl.querySelector('[data-key="content"]');
                    if (input) input.value = item.content;
                }
            }
        }

        const newHtml = renderIconCodes(text || '');
        el.innerHTML = newHtml;
    }

    // Simple image resizer overlay
    let currentResizer = null;
    function openImageResizer(imgEl, item) {
        closeImageResizer();
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
            const itemEl = contentInputs.querySelector(`[data-id="${item.id}"]`);
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
            // apply URL and alt
            const newUrl = urlInput.value.trim();
            const newAlt = altInput.value.trim();
            if (newUrl) {
                item.src = newUrl;
                imgEl.src = newUrl;
            }
            item.alt = newAlt;
            imgEl.alt = newAlt;
            // update builder inputs if visible
            const itemEl = contentInputs.querySelector(`[data-id="${item.id}"]`);
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

    function closeImageResizer() {
        if (currentResizer) {
            currentResizer.remove();
            currentResizer = null;
        }
    }

    // --- EVENT HANDLERS ---
    
    function handleUpdateMain(e) {
        recipeData[e.target.id === 'recipe-title-input' ? 'title' : 'description'] = e.target.value;
    }

    // === CORRECTED EVENT HANDLERS ===
    /**
     * Handles ALL live input updates, including the slider moving freely.
     */
    function handleLiveInput(e) {
        const itemEl = e.target.closest('[data-id]');
        if (!itemEl) return;

        const id = itemEl.dataset.id;
        const key = e.target.dataset.key;
        const value = e.target.value;
        const item = recipeData.items.find(i => i.id == id);

        if (!item || !key) return;

        // Update the data model
        item[key] = value;

        // If it's the size slider, also update the live pixel display
        if (key === 'size') {
            const display = itemEl.querySelector('[data-role="size-display"]');
            if (display) {
                display.textContent = `${value}px`;
            }
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
            if (recipeData.settings && recipeData.settings.editorMode === 'inline') renderInlinePreview();
        }
    }

    function isInlineMode() {
        return recipeData.settings && recipeData.settings.editorMode === 'inline';
    }

    function enableInlineEditor() {
        if (!inlinePreview || !floatingAddBtn) return;
        inlinePreview.classList.remove('hidden');
        floatingAddBtn.classList.remove('hidden');
        renderInlinePreview();
        toggleOldUIVisibility(true);
    }

    function disableInlineEditor() {
        if (!inlinePreview || !floatingAddBtn) return;
        inlinePreview.classList.add('hidden');
        floatingAddBtn.classList.add('hidden');
        closeImageResizer();
        toggleOldUIVisibility(false);
    }

    function toggleOldUIVisibility(hide) {
        // Hide most of the old controls when inline mode is active,
        // but keep the badges (icon-key-btn) and settings (settings-btn).
        const elementsToToggle = [
            addTextBtn,
            addImageBtn,
            addToastBtn,
            previewBtn,
            editBtn,
            printBtn,
            contentInputs,
            titleInput,
            descInput
        ];
        // Also hide the labels for the title/description inputs so the UI
        // doesn't show empty labels when the inputs themselves are hidden.
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

    // Reorder helper: move the dragged item so it appears before the target item
    function reorderItems(dragId, targetId) {
        const dragIndex = recipeData.items.findIndex(i => String(i.id) === String(dragId));
        if (dragIndex === -1) return;
        const [dragItem] = recipeData.items.splice(dragIndex, 1);
        // find current index of target (after removal)
        const newTargetIndex = recipeData.items.findIndex(i => String(i.id) === String(targetId));
        if (newTargetIndex === -1) {
            // append to end
            recipeData.items.push(dragItem);
        } else {
            recipeData.items.splice(newTargetIndex, 0, dragItem);
        }
    }

    // --- Modal Open/Close Functions ---
    function openToastModal() { toastModal.classList.remove('hidden'); }
    function closeToastModal() { toastModal.classList.add('hidden'); }
    function handleToastSelection(subtype) {
        closeToastModal();
        addItem('bubble', subtype);
    }

    function openTextModal() { textModal.classList.remove('hidden'); }
    function closeTextModal() { textModal.classList.add('hidden'); }
    function handleTextSelection(type) {
        closeTextModal();
        addItem(type);
    }

    function openIconKeyModal() {
        renderIconList();
        iconKeyModal.classList.remove('hidden');
        iconSearchInput.focus();
    }
    function closeIconKeyModal() {
        iconKeyModal.classList.add('hidden');
        iconSearchInput.value = '';
    }
    
    function renderIconList(filter = '') {
        iconListContainer.innerHTML = '';
        const lowerFilter = filter.toLowerCase();
        const filteredIcons = COMMON_ICONS.filter(icon => icon.includes(lowerFilter));

        if (filteredIcons.length === 0) {
            iconListContainer.innerHTML = `<p class="text-gray-500 italic">No icons found.</p>`;
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
            iconListContainer.appendChild(el);
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
        globalFontStyleSelect.value = recipeData.settings.fontStyle;
        if (editorModeSelect) editorModeSelect.value = recipeData.settings.editorMode || 'classic';
        settingsModal.classList.remove('hidden');
    }
    function closeSettingsModal() {
        settingsModal.classList.add('hidden');
    }
    function handleGlobalFontChange(e) {
        recipeData.settings.fontStyle = e.target.value;
    }

    function addItem(type, subtype = null) {
        const newItem = { id: Date.now() };
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
                newItem.size = 350; // Default to 350px
                break;
            case 'bubble':
                newItem.type = 'bubble';
                newItem.subtype = subtype || 'note';
                newItem.content = '';
                break;
        }
        recipeData.items.push(newItem);
        renderBuilderInputs();
        
        const newEl = contentInputs.querySelector(`[data-id="${newItem.id}"]`);
        if (newEl) {
            const input = newEl.querySelector('input, textarea');
            if (input) input.focus();
        }
    }

    function showPreview() {
        renderPreview();
        builderPanel.classList.add('hidden');
        recipePanel.classList.remove('hidden');
        window.scrollTo(0, 0);
    }

    function showEditor() {
        builderPanel.classList.remove('hidden');
        recipePanel.classList.add('hidden');
        window.scrollTo(0, 0);
    }

    /**
     * Print helper that ensures only the desired preview is visible when printing.
     * - Inline editor mode: print only `#inline-preview`
     * - Otherwise: print only `#recipe-preview`
     */
    function handlePrint() {
        const isInline = isInlineMode();
        if (isInline) document.body.classList.add('print-inline-only');
        else document.body.classList.add('print-recipe-only');

        // Cleanup after print — use afterprint when available
        function cleanup() {
            document.body.classList.remove('print-inline-only', 'print-recipe-only');
            window.removeEventListener('afterprint', cleanup);
        }

        window.addEventListener('afterprint', cleanup);
        // Trigger the print dialog
        window.print();
        // Fallback: ensure cleanup even if afterprint doesn't fire in some environments
        setTimeout(cleanup, 1500);
    }

    // --- Helper Functions ---

    function escapeHTML(str) {
        if (typeof str !== 'string') return '';
        const p = document.createElement('p');
        p.textContent = str;
        return p.textContent;
    }

    function renderIconCodes(text) {
        if (typeof text !== 'string') return '';
        const parts = text.split(/:([a-z0-9_]+):/g);
        let result = '';
        for (let i = 0; i < parts.length; i++) {
            if (i % 2 === 0) {
                const p = document.createElement('p');
                p.textContent = parts[i];
                result += p.innerHTML.replace(/\n/g, '<br>');
            } else {
                if (COMMON_ICONS.includes(parts[i])) {
                    // Render icons as non-editable spans so the caret cannot be placed inside them
                    result += `<span class="material-icons" contenteditable="false" data-icon="${parts[i]}">${parts[i]}</span>`;
                } else {
                    const p = document.createElement('p');
                    p.textContent = `:${parts[i]}:`;
                    result += p.innerHTML;
                }
            }
        }
        return result;
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).catch(err => copyFallback(text));
        } else {
            copyFallback(text);
        }
    }
    
    function copyFallback(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('Fallback copy failed: ', err);
        }
        document.body.removeChild(ta);
    }

    // --- INITIALIZE ---
    function init() {
        // Main info
        titleInput.addEventListener('input', handleUpdateMain);
        descInput.addEventListener('input', handleUpdateMain);

        // "Add" buttons
        addTextBtn.addEventListener('click', openTextModal);
        addImageBtn.addEventListener('click', () => addItem('image'));
        addToastBtn.addEventListener('click', openToastModal);

        // Toast Modal Listeners
        closeModalBtn.addEventListener('click', closeToastModal);
        toastModalOverlay.addEventListener('click', closeToastModal);
        toastTypeTipBtn.addEventListener('click', () => handleToastSelection('tip'));
        toastTypeWarningBtn.addEventListener('click', () => handleToastSelection('warning'));
        toastTypeNoteBtn.addEventListener('click', () => handleToastSelection('note'));

        // Text Modal Listeners
        closeTextModalBtn.addEventListener('click', closeTextModal);
        textModalOverlay.addEventListener('click', closeTextModal);
        textTypeHeadingBtn.addEventListener('click', () => handleTextSelection('heading'));
        textTypeStepBtn.addEventListener('click', () => handleTextSelection('step'));
        textTypeTextBtn.addEventListener('click', () => handleTextSelection('text'));

        // Icon Key Modal Listeners
        iconKeyBtn.addEventListener('click', openIconKeyModal);
        closeIconKeyModalBtn.addEventListener('click', closeIconKeyModal);
        iconKeyModalOverlay.addEventListener('click', closeIconKeyModal);
        iconSearchInput.addEventListener('input', (e) => renderIconList(e.target.value)); 
        iconListContainer.addEventListener('click', handleIconListClick);

        // Settings Modal Listeners
        settingsBtn.addEventListener('click', openSettingsModal);
        closeSettingsModalBtn.addEventListener('click', closeSettingsModal);
        settingsModalOverlay.addEventListener('click', closeSettingsModal);
        globalFontStyleSelect.addEventListener('change', handleGlobalFontChange);
        // Editor Mode select
        if (editorModeSelect) {
            editorModeSelect.addEventListener('change', (e) => {
                recipeData.settings.editorMode = e.target.value;
                if (recipeData.settings.editorMode === 'inline') {
                    enableInlineEditor();
                } else {
                    disableInlineEditor();
                }
            });
            // set UI to current mode
            editorModeSelect.value = recipeData.settings.editorMode || 'classic';
        }

        // Floating add button behavior
        if (floatingAddBtn) {
            floatingAddBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // toggle small menu
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
                        if (m && !m.contains(e.target) && e.target !== floatingAddBtn) m.remove();
                        document.removeEventListener('click', _close);
                    });
                }, 10);
            });
        }

        // === CORRECTED Dynamic item handlers ===
        // This single 'input' listener handles all live updates smoothly.
        // It works for text fields and the slider while dragging.
        contentInputs.addEventListener('input', handleLiveInput); 
        // Removed the 'change' listener as it's no longer needed for snapping.
        contentInputs.addEventListener('click', handleContentInputClick);


        // View Toggle Listeners
        previewBtn.addEventListener('click', showPreview);
        editBtn.addEventListener('click', showEditor);
    printBtn.addEventListener('click', () => handlePrint());

        // Initial render
        renderBuilderInputs();
        titleInput.value = recipeData.title;
        descInput.value = recipeData.description;
        titlePreview.innerHTML = renderIconCodes(recipeData.title);
        descPreview.innerHTML = renderIconCodes(recipeData.description);
        globalFontStyleSelect.value = recipeData.settings.fontStyle;
        titlePreview.className = `font-style-${recipeData.settings.fontStyle}`;
        // Initialize editor mode (inline is experimental and OFF by default)
        if (recipeData.settings.editorMode === 'inline') {
            enableInlineEditor();
        } else {
            disableInlineEditor();
        }
    }

    init();
});

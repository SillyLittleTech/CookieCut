document.addEventListener('DOMContentLoaded', () => {
    
    // --- STATE ---
    let recipeData = {
        title: '',
        description: '',
        items: [],
        settings: {
            fontStyle: 'display'
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
    }

    /**
     * Re-draws the entire recipe preview based on recipeData
     */
    function renderPreview() {
        const fontStyle = recipeData.settings.fontStyle || 'display';

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
                    result += `<span class="material-icons">${parts[i]}</span>`;
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

        // === CORRECTED Dynamic item handlers ===
        // This single 'input' listener handles all live updates smoothly.
        // It works for text fields and the slider while dragging.
        contentInputs.addEventListener('input', handleLiveInput); 
        // Removed the 'change' listener as it's no longer needed for snapping.
        contentInputs.addEventListener('click', handleContentInputClick);


        // View Toggle Listeners
        previewBtn.addEventListener('click', showPreview);
        editBtn.addEventListener('click', showEditor);
        printBtn.addEventListener('click', () => window.print());

        // Initial render
        renderBuilderInputs();
        titleInput.value = recipeData.title;
        descInput.value = recipeData.description;
        titlePreview.innerHTML = renderIconCodes(recipeData.title);
        descPreview.innerHTML = renderIconCodes(recipeData.description);
        globalFontStyleSelect.value = recipeData.settings.fontStyle;
        titlePreview.className = `font-style-${recipeData.settings.fontStyle}`;
    }

    init();
});

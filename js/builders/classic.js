import { recipeData } from '../state.js';
import { dom } from '../dom.js';
import { renderIconCodes } from '../helpers.js';
import * as headingHandler from '../handlers/heading.js';
import * as stepHandler from '../handlers/step.js';
import * as textHandler from '../handlers/text.js';
import * as imageHandler from '../handlers/image.js';
import * as bubbleHandler from '../handlers/bubble.js';
// Note: renderInlinePreview is imported lazily inside the function body to avoid
// circular-import issues at module evaluation time.
let inlineRenderRequestId = 0;

/**
 * Re-draws the entire builder input form based on recipeData.
 */
export function renderBuilderInputs() {
    dom.contentInputs.innerHTML = '';

    recipeData.items.forEach((item, index) => {
        const el = document.createElement('div');
        el.setAttribute('data-id', item.id);
        el.className = 'p-4 bg-white border border-gray-300 rounded-lg shadow-sm animate-fade-in-down';

        let inputHtml = '';
        let itemLabel = '';

        switch (item.type) {
            case 'heading': {
                const result = headingHandler.getBuilderInput(item);
                itemLabel = result.label;
                inputHtml = result.inputHtml;
                break;
            }
            case 'step': {
                const result = stepHandler.getBuilderInput(item);
                itemLabel = result.label;
                inputHtml = result.inputHtml;
                break;
            }
            case 'text': {
                const result = textHandler.getBuilderInput(item);
                itemLabel = result.label;
                inputHtml = result.inputHtml;
                break;
            }
            case 'image': {
                const result = imageHandler.getBuilderInput(item);
                itemLabel = result.label;
                inputHtml = result.inputHtml;
                break;
            }
            case 'bubble': {
                const result = bubbleHandler.getBuilderInput(item);
                itemLabel = result.label;
                inputHtml = result.inputHtml;
                break;
            }
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
        dom.contentInputs.appendChild(el);
    });

    // If inline editor is active, update its preview too
    if (recipeData.settings && recipeData.settings.editorMode === 'inline') {
        const requestId = ++inlineRenderRequestId;
        // Import lazily to avoid circular dependency at evaluation time
        import('../builders/inline.js').then(({ renderInlinePreview }) => {
            if (requestId !== inlineRenderRequestId) return;
            if (!recipeData.settings || recipeData.settings.editorMode !== 'inline') return;
            renderInlinePreview();
        });
    } else {
        // invalidate queued inline rerenders after mode flips to classic
        inlineRenderRequestId += 1;
    }
}

/**
 * Re-draws the entire recipe preview based on recipeData.
 */
export function renderPreview() {
    const fontStyle = recipeData.settings.fontStyle || 'display';

    dom.titlePreview.innerHTML = renderIconCodes(recipeData.title);
    dom.titlePreview.className = `font-style-${fontStyle}`;

    dom.descPreview.innerHTML = renderIconCodes(recipeData.description);
    dom.contentPreview.innerHTML = '';

    let currentList = null;

    recipeData.items.forEach(item => {
        if (item.type !== 'step' && currentList) {
            dom.contentPreview.appendChild(currentList);
            currentList = null;
        }

        const contentWithIcons = renderIconCodes(item.content || '');

        switch (item.type) {
            case 'heading': {
                const el = headingHandler.renderPreviewElement(item, fontStyle, contentWithIcons);
                dom.contentPreview.appendChild(el);
                break;
            }
            case 'step': {
                if (!currentList) {
                    currentList = document.createElement('ol');
                }
                const el = stepHandler.renderPreviewElement(item, fontStyle, contentWithIcons);
                currentList.appendChild(el);
                break;
            }
            case 'text': {
                const el = textHandler.renderPreviewElement(item, fontStyle, contentWithIcons);
                dom.contentPreview.appendChild(el);
                break;
            }
            case 'image': {
                const el = imageHandler.renderPreviewElement(item, fontStyle, contentWithIcons);
                dom.contentPreview.appendChild(el);
                break;
            }
            case 'bubble': {
                const el = bubbleHandler.renderPreviewElement(item, fontStyle, contentWithIcons);
                dom.contentPreview.appendChild(el);
                break;
            }
        }
    });

    if (currentList) {
        dom.contentPreview.appendChild(currentList);
    }
}

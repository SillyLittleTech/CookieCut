import { escapeHTML } from '../helpers.js'
import { createScaleInputHtml, applyItemScale } from './scale.js'

/**
 * Returns the builder input configuration for a bullet item.
 * @param {object} item
 * @returns {{ label: string, inputHtml: string }}
 */
export function getBuilderInput (item) {
  return {
    label: 'Bullet',
    inputHtml: `
            <textarea data-key="content" class="w-full p-2 border border-gray-300 rounded-md" rows="3" placeholder="Enter bullet text">${escapeHTML(item.content)}</textarea>
            ${createScaleInputHtml({
              item,
              previewText: item.content,
              previewFallback: 'Sample bullet'
            })}
        `
  }
}

/**
 * Creates and returns a bullet list item for the classic preview.
 * Note: the caller is responsible for appending this to a <ul> element.
 * @param {object} item
 * @param {string} fontStyle
 * @param {string} contentWithIcons - pre-rendered HTML with icon spans
 * @returns {HTMLElement}
 */
export function renderPreviewElement (item, fontStyle, contentWithIcons) {
  const el = document.createElement('li')
  el.innerHTML = contentWithIcons
  applyItemScale(el, item, 'preview')
  return el
}

/**
 * Creates and returns inline-editable elements for a bullet item.
 * Returns an object with badge and contentSpan for the caller to assemble.
 * @param {object} item
 * @param {string} fontStyle
 * @param {string} contentWithIcons - pre-rendered HTML with icon spans
 * @returns {{ badge: HTMLElement, contentSpan: HTMLElement }}
 */
export function renderInlineElement (item, fontStyle, contentWithIcons) {
  const badge = document.createElement('span')
  badge.className = 'bullet-badge'
  badge.textContent = '•'

  const contentSpan = document.createElement('span')
  contentSpan.className = 'bullet-content'
  contentSpan.contentEditable = true
  contentSpan.dataset.id = item.id
  contentSpan.dataset.key = 'content'
  contentSpan.innerHTML = contentWithIcons
  applyItemScale(contentSpan, item, 'inline')

  return { badge, contentSpan }
}

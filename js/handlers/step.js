import { escapeHTML } from '../helpers.js'
import { createScaleInputHtml, applyItemScale } from './scale.js'

/**
 * Returns the builder input configuration for a step item.
 * @param {object} item
 * @returns {{ label: string, inputHtml: string }}
 */
export function getBuilderInput (item) {
  return {
    label: 'Step',
    inputHtml: `
            <textarea data-key="content" class="w-full p-2 border border-gray-300 rounded-md" rows="3" placeholder="Enter step instructions">${escapeHTML(item.content)}</textarea>
            ${createScaleInputHtml({
              item,
              previewText: item.content,
              previewFallback: 'Sample step'
            })}
        `
  }
}

/**
 * Creates and returns a step list item for the classic preview.
 * Note: the caller is responsible for appending this to an <ol> element.
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
 * Creates and returns the inline-editable elements for a step item.
 * Returns an object with badge and contentSpan for the caller to assemble.
 * @param {object} item
 * @param {string} fontStyle
 * @param {string} contentWithIcons - pre-rendered HTML with icon spans
 * @param {number} stepNumber - the step's display number
 * @returns {{ badge: HTMLElement, contentSpan: HTMLElement }}
 */
export function renderInlineElement (
  item,
  fontStyle,
  contentWithIcons,
  stepNumber
) {
  // Badge (number) - non-editable
  const badge = document.createElement('span')
  badge.className = 'step-badge'
  badge.textContent = String(stepNumber)

  // Editable content span inside the li so the badge itself isn't editable
  const contentSpan = document.createElement('span')
  contentSpan.className = 'step-content'
  contentSpan.contentEditable = true
  contentSpan.dataset.id = item.id
  contentSpan.dataset.key = 'content'
  contentSpan.innerHTML = contentWithIcons
  applyItemScale(contentSpan, item, 'inline')

  return { badge, contentSpan }
}

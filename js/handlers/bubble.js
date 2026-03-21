import { escapeHTML } from '../helpers.js'
import { createScaleInputHtml, applyItemScale } from './scale.js'

/**
 * Returns the builder input configuration for a bubble/toast item.
 * @param {object} item
 * @returns {{ label: string, inputHtml: string }}
 */
export function getBuilderInput (item) {
  const labelBySubtype = {
    tip: 'Toast (Tip)',
    warning: 'Toast (Warning)'
  }
  const label = labelBySubtype[item.subtype] || 'Toast (Note)'
  return {
    label,
    inputHtml: `
            <textarea data-key="content" class="w-full p-2 border border-gray-300 rounded-md" rows="2" placeholder="Enter tip or note">${escapeHTML(item.content)}</textarea>
            ${createScaleInputHtml({
              item,
              previewText: item.content,
              previewFallback: 'Sample toast'
            })}
        `
  }
}

/**
 * Creates and returns a bubble/toast preview DOM element.
 * @param {object} item
 * @param {string} fontStyle
 * @param {string} contentWithIcons - pre-rendered HTML with icon spans
 * @returns {HTMLElement}
 */
export function renderPreviewElement (item, fontStyle, contentWithIcons) {
  const el = document.createElement('div')
  el.className = 'toast-base'
  switch (item.subtype) {
    case 'tip':
      el.classList.add('toast-tip')
      break
    case 'warning':
      el.classList.add('toast-warning')
      break
    default:
      el.classList.add('toast-note')
  }
  el.innerHTML = contentWithIcons
  applyItemScale(el, item, 'preview')
  return el
}

/**
 * Creates and returns an inline-editable bubble/toast element.
 * @param {object} item
 * @param {string} fontStyle
 * @param {string} contentWithIcons - pre-rendered HTML with icon spans
 * @returns {HTMLElement}
 */
export function renderInlineElement (item, fontStyle, contentWithIcons) {
  const el = document.createElement('div')
  el.className = 'toast-base'
  switch (item.subtype) {
    case 'tip':
      el.classList.add('toast-tip')
      break
    case 'warning':
      el.classList.add('toast-warning')
      break
    default:
      el.classList.add('toast-note')
  }
  el.contentEditable = true
  el.dataset.id = item.id
  el.dataset.key = 'content'
  el.innerHTML = contentWithIcons
  applyItemScale(el, item, 'inline')
  return el
}

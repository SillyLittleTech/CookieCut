import { escapeHTML } from '../helpers.js'
import { applyItemScale } from './scale.js'

/**
 * Returns the builder input configuration for a dropdown item.
 * @param {object} item
 * @returns {{ label: string, inputHtml: string }}
 */
export function getBuilderInput (item) {
  return {
    label:
      '<span class="material-icons align-middle text-base">arrow_drop_down_circle</span> Dropdown',
    inputHtml: `
      <div class="space-y-2">
        <input type="text" data-key="content" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100" placeholder="Dropdown label (optional)" value="${escapeHTML(item.content || '')}">
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Options (comma-separated)</label>
        <textarea data-key="options" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100" rows="3" placeholder="Option 1, Option 2, Option 3">${escapeHTML(item.options || '')}</textarea>
      </div>
    `
  }
}

/**
 * Creates a dropdown element (shared by preview and inline renderers).
 * @param {object} item
 * @returns {HTMLElement}
 */
function createDropdownElement (item) {
  const wrapper = document.createElement('div')
  wrapper.className = 'html-dropdown-wrapper recipe-text-block'

  if (item.content) {
    const label = document.createElement('label')
    label.className = 'html-dropdown-label'
    label.textContent = item.content
    wrapper.appendChild(label)
  }

  const select = document.createElement('select')
  select.className = 'html-dropdown'

  const optionsText = item.options || ''
  const options = optionsText
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  if (!options.length) {
    const placeholder = document.createElement('option')
    placeholder.textContent = 'Select an option...'
    placeholder.disabled = true
    placeholder.selected = true
    select.appendChild(placeholder)
  } else {
    options.forEach((optText) => {
      const opt = document.createElement('option')
      opt.textContent = optText
      opt.value = optText
      select.appendChild(opt)
    })
  }

  applyItemScale(wrapper, item, 'preview')
  wrapper.appendChild(select)
  return wrapper
}

/**
 * Creates and returns a dropdown preview DOM element.
 * @param {object} item
 * @returns {HTMLElement}
 */
export function renderPreviewElement (item) {
  return createDropdownElement(item)
}

/**
 * Creates and returns an inline dropdown element.
 * @param {object} item
 * @returns {HTMLElement}
 */
export function renderInlineElement (item) {
  return createDropdownElement(item)
}

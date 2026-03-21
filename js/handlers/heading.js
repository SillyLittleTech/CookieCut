import { escapeHTML } from '../helpers.js'

/**
 * Returns the builder input configuration for a heading item.
 * @param {object} item
 * @returns {{ label: string, inputHtml: string }}
 */
export function getBuilderInput (item) {
  const scale = item.scale != null ? Number(item.scale) : 100
  return {
    label: 'Heading (H2)',
    inputHtml: `
            <input type="text" data-key="content" value="${escapeHTML(item.content)}" class="w-full p-2 border border-gray-300 rounded-md" placeholder="Enter heading text">
            <div class="scale-input-container mt-2">
                <label class="block text-xs font-medium text-gray-600">Text Scale</label>
                <div class="flex items-center gap-3 mt-1">
                    <input type="range" data-key="scale" min="50" max="300" step="5" value="${scale}" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                    <span class="text-sm text-gray-600 font-mono w-12 text-right" data-role="scale-display">${scale}%</span>
                </div>
                <p class="scale-preview font-bold text-gray-500 mt-1 truncate" data-role="scale-preview" style="font-size: ${scale / 100}em">${escapeHTML(item.content) || 'Sample Heading'}</p>
            </div>
        `
  }
}

/**
 * Creates and returns a heading preview DOM element.
 * @param {object} item
 * @param {string} fontStyle
 * @param {string} contentWithIcons - pre-rendered HTML with icon spans
 * @returns {HTMLElement}
 */
export function renderPreviewElement (item, fontStyle, contentWithIcons) {
  const el = document.createElement('h2')
  el.innerHTML = contentWithIcons
  el.className = `font-style-${fontStyle}`
  const scale = item.scale != null ? Number(item.scale) : 100
  if (scale !== 100) {
    el.style.fontSize = `${scale / 100}em`
  }
  return el
}

/**
 * Creates and returns an inline-editable heading element.
 * @param {object} item
 * @param {string} fontStyle
 * @param {string} contentWithIcons - pre-rendered HTML with icon spans
 * @returns {HTMLElement}
 */
export function renderInlineElement (item, fontStyle, contentWithIcons) {
  const el = document.createElement('h2')
  el.className = `font-style-${fontStyle} text-2xl font-bold mt-6`
  el.contentEditable = true
  el.dataset.id = item.id
  el.dataset.key = 'content'
  el.innerHTML = contentWithIcons
  const scale = item.scale != null ? Number(item.scale) : 100
  if (scale !== 100) {
    el.style.fontSize = `${scale / 100}em`
  }
  return el
}

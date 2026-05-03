import { escapeHTML } from '../helpers.js'

/**
 * Returns the builder input configuration for a code script item (raw markup;
 * never executed in CookieCut preview).
 * @param {object} item
 * @returns {{ label: string, inputHtml: string }}
 */
export function getBuilderInput (item) {
  return {
    label:
      '<span class="material-icons align-middle text-base">code</span> Code script',
    inputHtml: `
      <div class="space-y-2">
        <p class="text-xs text-gray-500 dark:text-gray-400">Raw HTML or scripts for export or hosting. Nothing here runs inside CookieCut preview.</p>
        <textarea data-key="content" rows="12" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md font-mono text-xs dark:bg-gray-700 dark:text-gray-100" placeholder="&lt;script&gt;...&lt;/script&gt;">${escapeHTML(item.content || '')}</textarea>
      </div>
    `
  }
}

/**
 * @param {object} item
 * @returns {HTMLElement}
 */
function createCodescriptElement (item) {
  const wrap = document.createElement('div')
  wrap.className = 'html-codescript-wrapper recipe-text-block'

  const note = document.createElement('p')
  note.className = 'html-codescript-note'
  note.textContent =
    'Scripts are not executed in this preview. Content is shown as source only.'

  const pre = document.createElement('pre')
  pre.className = 'html-codescript-pre'
  pre.textContent = item.content || ''

  wrap.appendChild(note)
  wrap.appendChild(pre)
  return wrap
}

/**
 * @param {object} item
 * @returns {HTMLElement}
 */
export function renderPreviewElement (item) {
  return createCodescriptElement(item)
}

/**
 * @param {object} item
 * @returns {HTMLElement}
 */
export function renderInlineElement (item) {
  return createCodescriptElement(item)
}

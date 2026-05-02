import { escapeHTML } from '../helpers.js'

/**
 * Parse a JSON links string into an array of { label, href } objects.
 * Falls back to an empty array on any parse error.
 * @param {string} linksStr
 * @returns {Array<{label: string, href: string}>}
 */
function parseNavLinks (linksStr) {
  if (!linksStr) return []
  try {
    const parsed = JSON.parse(linksStr)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (l) => l && typeof l === 'object' && typeof l.label === 'string'
    )
  } catch {
    return []
  }
}

/**
 * Returns the builder input configuration for a navmenu item.
 * @param {object} item
 * @returns {{ label: string, inputHtml: string }}
 */
export function getBuilderInput (item) {
  return {
    label:
      '<span class="material-icons align-middle text-base">explore</span> Navigation',
    inputHtml: `
      <div class="space-y-2">
        <input type="text" data-key="content" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100" placeholder="Site / brand name" value="${escapeHTML(item.content || '')}">
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Navigation Links (JSON array)</label>
        <textarea data-key="links" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md font-mono text-xs dark:bg-gray-700 dark:text-gray-100" rows="4" placeholder='[{"label":"Home","href":"#home"},{"label":"About","href":"#about"}]'>${escapeHTML(item.links || '')}</textarea>
        <p class="text-xs text-gray-500">Each entry needs a "label" and "href". Only one Navigation element is allowed per document.</p>
      </div>
    `
  }
}

/**
 * Creates a navigation bar element (shared by preview and inline renderers).
 * @param {object} item
 * @returns {HTMLElement}
 */
function createNavElement (item) {
  const nav = document.createElement('nav')
  nav.className = 'html-navmenu'

  const brand = document.createElement('span')
  brand.className = 'html-navmenu-brand'
  brand.textContent = item.content || 'Navigation'
  nav.appendChild(brand)

  const linkList = document.createElement('ul')
  linkList.className = 'html-navmenu-links'

  const links = parseNavLinks(item.links)
  links.forEach((link) => {
    const li = document.createElement('li')
    const a = document.createElement('a')
    a.href = link.href || '#'
    a.textContent = link.label || ''
    a.className = 'html-navmenu-link'
    li.appendChild(a)
    linkList.appendChild(li)
  })

  nav.appendChild(linkList)
  return nav
}

/**
 * Creates and returns a navmenu preview DOM element.
 * @param {object} item
 * @returns {HTMLElement}
 */
export function renderPreviewElement (item) {
  return createNavElement(item)
}

/**
 * Creates and returns an inline navmenu element.
 * @param {object} item
 * @returns {HTMLElement}
 */
export function renderInlineElement (item) {
  return createNavElement(item)
}

import { escapeHTML, renderRichText } from '../helpers.js'

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
      (linkEntry) =>
        linkEntry &&
        typeof linkEntry === 'object' &&
        typeof linkEntry.label === 'string'
    )
  } catch {
    // Fallback: simple newline-separated format:
    // Label | href
    // Home | #home
    // About | https://example.com
    return String(linksStr)
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split('|').map((p) => p.trim())
        const label = parts[0] || ''
        const href = parts[1] || '#'
        return { label, href }
      })
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
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Navigation links</label>
        <textarea data-key="links" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md font-mono text-xs dark:bg-gray-700 dark:text-gray-100" rows="4" placeholder="Home | #home&#10;About | #about">${escapeHTML(item.links || '')}</textarea>
        <p class="text-xs text-gray-500 dark:text-gray-400">One per line: <code>Label | URL</code>. JSON arrays are still supported. Only one Navigation element is allowed per document.</p>
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
  brand.innerHTML = renderRichText(item.content || 'Navigation')
  nav.appendChild(brand)

  const linkList = document.createElement('ul')
  linkList.className = 'html-navmenu-links'

  const links = parseNavLinks(item.links)
  links.forEach((link) => {
    const li = document.createElement('li')
    const a = document.createElement('a')
    a.href = link.href || '#'
    a.innerHTML = renderRichText(link.label || '')
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

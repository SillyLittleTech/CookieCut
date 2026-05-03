import { initDom } from './js/dom.js'
import { init } from './js/global.js'

/**
 * Fetches an HTML partial and injects it into the given container element.
 * @param {HTMLElement} container - target element to inject into
 * @param {string} url - URL of the HTML partial file
 */
async function injectPartial (container, url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load partial: ${url} (${response.status})`)
  }
  const html = await response.text()
  container.insertAdjacentHTML('beforeend', html)
}

/**
 * Loads all HTML partials into the page before the app initialises.
 */
async function loadPartials () {
  const appContainer = document.getElementById('app-container')
  if (!appContainer) {
    throw new Error('Missing #app-container in index.html')
  }
  const body = document.body

  // Builder and preview panels go inside the main app container
  await injectPartial(appContainer, 'partials/builder-panel.html')
  await injectPartial(appContainer, 'partials/template-gallery.html')
  await injectPartial(appContainer, 'partials/preview-panel.html')

  // Modals and inline editor elements are appended directly to body
  // (required for correct stacking context of fixed/absolute positioned elements)
  await injectPartial(body, 'partials/modals.html')
  await injectPartial(body, 'partials/inline-elements.html')
}

// Bootstrap: load partials → wire up DOM refs → initialise the app
function showBootstrapError (error) {
  const container = document.getElementById('app-container') || document.body
  const wrap = document.createElement('div')
  wrap.style.whiteSpace = 'pre-wrap'
  wrap.style.fontFamily = 'ui-monospace, monospace'
  wrap.style.fontSize = '12px'
  wrap.style.padding = '16px'
  wrap.style.border = '1px solid #ef4444'
  wrap.style.borderRadius = '8px'
  wrap.style.background = '#fef2f2'
  wrap.style.color = '#7f1d1d'
  wrap.textContent = `CookieCut failed to start.\n\n${
    error?.stack ? String(error.stack) : String(error)
  }`
  container.appendChild(wrap)
}

loadPartials()
  .then(() => {
    initDom()
    init()
  })
  .catch((err) => {
    console.error('Bootstrap failed:', err)
    showBootstrapError(err)
  })

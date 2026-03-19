import { initDom } from './js/dom.js';
import { init } from './js/global.js';

/**
 * Fetches an HTML partial and injects it into the given container element.
 * @param {HTMLElement} container - target element to inject into
 * @param {string} url - URL of the HTML partial file
 */
async function injectPartial(container, url) {
    const response = await fetch(url);
    const html = await response.text();
    container.insertAdjacentHTML('beforeend', html);
}

/**
 * Loads all HTML partials into the page before the app initialises.
 */
async function loadPartials() {
    const appContainer = document.getElementById('app-container');
    const body = document.body;

    // Builder and preview panels go inside the main app container
    await injectPartial(appContainer, 'partials/builder-panel.html');
    await injectPartial(appContainer, 'partials/preview-panel.html');

    // Modals and inline editor elements are appended directly to body
    // (required for correct stacking context of fixed/absolute positioned elements)
    await injectPartial(body, 'partials/modals.html');
    await injectPartial(body, 'partials/inline-elements.html');
}

// Bootstrap: load partials → wire up DOM refs → initialise the app
loadPartials().then(() => {
    initDom();
    init();
});

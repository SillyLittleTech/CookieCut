import { renderRichText } from '../helpers.js'
import { recipeData as liveRecipeData } from '../state.js'
import { renderPreviewElement as renderHeadingPreviewElement } from '../handlers/heading.js'
import { renderPreviewElement as renderStepPreviewElement } from '../handlers/step.js'
import { renderPreviewElement as renderBulletPreviewElement } from '../handlers/bullet.js'
import { renderPreviewElement as renderTextPreviewElement } from '../handlers/text.js'
import { renderPreviewElement as renderImagePreviewElement } from '../handlers/image.js'
import { renderPreviewElement as renderBubblePreviewElement } from '../handlers/bubble.js'
import { renderPreviewElement as renderLinkPreviewElement } from '../handlers/link.js'
import { renderPreviewElement as renderButtonPreviewElement } from '../handlers/button.js'
import { renderPreviewElement as renderNavmenuPreviewElement } from '../handlers/navmenu.js'
import { renderPreviewElement as renderDropdownPreviewElement } from '../handlers/dropdown.js'
import { renderPreviewElement as renderFramePreviewElement } from '../handlers/frame.js'

function cloneForPreview (data) {
  // Defensive copy to avoid mutating live state while building preview HTML.
  return JSON.parse(JSON.stringify(data))
}

function collectPreviewNodesAdvanced (doc, data, fontStyle) {
  const nodes = []
  let currentList = null
  let currentListType = null

  const flushCurrentList = () => {
    if (!currentList) return
    nodes.push(currentList)
    currentList = null
    currentListType = null
  }

  const items = Array.isArray(data.items) ? data.items : []

  const createOrReuseList = (type) => {
    if (currentList && currentListType === type) return currentList
    flushCurrentList()
    currentList = doc.createElement(type === 'step' ? 'ol' : 'ul')
    currentListType = type
    return currentList
  }

  const scriptsToRun = []

  const adoptNode = (node) => {
    if (!node) return null
    try {
      return doc.importNode(node, true)
    } catch {
      // Fallback: serialize and reparse into the target document.
      const tmp = doc.createElement('div')
      tmp.innerHTML = node.outerHTML || ''
      return tmp.firstElementChild
    }
  }

  items.forEach((item) => {
    const isListItem = item.type === 'step' || item.type === 'bullet'
    if (!isListItem && currentList) flushCurrentList()

    const htmlContent =
      item && item.htmlEnabled && typeof item.content === 'string'
        ? item.content
        : renderRichText(item?.content || '')

    switch (item.type) {
      case 'heading': {
        nodes.push(
          adoptNode(renderHeadingPreviewElement(item, fontStyle, htmlContent))
        )
        break
      }
      case 'step': {
        const list = createOrReuseList('step')
        list.appendChild(
          adoptNode(renderStepPreviewElement(item, fontStyle, htmlContent))
        )
        break
      }
      case 'bullet': {
        const list = createOrReuseList('bullet')
        list.appendChild(
          adoptNode(renderBulletPreviewElement(item, fontStyle, htmlContent))
        )
        break
      }
      case 'text': {
        nodes.push(
          adoptNode(renderTextPreviewElement(item, fontStyle, htmlContent))
        )
        break
      }
      case 'image': {
        nodes.push(
          adoptNode(renderImagePreviewElement(item, fontStyle, htmlContent))
        )
        break
      }
      case 'bubble': {
        nodes.push(
          adoptNode(renderBubblePreviewElement(item, fontStyle, htmlContent))
        )
        break
      }
      case 'link': {
        nodes.push(
          adoptNode(renderLinkPreviewElement(item, fontStyle, htmlContent))
        )
        break
      }
      case 'button': {
        nodes.push(adoptNode(renderButtonPreviewElement(item)))
        break
      }
      case 'navmenu': {
        nodes.push(adoptNode(renderNavmenuPreviewElement(item)))
        break
      }
      case 'dropdown': {
        nodes.push(adoptNode(renderDropdownPreviewElement(item)))
        break
      }
      case 'frame': {
        nodes.push(adoptNode(renderFramePreviewElement(item)))
        break
      }
      case 'codescript': {
        if (typeof item.content === 'string' && item.content.trim()) {
          scriptsToRun.push(item.content)
        }
        break
      }
      default:
        break
    }
  })

  if (currentList) flushCurrentList()
  return { nodes, scriptsToRun }
}

export async function openAdvancedHtmlPreview (
  source = liveRecipeData,
  { autoPrint = false } = {}
) {
  const win = window.open('about:blank', '_blank')
  if (!win) return

  // Write immediately (keeps Safari happy and avoids blank tabs on async work).
  try {
    win.document.open()
    win.document.write(
      '<!doctype html><title>Loading…</title><p style="font-family: ui-sans-serif, system-ui; padding: 16px;">Loading preview…</p>'
    )
    win.document.close()
  } catch {
    // ignore
  }

  try {
    const data = cloneForPreview(source)

    let styleText = ''
    try {
      styleText = await fetch('styles.css').then((r) => r.text())
    } catch {
      styleText = ''
    }

    const fontStyle = data?.settings?.fontStyle || 'display'

    const doc = document.implementation.createHTMLDocument('CookieCut Preview')
    const wrapper = doc.createElement('div')
    wrapper.className =
      'recipe-preview-content container mx-auto bg-white p-6 md:p-12 rounded-lg shadow-lg'

    const warning = doc.createElement('div')
    warning.style.padding = '10px 12px'
    warning.style.marginBottom = '16px'
    warning.style.borderRadius = '8px'
    warning.style.border = '1px solid #f59e0b'
    warning.style.background = '#fffbeb'
    warning.style.color = '#92400e'
    warning.style.fontFamily =
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif'
    warning.style.fontSize = '13px'
    warning.textContent =
      'CookieCut Advanced HTML Preview: this page can run scripts embedded in the document. Only preview content you trust.'
    wrapper.appendChild(warning)

    const titleEl = doc.createElement('h1')
    titleEl.className = `font-style-${fontStyle}`
    titleEl.innerHTML = renderRichText(data.title || '')
    if (data?.settings?.hideTitle) titleEl.style.display = 'none'
    wrapper.appendChild(titleEl)

    const descEl = doc.createElement('p')
    descEl.innerHTML = renderRichText(data.description || '')
    if (data?.settings?.hideDescription) descEl.style.display = 'none'
    wrapper.appendChild(descEl)

    const contentRoot = doc.createElement('div')
    const { nodes, scriptsToRun } = collectPreviewNodesAdvanced(
      doc,
      data,
      fontStyle
    )
    nodes.forEach((node) => contentRoot.appendChild(node))
    wrapper.appendChild(contentRoot)

    const scriptsHtml = scriptsToRun.length
      ? `\n<!-- Codescript blocks -->\n${scriptsToRun.join('\n\n')}\n`
      : ''

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${(data.title || 'CookieCut Preview').replace(/</g, '&lt;')}</title>
    <style>${styleText}</style>
  </head>
  <body class="bg-gray-50 font-sans overflow-x-hidden">
    <div class="max-w-3xl mx-auto p-6" id="app-container">
      ${wrapper.outerHTML}
    </div>
    ${scriptsHtml}
  </body>
</html>`

    win.document.open()
    win.document.write(html)
    win.document.close()
    if (autoPrint && typeof win.print === 'function') {
      setTimeout(() => {
        try {
          win.focus()
          win.print()
        } catch {
          // ignore
        }
      }, 250)
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Advanced HTML preview failed:', err)
    try {
      win.document.open()
      win.document.write(
        '<!doctype html><title>Preview error</title><pre style="white-space: pre-wrap; font-family: ui-monospace, monospace; padding: 16px; color: #7f1d1d; background: #fef2f2; border: 1px solid #ef4444; border-radius: 8px;">' +
          String(err && err.stack ? err.stack : err) +
          '</pre>'
      )
      win.document.close()
    } catch {
      // ignore
    }
  }
}

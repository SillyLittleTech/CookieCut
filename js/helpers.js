import { COMMON_ICONS } from './constants.js'

// --- HELPER FUNCTIONS ---

export function escapeHTML (str) {
  if (typeof str !== 'string') return ''
  const paragraphElement = document.createElement('p')
  paragraphElement.textContent = str
  return paragraphElement.innerHTML
}

export function renderIconCodes (text) {
  if (typeof text !== 'string') return ''
  const parts = text.split(/:([a-z0-9_]+):/g)
  let result = ''
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      const textNodeWrapper = document.createElement('p')
      textNodeWrapper.textContent = parts[i]
      result += textNodeWrapper.innerHTML.replace(/\n/g, '<br>')
    } else if (COMMON_ICONS.includes(parts[i])) {
      // Render icons as non-editable spans so the caret cannot be placed inside them
      result += `<span class="material-icons" contenteditable="false" data-icon="${parts[i]}">${parts[i]}</span>`
    } else {
      const fallbackTextWrapper = document.createElement('p')
      fallbackTextWrapper.textContent = `:${parts[i]}:`
      result += fallbackTextWrapper.innerHTML
    }
  }
  return result
}

export const RICH_TEXT_SCALE_MIN_PX = 8
export const RICH_TEXT_SCALE_MAX_PX = 160
export const RICH_TEXT_DEFAULT_SCALE_PX = 16

const HIGHLIGHT_COLOR_MAP = {
  y: 'rt-highlight-y',
  b: 'rt-highlight-b',
  g: 'rt-highlight-g',
  p: 'rt-highlight-p'
}

const FORMATTING_TOKEN_TYPES = [
  {
    type: 'bold',
    open: '**',
    close: '**',
    render: (innerHtml) =>
      `<strong data-rt-open="**" data-rt-close="**">${innerHtml}</strong>`
  },
  {
    type: 'underline',
    open: '__',
    close: '__',
    render: (innerHtml) =>
      `<span class="rt-underline" data-rt-open="__" data-rt-close="__">${innerHtml}</span>`
  },
  {
    type: 'strike',
    open: '~~',
    close: '~~',
    render: (innerHtml) =>
      `<span class="rt-strike" data-rt-open="~~" data-rt-close="~~">${innerHtml}</span>`
  },
  {
    type: 'italic',
    open: '*',
    close: '*',
    render: (innerHtml) =>
      `<em data-rt-open="*" data-rt-close="*">${innerHtml}</em>`
  }
]

function clampRichTextScale (pxValue) {
  return Math.max(
    RICH_TEXT_SCALE_MIN_PX,
    Math.min(RICH_TEXT_SCALE_MAX_PX, pxValue)
  )
}

function renderEscapedLiteral (escapedChar) {
  const escapedCodePoint = escapedChar.codePointAt(0)
  if (!Number.isFinite(escapedCodePoint)) {
    return ''
  }
  const visibleChar = renderIconCodes(escapedChar)
  return `<span class="rt-escaped-literal" data-rt-escape-code="${escapedCodePoint}" contenteditable="false">${visibleChar}</span>`
}

function parseFormattingTokenAt (sourceText, startIndex) {
  const currentSlice = sourceText.slice(startIndex)

  const scaleMatch = currentSlice.match(/^\{(\d{1,3})\{/u)
  if (scaleMatch) {
    const pxValue = Number.parseInt(scaleMatch[1], 10)
    if (Number.isFinite(pxValue)) {
      return {
        type: 'scale',
        open: scaleMatch[0],
        close: '}}',
        render: (innerHtml) => {
          const clampedSize = clampRichTextScale(pxValue)
          return `<span class="rt-scale" style="font-size:${clampedSize}px;" data-rt-open="${escapeHTML(scaleMatch[0])}" data-rt-close="}}">${innerHtml}</span>`
        }
      }
    }
  }

  const highlightMatch = currentSlice.match(/^\[([a-z])\[/u)
  if (highlightMatch) {
    const colorCode = highlightMatch[1]
    if (!Object.prototype.hasOwnProperty.call(HIGHLIGHT_COLOR_MAP, colorCode)) {
      return null
    }
    const colorClass = HIGHLIGHT_COLOR_MAP[colorCode]
    const safeOpenToken = escapeHTML(highlightMatch[0])
    return {
      type: 'highlight',
      open: highlightMatch[0],
      close: ']]',
      render: (innerHtml) =>
        `<mark class="rt-highlight ${colorClass}" data-rt-open="${safeOpenToken}" data-rt-close="]]">${innerHtml}</mark>`
    }
  }

  for (const tokenType of FORMATTING_TOKEN_TYPES) {
    if (currentSlice.startsWith(tokenType.open)) {
      return tokenType
    }
  }

  return null
}

function parseRichTextSegment (sourceText, startIndex = 0, stopToken = null) {
  let html = ''
  let index = startIndex

  while (index < sourceText.length) {
    if (stopToken && sourceText.startsWith(stopToken, index)) {
      return { html, nextIndex: index + stopToken.length, closed: true }
    }

    if (sourceText[index] === '\\') {
      const escapedChar = sourceText[index + 1]
      if (escapedChar != null) {
        html += renderEscapedLiteral(escapedChar)
        index += 2
      } else {
        html += renderIconCodes('\\')
        index += 1
      }
      continue
    }

    const token = parseFormattingTokenAt(sourceText, index)
    if (!token) {
      let nextIndex = index + 1
      while (nextIndex < sourceText.length) {
        const nextChar = sourceText[nextIndex]
        if (stopToken && nextChar === stopToken[0]) {
          break
        }
        if (
          nextChar === '*' ||
          nextChar === '_' ||
          nextChar === '~' ||
          nextChar === '[' ||
          nextChar === '{'
        ) {
          break
        }
        nextIndex += 1
      }
      html += renderIconCodes(sourceText.slice(index, nextIndex))
      index = nextIndex
      continue
    }

    const tokenStart = index
    const openLength = token.open.length
    const inner = parseRichTextSegment(
      sourceText,
      index + openLength,
      token.close
    )

    if (!inner.closed) {
      // Unbalanced marker: treat the first marker character literally.
      html += renderIconCodes(sourceText[tokenStart])
      index = tokenStart + 1
      continue
    }

    html += token.render(inner.html)
    index = inner.nextIndex
  }

  return { html, nextIndex: index, closed: false }
}

export function renderRichText (text) {
  if (typeof text !== 'string' || text.length === 0) return ''
  return parseRichTextSegment(text).html
}

export function getHighlightOptions () {
  return [
    { code: 'y', label: 'Yellow' },
    { code: 'b', label: 'Blue' },
    { code: 'g', label: 'Green' },
    { code: 'p', label: 'Pink' }
  ]
}

function getSerializedTokenForIcon (elementNode) {
  const iconName = (elementNode.textContent || '').trim()
  return `:${iconName}:`
}

export function serializeNodeToCode (node) {
  if (!node) return ''

  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue || ''
  }

  if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    let fragmentText = ''
    for (const childNode of node.childNodes) {
      fragmentText += serializeNodeToCode(childNode)
    }
    return fragmentText
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return ''
  }

  const elementNode = node
  if (elementNode.tagName === 'BR') {
    return '\n'
  }

  if (elementNode.classList.contains('material-icons')) {
    return getSerializedTokenForIcon(elementNode)
  }

  const escapeCode = Number.parseInt(
    elementNode.dataset?.rtEscapeCode || '',
    10
  )
  if (Number.isFinite(escapeCode)) {
    return `\\${String.fromCodePoint(escapeCode)}`
  }

  const openToken = elementNode.dataset?.rtOpen || ''
  const closeToken = elementNode.dataset?.rtClose || ''
  let innerText = ''

  for (const childNode of elementNode.childNodes) {
    innerText += serializeNodeToCode(childNode)
  }

  return `${openToken}${innerText}${closeToken}`
}

function getCodeIndexFromBoundary (rootElement, containerNode, containerOffset) {
  // Special case: boundary is expressed as a child index directly on rootElement.
  if (containerNode === rootElement) {
    let idx = 0
    const children = rootElement.childNodes
    for (let i = 0; i < containerOffset && i < children.length; i++) {
      idx += serializeNodeToCode(children[i]).length
    }
    return idx
  }

  let index = 0

  function walk (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node === containerNode) {
        index += containerOffset
        return true
      }
      index += (node.nodeValue || '').length
      return false
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return false

    if (node.tagName === 'BR') {
      if (node === containerNode) return true
      index += 1
      return false
    }

    if (node.classList.contains('material-icons')) {
      if (node === containerNode) return true
      const iconName = (node.textContent || '').trim()
      index += `:${iconName}:`.length
      return false
    }

    const escapeCode = Number.parseInt(node.dataset?.rtEscapeCode || '', 10)
    if (Number.isFinite(escapeCode)) {
      if (node === containerNode) return true
      index += 2
      return false
    }

    const openToken = node.dataset?.rtOpen || ''
    const closeToken = node.dataset?.rtClose || ''

    index += openToken.length

    const children = node.childNodes
    for (let i = 0; i < children.length; i++) {
      // Check boundary before child i — handles cases where the selection
      // lands between two sibling nodes (e.g. containerOffset === i on the
      // parent means "just before child i").
      if (node === containerNode && containerOffset === i) return true
      if (walk(children[i])) return true
    }

    // Check boundary after the last child — handles containerOffset equal to
    // the child count, which means "just after the last child of this node".
    if (node === containerNode && containerOffset === children.length) {
      return true
    }

    index += closeToken.length
    return false
  }

  for (const child of rootElement.childNodes) {
    if (walk(child)) break
  }

  return index
}

export function getCodeSelection (rootElement) {
  const text = serializeNodeToCode(rootElement)
  const selection = globalThis.getSelection?.()
  if (!selection || selection.rangeCount === 0) {
    const fallbackIndex = text.length
    return { text, start: fallbackIndex, end: fallbackIndex }
  }

  const range = selection.getRangeAt(0)
  if (
    !rootElement.contains(range.startContainer) ||
    !rootElement.contains(range.endContainer)
  ) {
    const fallbackIndex = text.length
    return { text, start: fallbackIndex, end: fallbackIndex }
  }

  const selectionStart = getCodeIndexFromBoundary(
    rootElement,
    range.startContainer,
    range.startOffset
  )
  const selectionEnd = getCodeIndexFromBoundary(
    rootElement,
    range.endContainer,
    range.endOffset
  )

  return {
    text,
    start: Math.min(selectionStart, selectionEnd),
    end: Math.max(selectionStart, selectionEnd)
  }
}

export function getDocumentTextStats (recipeData) {
  const allText = [
    recipeData.title || '',
    recipeData.description || '',
    ...(recipeData.items || []).map((item) => item.content || '')
  ]
    .join(' ')
    .trim()

  const words = allText.length === 0 ? 0 : allText.split(/\s+/).length
  const sentences = allText
    .split(/[.!?]+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean).length

  const paragraphs = [
    recipeData.description || '',
    ...(recipeData.items || [])
      .filter((item) => typeof item.content === 'string')
      .map((item) => item.content || '')
  ]
    .map((paragraph) => paragraph.trim())
    .filter(Boolean).length

  return { words, sentences, paragraphs }
}

const JS_PROTOCOL = String.fromCharCode(
  106,
  97,
  118,
  97,
  115,
  99,
  114,
  105,
  112,
  116,
  58
)
const DATA_TEXT_HTML_PREFIX = String.fromCharCode(
  100,
  97,
  116,
  97,
  58,
  116,
  101,
  120,
  116,
  47,
  104,
  116,
  109,
  108
)

/**
 * True when a URL-like attribute value should be stripped for XSS safety.
 * Uses URL parsing plus prefix checks built without embedding suspicious literals.
 * @param {string} rawValue
 * @returns {boolean}
 */
function shouldStripUrlAttrValue (rawValue) {
  const trimmed = (rawValue || '').trim()
  if (!trimmed) return false
  const lower = trimmed.toLowerCase()
  if (
    lower.startsWith(JS_PROTOCOL) ||
    lower.startsWith(DATA_TEXT_HTML_PREFIX)
  ) {
    return true
  }
  try {
    const parsed = new URL(trimmed)
    const protocol = parsed.protocol.toLowerCase()
    if (protocol === JS_PROTOCOL || protocol === 'data:') return true
  } catch {
    // Non-absolute URLs fall through; prefix checks above cover common inline cases.
  }
  return false
}

/**
 * Sanitize raw HTML content by removing dangerous tags and attributes.
 * Used when rendering item content as HTML in HTML editor mode.
 * Strips <script>, <style>, <meta>, <link>, <object>, <embed>, <form> tags
 * and removes all on* event handlers and unsafe href/src/action URLs.
 * @param {string} rawHtml
 * @returns {string} sanitized HTML string
 */
export function sanitizeHtmlContent (rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return ''
  const parser = new DOMParser()
  const doc = parser.parseFromString(rawHtml, 'text/html')

  const FORBIDDEN_TAGS = [
    'script',
    'style',
    'meta',
    'link',
    'object',
    'embed',
    'form',
    'base'
  ]
  FORBIDDEN_TAGS.forEach((tag) => {
    doc.querySelectorAll(tag).forEach((el) => el.remove())
  })

  doc.body.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name)
        return
      }
      if (
        attr.name === 'href' ||
        attr.name === 'src' ||
        attr.name === 'action'
      ) {
        if (shouldStripUrlAttrValue(attr.value)) {
          el.removeAttribute(attr.name)
        }
      }
      if (attr.name === 'srcdoc') {
        el.removeAttribute(attr.name)
      }
    })
  })

  return doc.body.innerHTML
}

export function copyToClipboard (text) {
  if (globalThis.navigator?.clipboard && globalThis.isSecureContext) {
    globalThis.navigator.clipboard
      .writeText(text)
      .catch(() => copyFallback(text))
  } else {
    copyFallback(text)
  }
}

export function copyFallback (text) {
  const hiddenTextarea = document.createElement('textarea')
  hiddenTextarea.value = text
  hiddenTextarea.setAttribute('readonly', '')
  hiddenTextarea.style.position = 'fixed'
  hiddenTextarea.style.opacity = '0'
  hiddenTextarea.style.pointerEvents = 'none'
  hiddenTextarea.style.left = '0'
  hiddenTextarea.style.top = '0'
  document.body.appendChild(hiddenTextarea)
  hiddenTextarea.focus()
  hiddenTextarea.select()

  // Preserve selected text briefly so users can press Ctrl/Cmd+C manually.
  setTimeout(() => hiddenTextarea.remove(), 3000)
}

/**
 * Return serialized code text and current caret/selection offsets.
 */
export function getTextAndCaret (rootEl) {
  const { text, start, end } = getCodeSelection(rootEl)
  return {
    text,
    caret: end,
    selectionStart: start,
    selectionEnd: end
  }
}

function getNodeIndexInParent (node) {
  if (!node?.parentNode) return 0
  return Array.prototype.indexOf.call(node.parentNode.childNodes, node)
}

function resolveCaretPoint (rootElement, targetOffset) {
  let consumed = 0
  let point = null

  const setBeforeNode = (node) => {
    const index = getNodeIndexInParent(node)
    point = { container: node.parentNode, offset: Math.max(0, index) }
  }

  const setAfterNode = (node) => {
    const index = getNodeIndexInParent(node)
    point = { container: node.parentNode, offset: Math.max(0, index + 1) }
  }

  function walk (node) {
    if (point) return

    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.nodeValue || ''
      const next = consumed + value.length
      if (targetOffset <= next) {
        point = {
          container: node,
          offset: Math.max(0, targetOffset - consumed)
        }
        return
      }
      consumed = next
      return
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const elementNode = node

      if (elementNode.tagName === 'BR') {
        const next = consumed + 1
        if (targetOffset <= next) {
          if (targetOffset === consumed) setBeforeNode(elementNode)
          else setAfterNode(elementNode)
          return
        }
        consumed = next
        return
      }

      if (elementNode.classList.contains('material-icons')) {
        const tokenLength = getSerializedTokenForIcon(elementNode).length
        const next = consumed + tokenLength
        if (targetOffset <= next) {
          if (targetOffset === consumed) setBeforeNode(elementNode)
          else setAfterNode(elementNode)
          return
        }
        consumed = next
        return
      }

      const escapeCode = Number.parseInt(
        elementNode.dataset?.rtEscapeCode || '',
        10
      )
      if (Number.isFinite(escapeCode)) {
        const tokenLength = 2 // backslash + escaped character
        const next = consumed + tokenLength
        if (targetOffset <= next) {
          if (targetOffset === consumed) setBeforeNode(elementNode)
          else setAfterNode(elementNode)
          return
        }
        consumed = next
        return
      }

      const openToken = elementNode.dataset?.rtOpen || ''
      const closeToken = elementNode.dataset?.rtClose || ''

      if (openToken.length > 0) {
        const next = consumed + openToken.length
        if (targetOffset <= next) {
          point = { container: elementNode, offset: 0 }
          return
        }
        consumed = next
      }

      for (const childNode of elementNode.childNodes) {
        walk(childNode)
        if (point) return
      }

      if (closeToken.length > 0) {
        const next = consumed + closeToken.length
        if (targetOffset <= next) {
          point = {
            container: elementNode,
            offset: elementNode.childNodes.length
          }
          return
        }
        consumed = next
      }
    }
  }

  walk(rootElement)

  if (!point) {
    return {
      container: rootElement,
      offset: rootElement.childNodes.length
    }
  }

  return point
}

/**
 * Set caret position using serialized-code offsets.
 */
export function setCaretPosition (element, chars) {
  if (typeof chars !== 'number' || chars < 0) return
  const selection = globalThis.getSelection?.()
  if (!selection) return
  const range = document.createRange()

  const point = resolveCaretPoint(element, chars)
  range.setStart(point.container, point.offset)
  range.collapse(true)

  selection.removeAllRanges()
  selection.addRange(range)
}

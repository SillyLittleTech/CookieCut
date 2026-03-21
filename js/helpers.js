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
          const clampedSize = Math.max(8, Math.min(160, pxValue))
          return `<span class="rt-scale" style="font-size:${clampedSize}px;" data-rt-open="${escapeHTML(scaleMatch[0])}" data-rt-close="}}">${innerHtml}</span>`
        }
      }
    }
  }

  const highlightMatch = currentSlice.match(/^\[([a-z])\[/u)
  if (highlightMatch) {
    const colorCode = highlightMatch[1]
    const colorClass = HIGHLIGHT_COLOR_MAP[colorCode] || HIGHLIGHT_COLOR_MAP.y
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

    const token = parseFormattingTokenAt(sourceText, index)
    if (!token) {
      let nextIndex = index + 1
      while (nextIndex < sourceText.length) {
        const nextChar = sourceText[nextIndex]
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

  const openToken = elementNode.dataset?.rtOpen || ''
  const closeToken = elementNode.dataset?.rtClose || ''
  let innerText = ''

  for (const childNode of elementNode.childNodes) {
    innerText += serializeNodeToCode(childNode)
  }

  return `${openToken}${innerText}${closeToken}`
}

function getCodeIndexFromBoundary (rootElement, containerNode, containerOffset) {
  const range = document.createRange()
  range.selectNodeContents(rootElement)
  range.setEnd(containerNode, containerOffset)
  const clonedContents = range.cloneContents()
  return serializeNodeToCode(clonedContents).length
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
          point = { container: elementNode, offset: elementNode.childNodes.length }
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

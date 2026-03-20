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
    globalThis.navigator.clipboard.writeText(text).catch(() => copyFallback(text))
  } else {
    copyFallback(text)
  }
}

export function copyFallback (text) {
  if (typeof globalThis.prompt === 'function') {
    globalThis.prompt('Copy to clipboard:', text)
    return
  }

  console.warn('Clipboard API unavailable and prompt fallback unsupported.')
}

/**
 * Walk the editable element and return a plain "code text" where
 * icon spans are represented as :icon: tokens, plus the caret offset
 * (character index) inside that code text corresponding to the current
 * selection end.
 */
export function getTextAndCaret (rootEl) {
  const selection = globalThis.getSelection?.()
  let focusNode = null
  let focusOffset = 0
  if (selection?.rangeCount > 0) {
    focusNode = selection.getRangeAt(0).endContainer
    focusOffset = selection.getRangeAt(0).endOffset
  }

  let text = ''
  let caret = 0
  let foundCaret = false

  function walk (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeText = node.nodeValue || ''
      if (!foundCaret && node === focusNode) {
        caret = text.length + Math.min(focusOffset, nodeText.length)
        foundCaret = true
      }
      text += nodeText
      return
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const elementNode = node
      // If this element is an icon span, represent it as :name:
      if (elementNode.classList?.contains('material-icons')) {
        const token = `:${(elementNode.textContent || '').trim()}:`
        // If focus is inside this element (or the element itself), approximate caret
        if (
          !foundCaret &&
          (elementNode === focusNode || elementNode.contains(focusNode))
        ) {
          // If focusNode is the element itself, use focusOffset to choose before/after
          if (focusNode === elementNode) {
            caret = text.length + (focusOffset === 0 ? 0 : token.length)
          } else {
            // If focus is inside a descendant text node, put caret at token end.
            caret = text.length + token.length
          }
          foundCaret = true
        }
        text += token
        return
      }

      // Normal element: walk children
      for (let i = 0; i < elementNode.childNodes.length; i++) {
        walk(elementNode.childNodes[i])
      }
    }
  }

  walk(rootEl)

  if (!foundCaret) caret = text.length
  return { text, caret }
}

/**
 * Set caret (character) position within an element. Walk text nodes until
 * we locate the correct offset and set the range there.
 * Returns early without throwing if chars is not a non-negative number.
 */
export function setCaretPosition (element, chars) {
  if (typeof chars !== 'number' || chars < 0) return
  const selection = globalThis.getSelection?.()
  if (!selection) return
  const range = document.createRange()
  const nodeStack = [element]
  let node = null
  let found = false
  let charCount = 0

  while (nodeStack.length && !found) {
    node = nodeStack.shift()
    if (node.nodeType === Node.TEXT_NODE) {
      const nextCharCount = charCount + node.length
      if (chars <= nextCharCount) {
        range.setStart(node, Math.max(0, chars - charCount))
        range.collapse(true)
        found = true
        break
      }
      charCount = nextCharCount
    } else {
      // Push child nodes in order
      for (let i = 0; i < node.childNodes.length; i++) {
        nodeStack.push(node.childNodes[i])
      }
    }
  }

  if (!found) {
    range.selectNodeContents(element)
    range.collapse(false)
  }

  // If the computed start is inside a material-icons span, move it to after that span
  try {
    const startContainerNode = range.startContainer
    let ancestor =
      startContainerNode.nodeType === Node.TEXT_NODE
        ? startContainerNode.parentElement
        : startContainerNode

    while (
      ancestor?.parentElement &&
      ancestor !== element &&
      !ancestor.classList?.contains('material-icons')
    ) {
      ancestor = ancestor.parentElement
    }

    if (ancestor?.classList?.contains('material-icons') && ancestor !== element) {
      range.setStartAfter(ancestor)
      range.collapse(true)
    }
  } catch {
    // ignore and use original range
  }

  selection.removeAllRanges()
  selection.addRange(range)
}

import {
  CODE_BLOCK_PADDING_X,
  CODE_BLOCK_PADDING_Y,
  CODE_FONT,
  CODE_LINE_HEIGHT,
  createPreparedChatMessages,
  findScrollAnchor,
  findVisibleRange,
  getMaxChatWidth,
  getOcclusionBannerHeight,
  IMAGE_PADDING_X,
  INLINE_CODE_PADDING_X,
  layoutConversation,
  layoutMessage,
  MARKER_FONT,
  MESSAGE_SIDE_PADDING,
  OCCLUSION_BANNER_HEIGHT,
  TOP_SCROLL_ANCHOR,
  type BlockLayout,
  type ConversationLayout,
  type PreparedChatMessage,
  type QuoteRailLayout,
  type ScrollAnchor,
  type TextStyle,
} from './markdown-chat.model.ts'

type State = {
  conversation: ConversationLayout
  events: {
    toggleVisualization: boolean
  }
  isVisualizationOn: boolean
  scrollAnchor: ScrollAnchor
  scrollTop: number // where the last frame left the scroll position, as read back
}

type CachedRow = {
  bubble: HTMLDivElement
  row: HTMLElement
}

const domCache = {
  root: document.documentElement,
  shell: getRequiredElement('chat-shell'),
  viewport: getRequiredDiv('chat-viewport'),
  canvas: getRequiredDiv('chat-canvas'),
  toggleButton: getRequiredButton('virtualization-toggle'),
  rows: [] as Array<CachedRow | undefined>, // cache lifetime: on visibility changes
  mountedStart: 0, // cache lifetime: on visibility changes
  mountedEnd: 0, // cache lifetime: on visibility changes
}

const preparedMessages = createPreparedChatMessages()
const st: State = {
  conversation: layoutConversation(preparedMessages, getMaxChatWidth(domCache.viewport.clientWidth)),
  events: {
    toggleVisualization: false,
  },
  isVisualizationOn: false,
  scrollAnchor: TOP_SCROLL_ANCHOR,
  scrollTop: 0,
}

let scheduledRaf: number | null = null

domCache.root.style.setProperty('--message-side-padding', `${MESSAGE_SIDE_PADDING}px`)
domCache.root.style.setProperty('--marker-font', MARKER_FONT)
domCache.root.style.setProperty('--code-font', CODE_FONT)
domCache.root.style.setProperty('--code-line-height', `${CODE_LINE_HEIGHT}px`)
domCache.root.style.setProperty('--inline-code-padding-x', `${INLINE_CODE_PADDING_X}px`)
domCache.root.style.setProperty('--image-padding-x', `${IMAGE_PADDING_X}px`)

domCache.toggleButton.addEventListener('click', () => {
  st.events.toggleVisualization = true
  scheduleRender()
})

domCache.viewport.addEventListener('scroll', scheduleRender, { passive: true })
window.addEventListener('resize', scheduleRender)

scheduleRender()

function getRequiredDiv(id: string): HTMLDivElement {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLDivElement)) throw new Error(`Missing div #${id}`)
  return element
}

function getRequiredElement(id: string): HTMLElement {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) throw new Error(`Missing element #${id}`)
  return element
}

function getRequiredButton(id: string): HTMLButtonElement {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLButtonElement)) throw new Error(`Missing button #${id}`)
  return element
}

function scheduleRender(): void {
  if (scheduledRaf !== null) return
  scheduledRaf = requestAnimationFrame(function renderMarkdownChatFrame() {
    scheduledRaf = null
    render()
  })
}

function render(): void {
  const viewportWidth = domCache.viewport.clientWidth
  const viewportHeight = domCache.viewport.clientHeight
  const scrollTop = domCache.viewport.scrollTop
  const occlusionBannerHeight = getOcclusionBannerHeight(viewportHeight)
  const isCompactOcclusionChrome = occlusionBannerHeight < OCCLUSION_BANNER_HEIGHT

  let isVisualizationOn = st.isVisualizationOn
  if (st.events.toggleVisualization) isVisualizationOn = !isVisualizationOn

  const chatWidth = getMaxChatWidth(viewportWidth)
  const previousConversation = st.conversation
  const needsRelayout = previousConversation.chatWidth !== chatWidth
  const conversation = needsRelayout ? layoutConversation(preparedMessages, chatWidth) : previousConversation

  // st.scrollTop is where the last frame left the scroll position, so any other
  // value is the user's scroll: anchor the first message whose top shows below
  // the top banner, in the layout they scrolled. Otherwise keep the anchor.
  // Either way, scroll so its top keeps its distance below the banner, within
  // the range.
  const scrollAnchor = scrollTop === st.scrollTop
    ? st.scrollAnchor
    : findScrollAnchor(previousConversation, scrollTop, viewportHeight, occlusionBannerHeight)
  const canvasHeight = conversation.totalHeight + occlusionBannerHeight * 2
  const adjustedScrollTop = Math.min(
    Math.max(0, canvasHeight - viewportHeight),
    Math.max(0, conversation.tops[scrollAnchor.index]! - scrollAnchor.offset),
  )

  const { start, end } = findVisibleRange(conversation, adjustedScrollTop, viewportHeight, occlusionBannerHeight)

  st.conversation = conversation
  st.isVisualizationOn = isVisualizationOn
  st.scrollAnchor = scrollAnchor
  st.events.toggleVisualization = false

  domCache.root.style.setProperty('--chat-width', `${chatWidth}px`)
  domCache.root.style.setProperty('--chat-viewport-width', `${viewportWidth}px`)
  domCache.root.style.setProperty('--occlusion-banner-height', `${occlusionBannerHeight}px`)
  domCache.root.style.setProperty('--virtualization-toggle-padding-block', isCompactOcclusionChrome ? '8px' : '10px')
  domCache.root.style.setProperty('--virtualization-toggle-padding-inline', isCompactOcclusionChrome ? '12px' : '14px')
  domCache.root.style.setProperty('--virtualization-toggle-font-size', isCompactOcclusionChrome ? '11px' : '12px')
  domCache.shell.dataset['visualization'] = isVisualizationOn ? 'on' : 'off'
  // The canvas takes its height before the scroll below, which the browser
  // would otherwise clamp to the old height.
  domCache.canvas.style.height = `${canvasHeight}px`
  domCache.toggleButton.textContent = isVisualizationOn
    ? 'Hide virtualization mask'
    : 'Show virtualization mask'
  domCache.toggleButton.setAttribute('aria-pressed', String(isVisualizationOn))

  projectVisibleRows(conversation, chatWidth, occlusionBannerHeight, start, end, needsRelayout)

  // The last effect. Browsers round scrollTop, so store the position read back,
  // not the one asked for, or the next frame would take it for a user scroll.
  // The read forces layout, so nothing touches the DOM after it.
  if (adjustedScrollTop === scrollTop) {
    st.scrollTop = scrollTop
  } else {
    domCache.viewport.scrollTo({ top: adjustedScrollTop, behavior: 'instant' })
    st.scrollTop = domCache.viewport.scrollTop
  }
}

// Rows that stop showing leave. A row that starts showing goes before the first
// row kept when it's above that row, else last, so the canvas holds its rows in
// message order.
function projectVisibleRows(
  conversation: ConversationLayout,
  chatWidth: number,
  occlusionBannerHeight: number,
  start: number,
  end: number,
  needsRelayout: boolean,
): void {
  const { heights, tops } = conversation
  const previousStart = domCache.mountedStart
  const previousEnd = domCache.mountedEnd
  for (let index = previousStart; index < previousEnd; index++) {
    if (index >= start && index < end) continue
    domCache.rows[index]!.row.remove()
    domCache.rows[index] = undefined
  }

  const keptStart = Math.max(start, previousStart)
  const firstKeptRow = keptStart < Math.min(end, previousEnd) ? domCache.rows[keptStart]!.row : null
  for (let index = start; index < end; index++) {
    const preparedMessage = preparedMessages[index]!
    let cachedRow = domCache.rows[index]
    if (cachedRow === undefined) {
      cachedRow = createMessageShell(preparedMessage.role)
      domCache.rows[index] = cachedRow
      renderMessageContents(cachedRow, preparedMessage, chatWidth, heights[index]!)
      domCache.canvas.insertBefore(cachedRow.row, index < keptStart ? firstKeptRow : null)
    } else if (needsRelayout) {
      renderMessageContents(cachedRow, preparedMessage, chatWidth, heights[index]!)
    }
    cachedRow.row.style.top = `${occlusionBannerHeight + tops[index]!}px`
  }

  domCache.mountedStart = start
  domCache.mountedEnd = end
}

function createMessageShell(role: PreparedChatMessage['role']): CachedRow {
  const row = document.createElement('article')
  row.className = `msg msg--${role}`

  const bubble = document.createElement('div')
  bubble.className = 'msg-bubble'

  row.append(bubble)
  return { bubble, row }
}

// A message's contents and size follow the chat width, so they're laid out and
// written when its row is created and when the chat width changes.
function renderMessageContents(
  cachedRow: CachedRow,
  preparedMessage: PreparedChatMessage,
  chatWidth: number,
  height: number,
): void {
  const { blocks, contentInsetX, rails, width } = layoutMessage(preparedMessage, chatWidth)
  // Lines and rules span the final bubble, so they stay inside a shrinkwrapped one.
  const contentWidth = width - contentInsetX * 2
  const fragment = document.createDocumentFragment()
  for (let index = 0; index < rails.length; index++) {
    fragment.append(renderQuoteRail(rails[index]!, contentInsetX))
  }
  for (let index = 0; index < blocks.length; index++) {
    fragment.append(renderBlock(blocks[index]!, contentInsetX, contentWidth))
  }
  cachedRow.bubble.replaceChildren(fragment)
  cachedRow.row.style.height = `${height}px`
  cachedRow.bubble.style.width = `${width}px`
  cachedRow.bubble.style.height = `${height}px`
}

function renderBlock(layout: BlockLayout, contentInsetX: number, contentWidth: number): HTMLElement {
  // A right-to-left block starts its indent and marker from the right.
  const start = layout.direction === 'rtl' ? 'right' : 'left'
  switch (layout.kind) {
    case 'inline':
      return renderInlineBlock(layout, contentInsetX, contentWidth, start)
    case 'code':
      return renderCodeBlock(layout, contentInsetX, start)
    case 'rule':
      return renderRuleBlock(layout, contentInsetX, contentWidth, start)
  }
}

function renderInlineBlock(
  layout: Extract<BlockLayout, { kind: 'inline' }>,
  contentInsetX: number,
  contentWidth: number,
  start: 'left' | 'right',
): HTMLElement {
  const { block } = layout
  const wrapper = createBlockShell(layout, 'block block--inline', contentInsetX, start)

  for (let lineIndex = 0; lineIndex < layout.lines.length; lineIndex++) {
    const line = layout.lines[lineIndex]!
    // Each Pretext line is one line box, so the browser orders its bidi runs.
    // The paragraph style sets the baseline.
    const row = document.createElement('div')
    row.className = 'inline-line'
    row.dir = layout.direction
    applyTextStyle(row, block.paragraphStyle)
    row.style.lineHeight = `${block.lineHeight}px`
    row.style[start] = `${contentInsetX + block.contentLeft}px`
    row.style.top = `${lineIndex * block.lineHeight}px`
    row.style.width = `${Math.max(1, contentWidth - block.contentLeft)}px`

    let previousNode: HTMLElement | null = null
    for (let fragmentIndex = 0; fragmentIndex < line.fragments.length; fragmentIndex++) {
      const fragment = line.fragments[fragmentIndex]!
      const node = renderInlineFragment(block.styles[fragment.itemIndex]!, block.hrefs[fragment.itemIndex]!, fragment.text)
      // A collapsed space paints inside the element of the item whose font
      // measured it: this fragment's, the previous fragment's, or, for an item
      // holding only whitespace, an element of its own.
      const gapItemIndex = fragment.gapItemIndex
      if (gapItemIndex === fragment.itemIndex) {
        node.prepend(' ')
      } else if (gapItemIndex >= 0 && gapItemIndex === line.fragments[fragmentIndex - 1]?.itemIndex) {
        previousNode!.append(' ')
      } else if (gapItemIndex >= 0) {
        row.append(renderInlineFragment(block.styles[gapItemIndex]!, block.hrefs[gapItemIndex]!, ' '))
      }
      row.append(node)
      previousNode = node
    }
    wrapper.append(row)
  }

  return wrapper
}

function renderCodeBlock(
  layout: Extract<BlockLayout, { kind: 'code' }>,
  contentInsetX: number,
  start: 'left' | 'right',
): HTMLElement {
  const wrapper = createBlockShell(layout, 'block block--code-shell', contentInsetX, start)

  const codeBox = document.createElement('div')
  codeBox.className = 'code-box'
  codeBox.style[start] = `${contentInsetX + layout.block.contentLeft}px`
  codeBox.style.width = `${layout.width}px`
  codeBox.style.height = `${layout.height}px`

  for (let lineIndex = 0; lineIndex < layout.lines.length; lineIndex++) {
    const line = layout.lines[lineIndex]!
    const row = document.createElement('div')
    row.className = 'code-line'
    // Code reads left to right inside its box, whichever side the box starts from.
    row.style.left = `${CODE_BLOCK_PADDING_X}px`
    row.style.top = `${CODE_BLOCK_PADDING_Y + lineIndex * CODE_LINE_HEIGHT}px`
    row.textContent = line.text
    codeBox.append(row)
  }

  wrapper.append(codeBox)
  return wrapper
}

function renderRuleBlock(
  layout: Extract<BlockLayout, { kind: 'rule' }>,
  contentInsetX: number,
  contentWidth: number,
  start: 'left' | 'right',
): HTMLElement {
  const wrapper = createBlockShell(layout, 'block block--rule-shell', contentInsetX, start)
  const rule = document.createElement('div')
  rule.className = 'rule-line'
  rule.style[start] = `${contentInsetX + layout.block.contentLeft}px`
  rule.style.top = `${Math.floor(layout.height / 2)}px`
  rule.style.width = `${Math.max(1, contentWidth - layout.block.contentLeft)}px`
  wrapper.append(rule)
  return wrapper
}

function createBlockShell(
  layout: BlockLayout,
  className: string,
  contentInsetX: number,
  start: 'left' | 'right',
): HTMLDivElement {
  const wrapper = document.createElement('div')
  wrapper.className = className
  wrapper.style.top = `${layout.top}px`
  wrapper.style.height = `${layout.height}px`

  appendMarker(wrapper, layout, contentInsetX, start)
  return wrapper
}

// A rail starts from the side of the blocks it runs beside.
function renderQuoteRail(rail: QuoteRailLayout, contentInsetX: number): HTMLElement {
  const node = document.createElement('div')
  node.className = 'quote-rail'
  node.style[rail.direction === 'rtl' ? 'right' : 'left'] = `${contentInsetX + rail.left}px`
  node.style.top = `${rail.top}px`
  node.style.height = `${rail.height}px`
  return node
}

function appendMarker(
  wrapper: HTMLDivElement,
  layout: BlockLayout,
  contentInsetX: number,
  start: 'left' | 'right',
): void {
  const { marker } = layout.block
  if (marker === null) return

  const node = document.createElement('span')
  node.className = 'block-marker'
  node.dir = layout.direction
  node.style[start] = `${contentInsetX + marker.left}px`
  node.style.top = `${markerTop(layout)}px`
  node.textContent = marker.text
  wrapper.append(node)
}

function markerTop(layout: BlockLayout): number {
  switch (layout.kind) {
    case 'code':
      return CODE_BLOCK_PADDING_Y
    case 'inline':
      return Math.max(0, Math.round((layout.block.lineHeight - 12) / 2))
    case 'rule':
      return 0
  }
}

function renderInlineFragment(style: TextStyle, href: string | null, text: string): HTMLElement {
  const node = href === null
    ? document.createElement('span')
    : document.createElement('a')

  node.className = style.className
  applyTextStyle(node, style)
  node.textContent = text

  if (node instanceof HTMLAnchorElement && href !== null) {
    node.href = href
    node.target = '_blank'
    node.rel = 'noreferrer'
  }

  return node
}

// Paint with the font and letter spacing the line was measured with. Letter
// spacing is always set, since a fragment would otherwise inherit its row's.
function applyTextStyle(node: HTMLElement, style: TextStyle): void {
  node.style.setProperty('--font', style.font)
  node.style.letterSpacing = `${style.letterSpacing}px`
}

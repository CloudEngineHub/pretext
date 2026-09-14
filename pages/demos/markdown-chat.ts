import {
  buildConversationFrame,
  CODE_BLOCK_PADDING_X,
  CODE_BLOCK_PADDING_Y,
  CODE_FONT,
  CODE_LINE_HEIGHT,
  createPreparedChatMessages,
  findVisibleRange,
  getMaxChatWidth,
  getOcclusionBannerHeight,
  MARKER_FONT,
  materializeMessageBlocks,
  materializeQuoteRails,
  MESSAGE_SIDE_PADDING,
  OCCLUSION_BANNER_HEIGHT,
  type BlockLayout,
  type ChatMessageInstance,
  type ConversationFrame,
  type InlineFragmentLayout,
  type MessageFrame,
  type QuoteRailLayout,
  type TextStyle,
} from './markdown-chat.model.ts'

type State = {
  events: {
    toggleVisualization: boolean
  }
  frame: ConversationFrame | null
  isVisualizationOn: boolean
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
  events: {
    toggleVisualization: false,
  },
  frame: null,
  isVisualizationOn: false,
}

let scheduledRaf: number | null = null

domCache.root.style.setProperty('--message-side-padding', `${MESSAGE_SIDE_PADDING}px`)
domCache.root.style.setProperty('--marker-font', MARKER_FONT)
domCache.root.style.setProperty('--code-font', CODE_FONT)

domCache.toggleButton.addEventListener('click', () => {
  st.events.toggleVisualization = true
  scheduleRender()
})

domCache.viewport.addEventListener('scroll', scheduleRender, { passive: true })
window.addEventListener('resize', scheduleRender)

await document.fonts.ready
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
  const previousFrame = st.frame
  const canReuseFrame =
    previousFrame !== null
    && previousFrame.chatWidth === chatWidth
    && previousFrame.occlusionBannerHeight === occlusionBannerHeight
  const frame = canReuseFrame
    ? previousFrame
    : buildConversationFrame(preparedMessages, chatWidth, occlusionBannerHeight)
  const needsRelayout = !canReuseFrame

  const { start, end } = findVisibleRange(
    frame,
    scrollTop,
    viewportHeight,
    occlusionBannerHeight,
    occlusionBannerHeight,
  )

  st.frame = frame
  st.isVisualizationOn = isVisualizationOn
  st.events.toggleVisualization = false

  domCache.root.style.setProperty('--chat-width', `${frame.chatWidth}px`)
  domCache.root.style.setProperty('--occlusion-banner-height', `${occlusionBannerHeight}px`)
  domCache.root.style.setProperty('--occlusion-banner-padding-block', isCompactOcclusionChrome ? '6px' : '12px')
  domCache.root.style.setProperty('--virtualization-toggle-padding-block', isCompactOcclusionChrome ? '8px' : '10px')
  domCache.root.style.setProperty('--virtualization-toggle-padding-inline', isCompactOcclusionChrome ? '12px' : '14px')
  domCache.root.style.setProperty('--virtualization-toggle-font-size', isCompactOcclusionChrome ? '11px' : '12px')
  domCache.shell.dataset['visualization'] = isVisualizationOn ? 'on' : 'off'
  domCache.canvas.style.height = `${frame.totalHeight}px`
  domCache.toggleButton.textContent = isVisualizationOn
    ? 'Hide virtualization mask'
    : 'Show virtualization mask'
  domCache.toggleButton.setAttribute('aria-pressed', String(isVisualizationOn))

  projectVisibleRows(frame, start, end, needsRelayout)
}

function projectVisibleRows(
  frame: ConversationFrame,
  start: number,
  end: number,
  needsRelayout: boolean,
): void {
  const previousStart = domCache.mountedStart
  const previousEnd = domCache.mountedEnd
  const overlapStart = Math.max(start, previousStart)
  const overlapEnd = Math.min(end, previousEnd)

  for (let index = previousStart; index < Math.min(previousEnd, start); index++) {
    const node = domCache.rows[index]
    if (node === undefined) continue
    node.row.remove()
    domCache.rows[index] = undefined
  }

  for (let index = Math.max(previousStart, end); index < previousEnd; index++) {
    const node = domCache.rows[index]
    if (node === undefined) continue
    node.row.remove()
    domCache.rows[index] = undefined
  }

  if (overlapStart >= overlapEnd) {
    for (let index = start; index < end; index++) {
      const cachedRow = prepareRow(frame.messages[index]!, index, needsRelayout)
      projectMessageNode(cachedRow, frame.messages[index]!.frame, frame.messages[index]!.top)
      if (cachedRow.row.parentNode === null) domCache.canvas.append(cachedRow.row)
    }
  } else {
    let anchorRow = domCache.rows[overlapStart]?.row ?? null
    for (let index = overlapStart - 1; index >= start; index--) {
      const cachedRow = prepareRow(frame.messages[index]!, index, needsRelayout)
      projectMessageNode(cachedRow, frame.messages[index]!.frame, frame.messages[index]!.top)
      if (anchorRow === null) {
        if (cachedRow.row.parentNode === null) domCache.canvas.append(cachedRow.row)
      } else if (cachedRow.row.parentNode !== domCache.canvas || cachedRow.row.nextSibling !== anchorRow) {
        domCache.canvas.insertBefore(cachedRow.row, anchorRow)
      }
      anchorRow = cachedRow.row
    }

    for (let index = overlapStart; index < overlapEnd; index++) {
      const cachedRow = prepareRow(frame.messages[index]!, index, needsRelayout)
      projectMessageNode(cachedRow, frame.messages[index]!.frame, frame.messages[index]!.top)
    }

    for (let index = overlapEnd; index < end; index++) {
      const cachedRow = prepareRow(frame.messages[index]!, index, needsRelayout)
      projectMessageNode(cachedRow, frame.messages[index]!.frame, frame.messages[index]!.top)
      if (cachedRow.row.parentNode === null) domCache.canvas.append(cachedRow.row)
    }
  }

  domCache.mountedStart = start
  domCache.mountedEnd = end
}

function prepareRow(
  message: ChatMessageInstance,
  index: number,
  needsRelayout: boolean,
): CachedRow {
  let cachedRow = domCache.rows[index]
  if (cachedRow === undefined) {
    cachedRow = createMessageShell(message.frame.role)
    domCache.rows[index] = cachedRow
    renderMessageContents(cachedRow.bubble, message)
    return cachedRow
  }
  if (needsRelayout) renderMessageContents(cachedRow.bubble, message)
  return cachedRow
}

function createMessageShell(role: ChatMessageInstance['frame']['role']): CachedRow {
  const row = document.createElement('article')
  row.className = `msg msg--${role}`

  const bubble = document.createElement('div')
  bubble.className = 'msg-bubble'

  row.append(bubble)
  return { bubble, row }
}

function renderMessageContents(
  bubble: HTMLDivElement,
  message: ChatMessageInstance,
): void {
  const fragment = document.createDocumentFragment()
  const rails = materializeQuoteRails(message)
  for (let index = 0; index < rails.length; index++) {
    fragment.append(renderQuoteRail(rails[index]!, message.frame.contentInsetX))
  }
  const blocks = materializeMessageBlocks(message)
  for (let index = 0; index < blocks.length; index++) {
    fragment.append(renderBlock(blocks[index]!, message.frame.contentInsetX))
  }
  bubble.replaceChildren(fragment)
}

function projectMessageNode(
  cachedRow: CachedRow,
  frame: MessageFrame,
  top: number,
): void {
  cachedRow.row.style.top = `${top}px`
  cachedRow.row.style.height = `${frame.bubbleHeight}px`
  cachedRow.bubble.style.width = `${frame.frameWidth}px`
  cachedRow.bubble.style.height = `${frame.bubbleHeight}px`
}

function renderBlock(block: BlockLayout, contentInsetX: number): HTMLElement {
  // A right-to-left block starts its indent and marker from the right.
  const start = block.direction === 'rtl' ? 'right' : 'left'
  switch (block.kind) {
    case 'inline':
      return renderInlineBlock(block, contentInsetX, start)
    case 'code':
      return renderCodeBlock(block, contentInsetX, start)
    case 'rule':
      return renderRuleBlock(block, contentInsetX, start)
  }
}

function renderInlineBlock(
  block: Extract<BlockLayout, { kind: 'inline' }>,
  contentInsetX: number,
  start: 'left' | 'right',
): HTMLElement {
  const wrapper = createBlockShell(block, 'block block--inline', contentInsetX, start)

  for (let lineIndex = 0; lineIndex < block.lines.length; lineIndex++) {
    const line = block.lines[lineIndex]!
    // Each Pretext line is one line box, so the browser orders its bidi runs.
    // The paragraph style sets the baseline and paints the collapsed spaces.
    const row = document.createElement('div')
    row.className = 'inline-line'
    row.dir = block.direction
    applyTextStyle(row, block.paragraphStyle)
    row.style.lineHeight = `${block.lineHeight}px`
    row.style[start] = `${contentInsetX + block.contentLeft}px`
    row.style.top = `${lineIndex * block.lineHeight}px`
    row.style.width = `${block.width}px`

    for (let fragmentIndex = 0; fragmentIndex < line.fragments.length; fragmentIndex++) {
      const fragment = line.fragments[fragmentIndex]!
      if (fragment.spaceBefore) row.append(' ')
      row.append(renderInlineFragment(fragment))
    }
    wrapper.append(row)
  }

  return wrapper
}

function renderCodeBlock(
  block: Extract<BlockLayout, { kind: 'code' }>,
  contentInsetX: number,
  start: 'left' | 'right',
): HTMLElement {
  const wrapper = createBlockShell(block, 'block block--code-shell', contentInsetX, start)

  const codeBox = document.createElement('div')
  codeBox.className = 'code-box'
  codeBox.style[start] = `${contentInsetX + block.contentLeft}px`
  codeBox.style.width = `${block.width}px`
  codeBox.style.height = `${block.height}px`

  for (let lineIndex = 0; lineIndex < block.lines.length; lineIndex++) {
    const line = block.lines[lineIndex]!
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
  block: Extract<BlockLayout, { kind: 'rule' }>,
  contentInsetX: number,
  start: 'left' | 'right',
): HTMLElement {
  const wrapper = createBlockShell(block, 'block block--rule-shell', contentInsetX, start)
  const rule = document.createElement('div')
  rule.className = 'rule-line'
  rule.style[start] = `${contentInsetX + block.contentLeft}px`
  rule.style.top = `${Math.floor(block.height / 2)}px`
  rule.style.width = `${block.width}px`
  wrapper.append(rule)
  return wrapper
}

function createBlockShell(
  block: BlockLayout,
  className: string,
  contentInsetX: number,
  start: 'left' | 'right',
): HTMLDivElement {
  const wrapper = document.createElement('div')
  wrapper.className = className
  wrapper.style.top = `${block.top}px`
  wrapper.style.height = `${block.height}px`

  appendMarker(wrapper, block, contentInsetX, start)
  return wrapper
}

// A right-to-left quote starts its rail from the right, like its blocks.
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
  block: BlockLayout,
  contentInsetX: number,
  start: 'left' | 'right',
): void {
  if (block.markerText === null || block.markerLeft === null || block.markerClassName === null) return

  const marker = document.createElement('span')
  marker.className = block.markerClassName
  marker.style[start] = `${contentInsetX + block.markerLeft}px`
  marker.style.top = `${markerTop(block)}px`
  marker.textContent = block.markerText
  wrapper.append(marker)
}

function markerTop(block: BlockLayout): number {
  switch (block.kind) {
    case 'code':
      return CODE_BLOCK_PADDING_Y
    case 'inline':
      return Math.max(0, Math.round((block.lineHeight - 12) / 2))
    case 'rule':
      return 0
  }
}

function renderInlineFragment(fragment: InlineFragmentLayout): HTMLElement {
  const node = fragment.href === null
    ? document.createElement('span')
    : document.createElement('a')

  node.className = fragment.style.className
  applyTextStyle(node, fragment.style)
  node.textContent = fragment.text

  if (node instanceof HTMLAnchorElement && fragment.href !== null) {
    node.href = fragment.href
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

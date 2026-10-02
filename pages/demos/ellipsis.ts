import {
  COLUMN_GAP,
  DEFAULT_LINES,
  DEFAULT_TEXT_WIDTH,
  ELLIPSIS,
  FONT,
  getPageGeometry,
  labels,
  layoutClamp,
  layoutMiddle,
  layoutMore,
  LESS_LABEL,
  LINE_HEIGHT,
  MAX_LINES,
  MIN_TEXT_WIDTH,
  MORE_LABEL,
  moreSample,
  PANEL_PADDING_X,
  samples,
  type ClampLayout,
} from './ellipsis.model.ts'

type State = {
  requestedTextWidth: number
  maxLines: number
  moreOpen: boolean
  events: {
    widthValue: number | null
    linesValue: number | null
    moreClicked: boolean
  }
}

// One painted line: its element and the text node inside it.
type LineDom = {
  root: HTMLDivElement
  text: Text
}

// A box of lines Pretext laid out. `lines` grows to the most lines painted so far.
type LinesDom = {
  box: HTMLDivElement
  lines: LineDom[]
}

type ClampRowDom = {
  meta: HTMLSpanElement
  pretext: LinesDom
  css: HTMLDivElement
}

type MiddleRowDom = {
  meta: HTMLSpanElement
  pretext: LineDom
  css: HTMLDivElement
}

// cache lifetime: page, for every node.
type DomCache = {
  page: HTMLElement
  widthSlider: HTMLInputElement
  widthValue: HTMLSpanElement
  linesSlider: HTMLInputElement
  linesValue: HTMLSpanElement
  columns: HTMLElement[]
  clampRows: ClampRowDom[]
  middleRows: MiddleRowDom[]
  moreMeta: HTMLSpanElement
  more: LinesDom
  moreLink: HTMLButtonElement
  moreLinkLine: number // the line the link is attached to, -1 while detached
}

const st: State = {
  requestedTextWidth: DEFAULT_TEXT_WIDTH,
  maxLines: DEFAULT_LINES,
  moreOpen: false,
  events: {
    widthValue: null,
    linesValue: null,
    moreClicked: false,
  },
}

const domCache = createDom()
let scheduledRaf: number | null = null

domCache.widthSlider.addEventListener('input', () => {
  st.events.widthValue = Number.parseInt(domCache.widthSlider.value, 10)
  scheduleRender()
})

domCache.linesSlider.addEventListener('input', () => {
  st.events.linesValue = Number.parseInt(domCache.linesSlider.value, 10)
  scheduleRender()
})

domCache.moreLink.addEventListener('click', () => {
  st.events.moreClicked = true
  scheduleRender()
})

window.addEventListener('resize', () => {
  scheduleRender()
})

document.fonts.ready.then(() => {
  scheduleRender()
})

scheduleRender()

function getRequiredElement<T extends HTMLElement>(id: string, ctor: { new (): T }): T {
  const element = document.getElementById(id)
  if (!(element instanceof ctor)) throw new Error(`#${id} not found`)
  return element
}

function createElement<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: Element): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  element.className = className
  parent.appendChild(element)
  return element
}

// A box of text in the font and line height Pretext measured.
function createTextBox(className: string, direction: 'ltr' | 'rtl', parent: Element): HTMLDivElement {
  const box = createElement('div', className, parent)
  box.dir = direction
  box.style.font = FONT
  box.style.lineHeight = `${LINE_HEIGHT}px`
  return box
}

function createLine(box: HTMLDivElement, index: number): LineDom {
  const root = createElement('div', 'line', box)
  root.style.top = `${index * LINE_HEIGHT}px`
  const text = document.createTextNode('')
  root.appendChild(text)
  return { root, text }
}

// A row's label and numbers, then its columns.
function createRow(label: string, parent: Element): { meta: HTMLSpanElement; columns: HTMLDivElement } {
  const row = createElement('div', 'row', parent)
  const head = createElement('div', 'row-head', row)
  createElement('span', 'row-label', head).textContent = label
  const meta = createElement('span', 'row-meta', head)
  const columns = createElement('div', 'columns', row)
  columns.style.columnGap = `${COLUMN_GAP}px`
  return { meta, columns }
}

function createDom(): DomCache {
  const columns = Array.from(document.querySelectorAll<HTMLElement>('.column-title'))
  const panels = Array.from(document.querySelectorAll<HTMLElement>('.panel'))
  for (let i = 0; i < panels.length; i++) panels[i]!.style.padding = `18px ${PANEL_PADDING_X}px`
  const titles = Array.from(document.querySelectorAll<HTMLElement>('.column-titles'))
  for (let i = 0; i < titles.length; i++) titles[i]!.style.columnGap = `${COLUMN_GAP}px`

  const clampRows: ClampRowDom[] = []
  const clampParent = getRequiredElement('clamp-rows', HTMLDivElement)
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]!
    const row = createRow(sample.label, clampParent)
    const box = createTextBox('text lines', sample.direction, row.columns)
    const css = createTextBox('text css-clamp', sample.direction, row.columns)
    css.textContent = sample.text
    columns.push(box, css)
    clampRows.push({ meta: row.meta, pretext: { box, lines: [] }, css })
  }

  const middleRows: MiddleRowDom[] = []
  const middleParent = getRequiredElement('middle-rows', HTMLDivElement)
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i]!
    const row = createRow(label.label, middleParent)
    const box = createTextBox('text lines', 'ltr', row.columns)
    box.style.height = `${LINE_HEIGHT}px`
    const css = createTextBox('text css-end', 'ltr', row.columns)
    css.textContent = label.text
    columns.push(box, css)
    middleRows.push({ meta: row.meta, pretext: createLine(box, 0), css })
  }

  const moreRow = createRow(moreSample.label, getRequiredElement('more-rows', HTMLDivElement))
  const moreBox = createTextBox('text lines', moreSample.direction, moreRow.columns)
  columns.push(moreBox)
  const moreLink = document.createElement('button')
  moreLink.type = 'button'
  moreLink.className = 'more-link'

  return {
    page: getRequiredElement('page', HTMLElement),
    widthSlider: getRequiredElement('width-slider', HTMLInputElement),
    widthValue: getRequiredElement('width-value', HTMLSpanElement),
    linesSlider: getRequiredElement('lines-slider', HTMLInputElement),
    linesValue: getRequiredElement('lines-value', HTMLSpanElement),
    columns,
    clampRows,
    middleRows,
    moreMeta: moreRow.meta,
    more: { box: moreBox, lines: [] },
    moreLink,
    moreLinkLine: -1,
  }
}

function scheduleRender(): void {
  if (scheduledRaf !== null) return
  scheduledRaf = requestAnimationFrame(function renderEllipsisFrame() {
    scheduledRaf = null
    render()
  })
}

// Writes a box's lines, `tail` after the last one, and hides the line elements left over.
function paintLines(dom: LinesDom, lines: string[], tail: string): void {
  for (let i = dom.lines.length; i < lines.length; i++) dom.lines.push(createLine(dom.box, i))
  for (let i = 0; i < dom.lines.length; i++) {
    const line = dom.lines[i]!
    const text = i < lines.length ? lines[i]! + (i === lines.length - 1 ? tail : '') : ''
    line.root.style.display = i < lines.length ? 'block' : 'none'
    // Only on a change: writing a text node's data collapses a selection inside it.
    if (line.text.data !== text) line.text.data = text
  }
}

function render(): void {
  // DOM reads
  // body.clientWidth leaves out the scrollbar gutter. Chrome's documentElement.clientWidth includes
  // the gutter while the page doesn't overflow.
  const viewportWidth = document.body.clientWidth
  const linkHadFocus = document.activeElement === domCache.moreLink

  // Inputs
  let requestedTextWidth = st.requestedTextWidth
  if (st.events.widthValue !== null) requestedTextWidth = st.events.widthValue
  let maxLines = st.maxLines
  if (st.events.linesValue !== null) maxLines = st.events.linesValue
  let moreOpen = st.moreOpen
  if (st.events.moreClicked) moreOpen = !moreOpen

  // Layout
  const geometry = getPageGeometry(viewportWidth, requestedTextWidth)
  const textWidth = geometry.textWidth
  const clamps: ClampLayout[] = []
  for (let i = 0; i < samples.length; i++) clamps.push(layoutClamp(samples[i]!.prepared, textWidth, maxLines))
  const middles: string[] = []
  for (let i = 0; i < labels.length; i++) middles.push(layoutMiddle(labels[i]!, textWidth))
  const more = layoutMore(moreSample.prepared, textWidth, maxLines, moreOpen)

  st.requestedTextWidth = requestedTextWidth
  st.maxLines = maxLines
  st.moreOpen = moreOpen
  st.events.widthValue = null
  st.events.linesValue = null
  st.events.moreClicked = false

  // DOM writes
  domCache.page.style.width = `${geometry.pageWidth}px`
  domCache.page.toggleAttribute('data-ready', true)
  domCache.widthSlider.min = String(Math.min(MIN_TEXT_WIDTH, geometry.maxTextWidth))
  domCache.widthSlider.max = String(geometry.maxTextWidth)
  domCache.widthSlider.value = String(textWidth)
  domCache.widthValue.textContent = `${textWidth}px`
  domCache.linesSlider.max = String(MAX_LINES)
  domCache.linesSlider.value = String(maxLines)
  domCache.linesValue.textContent = String(maxLines)
  for (let i = 0; i < domCache.columns.length; i++) domCache.columns[i]!.style.width = `${textWidth}px`

  for (let i = 0; i < samples.length; i++) {
    const clamp = clamps[i]!
    const row = domCache.clampRows[i]!
    row.meta.textContent = `${clamp.lineCount} lines, ${clamp.truncated ? `${maxLines} shown` : 'all shown'} · ${clamp.height}px`
    row.pretext.box.style.height = `${clamp.height}px`
    paintLines(row.pretext, clamp.lines, clamp.truncated ? ELLIPSIS : '')
    row.css.style.webkitLineClamp = String(maxLines)
  }

  for (let i = 0; i < labels.length; i++) {
    const row = domCache.middleRows[i]!
    const text = middles[i]!
    row.meta.textContent = text === labels[i]!.text ? 'fits' : 'cut'
    if (row.pretext.text.data !== text) row.pretext.text.data = text
  }

  domCache.moreMeta.textContent = `${more.lines.length} lines · ${more.height}px`
  domCache.more.box.style.height = `${more.height}px`
  paintLines(domCache.more, more.lines, more.linkLine < 0 ? '' : moreOpen ? ' ' : `${ELLIPSIS} `)
  const linkLabel = moreOpen ? LESS_LABEL : MORE_LABEL
  if (domCache.moreLink.textContent !== linkLabel) domCache.moreLink.textContent = linkLabel
  domCache.moreLink.setAttribute('aria-expanded', moreOpen ? 'true' : 'false')
  const linkMoved = domCache.moreLinkLine !== more.linkLine
  if (linkMoved) {
    if (more.linkLine < 0) domCache.moreLink.remove()
    else domCache.more.lines[more.linkLine]!.root.appendChild(domCache.moreLink)
    domCache.moreLinkLine = more.linkLine
  }

  // Side effects
  // Moving a focused element drops its focus.
  if (linkHadFocus && linkMoved && more.linkLine >= 0) domCache.moreLink.focus()
}

import {
  CARD_PADDING_X,
  CARD_PADDING_Y,
  DEFAULT_LINES,
  DEFAULT_TEXT_WIDTH,
  ELLIPSIS,
  FOLLOW_MAX_LINES,
  FOLLOW_STAGE_HEIGHT,
  followSample,
  FONT,
  getPageGeometry,
  layoutClamp,
  layoutMiddle,
  layoutMore,
  LESS_LABEL,
  LINE_HEIGHT,
  MAX_LINES,
  middleLabel,
  MIN_TEXT_WIDTH,
  MORE_LABEL,
  moreSample,
  samples,
  type ClampLayout,
} from './ellipsis.model.ts'

// A damped spring: where it is, where it is going and how fast it moves.
type Spring = {
  pos: number
  dest: number
  v: number
}

type State = {
  requestedTextWidth: number
  maxLines: number
  moreOpen: boolean
  // How far the link row is from its closed state, 0, to its open one, 1, and the time of the
  // frame that last moved it, null while it rests.
  moreFade: number
  moreFadedAt: number | null
  // The pointer in the window's coordinates, null before it first moves and once it leaves.
  pointer: { x: number; y: number } | null
  // The follow row's text width and height, null until the first frame gives them a size to
  // rest at, and the time its springs are stepped up to, null while they rest.
  followWidth: Spring | null
  followHeight: Spring | null
  springsSteppedUntil: number | null
  events: {
    widthValue: number | null
    linesValue: number | null
    moreClicked: boolean
    pointer: PointerEvent | null // the frame's last pointer event: a move, a press, or the pointer leaving or cancelled
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

// One of the link row's two layers: the lines the closed and the open paragraph don't share,
// each with its own link.
type MoreLayerDom = {
  lines: LinesDom
  link: HTMLButtonElement
  linkLine: number // the line the link is attached to, -1 while detached
}

// cache lifetime: page, for every node.
type DomCache = {
  page: HTMLElement
  widthSlider: HTMLInputElement
  widthValue: HTMLSpanElement
  linesSlider: HTMLInputElement
  linesValue: HTMLSpanElement
  boxes: HTMLDivElement[]
  clamps: LinesDom[]
  middle: LineDom
  moreBox: HTMLDivElement
  reducedMotion: MediaQueryList
  followStage: HTMLDivElement
  followBox: HTMLDivElement
  follow: LinesDom
  moreShared: LinesDom
  moreClosed: MoreLayerDom
  moreOpen: MoreLayerDom
}

const st: State = {
  requestedTextWidth: DEFAULT_TEXT_WIDTH,
  maxLines: DEFAULT_LINES,
  moreOpen: false,
  moreFade: 0,
  moreFadedAt: null,
  pointer: null,
  followWidth: null,
  followHeight: null,
  springsSteppedUntil: null,
  events: {
    widthValue: null,
    linesValue: null,
    moreClicked: false,
    pointer: null,
  },
}

// The link row's fade covers 63% of what is left of it every this many milliseconds.
const FADE_TIME_CONSTANT = 60
// The fade is at its end once the box is within this many pixels of its height there.
const FADE_REST = 0.05
// The follow row's springs: stepped this many milliseconds at a time, with this stiffness and
// damping for a mass of 1, which overshoots a little, and at rest once this close and this slow.
const SPRING_STEP = 4
const SPRING_STIFFNESS = 300
const SPRING_DAMPING = 24
const SPRING_REST = 0.01

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

domCache.moreClosed.link.addEventListener('click', toggleMore)
domCache.moreOpen.link.addEventListener('click', toggleMore)

// A press counts as a move, for a touch. The pointer leaving the page ends the hover, as does a
// touch the browser takes over to scroll, which Safari tells only as a cancel. A scroll can move
// the stage under a pointer that stays where it is.
document.addEventListener('pointermove', recordPointer)
document.addEventListener('pointerdown', recordPointer)
document.addEventListener('pointercancel', recordPointer)
document.documentElement.addEventListener('pointerleave', recordPointer)

window.addEventListener('scroll', () => {
  scheduleRender()
})

window.addEventListener('resize', () => {
  scheduleRender()
})

document.fonts.ready.then(() => {
  scheduleRender()
})

scheduleRender()

function toggleMore(): void {
  st.events.moreClicked = true
  scheduleRender()
}

function recordPointer(event: PointerEvent): void {
  st.events.pointer = event
  scheduleRender()
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// Moves a spring towards `dest` by `steps` steps, or puts it there under reduced motion.
// Returns whether it still moves.
function stepSpring(spring: Spring, dest: number, steps: number, reducedMotion: boolean): boolean {
  spring.dest = dest
  const t = SPRING_STEP / 1000
  for (let i = 0; i < steps; i++) {
    spring.v += (-SPRING_STIFFNESS * (spring.pos - spring.dest) - SPRING_DAMPING * spring.v) * t
    spring.pos += spring.v * t
  }
  // A spring swings about its end forever, ever less: close and slow enough is at rest.
  if (reducedMotion || (Math.abs(spring.v) < SPRING_REST && Math.abs(spring.dest - spring.pos) < SPRING_REST)) {
    spring.pos = spring.dest
    spring.v = 0
    return false
  }
  return true
}

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

function createLine(box: HTMLDivElement, index: number): LineDom {
  const root = createElement('div', 'line', box)
  root.style.top = `${index * LINE_HEIGHT}px`
  const text = document.createTextNode('')
  root.appendChild(text)
  return { root, text }
}

// A row: its label, then a card that holds a box of text in the font and line height Pretext
// measured. The card takes its width from the box and its own padding.
function createRow(label: string, direction: 'ltr' | 'rtl', parent: Element): HTMLDivElement {
  createElement('div', 'row-label', parent).textContent = label
  return createCard(direction, parent)
}

function createCard(direction: 'ltr' | 'rtl', parent: Element): HTMLDivElement {
  const card = createElement('div', 'card', parent)
  card.style.padding = `${CARD_PADDING_Y}px ${CARD_PADDING_X}px`
  const box = createElement('div', 'text', card)
  box.dir = direction
  box.style.font = FONT
  box.style.lineHeight = `${LINE_HEIGHT}px`
  return box
}

// A layer of the link row: the lines from where the two states part, and a link.
function createMoreLayer(box: HTMLDivElement, label: string, expanded: boolean): MoreLayerDom {
  const layer = createElement('div', 'layer', box)
  const link = document.createElement('button')
  link.type = 'button'
  link.className = 'more-link'
  link.textContent = label
  link.setAttribute('aria-expanded', expanded ? 'true' : 'false')
  return { lines: { box: layer, lines: [] }, link, linkLine: -1 }
}

function createDom(): DomCache {
  const rows = getRequiredElement('rows', HTMLElement)

  const boxes: HTMLDivElement[] = []
  const clamps: LinesDom[] = []
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]!
    const box = createRow(sample.label, sample.direction, rows)
    boxes.push(box)
    clamps.push({ box, lines: [] })
  }

  const middleBox = createRow(middleLabel.label, 'ltr', rows)
  middleBox.style.height = `${LINE_HEIGHT}px`
  boxes.push(middleBox)

  const moreBox = createRow(moreSample.label, moreSample.direction, rows)
  moreBox.classList.add('more')
  boxes.push(moreBox)

  // The follow row's card sits in a stage of a fixed height, so the rows below the card's top
  // stay where they are while it grows. Its box isn't among `boxes`: its width is its own.
  createElement('div', 'row-label', rows).textContent = followSample.label
  const followStage = createElement('div', 'stage', rows)
  followStage.style.height = `${FOLLOW_STAGE_HEIGHT}px`
  const followBox = createCard(followSample.direction, followStage)

  return {
    page: getRequiredElement('page', HTMLElement),
    widthSlider: getRequiredElement('width-slider', HTMLInputElement),
    widthValue: getRequiredElement('width-value', HTMLSpanElement),
    linesSlider: getRequiredElement('lines-slider', HTMLInputElement),
    linesValue: getRequiredElement('lines-value', HTMLSpanElement),
    boxes,
    clamps,
    middle: createLine(middleBox, 0),
    moreBox,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)'),
    followStage,
    followBox,
    follow: { box: followBox, lines: [] },
    // The shared lines get an element of their own ahead of the two layers, so the row's DOM is
    // in reading order, which a selection, a copy and a screen reader follow.
    moreShared: { box: createElement('div', 'shared', moreBox), lines: [] },
    moreClosed: createMoreLayer(moreBox, MORE_LABEL, false),
    moreOpen: createMoreLayer(moreBox, LESS_LABEL, true),
  }
}

function scheduleRender(): void {
  if (scheduledRaf !== null) return
  scheduledRaf = requestAnimationFrame(function renderEllipsisFrame(now) {
    scheduledRaf = null
    if (render(now)) scheduleRender()
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

// Writes one layer of the link row: where it starts, its lines, the link after `linkLine`, and
// how much of it shows. The layer of the state the row isn't in is inert, so its link takes no
// click and no focus, even while it still fades out.
function paintMoreLayer(dom: MoreLayerDom, top: number, lines: string[], linkLine: number, tail: string, opacity: number, shown: boolean): void {
  dom.lines.box.style.top = `${top}px`
  paintLines(dom.lines, lines, linkLine < 0 ? '' : tail)
  if (dom.linkLine !== linkLine) {
    if (linkLine < 0) dom.link.remove()
    else dom.lines.lines[linkLine]!.root.appendChild(dom.link)
    dom.linkLine = linkLine
  }
  dom.lines.box.style.opacity = String(opacity)
  dom.lines.box.toggleAttribute('inert', !shown)
}

// Returns whether the link row still fades or the follow row still springs, which takes another
// frame.
function render(now: number): boolean {
  // DOM reads
  // body.clientWidth leaves out the scrollbar gutter. Chrome's documentElement.clientWidth includes
  // the gutter while the page doesn't overflow.
  const viewportWidth = document.body.clientWidth
  const linkHadFocus = document.activeElement === domCache.moreClosed.link || document.activeElement === domCache.moreOpen.link
  const reducedMotion = domCache.reducedMotion.matches
  const stage = domCache.followStage.getBoundingClientRect()

  // Inputs
  let requestedTextWidth = st.requestedTextWidth
  if (st.events.widthValue !== null) requestedTextWidth = st.events.widthValue
  let maxLines = st.maxLines
  if (st.events.linesValue !== null) maxLines = st.events.linesValue
  let moreOpen = st.moreOpen
  if (st.events.moreClicked) moreOpen = !moreOpen
  let pointer = st.pointer
  if (st.events.pointer !== null) {
    const gone = st.events.pointer.type === 'pointerleave' || st.events.pointer.type === 'pointercancel'
    pointer = gone ? null : { x: st.events.pointer.clientX, y: st.events.pointer.clientY }
  }

  // Layout
  const geometry = getPageGeometry(viewportWidth, requestedTextWidth)
  const textWidth = geometry.textWidth
  const clamps: ClampLayout[] = []
  for (let i = 0; i < samples.length; i++) clamps.push(layoutClamp(samples[i]!.prepared, textWidth, maxLines))
  const middle = layoutMiddle(middleLabel, textWidth)
  // Both states of the link row, so that one can fade into the other, at whatever width the
  // frame has: every height is known before the click.
  const closed = layoutMore(moreSample.prepared, textWidth, maxLines, false)
  const open = layoutMore(moreSample.prepared, textWidth, maxLines, true)
  // A paragraph that fits its lines has no link, and its two states are the same lines. Otherwise
  // they share every line before the closed one's last, which stays as it is while the rest fades.
  const sharedLines = closed.linkLine >= 0 ? closed.linkLine : closed.lines.length
  // The follow row's card puts its bottom right corner under a pointer that is over the stage,
  // within the sizes the stage holds, and rests at the sliders' size otherwise.
  const followMinWidth = Math.min(MIN_TEXT_WIDTH, geometry.maxTextWidth)
  const followMaxHeight = FOLLOW_MAX_LINES * LINE_HEIGHT
  let followWidthDest = textWidth
  let followHeightDest = maxLines * LINE_HEIGHT
  if (
    pointer !== null &&
    pointer.x >= stage.left && pointer.x <= stage.left + geometry.pageWidth &&
    pointer.y >= stage.top && pointer.y <= stage.top + FOLLOW_STAGE_HEIGHT
  ) {
    followWidthDest = clamp(pointer.x - stage.left - CARD_PADDING_X * 2, followMinWidth, geometry.maxTextWidth)
    followHeightDest = clamp(pointer.y - stage.top - CARD_PADDING_Y * 2, LINE_HEIGHT, followMaxHeight)
  }

  // Animation tick
  // The fade closes on its state by exponential decay, which is closed-form: a frame of any
  // length lands on the same curve, and a click halfway turns it around from where it is.
  const fadeDest = moreOpen ? 1 : 0
  let moreFade = st.moreFade
  let moreFadedAt: number | null = null
  if (moreFade !== fadeDest) {
    moreFade = fadeDest + (moreFade - fadeDest) * Math.exp(-(now - (st.moreFadedAt ?? now)) / FADE_TIME_CONSTANT)
    if (reducedMotion || Math.abs(moreFade - fadeDest) * (open.height - closed.height) < FADE_REST) moreFade = fadeDest
    else moreFadedAt = now
  }
  // The follow row's springs take whole steps up to this frame's time. A spring is made at
  // rest where it first belongs, so the first frame paints the row at its size.
  const followWidth = st.followWidth ?? { pos: followWidthDest, dest: followWidthDest, v: 0 }
  const followHeight = st.followHeight ?? { pos: followHeightDest, dest: followHeightDest, v: 0 }
  let springsSteppedUntil = st.springsSteppedUntil ?? now
  // No more than 300 steps a frame, so a stalled tab doesn't make its next frame late too.
  const springSteps = Math.min(300, Math.floor((now - springsSteppedUntil) / SPRING_STEP))
  springsSteppedUntil += springSteps * SPRING_STEP
  const widthSprings = stepSpring(followWidth, followWidthDest, springSteps, reducedMotion)
  const heightSprings = stepSpring(followHeight, followHeightDest, springSteps, reducedMotion)
  const springing = widthSprings || heightSprings

  // The follow row's layout, at wherever its springs are: an overshoot stays inside the sizes
  // the stage holds, and the lines are those that fit the height. A line fits from half a pixel
  // short of it, since a spring swings by less than that about a whole number of lines before
  // it rests, and the last line would blink with each swing.
  const followTextWidth = clamp(followWidth.pos, followMinWidth, geometry.maxTextWidth)
  const followTextHeight = clamp(followHeight.pos, LINE_HEIGHT, followMaxHeight)
  const follow = layoutClamp(followSample.prepared, followTextWidth, Math.floor((followTextHeight + 0.5) / LINE_HEIGHT))

  st.requestedTextWidth = requestedTextWidth
  st.maxLines = maxLines
  st.moreOpen = moreOpen
  st.moreFade = moreFade
  st.moreFadedAt = moreFadedAt
  st.pointer = pointer
  st.followWidth = followWidth
  st.followHeight = followHeight
  st.springsSteppedUntil = springing ? springsSteppedUntil : null
  st.events.widthValue = null
  st.events.linesValue = null
  st.events.moreClicked = false
  st.events.pointer = null

  // DOM writes
  domCache.page.style.width = `${geometry.pageWidth}px`
  domCache.page.toggleAttribute('data-ready', true)
  domCache.widthSlider.min = String(Math.min(MIN_TEXT_WIDTH, geometry.maxTextWidth))
  domCache.widthSlider.max = String(geometry.maxTextWidth)
  domCache.widthSlider.value = String(textWidth)
  // Only on a change, as for a line's text: a pointer move renders too, and a selection in a
  // value shouldn't go with it.
  if (domCache.widthValue.textContent !== `${textWidth}px`) domCache.widthValue.textContent = `${textWidth}px`
  domCache.linesSlider.max = String(MAX_LINES)
  domCache.linesSlider.value = String(maxLines)
  if (domCache.linesValue.textContent !== String(maxLines)) domCache.linesValue.textContent = String(maxLines)
  for (let i = 0; i < domCache.boxes.length; i++) domCache.boxes[i]!.style.width = `${textWidth}px`

  for (let i = 0; i < samples.length; i++) {
    const clamp = clamps[i]!
    const dom = domCache.clamps[i]!
    dom.box.style.height = `${clamp.height}px`
    paintLines(dom, clamp.lines, clamp.truncated ? ELLIPSIS : '')
  }

  if (domCache.middle.text.data !== middle) domCache.middle.text.data = middle

  // The box is as far between the two states' heights as the fade is, and clips the open
  // layer's lines below that.
  domCache.moreBox.style.height = `${closed.height + (open.height - closed.height) * moreFade}px`
  paintLines(domCache.moreShared, closed.lines.slice(0, sharedLines), '')
  const layerTop = sharedLines * LINE_HEIGHT
  paintMoreLayer(domCache.moreClosed, layerTop, closed.lines.slice(sharedLines), closed.linkLine - sharedLines, `${ELLIPSIS} `, 1 - moreFade, !moreOpen)
  paintMoreLayer(domCache.moreOpen, layerTop, open.lines.slice(sharedLines), open.linkLine < 0 ? -1 : open.linkLine - sharedLines, ' ', moreFade, moreOpen)

  domCache.followBox.style.width = `${followTextWidth}px`
  domCache.followBox.style.height = `${followTextHeight}px`
  paintLines(domCache.follow, follow.lines, follow.truncated ? ELLIPSIS : '')

  // Side effects
  // Focus stays on the link that shows: a click leaves it on the layer that fades out, and a link
  // moved to another line loses it. Without a scroll, so a click doesn't jump the page to the link.
  if (linkHadFocus && closed.linkLine >= 0) (moreOpen ? domCache.moreOpen : domCache.moreClosed).link.focus({ preventScroll: true })

  return moreFadedAt !== null || springing
}

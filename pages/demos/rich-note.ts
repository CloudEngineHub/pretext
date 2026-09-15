import {
  BODY_DEFAULT_WIDTH,
  BODY_FONT,
  BODY_MIN_WIDTH,
  DEFAULT_RICH_NOTE_SPECS,
  prepareRichInlineNote,
  layoutRichNote,
  LINE_HEIGHT,
  NARROW_VIEWPORT_QUERY,
  resolveRichNoteBodyWidth,
  type RichNoteLayout,
} from './rich-note.model.ts'

type State = {
  events: {
    sliderValue: number | null
  }
  requestedWidth: number
}

const domCache = {
  root: document.documentElement, // cache lifetime: page
  narrowViewport: window.matchMedia(NARROW_VIEWPORT_QUERY), // cache lifetime: page
  noteBody: getRequiredDiv('note-body'), // cache lifetime: page
  widthSlider: getRequiredInput('width-slider'), // cache lifetime: page
  widthValue: getRequiredSpan('width-value'), // cache lifetime: page
}

const richInline = prepareRichInlineNote(DEFAULT_RICH_NOTE_SPECS)

const st: State = {
  events: {
    sliderValue: null,
  },
  requestedWidth: BODY_DEFAULT_WIDTH,
}

let scheduledRaf: number | null = null

domCache.widthSlider.addEventListener('input', () => {
  st.events.sliderValue = Number.parseInt(domCache.widthSlider.value, 10)
  scheduleRender()
})

window.addEventListener('resize', () => scheduleRender())

scheduleRender()

function getRequiredDiv(id: string): HTMLDivElement {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLDivElement)) throw new Error(`#${id} not found`)
  return element
}

function getRequiredInput(id: string): HTMLInputElement {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLInputElement)) throw new Error(`#${id} not found`)
  return element
}

function getRequiredSpan(id: string): HTMLSpanElement {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLSpanElement)) throw new Error(`#${id} not found`)
  return element
}

function scheduleRender(): void {
  if (scheduledRaf !== null) return
  scheduledRaf = requestAnimationFrame(function renderRichNoteDemo() {
    scheduledRaf = null
    render()
  })
}

function renderBody(layout: RichNoteLayout): void {
  domCache.noteBody.textContent = ''
  const fragment = document.createDocumentFragment()

  for (let lineIndex = 0; lineIndex < layout.lines.length; lineIndex++) {
    const line = layout.lines[lineIndex]!
    // Each Pretext line is one line box, so the browser orders its bidi runs.
    // The body font paints the collapsed spaces.
    const row = document.createElement('div')
    row.className = 'line-row'
    row.dir = layout.direction
    row.style.setProperty('--font', BODY_FONT)
    row.style.top = `${lineIndex * LINE_HEIGHT}px`

    for (let fragmentIndex = 0; fragmentIndex < line.fragments.length; fragmentIndex++) {
      const part = line.fragments[fragmentIndex]!
      if (part.spaceBefore) row.append(' ')
      const element = part.href === null
        ? document.createElement('span')
        : document.createElement('a')
      element.className = part.className
      // Paint with the font the item was measured with.
      element.style.setProperty('--font', part.font)
      element.textContent = part.text
      if (element instanceof HTMLAnchorElement && part.href !== null) {
        element.href = part.href
        element.target = '_blank'
        element.rel = 'noreferrer'
      }
      row.appendChild(element)
    }

    fragment.appendChild(row)
  }

  domCache.noteBody.appendChild(fragment)
}

function render(): void {
  // DOM reads
  const viewportWidth = document.documentElement.clientWidth
  const narrowViewport = domCache.narrowViewport.matches

  // Handle inputs
  let requestedWidth = st.requestedWidth
  if (st.events.sliderValue !== null) requestedWidth = st.events.sliderValue

  // Layout
  const { bodyWidth, maxBodyWidth, notePaddingX } = resolveRichNoteBodyWidth(viewportWidth, narrowViewport, requestedWidth)
  const layout = layoutRichNote(richInline, bodyWidth, notePaddingX)

  // Commit state
  st.requestedWidth = bodyWidth
  st.events.sliderValue = null

  // DOM writes
  domCache.widthSlider.min = String(BODY_MIN_WIDTH)
  domCache.widthSlider.max = String(maxBodyWidth)
  domCache.widthSlider.value = String(bodyWidth)
  domCache.widthValue.textContent = `${Math.round(bodyWidth)}px`
  domCache.root.style.setProperty('--note-width', `${layout.noteWidth}px`)
  domCache.root.style.setProperty('--note-padding-x', `${notePaddingX}px`)
  domCache.root.style.setProperty('--note-content-width', `${bodyWidth}px`)
  domCache.noteBody.style.height = `${layout.noteBodyHeight}px`

  renderBody(layout)
}

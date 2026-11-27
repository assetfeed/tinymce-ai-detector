import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { parseHTML } from 'linkedom'
import { createController } from '../src/controller.js'

const LONG = 'one two three four five six seven eight nine ten eleven twelve thirteen'
const answer = { status: 'ok', verdict: 'AI', ai_fraction: 0.62, windows: [{ verdict: 'AI', score: 0.9, words: 13, paragraphs: [0] }] }

let page
let made

beforeEach(() => {
    page = parseHTML('<html><head></head><body><div id="host"><div id="editable"></div></div></body></html>')
    globalThis.getComputedStyle = () => ({ color: 'rgb(0, 0, 0)', backgroundColor: 'rgba(0, 0, 0, 0)', position: 'relative' })
    made = []
})
afterEach(() => made.forEach((c) => c.destroy()))

const painterFake = class {
    constructor() { this.updates = [] }
    update(u) { this.updates.push(u) }
    destroy() {}
}

/** A controller over an editable whose lines are the given strings, one <p> each; lines.set(...) changes the text. */
function setup({ placeBar = true, ...options } = {}) {
    const editable = page.document.getElementById('editable')
    const lines = { list: [LONG, 'second line'] }
    const paint = () => { editable.innerHTML = lines.list.map((l) => `<p>${l}</p>`).join('') }
    const barFake = { el: page.document.createElement('div'), render(s) { this.last = s }, remove() { this.el.remove() } }
    const painters = []
    const controller = createController({
        source: 'test-ai-detector',
        options,
        root: () => editable,
        blocks: () => Array.from(editable.children).map((el) => ({ el, text: el.textContent })).filter((b) => b.text),
        placeBar: placeBar ? (el) => page.document.getElementById('host').append(el) : undefined,
    }, {
        Painter: class extends painterFake { constructor(o) { super(o); painters.push(this) } },
        makeCard: () => ({ show() {}, remove() {} }),
        makeBar: (o) => Object.assign(barFake, { o }),
    })

    paint()
    made.push(controller)

    return { controller, lines, paint, painters, barFake, editable }
}

test('a check sends one line per block and marks the long block of the answer', async () => {
    let sent
    const { controller, painters } = setup({ request: async ({ text }) => ((sent = text), answer) })

    await controller.check()

    assert.equal(sent, `${LONG}\nsecond line`)
    assert.equal(controller.state.status, 'ok')
    assert.equal(controller.state.kind, 'ai')
    assert.equal(controller.state.percent, 62)

    const last = painters[0].updates.at(-1)

    assert.equal(last.marks.length, 1)
    assert.equal(last.marks[0].el.textContent, LONG)
    assert.equal(last.view, 'highlight')
})

test('a text that is too short gives a message and no marks', async () => {
    const { controller, painters } = setup({ request: async () => ({ status: 'too_short' }) })

    await controller.check()

    assert.equal(controller.state.status, 'idle')
    assert.match(controller.state.notice.message, /too short/)
    assert.equal(painters.length, 0)
})

test('an empty editor is not sent', async () => {
    let calls = 0
    const { controller, lines, paint } = setup({ request: async () => (calls++, answer) })

    lines.list = []
    paint()
    await controller.check()

    assert.equal(calls, 0)
    assert.match(controller.state.notice.message, /Add some text/)
})

test('a 401 shows the key message with a tagged link', async () => {
    const { controller } = setup({ request: async () => { throw Object.assign(new Error(''), { status: 401 }) } })

    await controller.check()

    assert.match(controller.state.notice.message, /valid AssetFeed API key/)
    assert.match(controller.state.notice.link.href, /utm_source=test-ai-detector/)
})

test('an edit after the answer drops the marks and asks for a recheck; the same text in new elements keeps them', async () => {
    const { controller, lines, paint, painters } = setup({ request: async () => answer })

    await controller.check()
    paint() // same text, new elements
    controller.refresh()
    assert.equal(controller.state.status, 'ok')
    assert.equal(painters[0].updates.at(-1).marks.length, 1)

    lines.list = ['x ' + LONG, 'second line']
    paint()
    controller.refresh()
    assert.equal(controller.state.status, 'stale')
    assert.equal(controller.state.result, null)
    assert.equal(painters[0].updates.at(-1).marks.length, 0)
})

test('an answer for text that changed while it was on its way is dropped', async () => {
    let release
    const { controller, lines, paint } = setup({ request: () => new Promise((resolve) => { release = () => resolve(answer) }) })
    const pending = controller.check()

    assert.equal(controller.state.status, 'busy')
    lines.list = ['changed ' + LONG]
    paint()
    release()
    await pending

    assert.equal(controller.state.status, 'idle')
    assert.equal(controller.state.result, null)
})

test('setView takes the three views only; clear removes the answer', async () => {
    const { controller } = setup({ request: async () => answer })

    await controller.check()
    controller.setView('bars')
    assert.equal(controller.state.view, 'bars')
    controller.setView('nope')
    assert.equal(controller.state.view, 'bars')
    controller.setView('off')
    assert.equal(controller.state.view, 'off')
    controller.clear()
    assert.equal(controller.state.status, 'idle')
    assert.equal(controller.state.result, null)
})

test('the bar is made when there is a place for it and bar is not false', () => {
    const withBar = setup()
    const noPlace = setup({ placeBar: false })
    const off = setup({ bar: false })

    assert.ok(page.document.getElementById('host').contains(withBar.barFake.el))
    assert.equal(withBar.barFake.last.status, 'idle')
    assert.equal(noPlace.barFake.o, undefined)
    assert.equal(off.barFake.o, undefined)
})

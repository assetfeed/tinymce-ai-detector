import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseHTML } from 'linkedom'
import { collectBlocks } from '@assetfeed/ai-detector-core/marks.js'
import { createCommands } from '../src/commands.js'

// CKEditor's Command, reduced to what the commands use.
class Command {
    constructor(editor) {
        this.editor = editor
        this.isEnabled = false
        this.value = undefined
    }
}

function setup(state = { status: 'idle', result: null, view: 'highlight' }) {
    const calls = []
    const detector = {
        state,
        check: async () => calls.push('check'),
        clear: () => calls.push('clear'),
        setView: (view) => calls.push(`view:${view}`),
    }
    const { CheckAiWritingCommand, ClearAiMarksCommand, SetAiMarksViewCommand } = createCommands(Command, () => detector)

    return { calls, state, check: new CheckAiWritingCommand({}), clear: new ClearAiMarksCommand({}), view: new SetAiMarksViewCommand({}) }
}

test('the commands change no data, so they work in read-only mode', () => {
    const { check, clear, view } = setup()

    assert.deepEqual([check, clear, view].map((c) => c.affectsData), [false, false, false])
})

test('check is enabled unless a check is running; clear and view need an answer', () => {
    const t = setup()

    for (const c of [t.check, t.clear, t.view]) c.refresh()
    assert.deepEqual([t.check.isEnabled, t.clear.isEnabled, t.view.isEnabled], [true, false, false])

    t.state.status = 'busy'
    t.check.refresh()
    assert.equal(t.check.isEnabled, false)

    t.state.status = 'ok'
    t.state.result = { status: 'ok' }
    t.state.view = 'bars'
    for (const c of [t.check, t.clear, t.view]) c.refresh()
    assert.deepEqual([t.check.isEnabled, t.clear.isEnabled, t.view.isEnabled, t.view.value], [true, true, true, 'bars'])
})

test('execute passes through; an unknown view is ignored', async () => {
    const t = setup()

    await t.check.execute()
    t.clear.execute()
    t.view.execute('off')
    t.view.execute('nope')

    assert.deepEqual(t.calls, ['check', 'clear', 'view:off'])
})

test('before the editor is ready the commands are off and do nothing', () => {
    const { CheckAiWritingCommand } = createCommands(Command, () => null)
    const c = new CheckAiWritingCommand({})

    c.refresh()
    assert.equal(c.isEnabled, false)
    assert.equal(c.execute(), undefined)
})

// What the editable of a ClassicEditor holds: the collector skips the bogus paragraphs, fillers and widget chrome.
test('the lines of a CKEditor 5 editable', () => {
    const html = '<h2>Heading</h2><p>One <strong>bold</strong><br>two</p><p><br data-cke-filler="true"></p>'
        + '<ul><li>Item<ul><li>Nested</li></ul></li></ul><blockquote><p>Quote</p></blockquote>'
        + '<figure class="table"><table><tbody><tr><td><span class="ck-table-bogus-paragraph">Cell</span></td></tr></tbody></table></figure>'
        + '<figure class="image"><img src="x.png"><figcaption>Caption</figcaption></figure>'
    const { document } = parseHTML(`<html><body><div class="ck-editor__editable">${html}</div></body></html>`)
    const lines = collectBlocks(document.querySelector('.ck-editor__editable')).map((b) => b.text)

    assert.deepEqual(lines, ['Heading', 'One bold two', 'Item', 'Nested', 'Quote', 'Cell', 'Caption'])
})

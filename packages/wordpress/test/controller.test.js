import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createController } from '../src/controller.js'

const ANSWER = { status: 'ok', ai_fraction: 0.1, verdict: 'HUMAN', windows: [] }

function setup() {
    let text = 'one two three'
    const sends = []
    const notes = []
    const controller = createController({
        t: (s) => s,
        collect: () => [{ el: {}, text }],
        painter: () => null,
        notify: (message, type) => notes.push([type, message]),
        send: () => new Promise((resolve) => sends.push(resolve)),
    })

    return { controller, sends, notes, edit: (next) => { text = next } }
}

test('an edit while a recheck is on its way leaves no verdict on the new text', async () => {
    const { controller, sends, edit } = setup()

    const first = controller.check()
    sends[0](ANSWER)
    await first
    assert.equal(controller.snapshot().status, 'ok')

    const second = controller.check() // Recheck
    edit('one two three four') // typing, and the editor's debounced sync
    controller.sync()
    sends[1](ANSWER) // the answer is for the old text: dropped
    await second

    assert.equal(controller.snapshot().status, 'stale')
})

test('the same text after a block was drawn again keeps the answer', async () => {
    const { controller, sends } = setup()
    const first = controller.check()

    sends[0](ANSWER)
    await first
    controller.sync()
    assert.equal(controller.snapshot().status, 'ok')
})

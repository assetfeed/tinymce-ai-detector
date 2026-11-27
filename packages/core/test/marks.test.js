import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isTinted, kindOf, lineWindows, marksFor, markCard, percent } from '../src/marks.js'
import { mergeLineRects } from '../src/layer.js'

const long = 'word '.repeat(20).trim()
const blocks = ['a', 'b', 'c', 'short line'].map((id) => ({ el: { id }, text: id === 'short line' ? id : long }))

test('each line belongs to the strongest window that covers it', () => {
    const owner = lineWindows([
        { paragraphs: [0, 1], verdict: 'HUMAN' },
        { paragraphs: [1, 2, 3], verdict: 'AI' },
        { paragraphs: [3], verdict: 'nonsense' },
    ])

    assert.deepEqual([...owner], [[0, 0], [1, 1], [2, 1], [3, 1]])
})

test('marks skip short blocks and answers that are not ok', () => {
    const result = { status: 'ok', windows: [{ paragraphs: [0], verdict: 'HUMAN' }, { paragraphs: [1, 2, 3], verdict: 'AI' }] }

    assert.deepEqual(marksFor(blocks, result).map((m) => [m.el.id, m.kind, m.window, m.index]), [['a', 'human', 0, 0], ['b', 'ai', 1, 1], ['c', 'ai', 1, 2]])
    assert.deepEqual(marksFor(blocks, { ...result, status: 'too_short' }), [])
})

test('tints, verdicts, shares', () => {
    assert.equal(isTinted('ai', 0.85), true)
    assert.equal(isTinted('ai', 0.84), false)
    assert.equal(isTinted('unsure', 0.99), false)
    assert.equal(isTinted('human', 0), true)
    assert.equal(kindOf({ verdict: 'unsure' }), 'unsure')
    assert.equal(percent(0.1249), 12)

    const t = (text, ...args) => args.reduce((s, a, i) => s.replace(`{${i}}`, a), text)

    assert.deepEqual(markCard('human', { score: 0.1, words: 1200 }, t), { kind: 'human', label: 'Likely human', words: '1,200 words', share: 'Human 90%', fill: 90 })
    assert.equal(markCard('ai', { words: 1 }, t).share, null)
})

test('rects of one visual line merge into one box', () => {
    const boxes = mergeLineRects([
        { left: 0, top: 0, right: 50, bottom: 20 },
        { left: 50, top: 2, right: 90, bottom: 18 },
        { left: 0, top: 24, right: 40, bottom: 44 },
        { left: 5, top: 5, right: 5, bottom: 5 },
    ])

    assert.deepEqual(boxes, [{ left: 0, top: 0, right: 90, bottom: 20 }, { left: 0, top: 24, right: 40, bottom: 44 }])
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { format, joinBlocks, opaque } from '../src/text.js'

test('format fills numbered placeholders and leaves unknown ones', () => {
    assert.equal(format('AI text {0}%', 12), 'AI text 12%')
    assert.equal(format('{1} of {0}', 'a'), '{1} of a')
    assert.equal(format('Recheck'), 'Recheck')
})

test('joinBlocks makes one line per block', () => {
    assert.equal(joinBlocks([{ text: 'One' }, { text: 'Two' }]), 'One\nTwo')
    assert.equal(joinBlocks([]), '')
})

test('opaque tells a real colour from a see-through one', () => {
    assert.equal(opaque('rgb(255, 255, 255)'), true)
    assert.equal(opaque('rgba(0, 0, 0, 0)'), false)
    assert.equal(opaque('transparent'), false)
    assert.equal(opaque(''), false)
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseHTML } from 'linkedom'
import { collectBlocks } from '../src/marks.js'

const lines = (html) => collectBlocks(parseHTML(`<html><body>${html}</body></html>`).document.body).map((b) => b.text)

test('a line break inside a block keeps the words apart', () => {
    assert.deepEqual(lines('<p>First<br>Second</p>'), ['First Second'])
})

test('a list item keeps its text before and after a nested list; the nested items are lines of their own', () => {
    assert.deepEqual(lines('<ul><li>Before<ul><li>Nested</li></ul>After</li><li>Next</li></ul>'), ['Before After', 'Nested', 'Next'])
})

test('wrappers give their text to the blocks inside them, empty blocks are skipped', () => {
    assert.deepEqual(lines('<blockquote><p>Quoted</p></blockquote><p> </p><p><br></p><table><tr><td><p>Cell</p></td><td>Plain</td></tr></table>'), ['Quoted', 'Cell', 'Plain'])
})

test('inline formatting and whitespace are flattened; div blocks count (forced_root_block: div)', () => {
    assert.deepEqual(lines('<p>A <b>bold</b>\n  <a href="#">link</a></p><div>Div line</div><div>Loose <p>inner</p> tail</div>'), ['A bold link', 'Div line', 'Loose tail', 'inner'])
})

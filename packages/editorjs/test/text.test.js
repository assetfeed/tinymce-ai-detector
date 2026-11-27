import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseHTML } from 'linkedom'
import { collectBlocks } from '@assetfeed/ai-detector-core/marks.js'
import { format, joinBlocks, opaque } from '../src/text.js'

test('format fills numbered placeholders and leaves unknown ones', () => {
    assert.equal(format('AI text {0}%', 12), 'AI text 12%')
    assert.equal(format('{1} of {0}', 'a'), '{1} of a')
})

test('joinBlocks makes one line per block', () => {
    assert.equal(joinBlocks([{ text: 'One' }, { text: 'Two' }]), 'One\nTwo')
})

test('opaque tells a real colour from a see-through one', () => {
    assert.equal(opaque('rgb(255, 255, 255)'), true)
    assert.equal(opaque('rgba(0, 0, 0, 0)'), false)
    assert.equal(opaque(''), false)
})

// The DOM Editor.js 2.31 builds: every block is .ce-block > .ce-block__content > the tool's own element.
const block = (inner) => `<div class="ce-block"><div class="ce-block__content">${inner}</div></div>`
const redactor = (html) => parseHTML(`<html><body><div class="codex-editor__redactor">${html}</div></body></html>`).document.querySelector('.codex-editor__redactor')

test('collectBlocks on the Editor.js redactor yields one line per block, with the same elements the user edits', () => {
    const root = redactor([
        block('<div class="ce-paragraph cdx-block" contenteditable="true">First <b>bold</b> line<br>after break</div>'),
        block('<h2 class="ce-header" contenteditable="true">A heading</h2>'),
        block('<div class="ce-paragraph cdx-block" contenteditable="true"><br></div>'),
        block('<ul class="cdx-nested-list"><li class="cdx-nested-list__item"><div class="cdx-nested-list__item-body"><div class="cdx-nested-list__item-content"><div class="cdx-nested-list__item-content" contenteditable="true">Item one</div></div><ul class="cdx-nested-list"><li class="cdx-nested-list__item"><div class="cdx-nested-list__item-body"><div class="cdx-nested-list__item-content"><div contenteditable="true">Nested item</div></div></div></li></ul></div></li></ul>'),
        block('<div class="cdx-quote"><div class="cdx-input cdx-quote__text" contenteditable="true">Quoted words</div><div class="cdx-input cdx-quote__caption" contenteditable="true">Someone</div></div>'),
        block('<div class="ce-delimiter cdx-block"></div>'),
    ].join(''))
    const blocks = collectBlocks(root)

    assert.deepEqual(blocks.map((b) => b.text), ['First bold line after break', 'A heading', 'Item one', 'Nested item', 'Quoted words', 'Someone'])
    assert.ok(blocks.every((b) => b.el.isContentEditable || b.el.getAttribute('contenteditable') === 'true'))
})

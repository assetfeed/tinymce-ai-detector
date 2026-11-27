import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseHTML } from 'linkedom'
import { blockElements, collectPortableText, isPortableText, linesWithElements } from '../src/text.js'

const span = (key, text) => ({ _type: 'span', _key: key, text, marks: [] })
const block = (key, ...children) => ({ _type: 'block', _key: key, style: 'normal', markDefs: [], children })

test('one line per text block; empty blocks, block objects and missing values are left out', () => {
    const value = [
        block('a', span('s1', 'Heading')),
        block('b', span('s2', 'First '), span('s3', 'bold'), span('s4', ' text.')),
        { _type: 'image', _key: 'c' },
        block('d', span('s5', '  ')),
        block('e', span('s6', 'Line one\nline two')),
    ]

    assert.deepEqual(collectPortableText(value), [
        { key: 'a', text: 'Heading' },
        { key: 'b', text: 'First bold text.' },
        { key: 'e', text: 'Line one line two' },
    ])
    assert.deepEqual(collectPortableText(undefined), [])
    assert.deepEqual(collectPortableText(null), [])
})

test('an inline object between two spans is a space, not a join', () => {
    const value = [block('a', span('s1', 'before'), { _type: 'mention', _key: 'm1' }, span('s2', 'after'))]

    assert.deepEqual(collectPortableText(value), [{ key: 'a', text: 'before after' }])
})

test('a list item is a block of its own, so a line of its own', () => {
    const value = [{ ...block('a', span('s1', 'One')), listItem: 'bullet', level: 1 }, { ...block('b', span('s2', 'Two')), listItem: 'bullet', level: 2 }]

    assert.deepEqual(collectPortableText(value).map((l) => l.text), ['One', 'Two'])
})

test('a Portable Text field is an array that takes blocks', () => {
    assert.equal(isPortableText({ schemaType: { jsonType: 'array', of: [{ name: 'block' }, { name: 'image' }] } }), true)
    assert.equal(isPortableText({ schemaType: { jsonType: 'array', of: [{ name: 'image' }] } }), false)
    assert.equal(isPortableText({ schemaType: { jsonType: 'string' } }), false)
    assert.equal(isPortableText({}), false)
})

const dom = (html) => parseHTML(`<html><body><div id="root">${html}</div></body></html>`).document.getElementById('root')
const value = [block('a', span('s1', 'Heading')), { _type: 'image', _key: 'b' }, block('c', span('s2', 'Body'))]

test('elements are found by data-block-key, by data-pt-path and, failing both, by order; the innermost wrapper is taken', () => {
    const byKey = dom('<div data-block-key="a"><div><span>Heading</span></div></div><div data-block-key="b"></div><div data-block-key="c"><div><span>Body</span></div></div>')
    const byPath = dom('<div data-pt-path=\'[_key=="a"]\'><div><span>Heading</span></div></div><div data-pt-path=\'[_key=="b"]\'></div><div data-pt-path=\'[_key=="c"]\'><h2><span>Body</span></h2></div>')
    const byOrder = dom('<div><div><span>Heading</span></div></div><div></div><div><div><span>Body</span></div></div>')

    for (const root of [byKey, byPath, byOrder]) {
        const found = blockElements(root, value)

        assert.equal(found.get('a').tagName, 'DIV')
        assert.equal(found.get('a').children[0].tagName, 'SPAN')
        assert.equal(found.get('c').textContent, 'Body')
    }

    assert.equal(blockElements(byPath, value).get('c').tagName, 'H2')
})

test('a line whose element is not on screen keeps its place with a null element', () => {
    const root = dom('<div data-block-key="a"><div><span>Heading</span></div></div>')

    assert.deepEqual(linesWithElements(root, value).map((l) => [l.text, l.el?.tagName ?? null]), [['Heading', 'DIV'], ['Body', null]])
    assert.deepEqual(linesWithElements(null, value).map((l) => l.el), [null, null])
})

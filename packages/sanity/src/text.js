/**
 * The text of a Portable Text value and the elements it sits in. The detector gets one line per text block (a list item is a
 * block of its own), empty blocks left out, whitespace flattened: the same lines the other plugins send, so an answer's line
 * numbers are the numbers of these lines.
 */

const collapse = (s) => s.replace(/\s+/g, ' ').trim()

/** The lines of a value: [{ key, text }]. An inline object between two spans is a space; block objects (an image) are not lines. */
export function collectPortableText(value) {
    return (Array.isArray(value) ? value : [])
        .filter((block) => block?._type === 'block' && Array.isArray(block.children))
        .map((block) => ({
            key: block._key,
            text: collapse(block.children.map((child) => (child?._type === 'span' && typeof child.text === 'string' ? child.text : ' ')).join('')),
        }))
        .filter((line) => line.text !== '')
}

/** A Portable Text field: an array that takes text blocks. */
export const isPortableText = (props) => props?.schemaType?.jsonType === 'array' && Boolean(props.schemaType.of?.some((type) => type.name === 'block'))

// @portabletext/editor puts the key of a block on its element: data-block-key up to 6.x, data-pt-path="[_key==\"k\"]" from 6.x.
const keyOf = (el) => el.getAttribute('data-block-key') ?? el.getAttribute('data-pt-path')?.match(/^\[_key=="(.*)"\]$/)?.[1] ?? null

const WRAPPER = /^(DIV|P|H[1-6]|LI|UL|OL|BLOCKQUOTE|PRE)$/

/** The element the text sits in: down the wrappers (block > div > ...) as long as there is one child to go into. */
export function innermost(el) {
    while (el.children.length === 1 && WRAPPER.test(el.children[0].tagName)) {
        el = el.children[0]
    }

    return el
}

/**
 * The element of each block of a value, by key: Map(key -> element). The blocks are the children of the editable element, one
 * per block of the value in order, which also finds them when an editor version marks them differently.
 */
export function blockElements(root, value) {
    const found = new Map()
    const children = Array.from(root.children)
    const list = Array.isArray(value) ? value : []
    const byOrder = children.length === list.length

    children.forEach((child, index) => {
        const key = keyOf(child) ?? (byOrder ? list[index]?._key : null)

        if (key) {
            found.set(key, innermost(child))
        }
    })

    return found
}

/** The lines of a value with the element each sits in, null for one that is not on screen: [{ el, text }]. */
export function linesWithElements(root, value) {
    const elements = root ? blockElements(root, value) : new Map()

    return collectPortableText(value).map(({ key, text }) => ({ el: elements.get(key) ?? null, text }))
}

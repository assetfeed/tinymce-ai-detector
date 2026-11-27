/** The interface strings have {0}, {1} placeholders, as in the other plugins. */
export const format = (text, ...args) => String(text).replace(/\{(\d+)\}/g, (match, i) => (i in args ? args[i] : match))

/** The text the detector gets and the answer is checked against: one line per block. */
export const joinBlocks = (blocks) => blocks.map((block) => block.text).join('\n')

export const opaque = (color) => Boolean(color) && color !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(color)

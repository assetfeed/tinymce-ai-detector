/**
 * The input that goes around the Portable Text editor of a field: the editor as it is (renderDefault), the AI bar under it
 * and the marks layer beside its editable element. It reads the text from the field's value; the document is never changed.
 * It imports only React, so it can be tried on a page with @portabletext/editor, without a Studio.
 */

import { createElement as h, useEffect, useRef } from 'react'
import { createController } from '@assetfeed/ai-detector-core/controller.js'
import { linesWithElements } from './text.js'

// The editable element of @portabletext/editor, in the Studio and out of it.
const EDITABLE = '[data-slate-editor="true"]'

/** @param {{ input: object, options?: object }} props  input: the field's props (value, renderDefault); options: see the README */
export function AiDetectorInput({ input, options }) {
    const wrap = useRef(null)
    const slot = useRef(null)
    const value = useRef(input.value)
    const detector = useRef(null)

    value.current = input.value

    useEffect(() => {
        const editable = () => wrap.current?.querySelector(EDITABLE) ?? null

        detector.current = createController({
            source: 'sanity-ai-detector',
            options,
            root: editable,
            blocks: () => linesWithElements(editable(), value.current),
            placeBar: (bar) => slot.current?.append(bar),
        })

        return () => {
            detector.current?.destroy()
            detector.current = null
        }
    }, [])

    // The value changed: once the editor has drawn it, the answer is checked against the text it was made for.
    useEffect(() => {
        const frame = requestAnimationFrame(() => detector.current?.refresh())

        return () => cancelAnimationFrame(frame)
    }, [input.value])

    return h('div', { ref: wrap }, input.renderDefault(input), h('div', { ref: slot }))
}

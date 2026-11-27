/**
 * The check of one post, shared by the block editor sidebar and the Classic Editor meta box: collect the lines, ask the server,
 * keep the answer, drop it when the text changes, tell the UI. The editors plug in what differs (where the text is, where the
 * marks are drawn, how a message is shown).
 */

import { DetectorError } from '@assetfeed/ai-detector-core/api.js'
import { VIEWS } from '@assetfeed/ai-detector-core/bar.js'
import { LABEL, kindOf, marksFor, percent } from '@assetfeed/ai-detector-core/marks.js'

const join = (blocks) => blocks.map((block) => block.text).join('\n')

/**
 * @param {object} o
 * @param {(text: string, ...args: any[]) => string} o.t
 * @param {(lines: string[]) => Promise<object>} o.send  the answer's data object; rejects with an Error that has .status
 * @param {() => Array<{el: Element, text: string}>|null} o.collect  the blocks of the post now, null if the editor is not there
 * @param {(create: boolean) => object|null} o.painter  the marks painter for the editor as it is now, made only if create
 * @param {(text: string, type: string, error?: Error) => void} o.notify  type: info | error
 */
export function createController({ t, send, collect, painter, notify }) {
    let busy = false
    let view = 'highlight' // highlight | bars | off
    let shown = 'highlight' // the view the marks toggle brings back
    let state = null // { text, result, marks, checkedAt }
    let stale = false // the text changed after the last answer
    const listeners = new Set()

    const snapshot = () => ({
        status: busy ? 'busy' : state ? 'ok' : stale ? 'stale' : 'idle',
        kind: state ? kindOf(state.result) ?? 'unsure' : null,
        percent: state ? percent(state.result.ai_fraction) : 0,
        view,
        checkedAt: state?.checkedAt,
        marks: state?.marks?.length ?? 0,
    })

    function emit() {
        // The layer is made with the first marks, not before.
        painter(Boolean(state?.marks?.length))?.update({ marks: state?.marks, windows: state?.result?.windows, view })
        listeners.forEach((listener) => listener(snapshot()))
    }

    function setView(next) {
        if (!VIEWS.includes(next)) {
            return
        }

        view = next
        shown = next === 'off' ? shown : next
        emit()
    }

    async function check() {
        if (busy) {
            return
        }

        const blocks = collect()

        if (!blocks || blocks.length === 0) {
            notify(t('Add some text to check.'), 'info')
            return
        }

        const text = join(blocks)

        busy = true
        emit()

        try {
            const result = await send(blocks.map((block) => block.text))
            const current = collect()

            // The text was replaced while the answer was on its way: the answer is for text that no longer exists.
            if (!current || join(current) !== text) {
                return
            }

            if (result?.status === 'too_short') {
                notify(t('The text is too short to check. Add a few more sentences.'), 'info')
            } else if (result?.status === 'unsupported_language') {
                notify(t('Only English text can be checked for now.'), 'info')
            } else if (result?.status === 'ok') {
                view = view === 'off' ? shown : view
                stale = false
                state = { text, result, marks: marksFor(current, result), checkedAt: new Date() }
            } else {
                throw new DetectorError(0)
            }
        } catch (e) {
            notify(e?.message || t('The AI check failed. Try again later.'), 'error', e)
        } finally {
            busy = false
            emit()
        }
    }

    /** The text may have changed, or the editor drew its blocks again: drop the answer, or put the marks on the blocks now there. */
    function sync() {
        // Also while a recheck is on its way: an edit then must not leave the old verdict on the new text.
        if (!state) {
            return
        }

        const current = collect()

        if (!current) {
            return
        }

        if (join(current) !== state.text) {
            state = null
            stale = true
        } else {
            state.marks = marksFor(current, state.result)
        }

        emit()
    }

    return {
        check,
        sync,
        setView,
        snapshot,
        label: (kind) => t(LABEL[kind]),
        toggleMarks: () => setView(view === 'off' ? shown : 'off'),
        subscribe(listener) {
            listeners.add(listener)

            return () => listeners.delete(listener)
        },
    }
}

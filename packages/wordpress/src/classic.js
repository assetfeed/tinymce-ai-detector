/**
 * AI detector for the Classic Editor: a meta box with the check and its result, and the marks drawn beside the text in the
 * Visual editor (the TinyMCE 4 iframe WordPress ships). In the Text tab the post is checked too, without marks.
 * The post is never touched: the layer lives in the iframe next to <body>, outside the content TinyMCE saves.
 */

import { isDark } from '@assetfeed/ai-detector-core/api.js'
import { createBar } from '@assetfeed/ai-detector-core/bar.js'
import { collectBlocks } from '@assetfeed/ai-detector-core/marks.js'
import { createController } from './controller.js'
import { linkFor, painterFor, send, t } from './wp-common.js'

const $ = window.jQuery

// The Visual editor of the main text field, if it is showing.
const visual = () => {
    const editor = window.tinymce?.get('content')

    return editor && !editor.isHidden() && editor.getBody() ? editor : null
}

// Visual: the blocks of the iframe. Text: the textarea goes through the same autop WordPress applies when switching to Visual.
const collect = () => {
    const editor = visual()

    if (editor) {
        return collectBlocks(editor.getBody())
    }

    const area = document.getElementById('content')

    if (!area) {
        return null
    }

    const html = window.switchEditors?.wpautop ? window.switchEditors.wpautop(area.value) : area.value

    return collectBlocks(new DOMParser().parseFromString(html, 'text/html').body)
}

const left = () => visual()?.getBody().getBoundingClientRect().left ?? 0

function init(box) {
    // One notice above the bar; the next check replaces it.
    const notice = document.createElement('div')

    notice.hidden = true
    box.appendChild(notice)

    const notify = (text, type, error) => {
        const link = linkFor(error)

        notice.className = `notice inline notice-${type === 'error' ? 'error' : 'info'} aid-wp__notice`
        notice.replaceChildren(Object.assign(document.createElement('p'), { textContent: text }))

        if (link) {
            const a = Object.assign(document.createElement('a'), { textContent: link.text, href: link.href, target: '_blank', rel: 'noopener' })

            notice.firstChild.append(' ', a)
        }

        notice.hidden = false
    }

    const controller = createController({
        t,
        collect,
        notify,
        painter: painterFor(() => visual()?.iframeElement ?? null, left),
        send: (lines) => send(Number(document.getElementById('post_ID')?.value), lines),
    })
    const bar = createBar({ doc: document, scope: '.aid-wp', t, onRun: () => { notice.hidden = true; controller.check() }, onView: controller.setView })
    const render = (s) => bar.render({ ...s, dark: isDark(box), background: '' })

    box.appendChild(bar.el)
    render(controller.snapshot())
    controller.subscribe(render)

    // An answer is for the text it was given: the first edit drops the marks and the bar asks for a recheck.
    let timer = 0
    const sync = () => {
        clearTimeout(timer)
        timer = setTimeout(controller.sync, 200)
    }

    $('#content').on('input', sync)

    const bind = (editor) => editor.on('input change undo redo SetContent show hide', sync)

    if (window.tinymce?.get('content')) {
        bind(window.tinymce.get('content'))
    }

    $(document).on('tinymce-editor-init', (event, editor) => editor.id === 'content' && bind(editor))
}

$(() => {
    const box = document.getElementById('assetfeed-aid-box')

    if (box) {
        init(box)
    }
})

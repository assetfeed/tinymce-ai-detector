/**
 * AI detector for the block editor: a sidebar with the result, a "Check for AI writing" entry in the options menu, and the
 * marks drawn beside the text in the editor canvas. The post is never touched: the layer lives in the canvas document, outside
 * the blocks, so the content, the undo history and the "unsaved changes" state stay as they were.
 */

import { isDark } from '@assetfeed/ai-detector-core/api.js'
import { createBar } from '@assetfeed/ai-detector-core/bar.js'
import { collectBlocks } from '@assetfeed/ai-detector-core/marks.js'
import { createController } from './controller.js'
import { config, linkFor, painterFor, send, t } from './wp-common.js'

const { registerPlugin } = window.wp.plugins
const { createElement: h, Fragment, useEffect, useRef } = window.wp.element
const { PanelBody } = window.wp.components
const { dispatch, select, subscribe } = window.wp.data
// PluginSidebar and its menu items moved from @wordpress/edit-post to @wordpress/editor in WordPress 6.6.
const { PluginMoreMenuItem, PluginSidebar, PluginSidebarMoreMenuItem } = window.wp.editor

const NAME = 'assetfeed-ai-detector'

// Lucide ScanText (ISC licence), the icon of the other AssetFeed editor plugins.
const ICON = h('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false },
    h('path', { d: 'M3 7V5a2 2 0 0 1 2-2h2' }), h('path', { d: 'M17 3h2a2 2 0 0 1 2 2v2' }), h('path', { d: 'M21 17v2a2 2 0 0 1-2 2h-2' }),
    h('path', { d: 'M7 21H5a2 2 0 0 1-2-2v-2' }), h('path', { d: 'M7 8h8' }), h('path', { d: 'M7 12h10' }), h('path', { d: 'M7 16h6' }))

// The canvas is an iframe in the current block editor; older setups and some plugins render it in the page itself.
const frame = () => document.querySelector('iframe[name="editor-canvas"]')
const root = () => (frame()?.contentDocument || document).querySelector('.is-root-container')

// The block list only: the post title and the empty "type / to choose a block" line are not text of the post.
const collect = () => {
    const el = root()

    return el ? collectBlocks(el).filter((block) => !block.el.closest('.block-editor-default-block-appender')) : null
}

// ponytail: the bars sit left of the leftmost block (a wide or full-width block pulls them to the edge); per-alignment lanes if themes need it.
const left = () => Math.min(...(collect() || []).map((block) => block.el.getBoundingClientRect().left).concat(Infinity))

const notify = (text, type, error) => {
    const link = linkFor(error)
    const failed = type === 'error'

    dispatch('core/notices').createNotice(failed ? 'error' : 'info', text, {
        type: failed ? 'default' : 'snackbar',
        isDismissible: true,
        actions: link ? [{ label: link.text, onClick: () => window.open(link.href, '_blank', 'noopener') }] : [],
    })
}

const controller = createController({
    t,
    collect,
    notify,
    painter: painterFor(frame, () => (Number.isFinite(left()) ? left() : 0)),
    send: (lines) => send(select('core/editor').getCurrentPostId(), lines),
})

// An answer is for the text it was given: the first edit drops the marks, and the bar asks for a recheck. A block the editor
// draws again (moved, converted) is a new element: the marks go on the blocks that are there now.
let last = null
let timer = 0

subscribe(() => {
    const key = [select('core/block-editor').getBlocks(), frame(), root()]

    if (last && key.every((part, i) => part === last[i])) {
        return
    }

    last = key
    clearTimeout(timer)
    timer = setTimeout(controller.sync, 200)
})

function Panel() {
    const host = useRef(null)

    useEffect(() => {
        const bar = createBar({ doc: document, scope: '.aid-wp', t, onRun: controller.check, onView: controller.setView })
        const render = (s) => bar.render({ ...s, dark: isDark(host.current), background: '' })

        host.current.appendChild(bar.el)
        render(controller.snapshot())

        const off = controller.subscribe(render)

        return () => {
            off()
            bar.remove()
        }
    }, [])

    return h(PanelBody, null,
        h('div', { className: 'aid-wp', ref: host }),
        config.hasKey || !config.settingsUrl ? null : h('p', { className: 'aid-wp__hint' }, t('Add your AssetFeed API key in Settings → AI detector.'), ' ', h('a', { href: config.settingsUrl, target: '_blank', rel: 'noopener' }, t('Open settings'))))
}

registerPlugin(NAME, {
    icon: ICON,
    render: () => h(Fragment, null,
        h(PluginSidebarMoreMenuItem, { target: NAME, icon: ICON }, t('AI detector')),
        h(PluginMoreMenuItem, {
            icon: ICON,
            onClick: () => {
                dispatch('core/edit-post').openGeneralSidebar(`${NAME}/${NAME}`)
                controller.check()
            },
        }, t('Check for AI writing')),
        h(PluginSidebar, { name: NAME, title: t('AI detector'), icon: ICON }, h(Panel))),
})

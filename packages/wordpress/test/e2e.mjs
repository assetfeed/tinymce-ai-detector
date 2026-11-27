// End-to-end check of the plugin in a real WordPress (see test/README.md): block editor, settings page, Classic Editor.
//   node test/e2e.mjs [shots-dir]      needs the Playground server on :9411 and the fake detector on :8841
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launch } from './cdp.mjs'

const base = 'http://127.0.0.1:9411'
const shots = process.argv[2] || tmpdir()
const last = () => JSON.parse(readFileSync(join(tmpdir(), 'aid-fake-last.json'), 'utf8'))
const browser = await launch()
const results = []
const ok = (name, detail = '') => { results.push(name); console.log('ok  ', name, detail) }

try {
    // Playground's default admin account.
    await browser.goto(`${base}/wp-login.php`)
    await browser.eval(() => { document.querySelector('#user_login').value = 'admin'; document.querySelector('#user_pass').value = 'password'; document.querySelector('#wp-submit').click() })
    await browser.sleep(3000)
    // Start from the fake detector and its key, whatever an earlier run left behind.
    await browser.goto(`${base}/wp-admin/options-general.php?page=assetfeed-ai-detector`)
    await browser.eval(() => { document.querySelector('#assetfeed_aid_api_key').value = 'af_test'; document.querySelector('#assetfeed_aid_endpoint').value = 'http://127.0.0.1:8841/'; document.querySelector('#submit').click() })
    await browser.sleep(2500)
    await browser.goto(`${base}/wp-admin/edit.php?post_type=post`)
    const postId = await browser.until(() => document.querySelector('tr.type-post')?.id.replace('post-', ''))

    // ---- block editor -------------------------------------------------------------------------------------------
    await browser.goto(`${base}/wp-admin/post.php?post=${postId}&action=edit`)
    await browser.until(() => window.wp?.data?.select('core/editor')?.getCurrentPostId() && document.querySelector('iframe[name="editor-canvas"]')?.contentDocument?.querySelectorAll('.is-root-container p').length >= 7)
    await browser.eval(() => {
        wp.data.dispatch('core/preferences').set('core/edit-post', 'welcomeGuide', false)
        wp.data.dispatch('core/preferences').set('core/edit-post', 'fullscreenMode', false)
        wp.data.dispatch('core/edit-post').openGeneralSidebar('assetfeed-ai-detector/assetfeed-ai-detector')
    })
    await browser.until(() => document.querySelector('.aid-wp .aid-run'))
    ok('sidebar opens with the bar')

    const before = await browser.eval(() => ({ content: wp.data.select('core/editor').getEditedPostContent(), dirty: wp.data.select('core/editor').isEditedPostDirty() }))

    await browser.eval(() => document.querySelector('.aid-wp .aid-run').click())
    await browser.until(() => /AI text/.test(document.querySelector('.aid-wp .aid-badge__label')?.textContent))
    await browser.sleep(600)

    const sent = last()
    assert.equal(sent.key, 'af_test')
    assert.equal(sent.body.text.split('\n').length, 7, 'one line per paragraph')
    ok('check sent one line per block with the server-side key')

    const marks = await browser.eval(() => {
        const doc = document.querySelector('iframe[name="editor-canvas"]').contentDocument
        const layer = doc.querySelector('.aid-marks')

        return { bars: layer.querySelectorAll('i').length, tints: layer.querySelectorAll('b').length, inRoot: doc.querySelector('.is-root-container').querySelectorAll('.aid-marks').length }
    })

    assert.ok(marks.bars >= 2 && marks.tints >= 2, JSON.stringify(marks))
    assert.equal(marks.inRoot, 0)
    ok('marks drawn in the canvas, outside the blocks', JSON.stringify(marks))

    const after = await browser.eval(() => ({ content: wp.data.select('core/editor').getEditedPostContent(), dirty: wp.data.select('core/editor').isEditedPostDirty(), undo: wp.data.select('core/editor').hasEditorUndo() }))

    assert.equal(after.content, before.content)
    assert.equal(after.dirty, before.dirty)
    assert.equal(after.undo, false)
    ok('post content, dirty flag and undo stack unchanged after the check')

    await browser.eval(() => document.querySelector('iframe[name="editor-canvas"]').contentWindow.scrollTo(0, 380)) // both a human and an AI passage in view
    await browser.sleep(400)
    await browser.screenshot(join(shots, 'screenshot-1.png'))
    await browser.eval(() => document.querySelector('iframe[name="editor-canvas"]').contentWindow.scrollTo(0, 0))

    // Hover card.
    const point = await browser.eval(() => {
        const frame = document.querySelector('iframe[name="editor-canvas"]')
        const p = frame.contentDocument.querySelectorAll('.is-root-container p')[1].getBoundingClientRect()
        const f = frame.getBoundingClientRect()

        return { x: f.left + p.left + 40, y: f.top + p.top + 10 }
    })

    await browser.mouse(point.x, point.y)
    await browser.sleep(700)
    assert.ok(await browser.eval(() => document.querySelector('.aid-card:not([hidden])')?.textContent.includes('Likely human')))
    ok('hover card shows')
    await browser.mouse(5, 5)

    // An edit drops the marks and asks for a recheck.
    await browser.eval(() => {
        const [first] = wp.data.select('core/block-editor').getBlocks()

        wp.data.dispatch('core/block-editor').updateBlockAttributes(first.clientId, { content: first.attributes.content + ' Edited.' })
    })
    await browser.until(() => /recheck/i.test(document.querySelector('.aid-wp .aid-badge__label')?.textContent))
    assert.equal(await browser.eval(() => document.querySelector('iframe[name="editor-canvas"]').contentDocument.querySelectorAll('.aid-marks > *').length), 0)
    ok('edit clears the marks and asks for a recheck')

    // ---- settings -----------------------------------------------------------------------------------------------
    await browser.goto(`${base}/wp-admin/options-general.php?page=assetfeed-ai-detector`)
    assert.equal(await browser.eval(() => document.querySelector('#assetfeed_aid_api_key').value), '', 'the key is never printed back')
    assert.equal(await browser.eval(() => document.querySelector('#assetfeed_aid_api_key').placeholder), '••••test')
    await browser.screenshot(join(shots, 'screenshot-2.png'))
    ok('settings page: key masked')

    // A bad key gives the API's 401 with a link; save it through the real form.
    await browser.eval(() => { document.querySelector('#assetfeed_aid_api_key').value = 'bad'; document.querySelector('#submit').click() })
    await browser.sleep(2500)
    await browser.goto(`${base}/wp-admin/post.php?post=${postId}&action=edit`)
    await browser.until(() => document.querySelector('iframe[name="editor-canvas"]')?.contentDocument?.querySelectorAll('.is-root-container p').length >= 7)
    await browser.eval(() => wp.data.dispatch('core/edit-post').openGeneralSidebar('assetfeed-ai-detector/assetfeed-ai-detector'))
    await browser.until(() => document.querySelector('.aid-wp .aid-run'))
    await browser.eval(() => document.querySelector('.aid-wp .aid-run').click())
    const notice = await browser.until(() => document.querySelector('.components-notice.is-error')?.textContent)
    assert.match(notice, /valid AssetFeed API key/)
    assert.match(notice, /Get an API key/)
    ok('401 shows the message and the key link', notice)
    await browser.screenshot(join(shots, 'screenshot-error.png'))

    // Restore the key.
    await browser.goto(`${base}/wp-admin/options-general.php?page=assetfeed-ai-detector`)
    await browser.eval(() => { document.querySelector('#assetfeed_aid_api_key').value = 'af_test'; document.querySelector('#submit').click() })
    await browser.sleep(2500)

    // ---- Classic Editor -----------------------------------------------------------------------------------------
    await browser.goto(`${base}/wp-admin/post.php?post=${postId}&action=edit&classic=1`)
    await browser.until(() => Boolean(document.querySelector('#assetfeed-aid-box .aid-run') && window.switchEditors))
    await browser.eval(() => window.switchEditors.go('content', 'tmce')) // the last run left the Text tab selected
    await browser.until(() => Boolean(window.tinymce?.get('content')?.getBody() && !tinymce.get('content').isHidden()))
    await browser.eval(() => document.querySelector('#assetfeed-aid-box .aid-run').click())
    await browser.until(() => /AI text/.test(document.querySelector('#assetfeed-aid-box .aid-badge__label')?.textContent))
    await browser.sleep(600)

    const classic = await browser.eval(() => {
        const doc = tinymce.get('content').getDoc()

        return { bars: doc.querySelectorAll('.aid-marks i').length, tints: doc.querySelectorAll('.aid-marks b').length, saved: tinymce.get('content').getContent().includes('aid-marks') }
    })

    assert.ok(classic.bars >= 2 && classic.tints >= 2, JSON.stringify(classic))
    assert.equal(classic.saved, false)
    ok('Classic Editor: marks in the TinyMCE iframe, not in the saved content', JSON.stringify(classic))
    await browser.screenshot(join(shots, 'screenshot-3.png'))

    // The Text tab is checked too, without marks.
    await browser.eval(() => { window.switchEditors.go('content', 'html'); document.querySelector('#assetfeed-aid-box .aid-run').click() })
    await browser.until(() => /AI text/.test(document.querySelector('#assetfeed-aid-box .aid-badge__label')?.textContent) && !document.querySelector('#assetfeed-aid-box .aid-badge.is-busy'))
    assert.equal(last().body.text.split('\n').length, 7)
    ok('Classic Editor, Text tab: checked as seven lines')

    // ---- the options-menu entry of the block editor ---------------------------------------------------------------
    await browser.goto(`${base}/wp-admin/post.php?post=${postId}&action=edit`)
    await browser.until(() => document.querySelector('iframe[name="editor-canvas"]')?.contentDocument?.querySelectorAll('.is-root-container p').length >= 7)
    await browser.eval(() => { wp.data.dispatch('core/preferences').set('core/edit-post', 'welcomeGuide', false); wp.data.dispatch('core/edit-post').closeGeneralSidebar(); document.querySelector('button[aria-label="Options"]').click() })
    await browser.until(() => { const item = [...document.querySelectorAll('[role="menuitem"]')].find((e) => /Check for AI writing/.test(e.textContent)); item?.click(); return Boolean(item) })
    await browser.until(() => /AI text/.test(document.querySelector('.aid-wp .aid-badge__label')?.textContent))
    ok('options menu entry opens the sidebar and runs the check')

    // ---- no key, endpoint rules -----------------------------------------------------------------------------------
    await browser.goto(`${base}/wp-admin/options-general.php?page=assetfeed-ai-detector`)
    await browser.eval(() => document.querySelector('input[value="Remove the saved key"]').click())
    await browser.until(() => document.querySelector('.notice-success')?.textContent.includes('The key was removed.'))
    assert.equal(await browser.eval(() => document.querySelector('#assetfeed_aid_api_key').placeholder), '')
    await browser.goto(`${base}/wp-admin/post.php?post=${postId}&action=edit`)
    await browser.until(() => document.querySelector('iframe[name="editor-canvas"]')?.contentDocument?.querySelectorAll('.is-root-container p').length >= 7)
    await browser.eval(() => wp.data.dispatch('core/edit-post').openGeneralSidebar('assetfeed-ai-detector/assetfeed-ai-detector'))
    await browser.until(() => Boolean(document.querySelector('.aid-wp__hint')))
    await browser.eval(() => document.querySelector('.aid-wp .aid-run').click())
    const noKey = await browser.until(() => document.querySelector('.components-notice.is-error')?.textContent)
    assert.match(noKey, /Add your AssetFeed API key/)
    assert.match(noKey, /Open settings/)
    ok('no key: hint in the sidebar, the error links to the settings')

    await browser.goto(`${base}/wp-admin/options-general.php?page=assetfeed-ai-detector`)
    await browser.eval(() => { document.querySelector('#assetfeed_aid_api_key').value = 'af_test'; document.querySelector('#assetfeed_aid_endpoint').value = 'http://example.com/checks'; document.querySelector('#submit').click() })
    await browser.until(() => document.querySelector('#setting-error-assetfeed_aid_endpoint')?.textContent.includes('https'))
    assert.equal(await browser.eval(() => document.querySelector('#assetfeed_aid_endpoint').value), '')
    ok('endpoint: plain http to a remote host is refused and the default is used')

    // Back to the fake detector for whoever runs this next.
    await browser.eval(() => { document.querySelector('#assetfeed_aid_endpoint').value = 'http://127.0.0.1:8841/'; document.querySelector('#submit').click() })
    await browser.sleep(2500)

    console.log(`\n${results.length} checks passed`, browser.logs.length ? `\nconsole errors:\n${browser.logs.join('\n')}` : '')
} catch (e) {
    console.error('FAILED:', e.message, '\nafter:', results.at(-1), '\nlogs:', browser.logs)
    await browser.screenshot(join(shots, 'failure.png')).catch(() => {})
    process.exitCode = 1
} finally {
    await browser.close()
}

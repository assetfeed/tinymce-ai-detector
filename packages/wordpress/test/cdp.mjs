// A tiny Chrome DevTools client on Node's built-in WebSocket (no puppeteer): one headless Chrome, one tab.
// ponytail: macOS Chrome path; set CHROME for another one.
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function launch({ width = 1440, height = 900 } = {}) {
    const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    const profile = mkdtempSync(join(tmpdir(), 'aid-wp-'))
    const port = 9600 + Math.floor(Math.random() * 300)
    const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${width},${height}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' })
    let targets

    for (let i = 0; i < 50 && !targets; i++) {
        await sleep(200)
        targets = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json()).catch(() => null)
    }

    const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)

    await new Promise((r) => ws.addEventListener('open', r))

    let id = 0
    const pending = new Map()
    const logs = []

    ws.addEventListener('message', (e) => {
        const m = JSON.parse(e.data)

        if (m.id && pending.has(m.id)) {
            pending.get(m.id)(m)
            pending.delete(m.id)
        }
        if (m.method === 'Runtime.exceptionThrown') logs.push('exception: ' + m.params.exceptionDetails.exception?.description)
        if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description).join(' '))
    })

    const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })

    await send('Runtime.enable')
    await send('Page.enable')
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })

    return {
        logs,
        async goto(url) {
            await send('Page.navigate', { url })
            await sleep(2500)
        },
        /** Runs `fn` (an async arrow function as a string or function) in the page; returns its value. */
        async eval(fn) {
            const res = await send('Runtime.evaluate', { expression: `(${fn})()`, awaitPromise: true, returnByValue: true, timeout: 60000 })

            if (res.result?.exceptionDetails) {
                throw new Error(res.result.exceptionDetails.exception?.description || 'eval failed')
            }

            return res.result?.result?.value
        },
        /** Polls `fn` until it returns something truthy. */
        async until(fn, ms = 30000) {
            for (let t = 0; t < ms; t += 300) {
                const v = await this.eval(fn).catch(() => null)

                if (v) return v
                await sleep(300)
            }
            throw new Error(`timeout waiting for ${fn}`)
        },
        async screenshot(file, clip) {
            const shot = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) })

            writeFileSync(file, Buffer.from(shot.result.data, 'base64'))
        },
        /** A real mouse move, for hover. */
        async mouse(x, y) {
            await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, pointerType: 'mouse' })
        },
        sleep,
        async close() {
            ws.close()
            proc.kill()
            await sleep(300)
            rmSync(profile, { recursive: true, force: true })
        },
    }
}

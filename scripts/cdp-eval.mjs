// Dev helper: open a URL in a private headless Chrome and print what an async function returns.
// node scripts/cdp-eval.mjs <url> <file-with-async-arrow-function> [width]
// DPR=2 renders at that pixel ratio; SCREENSHOT=/abs/path.png saves the viewport after the function ran; COOKIE='name=value;domain' sets a cookie before navigating.
// ponytail: tiny CDP client on Node's built-in WebSocket, no puppeteer; one page, one evaluation.
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [url, file, width = '1280'] = process.argv.slice(2)
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const profile = mkdtempSync(join(tmpdir(), 'aid-cdp-'))
const port = 9300 + Math.floor(Math.random() * 500)
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${width},900`, '--no-first-run', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

try {
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
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
        if (m.method === 'Runtime.exceptionThrown') logs.push('exception: ' + m.params.exceptionDetails.exception?.description)
        if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description).join(' '))
    })
    const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
    await send('Runtime.enable')
    await send('Page.enable')
    await send('Network.enable')
    if (process.env.DPR) await send('Emulation.setDeviceMetricsOverride', { width: Number(width), height: 900, deviceScaleFactor: Number(process.env.DPR), mobile: false })
    if (process.env.COOKIE) {
        const [pair, domain] = process.env.COOKIE.split(';')
        const [name, ...value] = pair.split('=')
        await send('Network.setCookie', { name, value: value.join('='), domain: domain || new URL(url).hostname, path: '/' })
    }
    await send('Page.navigate', { url })
    await sleep(3000)
    const fn = readFileSync(file, 'utf8')
    const res = await send('Runtime.evaluate', { expression: `(${fn})()`, awaitPromise: true, returnByValue: true, timeout: 60000 })
    if (process.env.SCREENSHOT) {
        const shot = await send('Page.captureScreenshot', { format: 'png' })
        writeFileSync(process.env.SCREENSHOT, Buffer.from(shot.result.data, 'base64'))
    }
    console.log(JSON.stringify({ result: res.result?.result?.value ?? res.result?.exceptionDetails?.exception?.description ?? res.result, logs }, null, 1))
    ws.close()
} finally {
    proc.kill()
    await sleep(300)
    rmSync(profile, { recursive: true, force: true })
}

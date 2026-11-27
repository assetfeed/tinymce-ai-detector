async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  for (let i = 0; i < 60 && !window.editorjsDetector; i++) await sleep(250)
  const ed = window.editorjsEditor
  const det = window.editorjsDetector
  const host = document.querySelector('#editorjs-editor')
  const wrap = host.querySelector('.codex-editor')
  const redactor = host.querySelector('.codex-editor__redactor')
  const bar = () => [...document.querySelectorAll('.aid-bar')].find((b) => host.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
  const marks = () => ({ b: wrap.querySelectorAll('.aid-marks b').length, i: wrap.querySelectorAll('.aid-marks i').length, u: wrap.querySelectorAll('.aid-marks u').length })
  const text = (el) => el?.innerText.replace(/\n/g, ' | ') ?? null
  const save0 = JSON.stringify((await ed.save()).blocks)
  const out = { idle: text(bar()), layerInRedactor: redactor.querySelector('.aid-marks') !== null }

  await det.check()
  out.ok = text(bar())
  out.state = { status: det.state.status, kind: det.state.kind, percent: det.state.percent }
  await sleep(300)
  out.marks = marks()
  const save1 = JSON.stringify((await ed.save()).blocks)
  out.saveClean = save1 === save0 && !/aid-/.test(save1)
  out.domClean = !redactor.innerHTML.includes('aid-')
  det.setView('bars'); await sleep(100); out.bars = marks()
  det.setView('off'); await sleep(100); out.off = marks()
  det.setView('highlight'); await sleep(100); out.highlight = marks()

  const p = redactor.querySelectorAll('.ce-paragraph')[5]
  p.scrollIntoView({ block: 'center' }); await sleep(300)
  const r = p.getBoundingClientRect()
  p.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: r.left + 80, clientY: r.top + 8 }))
  await sleep(600)
  out.cards = document.querySelectorAll('.aid-card').length
  out.card = text(document.querySelector('.aid-card'))
  const bx = wrap.querySelector('.aid-marks i')?.getBoundingClientRect().left, tx = p.getBoundingClientRect().left
  out.barLeftOfText = bx !== undefined && bx < tx

  p.firstChild.data = 'x ' + p.firstChild.data
  await sleep(200)
  out.stale = text(bar())
  out.staleMarks = marks()
  await det.check(); await sleep(300)
  const after = [...document.querySelectorAll('main *')].filter((e) => host.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING)
  out.notice = after.map((e) => e.innerText || '').find((t) => /The AI check needs/.test(t))?.split('\n')[0] ?? null
  out.link = after.find((e) => e.matches('a[href*="api-keys"]'))?.getAttribute('href') ?? null
  out.linkUtm = /utm_source=editorjs-ai-detector/.test(out.link || '')
  out.saveAfterEdit = (await ed.save()).blocks.length

  // A drop while waiting: edit during a pending check, the answer must not draw.
  p.firstChild.data = p.firstChild.data.replace(/^x /, '')
  await sleep(100)
  const pending = det.check()
  p.firstChild.data = 'y ' + p.firstChild.data
  await pending; await sleep(300)
  out.droppedMarks = marks()
  out.droppedStatus = det.state.status

  // Collector on the real Header, List and Quote tools.
  try {
    const [Header, List, Quote] = await Promise.all([
      import('https://esm.sh/@editorjs/header@2.8.9').then((m) => m.default),
      import('https://esm.sh/@editorjs/list@2.0.9').then((m) => m.default),
      import('https://esm.sh/@editorjs/quote@2.7.6').then((m) => m.default),
    ])
    const { AiDetector } = await import('/packages/editorjs/dist/index.js')
    const div = document.createElement('div'); div.id = 'tools-editor'; document.body.append(div)
    const e2 = new EditorJS({ holder: 'tools-editor', tools: { header: Header, list: List, quote: Quote }, data: { blocks: [
      { type: 'header', data: { text: 'A heading', level: 2 } },
      { type: 'paragraph', data: { text: 'One<br>two <b>bold</b>' } },
      { type: 'list', data: { style: 'unordered', items: [{ content: 'Item one', items: [{ content: 'Nested', items: [] }] }, { content: 'Item two', items: [] }] } },
      { type: 'quote', data: { text: 'Quoted words', caption: 'Someone', alignment: 'left' } },
      { type: 'paragraph', data: { text: '' } },
    ] } })
    await e2.isReady
    let sent = null
    const d2 = new AiDetector(e2, { holder: 'tools-editor', request: async ({ text }) => { sent = text; return { status: 'too_short' } } })
    await d2.check()
    out.toolLines = sent?.split('\n') ?? null
    d2.destroy(); await e2.destroy()
  } catch (e) { out.toolLines = 'ERR ' + e.message }

  det.destroy()
  out.destroyed = { bars: [...document.querySelectorAll('.aid-bar')].filter((b) => host.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).length, layers: wrap.querySelectorAll('.aid-marks').length, style: redactor.getAttribute('style') }
  return out
}

async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  for (let i = 0; i < 40 && !window.tiptapEditor; i++) await sleep(250)
  const ed = window.tiptapEditor
  const wrap = ed.view.dom.parentElement
  const host = document.querySelector('#tiptap-editor')
  const bar = () => [...document.querySelectorAll('.aid-bar')].find((b) => host.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
  const marks = () => ({ b: wrap.querySelectorAll('.aid-marks b').length, i: wrap.querySelectorAll('.aid-marks i').length })
  const html0 = ed.getHTML()
  let calls = 0
  const origFetch = window.fetch
  window.fetch = (...a) => { calls++; return origFetch(...a) }
  const can = [ed.can().checkAiWriting(), ed.can().clearAiMarks(), ed.can().setAiMarksView('bars'), ed.can().setAiMarksView('nope')]
  await new Promise((r) => setTimeout(r, 900))
  const canNoop = { can, calls, status: ed.storage.aiDetector.status, view: ed.storage.aiDetector.view }
  window.fetch = origFetch
  const out = { canNoop, idle: bar()?.innerText.replace(/\n/g, ' | ') }
  ed.commands.checkAiWriting()
  await sleep(1500)
  out.ok = bar()?.innerText.replace(/\n/g, ' | ')
  out.marks = marks()
  out.clean = ed.getHTML() === html0 && !/aid-/.test(ed.getHTML())
  out.undo = ed.can().undo()
  ed.commands.setAiMarksView('bars'); await sleep(100); out.bars = marks()
  ed.commands.setAiMarksView('highlight'); await sleep(100)
  const p = ed.view.dom.querySelectorAll('p')[5]
  const r = p.getBoundingClientRect()
  p.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: r.left + 80, clientY: r.top + 8 }))
  await sleep(600)
  out.cards = document.querySelectorAll('.aid-card').length
  out.card = document.querySelector('.aid-card')?.innerText.replace(/\n/g, ' | ') ?? null
  ed.commands.insertContentAt(1, 'x ')
  await sleep(150)
  out.stale = bar()?.innerText.replace(/\n/g, ' | ')
  out.staleMarks = marks()
  ed.commands.checkAiWriting(); await sleep(1500)
  const after = [...document.querySelectorAll('main *')].filter((e) => host.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING)
  out.notice = after.map((e) => e.innerText || '').find((t) => /The AI check needs/.test(t))?.split('\n')[0] ?? null
  out.link = after.find((e) => e.matches('a[href*="api-keys"]'))?.getAttribute('href') ?? null
  return out
}

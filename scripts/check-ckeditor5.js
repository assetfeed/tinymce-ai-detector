async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  for (let i = 0; i < 60 && !window.ckeditorEditor; i++) await sleep(250)
  const ed = window.ckeditorEditor
  const root = ed.editing.view.getDomRoot()
  const wrap = root.parentElement
  const bar = () => document.querySelector('.ck-editor + .aid-bar')
  const marks = () => ({ b: wrap.querySelectorAll('.aid-marks b').length, i: wrap.querySelectorAll('.aid-marks i').length, u: wrap.querySelectorAll('.aid-marks u').length })
  const text = (el) => el?.innerText.replace(/\n/g, ' | ') ?? null
  const cmd = (n) => ed.commands.get(n)
  const data0 = ed.getData()
  const out = { idle: text(bar()), button: !!document.querySelector('.ck-toolbar .ck-button[data-cke-tooltip-text="Check for AI writing"]') }

  out.enabled = { check: cmd('checkAiWriting').isEnabled, clear: cmd('clearAiMarks').isEnabled, view: cmd('setAiMarksView').isEnabled }
  const plugin = ed.plugins.get('AiDetector')

  await ed.execute('checkAiWriting')
  await sleep(300)
  out.ok = text(bar())
  out.state = { status: plugin.detector.state.status, kind: plugin.detector.state.kind, percent: plugin.detector.state.percent }
  out.enabledAfter = { check: cmd('checkAiWriting').isEnabled, clear: cmd('clearAiMarks').isEnabled, view: cmd('setAiMarksView').isEnabled, value: cmd('setAiMarksView').value }
  out.marks = marks()
  out.dataClean = ed.getData() === data0 && !/aid-/.test(ed.getData())
  out.domClean = !root.innerHTML.includes('aid-')
  out.undo = cmd('undo').isEnabled
  out.layerBesideRoot = root.previousElementSibling?.classList.contains('aid-marks') ?? false
  ed.execute('setAiMarksView', 'bars'); await sleep(100); out.bars = marks()
  ed.execute('setAiMarksView', 'off'); await sleep(100); out.off = marks()
  ed.execute('setAiMarksView', 'highlight'); await sleep(100); out.highlight = marks()

  const p = root.querySelectorAll('p')[5]
  p.scrollIntoView({ block: 'center' }); await sleep(300)
  const r = p.getBoundingClientRect()
  p.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: r.left + 80, clientY: r.top + 8 }))
  await sleep(600)
  out.cards = document.querySelectorAll('.aid-card').length
  out.card = text(document.querySelector('.aid-card'))
  const bx = wrap.querySelector('.aid-marks i')?.getBoundingClientRect().left, tx = p.getBoundingClientRect().left
  out.barLeftOfText = bx !== undefined && bx < tx
  out.barInsideEditor = bx >= wrap.getBoundingClientRect().left

  // setData with the same content: new elements, the answer stays and the marks follow.
  ed.setData(data0); await sleep(300)
  out.sameData = { status: plugin.detector.state.status, marks: marks() }

  ed.model.change((w) => w.insertText('x ', ed.model.document.getRoot().getChild(5), 0))
  await sleep(200)
  out.stale = text(bar())
  out.staleMarks = marks()
  out.staleEnabled = { clear: cmd('clearAiMarks').isEnabled }
  await ed.execute('checkAiWriting'); await sleep(300)
  const after = [...document.querySelectorAll('main *')].filter((e) => bar().compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING || e === bar().nextElementSibling)
  out.notice = after.map((e) => e.innerText || '').find((t) => /The AI check needs/.test(t))?.split('\n')[0] ?? null
  out.link = after.find((e) => e.matches('a[href*="api-keys"]'))?.getAttribute('href') ?? null
  out.linkUtm = /utm_source=ckeditor5-ai-detector/.test(out.link || '')

  // A drop while waiting: edit during a pending check, the answer must not draw.
  ed.setData(data0); await sleep(200)
  const pending = ed.execute('checkAiWriting')
  ed.model.change((w) => w.insertText('y ', ed.model.document.getRoot().getChild(5), 0))
  await pending; await sleep(300)
  out.droppedMarks = marks()
  out.droppedStatus = plugin.detector.state.status

  // The collector on headings, lists, a quote and a table, in a second editor.
  try {
    const { ClassicEditor, Essentials, Paragraph, Heading, Bold, List, BlockQuote, Table, Image, ImageCaption } = await import('ckeditor5')
    const { AiDetector } = await import('/packages/ckeditor5/dist/index.js')
    const div = document.createElement('div'); div.id = 'tools-editor'; document.body.append(div)
    let sent = null
    const e2 = await ClassicEditor.create(div, { licenseKey: 'GPL', plugins: [Essentials, Paragraph, Heading, Bold, List, BlockQuote, Table, Image, ImageCaption, AiDetector], aiDetector: { request: async ({ text }) => { sent = text; return { status: 'too_short' } } },
      initialData: '<h2>A heading</h2><p>One<br>two <strong>bold</strong></p><ul><li>Item one<ul><li>Nested</li></ul></li><li>Item two</li></ul><blockquote><p>Quoted words</p></blockquote><table><tbody><tr><td>Cell one</td><td>Cell two</td></tr></tbody></table><p>&nbsp;</p>' })
    await e2.execute('checkAiWriting')
    out.toolLines = sent?.split('\n') ?? null
    await e2.destroy(); div.remove()
  } catch (e) { out.toolLines = 'ERR ' + e.message }

  await ed.destroy()
  out.destroyed = { bars: document.querySelectorAll('.aid-bar').length, layers: document.querySelectorAll('.aid-marks').length }
  return out
}

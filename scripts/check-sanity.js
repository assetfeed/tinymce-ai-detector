async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  for (let i = 0; i < 80 && !window.portableTextEditor; i++) await sleep(250)
  const host = document.querySelector('#portabletext-editor')
  const editable = host.querySelector('[data-slate-editor]')
  const wrap = editable.parentElement
  const bar = () => host.querySelector('.aid-bar')
  const marks = () => ({ b: wrap.querySelectorAll('.aid-marks b').length, i: wrap.querySelectorAll('.aid-marks i').length, u: wrap.querySelectorAll('.aid-marks u').length })
  const text = (el) => el?.innerText.replace(/\n/g, ' | ') ?? null
  const press = async (sel) => { host.querySelector(sel).click(); await sleep(1500) }
  const value0 = JSON.stringify(window.portableTextValue)
  const out = { idle: text(bar()), layerBeforeCheck: wrap.querySelector('.aid-marks') !== null }

  await press('.aid-run')
  out.ok = text(bar())
  out.marks = marks()
  out.valueClean = JSON.stringify(window.portableTextValue) === value0 && !/aid-/.test(value0)
  out.domClean = !editable.innerHTML.includes('aid-')
  out.layerBesideEditable = editable.previousElementSibling?.classList.contains('aid-marks') ?? false
  const views = [...host.querySelectorAll('.aid-views button')]
  views[1].click(); await sleep(150); out.bars = marks()
  views[2].click(); await sleep(150); out.off = marks()
  views[0].click(); await sleep(150); out.highlight = marks()

  const p = editable.children[5]
  p.scrollIntoView({ block: 'center' }); await sleep(300)
  const r = p.getBoundingClientRect()
  editable.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: r.left + 80, clientY: r.top + 8 }))
  p.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: r.left + 80, clientY: r.top + 8 }))
  await sleep(600)
  out.cards = document.querySelectorAll('.aid-card').length
  out.card = text(document.querySelector('.aid-card'))
  const bx = wrap.querySelector('.aid-marks i')?.getBoundingClientRect().left, tx = p.getBoundingClientRect().left
  out.barLeftOfText = bx !== undefined && bx < tx

  // An edit through the editor's own API: the value changes, the marks go, the bar asks for a recheck.
  const ed = window.portableTextEditor
  ed.send({ type: 'select', at: { anchor: { path: [{ _key: 'b5' }, 'children', { _key: 's5' }], offset: 0 }, focus: { path: [{ _key: 'b5' }, 'children', { _key: 's5' }], offset: 0 } } })
  ed.send({ type: 'insert.text', text: 'x ' })
  await sleep(500)
  out.edited = window.portableTextValue[5].children[0].text.slice(0, 8)
  out.stale = text(bar())
  out.staleMarks = marks()
  await press('.aid-run')
  const slot = bar().parentElement
  out.notice = slot.innerText.includes('The AI check needs a valid AssetFeed API key') ? 'key message' : text(slot)
  out.link = slot.querySelector('a[href*="api-keys"]')?.getAttribute('href') ?? null
  out.linkUtm = /utm_source=sanity-ai-detector/.test(out.link || '')
  return out
}

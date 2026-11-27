async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  for (let i = 0; i < 40 && !(window.tinymce?.get?.()[0]?.initialized && window.hugerte?.get?.()[0]?.initialized); i++) await sleep(250)
  const out = {}
  for (const [name, lib] of [['tinymce', window.tinymce], ['hugerte', window.hugerte]]) {
    const ed = lib.get()[0]
    const c = ed.getContainer()
    const doc = ed.getDoc()
    const idle = c.querySelector('.aid-bar')?.innerText.replace(/\n/g, ' | ')
    ed.execCommand('AiDetectorCheck')
    await sleep(1500)
    const bar = c.querySelector('.aid-bar')
    out[name] = {
      idle,
      ok: bar?.innerText.replace(/\n/g, ' | '),
      barStyled: bar ? getComputedStyle(bar).display : null,
      badgeRadius: bar ? getComputedStyle(bar.querySelector('.aid-badge')).borderRadius : null,
      beforeStatus: bar?.nextElementSibling?.classList.contains('tox-statusbar'),
      tints: doc.querySelectorAll('.aid-marks b').length,
      bars: doc.querySelectorAll('.aid-marks i').length,
      clean: !/aid-/.test(ed.getContent()),
    }
  }
  return out
}

# AI detector for Editor.js

A small controller that checks an Editor.js document for AI-written text. Run a check and the editor's text goes to the [AssetFeed AI content detector](https://assetfeed.com/ai-content-detector?utm_source=editorjs-ai-detector&utm_medium=readme). The answer comes back as marks beside the passages:

- an orange bar for likely AI, amber for unsure, green for likely human;
- a tint behind the passages the detector is most sure about;
- a card with the verdict, word count and score when you hover a passage.

Under the editor, a bar shows the share of AI text, with a Recheck button and a switch between highlights, side bars only and no marks.

The marks live in a separate layer next to the editor, not in a block. `editor.save()` never sees them, so the saved data is exactly what was typed.

**[Try the demo](https://assetfeed.github.io/ai-detector-plugins/demo/)**. It replays a recorded answer for the sample text, so it works without an API key.

Tested on Editor.js 2.31.7. English text only for now.

## Install

```sh
npm install @assetfeed/editorjs-ai-detector
```

```js
import EditorJS from '@editorjs/editorjs'
import { AiDetector } from '@assetfeed/editorjs-ai-detector'

const editor = new EditorJS({ holder: 'editorjs' })
await editor.isReady

const detector = new AiDetector(editor, { holder: 'editorjs', endpoint: '/api/ai-check' }) // your server route, see below
```

Create the detector after `editor.isReady` has resolved. Without a bundler, load `dist/aidetector.js` with a script tag: it sets `window.AiDetector`, used the same way.

## Connect the detector

Checks spend credits on an AssetFeed account. Free accounts include 500 credits per month, and one check uses 5 credits ([plans](https://assetfeed.com/pricing?utm_source=editorjs-ai-detector&utm_medium=readme)). Create an API key at [assetfeed.com/api-keys](https://assetfeed.com/api-keys?utm_source=editorjs-ai-detector&utm_medium=readme) and keep it on your server: a key written into the page can be read by anyone who opens it.

Your server route forwards the request body to the AssetFeed API and adds the key:

```js
// Node 18+ (Express)
app.post('/api/ai-check', express.json(), async (req, res) => {
  const upstream = await fetch('https://api.assetfeed.com/api/v1/ai-detector/checks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Api-Token': process.env.ASSETFEED_API_KEY },
    body: JSON.stringify({ text: String(req.body.text ?? '') }),
  })
  res.status(upstream.status).type('json').send(await upstream.text())
})
```

Put your own sign-in check in front of that route, otherwise anyone who finds it can spend your credits.

## Options

`new AiDetector(editor, options)`:

| Option | Default | |
|---|---|---|
| `holder` | the editor's own `holder`, else `'editorjs'` | The element id or element the editor lives in. |
| `endpoint` | `https://api.assetfeed.com/api/v1/ai-detector/checks` | Where the text is posted as `{ "text": "..." }`. |
| `apiKey` | `''` | Sent as `X-Api-Token`. Only for internal tools: the key is visible in the page. |
| `request` | none | `async ({ text }) => answer`: your own transport. Return the `data` object of the API answer. |
| `bar` | `true` | Show the bar right after the holder. Set `false` to build your own controls. |
| `onResult` | none | `(result) => void`, called after each answer. |
| `onChange` | none | `(state) => void`, called when the state, view or message changes. |
| `onNotice` | none | `({ message, type, link }) => void`: show messages yourself instead of under the bar. |

## Methods

| Method | |
|---|---|
| `await detector.check()` | Check the text and wait for the answer. |
| `detector.clear()` | Remove the marks. |
| `detector.setView(view)` | `'highlight'`, `'bars'` or `'off'`. |
| `detector.destroy()` | Remove the marks, the bar and the listeners. Call it before `editor.destroy()`. |

`detector.state` holds `status` (`idle`, `busy`, `ok`, `stale`), `result`, `kind`, `percent`, `view`, `checkedAt` and `notice`, so you can build your own controls on top of it.

A mark belongs to the text it was made for, so the first edit clears it and the bar asks for a recheck.

## How the text is sent

The controller sends one line per block (paragraph, heading, list item, quote and its caption, table cell) and skips empty blocks. The detector scores windows of about 120 to 300 words and says which lines each window covers, which is how a mark finds its block.

Checks made with an API key are not saved to a check history (see the [privacy policy](https://assetfeed.com/privacy-policy)). The score is an estimate, not proof of how a text was written.

## Development

From the repository root:

```sh
npm install
npm run build   # dist/index.js and dist/aidetector.js
npm test
python3 -m http.server 8000   # then open http://localhost:8000/demo/
```

## Licence

MIT. Icons are from [Lucide](https://lucide.dev) (ISC).

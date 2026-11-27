# AI detector extension for Tiptap

An extension that checks a document for AI-written text. Run a check and the editor's text goes to the [AssetFeed AI content detector](https://assetfeed.com/ai-content-detector?utm_source=tiptap-ai-detector&utm_medium=readme). The answer comes back as marks beside the passages:

- an orange bar for likely AI, amber for unsure, green for likely human;
- a tint behind the passages the detector is most sure about;
- a card with the verdict, word count and score when you hover a passage.

Under the editor, a bar shows the share of AI text, with a Recheck button and a switch between highlights, side bars only and no marks.

The marks live in a separate layer next to the editable element, not in the document. `getHTML()`, `getJSON()` and the undo history never see them, so the saved content is exactly what was typed.

![AI detector marks beside the text in Tiptap](https://raw.githubusercontent.com/assetfeed/ai-detector-plugins/main/docs/screenshot-tiptap.png)

**[Try the demo](https://assetfeed.github.io/ai-detector-plugins/demo/)**. It replays a recorded answer for the sample text, so it works without an API key.

Tested on Tiptap 2.27.3 and 3.35.1. English text only for now.

## Install

```sh
npm install @assetfeed/tiptap-ai-detector
```

```js
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { AiDetector } from '@assetfeed/tiptap-ai-detector'

const editor = new Editor({
  element: document.querySelector('#editor'),
  extensions: [
    StarterKit,
    AiDetector.configure({ apiKey: 'YOUR_ASSETFEED_API_KEY' }), // staff-only editors; see below for a server route
  ],
})
```

## Connect the detector

Checks spend credits on an AssetFeed account. Free accounts include 500 credits per month, and one check uses 5 credits ([plans](https://assetfeed.com/pricing?utm_source=tiptap-ai-detector&utm_medium=readme)). Create an API key at [assetfeed.com/api-keys](https://assetfeed.com/api-keys?utm_source=tiptap-ai-detector&utm_medium=readme).

The API accepts calls from any website, so passing the key with `apiKey` works as is. Anyone who opens the editor page can read that key and spend its credits, so do this only in an admin area your own team uses. On a page other people can open, set `endpoint` to a route on your server that forwards the request body to the AssetFeed API and adds the key:

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

| Option | Default | |
|---|---|---|
| `endpoint` | `https://api.assetfeed.com/api/v1/ai-detector/checks` | Where the text is posted as `{ "text": "..." }`. |
| `apiKey` | `''` | Sent as `X-Api-Token`. Anyone who opens the page can read it, so use it only in editors your own team opens. |
| `request` | none | `async ({ text }) => answer`: your own transport. Return the `data` object of the API answer. |
| `bar` | `true` | Show the bar right after the editor element. Set `false` to build your own controls. |
| `onResult` | none | `(result) => void`, called after each answer. |
| `onChange` | none | `(storage) => void`, called when the state, view or message changes. |
| `onNotice` | none | `({ message, type, link }) => void`: show messages yourself instead of under the bar. |

## Commands

| Command | |
|---|---|
| `editor.commands.checkAiWriting()` | Check the text. |
| `editor.commands.clearAiMarks()` | Remove the marks. |
| `editor.commands.setAiMarksView(view)` | `'highlight'`, `'bars'` or `'off'`. |

`editor.storage.aiDetector` holds `status` (`idle`, `busy`, `ok`, `stale`), `result`, `kind`, `percent`, `view`, `checkedAt` and `notice`, so you can build your own controls on top of it. `await editor.storage.aiDetector.check()` runs a check and waits for the answer.

A mark belongs to the text it was made for, so the first edit clears it and the bar asks for a recheck.

## How the text is sent

The extension sends one line per block (paragraph, heading, list item, quote, table cell) and skips empty blocks. The detector scores windows of about 120 to 300 words and says which lines each window covers, which is how a mark finds its block.

Checks made with an API key are not saved to a check history (see the [privacy policy](https://assetfeed.com/privacy-policy)). The score is an estimate, not proof of how a text was written.

## Development

From the repository root:

```sh
npm install
npm run build   # dist/index.js
npm test
python3 -m http.server 8000   # then open http://localhost:8000/demo/
```

## Licence

MIT. Icons are from [Lucide](https://lucide.dev) (ISC).

# AI detector plugin for CKEditor 5

A plugin that checks the text in CKEditor 5 for AI writing. Run a check and the editor's text goes to the [AssetFeed AI content detector](https://assetfeed.com/ai-content-detector?utm_source=ckeditor5-ai-detector&utm_medium=readme). The answer comes back as marks beside the passages:

- an orange bar for likely AI, amber for unsure, green for likely human;
- a tint behind the passages the detector is most sure about;
- a card with the verdict, word count and score when you hover a passage.

Under the editor, a bar shows the share of AI text, with a Recheck button and a switch between highlights, side bars only and no marks.

The marks live in a separate layer next to the editable element, not in the model. `editor.getData()` and the undo history never see them, so the saved content is exactly what was typed.

![AI detector marks beside the text in CKEditor 5](https://raw.githubusercontent.com/assetfeed/ai-detector-plugins/main/docs/screenshot-ckeditor5.png)

**[Try the demo](https://assetfeed.github.io/ai-detector-plugins/demo/)**. It replays a recorded answer for the sample text, so it works without an API key.

Tested on CKEditor 5 42.0.2, 44.3.0, 46.1.1, 47.7.6, 48.5.3 and 49.1.0, with the classic editor. English text only for now.

## Install

```sh
npm install @assetfeed/ckeditor5-ai-detector
```

The plugin needs the `ckeditor5` package (version 42 or later). It adds a toolbar button, `checkAiWriting`:

```js
import { ClassicEditor, Essentials, Paragraph } from 'ckeditor5'
import { AiDetector } from '@assetfeed/ckeditor5-ai-detector'
import 'ckeditor5/ckeditor5.css'

ClassicEditor.create(document.querySelector('#editor'), {
  licenseKey: 'GPL', // or your own key, see the CKEditor licensing page
  plugins: [Essentials, Paragraph, AiDetector],
  toolbar: ['undo', 'redo', '|', 'checkAiWriting'],
  aiDetector: { endpoint: '/api/ai-check' }, // your server route, see below
})
```

The `GPL` key works with the npm package, not with CKEditor's CDN: see [CKEditor's licensing page](https://ckeditor.com/docs/ckeditor5/latest/getting-started/licensing/license-key-and-activation.html). On 47.7.6, an LTS release, CKEditor logs an error about the licence key; the plugin still ran.

## Connect the detector

Checks spend credits on an AssetFeed account. Free accounts include 500 credits per month, and one check uses 5 credits ([plans](https://assetfeed.com/pricing?utm_source=ckeditor5-ai-detector&utm_medium=readme)). Create an API key at [assetfeed.com/api-keys](https://assetfeed.com/api-keys?utm_source=ckeditor5-ai-detector&utm_medium=readme) and keep it on your server: a key written into the page can be read by anyone who opens it.

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

Set them under `aiDetector` in the editor config.

| Option | Default | |
|---|---|---|
| `endpoint` | `https://api.assetfeed.com/api/v1/ai-detector/checks` | Where the text is posted as `{ "text": "..." }`. |
| `apiKey` | `''` | Sent as `X-Api-Token`. Only for internal tools: the key is visible in the page. |
| `request` | none | `async ({ text }) => answer`: your own transport. Return the `data` object of the API answer. |
| `bar` | `true` | Show the bar right after the editor. Set `false` to build your own controls. |
| `onResult` | none | `(result) => void`, called after each answer. |
| `onChange` | none | `(state) => void`, called when the state, view or message changes. |
| `onNotice` | none | `({ message, type, link }) => void`: show messages yourself instead of under the bar. |

## Commands and toolbar items

| Command | |
|---|---|
| `editor.execute('checkAiWriting')` | Check the text. Returns a promise that settles when the check is over. |
| `editor.execute('clearAiMarks')` | Remove the marks. |
| `editor.execute('setAiMarksView', view)` | `'highlight'`, `'bars'` or `'off'`. |

Toolbar items: `checkAiWriting` and `clearAiMarks`.

`editor.plugins.get('AiDetector').detector.state` holds `status` (`idle`, `busy`, `ok`, `stale`), `result`, `kind`, `percent`, `view`, `checkedAt` and `notice`, so you can build your own controls on top of it. The commands do not change the model, so they also work in read-only mode.

A mark belongs to the text it was made for, so the first edit clears it and the bar asks for a recheck.

## How the text is sent

The plugin sends one line per block (paragraph, heading, list item, quote, table cell, image caption) and skips empty blocks. The detector scores windows of about 120 to 300 words and says which lines each window covers, which is how a mark finds its block.

The marks are drawn for the editable element of the editor (`editor.editing.view.getDomRoot()`), so the `main` root is what is checked. Editors with several roots are not covered.

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

# AI detector plugin for TinyMCE and HugeRTE

A plugin that checks a document for AI-written text. Press a button and the editor's text goes to the [AssetFeed AI content detector](https://assetfeed.com/ai-content-detector?utm_source=tinymce-ai-detector&utm_medium=readme). The answer comes back as marks beside the passages:

- an orange bar for likely AI, amber for unsure, green for likely human;
- a tint behind the passages the detector is most sure about;
- a card with the verdict, word count and score when you hover a passage.

Under the text, a bar shows the share of AI text, with a Recheck button and a switch between highlights, side bars only and no marks.

The marks live in a separate layer next to the document, not in it. `getContent()` and the undo history never see them, so the saved HTML is exactly what was typed.

![AI detector marks beside the text in TinyMCE](https://raw.githubusercontent.com/assetfeed/ai-detector-plugins/main/docs/screenshot.png)

**[Try the demo](https://assetfeed.github.io/ai-detector-plugins/demo/)**. It replays a recorded answer for the sample text, so it works without an API key.

Tested on TinyMCE 6.8.6, 7.9.3 and 8.10.2 and on HugeRTE 1.0.15, in the classic (iframe) editor. Inline editors get the summary notification only. English text only for now.

## Install

```sh
npm install @assetfeed/tinymce-ai-detector
```

```js
import tinymce from 'tinymce'            // or: import hugerte from 'hugerte'
import '@assetfeed/tinymce-ai-detector'  // registers the "aidetector" plugin on the editor global

tinymce.init({
  selector: '#editor',
  plugins: 'aidetector',
  toolbar: 'undo redo | bold italic | aidetector aidetectormarks',
  aidetector_endpoint: '/api/ai-check', // your server route, see below
})
```

Without a bundler, load the plugin file with `external_plugins`:

```js
tinymce.init({
  selector: '#editor',
  external_plugins: { aidetector: 'https://cdn.jsdelivr.net/npm/@assetfeed/tinymce-ai-detector@0.1/dist/aidetector.min.js' },
  toolbar: 'aidetector aidetectormarks',
  aidetector_endpoint: '/api/ai-check',
})
```

## Connect the detector

Checks spend credits on an AssetFeed account. Free accounts include 500 credits per month, and one check uses 5 credits ([plans](https://assetfeed.com/pricing?utm_source=tinymce-ai-detector&utm_medium=readme)). Create an API key at [assetfeed.com/api-keys](https://assetfeed.com/api-keys?utm_source=tinymce-ai-detector&utm_medium=readme) and keep it on your server: a key written into the page can be read by anyone who opens it.

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

```php
// PHP
$ch = curl_init('https://api.assetfeed.com/api/v1/ai-detector/checks');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json', 'X-Api-Token: '.getenv('ASSETFEED_API_KEY')],
    CURLOPT_POSTFIELDS => json_encode(['text' => (string) (json_decode(file_get_contents('php://input'), true)['text'] ?? '')]),
]);
$body = curl_exec($ch);
http_response_code(curl_getinfo($ch, CURLINFO_RESPONSE_CODE));
header('Content-Type: application/json');
echo $body;
```

Put your own sign-in check in front of that route, otherwise anyone who finds it can spend your credits.

## Options

| Option | Default | |
|---|---|---|
| `aidetector_endpoint` | `https://api.assetfeed.com/api/v1/ai-detector/checks` | Where the text is posted as `{ "text": "..." }`. |
| `aidetector_api_key` | `''` | Sent as `X-Api-Token`. Only for internal tools: the key is visible in the page. |
| `aidetector_request` | none | `async ({ text }) => answer`: your own transport. Return the `data` object of the API answer. |

## Toolbar, menu and commands

| Name | |
|---|---|
| `aidetector` | Toolbar button and menu item: check the text. |
| `aidetectormarks` | Toolbar toggle: show or hide the marks. |
| `AiDetectorCheck`, `AiDetectorClear`, `AiDetectorToggleMarks`, `AiDetectorSetView` | Commands for `editor.execCommand()`. `AiDetectorSetView` takes `'highlight'`, `'bars'` or `'off'`. |
| `AiDetectorResult` | Editor event with `{ result }` after each answer, for your own display. |

A mark belongs to the text it was made for, so the first edit clears it and the bar asks for a recheck. All interface strings go through `editor.translate()`, so the editor's language packs can translate them.

## How the text is sent

The plugin sends one line per block (paragraph, heading, list item, quote, table cell) and skips empty blocks. The detector scores windows of about 120 to 300 words and says which lines each window covers, which is how a mark finds its block.

Checks made with an API key are not saved to a check history (see the [privacy policy](https://assetfeed.com/privacy-policy)). The score is an estimate, not proof of how a text was written.

## Development

```sh
npm install
npm run build   # dist/aidetector.js and dist/aidetector.min.js
npm test
python3 -m http.server 8000   # then open http://localhost:8000/demo/
```

## Licence

MIT. Icons are from [Lucide](https://lucide.dev) (ISC). The demo text opens with *Three Men in a Boat* by Jerome K. Jerome (1889), which is in the public domain.

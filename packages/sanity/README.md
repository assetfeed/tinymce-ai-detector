# AI detector plugin for Sanity Studio

A Studio plugin that checks the text of Portable Text fields for AI writing. Run a check and the field's text goes to the [AssetFeed AI content detector](https://assetfeed.com/ai-content-detector?utm_source=sanity-ai-detector&utm_medium=readme). The answer comes back as marks beside the passages:

- an orange bar for likely AI, amber for unsure, green for likely human;
- a tint behind the passages the detector is most sure about;
- a card with the verdict, word count and score when you hover a passage.

Under the editor, a bar shows the share of AI text, with a Recheck button and a switch between highlights, side bars only and no marks.

The marks live in a separate layer next to the editable element. The document and its patches never see them, so what gets saved is exactly what was typed.

![AI detector marks beside the text of a Portable Text editor](https://raw.githubusercontent.com/assetfeed/ai-detector-plugins/main/docs/screenshot-sanity.png)

**[Try the demo](https://assetfeed.github.io/ai-detector-plugins/demo/)**. It replays a recorded answer for the sample text, so it works without an API key. The demo is a page with the Portable Text editor and this plugin's input, not a Studio.

English text only for now.

## Tested

The plugin has not been run inside a Sanity Studio: a Studio needs a Sanity project to sign in to, which was not available for these checks. It was run on the editor a Studio field uses, [`@portabletext/editor`](https://www.npmjs.com/package/@portabletext/editor), in a page that gives the input the props a Studio field gives it (`value` and `renderDefault`), on versions 8.2.17, 6.6.5 and 3.3.14.

The package declares `sanity` 4, 5 or 6 as a peer dependency. What a Studio adds around the editor (its own wrappers and styles) is not covered. If the marks do not appear in your Studio, please open an issue with the Studio version.

## Install

```sh
npm install @assetfeed/sanity-ai-detector
```

```js
// sanity.config.js
import { defineConfig } from 'sanity'
import { aiDetector } from '@assetfeed/sanity-ai-detector'

export default defineConfig({
  // ...
  plugins: [aiDetector({ apiKey: 'YOUR_ASSETFEED_API_KEY' })], // staff-only Studios; see below for a server route
})
```

Every Portable Text field gets the bar. To leave some out, pass `enabled`:

```js
aiDetector({
  apiKey: 'YOUR_ASSETFEED_API_KEY',
  enabled: (props) => props.schemaType.name === 'body',
})
```

The plugin works through `form.components.input`. If you set your own `input` component on a field, call `props.renderDefault` in it as the Studio docs describe, so the plugin's input stays around the editor.

## Connect the detector

Checks spend credits on an AssetFeed account. Free accounts include 500 credits per month, and one check uses 5 credits ([plans](https://assetfeed.com/pricing?utm_source=sanity-ai-detector&utm_medium=readme)). Create an API key at [assetfeed.com/api-keys](https://assetfeed.com/api-keys?utm_source=sanity-ai-detector&utm_medium=readme).

The API accepts calls from any website, so passing the key with `apiKey` works as is. Anyone who opens the Studio can read that key and spend its credits, so do this only in a Studio your own team uses. In a Studio other people can open, set `endpoint` to a route on your server that forwards the request body to the AssetFeed API and adds the key:

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

Put your own sign-in check in front of that route, otherwise anyone who finds it can spend your credits. A Studio runs in the browser, so if the route is on another origin it has to allow requests from the Studio's origin (CORS).

## Options

| Option | Default | |
|---|---|---|
| `endpoint` | `https://api.assetfeed.com/api/v1/ai-detector/checks` | Where the text is posted as `{ "text": "..." }`. |
| `apiKey` | `''` | Sent as `X-Api-Token`. Anyone who opens the Studio can read it, so use it only in Studios your own team opens. |
| `request` | none | `async ({ text }) => answer`: your own transport. Return the `data` object of the API answer. |
| `bar` | `true` | Show the bar under the editor. |
| `enabled` | all Portable Text fields | `(inputProps) => boolean`: which fields get the check. |
| `onResult` | none | `(result) => void`, called after each answer. |
| `onChange` | none | `(state) => void`, called when the state, view or message changes. `state` has `status` (`idle`, `busy`, `ok`, `stale`), `result`, `kind`, `percent`, `view`, `checkedAt` and `notice`. |
| `onNotice` | none | `({ message, type, link }) => void`: show messages yourself instead of under the bar. |

A mark belongs to the text it was made for, so the first edit clears it and the bar asks for a recheck.

## How the text is sent

The plugin reads the field's value and sends one line per text block (a list item is a block of its own). It skips empty blocks and block objects such as images, and turns an inline object between two spans into a space. The detector scores windows of about 120 to 300 words and says which lines each window covers, which is how a mark finds its block.

The marks are placed on the blocks of the editor by the block key that `@portabletext/editor` puts on each block element (`data-block-key`, or `data-pt-path` in newer versions), and by order when neither is there. The editor has to be active for a check: before that there is no editable element to draw on.

Checks made with an API key are not saved to a check history (see the [privacy policy](https://assetfeed.com/privacy-policy)). The score is an estimate, not proof of how a text was written.

## Use the input on its own

`@assetfeed/sanity-ai-detector/input` exports `AiDetectorInput`, the React component the plugin renders around a field. It imports only React, so it works on a page with `@portabletext/editor` and no Studio, as in the demo:

```js
import { AiDetectorInput } from '@assetfeed/sanity-ai-detector/input'

h(AiDetectorInput, { input: { value, renderDefault }, options: { apiKey: 'YOUR_ASSETFEED_API_KEY' } })
```

## Development

From the repository root:

```sh
npm install
npm run build   # dist/index.js and dist/input.js
npm test
python3 -m http.server 8000   # then open http://localhost:8000/demo/
```

## Licence

MIT. Icons are from [Lucide](https://lucide.dev) (ISC).

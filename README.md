# AI detector plugins for rich text editors

Plugins that check the text in an editor for AI writing. A check sends the text to the [AssetFeed AI content detector](https://assetfeed.com/ai-content-detector?utm_source=ai-detector-plugins&utm_medium=readme), and the answer comes back as marks beside the passages:

- an orange bar for likely AI, amber for unsure, green for likely human;
- a tint behind the passages the detector is most sure about;
- a card with the verdict, word count and score when you hover a passage.

Under the text, a bar shows the share of AI text, with a Recheck button and a switch between highlights, side bars only and no marks.

The marks are drawn in a separate layer beside the text. They never reach the saved content or the undo history, so what gets saved is exactly what was typed.

![AI detector marks beside the text in TinyMCE](docs/screenshot.png)

**[Try the demo](https://assetfeed.github.io/ai-detector-plugins/demo/)** with TinyMCE, HugeRTE, Tiptap and Editor.js. It replays a recorded answer for the sample text, so it works without an API key.

## Packages

| Editor | Package | Tested on |
|---|---|---|
| TinyMCE, HugeRTE | [`@assetfeed/tinymce-ai-detector`](packages/tinymce/README.md) ([npm](https://www.npmjs.com/package/@assetfeed/tinymce-ai-detector)) | TinyMCE 6.8.6, 7.9.3 and 8.10.2; HugeRTE 1.0.15 |
| Tiptap | [`@assetfeed/tiptap-ai-detector`](packages/tiptap/README.md) ([npm](https://www.npmjs.com/package/@assetfeed/tiptap-ai-detector)) | Tiptap 2.27.3 and 3.35.1 |
| Editor.js | [`@assetfeed/editorjs-ai-detector`](packages/editorjs/README.md) ([npm](https://www.npmjs.com/package/@assetfeed/editorjs-ai-detector)) | Editor.js 2.31.7 |

For WordPress there is [`packages/wordpress`](packages/wordpress/README.md): a plugin for the block editor (sidebar) and the Classic Editor (meta box). It is not published to npm; the key stays on the WordPress server.

For Laravel Nova there is a detail-page field in a separate repository: [assetfeed/nova-ai-detector](https://github.com/assetfeed/nova-ai-detector).

## Connect the detector

Checks spend credits on an AssetFeed account. Free accounts include 500 credits per month, and one check uses 5 credits ([plans](https://assetfeed.com/pricing?utm_source=ai-detector-plugins&utm_medium=readme)). Create an API key at [assetfeed.com/api-keys](https://assetfeed.com/api-keys?utm_source=ai-detector-plugins&utm_medium=readme) and keep it on your server: a key written into the page can be read by anyone who opens it.

Each package posts the text to a route on your server, which adds the key and forwards the request to the AssetFeed API. The package READMEs show that route in Node, and the TinyMCE one also in PHP. The Nova field runs the check on the server itself, with the key from `ASSETFEED_API_KEY`.

To check a text of your own without a key, use the [detector page](https://assetfeed.com/ai-content-detector?utm_source=ai-detector-plugins&utm_medium=readme), free while in beta.

## Privacy

Text is sent only when someone runs a check. Checks made with an API key are not saved to a check history (see the [privacy policy](https://assetfeed.com/privacy-policy)). The score is an estimate, not proof of how a text was written. English text only for now.

## Development

From the repository root:

```sh
npm install
npm run build   # builds every package
npm test
python3 -m http.server 8000   # then open http://localhost:8000/demo/
```

## Licence

MIT. Icons are from [Lucide](https://lucide.dev) (ISC). The demo text opens with *Three Men in a Boat* by Jerome K. Jerome (1889), which is in the public domain.

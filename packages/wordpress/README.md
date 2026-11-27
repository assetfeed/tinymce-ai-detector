# AI Detector by AssetFeed (WordPress)

A WordPress plugin that checks a post for AI-written passages and marks them beside the text. It works in the block editor (a sidebar and an entry in the options menu) and in the Classic Editor (a box under the Publish box, marks in the Visual tab). The post is never changed: the marks are drawn in a layer beside the editor's content, so saved HTML, revisions and the undo history stay as they were.

`readme.txt` is the wordpress.org readme (description, the external-service disclosure, FAQ). This file is for developers.

## How it works

- The editor collects one line per block (the same `collectBlocks` as the other plugins in this repo, from `packages/core`) and posts it to the plugin's own REST route, `POST /wp-json/assetfeed-ai-detector/v1/check`. The route checks the REST nonce and `current_user_can( 'edit_post', $post_id )`, adds the API key and calls the AssetFeed API with `wp_remote_post`. The key never reaches the browser, the text is never stored.
- `includes/class-detector.php` is the API call (https only, `http` only for localhost; 60 s timeout, 200,000-character cap, 1 MB response cap, the 401/402/429/503 messages of the Nova field). `class-settings.php` is Settings → AI detector, `class-editor.php` loads the scripts only on the post edit screens.
- `src/controller.js` is the check itself (collect, ask, keep the answer, drop it when the text changes), shared by `src/block-editor.js` (sidebar, canvas iframe) and `src/classic.js` (meta box, TinyMCE 4 iframe). The marks layer is `MarkPainter` from `packages/core`.
- Later: "Connect AssetFeed account" (OAuth) instead of pasting a key. The settings page is built from sections (`Settings::key_section()` and its field callbacks), so a connection section can be added next to the key section.

## Build and test

```sh
npm install                          # in the repo root
npm run build -w packages/wordpress  # build/block-editor.js and build/classic.js (WordPress packages come from the page's `wp` globals)
npm run zip -w packages/wordpress    # dist/ai-detector-by-assetfeed.zip, ready to install
```

`test/README.md` describes the end-to-end run in a real WordPress (WordPress Playground, a fake detector, headless Chrome) and the Plugin Check run.

## Licence

MIT. WordPress.org accepts any licence that is compatible with GPLv2 or later, and MIT is; it is also the licence of the rest of this repository, so the plugin and `packages/core` stay under one licence.

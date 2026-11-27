# Testing the WordPress plugin

## End to end (real WordPress, no Docker)

Three processes, all local:

```sh
# 1. a stand-in for the detector API (key "af_test" gets demo/sample-result.json; "bad" 401, "nocredit" 402, "busy" 503)
php -S 127.0.0.1:8841 packages/wordpress/test/fake-detector.php

# 2. WordPress (current version) with the plugin mounted, a draft post with the sample text, key and endpoint set
P=$PWD/packages/wordpress
npx @wp-playground/cli@latest server --port=9411 --login --blueprint=$P/test/blueprint.json \
  --mount=$P:/wordpress/wp-content/plugins/ai-detector-by-assetfeed --mount=$PWD/demo:/wordpress/wp-content/aid-demo

# 3. headless Chrome (macOS path in cdp.mjs, or set CHROME) walks through the block editor, settings and Classic Editor
npm run build -w packages/wordpress
node packages/wordpress/test/e2e.mjs /tmp/shots     # writes screenshot-1..3.png there
```

The run checks, among other things, that the text sent is one line per block, that the marks sit in the canvas outside the blocks, and that the serialized post content, the dirty flag and the undo stack are the same after a check.

## Plugin Check

`wp plugin check` crashes PHP.wasm, so run it on a normal PHP: WordPress with the SQLite integration plugin, `wp-cli.phar` and the Plugin Check plugin, then

```sh
npm run zip -w packages/wordpress && unzip -q packages/wordpress/dist/ai-detector-by-assetfeed.zip -d /tmp/aid
wp plugin check /tmp/aid/ai-detector-by-assetfeed --slug=ai-detector-by-assetfeed --include-experimental
```


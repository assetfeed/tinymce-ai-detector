=== AI Detector by AssetFeed ===
Contributors: assetfeed
Tags: ai detector, ai content detector, ai writing, content check, editor
Requires at least: 6.6
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.1.0
License: MIT
License URI: https://opensource.org/license/mit

Check a post for AI-written passages. The result sits in the editor sidebar and the marks are drawn beside the text; the post itself is never changed.

== Description ==

AI Detector by AssetFeed checks the text of the post you are editing and shows how much of it reads as AI-written. Marks beside the text show which passages: orange for likely AI, amber for unsure, green for likely human. Hover a marked passage for its verdict and word count.

* **Block editor:** an "AI detector" sidebar with the share of AI text, a "Check for AI writing" entry in the options menu, and the marks in the editor canvas.
* **Classic Editor:** an "AI detector" box with the same result, and the marks in the Visual tab. The Text tab is checked too, without marks.
* **Nothing is added to your post.** The marks live in a layer beside the editor's content. Saved HTML, revisions and the undo history stay as they were.
* **The key stays on your server.** The editor talks to your own site; your site talks to the AssetFeed API.
* **No tracking, no ads, no "powered by" links.**

English text only for now. A check needs at least a few sentences of text.

= What you need =

An AssetFeed API key. Save it in Settings → AI detector. Checks use your AssetFeed credits.

== External services ==

This plugin sends text to the AssetFeed AI detector API, a service operated by AssetFeed (https://assetfeed.com).

* **What is sent:** the text of the post you are editing, one line per paragraph or block, together with your API key in a request header. Nothing else about the post, the site or the user is sent.
* **When:** only when a user with permission to edit the post clicks "Check for AI writing" (or "Recheck"). Nothing is sent when you install or activate the plugin, when you save the key, or while you write.
* **Where:** `https://api.assetfeed.com/api/v1/ai-detector/checks` (the address can be changed in Settings → AI detector, for example to a proxy of your own).
* **What the plugin stores:** the API key and the endpoint, as options. The plugin does not store the text or the results.
* AssetFeed's terms and privacy policy: [Terms of Service](https://assetfeed.com/terms-of-service), [Privacy Policy](https://assetfeed.com/privacy-policy).

== Installation ==

1. Upload the plugin to `/wp-content/plugins/ai-detector-by-assetfeed/`, or install it from the Plugins screen.
2. Activate it.
3. Go to Settings → AI detector and save your AssetFeed API key.
4. Open a post, open the "AI detector" sidebar (or the box under the Publish box in the Classic Editor) and click "Check for AI writing".

== Frequently Asked Questions ==

= Does the plugin change my post? =

No. The marks are drawn in a separate layer. The post content, revisions, the undo history and the "unsaved changes" state are not touched.

= Is my API key visible in the browser? =

No. The editor sends the text to a route of your own site, which adds the key and calls the AssetFeed API. The settings page never prints the saved key back.

= Does it work with the Classic Editor? =

Yes. The box is added to the post screen when the Classic Editor is used, and the marks are drawn in the Visual tab.

= Where is the source code? =

The plugin's JavaScript is built from readable source in https://github.com/assetfeed/ai-detector-plugins (folders `packages/wordpress` and `packages/core`). Build it with `npm install && npm run build -w packages/wordpress`.

= Which languages can be checked? =

English for now.

== Screenshots ==

1. The block editor: the AI detector sidebar and the marks beside the text.
2. Settings → AI detector.
3. The Classic Editor, Visual tab, with the marks.

== Changelog ==

= 0.1.0 =
* First release: block editor sidebar, Classic Editor box, marks beside the text, settings page.

== Upgrade Notice ==

= 0.1.0 =
First release.

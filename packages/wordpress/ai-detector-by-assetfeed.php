<?php
/**
 * Plugin Name:       AI Detector by AssetFeed
 * Plugin URI:        https://assetfeed.com/ai-content-detector
 * Description:       Checks a post for AI-written passages and marks them beside the text in the editor. The post is never changed.
 * Version:           0.1.0
 * Requires at least: 6.6
 * Requires PHP:      7.4
 * Author:            AssetFeed
 * Author URI:        https://assetfeed.com
 * License:           MIT
 * License URI:       https://opensource.org/license/mit
 * Text Domain:       ai-detector-by-assetfeed
 *
 * @package AssetFeed\AiDetector
 */

namespace AssetFeed\AiDetector;

defined( 'ABSPATH' ) || exit;

const VERSION = '0.1.0';

require_once __DIR__ . '/includes/class-detector.php';
require_once __DIR__ . '/includes/class-rest.php';
require_once __DIR__ . '/includes/class-settings.php';
require_once __DIR__ . '/includes/class-editor.php';

add_action(
	'plugins_loaded',
	static function () {
		( new Settings() )->register();
		( new Rest() )->register();
		( new Editor( __FILE__ ) )->register();
	}
);

<?php
/**
 * Removes the plugin's options. Posts are never touched: the plugin stores nothing about them.
 *
 * @package AssetFeed\AiDetector
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_option( 'assetfeed_aid_api_key' );
delete_option( 'assetfeed_aid_endpoint' );

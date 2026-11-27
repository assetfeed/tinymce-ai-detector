<?php
/**
 * Loads the editor scripts: the sidebar in the block editor, the meta box in the Classic Editor.
 *
 * @package AssetFeed\AiDetector
 */

namespace AssetFeed\AiDetector;

defined( 'ABSPATH' ) || exit;

/**
 * Scripts load only on the post edit screens, and only for a user who can edit the post.
 */
final class Editor {

	private const TEXT_DOMAIN = 'ai-detector-by-assetfeed';

	/**
	 * Main plugin file.
	 *
	 * @var string
	 */
	private string $file;

	/**
	 * Remembers the main plugin file, which the script URLs are built from.
	 *
	 * @param string $file Main plugin file.
	 */
	public function __construct( string $file ) {
		$this->file = $file;
	}

	/**
	 * Hooks the two editors.
	 */
	public function register(): void {
		add_action( 'enqueue_block_editor_assets', array( $this, 'block_editor' ) );
		add_action( 'add_meta_boxes', array( $this, 'meta_box' ), 10, 2 );
		add_action( 'admin_enqueue_scripts', array( $this, 'classic_editor' ) );
	}

	/**
	 * The sidebar: only in the post editor (not the site editor, widgets or the customizer).
	 */
	public function block_editor(): void {
		$screen = get_current_screen();

		if ( ! $screen || 'post' !== $screen->base ) {
			return;
		}

		$this->enqueue(
			'assetfeed-aid-block-editor',
			'build/block-editor.js',
			array( 'wp-plugins', 'wp-editor', 'wp-element', 'wp-components', 'wp-data', 'wp-i18n', 'wp-api-fetch' )
		);
	}

	/**
	 * The box under the Publish box, in the Classic Editor only (the block editor has the sidebar).
	 *
	 * @param string   $post_type The post type.
	 * @param \WP_Post $post      The post being edited.
	 */
	public function meta_box( string $post_type, $post ): void {
		$screen = get_current_screen();

		if ( ( $screen && $screen->is_block_editor() ) || ! post_type_supports( $post_type, 'editor' ) || ! current_user_can( 'edit_post', $post->ID ) ) {
			return;
		}

		add_meta_box(
			'assetfeed-aid',
			__( 'AI detector', 'ai-detector-by-assetfeed' ),
			static function () {
				echo '<div id="assetfeed-aid-box" class="aid-wp"></div>';
			},
			$post_type,
			'side',
			'high'
		);
	}

	/**
	 * The script of the meta box.
	 *
	 * @param string $hook_suffix The admin page.
	 */
	public function classic_editor( string $hook_suffix ): void {
		$screen = get_current_screen();

		if ( ! in_array( $hook_suffix, array( 'post.php', 'post-new.php' ), true ) || ! $screen || $screen->is_block_editor() ) {
			return;
		}

		$this->enqueue( 'assetfeed-aid-classic', 'build/classic.js', array( 'editor', 'wp-i18n', 'wp-api-fetch' ), true );
	}

	/**
	 * Enqueues a built script with the data it needs and its translations.
	 *
	 * @param string   $handle Script handle.
	 * @param string   $path   Built file, relative to the plugin.
	 * @param string[] $deps   Script dependencies.
	 * @param bool     $classic Whether the Classic Editor page loads it.
	 */
	private function enqueue( string $handle, string $path, array $deps, bool $classic = false ): void {
		wp_enqueue_script( $handle, plugins_url( $path, $this->file ), $deps, VERSION, true );
		wp_set_script_translations( $handle, self::TEXT_DOMAIN );
		wp_enqueue_style( 'assetfeed-aid-admin', plugins_url( 'assets/admin.css', $this->file ), array(), VERSION );

		$data = array(
			'route'       => '/' . Rest::NAMESPACE . '/check',
			'settingsUrl' => current_user_can( 'manage_options' ) ? Settings::url() : '',
			'hasKey'      => '' !== (string) get_option( 'assetfeed_aid_api_key', '' ),
			'classic'     => $classic,
		);

		wp_add_inline_script( $handle, 'window.assetfeedAid = ' . wp_json_encode( $data ) . ';', 'before' );
	}
}

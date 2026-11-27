<?php
/**
 * Settings → AI detector: the API key and the endpoint.
 *
 * @package AssetFeed\AiDetector
 */

namespace AssetFeed\AiDetector;

defined( 'ABSPATH' ) || exit;

/**
 * The key is stored as an option and never printed back: the field stays empty and shows the last four characters.
 *
 * The page is built from sections so a "Connect AssetFeed account" section (OAuth) can sit next to the key section later.
 */
final class Settings {

	public const PAGE = 'assetfeed-ai-detector';

	/**
	 * Hooks the page, the options and the "remove key" action.
	 */
	public function register(): void {
		add_action( 'admin_menu', array( $this, 'menu' ) );
		add_action( 'admin_init', array( $this, 'settings' ) );
		add_action( 'admin_post_assetfeed_aid_remove_key', array( $this, 'remove_key' ) );
	}

	/**
	 * The address of the page, for links from the editors.
	 */
	public static function url(): string {
		return admin_url( 'options-general.php?page=' . self::PAGE );
	}

	/**
	 * Settings → AI detector.
	 */
	public function menu(): void {
		add_options_page(
			__( 'AI detector', 'ai-detector-by-assetfeed' ),
			__( 'AI detector', 'ai-detector-by-assetfeed' ),
			'manage_options',
			self::PAGE,
			array( $this, 'render' )
		);
	}

	/**
	 * Registers the two options and the section with their fields.
	 */
	public function settings(): void {
		register_setting(
			self::PAGE,
			'assetfeed_aid_api_key',
			array(
				'type'              => 'string',
				'sanitize_callback' => array( $this, 'sanitize_key_value' ),
				'default'           => '',
			)
		);
		register_setting(
			self::PAGE,
			'assetfeed_aid_endpoint',
			array(
				'type'              => 'string',
				'sanitize_callback' => array( $this, 'sanitize_endpoint' ),
				'default'           => '',
			)
		);

		add_settings_section( 'assetfeed_aid_key', __( 'API key', 'ai-detector-by-assetfeed' ), array( $this, 'key_section' ), self::PAGE );
		add_settings_field( 'assetfeed_aid_api_key', __( 'AssetFeed API key', 'ai-detector-by-assetfeed' ), array( $this, 'key_field' ), self::PAGE, 'assetfeed_aid_key', array( 'label_for' => 'assetfeed_aid_api_key' ) );
		add_settings_field( 'assetfeed_aid_endpoint', __( 'Endpoint', 'ai-detector-by-assetfeed' ), array( $this, 'endpoint_field' ), self::PAGE, 'assetfeed_aid_key', array( 'label_for' => 'assetfeed_aid_endpoint' ) );
	}

	/**
	 * An empty field keeps the saved key: the key is never shown, so the field cannot be re-submitted with it.
	 *
	 * @param mixed $value The submitted value.
	 */
	public function sanitize_key_value( $value ): string {
		$value = trim( sanitize_text_field( (string) $value ) );

		return '' === $value ? (string) get_option( 'assetfeed_aid_api_key', '' ) : $value;
	}

	/**
	 * The endpoint must be https (http only for this machine); anything else is dropped and the default is used.
	 *
	 * @param mixed $value The submitted value.
	 */
	public function sanitize_endpoint( $value ): string {
		$value = trim( (string) $value );

		if ( '' === $value || Detector::DEFAULT_ENDPOINT === $value ) {
			return '';
		}

		$url = esc_url_raw( $value, array( 'https', 'http' ) );

		if ( '' === $url || ! Detector::is_safe_endpoint( $url ) ) {
			add_settings_error( 'assetfeed_aid_endpoint', 'assetfeed_aid_endpoint', __( 'The endpoint must be an https address. The default one is used instead.', 'ai-detector-by-assetfeed' ) );

			return '';
		}

		return $url;
	}

	/**
	 * Deletes the saved key (admin-post).
	 */
	public function remove_key(): void {
		check_admin_referer( 'assetfeed_aid_remove_key' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You are not allowed to do this.', 'ai-detector-by-assetfeed' ), '', array( 'response' => 403 ) );
		}

		delete_option( 'assetfeed_aid_api_key' );
		wp_safe_redirect( add_query_arg( 'assetfeed_aid_removed', '1', self::url() ) );
		exit;
	}

	/**
	 * What the plugin sends and where, before any key is entered.
	 */
	public function key_section(): void {
		echo '<p>' . esc_html__( 'Nothing is sent anywhere until you save a key and run a check on a post.', 'ai-detector-by-assetfeed' ) . '</p>';
		echo '<p>' . wp_kses(
			sprintf(
				/* translators: 1: terms of service URL, 2: privacy policy URL. */
				__( 'A check sends the text of the post you are editing, one line per paragraph, to the AssetFeed AI detector (api.assetfeed.com) and shows the answer in the editor. The text is not stored by this plugin. Your key stays on this server: the editor never sees it. See the <a href="%1$s" target="_blank" rel="noopener">Terms of Service</a> and the <a href="%2$s" target="_blank" rel="noopener">Privacy Policy</a>.', 'ai-detector-by-assetfeed' ),
				'https://assetfeed.com/terms-of-service',
				'https://assetfeed.com/privacy-policy'
			),
			array(
				'a' => array(
					'href'   => array(),
					'target' => array(),
					'rel'    => array(),
				),
			)
		) . '</p>';
		echo '<p>' . wp_kses(
			sprintf(
				/* translators: %s: URL of the AssetFeed API keys page. */
				__( 'Get a key on the <a href="%s" target="_blank" rel="noopener">AssetFeed API keys page</a>.', 'ai-detector-by-assetfeed' ),
				'https://assetfeed.com/api-keys?utm_source=wordpress-ai-detector&utm_medium=plugin'
			),
			array(
				'a' => array(
					'href'   => array(),
					'target' => array(),
					'rel'    => array(),
				),
			)
		) . '</p>';
	}

	/**
	 * The key field: empty, with the last four characters of the saved key as a hint.
	 */
	public function key_field(): void {
		$key  = (string) get_option( 'assetfeed_aid_api_key', '' );
		$hint = '' === $key ? '' : '••••' . substr( $key, -4 );

		printf(
			'<input type="password" id="assetfeed_aid_api_key" name="assetfeed_aid_api_key" value="" class="regular-text" autocomplete="off" spellcheck="false" placeholder="%s" />',
			esc_attr( $hint )
		);

		if ( '' !== $key ) {
			echo '<p class="description">' . esc_html__( 'A key is saved. Leave the field empty to keep it, or enter a new key to replace it.', 'ai-detector-by-assetfeed' ) . '</p>';
		}
	}

	/**
	 * The endpoint field.
	 */
	public function endpoint_field(): void {
		printf(
			'<input type="url" id="assetfeed_aid_endpoint" name="assetfeed_aid_endpoint" value="%s" class="regular-text code" placeholder="%s" />',
			esc_attr( (string) get_option( 'assetfeed_aid_endpoint', '' ) ),
			esc_attr( Detector::DEFAULT_ENDPOINT )
		);
		echo '<p class="description">' . esc_html__( 'Leave empty to use the AssetFeed API.', 'ai-detector-by-assetfeed' ) . '</p>';
	}

	/**
	 * The page.
	 */
	public function render(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- only decides whether to show a notice.
		$removed = isset( $_GET['assetfeed_aid_removed'] );

		echo '<div class="wrap"><h1>' . esc_html( get_admin_page_title() ) . '</h1>';

		if ( $removed ) {
			echo '<div class="notice notice-success is-dismissible"><p>' . esc_html__( 'The key was removed.', 'ai-detector-by-assetfeed' ) . '</p></div>';
		}

		echo '<form method="post" action="options.php">';
		settings_fields( self::PAGE );
		do_settings_sections( self::PAGE );
		submit_button();
		echo '</form>';

		if ( '' !== (string) get_option( 'assetfeed_aid_api_key', '' ) ) {
			echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
			echo '<input type="hidden" name="action" value="assetfeed_aid_remove_key" />';
			wp_nonce_field( 'assetfeed_aid_remove_key' );
			submit_button( __( 'Remove the saved key', 'ai-detector-by-assetfeed' ), 'secondary' );
			echo '</form>';
		}

		echo '</div>';
	}
}

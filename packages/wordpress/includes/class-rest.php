<?php
/**
 * The REST route the editors call, so the API key never reaches the browser.
 *
 * @package AssetFeed\AiDetector
 */

namespace AssetFeed\AiDetector;

defined( 'ABSPATH' ) || exit;

/**
 * POST /wp-json/assetfeed-ai-detector/v1/check { post_id, lines[] }
 */
final class Rest {

	public const NAMESPACE = 'assetfeed-ai-detector/v1';

	/**
	 * Hooks the route.
	 */
	public function register(): void {
		add_action( 'rest_api_init', array( $this, 'routes' ) );
	}

	/**
	 * The check route: cookie + REST nonce (core), and the user must be able to edit that post.
	 */
	public function routes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/check',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'check' ),
				'permission_callback' => static fn( \WP_REST_Request $request ) => current_user_can( 'edit_post', (int) $request['post_id'] ),
				'args'                => array(
					'post_id' => array(
						'type'     => 'integer',
						'required' => true,
					),
					'lines'   => array(
						'type'     => 'array',
						'required' => true,
						'items'    => array( 'type' => 'string' ),
					),
				),
			)
		);
	}

	/**
	 * Runs one check. The lines are plain text for the API and are never output or stored, so they are passed on as they came.
	 *
	 * @param \WP_REST_Request $request The request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function check( \WP_REST_Request $request ) {
		$result = ( new Detector() )->check( (array) $request['lines'] );

		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}
}

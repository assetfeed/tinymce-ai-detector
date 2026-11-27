<?php
/**
 * Calls the AssetFeed AI detector API with the key from the settings.
 *
 * @package AssetFeed\AiDetector
 */

namespace AssetFeed\AiDetector;

defined( 'ABSPATH' ) || exit;

/**
 * One request per check. The text is sent and forgotten: nothing is stored here.
 */
final class Detector {

	public const DEFAULT_ENDPOINT = 'https://api.assetfeed.com/api/v1/ai-detector/checks';

	/** The longest text one check may carry, in characters (the same cap as the other AssetFeed editor plugins). */
	public const MAX_CHARS = 200000;

	/**
	 * The saved endpoint, or the default one if the saved value is not a safe URL.
	 */
	public static function endpoint(): string {
		$saved = (string) get_option( 'assetfeed_aid_endpoint', '' );

		return self::is_safe_endpoint( $saved ) ? $saved : self::DEFAULT_ENDPOINT;
	}

	/**
	 * The key travels in a header, so the endpoint must be https; plain http is only for a detector on this machine.
	 *
	 * @param string $url Endpoint to check.
	 */
	public static function is_safe_endpoint( string $url ): bool {
		$parts  = wp_parse_url( $url );
		$scheme = strtolower( $parts['scheme'] ?? '' );
		$host   = strtolower( trim( $parts['host'] ?? '', '[]' ) );

		if ( '' === $host ) {
			return false;
		}

		return 'https' === $scheme || ( 'http' === $scheme && in_array( $host, array( 'localhost', '127.0.0.1', '::1' ), true ) );
	}

	/**
	 * Messages for the failures the API reports; the others show the API's own reason.
	 *
	 * @return array<int, string>
	 */
	public static function errors(): array {
		return array(
			401 => __( 'The AI check needs a valid AssetFeed API key.', 'ai-detector-by-assetfeed' ),
			402 => __( 'Not enough credits for this check.', 'ai-detector-by-assetfeed' ),
			429 => __( 'Too many checks at once. Try again in a minute.', 'ai-detector-by-assetfeed' ),
			503 => __( 'The detector is busy, try again in a minute.', 'ai-detector-by-assetfeed' ),
		);
	}

	/**
	 * Checks lines of text.
	 *
	 * @param string[] $lines One line per block of the post.
	 * @return array|\WP_Error The API's data object, or an error with data.status (the HTTP status to answer with) and data.upstream (the API's status, 0 if it was not reached).
	 */
	public function check( array $lines ) {
		$lines = array_values(
			array_filter(
				array_map( static fn( $line ) => trim( (string) $line ), $lines ),
				static fn( $line ) => '' !== $line
			)
		);
		$text  = implode( "\n", $lines );

		if ( mb_strlen( $text ) > self::MAX_CHARS ) {
			return new \WP_Error( 'assetfeed_aid_too_long', __( 'The text is too long to check.', 'ai-detector-by-assetfeed' ), array( 'status' => 413 ) );
		}

		// Nothing to send: the detector's own answer for too little text, without a request.
		if ( '' === $text ) {
			return array( 'status' => 'too_short' );
		}

		$key = (string) get_option( 'assetfeed_aid_api_key', '' );

		if ( '' === $key ) {
			return new \WP_Error(
				'assetfeed_aid_no_key',
				__( 'Add your AssetFeed API key in Settings → AI detector.', 'ai-detector-by-assetfeed' ),
				array(
					'status'   => 400,
					'upstream' => 401,
					'no_key'   => true,
				)
			);
		}

		$response = wp_remote_post(
			self::endpoint(),
			array(
				'timeout'             => 60,
				'redirection'         => 0,
				'limit_response_size' => MB_IN_BYTES,
				'headers'             => array(
					'X-Api-Token'  => $key,
					'Content-Type' => 'application/json',
					'Accept'       => 'application/json',
				),
				'body'                => wp_json_encode( array( 'text' => $text ) ),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $this->failure( 0, __( 'Could not reach the AI detector.', 'ai-detector-by-assetfeed' ) );
		}

		$status = (int) wp_remote_retrieve_response_code( $response );
		$body   = json_decode( wp_remote_retrieve_body( $response ), true );
		$data   = is_array( $body ) ? ( $body['data'] ?? null ) : null;

		if ( $status < 200 || $status >= 300 || ! is_array( $body ) || true !== ( $body['success'] ?? false ) || ! is_array( $data ) || ! isset( $data['status'] ) ) {
			$errors = self::errors();
			$reason = is_array( $body ) ? ( $body['error']['message'] ?? $body['message'] ?? null ) : null;

			return $this->failure( $status, $errors[ $status ] ?? ( is_string( $reason ) && '' !== $reason ? $reason : __( 'Could not reach the AI detector.', 'ai-detector-by-assetfeed' ) ) );
		}

		return $data;
	}

	/**
	 * A REST error: 402, 429 and 503 pass through, anything else is a bad gateway so the browser never mistakes it for its own login failing.
	 *
	 * @param int    $upstream The API's HTTP status, 0 if unreachable.
	 * @param string $message  What the editor shows.
	 */
	private function failure( int $upstream, string $message ): \WP_Error {
		return new \WP_Error(
			'assetfeed_aid_upstream',
			$message,
			array(
				'status'   => in_array( $upstream, array( 402, 429, 503 ), true ) ? $upstream : 502,
				'upstream' => $upstream,
			)
		);
	}
}

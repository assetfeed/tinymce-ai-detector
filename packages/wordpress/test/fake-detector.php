<?php
/**
 * Stands in for the detector API in local tests: php -S 127.0.0.1:8841 test/fake-detector.php
 *
 * The recorded sample answer for any request with the key "af_test"; the key "bad" gets 401, "nocredit" 402, "busy" 503.
 * The last request (key and body) is written to the system temp dir, to check what a check really sent.
 */

header( 'Content-Type: application/json' );

$key    = $_SERVER['HTTP_X_API_TOKEN'] ?? '';
$errors = array(
	''         => 401,
	'bad'      => 401,
	'nocredit' => 402,
	'busy'     => 503,
);

file_put_contents( sys_get_temp_dir() . '/aid-fake-last.json', json_encode( array( 'key' => $key, 'body' => json_decode( file_get_contents( 'php://input' ), true ) ) ) );

if ( isset( $errors[ $key ] ) ) {
	http_response_code( $errors[ $key ] );
	echo json_encode( array( 'success' => false, 'error' => array( 'message' => 'fake error' ) ) );
	exit;
}

echo json_encode( array( 'success' => true, 'data' => json_decode( file_get_contents( __DIR__ . '/../../../demo/sample-result.json' ), true ) ) );

<?php
declare(strict_types=1);
header('Cache-Control: no-store, private');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

session_name('mobunaga_analysis_room');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

if (empty($_SESSION['authorized'])) {
    http_response_code(403);
    exit('Forbidden');
}

const DB_CONFIG = '/var/www/.nobunaga-db.ini';
$id = (int)($_GET['id'] ?? 0);
if ($id < 1 || !is_readable(DB_CONFIG)) {
    http_response_code(404);
    exit('Not found');
}

$ini = parse_ini_file(DB_CONFIG, true, INI_SCANNER_RAW);
$c = is_array($ini) && isset($ini['mysql']) && is_array($ini['mysql']) ? $ini['mysql'] : [];
if (empty($c['database']) || empty($c['user']) || !array_key_exists('password', $c)) {
    http_response_code(503);
    exit('DB unavailable');
}

$socket = trim((string)($c['unix_socket'] ?? ''));
$dsn = $socket !== ''
    ? 'mysql:unix_socket=' . $socket . ';dbname=' . $c['database'] . ';charset=utf8mb4'
    : 'mysql:host=' . ($c['host'] ?? 'localhost') . ';port=' . ($c['port'] ?? '3306') . ';dbname=' . $c['database'] . ';charset=utf8mb4';

try {
    $db = new PDO($dsn, (string)$c['user'], (string)$c['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $st = $db->prepare("SELECT f.mime_type, f.file_data FROM form_submission_files f JOIN form_submissions s ON s.id=f.submission_id WHERE f.id=? AND s.form_key='enemy_intel' AND s.status<>'deleted' LIMIT 1");
    $st->execute([$id]);
    $row = $st->fetch();
} catch (Throwable $e) {
    http_response_code(503);
    exit('DB unavailable');
}

if (!$row || !in_array((string)$row['mime_type'], ['image/jpeg','image/png','image/webp'], true)) {
    http_response_code(404);
    exit('Not found');
}
header('Content-Type: ' . $row['mime_type']);
echo $row['file_data'];

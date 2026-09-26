<?php
declare(strict_types=1);
const DB_CONFIG = '/var/www/.nobunaga-db.ini';
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT, ['options'=>['min_range'=>1]]);
if (!$id || !is_readable(DB_CONFIG)) { http_response_code(404); exit; }
$ini = parse_ini_file(DB_CONFIG, true, INI_SCANNER_RAW);
$c = is_array($ini) && isset($ini['mysql']) && is_array($ini['mysql']) ? $ini['mysql'] : [];
if (empty($c['database']) || empty($c['user']) || !array_key_exists('password', $c)) { http_response_code(404); exit; }
$socket = trim((string)($c['unix_socket'] ?? ''));
$dsn = $socket !== ''
    ? 'mysql:unix_socket=' . $socket . ';dbname=' . $c['database'] . ';charset=utf8mb4'
    : 'mysql:host=' . ($c['host'] ?? 'localhost') . ';port=' . ($c['port'] ?? '3306') . ';dbname=' . $c['database'] . ';charset=utf8mb4';
try {
    $db = new PDO($dsn, (string)$c['user'], (string)$c['password'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
    $st = $db->prepare("SELECT image_mime,image_size,image_data FROM formation_reports WHERE id=? AND status='published' LIMIT 1");
    $st->execute([(int)$id]);
    $row = $st->fetch();
} catch (Throwable $e) { http_response_code(404); exit; }
if (!$row) { http_response_code(404); exit; }
$mime = (string)$row['image_mime'];
if (!in_array($mime, ['image/jpeg','image/png','image/webp'], true)) { http_response_code(404); exit; }
$data = $row['image_data'];
if (!is_string($data) || $data === '') { http_response_code(404); exit; }
header('Content-Type: ' . $mime);
header('Content-Length: ' . strlen($data));
header('Content-Disposition: inline');
header("Content-Security-Policy: default-src 'none'; sandbox");
header('Cache-Control: public, max-age=86400');
echo $data;

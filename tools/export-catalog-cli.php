<?php
declare(strict_types=1);

const DB_CONFIG = '/var/www/.nobunaga-db.ini';
require_once dirname(__DIR__) . '/admin/_catalog-export.php';

if (!is_readable(DB_CONFIG)) {
    fwrite(STDERR, "DB config unreadable: " . DB_CONFIG . PHP_EOL);
    exit(2);
}

$ini = parse_ini_file(DB_CONFIG, true, INI_SCANNER_RAW);
$c = is_array($ini) && isset($ini['mysql']) && is_array($ini['mysql']) ? $ini['mysql'] : [];
if (empty($c['database']) || empty($c['user']) || !array_key_exists('password', $c)) {
    fwrite(STDERR, "DB config missing database/user/password" . PHP_EOL);
    exit(3);
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
    $result = mobunaga_export_catalog($db, dirname(__DIR__));
    echo 'catalog exported: ' . $result['path'] . ' / generals=' . $result['generals'] . ' tactics=' . $result['tactics'] . PHP_EOL;
} catch (Throwable $e) {
    fwrite(STDERR, 'catalog export failed: ' . $e->getMessage() . PHP_EOL);
    exit(4);
}

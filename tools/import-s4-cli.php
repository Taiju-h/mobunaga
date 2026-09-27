<?php
declare(strict_types=1);

const DB_CONFIG = '/var/www/.nobunaga-db.ini';
const SQL_FILE = __DIR__ . '/../sql/20260927_s4_full_catalog.sql';
require_once dirname(__DIR__) . '/admin/_catalog-export.php';

function fail(string $message, int $code): never {
    fwrite(STDERR, $message . PHP_EOL);
    exit($code);
}

if (!is_readable(DB_CONFIG)) fail('DB config unreadable: ' . DB_CONFIG, 2);
if (!is_readable(SQL_FILE)) fail('S4 SQL unreadable: ' . SQL_FILE, 3);

$ini = parse_ini_file(DB_CONFIG, true, INI_SCANNER_RAW);
$c = is_array($ini) && isset($ini['mysql']) && is_array($ini['mysql']) ? $ini['mysql'] : [];
if (empty($c['database']) || empty($c['user']) || !array_key_exists('password', $c)) {
    fail('DB config missing database/user/password', 4);
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
    $db->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");

    $sql = (string)file_get_contents(SQL_FILE);
    $sql = preg_replace('/^\xEF\xBB\xBF/', '', $sql) ?? $sql;
    $sql = preg_replace('/^[\t ]*--.*(?:\r\n|\n|\r|$)/m', '', $sql) ?? $sql;

    $lines = preg_split('/\r\n|\n|\r/', $sql) ?: [];
    $buffer = '';
    $statements = [];
    foreach ($lines as $line) {
        if (trim($line) === '' && $buffer === '') continue;
        $buffer .= $line . "\n";
        if (preg_match('/;\s*$/', $line)) {
            $statement = trim($buffer);
            $buffer = '';
            if ($statement !== '') {
                $statements[] = preg_replace('/;\s*$/', '', $statement) ?? $statement;
            }
        }
    }
    if (trim($buffer) !== '') $statements[] = trim($buffer);

    $executed = 0;
    foreach ($statements as $index => $statement) {
        if ($statement === '') continue;
        try {
            $db->exec($statement);
            $executed++;
        } catch (Throwable $e) {
            $preview = preg_replace('/\s+/', ' ', trim($statement)) ?? trim($statement);
            if (mb_strlen($preview) > 180) $preview = mb_substr($preview, 0, 180) . '…';
            throw new RuntimeException('SQL #' . ($index + 1) . ' failed: ' . $e->getMessage() . ' / ' . $preview, 0, $e);
        }
    }

    $s4Generals = (int)$db->query("SELECT COUNT(*) FROM general_tiers WHERE season='S4'")->fetchColumn();
    $s4Unique = (int)$db->query("SELECT COUNT(*) FROM general_unique_tactics gut JOIN general_tiers gt ON gt.general_id=gut.general_id AND gt.season='S4'")->fetchColumn();
    $s4Tactics = (int)$db->query("SELECT COUNT(*) FROM tactics WHERE id LIKE 's4-unique-%'")->fetchColumn();

    if ($s4Generals < 8 || $s4Unique < 8 || $s4Tactics < 8) {
        throw new RuntimeException("S4 verification failed: generals={$s4Generals}, unique_links={$s4Unique}, unique_tactics={$s4Tactics}");
    }

    $result = mobunaga_export_catalog($db, dirname(__DIR__));
    echo "S4 import OK: statements={$executed}, generals={$s4Generals}, unique_links={$s4Unique}, unique_tactics={$s4Tactics}" . PHP_EOL;
    echo 'catalog exported: ' . $result['path'] . ' / generals=' . $result['generals'] . ' tactics=' . $result['tactics'] . PHP_EOL;
} catch (Throwable $e) {
    fail('S4 import/export failed: ' . $e->getMessage(), 10);
}

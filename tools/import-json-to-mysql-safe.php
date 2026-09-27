<?php
declare(strict_types=1);

/**
 * Compatibility wrapper for the full JSON -> MySQL importer.
 * MySQL/MariaDB treats RANK as a reserved word, while the historical importer
 * emitted it unquoted. Patch only those SQL fragments at runtime, then execute
 * the canonical importer in this same directory so __DIR__-relative assets keep working.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$path = __DIR__ . '/import-json-to-mysql.php';
$code = @file_get_contents($path);
if ($code === false) {
    fwrite(STDERR, "ERROR: canonical importer unreadable: {$path}\n");
    exit(2);
}

$code = preg_replace('/^<\?php\s*/', '', $code, 1) ?? $code;
$code = str_replace(
    [
        'INSERT INTO tactics (id,name,rank,category,activation_rate,effect,first_season,applicable_troop,acquisition,source_id)',
        'name=VALUES(name),rank=VALUES(rank),category=VALUES(category)',
    ],
    [
        'INSERT INTO tactics (id,name,`rank`,category,activation_rate,effect,first_season,applicable_troop,acquisition,source_id)',
        'name=VALUES(name),`rank`=VALUES(`rank`),category=VALUES(category)',
    ],
    $code
);

try {
    eval($code);
} catch (Throwable $e) {
    fwrite(STDERR, 'ERROR: full catalog compatibility importer failed: ' . $e->getMessage() . PHP_EOL);
    exit(10);
}

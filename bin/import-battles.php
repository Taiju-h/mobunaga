<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('MOBUNAGA_ANALYSIS_ROOM', true);
require __DIR__.'/../includes/battle-import.php';
$options = getopt('', ['dry-run','frames-dir:','config:','batch:']);
try {
    $batch = readBattleBatch($options['batch'] ?? '/var/www/.nobunaga-battles/s4-20261004.json');
    $records = battleBatchRecords($batch);
    if (isset($options['dry-run'])) {
        echo battleJson(['sources'=>count($batch['sources']),'records'=>count($records),'stats'=>battleStatistics(array_values($records),'S4')]).PHP_EOL;
        exit(0);
    }
    $reader = null;
    if (isset($options['frames-dir'])) {
        $dir = realpath($options['frames-dir']);
        if (!$dir || !is_dir($dir)) throw new RuntimeException('画像ディレクトリがありません。');
        $reader = static function(array $s) use ($dir): string {
            $path = $dir.'/'.basename($s['filename']);
            if (!is_readable($path)) throw new RuntimeException('画像がありません: '.$s['filename']);
            return (string)file_get_contents($path);
        };
    }
    $db = battleDb($options['config'] ?? '/var/www/.nobunaga-db.ini');
    $result = importBattleBatch($db,$batch,$reader);
    $result['source_images_supplied'] = $reader !== null;
    $result['stats'] = battleStatistics(loadBattleRecords($db),'S4');
    echo battleJson($result).PHP_EOL;
} catch (Throwable $e) { fwrite(STDERR, '取り込み失敗: '.$e->getMessage().PHP_EOL); exit(1); }

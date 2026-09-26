<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

const DB_CONFIG = '/var/www/.nobunaga-db.ini';
const TURNS = 8;

function cfg(): array {
    if (!is_readable(DB_CONFIG)) throw new RuntimeException('DB設定が読めません: '.DB_CONFIG);
    $ini = parse_ini_file(DB_CONFIG, true, INI_SCANNER_RAW);
    $c = is_array($ini) && isset($ini['mysql']) && is_array($ini['mysql']) ? $ini['mysql'] : [];
    if (empty($c['database']) || empty($c['user']) || !array_key_exists('password', $c)) throw new RuntimeException('DB設定が不完全です');
    return $c;
}
function db(): PDO {
    $c = cfg();
    $socket = trim((string)($c['unix_socket'] ?? ''));
    $dsn = $socket !== ''
        ? 'mysql:unix_socket='.$socket.';dbname='.$c['database'].';charset=utf8mb4'
        : 'mysql:host='.($c['host'] ?? 'localhost').';port='.($c['port'] ?? '3306').';dbname='.$c['database'].';charset=utf8mb4';
    return new PDO($dsn, (string)$c['user'], (string)$c['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}
function activationRate(string $text): ?float {
    foreach ([
        '/([\d.]+)\s*%?\s*\(Lv10\)/iu',
        '/Lv10[^\d]*([\d.]+)\s*%/iu',
        '/([\d.]+)\s*%/u',
    ] as $p) if (preg_match($p, $text, $m)) return (float)$m[1];
    return null;
}
function prepTurns(string $text): int {
    foreach ([
        '/([1-5])\s*ターン(?:の)?準備/u',
        '/([1-5])\s*ターン準備/u',
        '/準備(?:状態)?(?:に入る|に入り|する|を行う)?[^0-9]{0,12}([1-5])\s*ターン/u',
    ] as $p) if (preg_match($p, $text, $m)) return (int)$m[1];
    return 0;
}
function endpoint(array $m): ?float {
    $v = isset($m[2]) && $m[2] !== '' ? $m[2] : ($m[1] ?? null);
    return is_numeric($v) ? (float)$v : null;
}
function damageRate(string $text): ?float {
    foreach ([
        '/(?:兵刃|計略)ダメージ[（(][^）)]*?(?:ダメージ率)?\s*([\d.]+)%\s*[→～〜~]\s*([\d.]+)%[^）)]*[）)]/u',
        '/([\d.]+)%\s*[→～〜~]\s*([\d.]+)%の(?:兵刃|計略)ダメージ/u',
        '/(?:兵刃|計略)ダメージ[（(][^）)]*?(?:ダメージ率)?\s*([\d.]+)%[^）)]*[）)]/u',
        '/(?:ダメージ率)?\s*([\d.]+)%の(?:兵刃|計略)ダメージ/u',
    ] as $p) if (preg_match($p, $text, $m)) return endpoint($m);
    return null;
}
function healRate(string $text): ?float {
    foreach ([
        '/(?:兵力を回復|兵力回復|治療する|兵力を治療)[（(][^）)]*?(?:回復率|治療率)?\s*([\d.]+)%\s*[→～〜~]\s*([\d.]+)%[^）)]*[）)]/u',
        '/(?:回復率|治療率)\s*([\d.]+)%\s*[→～〜~]\s*([\d.]+)%/u',
        '/([\d.]+)%\s*[→～〜~]\s*([\d.]+)%[^。]{0,16}(?:兵力を回復|兵力回復|治療する|兵力を治療)/u',
        '/(?:兵力を回復|兵力回復|治療する|兵力を治療)[（(][^）)]*?(?:回復率|治療率)?\s*([\d.]+)%[^）)]*[）)]/u',
        '/(?:回復率|治療率)\s*([\d.]+)%/u',
    ] as $p) if (preg_match($p, $text, $m)) return endpoint($m);
    return null;
}
function lifestealRate(string $text): ?float {
    foreach ([
        '/離反(?:率)?[^\d]{0,12}([\d.]+)%\s*[→～〜~]\s*([\d.]+)%/u',
        '/([\d.]+)%\s*[→～〜~]\s*([\d.]+)%[^。]{0,20}離反/u',
        '/離反(?:率)?[^\d]{0,12}([\d.]+)%/u',
        '/([\d.]+)%[^。]{0,20}離反/u',
    ] as $p) if (preg_match($p, $text, $m)) return endpoint($m);
    return null;
}
function meanAt(float $p, int $prep): float {
    $states = ['0,0' => 1.0];
    for ($turn = 1; $turn <= TURNS; $turn++) {
        $next = [];
        $add = static function(int $remaining, int $completed, float $w) use (&$next): void {
            if ($w == 0.0) return;
            $k = $remaining.','.$completed;
            $next[$k] = ($next[$k] ?? 0.0) + $w;
        };
        foreach ($states as $k => $w) {
            [$remaining,$completed] = array_map('intval', explode(',', $k));
            if ($remaining > 0) $add($remaining - 1, $completed + ($remaining === 1 ? 1 : 0), $w);
            else {
                $add(0, $completed, $w * (1 - $p));
                $add($prep, $completed + ($prep === 0 ? 1 : 0), $w * $p);
            }
        }
        $states = $next;
    }
    $mean = 0.0;
    foreach ($states as $k => $w) $mean += ((int)explode(',', $k)[1]) * $w;
    return $mean;
}

$db = db();
$rows = $db->query('SELECT id,name,activation_rate,effect FROM tactics')->fetchAll();
$up = $db->prepare('UPDATE tactics SET activation_probability=?, preparation_turns=?, damage_rate=?, damage_expected=?, damage_upper=?, damage_lower=?, heal_rate=?, heal_expected=?, heal_upper=?, heal_lower=?, lifesteal_rate=?, heal_is_estimate=?, metric_note=?, metric_updated_at=NOW() WHERE id=?');
$db->beginTransaction();
$count = 0;
foreach ($rows as $row) {
    $name = (string)$row['name'];
    $effect = (string)($row['effect'] ?? '');
    $p = activationRate((string)($row['activation_rate'] ?? ''));
    $prep = prepTurns($effect);
    $damage = damageRate($effect);
    $heal = healRate($effect);
    $lifesteal = lifestealRate($effect);
    $estimated = false;
    $note = null;

    if ($name === '水攻干計') {
        $heal = null;
        $lifesteal = null;
        $note = '回復値なし（誤抽出修正）';
    }

    $mean = $lowerMean = $upperMean = null;
    if ($p !== null && $p >= 0 && $p <= 100) {
        $mean = meanAt($p / 100, $prep);
        $lowerMean = floor(meanAt(($p / 2) / 100, $prep));
        $upperMean = meanAt(min(100, $p * 2) / 100, $prep);
    }

    $damageExpected = ($damage !== null && $mean !== null) ? $damage * $mean : null;
    $damageUpper = ($damage !== null && $upperMean !== null) ? $damage * $upperMean : null;
    $damageLower = ($damage !== null && $lowerMean !== null) ? $damage * $lowerMean : null;

    if ($heal === null && $lifesteal !== null && $damage !== null) {
        $heal = $damage * $lifesteal / 100;
        $estimated = true;
        $note = '離反由来。戦法内で抽出できたダメージのみを基準にした概算。';
    }
    $healExpected = ($heal !== null && $mean !== null) ? $heal * $mean : null;
    $healUpper = ($heal !== null && $upperMean !== null) ? $heal * $upperMean : null;
    $healLower = ($heal !== null && $lowerMean !== null) ? $heal * $lowerMean : null;

    $up->execute([$p,$prep,$damage,$damageExpected,$damageUpper,$damageLower,$heal,$healExpected,$healUpper,$healLower,$lifesteal,$estimated ? 1 : 0,$note,$row['id']]);
    $count++;
}
$db->commit();
fwrite(STDOUT, "Updated {$count} tactics\n");

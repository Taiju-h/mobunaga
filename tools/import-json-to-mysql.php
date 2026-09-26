<?php
declare(strict_types=1);

/**
 * モブナガ JSON -> MySQL インポーター
 *
 * 事前条件:
 *   1) /var/www/.nobunaga-db.ini が存在
 *   2) nobunaga/sql/schema.sql を適用済み
 *
 * 実行:
 *   php /var/www/uzero.style/nobunaga/tools/import-json-to-mysql.php
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

const DB_CONFIG = '/var/www/.nobunaga-db.ini';
$assetDir = realpath(__DIR__ . '/../assets');
if ($assetDir === false) {
    fwrite(STDERR, "assets directory not found\n");
    exit(2);
}

function fail(string $message, int $code = 1): never {
    fwrite(STDERR, "ERROR: {$message}\n");
    exit($code);
}

function jsonFile(string $path): array {
    if (!is_readable($path)) fail("JSONを読めません: {$path}");
    try {
        $data = json_decode((string)file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    } catch (Throwable $e) {
        fail("JSON解析失敗: {$path}: {$e->getMessage()}");
    }
    if (!is_array($data)) fail("JSONルートがobject/arrayではありません: {$path}");
    return $data;
}

function scalarOrNull(mixed $value): string|int|float|null {
    return is_scalar($value) ? $value : null;
}

function nullableString(mixed $value): ?string {
    if ($value === null) return null;
    if (is_string($value) || is_numeric($value)) return (string)$value;
    return null;
}

function db(): PDO {
    if (!is_readable(DB_CONFIG)) fail('DB設定がありません: ' . DB_CONFIG);
    $ini = parse_ini_file(DB_CONFIG, true, INI_SCANNER_RAW);
    $c = is_array($ini) && isset($ini['mysql']) && is_array($ini['mysql']) ? $ini['mysql'] : [];
    if (empty($c['database']) || empty($c['user']) || !array_key_exists('password', $c)) {
        fail('DB設定の database / user / password を確認してください');
    }
    $socket = trim((string)($c['unix_socket'] ?? ''));
    $dsn = $socket !== ''
        ? 'mysql:unix_socket=' . $socket . ';dbname=' . $c['database'] . ';charset=utf8mb4'
        : 'mysql:host=' . ($c['host'] ?? 'localhost') . ';port=' . ($c['port'] ?? '3306') . ';dbname=' . $c['database'] . ';charset=utf8mb4';
    try {
        return new PDO($dsn, (string)$c['user'], (string)$c['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (Throwable $e) {
        fail('MySQL接続失敗: ' . $e->getMessage());
    }
}

function sourceId(array $row): string {
    $source = is_array($row['source'] ?? null) ? $row['source'] : [];
    return trim((string)($row['source_id'] ?? ($source['id'] ?? '')));
}

function upsertSourcePage(PDO $db, array $row): ?string {
    $source = is_array($row['source'] ?? null) ? $row['source'] : [];
    $id = sourceId($row);
    if ($id === '') return null;

    $st = $db->prepare(
        'INSERT INTO source_pages (id,source_url,local_path,sha256,fetched_at,source_updated,title) '
        . 'VALUES (?,?,?,?,?,?,?) '
        . 'ON DUPLICATE KEY UPDATE source_url=VALUES(source_url),local_path=VALUES(local_path),sha256=VALUES(sha256),'
        . 'fetched_at=VALUES(fetched_at),source_updated=VALUES(source_updated),title=VALUES(title)'
    );
    $st->execute([
        $id,
        (string)($source['source_url'] ?? ''),
        (string)($source['local_path'] ?? ''),
        (string)($source['sha256'] ?? str_repeat('0', 64)),
        (string)($source['fetched_at'] ?? ''),
        nullableString($source['source_updated'] ?? null),
        nullableString($source['title'] ?? null),
    ]);
    return $id;
}

function upsertFormationSource(PDO $db, array $source): ?string {
    $id = trim((string)($source['id'] ?? ''));
    if ($id === '') return null;
    $st = $db->prepare(
        'INSERT INTO formation_sources (id,season,source_url,title,sha256,fetched_at,local_path) VALUES (?,?,?,?,?,?,?) '
        . 'ON DUPLICATE KEY UPDATE season=VALUES(season),source_url=VALUES(source_url),title=VALUES(title),'
        . 'sha256=VALUES(sha256),fetched_at=VALUES(fetched_at),local_path=VALUES(local_path)'
    );
    $st->execute([
        $id,
        isset($source['season']) ? (int)$source['season'] : null,
        (string)($source['source_url'] ?? ''),
        nullableString($source['title'] ?? null),
        (string)($source['sha256'] ?? str_repeat('0', 64)),
        (string)($source['fetched_at'] ?? ''),
        (string)($source['local_path'] ?? ''),
    ]);
    return $id;
}

$db = db();
$database = jsonFile($assetDir . '/database.json');
$formationsJson = jsonFile($assetDir . '/formations.json');
$analysisJson = jsonFile($assetDir . '/formation-analysis.json');
$detailImages = jsonFile($assetDir . '/detail-images.json');

$counts = [
    'generals' => 0,
    'tactics' => 0,
    'formations' => 0,
    'analyses' => 0,
    'detail_images' => 0,
];

try {
    $db->beginTransaction();

    // ------------------------------------------------------------
    // 武将
    // ------------------------------------------------------------
    $generalUpsert = $db->prepare(
        'INSERT INTO generals (id,name,kana,rarity,faction,family,cost,gender,current_tier,portrait,source_id) '
        . 'VALUES (?,?,?,?,?,?,?,?,?,?,?) '
        . 'ON DUPLICATE KEY UPDATE name=VALUES(name),kana=VALUES(kana),rarity=VALUES(rarity),faction=VALUES(faction),'
        . 'family=VALUES(family),cost=VALUES(cost),gender=VALUES(gender),current_tier=VALUES(current_tier),portrait=VALUES(portrait),source_id=VALUES(source_id)'
    );
    $statUpsert = $db->prepare(
        'INSERT INTO general_stats (general_id,attribute_name,level1,growth,level50) VALUES (?,?,?,?,?) '
        . 'ON DUPLICATE KEY UPDATE level1=VALUES(level1),growth=VALUES(growth),level50=VALUES(level50)'
    );
    $troopUpsert = $db->prepare(
        'INSERT INTO general_troops (general_id,troop,bonus,cap_bonus) VALUES (?,?,?,?) '
        . 'ON DUPLICATE KEY UPDATE bonus=VALUES(bonus),cap_bonus=VALUES(cap_bonus)'
    );
    $tagInsert = $db->prepare('INSERT INTO general_tags (general_id,tag,kind) VALUES (?,?,?)');
    $traitInsert = $db->prepare(
        'INSERT INTO general_traits (general_id,position_no,unlock_level,name,category,grade,target_text,effect) VALUES (?,?,?,?,?,?,?,?)'
    );
    $tierUpsert = $db->prepare(
        'INSERT INTO general_tiers (general_id,season,tier) VALUES (?,?,?) ON DUPLICATE KEY UPDATE tier=VALUES(tier)'
    );
    $uniqueUpsert = $db->prepare(
        'INSERT INTO general_unique_tactics (general_id,name,category,effect) VALUES (?,?,?,?) '
        . 'ON DUPLICATE KEY UPDATE name=VALUES(name),category=VALUES(category),effect=VALUES(effect)'
    );

    foreach (($database['generals'] ?? []) as $g) {
        if (!is_array($g)) continue;
        $id = trim((string)($g['id'] ?? ''));
        if ($id === '') continue;
        $sid = upsertSourcePage($db, $g);
        $generalUpsert->execute([
            $id,
            (string)($g['name'] ?? $id),
            nullableString($g['kana'] ?? null),
            isset($g['rarity']) ? (int)$g['rarity'] : null,
            nullableString($g['faction'] ?? null),
            nullableString($g['family'] ?? null),
            isset($g['cost']) ? (float)$g['cost'] : null,
            nullableString($g['gender'] ?? null),
            nullableString($g['current_tier'] ?? null),
            nullableString($g['portrait'] ?? null),
            $sid,
        ]);

        $db->prepare('DELETE FROM general_stats WHERE general_id=?')->execute([$id]);
        foreach (($g['stats'] ?? []) as $s) {
            if (!is_array($s) || empty($s['attribute'])) continue;
            $statUpsert->execute([$id, (string)$s['attribute'], scalarOrNull($s['level1'] ?? null), scalarOrNull($s['growth'] ?? null), scalarOrNull($s['level50'] ?? null)]);
        }

        $db->prepare('DELETE FROM general_troops WHERE general_id=?')->execute([$id]);
        foreach (($g['troops'] ?? []) as $t) {
            if (!is_array($t) || empty($t['troop'])) continue;
            $troopUpsert->execute([$id, (string)$t['troop'], scalarOrNull($t['bonus'] ?? null), scalarOrNull($t['cap_bonus'] ?? null)]);
        }

        $db->prepare('DELETE FROM general_tags WHERE general_id=?')->execute([$id]);
        foreach (($g['tags'] ?? []) as $tag) {
            if (!is_array($tag) || empty($tag['tag'])) continue;
            $tagInsert->execute([$id, (string)$tag['tag'], nullableString($tag['kind'] ?? null)]);
        }

        $db->prepare('DELETE FROM general_traits WHERE general_id=?')->execute([$id]);
        foreach (($g['traits'] ?? []) as $tr) {
            if (!is_array($tr) || empty($tr['name'])) continue;
            $traitInsert->execute([
                $id,
                (int)($tr['position'] ?? 0),
                nullableString($tr['unlock_level'] ?? null),
                (string)$tr['name'],
                nullableString($tr['category'] ?? null),
                nullableString($tr['grade'] ?? null),
                nullableString($tr['target'] ?? null),
                nullableString($tr['effect'] ?? null),
            ]);
        }

        $db->prepare('DELETE FROM general_tiers WHERE general_id=?')->execute([$id]);
        foreach (($g['tiers'] ?? []) as $tier) {
            if (!is_array($tier) || empty($tier['season']) || empty($tier['tier'])) continue;
            $tierUpsert->execute([$id, (string)$tier['season'], (string)$tier['tier']]);
        }

        $ut = is_array($g['unique_tactic'] ?? null) ? $g['unique_tactic'] : null;
        if ($ut && !empty($ut['name'])) {
            $uniqueUpsert->execute([$id, (string)$ut['name'], nullableString($ut['category'] ?? null), nullableString($ut['effect'] ?? null)]);
        } else {
            $db->prepare('DELETE FROM general_unique_tactics WHERE general_id=?')->execute([$id]);
        }
        $counts['generals']++;
    }

    // ------------------------------------------------------------
    // 戦法
    // effect と手入力メトリクスは既存DB値を尊重する。
    // ------------------------------------------------------------
    $tacticInsert = $db->prepare(
        'INSERT INTO tactics (id,name,rank,category,activation_rate,effect,first_season,applicable_troop,acquisition,source_id) '
        . 'VALUES (?,?,?,?,?,?,?,?,?,?) '
        . 'ON DUPLICATE KEY UPDATE name=VALUES(name),rank=VALUES(rank),category=VALUES(category),activation_rate=VALUES(activation_rate),'
        . 'first_season=VALUES(first_season),applicable_troop=VALUES(applicable_troop),acquisition=VALUES(acquisition),source_id=VALUES(source_id)'
    );
    foreach (($database['tactics'] ?? []) as $t) {
        if (!is_array($t)) continue;
        $id = trim((string)($t['id'] ?? ''));
        if ($id === '') continue;
        $sid = upsertSourcePage($db, $t);
        $tacticInsert->execute([
            $id,
            (string)($t['name'] ?? $id),
            nullableString($t['rank'] ?? null),
            nullableString($t['category'] ?? null),
            nullableString($t['activation_rate'] ?? null),
            nullableString($t['effect'] ?? null),
            nullableString($t['first_season'] ?? null),
            nullableString($t['applicable_troop'] ?? null),
            nullableString($t['acquisition'] ?? null),
            $sid,
        ]);
        $counts['tactics']++;
    }

    // ------------------------------------------------------------
    // 詳細画像対応
    // ------------------------------------------------------------
    $imgUpsert = $db->prepare(
        'INSERT INTO general_detail_images (general_id,image_path) VALUES (?,?) '
        . 'ON DUPLICATE KEY UPDATE image_path=VALUES(image_path)'
    );
    foreach ($detailImages as $generalId => $path) {
        if (!is_string($generalId) || !is_string($path) || $generalId === '' || $path === '') continue;
        // database.json に未収録のIDがあっても全体を止めない。
        $exists = $db->prepare('SELECT 1 FROM generals WHERE id=?');
        $exists->execute([$generalId]);
        if (!$exists->fetchColumn()) continue;
        $imgUpsert->execute([$generalId, $path]);
        $counts['detail_images']++;
    }

    // ------------------------------------------------------------
    // 編成
    // ------------------------------------------------------------
    $formationUpsert = $db->prepare(
        'INSERT INTO formations (id,source_id,source_index,season,name,tier,faction,troops,requirement) VALUES (?,?,?,?,?,?,?,?,?) '
        . 'ON DUPLICATE KEY UPDATE source_id=VALUES(source_id),source_index=VALUES(source_index),season=VALUES(season),name=VALUES(name),'
        . 'tier=VALUES(tier),faction=VALUES(faction),troops=VALUES(troops),requirement=VALUES(requirement)'
    );
    $memberInsert = $db->prepare(
        'INSERT INTO formation_members (formation_id,slot_no,role,general_id,general_name,attribute_plan,equipment,main_school,sub_school) '
        . 'VALUES (?,?,?,?,?,?,?,?,?)'
    );
    $memberTacticInsert = $db->prepare(
        'INSERT INTO formation_member_tactics (formation_id,member_slot,tactic_slot,tactic_id,tactic_name) VALUES (?,?,?,?,?)'
    );

    foreach (($formationsJson['formations'] ?? []) as $f) {
        if (!is_array($f)) continue;
        $id = trim((string)($f['id'] ?? ''));
        if ($id === '') continue;
        $src = is_array($f['source'] ?? null) ? $f['source'] : [];
        $sid = upsertFormationSource($db, $src);
        if ($sid === null && !empty($f['source_id'])) {
            $sid = (string)$f['source_id'];
            upsertFormationSource($db, [
                'id' => $sid,
                'season' => $f['season'] ?? null,
                'source_url' => '',
                'sha256' => str_repeat('0', 64),
                'fetched_at' => '',
                'local_path' => '',
            ]);
        }

        $formationUpsert->execute([
            $id,
            $sid,
            isset($f['source_index']) ? (int)$f['source_index'] : null,
            (int)($f['season'] ?? 0),
            (string)($f['name'] ?? $id),
            nullableString($f['tier'] ?? null),
            nullableString($f['faction'] ?? null),
            nullableString($f['troops'] ?? null),
            nullableString($f['requirement'] ?? null),
        ]);

        $db->prepare('DELETE FROM formation_member_tactics WHERE formation_id=?')->execute([$id]);
        $db->prepare('DELETE FROM formation_members WHERE formation_id=?')->execute([$id]);

        foreach (($f['members'] ?? []) as $m) {
            if (!is_array($m)) continue;
            $slot = (int)($m['slot'] ?? 0);
            if ($slot < 1) continue;
            $generalId = nullableString($m['general_id'] ?? null);
            if ($generalId !== null) {
                $exists = $db->prepare('SELECT 1 FROM generals WHERE id=?');
                $exists->execute([$generalId]);
                if (!$exists->fetchColumn()) $generalId = null;
            }
            $memberInsert->execute([
                $id,
                $slot,
                nullableString($m['role'] ?? null),
                $generalId,
                (string)($m['general_name'] ?? $generalId ?? ''),
                nullableString($m['attribute_plan'] ?? null),
                nullableString($m['equipment'] ?? null),
                nullableString($m['main_school'] ?? null),
                nullableString($m['sub_school'] ?? null),
            ]);

            foreach (($m['tactics'] ?? []) as $mt) {
                if (!is_array($mt)) continue;
                $tacticSlot = (int)($mt['tactic_slot'] ?? 0);
                if ($tacticSlot < 1) continue;
                $tacticId = nullableString($mt['tactic_id'] ?? null);
                if ($tacticId !== null) {
                    $exists = $db->prepare('SELECT 1 FROM tactics WHERE id=?');
                    $exists->execute([$tacticId]);
                    if (!$exists->fetchColumn()) $tacticId = null;
                }
                $memberTacticInsert->execute([
                    $id,
                    $slot,
                    $tacticSlot,
                    $tacticId,
                    (string)($mt['tactic_name'] ?? $tacticId ?? ''),
                ]);
            }
        }
        $counts['formations']++;
    }

    // ------------------------------------------------------------
    // 編成分析
    // ------------------------------------------------------------
    $analysisUpsert = $db->prepare(
        'INSERT INTO formation_analyses (formation_id,base_danger_deviation,summary,movement,warning_text,meta_text) VALUES (?,?,?,?,?,?) '
        . 'ON DUPLICATE KEY UPDATE base_danger_deviation=VALUES(base_danger_deviation),summary=VALUES(summary),movement=VALUES(movement),'
        . 'warning_text=VALUES(warning_text),meta_text=VALUES(meta_text)'
    );
    $scoreInsert = $db->prepare(
        'INSERT INTO formation_limit_break_scores (formation_id,limit_break,danger_deviation,meta_grade) VALUES (?,?,?,?)'
    );
    $requiredInsert = $db->prepare(
        'INSERT INTO formation_required_limit_breaks (formation_id,general_id,required_limit_break,evidence) VALUES (?,?,?,?)'
    );

    foreach (($analysisJson['analyses'] ?? []) as $a) {
        if (!is_array($a)) continue;
        $formationId = trim((string)($a['formation_id'] ?? ''));
        if ($formationId === '') continue;
        $exists = $db->prepare('SELECT 1 FROM formations WHERE id=?');
        $exists->execute([$formationId]);
        if (!$exists->fetchColumn()) continue;

        $analysisUpsert->execute([
            $formationId,
            scalarOrNull($a['base_danger_deviation'] ?? null),
            nullableString($a['summary'] ?? null),
            nullableString($a['movement'] ?? null),
            nullableString($a['warning'] ?? null),
            nullableString($a['meta'] ?? null),
        ]);

        $db->prepare('DELETE FROM formation_limit_break_scores WHERE formation_id=?')->execute([$formationId]);
        foreach (($a['score_by_limit_break'] ?? []) as $s) {
            if (!is_array($s) || !isset($s['limit_break'])) continue;
            $scoreInsert->execute([
                $formationId,
                (int)$s['limit_break'],
                scalarOrNull($s['danger_deviation'] ?? null),
                nullableString($s['meta_grade'] ?? null),
            ]);
        }

        $db->prepare('DELETE FROM formation_required_limit_breaks WHERE formation_id=?')->execute([$formationId]);
        foreach (($a['required_limit_breaks'] ?? []) as $r) {
            if (!is_array($r) || empty($r['general_id'])) continue;
            $generalId = (string)$r['general_id'];
            $gExists = $db->prepare('SELECT 1 FROM generals WHERE id=?');
            $gExists->execute([$generalId]);
            if (!$gExists->fetchColumn()) continue;
            $requiredInsert->execute([
                $formationId,
                $generalId,
                isset($r['required_limit_break']) && $r['required_limit_break'] !== null ? (int)$r['required_limit_break'] : null,
                nullableString($r['evidence'] ?? null),
            ]);
        }
        $counts['analyses']++;
    }

    $db->commit();
} catch (Throwable $e) {
    if ($db->inTransaction()) $db->rollBack();
    fail($e->getMessage());
}

foreach ($counts as $name => $count) {
    echo str_pad($name, 16) . ': ' . $count . PHP_EOL;
}
echo "IMPORT OK\n";

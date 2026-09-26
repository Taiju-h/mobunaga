<?php
declare(strict_types=1);

/**
 * Build assets/database.live.json from the catalog tables.
 * Existing database.json rows are used as a compatibility base so fields that
 * are not represented in MySQL yet are not discarded.
 */
function mobunaga_export_catalog(PDO $db, string $rootDir): array
{
    $basePath = $rootDir . '/assets/database.json';
    $targetPath = $rootDir . '/assets/database.live.json';
    $base = [];
    if (is_readable($basePath)) {
        $decoded = json_decode((string)file_get_contents($basePath), true);
        if (is_array($decoded)) $base = $decoded;
    }

    $queryAll = static function (PDO $db, string $sql): array {
        $stmt = $db->query($sql);
        return $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
    };
    $toNum = static function ($value) {
        if ($value === null || $value === '') return null;
        return (float)$value;
    };

    $sources = [];
    foreach ($queryAll($db, 'SELECT * FROM source_pages') as $row) {
        $sources[(string)$row['id']] = [
            'source_url' => (string)($row['source_url'] ?? ''),
            'title' => (string)($row['title'] ?? ''),
            'fetched_at' => (string)($row['fetched_at'] ?? ''),
        ];
    }

    $group = static function (array $rows, string $key): array {
        $out = [];
        foreach ($rows as $row) $out[(string)$row[$key]][] = $row;
        return $out;
    };

    $stats = $group($queryAll($db, 'SELECT * FROM general_stats ORDER BY general_id, attribute_name'), 'general_id');
    $troops = $group($queryAll($db, 'SELECT * FROM general_troops ORDER BY general_id, troop'), 'general_id');
    $tags = $group($queryAll($db, 'SELECT * FROM general_tags ORDER BY general_id, id'), 'general_id');
    $traits = $group($queryAll($db, 'SELECT * FROM general_traits ORDER BY general_id, position_no, id'), 'general_id');
    $tiers = $group($queryAll($db, 'SELECT * FROM general_tiers ORDER BY general_id, season'), 'general_id');
    $uniqueRows = $queryAll($db, 'SELECT * FROM general_unique_tactics ORDER BY general_id');
    $unique = [];
    foreach ($uniqueRows as $row) $unique[(string)$row['general_id']] = $row;

    $baseGenerals = [];
    foreach (($base['generals'] ?? []) as $row) {
        if (isset($row['id'])) $baseGenerals[(string)$row['id']] = $row;
    }

    $generals = [];
    $generalNameToId = [];
    foreach ($queryAll($db, 'SELECT * FROM generals ORDER BY id') as $row) {
        $id = (string)$row['id'];
        $g = $baseGenerals[$id] ?? [];
        $g = array_replace($g, [
            'id' => $id,
            'name' => (string)$row['name'],
            'kana' => $row['kana'] ?? null,
            'rarity' => $row['rarity'] === null ? null : (int)$row['rarity'],
            'faction' => $row['faction'] ?? null,
            'family' => $row['family'] ?? null,
            'cost' => $toNum($row['cost'] ?? null),
            'gender' => $row['gender'] ?? null,
            'current_tier' => $row['current_tier'] ?? null,
            'portrait' => $row['portrait'] ?? null,
        ]);
        $g['stats'] = array_map(static fn($s) => [
            'general_id' => (string)$s['general_id'],
            'attribute' => (string)$s['attribute_name'],
            'level1' => $toNum($s['level1'] ?? null),
            'growth' => $toNum($s['growth'] ?? null),
            'level50' => $toNum($s['level50'] ?? null),
        ], $stats[$id] ?? []);
        $g['troops'] = array_map(static fn($t) => [
            'general_id' => (string)$t['general_id'],
            'troop' => (string)$t['troop'],
            'bonus' => $toNum($t['bonus'] ?? null),
            'cap_bonus' => $toNum($t['cap_bonus'] ?? null),
        ], $troops[$id] ?? []);
        $g['tags'] = array_map(static fn($t) => [
            'general_id' => (string)$t['general_id'],
            'tag' => (string)$t['tag'],
            'kind' => $t['kind'] ?? null,
        ], $tags[$id] ?? []);
        $g['traits'] = array_map(static fn($t) => [
            'general_id' => (string)$t['general_id'],
            'position_no' => (int)$t['position_no'],
            'unlock_level' => $t['unlock_level'] ?? null,
            'name' => (string)$t['name'],
            'category' => $t['category'] ?? null,
            'grade' => $t['grade'] ?? null,
            'target_text' => $t['target_text'] ?? null,
            'effect' => $t['effect'] ?? null,
        ], $traits[$id] ?? []);
        $g['tiers'] = array_map(static fn($t) => [
            'general_id' => (string)$t['general_id'],
            'season' => (string)$t['season'],
            'tier' => (string)$t['tier'],
        ], $tiers[$id] ?? []);
        if (isset($unique[$id])) {
            $u = $unique[$id];
            $g['unique_tactic'] = [
                'general_id' => $id,
                'name' => (string)$u['name'],
                'category' => $u['category'] ?? null,
                'effect' => $u['effect'] ?? null,
            ];
        } elseif (!isset($g['unique_tactic'])) {
            $g['unique_tactic'] = null;
        }
        $sourceId = (string)($row['source_id'] ?? '');
        if ($sourceId !== '' && isset($sources[$sourceId])) $g['source'] = $sources[$sourceId];
        $generals[] = $g;
        $generalNameToId[(string)$row['name']] = $id;
    }

    $baseTactics = [];
    foreach (($base['tactics'] ?? []) as $row) if (isset($row['id'])) $baseTactics[(string)$row['id']] = $row;
    $uniqueNameToGeneralIds = [];
    foreach ($uniqueRows as $u) $uniqueNameToGeneralIds[(string)$u['name']][] = (string)$u['general_id'];

    $tactics = [];
    foreach ($queryAll($db, 'SELECT * FROM tactics ORDER BY id') as $row) {
        $id = (string)$row['id'];
        $t = $baseTactics[$id] ?? [];
        $t = array_replace($t, [
            'id' => $id,
            'name' => (string)$row['name'],
            'rank' => $row['rank'] ?? null,
            'category' => $row['category'] ?? null,
            'activation_rate' => $row['activation_rate'] ?? null,
            'effect' => $row['effect'] ?? null,
            'first_season' => $row['first_season'] ?? null,
            'applicable_troop' => $row['applicable_troop'] ?? null,
            'acquisition' => $row['acquisition'] ?? null,
        ]);
        foreach (['activation_probability','damage_rate','damage_expected','damage_upper','damage_lower','heal_rate','heal_expected','heal_upper','heal_lower','lifesteal_rate'] as $k) {
            if (array_key_exists($k, $row)) $t[$k] = $toNum($row[$k]);
        }
        foreach (['preparation_turns','heal_is_estimate','flag_damage','flag_heal','flag_buff','flag_debuff','flag_control','flag_special'] as $k) {
            if (array_key_exists($k, $row)) $t[$k] = $row[$k] === null ? null : (int)$row[$k];
        }
        $ids = array_values(array_unique(array_map('strval', $t['general_ids'] ?? [])));
        foreach ($uniqueNameToGeneralIds[(string)$row['name']] ?? [] as $gid) $ids[] = $gid;
        $acq = (string)($row['acquisition'] ?? '');
        if ($acq !== '') {
            foreach ($generalNameToId as $name => $gid) if ($name !== '' && mb_strpos($acq, $name) !== false) $ids[] = $gid;
        }
        $t['general_ids'] = array_values(array_unique($ids));
        $sourceId = (string)($row['source_id'] ?? '');
        if ($sourceId !== '' && isset($sources[$sourceId])) $t['source'] = $sources[$sourceId];
        $tactics[] = $t;
    }

    $meta = is_array($base['meta'] ?? null) ? $base['meta'] : [];
    $meta['generated_at'] = date(DATE_ATOM);
    $meta['expected_generals'] = count($generals);
    $meta['generals'] = count($generals);
    $meta['tactics'] = count($tactics);
    $meta['source'] = 'mysql-live-export';

    $payload = ['meta' => $meta, 'generals' => $generals, 'tactics' => $tactics];
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . "\n";
    $tmp = $targetPath . '.tmp.' . bin2hex(random_bytes(4));
    if (file_put_contents($tmp, $json, LOCK_EX) === false) throw new RuntimeException('一時JSONを書き込めません: ' . $tmp);
    @chmod($tmp, 0644);
    if (!rename($tmp, $targetPath)) { @unlink($tmp); throw new RuntimeException('database.live.json を置換できません。assets/ の書込権限を確認してください。'); }

    return ['path' => $targetPath, 'generals' => count($generals), 'tactics' => count($tactics), 'bytes' => strlen($json)];
}

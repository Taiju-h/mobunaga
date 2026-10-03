<?php
declare(strict_types=1);

if (!defined('MOBUNAGA_ANALYSIS_ROOM')) {
    http_response_code(404);
    exit;
}

function enemyChars(string $value): array
{
    return preg_split('//u', $value, -1, PREG_SPLIT_NO_EMPTY) ?: [];
}

function enemyNormalizeName(string $value): string
{
    if (class_exists('Normalizer')) {
        $value = Normalizer::normalize($value, Normalizer::FORM_KC) ?: $value;
    }
    if (function_exists('mb_convert_kana')) {
        $value = mb_convert_kana($value, 'asKVc', 'UTF-8');
    } else {
        // UTF-8 fallbacks keep name matching usable without mbstring/intl.
        $wide = enemyChars('０１２３４５６７８９ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ');
        $value = strtr($value, array_combine($wide, str_split('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz')));
        $half = enemyChars('ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ');
        $full = enemyChars('ヲァィゥェォャュョッーアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン');
        $mapping = array_combine($half, $full);
        foreach (['ｳﾞ'=>'ヴ','ｶﾞ'=>'ガ','ｷﾞ'=>'ギ','ｸﾞ'=>'グ','ｹﾞ'=>'ゲ','ｺﾞ'=>'ゴ','ｻﾞ'=>'ザ','ｼﾞ'=>'ジ','ｽﾞ'=>'ズ','ｾﾞ'=>'ゼ','ｿﾞ'=>'ゾ','ﾀﾞ'=>'ダ','ﾁﾞ'=>'ヂ','ﾂﾞ'=>'ヅ','ﾃﾞ'=>'デ','ﾄﾞ'=>'ド','ﾊﾞ'=>'バ','ﾋﾞ'=>'ビ','ﾌﾞ'=>'ブ','ﾍﾞ'=>'ベ','ﾎﾞ'=>'ボ','ﾊﾟ'=>'パ','ﾋﾟ'=>'ピ','ﾌﾟ'=>'プ','ﾍﾟ'=>'ペ','ﾎﾟ'=>'ポ'] as $from=>$to) $mapping[$from]=$to;
        $value = strtr($value, $mapping);
        $kata = enemyChars('ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴ');
        $hira = enemyChars('ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔ');
        $value = strtr($value, array_combine($kata, $hira));
    }
    $value = function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value);
    return preg_replace('/[\s\p{Z}\p{P}\p{S}]+/u', '', $value) ?? '';
}

function enemyNameDistance(string $left, string $right): int
{
    $a = enemyChars($left);
    $b = enemyChars($right);
    $previous = range(0, count($b));
    $older = [];
    foreach ($a as $i => $char) {
        $row = [$i + 1];
        foreach ($b as $j => $other) {
            $row[$j + 1] = min($row[$j] + 1, $previous[$j + 1] + 1, $previous[$j] + (int)($char !== $other));
            if ($i > 0 && $j > 0 && $char === $b[$j - 1] && $a[$i - 1] === $other) {
                $row[$j + 1] = min($row[$j + 1], $older[$j - 1] + 1);
            }
        }
        $older = $previous;
        $previous = $row;
    }
    return $previous[count($b)];
}

function enemyNameMatch(string $query, string $name): ?array
{
    if ($query === '') return ['score' => 0, 'label' => ''];
    $q = enemyNormalizeName($query);
    $n = enemyNormalizeName($name);
    if ($q === '' || $n === '') return null;
    if ($q === $n) return ['score' => 100, 'label' => $query === $name ? '名前一致' : '表記違い'];
    if (strpos($n, $q) !== false) return ['score' => 90, 'label' => '名前の部分一致'];
    $len = count(enemyChars($q));
    if ($len < 3) return null; // A short query must not match everyone with one character changed.
    $otherLen = count(enemyChars($n));
    $allowed = $len >= 6 ? 2 : 1;
    if (abs($len - $otherLen) > $allowed) return null;
    $distance = enemyNameDistance($q, $n);
    if ($distance > $allowed || 1 - $distance / max($len, $otherLen) < .65) return null;
    return ['score' => 70 - $distance * 5, 'label' => '似た名前・本人か確認'];
}

function enemyTroop(string $value): string
{
    $value = trim($value);
    return ['騎' => '騎馬', '馬' => '騎馬', '騎兵' => '騎馬', '槍兵' => '槍', '弓兵' => '弓', '鉄砲兵' => '鉄砲'][$value] ?? $value;
}

function enemyText($value): string
{
    if (is_array($value)) return implode('・', array_map('enemyText', $value));
    return is_scalar($value) ? trim((string)$value) : '';
}

function enemyDirectoryRecords(array $archive, array $submissions, array $flags): array
{
    $records = [];
    foreach ($archive['formations'] ?? [] as $formation) {
        $fid = (string)($formation['id'] ?? '');
        foreach ($formation['observations'] ?? [] as $i => $observation) {
            $records[] = [
                'key' => 'video:' . $fid . ':' . $i, 'name' => enemyText($observation['opponent'] ?? ''),
                'troop' => enemyTroop(enemyText($observation['troop'] ?? $formation['troop'] ?? '')),
                'formation' => enemyText($formation['members'] ?? []), 'members' => $formation['members'] ?? [],
                'battle_at' => enemyText($observation['battle_at'] ?? ''), 'posted_at' => '',
                'memo' => enemyText($formation['summary'] ?? ''), 'points' => $formation['watch_points'] ?? [],
                'result' => enemyText($observation['result'] ?? ''), 'video_at' => enemyText($observation['video_at'] ?? ''),
                'source_url' => '', 'files' => [], 'submission_id' => 0, 'status' => 'observed',
                'formation_id' => $fid, 'watch' => !empty($flags[$fid]), 'season' => '',
            ];
        }
    }
    // Group joined attachment rows by submission first, so a record never disappears or duplicates.
    $joined = [];
    foreach ($submissions as $row) {
        $id = (int)($row['id'] ?? 0);
        if (isset($joined[$id])) {
            if (!empty($row['file_id'])) $joined[$id]['files'][] = (int)$row['file_id'];
            continue;
        }
        $row['files'] = array_map('intval', $row['files'] ?? []);
        if (!empty($row['file_id'])) $row['files'][] = (int)$row['file_id'];
        $joined[$id] = $row;
    }
    foreach ($joined as $id => $row) {
        $p = json_decode((string)($row['payload_json'] ?? ''), true);
        if (!is_array($p)) $p = [];
        $records[] = [
            'key' => 'intel:' . $id, 'name' => enemyText($p['enemy_name'] ?? ''),
            'troop' => enemyTroop(enemyText($p['enemy_troop'] ?? $p['troop'] ?? $p['troops'] ?? '')),
            'formation' => enemyText($p['enemy_formation'] ?? ''), 'members' => [],
            'battle_at' => enemyText($p['battle_at'] ?? $p['battle_date'] ?? ''), 'posted_at' => enemyText($row['created_at'] ?? ''),
            'memo' => enemyText($p['memo'] ?? ''), 'points' => [], 'result' => enemyText($p['result'] ?? ''), 'video_at' => '',
            'source_url' => enemyText($p['source_url'] ?? ''), 'files' => array_values(array_unique($row['files'])),
            'submission_id' => $id, 'status' => (string)($row['status'] ?? ''), 'formation_id' => '', 'watch' => false,
            'season' => enemyText($p['season'] ?? ''),
        ];
    }
    return $records;
}

function enemyDirectoryGroups(array $records, string $query = '', bool $watchOnly = false): array
{
    $groups = [];
    foreach ($records as $record) {
        if ($watchOnly && !$record['watch']) continue;
        // Similar names stay separate. A fuzzy search is never proof of a shared player identity.
        $key = $record['name'] === '' ? 'unnamed:' . $record['key'] : json_encode([$record['name'], $record['troop']], JSON_UNESCAPED_UNICODE);
        if (!isset($groups[$key])) $groups[$key] = ['key' => $key, 'name' => $record['name'], 'troop' => $record['troop'], 'records' => [], 'watch' => false, 'score' => 0, 'match' => ''];
        $groups[$key]['records'][] = $record;
        $groups[$key]['watch'] = $groups[$key]['watch'] || $record['watch'];
    }
    $out = [];
    foreach ($groups as $group) {
        $group['total'] = count($group['records']);
        if ($query !== '') {
            $match = enemyNameMatch($query, $group['name']);
            if (!$match) {
                $q = enemyNormalizeName($query);
                if ($q === '') continue;
                $group['records'] = array_values(array_filter($group['records'], fn($r) => strpos(enemyNormalizeName($r['troop'] . ' ' . $r['formation'] . ' ' . $r['memo']), $q) !== false));
                if (!$group['records']) continue;
                $match = ['score' => 40, 'label' => '兵種・編成・メモに一致'];
            }
            $group['score'] = $match['score'];
            $group['match'] = $match['label'];
        }
        usort($group['records'], fn($a, $b) => strcmp($b['battle_at'], $a['battle_at']) ?: strcmp($b['posted_at'], $a['posted_at']) ?: strcmp($a['key'], $b['key']));
        $group['latest'] = $group['records'][0]['battle_at'] ?: $group['records'][0]['posted_at'];
        $out[] = $group;
    }
    usort($out, fn($a, $b) => ($b['score'] <=> $a['score']) ?: ((int)$b['watch'] <=> (int)$a['watch']) ?: strcmp($b['latest'], $a['latest']) ?: strcmp($a['key'], $b['key']));
    return $out;
}

function enemyMetadata(array $input): array
{
    $result = [];
    foreach (['enemy_name' => 120, 'enemy_formation' => 255, 'enemy_troop' => 80] as $key => $limit) {
        $value = enemyText($input[$key] ?? '');
        if (count(enemyChars($value)) > $limit) throw new InvalidArgumentException('入力文字数が上限を超えています。');
        $result[$key] = $key === 'enemy_troop' ? enemyTroop($value) : $value;
    }
    $date = enemyText($input['battle_at'] ?? '');
    if ($date !== '') {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?$/', $date)) throw new InvalidArgumentException('対戦日時の形式を確認してください。');
        $canonical = str_replace('T', ' ', $date);
        $format = strlen($canonical) === 10 ? 'Y-m-d' : (strlen($canonical) === 19 ? 'Y-m-d H:i:s' : 'Y-m-d H:i');
        $parsed = DateTimeImmutable::createFromFormat('!' . $format, $canonical, new DateTimeZone('Asia/Tokyo'));
        if (!$parsed || $parsed->format($format) !== $canonical) throw new InvalidArgumentException('対戦日時の値を確認してください。');
        $date = $canonical;
    }
    $result['battle_at'] = $date;
    return $result;
}

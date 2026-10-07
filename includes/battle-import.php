<?php
declare(strict_types=1);
if (!defined('MOBUNAGA_ANALYSIS_ROOM')) { http_response_code(404); exit; }

function battleDb(string $config = '/var/www/.nobunaga-db.ini'): PDO
{
    $ini = is_readable($config) ? parse_ini_file($config, true, INI_SCANNER_RAW) : false;
    $c = is_array($ini) ? ($ini['mysql'] ?? []) : [];
    if (empty($c['database']) || empty($c['user']) || !isset($c['password'])) throw new RuntimeException('DB設定を読み込めません。');
    $dsn = !empty($c['unix_socket']) ? 'mysql:unix_socket='.$c['unix_socket'] : 'mysql:host='.($c['host'] ?? 'localhost').';port='.($c['port'] ?? '3306');
    return new PDO($dsn.';dbname='.$c['database'].';charset=utf8mb4', $c['user'], $c['password'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false]);
}

function battleJson(array $value): string
{
    return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
}

function battleDateKey(array $record): ?string
{
    $date = $record['battle_at'] ?? null;
    if (!is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/D', $date)) return null;
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $date);
    if (!$parsed || $parsed->format('Y-m-d H:i:s') !== $date) return null;
    return ($record['season'] ?? '').'|'.$date;
}

function battleBatchRecords(array $batch): array
{
    if (($batch['schema_version'] ?? 0) !== 1 || count($batch['sources']) !== $batch['source_count']) throw new RuntimeException('バッチ形式が不正です。');
    $frames = [];
    foreach ($batch['sources'] as $s) {
        if (!preg_match('/^[a-f0-9]{64}$/D', $s['sha256'])) throw new RuntimeException('画像ハッシュが不正です。');
        $frames[$s['frame']] = true;
    }
    $records = [];
    foreach ($batch['observations'] as $o) {
        foreach (['own_generals', 'enemy_generals'] as $field) if (count($o[$field]) !== 3) throw new RuntimeException('編成の枠数が不正です。');
        foreach (['own_limit_breaks','enemy_limit_breaks'] as $field) if(isset($o[$field])){
            if(!is_array($o[$field]) || count($o[$field])!==3)throw new RuntimeException('凸数の枠数が不正です。');
            foreach($o[$field] as $value)if(!is_int($value) || $value<0 || $value>5)throw new RuntimeException('凸数が不正です。');
        }
        foreach (['own_limit_break_total','enemy_limit_break_total'] as $field) if(isset($o[$field]) && (!is_int($o[$field]) || $o[$field]<0 || $o[$field]>15))throw new RuntimeException('凸合計が不正です。');
        if(isset($o['limit_breaks_review']) && $o['limit_breaks_review']!=='visual_limit_break_review')throw new RuntimeException('凸数の確認区分が不正です。');
        if (!in_array($o['result'], ['勝利','敗北','引分'], true)) throw new RuntimeException('勝敗が不正です。');
        foreach ($o['sources'] as $source) if (!isset($frames[$source['frame']])) throw new RuntimeException('参照画像がありません。');
        $o['season'] = $batch['season'];
        $o['batch_id'] = $batch['batch_id'];
        $dateKey = battleDateKey($o);
        if (!empty($o['battle_at']) && $dateKey === null) throw new RuntimeException('日時が不正です。');
        $key = $dateKey ?? $batch['batch_id'].'|'.$o['observation_key'];
        if (!isset($records[$key])) {
            $records[$key] = $o + ['import_record_key'=>$key, 'enemy_formation'=>implode('・', array_filter($o['enemy_generals'])), 'enemy_troop'=>'', 'memo'=>'S4 実測。勝敗は八雲側。日時不明の詳細は集計対象外。戦法・兵力等のOCR原文は未検証。', 'battle_variants'=>[]];
        }
        $records[$key]['battle_variants'][$batch['batch_id'].'|'.$o['observation_key']] = $o;
    }
    return $records;
}

function battleStatistics(array $records, string $season): array
{
    $seen = []; $generals = []; $players = []; $eligible = 0; $undated = 0; $incomplete = 0; $non_gold = 0; $unknown_troop = 0; $captains = []; $troops = [];
    foreach ($records as $r) {
        if (($r['season'] ?? '') !== $season) continue;
        $key = battleDateKey($r);
        if ($key === null) { $undated++; continue; }
        if (isset($seen[$key])) continue;
        $seen[$key] = true;
        $full = true;
        foreach (['own_generals','enemy_generals'] as $field) {
            $g = $r[$field] ?? [];
            if (count($g) !== 3 || count(array_filter($g, fn($v)=>is_string($v) && $v !== '' && $v !== '?')) !== 3) $full = false;
        }
        if (!$full) { $incomplete++; continue; }
        if (!battleIsGoldTeam($r)) { $non_gold++; continue; }
        $eligible++;
        if (!in_array($r['enemy_troop'] ?? '', ['弓','槍','騎馬','鉄砲','兵器'], true)) $unknown_troop++;
        else {
            $troop = $r['enemy_troop'];
            $troops[$troop] = ($troops[$troop] ?? 0) + 1;
        }
        $captain = $r['enemy_generals'][2];
        $captains[$captain] = ($captains[$captain] ?? 0) + 1;
        foreach (array_unique($r['enemy_generals']) as $name) $generals[$name] = ($generals[$name] ?? 0) + 1;
        $name = $r['enemy_name'];
        if (!isset($players[$name])) $players[$name] = ['name'=>$name,'battles'=>0,'wins'=>0,'losses'=>0,'draws'=>0];
        $players[$name]['battles']++;
        // Stored result is our (blue/八雲) side, not the opponent's result.
        if ($r['result'] === '敗北') $players[$name]['wins']++;
        elseif ($r['result'] === '勝利') $players[$name]['losses']++;
        elseif ($r['result'] === '引分') $players[$name]['draws']++;
    }
    foreach ($players as &$player) $player['win_rate'] = 100 * $player['wins'] / $player['battles'];
    unset($player);
    arsort($generals); arsort($captains);
    usort($players, fn($a,$b)=>($b['wins'] <=> $a['wins']) ?: ($b['battles'] <=> $a['battles']) ?: strcmp($a['name'],$b['name']));
    return compact('eligible','undated','incomplete','non_gold','unknown_troop','generals','captains','troops','players');
}

/** Import uses one transaction; all invocations share a MySQL advisory lock. Raw frames stay private. */
function importBattleBatch(PDO $db, array $batch, ?callable $imageReader = null): array
{
    $records = battleBatchRecords($batch);
    $mysql = $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
    if ($mysql && (int)$db->query("SELECT GET_LOCK('mobunaga-battle-import', 10)")->fetchColumn() !== 1) throw new RuntimeException('取り込み処理中です。後で再実行してください。');
    $result = ['new_records'=>0,'updated_records'=>0,'new_sources'=>0,'attached_images'=>0];
    try {
        $db->beginTransaction();
        $existing = []; $receipts = [];
        $rows = $db->query("SELECT id,form_key,payload_json,status FROM form_submissions WHERE form_key IN ('enemy_intel','battle_frame_source') ORDER BY id".($mysql ? ' FOR UPDATE' : ''))->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $row) {
            $p = json_decode($row['payload_json'], true, 512, JSON_THROW_ON_ERROR);
            if ($row['form_key'] === 'battle_frame_source') $receipts[$p['source_sha256']] = $row;
            else {
                $key = battleDateKey($p) ?? ($p['import_record_key'] ?? null);
                if ($key !== null && !isset($existing[$key])) $existing[$key] = $row;
            }
        }
        $insert = $db->prepare("INSERT INTO form_submissions (form_key,payload_json,source_path,status) VALUES (?,?,'/analysis-room/battles.php','reviewed')");
        $update = $db->prepare('UPDATE form_submissions SET payload_json=? WHERE id=?');
        $fileExists = $db->prepare('SELECT id FROM form_submission_files WHERE submission_id=? AND sha256=?');
        $attach = $db->prepare('INSERT INTO form_submission_files (submission_id,original_name,mime_type,file_size,file_data,sha256) VALUES (?,?,?,?,?,?)');
        foreach ($batch['sources'] as $s) {
            $row = $receipts[$s['sha256']] ?? null;
            if (!$row) {
                $p = ['batch_id'=>$batch['batch_id'],'season'=>$batch['season'],'source_sha256'=>$s['sha256'],'source'=>$s,'unverified_row_evidence'=>array_values(array_filter($batch['unverified_row_evidence'], fn($v)=>$v['frame']===$s['frame']))];
                $insert->execute(['battle_frame_source',battleJson($p)]);
                $row = ['id'=>(int)$db->lastInsertId()];
                $result['new_sources']++;
            }
            if ($imageReader !== null) {
                $fileExists->execute([$row['id'],$s['sha256']]);
                if (!$fileExists->fetchColumn()) {
                    $bytes = $imageReader($s);
                    if (!is_string($bytes) || strlen($bytes) !== $s['bytes'] || !hash_equals($s['sha256'],hash('sha256',$bytes))) throw new RuntimeException('画像が一致しません: '.$s['filename']);
                    $attach->execute([$row['id'],$s['filename'],'image/jpeg',strlen($bytes),$bytes,$s['sha256']]);
                    $result['attached_images']++;
                }
            }
        }
        foreach ($records as $key=>$p) {
            if (!isset($existing[$key])) {
                $insert->execute(['enemy_intel',battleJson($p)]);
                $result['new_records']++;
            } else {
                $row = $existing[$key];
                // Never restore a deliberately deleted/spam record or replace edited metadata.
                if (in_array($row['status'],['deleted','spam'],true)) continue;
                $old = json_decode($row['payload_json'],true,512,JSON_THROW_ON_ERROR);
                $merged = battleEnrich($old, $p);
                $merged['battle_variants'] = ($old['battle_variants'] ?? []);
                foreach ($p['battle_variants'] as $variantKey=>$variant) {
                    $merged['battle_variants'][$variantKey] = battleEnrich($merged['battle_variants'][$variantKey] ?? [], $variant);
                }
                if (battleJson($merged) !== battleJson($old)) {
                    $update->execute([battleJson($merged),$row['id']]); $result['updated_records']++;
                }
            }
        }
        $db->commit();
        return $result;
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    } finally {
        if ($mysql) $db->query("SELECT RELEASE_LOCK('mobunaga-battle-import')");
    }
}

function loadBattleRecords(PDO $db): array
{
    $rows = $db->query("SELECT id,payload_json FROM form_submissions WHERE form_key='enemy_intel' AND status IN ('new','reviewed','archived') ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);
    $records = [];
    foreach ($rows as $row) {
        $p = json_decode($row['payload_json'],true,512,JSON_THROW_ON_ERROR);
        if (isset($p['battle_variants'])) $records[] = $p + ['submission_id'=>(int)$row['id']];
    }
    return $records;
}

function battleIsFullTeam(array $r): bool
{
    foreach (['own_generals','enemy_generals'] as $field) {
        $g = $r[$field] ?? [];
        if (count($g) !== 3 || count(array_filter($g, fn($v)=>is_string($v) && $v !== '' && $v !== '?')) !== 3) return false;
    }
    return true;
}

function battleFilter(array $records, string $season, string $query, string $general, bool $exact = false, string $troop = '', string $captain = ''): array
{
    return array_values(array_filter($records, static function($r) use ($season,$query,$general,$exact,$troop,$captain) {
        if (($r['season'] ?? '') !== $season) return false;
        if ($query !== '' && ($exact ? $r['enemy_name'] !== $query : enemyNameMatch($query,$r['enemy_name']) === null)) return false;
        if ($troop !== '' && ($r['enemy_troop'] ?? '') !== $troop) return false;
        if ($captain !== '' && ($r['enemy_generals'][2] ?? '') !== $captain) return false;
        return $general === '' || in_array($general,$r['enemy_generals'] ?? [],true);
    }));
}

function battleLossExamples(array $records, bool $enemyLost = true): array
{
    $seen=[]; $examples=[];
    foreach ($records as $r) {
        $key=battleDateKey($r);
        if ($key===null || isset($seen[$key])) continue;
        $seen[$key]=true;
        if (battleIsGoldTeam($r) && $r['result']===($enemyLost ? '勝利' : '敗北')) $examples[]=$r;
    }
    usort($examples,fn($a,$b)=>strcmp($b['battle_at'],$a['battle_at']));
    return $examples;
}

function readBattleBatch(string $path): array
{
    if (!is_readable($path) || filesize($path)>10*1024*1024) throw new RuntimeException('解析済みデータが未配置、または10MBを超えています。');
    return parseBattleBatch((string)file_get_contents($path));
}

function parseBattleBatch(string $text): array
{
    if(strlen($text)>10*1024*1024)throw new RuntimeException('解析結果は10MB以下にしてください。');
    $batch=json_decode($text,true,512,JSON_THROW_ON_ERROR);
    if (!is_array($batch)) throw new RuntimeException('解析済みデータの形式が不正です。');
    battleBatchRecords($batch);
    return $batch;
}

function battleSourceObservations(array $records,string $batchId,int $frame): array
{
    $found=[];
    foreach($records as $record) foreach(($record['battle_variants']??[]) as $key=>$v) {
        if(($v['batch_id']??'')!==$batchId)continue;
        foreach(($v['sources']??[]) as $source)if((int)$source['frame']===$frame){$found[$key]=$v;break;}
    }
    return array_values($found);
}

/** Rarity comes from the catalog, never cost or troop affinity. Unknown names are excluded. */
function battleIsGoldTeam(array $r): bool
{
    if (!battleIsFullTeam($r)) return false;
    static $rarities = null;
    if ($rarities === null) {
        $catalog = json_decode((string)file_get_contents(__DIR__.'/../assets/database.json'), true, 512, JSON_THROW_ON_ERROR);
        $rarities = [];
        foreach ($catalog['generals'] as $g) $rarities[$g['name']] = (int)$g['rarity'];
    }
    foreach (array_merge($r['own_generals'], $r['enemy_generals']) as $name) if (($rarities[$name] ?? 0) !== 5) return false;
    return true;
}

/** Only reviewed enrichment fields may fill a previously empty value. */
function battleEnrich(array $old, array $incoming): array
{
    $merged = $old + $incoming;
    foreach (['own_troop','enemy_troop','own_captain','enemy_captain','own_tactics','enemy_tactics','troop_review','tactics_review','own_tactic_metrics','enemy_tactic_metrics','tactic_metrics_review','own_limit_breaks','enemy_limit_breaks','own_limit_break_total','enemy_limit_break_total','limit_breaks_review'] as $field) {
        if (empty($merged[$field]) && !empty($incoming[$field])) $merged[$field] = $incoming[$field];
    }
    return $merged;
}

/** Attach original images against existing SHA-256 receipts, without requiring a JSON upload. */
function attachBattleImages(PDO $db, array $files): array
{
    $mysql = $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
    if ($mysql && (int)$db->query("SELECT GET_LOCK('mobunaga-battle-import', 10)")->fetchColumn() !== 1) throw new RuntimeException('取り込み処理中です。後で再実行してください。');
    $result = ['new_records'=>0,'updated_records'=>0,'new_sources'=>0,'attached_images'=>0];
    try {
        $db->beginTransaction(); $known=[];
        $rows=$db->query("SELECT id,payload_json FROM form_submissions WHERE form_key='battle_frame_source' AND status IN ('new','reviewed','archived')".($mysql?' FOR UPDATE':''))->fetchAll(PDO::FETCH_ASSOC);
        foreach($rows as $row){$p=json_decode($row['payload_json'],true,512,JSON_THROW_ON_ERROR);$known[$p['source_sha256']]=['id'=>$row['id'],'source'=>$p['source']];}
        $exists=$db->prepare('SELECT id FROM form_submission_files WHERE submission_id=? AND sha256=?');
        $insert=$db->prepare('INSERT INTO form_submission_files (submission_id,original_name,mime_type,file_size,file_data,sha256) VALUES (?,?,?,?,?,?)');
        $matched=0;
        foreach($files as $file){
            $bytes=($file['read'])(); $hash=hash('sha256',$bytes); $r=$known[$hash]??null;
            if(!$r) continue;
            $matched++;
            if(strlen($bytes)!==(int)$r['source']['bytes'])throw new RuntimeException('画像サイズが一致しません。');
            $exists->execute([$r['id'],$hash]);if($exists->fetchColumn())continue;
            $insert->execute([$r['id'],$r['source']['filename'],'image/jpeg',strlen($bytes),$bytes,$hash]);$result['attached_images']++;
        }
        if(!$matched)throw new RuntimeException('登録済みの解析元画像に一致するファイルがありません。元の画像を加工せず選んでください。');
        $db->commit();return $result;
    } catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    finally{if($mysql)$db->query("SELECT RELEASE_LOCK('mobunaga-battle-import')");}
}

/**
 * Persist reviewed per-player limit-break roster rows.
 * This is separate from dated battle records because the roster comparison is
 * one verified value per player, not a battle-count statistic.
 */
function syncBattleLimitBreakRoster(PDO $db, array $observations): array
{
    $mysql=$db->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql';
    if($mysql && (int)$db->query("SELECT GET_LOCK('mobunaga-limit-break-roster', 10)")->fetchColumn()!==1)
        throw new RuntimeException('凸数名簿の登録処理中です。後で再実行してください。');
    $result=['inserted'=>0,'updated'=>0,'unchanged'=>0];
    try{
        $db->beginTransaction();
        $rows=$db->query("SELECT id,payload_json,status FROM form_submissions WHERE form_key='limit_break_roster' ORDER BY id".($mysql?' FOR UPDATE':''))->fetchAll(PDO::FETCH_ASSOC);
        $existing=[];
        foreach($rows as $row){
            $payload=json_decode($row['payload_json'],true,512,JSON_THROW_ON_ERROR);
            $key=$payload['limit_break_observation_id']??null;
            if(is_string($key)&&$key!=='')$existing[$key]=$row;
        }
        $insert=$db->prepare("INSERT INTO form_submissions (form_key,payload_json,source_path,status) VALUES ('limit_break_roster',?,'/analysis-room/battles.php','reviewed')");
        $update=$db->prepare("UPDATE form_submissions SET payload_json=?,status='reviewed' WHERE id=?");
        foreach($observations as $o){
            $key=$o['limit_break_observation_id']??null;
            if(!is_string($key)||$key==='')throw new RuntimeException('凸数名簿のIDがありません。');
            if(($o['season']??'')!=='S4' || ($o['limit_breaks_review']??'')!=='visual_limit_break_review')
                throw new RuntimeException('凸数名簿の確認区分が不正です。');
            $own=isset($o['own_name']); $enemy=isset($o['enemy_name']);
            if($own===$enemy)throw new RuntimeException('凸数名簿の陣営が不正です。');
            $field=$own?'own_limit_break_total':'enemy_limit_break_total';
            $total=$o[$field]??null;
            if(!is_int($total)||$total<0||$total>15)throw new RuntimeException('凸合計が不正です。');
            $json=battleJson($o);
            if(!isset($existing[$key])){
                $insert->execute([$json]); $result['inserted']++; continue;
            }
            $old=$existing[$key];
            if(in_array($old['status'],['deleted','spam'],true))continue;
            $oldJson=battleJson(json_decode($old['payload_json'],true,512,JSON_THROW_ON_ERROR));
            if($oldJson===$json){$result['unchanged']++;continue;}
            $update->execute([$json,(int)$old['id']]); $result['updated']++;
        }
        $db->commit();
        return $result;
    }catch(Throwable $e){
        if($db->inTransaction())$db->rollBack();
        throw $e;
    }finally{
        if($mysql)$db->query("SELECT RELEASE_LOCK('mobunaga-limit-break-roster')");
    }
}

function loadBattleLimitBreakRoster(PDO $db, string $season): array
{
    $stmt=$db->prepare("SELECT payload_json FROM form_submissions WHERE form_key='limit_break_roster' AND status IN ('new','reviewed','archived') ORDER BY id");
    $stmt->execute();
    $rows=[];
    foreach($stmt->fetchAll(PDO::FETCH_ASSOC) as $row){
        $payload=json_decode($row['payload_json'],true,512,JSON_THROW_ON_ERROR);
        if(($payload['season']??'')===$season)$rows[]=$payload;
    }
    return $rows;
}


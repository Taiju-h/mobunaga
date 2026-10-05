<?php
declare(strict_types=1);
define('MOBUNAGA_ANALYSIS_ROOM',true);
require __DIR__.'/../includes/battle-import.php';
require __DIR__.'/../includes/enemy-directory.php';
function check(bool $ok,string $message): void { if(!$ok)throw new RuntimeException($message); }
function fixtureDb(): PDO {
    $db=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    $db->exec('CREATE TABLE form_submissions(id INTEGER PRIMARY KEY AUTOINCREMENT,form_key TEXT,payload_json TEXT,source_path TEXT,status TEXT)');
    $db->exec('CREATE TABLE form_submission_files(id INTEGER PRIMARY KEY AUTOINCREMENT,submission_id INTEGER,original_name TEXT,mime_type TEXT,file_size INTEGER,file_data BLOB,sha256 TEXT)');
    return $db;
}
$base=['observation_key'=>'a','battle_at'=>'2026-10-04 12:00:00','own_name'=>'味方テスト','enemy_name'=>'敵テストA','result'=>'敗北','own_generals'=>['武田信玄','山本勘助','馬場信春'],'enemy_generals'=>['北条氏康','立花道雪','立花誾千代'],'sources'=>[['frame'=>1]],'selected_frame'=>1];
$batch=['schema_version'=>1,'batch_id'=>'test-only','season'=>'S4','source_count'=>1,'sources'=>[['frame'=>1,'filename'=>'frame_0001.jpg','sha256'=>hash('sha256','example'),'bytes'=>7,'ocr_text'=>'fixture']], 'unverified_row_evidence'=>[], 'observations'=>[
    $base,
    array_replace($base,['observation_key'=>'duplicate','result'=>'勝利']),
    array_replace($base,['observation_key'=>'b','battle_at'=>'2026-10-04 12:01:00','result'=>'勝利']),
    array_replace($base,['observation_key'=>'c','battle_at'=>'2026-10-04 12:02:00','result'=>'引分']),
    array_replace($base,['observation_key'=>'partial','battle_at'=>'2026-10-04 12:03:00','own_generals'=>['武田信玄',null,null]]),
    array_replace($base,['observation_key'=>'undated','battle_at'=>null]),
]];
$records=array_values(battleBatchRecords($batch));
check(count($records)===5,'Timestamp dedup failed');
check(count(battleSourceObservations($records,'test-only',1))===6,'Source evidence did not include variants');
check(battleSourceObservations($records,'wrong-batch',1)===[],'Wrong source batch matched');
$s=battleStatistics($records,'S4');
check($s['eligible']===3 && $s['undated']===1 && $s['incomplete']===1,'Population mismatch');
check(abs($s['players'][0]['win_rate']-100/3)<0.001,'Win rate must include draws');
check($s['players'][0]['wins']===1 && $s['players'][0]['losses']===1,'Opponent results not inverted');
check($s['generals']['北条氏康']===3,'General usage mismatch');
check(battleStatistics($records,'S3')['eligible']===0,'Season leak');
check(count(battleFilter($records,'S4','敵テストA','北条氏康',true))===5,'Exact player/general filter failed');
check(count(battleFilter($records,'S4','敵テストB','',true))===0,'Separate identities merged');
check(count(battleFilter($records,'S4','敵テスト','',false))===5,'Partial-name search failed');
check(battleLossExamples($records,true)[0]['battle_at']==='2026-10-04 12:01:00','Wrong enemy defeat example');
check(count(battleLossExamples($records,false))===1,'Partial or undated example included');
$db=fixtureDb(); $first=importBattleBatch($db,$batch);
check($first['new_records']===5 && $first['new_sources']===1,'Initial import incomplete');
check(array_sum(importBattleBatch($db,$batch))===0,'Repeated import changed database');
check(battleStatistics(loadBattleRecords($db),'S4')===$s,'DB readback mismatch');
check(importBattleBatch($db,$batch,fn($s)=>'example')['attached_images']===1,'Image backfill failed');
check(array_sum(importBattleBatch($db,$batch,fn($s)=>'example'))===0,'Image duplicated');
$other=$batch; $other['batch_id']='other'; $other['observations']=[$base];
$r=importBattleBatch($db,$other);check($r['new_records']===0 && $r['updated_records']===1,'Cross-batch timestamp duplicated');
$broken=fixtureDb(); $caught=false;
try{importBattleBatch($broken,$batch,fn($s)=>'corrupt');}catch(RuntimeException $e){$caught=true;}
check($caught && (int)$broken->query('SELECT COUNT(*) FROM form_submissions')->fetchColumn()===0,'Failed import did not roll back');
$id=(int)$db->query("SELECT id FROM form_submissions WHERE form_key='enemy_intel' ORDER BY id LIMIT 1")->fetchColumn();
$q=$db->prepare('SELECT payload_json FROM form_submissions WHERE id=?');$q->execute([$id]);$p=json_decode($q->fetchColumn(),true);$p['memo']='manual edit';
$db->prepare('UPDATE form_submissions SET payload_json=? WHERE id=?')->execute([battleJson($p),$id]);
importBattleBatch($db,$batch);$q->execute([$id]);check(json_decode($q->fetchColumn(),true)['memo']==='manual edit','Manual metadata overwritten');
$db->prepare("UPDATE form_submissions SET status='deleted' WHERE id=?")->execute([$id]);
importBattleBatch($db,$batch);check(count(loadBattleRecords($db))===4,'Deleted record restored');
echo "battle-import: filters, win rates, loss examples, season, dedup, image backfill, rollback, moderation and metadata PASS\n";

$purple=array_replace($records[0],['battle_at'=>'2026-10-04 13:00:00','enemy_generals'=>['坂井政尚','立花道雪','立花誾千代']]);
check(!battleIsGoldTeam($purple),'Purple team included');
check(battleStatistics([$purple],'S4')['non_gold']===1,'Purple exclusion not counted');
check(battleLossExamples([$purple],false)===[],'Purple defeat example leaked');
$bow=array_replace($records[0],['enemy_troop'=>'弓']);
check(count(battleFilter([$bow,$records[1]],'S4','','',false,'弓','立花誾千代'))===1,'Actual troop/captain filter failed');
$enriched=$batch;foreach($enriched['observations'] as &$v)$v['enemy_troop']='弓';unset($v);
$edb=fixtureDb();importBattleBatch($edb,$batch);importBattleBatch($edb,$enriched);
$back=loadBattleRecords($edb);check($back[0]['enemy_troop']==='弓','Missing troop not enriched');
check(reset($back[0]['battle_variants'])['enemy_troop']==='弓','Variant not enriched');
check(array_sum(importBattleBatch($edb,$enriched))===0,'Enrichment not idempotent');
check(attachBattleImages($edb,[['read'=>fn()=>'example']])['attached_images']===1,'JSON-free attachment failed');
check(attachBattleImages($edb,[['read'=>fn()=>'example']])['attached_images']===0,'JSON-free attachment duplicated');
echo "gold eligibility, troop/captain filters, enrichment, ZIP-only receipt matching PASS\n";

<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
const DB_CONFIG='/var/www/.nobunaga-db.ini';
function fail(string $m): never { fwrite(STDERR,"ERROR: $m\n"); exit(1); }
function db(): PDO {
  if(!is_readable(DB_CONFIG)) fail('DB設定がありません');
  $ini=parse_ini_file(DB_CONFIG,true,INI_SCANNER_RAW); $c=$ini['mysql']??[];
  $socket=trim((string)($c['unix_socket']??''));
  $dsn=$socket!==''?'mysql:unix_socket='.$socket.';dbname='.$c['database'].';charset=utf8mb4':'mysql:host='.($c['host']??'localhost').';port='.($c['port']??'3306').';dbname='.$c['database'].';charset=utf8mb4';
  return new PDO($dsn,(string)$c['user'],(string)$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
}
function pctPair(string $text,string $label): array {
  $q=preg_quote($label,'/');
  if(preg_match('/'.$q.'[^0-9]{0,20}(\d+(?:\.\d+)?)\s*%\s*[→〜~\-]\s*(\d+(?:\.\d+)?)\s*%/u',$text,$m)) return [(float)$m[1],(float)$m[2]];
  if(preg_match('/'.$q.'[^0-9]{0,20}(\d+(?:\.\d+)?)\s*%/u',$text,$m)) return [(float)$m[1],(float)$m[1]];
  return [null,null];
}
function lv10Probability(?string $raw): ?float {
  $raw=trim((string)$raw); if($raw==='') return null;
  if(!preg_match_all('/(\d+(?:\.\d+)?)\s*%/u',$raw,$m) || empty($m[1])) return null;
  $vals=array_map('floatval',$m[1]);
  return max($vals); // 表記が Lv1→Lv10 の場合は最終/最大値を Lv10 として採用
}
function nearestProbability(string $text,string $term): ?float {
  $q=preg_quote($term,'/');
  foreach(['/([0-9]+(?:\.[0-9]+)?)\s*%[^。；、]{0,24}'.$q.'/u','/'.$q.'[^。；、]{0,24}([0-9]+(?:\.[0-9]+)?)\s*%/u'] as $rx)
    if(preg_match($rx,$text,$m)) return (float)$m[1];
  return null;
}
$db=db();
$statusMap=['混乱'=>'confusion','封撃'=>'disarm','無策'=>'silence','虚弱'=>'weakness','挑発'=>'taunt','逃亡'=>'flee','恐慌'=>'panic','燃焼'=>'burn','中毒'=>'poison','麻痺'=>'paralysis','禁療'=>'heal_block','震撼'=>'stun'];
$rows=$db->query('SELECT id,activation_rate,effect FROM tactics ORDER BY id')->fetchAll();
$up=$db->prepare('UPDATE tactics SET activation_probability=?,damage_rate=?,damage_rate_min=?,damage_rate_max=?,heal_rate=?,heal_rate_min=?,heal_rate_max=?,lifesteal_rate=?,mind_attack_rate=?,flag_lifesteal=?,flag_mind_attack=?,metric_updated_at=NOW() WHERE id=?');
$del=$db->prepare('DELETE FROM tactic_status_effects WHERE tactic_id=?');
$ins=$db->prepare('INSERT INTO tactic_status_effects (tactic_id,status_code,status_name,enabled,probability_pct,sort_order) VALUES (?,?,?,?,?,?)');
$db->beginTransaction(); $n=0; $s=0; $withActivation=0;
foreach($rows as $r){
  $id=(string)$r['id']; $text=(string)($r['effect']??'');
  $activation=lv10Probability($r['activation_rate']??null); if($activation!==null)$withActivation++;
  [$dmin,$dmax]=pctPair($text,'ダメージ率');
  [$hmin,$hmax]=pctPair($text,'回復率');
  [$lsmin,$lsmax]=pctPair($text,'離反'); $ls=$lsmax??$lsmin;
  [$mamin,$mamax]=pctPair($text,'心攻'); $ma=$mamax??$mamin;
  $hasLs=str_contains($text,'離反')?1:null; $hasMa=str_contains($text,'心攻')?1:null;
  // ダメージ/回復の代表値は常に Lv10 側（範囲の最大値）を採用する。
  $up->execute([$activation,$dmax??$dmin,$dmin,$dmax,$hmax??$hmin,$hmin,$hmax,$ls,$ma,$hasLs,$hasMa,$id]);
  $del->execute([$id]); $order=0;
  foreach($statusMap as $name=>$code){
    if(!str_contains($text,$name)) continue;
    $prob=nearestProbability($text,$name);
    $ins->execute([$id,$code,$name,1,$prob,$order++]); $s++;
  }
  $n++;
}
$db->commit();
echo "TACTICS $n\nACTIVATION_LV10 $withActivation\nSTATUS_ROWS $s\nOK\n";

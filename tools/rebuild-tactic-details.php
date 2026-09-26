<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
const DB_CONFIG='/var/www/.nobunaga-db.ini';
function fail(string $m): never { fwrite(STDERR,"ERROR: $m\n"); exit(1); }
function db(): PDO {
  if(!is_readable(DB_CONFIG)) fail('DB設定がありません');
  $i=parse_ini_file(DB_CONFIG,true,INI_SCANNER_RAW); $c=$i['mysql']??[];
  $dsn=trim((string)($c['unix_socket']??''))!==''
    ? 'mysql:unix_socket='.$c['unix_socket'].';dbname='.$c['database'].';charset=utf8mb4'
    : 'mysql:host='.($c['host']??'localhost').';port='.($c['port']??3306).';dbname='.$c['database'].';charset=utf8mb4';
  return new PDO($dsn,(string)$c['user'],(string)$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
}
function pctRange(string $text,string $label): array {
  $q=preg_quote($label,'/');
  if(preg_match('/'.$q.'\s*(\d+(?:\.\d+)?)\s*[%％]\s*[→〜~～-]\s*(\d+(?:\.\d+)?)\s*[%％]/u',$text,$m)) return [(float)$m[1],(float)$m[2]];
  if(preg_match('/'.$q.'\s*(\d+(?:\.\d+)?)\s*[%％]/u',$text,$m)) return [(float)$m[1],(float)$m[1]];
  return [null,null];
}
function nearbyProbability(string $text,string $term): ?float {
  $q=preg_quote($term,'/');
  if(preg_match('/(\d+(?:\.\d+)?)\s*[%％]の確率で[^。；;]{0,40}'.$q.'/u',$text,$m)) return (float)$m[1];
  if(preg_match('/'.$q.'[^。；;]{0,40}(\d+(?:\.\d+)?)\s*[%％]の確率/u',$text,$m)) return (float)$m[1];
  return null;
}
$db=db();
$rows=$db->query('SELECT id,effect,activation_rate FROM tactics')->fetchAll();
$upd=$db->prepare('UPDATE tactics SET activation_probability=?,damage_rate_min=?,damage_rate_max=?,heal_rate_min=?,heal_rate_max=?,flag_lifesteal=?,lifesteal_rate=?,flag_heart_attack=?,heart_attack_rate=?,flag_disarm=?,flag_silence=?,flag_confusion=?,flag_taunt=?,flag_burn=?,flag_poison=?,flag_rout=?,flag_fear=?,status_probability=?,parse_confidence=?,parsed_at=NOW() WHERE id=?');
$del=$db->prepare('DELETE FROM tactic_effect_components WHERE tactic_id=? AND is_manual=0');
$ins=$db->prepare('INSERT INTO tactic_effect_components (tactic_id,sort_order,component_type,effect_name,probability,rate_min,rate_max,stat_basis,source_text,is_manual) VALUES (?,?,?,?,?,?,?,?,?,0)');
$statuses=['封撃'=>'flag_disarm','無策'=>'flag_silence','混乱'=>'flag_confusion','挑発'=>'flag_taunt','火傷'=>'flag_burn','中毒'=>'flag_poison','潰走'=>'flag_rout','恐慌'=>'flag_fear'];
$count=0;
foreach($rows as $r){
  $id=(string)$r['id']; $text=(string)($r['effect']??''); $act=null;
  if(preg_match('/(\d+(?:\.\d+)?)\s*[%％]/u',(string)($r['activation_rate']??''),$m)) $act=(float)$m[1]/100;
  [$dmin,$dmax]=pctRange($text,'ダメージ率'); [$hmin,$hmax]=pctRange($text,'回復率');
  [$lmin,$lmax]=pctRange($text,'離反'); [$cmin,$cmax]=pctRange($text,'心攻');
  $life=str_contains($text,'離反')?1:0; $heart=str_contains($text,'心攻')?1:0;
  $flags=[]; $statusProb=null; foreach($statuses as $name=>$col){ $flags[$col]=str_contains($text,$name)?1:0; if($flags[$col]){$p=nearbyProbability($text,$name); if($p!==null&&$statusProb===null)$statusProb=$p/100;} }
  $known=($dmin!==null||$hmin!==null||$life||$heart||array_sum($flags)>0); $confidence=$known?0.85:0.30;
  $upd->execute([$act,$dmin,$dmax,$hmin,$hmax,$life,$lmin,$heart,$cmin,$flags['flag_disarm'],$flags['flag_silence'],$flags['flag_confusion'],$flags['flag_taunt'],$flags['flag_burn'],$flags['flag_poison'],$flags['flag_rout'],$flags['flag_fear'],$statusProb,$confidence,$id]);
  $del->execute([$id]); $order=0;
  if($dmin!==null)$ins->execute([$id,++$order,'damage','ダメージ',null,$dmin,$dmax,str_contains($text,'知略依存')?'知略':(str_contains($text,'武勇依存')?'武勇':null),$text]);
  if($hmin!==null)$ins->execute([$id,++$order,'heal','回復',null,$hmin,$hmax,str_contains($text,'知略依存')?'知略':null,$text]);
  if($life)$ins->execute([$id,++$order,'lifesteal','離反',null,$lmin,$lmax,null,$text]);
  if($heart)$ins->execute([$id,++$order,'heart_attack','心攻',null,$cmin,$cmax,null,$text]);
  foreach($statuses as $name=>$col) if($flags[$col]) $ins->execute([$id,++$order,'status',$name,nearbyProbability($text,$name)!==null?nearbyProbability($text,$name)/100:null,null,null,null,$text]);
  $count++;
}
echo "TACTIC DETAIL PARSE OK: {$count}\n";

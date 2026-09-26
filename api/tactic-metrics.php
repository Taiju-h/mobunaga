<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
const DB_CONFIG = '/var/www/.nobunaga-db.ini';
function out(int $s,array $d):never{http_response_code($s);echo json_encode($d,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
if(!is_readable(DB_CONFIG)) out(503,['ok'=>false,'error'=>'DB設定が未登録です','config_path'=>DB_CONFIG]);
$ini=parse_ini_file(DB_CONFIG,true,INI_SCANNER_RAW);$c=is_array($ini)&&isset($ini['mysql'])&&is_array($ini['mysql'])?$ini['mysql']:[];
if(empty($c['database'])||empty($c['user'])||!array_key_exists('password',$c)) out(503,['ok'=>false,'error'=>'DB設定が不完全です']);
$socket=trim((string)($c['unix_socket']??''));
$dsn=$socket!==''?'mysql:unix_socket='.$socket.';dbname='.$c['database'].';charset=utf8mb4':'mysql:host='.($c['host']??'localhost').';port='.($c['port']??'3306').';dbname='.$c['database'].';charset=utf8mb4';
try{$db=new PDO($dsn,(string)$c['user'],(string)$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
$rows=$db->query('SELECT id,activation_probability,preparation_turns,damage_rate,damage_expected,damage_upper,damage_lower,heal_rate,heal_expected,heal_upper,heal_lower,lifesteal_rate,heal_is_estimate,metric_note,metric_updated_at FROM tactics')->fetchAll();
foreach($rows as &$r){foreach(['activation_probability','damage_rate','damage_expected','damage_upper','damage_lower','heal_rate','heal_expected','heal_upper','heal_lower','lifesteal_rate'] as $k)$r[$k]=$r[$k]===null?null:(float)$r[$k];$r['preparation_turns']=(int)$r['preparation_turns'];$r['heal_is_estimate']=(bool)$r['heal_is_estimate'];}
out(200,['ok'=>true,'metrics'=>$rows]);}catch(Throwable $e){out(503,['ok'=>false,'error'=>'DBメトリクスを取得できません']);}

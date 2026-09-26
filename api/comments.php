<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
const DB_CONFIG='/var/www/.nobunaga-db.ini';
function out(int $s,array $d):never{http_response_code($s);echo json_encode($d,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
function cut(string $v,int $n):string{$v=trim($v);return function_exists('mb_substr')?mb_substr($v,0,$n,'UTF-8'):substr($v,0,$n);}
function cfg():array{if(!is_readable(DB_CONFIG))out(503,['ok'=>false,'error'=>'DB設定がありません']);$i=parse_ini_file(DB_CONFIG,true,INI_SCANNER_RAW);$c=is_array($i)&&isset($i['mysql'])&&is_array($i['mysql'])?$i['mysql']:[];if(empty($c['database'])||empty($c['user'])||!array_key_exists('password',$c))out(503,['ok'=>false,'error'=>'DB設定が不完全です']);return $c;}
function db():PDO{$c=cfg();$sock=trim((string)($c['unix_socket']??''));$dsn=$sock!==''?'mysql:unix_socket='.$sock.';dbname='.$c['database'].';charset=utf8mb4':'mysql:host='.($c['host']??'localhost').';port='.($c['port']??'3306').';dbname='.$c['database'].';charset=utf8mb4';try{return new PDO($dsn,(string)$c['user'],(string)$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);}catch(Throwable $e){out(503,['ok'=>false,'error'=>'DBへ接続できません']);}}
function entityType(string $v):string{if(!in_array($v,['general','formation','tactic'],true))out(400,['ok'=>false,'error'=>'対象種別が不正です']);return $v;}
function entityId(string $v):string{$v=cut($v,190);if($v===''||!preg_match('/^[A-Za-z0-9_-]+$/',$v))out(400,['ok'=>false,'error'=>'対象IDが不正です']);return $v;}
function seasonNo(mixed $v):int{$n=filter_var($v,FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>99]]);if($n===false)out(400,['ok'=>false,'error'=>'シーズンを選択してください']);return (int)$n;}
function sameOrigin():bool{$h=strtolower(preg_replace('/:\d+$/','',(string)($_SERVER['HTTP_HOST']??'')));$o=trim((string)($_SERVER['HTTP_ORIGIN']??''));if($o==='')return false;$oh=strtolower((string)(parse_url($o,PHP_URL_HOST)??''));return $h!==''&&$oh!==''&&hash_equals($h,$oh);}
$pdo=db();$method=$_SERVER['REQUEST_METHOD']??'GET';
if($method==='GET'){$type=entityType((string)($_GET['entity_type']??''));$id=entityId((string)($_GET['entity_id']??''));$season=seasonNo($_GET['season']??null);try{$s=$pdo->prepare("SELECT id,poster_name,comment_text,season_no,created_at FROM content_comments WHERE entity_type=? AND entity_id=? AND season_no<=? AND status='approved' ORDER BY id DESC LIMIT 100");$s->execute([$type,$id,$season]);out(200,['ok'=>true,'season'=>$season,'comments'=>$s->fetchAll()]);}catch(Throwable $e){out(503,['ok'=>false,'error'=>'コメントDBへシーズン拡張SQLを適用してください']);}}
if($method!=='POST')out(405,['ok'=>false,'error'=>'Method Not Allowed']);
if(!sameOrigin())out(403,['ok'=>false,'error'=>'送信元を確認できません']);
if(!empty($_POST['website']))out(400,['ok'=>false,'error'=>'送信できません']);
$type=entityType((string)($_POST['entity_type']??''));$id=entityId((string)($_POST['entity_id']??''));$season=seasonNo($_POST['season']??null);$name=cut((string)($_POST['poster_name']??''),80);if($name==='')$name='匿名';$text=cut((string)($_POST['comment_text']??''),1500);if($text==='')out(400,['ok'=>false,'error'=>'コメントを入力してください']);
$c=cfg();$salt=trim((string)($c['ip_salt']??''));if(strlen($salt)<32)out(503,['ok'=>false,'error'=>'DB設定の ip_salt を32文字以上にしてください']);$hash=hash('sha256',$salt.'|'.(string)($_SERVER['REMOTE_ADDR']??''));
try{$r=$pdo->prepare("SELECT COUNT(*) FROM content_comments WHERE ip_hash=? AND created_at >= (NOW() - INTERVAL 10 MINUTE)");$r->execute([$hash]);if((int)$r->fetchColumn()>=8)out(429,['ok'=>false,'error'=>'短時間の投稿数が多すぎます']);$s=$pdo->prepare("INSERT INTO content_comments(entity_type,entity_id,season_no,poster_name,comment_text,status,ip_hash) VALUES (?,?,?,?,?,'pending',?)");$s->execute([$type,$id,$season,$name,$text,$hash]);out(201,['ok'=>true,'message'=>'S'.$season.'のコメントとして受け付けました。承認後に表示されます。']);}catch(Throwable $e){out(503,['ok'=>false,'error'=>'コメントDBへシーズン拡張SQLを適用してください']);}

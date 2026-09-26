<?php
declare(strict_types=1);
header('Cache-Control: no-store, private');
header('Pragma: no-cache');
header("Content-Security-Policy: default-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

session_name('mobunaga_analysis_room');
session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off','httponly'=>true,'samesite'=>'Strict']);
session_start();
if (empty($_SESSION['authorized'])) { header('Location: /analysis-room/index.php'); exit; }

const DB_CONFIG = '/var/www/.nobunaga-db.ini';
function e(string $v): string { return htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function row(string $name, bool $ok, string $detail): array { return ['name'=>$name,'ok'=>$ok,'detail'=>$detail]; }
$checks=[];$db=null;
$checks[]=row('DB設定ファイル', is_readable(DB_CONFIG), is_readable(DB_CONFIG)?DB_CONFIG.' を読めます':DB_CONFIG.' がありません / 読めません');

if (is_readable(DB_CONFIG)) {
    $ini=parse_ini_file(DB_CONFIG,true,INI_SCANNER_RAW);
    $c=is_array($ini)&&isset($ini['mysql'])&&is_array($ini['mysql'])?$ini['mysql']:[];
    $complete=!empty($c['database'])&&!empty($c['user'])&&array_key_exists('password',$c)&&strlen((string)($c['ip_salt']??''))>=32;
    $checks[]=row('DB設定内容',$complete,$complete?'database / user / password / ip_salt を確認':'database / user / password / 32文字以上の ip_salt を確認してください');
    if ($complete) {
        $socket=trim((string)($c['unix_socket']??''));
        $dsn=$socket!==''?'mysql:unix_socket='.$socket.';dbname='.$c['database'].';charset=utf8mb4':'mysql:host='.($c['host']??'localhost').';port='.($c['port']??'3306').';dbname='.$c['database'].';charset=utf8mb4';
        try {
            $db=new PDO($dsn,(string)$c['user'],(string)$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
            $checks[]=row('MySQL接続',true,'PDOで接続成功 / emulate prepares = OFF');
        } catch(Throwable $ex) { $checks[]=row('MySQL接続',false,'接続失敗'); }
    }
}

if ($db instanceof PDO) {
    try { $st=$db->prepare('SELECT ? AS probe');$st->execute(['prepared-ok']);$checks[]=row('プリペアドステートメント',(string)$st->fetchColumn()==='prepared-ok','バインド変数で実行成功'); } catch(Throwable $e){$checks[]=row('プリペアドステートメント',false,'実行失敗');}
    try { $db->query('SELECT id, damage_expected, heal_expected FROM tactics LIMIT 1');$checks[]=row('tactics メトリクス列',true,'damage_expected / heal_expected を確認'); } catch(Throwable $e){$checks[]=row('tactics メトリクス列',false,'メトリクス migration が未適用の可能性');}
    try {
        $db->beginTransaction();
        $png=base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',true);
        $st=$db->prepare("INSERT INTO formation_reports (formation_key,report_type,result_type,poster_name,comment_text,opponent_text,image_mime,image_size,image_data,ip_hash,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
        $st->bindValue(1,'diagnostic-test',PDO::PARAM_STR);$st->bindValue(2,'win_with',PDO::PARAM_STR);$st->bindValue(3,'win',PDO::PARAM_STR);$st->bindValue(4,'診断',PDO::PARAM_STR);$st->bindValue(5,'rollback test',PDO::PARAM_STR);$st->bindValue(6,'',PDO::PARAM_STR);$st->bindValue(7,'image/png',PDO::PARAM_STR);$st->bindValue(8,strlen((string)$png),PDO::PARAM_INT);$st->bindValue(9,$png,PDO::PARAM_LOB);$st->bindValue(10,str_repeat('0',64),PDO::PARAM_STR);$st->bindValue(11,'hidden',PDO::PARAM_STR);$st->execute();
        $db->rollBack();
        $checks[]=row('画像BLOB書込テスト',true,'1x1 PNGをINSERTしてROLLBACK成功（DBには残しません）');
    } catch(Throwable $e) { if($db->inTransaction())$db->rollBack();$checks[]=row('画像BLOB書込テスト',false,'formation_reports の schema / 権限を確認してください'); }
}
$checks[]=row('fileinfo',class_exists('finfo'),'MIME判定に使用');
$checks[]=row('画像検証',function_exists('getimagesize'),'画像寸法・実画像判定に使用');
$checks[]=row('PHP upload_max_filesize',true,(string)ini_get('upload_max_filesize'));
$checks[]=row('PHP post_max_size',true,(string)ini_get('post_max_size'));
?><!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>モブナガ 診断</title><style>body{font-family:system-ui,sans-serif;background:#f3efe5;color:#2f2a22;margin:0}.wrap{max-width:900px;margin:40px auto;padding:0 18px}.card{background:#fffdf7;border:1px solid #c8b98f;border-radius:14px;padding:22px}.head{display:flex;justify-content:space-between;gap:12px;align-items:center}.head a{color:#174f65}.check{display:grid;grid-template-columns:180px 80px 1fr;gap:10px;padding:12px 0;border-top:1px solid #e4dcc7}.ok{color:#237a45;font-weight:800}.ng{color:#b72a2a;font-weight:800}.note{margin-top:20px;padding:12px;background:#f7f2e6;border-radius:10px}@media(max-width:650px){.check{grid-template-columns:1fr}.head{display:block}}</style></head><body><div class="wrap"><div class="card"><div class="head"><h1>モブナガ DB / 投稿診断</h1><a href="/analysis-room/index.php">資料館へ戻る</a></div><?php foreach($checks as $c):?><div class="check"><strong><?=e($c['name'])?></strong><span class="<?=$c['ok']?'ok':'ng'?>"><?=$c['ok']?'OK':'NG'?></span><span><?=e($c['detail'])?></span></div><?php endforeach;?><div class="note">画像書込テストはトランザクション内で INSERT → ROLLBACK しているため、診断データはDBに残りません。</div></div></div></body></html>

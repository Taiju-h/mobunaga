<?php
declare(strict_types=1);
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'self'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
require_once __DIR__.'/../includes/analysis-session.php';
mobunagaRequireLogin();
define('MOBUNAGA_ANALYSIS_ROOM',true);
require __DIR__.'/../includes/battle-import.php';
function e(string $s): string { return htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8'); }
if(empty($_SESSION['battle_csrf']))$_SESSION['battle_csrf']=bin2hex(random_bytes(32));
$error=''; $receipt=null; $counts=[];
try {
    $db=battleDb();
    if(($_SERVER['REQUEST_METHOD'] ?? '')==='POST') {
        if(empty($_POST) && (int)($_SERVER['CONTENT_LENGTH']??0)>0)throw new RuntimeException('送信上限を超えました。ZIPを展開して画像フォルダを選んでください。');
        if(!is_string($_POST['csrf'] ?? null) || !hash_equals($_SESSION['battle_csrf'],$_POST['csrf'])){http_response_code(403);throw new RuntimeException('画面を読み直してください。');}
        if(($_POST['mode']??'')==='images') {
            $files=[]; $zip=null; $images=$_FILES['frames']??null; $single=$_FILES['image']??null;
            if($images && ($images['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_NO_FILE){
                if(!class_exists('ZipArchive'))throw new RuntimeException('ZIP非対応です。画像フォルダを選んでください。');
                if($images['error']!==UPLOAD_ERR_OK || !is_uploaded_file($images['tmp_name']) || $images['size']>100*1024*1024)throw new RuntimeException('ZIPを受信できません。展開した画像フォルダを選んでください。');
                $zip=new ZipArchive();if($zip->open($images['tmp_name'])!==true)throw new RuntimeException('ZIPを開けません。');
                if($zip->numFiles>2000)throw new RuntimeException('ZIP内のファイル数が多すぎます。');
                $total=0;
                for($i=0;$i<$zip->numFiles;$i++){
                    $info=$zip->statIndex($i);
                    if(!$info || !preg_match('/\.jpe?g$/i',$info['name']))continue;
                    $total+=$info['size'];
                    if($info['size']>5*1024*1024 || $total>200*1024*1024)throw new RuntimeException('展開後の画像サイズが上限を超えています。');
                    $files[]=['read'=>static function()use($zip,$i,$info):string{$bytes=$zip->getFromIndex($i,$info['size']+1);if($bytes===false)throw new RuntimeException('画像を読めません。');return $bytes;}];
                }
            } elseif($single && $single['error']===UPLOAD_ERR_OK && is_uploaded_file($single['tmp_name']) && $single['size']<=5*1024*1024){
                $files[]=['read'=>static fn():string=>(string)file_get_contents($single['tmp_name'])];
            } else throw new RuntimeException('元画像ZIP、または画像フォルダを選んでください。');
            try{$receipt=attachBattleImages($db,$files);}finally{if($zip)$zip->close();}
        } else {
        $path='/var/www/.nobunaga-battles/s4-20261004.json';
        $file=$_FILES['batch']??null;
        if($file && ($file['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_NO_FILE) {
            if(($file['error']??-1)!==UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name']))throw new RuntimeException('解析データを受信できませんでした。');
            $path=$file['tmp_name'];
        }
        $text=is_string($_POST['batch_json']??null)?trim($_POST['batch_json']):'';
        $batch=$text!==''?parseBattleBatch($text):readBattleBatch($path); $reader=null; $zip=null;
        $images=$_FILES['frames']??null;
        if($images && ($images['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_NO_FILE) {
            if(!class_exists('ZipArchive'))throw new RuntimeException('ZIP拡張がありません。画像はCLIから登録してください。');
            if(($images['error']??-1)!==UPLOAD_ERR_OK || !is_uploaded_file($images['tmp_name']) || $images['size']>100*1024*1024)throw new RuntimeException('画像ZIPを受信できませんでした（上限100MB）。');
            if(!hash_equals($batch['source_zip_sha256'],hash_file('sha256',$images['tmp_name'])))throw new RuntimeException('解析元のZIPと一致しません。');
            $zip=new ZipArchive(); if($zip->open($images['tmp_name'])!==true)throw new RuntimeException('ZIPを開けません。');
            $reader=static function(array $s) use($zip): string {
                // Read exact members; never extract paths into the web root.
                $name='frames/'.basename($s['filename']);
                $info=$zip->statName($name);
                if(!$info || $info['size']!==$s['bytes'])throw new RuntimeException('ZIP内の画像サイズが一致しません。');
                $data=$zip->getFromName($name,$s['bytes']+1);
                if($data===false)throw new RuntimeException('ZIP内の画像を読めません。');
                return $data;
            };
        }
        try {$receipt=importBattleBatch($db,$batch,$reader);} finally {if($zip)$zip->close();}
        }
    }
    $counts=$db->query("SELECT s.form_key,COUNT(DISTINCT s.id) AS records,COUNT(f.id) AS images FROM form_submissions s LEFT JOIN form_submission_files f ON f.submission_id=s.id WHERE s.form_key IN ('enemy_intel','battle_frame_source') AND s.status IN ('new','reviewed','archived') GROUP BY s.form_key")->fetchAll(PDO::FETCH_ASSOC);
} catch(Throwable $ex){$error=$ex instanceof PDOException?'DB処理に失敗しました。登録完了ではありません。':$ex->getMessage();}
if(($_POST['response']??'')==='json'){
    header('Content-Type: application/json; charset=utf-8');
    if($error!=='')http_response_code(400);
    echo json_encode(['ok'=>$error==='','error'=>$error,'receipt'=>$receipt],JSON_UNESCAPED_UNICODE);exit;
}
?>
<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>実測データ登録｜資料館</title><link rel="stylesheet" href="/assets/analysis-room.css?v=20260923-archive2"><link rel="stylesheet" href="/assets/battle-stats.css?v=20261005-4"><script src="/assets/battle-upload.js?v=20261005-1" defer></script></head><body><main><article class="archive-card archive-card-wide"><a href="/analysis-room/battles.php">敵勢力の解析へ戻る</a><h1>実測データの登録・補完</h1>
<?php if($error): ?><p role="alert"><?=e($error)?></p><?php endif; ?><?php if($receipt): ?><p role="status">DB登録完了：新規記録 <?=$receipt['new_records']?>件、補足更新 <?=$receipt['updated_records']?>件、画像参照 <?=$receipt['new_sources']?>件、画像本体 <?=$receipt['attached_images']?>枚。</p><?php endif; ?>
<h2>元画像を追加</h2><p>解析済みの元画像はZIPだけで追加できます。JSONは不要です。同じ画像は二重登録せず、登録済みの戦報と照合します。</p><p class="upload-note">ZIP送信上限：<?=e((string)ini_get('upload_max_filesize'))?> ／ 送信全体：<?=e((string)ini_get('post_max_size'))?>。大きいZIPは展開し、下の「画像フォルダ」を選ぶと1枚ずつ送信できます。</p>
<form method="post" enctype="multipart/form-data" id="original-upload"><input type="hidden" name="csrf" value="<?=e($_SESSION['battle_csrf'])?>"><input type="hidden" name="mode" value="images"><label>元画像ZIP<input type="file" name="frames" accept=".zip,application/zip"></label><button>ZIPの画像を追加</button></form>
<form id="folder-upload"><input type="hidden" name="csrf" value="<?=e($_SESSION['battle_csrf'])?>"><label>画像フォルダ<input type="file" name="folder" webkitdirectory multiple accept="image/jpeg"></label><button type="submit">フォルダの画像を追加</button><p role="status" id="upload-progress"></p></form>
<details><summary>解析結果の登録・補完</summary><p>同日時の重複をまとめて保存します。1〜2武将・日時不明も保管し、集計時に除外します。再実行時は不足分だけを補完します。</p><form method="post" enctype="multipart/form-data"><input type="hidden" name="csrf" value="<?=e($_SESSION['battle_csrf'])?>"><label>解析結果を直接登録（JSON）<textarea name="batch_json" rows="6" maxlength="10485760" spellcheck="false"></textarea></label><p>解析結果のテキストだけで登録できます。元画像は上の専用欄から追加できます。</p><label>解析済みJSON（10MB以下。未選択ならサーバーの非公開配置を使用）<input type="file" name="batch" accept=".json,application/json"></label><label>元画像ZIP（任意・100MB以下）<input type="file" name="frames" accept=".zip,application/zip"></label><p>ZIP未選択ならテキストと参照情報のみを登録します。画像は後から補完できます。</p><button>DBへ登録・不足分を補完</button></form></details><h2>実際のDB登録数</h2><?php foreach($counts as $c): ?><p><?=e($c['form_key'])?>：<?=$c['records']?>記録 / <?=$c['images']?>画像</p><?php endforeach; ?></article></main></body></html>

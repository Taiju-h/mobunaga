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
        if(!is_string($_POST['csrf'] ?? null) || !hash_equals($_SESSION['battle_csrf'],$_POST['csrf'])){http_response_code(403);throw new RuntimeException('画面を読み直してください。');}
        $path='/var/www/.nobunaga-battles/s4-20261004.json';
        $file=$_FILES['batch']??null;
        if($file && ($file['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_NO_FILE) {
            if(($file['error']??-1)!==UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name']))throw new RuntimeException('解析データを受信できませんでした。');
            $path=$file['tmp_name'];
        }
        $batch=readBattleBatch($path); $reader=null; $zip=null;
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
    $counts=$db->query("SELECT s.form_key,COUNT(DISTINCT s.id) AS records,COUNT(f.id) AS images FROM form_submissions s LEFT JOIN form_submission_files f ON f.submission_id=s.id WHERE s.form_key IN ('enemy_intel','battle_frame_source') AND s.status IN ('new','reviewed','archived') GROUP BY s.form_key")->fetchAll(PDO::FETCH_ASSOC);
} catch(Throwable $ex){$error=$ex instanceof PDOException?'DB処理に失敗しました。登録完了ではありません。':$ex->getMessage();}
?>
<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>実測データ登録｜資料館</title><link rel="stylesheet" href="/assets/analysis-room.css?v=20260923-archive2"><link rel="stylesheet" href="/assets/battle-stats.css?v=20261005-2"></head><body><main><article class="archive-card archive-card-wide"><a href="/analysis-room/battles.php">敵勢力の解析へ戻る</a><h1>実測データの登録・補完</h1>
<?php if($error): ?><p role="alert"><?=e($error)?></p><?php endif; ?><?php if($receipt): ?><p role="status">DB登録完了：新規記録 <?=$receipt['new_records']?>件、補足更新 <?=$receipt['updated_records']?>件、画像参照 <?=$receipt['new_sources']?>件、画像本体 <?=$receipt['attached_images']?>枚。</p><?php endif; ?>
<p>同日時の重複をまとめて保存します。1〜2武将・日時不明も保管し、集計時に除外します。再実行時は不足分だけを補完します。</p><form method="post" enctype="multipart/form-data"><input type="hidden" name="csrf" value="<?=e($_SESSION['battle_csrf'])?>"><label>解析済みJSON（10MB以下。未選択ならサーバーの非公開配置を使用）<input type="file" name="batch" accept=".json,application/json"></label><label>元画像ZIP（任意・100MB以下）<input type="file" name="frames" accept=".zip,application/zip"></label><p>ZIP未選択ならテキストと参照情報のみを登録します。画像は後から補完できます。</p><button>DBへ登録・不足分を補完</button></form><h2>実際のDB登録数</h2><?php foreach($counts as $c): ?><p><?=e($c['form_key'])?>：<?=$c['records']?>記録 / <?=$c['images']?>画像</p><?php endforeach; ?></article></main></body></html>

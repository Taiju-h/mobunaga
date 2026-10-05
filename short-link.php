<?php
declare(strict_types=1);
require __DIR__.'/includes/short-links.php';
header('Cache-Control: no-store');
$code=$_GET['code']??'';
if (!is_string($code) || !preg_match('/^[a-z][a-z0-9]{2,7}$/D',$code)) { http_response_code(404); exit('共有リンクが見つかりません。'); }
try {
    $db=shortLinkDb();
    $q=$db->prepare('SELECT target_url FROM short_links WHERE code=?');
    $q->execute([$code]);
    $target=$q->fetchColumn();
    if (!$target) { http_response_code(404); exit('共有リンクが見つかりません。'); }
    $target=shortLinkTarget('https://nobunaga.mobs.tokyo'.$target);
    header('Location: '.$target,true,302);
} catch (Throwable $e) { http_response_code(503); echo '共有リンクを開けませんでした。時間をおいてお試しください。'; }

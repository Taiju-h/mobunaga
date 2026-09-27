<?php
declare(strict_types=1);
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
function e(string $v): string { return htmlspecialchars($v, ENT_QUOTES|ENT_SUBSTITUTE, 'UTF-8'); }
function seasonNo($v): ?int { if(!is_scalar($v))return null;$m=[];if(!preg_match('/^(?:S)?(\d{1,2})$/i,trim((string)$v),$m))return null;$n=(int)$m[1];return $n>=1&&$n<=99?$n:null; }
$type = isset($_GET['type']) && is_string($_GET['type']) ? $_GET['type'] : '';
$id = isset($_GET['id']) && is_string($_GET['id']) ? $_GET['id'] : '';
if (!in_array($type,['general','tactic','formation'],true) || !preg_match('/^[a-z0-9_-]{1,120}$/',$id)) { http_response_code(404); exit('Not found'); }
// Keep existing shared links usable even if metadata generation fails.
$mainType = ['general'=>'generals','tactic'=>'tactics','formation'=>'formations'][$type];
$requestedSeason = seasonNo($_GET['season'] ?? null) ?? seasonNo($_COOKIE['mobunaga_season'] ?? null);
$fallbackUrl = '/?open='.rawurlencode($mainType).'&id='.rawurlencode($id)
    .($requestedSeason !== null ? '&season='.$requestedSeason : '').'#'.$mainType;
try {
$liveDb = __DIR__.'/assets/database.live.json';
$dbPath = is_readable($liveDb) ? $liveDb : __DIR__.'/assets/database.json';
$db = json_decode((string)file_get_contents($dbPath), true);
$row = null; $title=''; $description=''; $image=''; $kindLabel=''; $requiredSeason=1;
if ($type==='general') {
  foreach (($db['generals']??[]) as $r) if (($r['id']??'')===$id) { $row=$r; break; }
  if ($row) { $title=(string)$row['name']; $kindLabel='武将録'; $description=$title.'の能力・固有戦法・特性・採用編成を確認。'; $image=(string)($row['portrait']??'');$ss=[];foreach(($row['tiers']??[]) as $t){$n=seasonNo($t['season']??null);if($n)$ss[]=$n;}if($ss)$requiredSeason=min($ss); }
} elseif ($type==='tactic') {
  foreach (($db['tactics']??[]) as $r) if (($r['id']??'')===$id) { $row=$r; break; }
  if ($row) { $title=(string)$row['name']; $kindLabel='戦法録'; $description=(string)($row['effect']??($title.'の戦法データ')); $requiredSeason=seasonNo($row['first_season']??null)??1; }
} else {
  $forms=json_decode((string)file_get_contents(__DIR__.'/assets/formations.json'),true);
  foreach (($forms['formations']??[]) as $r) if (($r['id']??'')===$id) { $row=$r; break; }
  if ($row) { $requiredSeason=(int)($row['season']??1); $title=(string)($row['name']??$id); $kindLabel='編成指南'; $description='S'.$requiredSeason.' '.$title.'の編成・戦法・能力振りを確認。'; $first=$row['members'][0]['general_id']??''; foreach(($db['generals']??[]) as $g) if(($g['id']??'')===$first){$image=(string)($g['portrait']??'');break;} }
}
if (!$row) { http_response_code(404); exit('Not found'); }
$viewerSeason=seasonNo($_GET['season']??null)??seasonNo($_COOKIE['mobunaga_season']??null);
$allowed=$viewerSeason!==null && $viewerSeason >= $requiredSeason;
$origin = (strtolower((string)($_SERVER['HTTP_HOST'] ?? '')) === 'test.nobunaga.mobs.tokyo') ? 'https://test.nobunaga.mobs.tokyo' : 'https://nobunaga.mobs.tokyo';
$canonical=$origin.'/share.php?type='.rawurlencode($type).'&id='.rawurlencode($id).($viewerSeason?'&season='.$viewerSeason:'');
$mainType=['general'=>'generals','tactic'=>'tactics','formation'=>'formations'][$type];
$mainUrl=$origin.'/?open='.rawurlencode($mainType).'&id='.rawurlencode($id).'&season='.(int)$viewerSeason.'#'.$mainType;
$ogImage=$allowed&&$image!==''?$origin.'/'.ltrim($image,'/'):$origin.'/assets/mobunaga.png';
$pageTitle=$allowed?$title:'シーズン確認｜モブナガ';$pageDesc=$allowed?$description:'選択中のシーズンより先の情報は表示しません。';
?><!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?=e($pageTitle)?>｜モブナガ</title><meta name="description" content="<?=e($pageDesc)?>"><link rel="canonical" href="<?=e($canonical)?>"><meta property="og:type" content="article"><meta property="og:title" content="<?=e($pageTitle)?>｜モブナガ"><meta property="og:description" content="<?=e($pageDesc)?>"><meta property="og:url" content="<?=e($canonical)?>"><meta property="og:image" content="<?=e($ogImage)?>"><meta name="twitter:card" content="summary_large_image"><script async src="https://www.googletagmanager.com/gtag/js?id=G-C7QV2JBGPY"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-C7QV2JBGPY');</script><style>body{margin:0;background:#e9e1c9;color:#28312f;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}.wrap{max-width:900px;margin:auto;padding:24px}.card{position:relative;background:#fffdf6;border:1px solid #b9ad8b;border-radius:16px;padding:24px;box-shadow:0 8px 30px #0001}.eyebrow{font-size:13px;color:#766947;font-weight:700}.hero{display:flex;gap:20px;align-items:center}.hero img{width:110px;height:110px;object-fit:cover;object-position:50% 22%;border-radius:20px}.hero h1{margin:0;font-size:32px}.desc{font-size:17px;line-height:1.8}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}.actions a{border:0;border-radius:9px;padding:12px 18px;background:#175b72;color:#fff;text-decoration:none;font-weight:800}.share-icon{position:absolute;top:16px;right:16px;width:42px;height:42px;border:1px solid #b9ad8b;border-radius:10px;background:#fffaf0;color:#6c5928;display:grid;place-items:center;cursor:pointer;box-shadow:0 2px 8px #0001}.share-icon svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8}.share-icon.copied{background:#e6f2e8;color:#27613a}.season-form{display:flex;gap:10px;align-items:end;flex-wrap:wrap}.season-form label{display:grid;gap:6px;font-weight:800}.season-form select{height:44px;padding:0 12px;border:1px solid #aaa083;border-radius:8px;background:#fff}.locked{padding:18px;background:#f3f0e7;border-radius:12px;line-height:1.8}@media(max-width:600px){.wrap{padding:14px}.card{padding:18px}.hero h1{font-size:25px}.hero img{width:84px;height:84px}.share-icon{top:10px;right:10px}}</style></head><body><main class="wrap"><article class="card"><?php if($viewerSeason===null):?><p class="eyebrow">ネタバレ防止</p><h1>あなたのシーズンは？</h1><p class="desc">共有された資料を開く前に現在のシーズンを選んでください。先のシーズンの内容は表示しません。</p><form class="season-form" method="get"><input type="hidden" name="type" value="<?=e($type)?>"><input type="hidden" name="id" value="<?=e($id)?>"><label>現在のシーズン<select name="season"><?php for($s=1;$s<=4;$s++):?><option value="<?=$s?>">S<?=$s?></option><?php endfor;?></select></label><button>このシーズンで開く</button></form><?php elseif(!$allowed):?><p class="eyebrow">ネタバレ防止 ／ S<?=$viewerSeason?></p><h1>この資料はまだ表示しません</h1><div class="locked">この資料はS<?=$requiredSeason?>以降の内容です。現在選択中のS<?=$viewerSeason?>では、武将名・戦法名・編成内容を伏せています。</div><div class="actions"><a href="/">S<?=$viewerSeason?>のモブナガへ戻る</a></div><?php else:?><button id="share" class="share-icon" type="button" title="共有" aria-label="このページを共有"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8 15.8 6.2M8.2 13.2l7.6 4.6"/></svg></button><p class="eyebrow"><?=e($kindLabel)?> ／ S<?=$requiredSeason?>から ／ モブナガの軍議戦略サイト</p><div class="hero"><?php if($image!==''):?><img src="/<?=e(ltrim($image,'/'))?>" alt=""><?php endif;?><div><h1><?=e($title)?></h1><p class="desc"><?=e($description)?></p></div></div><div class="actions"><a id="open-detail" href="<?=e($mainUrl)?>">サイトで詳しく見る</a></div><?php endif;?></article></main><?php if($allowed):?><script src="/assets/share-page.js?v=20260927-share3" defer></script><?php endif;?></body></html>
<?php
} catch (Throwable $error) {
    error_log('Mobunaga share metadata failed: '.$error->getMessage());
    if (!headers_sent()) {
        header('Location: '.$fallbackUrl, true, 302);
        exit;
    }
    echo '<p><a href="'.e($fallbackUrl).'">詳細を開く</a></p>';
}

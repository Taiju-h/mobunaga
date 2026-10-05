<?php
declare(strict_types=1);
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header("Content-Security-Policy: default-src 'self'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
require_once __DIR__.'/../includes/analysis-session.php';
mobunagaRequireLogin();
define('MOBUNAGA_ANALYSIS_ROOM',true);
require __DIR__.'/../includes/enemy-directory.php';
require __DIR__.'/../includes/battle-import.php';
function e(string $v): string { return htmlspecialchars($v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8'); }
function queryText(string $key): string { return is_string($_GET[$key] ?? null) ? trim($_GET[$key]) : ''; }
function battleLink(array $replace=[]): string {
    global $season,$q,$general,$sort,$min,$side,$exact;
    return '?'.http_build_query(array_replace(['season'=>$season,'q'=>$q,'general'=>$general,'sort'=>$sort,'min'=>$min,'side'=>$side,'exact'=>$exact?'1':'0'],$replace));
}
function lineup(array $names): string { return implode('・',array_map(fn($n)=>$n ?? '空き',$names)); }
$season=queryText('season'); if(!in_array($season,['S1','S2','S3','S4'],true))$season='S4';
$q=queryText('q'); $general=queryText('general'); $exact=queryText('exact')==='1';
$sort=queryText('sort')==='rate'?'rate':'wins'; $min=max(1,min(100,(int)queryText('min')));
$side=queryText('side')==='ours'?'ours':'enemy';
$error=''; $all=[]; $sources=[];
try {
    $db=battleDb(); $all=loadBattleRecords($db);
    $sources=$db->query("SELECT s.id,s.payload_json,f.id AS file_id FROM form_submissions s LEFT JOIN form_submission_files f ON f.submission_id=s.id WHERE s.form_key='battle_frame_source' AND s.status IN ('new','reviewed','archived') ORDER BY s.id,f.id")->fetchAll(PDO::FETCH_ASSOC);
} catch(Throwable $ex) { $error='DBの記録を読み込めませんでした。集計値は表示していません。'; }
$records=battleFilter($all,$season,$q,$general,$exact);
$stats=battleStatistics($records,$season); $whole=battleStatistics($all,$season);
$players=array_values(array_filter($stats['players'],fn($p)=>$p['battles'] >= $min));
if($sort==='rate')usort($players,fn($a,$b)=>($b['win_rate']<=>$a['win_rate']) ?: ($b['battles']<=>$a['battles']) ?: strcmp($a['name'],$b['name']));
$examples=battleLossExamples($records,$side==='enemy');
$page=max(1,min(max(1,(int)ceil(count($examples)/12)),(int)queryText('page')));
$sourceMap=[]; $selected=null;
foreach($sources as $s) {
    $p=json_decode($s['payload_json'],true,512,JSON_THROW_ON_ERROR);
    $sourceMap[$p['batch_id'].'|'.$p['source']['frame']]=['id'=>(int)$s['id'],'file_id'=>$s['file_id']];
    if((int)$s['id']===(int)queryText('source') && ($p['season'] ?? '')===$season)$selected=$s+['payload'=>$p];
}
?>
<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>敵勢力の解析｜分析班資料館</title><link rel="stylesheet" href="/assets/analysis-room.css?v=20260923-archive2"><link rel="stylesheet" href="/assets/battle-stats.css?v=20261005-2"></head>
<body><header class="archive-header"><a href="/analysis-room/index.php">← 分析班資料館</a><a href="/">軍議の間へ</a></header><main><article class="archive-card archive-card-wide">
<p class="eyebrow">分析班資料館 / <?=e($season)?> 実測</p><h1>敵勢力の解析</h1><p class="description">誰が、どの編成を使い、何に負けたか。記録された対戦から確認します。</p>
<?php if($error): ?><p role="alert"><?=e($error)?></p><?php else: ?>
<form method="get" class="battle-search" role="search"><label>敵プレイヤー名<input type="search" name="q" value="<?=e($q)?>" placeholder="部分一致・表記ゆれで検索"></label><label>敵武将<select name="general"><option value="">すべて</option><?php foreach($whole['generals'] as $name=>$n): ?><option<?=$general===$name?' selected':''?>><?=e($name)?></option><?php endforeach; ?></select></label><label>シーズン<select name="season"><?php foreach(['S1','S2','S3','S4'] as $s): ?><option<?=$season===$s?' selected':''?>><?=$s?></option><?php endforeach; ?></select></label><button>絞り込む</button><a href="?season=<?=e($season)?>">解除</a></form>
<?php if($exact && $q!==''): ?><p>「<?=e($q)?>」本人の記録を表示中。<a href="<?=e(battleLink(['exact'=>'0']))?>">似た名前も探す</a></p><?php endif; ?>
<div class="metrics"><div><strong><?=$stats['eligible']?></strong><span>集計対象の対戦</span></div><div><strong><?=count($stats['players'])?></strong><span>敵プレイヤー</span></div><div><strong><?=$stats['incomplete']?></strong><span>人数不足などで集計除外</span></div><div><strong><?=$stats['undated']?></strong><span>日時不明の補足</span></div></div>
<p class="muted">同日時は1件、双方3武将の対戦のみ集計。勝率＝敵の勝利数÷全対戦数（引分を含む）。この実測記録内の割合であり、全戦闘の成績ではありません。</p>
<?php if(!$records): ?><p class="empty">該当する登録記録がありません。<?php if(!$all): ?>解析データはまだ本番DBに投入されていません。<?php endif; ?></p><?php endif; ?>
<nav class="section-links"><a href="#generals">武将の採用割合</a><a href="#players">敵の勝率</a><a href="#examples">負け事例</a><a href="#history">全記録</a></nav>
<section id="generals"><h2>敵武将の採用割合</h2><p>対象対戦の何％にその武将がいたかを表示します。1編成3名のため合計は100％になりません。</p><div class="general-bars"><?php foreach($stats['generals'] as $name=>$count): $rate=$stats['eligible']?100*$count/$stats['eligible']:0; ?><a class="general-bar" href="<?=e(battleLink(['general'=>$name,'page'=>1]))?>"><strong><?=e($name)?></strong><meter min="0" max="100" value="<?=round($rate,2)?>" aria-label="<?=e($name)?>の採用割合"></meter><span><?=number_format($rate,1)?>% <small><?=$count?>件</small></span></a><?php endforeach; ?></div></section>
<section id="players"><h2>敵プレイヤーの勝率・勝利数</h2><form method="get" class="ranking-controls"><input type="hidden" name="q" value="<?=e($q)?>"><input type="hidden" name="exact" value="<?=$exact?'1':'0'?>"><input type="hidden" name="general" value="<?=e($general)?>"><input type="hidden" name="season" value="<?=e($season)?>"><label>並び順<select name="sort"><option value="wins"<?=$sort==='wins'?' selected':''?>>勝利数</option><option value="rate"<?=$sort==='rate'?' selected':''?>>勝率</option></select></label><label>最低対戦数<input type="number" name="min" min="1" max="100" value="<?=$min?>"></label><button>並べ替え</button></form><p class="muted">最低対戦数はランキングだけに適用。少数の対戦による高勝率には注意してください。名前を押すと本人の編成と負け事例へ絞り込みます。</p><div class="table-scroll"><table><thead><tr><th>敵プレイヤー</th><th>勝率</th><th>勝</th><th>敗</th><th>分</th><th>対戦数</th></tr></thead><tbody><?php foreach($players as $p): ?><tr><td><a href="<?=e(battleLink(['q'=>$p['name'],'exact'=>'1','min'=>1,'page'=>1]))?>"><?=e($p['name'])?></a></td><td><strong><?=number_format($p['win_rate'],1)?>%</strong></td><td><?=$p['wins']?></td><td><?=$p['losses']?></td><td><?=$p['draws']?></td><td><?=$p['battles']?></td></tr><?php endforeach; ?></tbody></table></div></section>
<section id="examples"><h2>負けた対戦の具体例</h2><nav class="section-links"><a href="<?=e(battleLink(['side'=>'enemy','page'=>1]))?>#examples"<?=$side==='enemy'?' aria-current="page"':''?>>敵が負けた事例</a><a href="<?=e(battleLink(['side'=>'ours','page'=>1]))?>#examples"<?=$side==='ours'?' aria-current="page"':''?>>八雲側が負けた事例</a></nav><p><?=($side==='enemy'?'敵が負けた':'八雲側が負けた')?>対戦 <?=count($examples)?>件。編成と実測結果を紹介します。戦法・兵力差を未検証のため、敗因や有利相性は断定しません。</p><div class="case-grid"><?php foreach(array_slice($examples,($page-1)*12,12) as $r): ?><article class="battle-case"><p class="case-date"><?=e($r['battle_at'])?></p><h3><?=e($r['enemy_name'])?> <span class="badge"><?=$side==='enemy'?'敗北':'勝利'?></span></h3><dl><dt>敵の編成</dt><dd><?=e(lineup($r['enemy_generals']))?></dd><dt>八雲側：<?=e($r['own_name'])?></dt><dd><?=e(lineup($r['own_generals']))?></dd></dl><p><?=e($side==='enemy'?$r['own_name'].'の編成が勝利した記録です。':$r['enemy_name'].'の編成に敗れた記録です。')?></p><div class="case-sources"><?php foreach($r['sources'] as $ref): $source=$sourceMap[$r['batch_id'].'|'.$ref['frame']]??null; if($source): ?><a href="<?=e(battleLink(['source'=>$source['id']]))?>#evidence">画像<?=$ref['frame']?>の記録</a><?php endif; endforeach; ?></div></article><?php endforeach; ?></div><?php if(!$examples): ?><p>この条件で確認済みの負け事例はありません。</p><?php endif; ?><nav class="pagination"><?php if($page>1): ?><a href="<?=e(battleLink(['page'=>$page-1]))?>#examples">前へ</a><?php endif; ?><span><?=$page?> / <?=max(1,(int)ceil(count($examples)/12))?></span><?php if($page*12<count($examples)): ?><a href="<?=e(battleLink(['page'=>$page+1]))?>#examples">次へ</a><?php endif; ?></nav></section>
<details id="history"><summary>検索条件に一致する全記録（<?=count($records)?>件）</summary><p>1〜2武将の記録・日時不明の補足も保存しています。以下の勝敗は八雲側です。</p><?php foreach($records as $r): ?><details><summary><?=e(($r['battle_at']?:'日時不明').' / '.$r['enemy_name'].' / 八雲側'.$r['result'])?></summary><?php foreach($r['battle_variants'] as $v): ?><p><?=e($v['own_name'].'：'.lineup($v['own_generals']).' 対 '.$v['enemy_name'].'：'.lineup($v['enemy_generals']))?>（八雲側<?=e($v['result'])?>）</p><?php endforeach; ?></details><?php endforeach; ?></details>
<?php if($selected): $p=$selected['payload']; ?><section id="evidence"><h2>根拠画像と読取原文</h2><h3><?=e($p['source']['filename'])?></h3><?php if($selected['file_id']): ?><a href="intel-image.php?id=<?=(int)$selected['file_id']?>"><img class="evidence-image" src="intel-image.php?id=<?=(int)$selected['file_id']?>" alt="対戦記録の原画像"></a><?php else: ?><p>画像本体は未登録です。</p><?php endif; ?><details><summary>OCR原文（未検証）</summary><pre><?=e($p['source']['ocr_text'])?></pre></details></section><?php endif; ?>
<?php endif; ?><p class="maintenance"><a href="/admin/battle-import.php">記録の登録・補完</a></p></article></main></body></html>

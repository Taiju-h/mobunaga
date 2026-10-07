<?php
declare(strict_types=1);
define('MOBUNAGA_ANALYSIS_ROOM',true);
require __DIR__.'/../includes/battle-import.php';
require __DIR__.'/../includes/battle-analytics.php';
require __DIR__.'/../includes/enemy-directory.php';
require __DIR__.'/../includes/battle-charts.php';
require __DIR__.'/../includes/battle-limit-break-observations-20261007.php';
function check(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);}
function e(string $s):string{return htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
function battleLink(array $v=[]):string{return '?'.http_build_query($v);}
$share=battleTopShares(['a'=>70,'b'=>60,'c'=>50,'d'=>40,'e'=>30,'f'=>20,'g'=>10,'h'=>5,'empty'=>0]);
check($share['total']===285 && count($share['slices'])===7,'Top six/other population wrong');
check($share['slices'][6]['name']==='その他' && $share['slices'][6]['count']===15,'Other must sum all remaining categories');
check(abs(array_sum(array_column($share['slices'],'percent'))-100)<0.000001,'Shares must total 100%');
check(battleTopShares([])===['total'=>0,'slices'=>[]],'Empty pie created');
check(count(battleTopShares(['a'=>1])['slices'])===1,'Single-slice chart broken');
$r=['season'=>'S4','battle_at'=>null,'own_name'=>'味方テスト','enemy_name'=>'敵テスト','result'=>'勝利',
'own_generals'=>['武田信玄','山本勘助','馬場信春'],'enemy_generals'=>['北条氏康','立花道雪','立花誾千代'],
'enemy_troop'=>'弓','own_tactics'=>[['戦法甲','回復甲'],['戦法甲'],[]],'enemy_tactics'=>[['戦法甲'],['回復甲'],[]],
'own_tactic_metrics'=>[
 ['general_index'=>0,'slot'=>0,'name'=>'戦法甲','damage'=>100,'healing'=>0],
 ['general_index'=>0,'slot'=>1,'name'=>'回復甲','damage'=>0,'healing'=>400],
 ['general_index'=>1,'slot'=>0,'name'=>'戦法甲','damage'=>0,'healing'=>0]],
'enemy_tactic_metrics'=>[
 ['general_index'=>0,'slot'=>0,'name'=>'戦法甲','damage'=>300,'healing'=>0],
 ['general_index'=>1,'slot'=>0,'name'=>'回復甲','damage'=>null,'healing'=>200]],
 'tactic_metrics_review'=>'visual_damage_healing_review'];
$unverified=$r;unset($unverified['tactic_metrics_review']);
$purple=$r;$purple['enemy_generals'][0]='坂井政尚';
$partial=$r;$partial['own_generals'][2]=null;
$s=battleTacticStatistics([$r,$r,$unverified,$purple,$partial]);
check($s['reports']===1 && $s['undated']===1 && $s['unread']===1,'Detail duplicate/eligibility handling failed');
$damage=battleTacticRanking($s,'damage');$heal=battleTacticRanking($s,'healing');
check($damage[0]['damage']===400 && $damage[0]['damage_samples']===3,'Both armies must contribute including zero');
check(abs($damage[0]['damage_average']-400/3)<0.0001,'Average denominator wrong');
check($heal[0]['healing']===600 && $heal[0]['healing_samples']===2,'Healing totals wrong');
check($heal[0]['damage_samples']===1,'Unread was treated as zero');
check(battleTacticRanking($s,'damage','total',4)===[],'Minimum sample filter ignored');
$rankStats=['tactics'=>[
 ['name'=>'多用','damage'=>1000,'damage_samples'=>10,'damage_average'=>100],
 ['name'=>'高平均','damage'=>600,'damage_samples'=>2,'damage_average'=>300]]];
check(battleTacticRanking($rankStats,'damage','total')[0]['name']==='多用','Total order broken');
check(battleTacticRanking($rankStats,'damage','average')[0]['name']==='高平均','Average order broken');
$root=$r;$root['battle_variants']=['detail'=>$r];
check(battleTacticStatistics(battleMetricObservations([$root]))['reports']===1,'Root and variant counted twice');
check(battleTacticStatistics(battleFilter(battleMetricObservations([$root]),'S3','',''))['reports']===0,'Season filter leaked');
check(battleTacticStatistics(battleFilter(battleMetricObservations([$root]),'S4','','',false,'槍'))['reports']===0,'Troop filter leaked');
$dirty=$r;$dirty['own_tactic_metrics'][]=$dirty['own_tactic_metrics'][0];$dirty['own_tactic_metrics'][]=['general_index'=>2,'slot'=>0,'name'=>'偽戦法','damage'=>9999,'healing'=>9999];
check(battleTacticRanking(battleTacticStatistics([$dirty]),'damage')[0]['damage']===400,'Unmatched equipment/duplicate slot admitted');
$html=battleDonut('test','兵種',['弓'=>3,'槍'=>1],'対戦','troop','note');
check(str_contains($html,'75.0%') && str_contains($html,'pathLength="100"') && str_contains($html,'role="img"'),'Chart does not expose exact/accessible shares');
$html=battleDonut('safe','<script>',['<script>'=>1],'枠','general','note');
check(!str_contains($html,'<script>'),'Chart label not escaped');
$dated=$r;$dated['battle_at']='2026-10-04 12:00:00';$unknown=$dated;$unknown['battle_at']='2026-10-04 13:00:00';unset($unknown['enemy_troop']);
$counts=battleStatistics([$dated,$unknown],'S4');check($counts['troops']===['弓'=>1] && $counts['unknown_troop']===1 && battleTopShares($counts['troops'])['total']===1,'Unknown troops must be excluded from troop denominator');
$lbA=$dated;$lbA['own_name']='闇の土鬼';$lbA['enemy_name']='敵A';$lbA['own_limit_breaks']=[5,4,3];$lbA['enemy_limit_breaks']=[5,5,5];$lbA['limit_breaks_review']='visual_limit_break_review';
$lbB=$lbA;$lbB['battle_at']='2026-10-04 12:10:00';$lbB['own_limit_breaks']=[5,5,5];$lbB['enemy_limit_breaks']=[1,2,3];
$lbBad=$lbA;$lbBad['battle_at']='2026-10-04 12:20:00';unset($lbBad['limit_breaks_review']);
$lbStats=battleLimitBreakStatistics([$lbA,$lbB,$lbBad],'S4');
$me=array_values(array_filter($lbStats['rows'],fn($x)=>$x['side']==='own'&&$x['name']==='闇の土鬼'))[0];
check($me['samples']===2 && abs($me['average']-13.5)<0.0001 && $me['max']===15 && $me['min']===12,'Own limit-break aggregation failed');
check(abs($lbStats['side_averages']['enemy']-10.5)<0.0001 && $lbStats['reviewed']===4,'Enemy/side limit-break average failed');
check(battleReviewedLimitBreakTotal($lbBad,'own')===null,'Unreviewed limit-break data was counted');
$lbZero=['limit_break_observation_id'=>'zero','season'=>'S4','limit_breaks_only'=>true,'own_name'=>'闇の土鬼','own_limit_break_total'=>0,'limit_breaks_review'=>'visual_limit_break_review'];
$lbManual=['limit_break_observation_id'=>'manual','season'=>'S4','limit_breaks_only'=>true,'own_name'=>'味方B','enemy_name'=>'敵B','own_limit_breaks'=>[1,2,3],'enemy_limit_breaks'=>[0,0,0],'limit_breaks_review'=>'visual_limit_break_review'];
$lbCombined=battleLimitBreakStatistics([$lbZero,$lbManual],'S4');
$zeroRows=array_values(array_filter($lbCombined['rows'],fn($x)=>$x['name']==='闇の土鬼'));
check(count($zeroRows)===1 && $zeroRows[0]['average']===0.0,'Reviewed zero-convex player disappeared');
check($lbCombined['side_sums']['own']===6 && $lbCombined['side_sums']['enemy']===0,'Side convex totals are wrong');
$fullRoster=battleLimitBreakStatistics(battleReviewedLimitBreakObservations20261007(),'S4');
check($fullRoster['side_sums']['own']===145,'Reviewed video roster own total must be 145');
check($fullRoster['side_sums']['enemy']===140,'Reviewed video roster enemy total must be 140');
check(count(array_filter($fullRoster['rows'],fn($x)=>$x['side']==='own'&&$x['average']>0))===27,'Reviewed own roster count must be 27');
check(count(array_filter($fullRoster['rows'],fn($x)=>$x['side']==='enemy'&&$x['average']>0))===26,'Reviewed enemy positive roster count must be 26');
echo "battle-analytics: shares, tactics, limit-breaks, dedup, eligibility, filters and accessible escaped chart PASS\n";

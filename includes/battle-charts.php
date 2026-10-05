<?php
declare(strict_types=1);
if (!defined('MOBUNAGA_ANALYSIS_ROOM')) { http_response_code(404); exit; }

function battleDonut(string $id, string $title, array $counts, string $unit, string $filter, string $note): string
{
    $chart=battleTopShares($counts); $total=$chart['total'];
    $html='<figure class="battle-donut"><figcaption id="'.e($id).'-title">'.e($title).'</figcaption>';
    if(!$total)return $html.'<p class="empty">この条件の集計対象はありません。</p></figure>';
    $html.='<svg class="donut-svg" viewBox="0 0 200 200" role="img" aria-labelledby="'.e($id).'-title '.e($id).'-desc"><desc id="'.e($id).'-desc">'.e(implode('、',array_map(fn($s)=>$s['name'].' '.number_format($s['percent'],1).'%',$chart['slices']))).'</desc>';
    $html.='<circle class="donut-track" cx="100" cy="100" r="74" fill="none" stroke-width="26"/>';
    $offset=0;
    foreach($chart['slices'] as $i=>$slice){
        $color=$slice['other']?6:$i; $n=number_format($slice['percent'],6,'.',''); $rest=number_format(100-$slice['percent'],6,'.','');
        $html.='<circle class="donut-segment slice-'.$color.'" cx="100" cy="100" r="74" fill="none" stroke-width="26" pathLength="100" stroke-dasharray="'.$n.' '.$rest.'" stroke-dashoffset="'.number_format(-$offset,6,'.','').'" transform="rotate(-90 100 100)"><title>'.e($slice['name'].' '.number_format($slice['percent'],1).'%').'</title></circle>';
        $offset+=$slice['percent'];
    }
    $html.='<text class="donut-number" x="100" y="97" text-anchor="middle">'.number_format($total).'</text><text class="donut-unit" x="100" y="120" text-anchor="middle">'.e($unit).'</text></svg><ul class="donut-legend">';
    foreach($chart['slices'] as $i=>$slice){
        $color=$slice['other']?6:$i;
        $html.='<li><span class="legend-dot slice-'.$color.'" aria-hidden="true"></span>';
        if(!$slice['other'] && $slice['name']!=='未確認')$html.='<a href="'.e(battleLink([$filter=>$slice['name'],'page'=>1,'detail_page'=>1])).'">'.e($slice['name']).'</a>';
        else $html.='<span>'.e($slice['name']).'</span>';
        $html.='<strong>'.number_format($slice['percent'],1).'%</strong><small>'.number_format($slice['count']).$unit.'</small></li>';
    }
    return $html.'</ul><p class="muted">'.e($note).'</p></figure>';
}

function battleTacticTable(array $rows,string $metric,string $order,int $offset=0): string
{
    if(!$rows)return '<p class="empty">この条件で確認できた'.($metric==='damage'?'与ダメージ':'回復量').'はありません。</p>';
    $label=$metric==='damage'?'与ダメージ':'回復量';
    $field=$order==='average'?$metric.'_average':$metric; $max=max(array_column($rows,$field));
    $html='<div class="table-scroll"><table class="tactic-ranking"><thead><tr><th scope="col">順位・戦法</th><th scope="col">'.$label.'合計</th><th scope="col">1採用あたり</th><th scope="col">確認枠数</th></tr></thead><tbody>';
    foreach($rows as $i=>$r){
        $html.='<tr><th scope="row"><span class="rank-index">'.($offset+$i+1).'</span> '.e($r['name']).'<meter class="tactic-meter" min="0" max="'.e((string)$max).'" value="'.e((string)$r[$field]).'" aria-label="'.e($r['name'].'の'.$label.($order==='average'?'平均':'合計')).'"></meter></th><td>'.number_format($r[$metric]).'</td><td>'.number_format($r[$metric.'_average'],1).'</td><td>'.$r[$metric.'_samples'].'</td></tr>';
    }
    return $html.'</tbody></table></div>';
}

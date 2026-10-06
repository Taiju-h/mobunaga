<?php
declare(strict_types=1);
if (!defined('MOBUNAGA_ANALYSIS_ROOM')) { http_response_code(404); exit; }

/** At most six named slices; the remainder is a real sum, not a rounded residual. */
function battleTopShares(array $counts, int $limit = 6): array
{
    $counts=array_filter($counts,fn($n)=>is_int($n) && $n>0);
    uksort($counts,fn($a,$b)=>($counts[$b]<=>$counts[$a]) ?: strcmp((string)$a,(string)$b));
    $total=array_sum($counts); $slices=[]; $other=0;
    foreach($counts as $name=>$count) {
        if(count($slices)<$limit)$slices[]=['name'=>(string)$name,'count'=>$count,'other'=>false];
        else $other+=$count;
    }
    if($other>0)$slices[]=['name'=>'その他','count'=>$other,'other'=>true];
    foreach($slices as &$slice)$slice['percent']=100*$slice['count']/$total;
    unset($slice);
    return ['total'=>$total,'slices'=>$slices];
}

/** Include enriched detail variants as well as root records; aggregation deduplicates them. */
function battleMetricObservations(array $records): array
{
    $result=[];
    foreach($records as $r)foreach(array_merge([$r],array_values($r['battle_variants']??[])) as $v) {
        if(($v['tactic_metrics_review']??'')==='visual_damage_healing_review')$result[]=$v;
    }
    return $result;
}

/** Equipment totals shown on the report, combined across both armies. Missing is not zero. */
function battleTacticStatistics(array $observations): array
{
    $seen=[]; $tactics=[]; $reports=0; $undated=0; $unread=0;
    foreach($observations as $r) {
        if(($r['tactic_metrics_review']??'')!=='visual_damage_healing_review' || !battleIsGoldTeam($r))continue;
        $identity=[];
        foreach(['season','battle_at','own_name','enemy_name','result','own_generals','enemy_generals','own_tactic_metrics','enemy_tactic_metrics'] as $field)$identity[$field]=$r[$field]??null;
        $key=hash('sha256',battleJson($identity));
        if(isset($seen[$key]))continue;
        $seen[$key]=true; $reports++; if(battleDateKey($r)===null)$undated++;
        foreach(['own','enemy'] as $side) {
            $slots=[];
            foreach(($r[$side.'_tactic_metrics']??[]) as $m) {
                $i=$m['general_index']??null; $slot=$m['slot']??null; $name=$m['name']??null;
                if(!is_int($i) || $i<0 || $i>2 || !is_int($slot) || $slot<0 || $slot>2 || !is_string($name) || $name==='' || $name==='通常攻撃')continue;
                if(($r[$side.'_tactics'][$i][$slot]??null)!==$name || isset($slots[$i.'|'.$slot]))continue;
                $slots[$i.'|'.$slot]=true;
                if(!isset($tactics[$name]))$tactics[$name]=['name'=>$name,'adoptions'=>0,'damage'=>0,'healing'=>0,'damage_samples'=>0,'healing_samples'=>0];
                $tactics[$name]['adoptions']++;
                foreach(['damage','healing'] as $metric) {
                    $value=$m[$metric]??null;
                    if(!is_int($value) || $value<0){$unread++;continue;}
                    $tactics[$name][$metric]+=$value; $tactics[$name][$metric.'_samples']++;
                }
            }
        }
    }
    foreach($tactics as &$t)foreach(['damage','healing'] as $metric)$t[$metric.'_average']=$t[$metric.'_samples']?$t[$metric]/$t[$metric.'_samples']:null;
    unset($t);
    return ['reports'=>$reports,'undated'=>$undated,'unread'=>$unread,'tactics'=>array_values($tactics)];
}


function battleReviewedLimitBreakTotal(array $record, string $side): ?int
{
    if (($record['limit_breaks_review'] ?? '') !== 'visual_limit_break_review') return null;
    $values=$record[$side.'_limit_breaks']??null;
    if(is_array($values) && count($values)===3){
        $sum=0;
        foreach($values as $value){
            if(!is_int($value) || $value<0 || $value>5)return null;
            $sum+=$value;
        }
        return $sum;
    }
    $total=$record[$side.'_limit_break_total']??null;
    return is_int($total) && $total>=0 && $total<=15 ? $total : null;
}

/** Reviewed three-general limit-break totals, separated into our side and opponents. */
function battleLimitBreakStatistics(array $records, string $season): array
{
    $seen=[]; $players=[]; $sideTotals=['own'=>[],'enemy'=>[]]; $unknown=0;
    foreach($records as $record){
        if(($record['season']??'')!==$season)continue;
        $key=battleDateKey($record);
        if($key===null){
            $manual=$record['limit_break_observation_id']??null;
            if(!is_string($manual) || $manual==='')continue;
            $key='limit-break|'.$manual;
        }
        if(isset($seen[$key]))continue;
        $seen[$key]=true;
        if(empty($record['limit_breaks_only']) && !battleIsGoldTeam($record))continue;
        foreach(['own','enemy'] as $side){
            $name=$record[$side.'_name']??'';
            if(!is_string($name) || $name==='')continue;
            $total=battleReviewedLimitBreakTotal($record,$side);
            $playerKey=$side.'|'.$name;
            if(!isset($players[$playerKey]))$players[$playerKey]=[
                'side'=>$side,'name'=>$name,'samples'=>0,'sum'=>0,'average'=>null,
                'per_general'=>null,'min'=>null,'max'=>null
            ];
            if($total===null){$unknown++;continue;}
            $players[$playerKey]['samples']++;
            $players[$playerKey]['sum']+=$total;
            $players[$playerKey]['min']=$players[$playerKey]['min']===null?$total:min($players[$playerKey]['min'],$total);
            $players[$playerKey]['max']=$players[$playerKey]['max']===null?$total:max($players[$playerKey]['max'],$total);
            $sideTotals[$side][]=$total;
        }
    }
    foreach($players as &$player){
        if($player['samples']>0){
            $player['average']=$player['sum']/$player['samples'];
            $player['per_general']=$player['average']/3;
        }
    }
    unset($player);
    $rows=array_values($players);
    usort($rows,static function($a,$b){
        if($a['average']===null && $b['average']!==null)return 1;
        if($a['average']!==null && $b['average']===null)return -1;
        if($a['average']!==null && $b['average']!==null && $a['average']!==$b['average'])return $b['average']<=>$a['average'];
        if($a['samples']!==$b['samples'])return $b['samples']<=>$a['samples'];
        if($a['side']!==$b['side'])return $a['side']==='own'?-1:1;
        return strcmp($a['name'],$b['name']);
    });
    $averages=[]; $sums=[];
    foreach($sideTotals as $side=>$values){
        $averages[$side]=$values?array_sum($values)/count($values):null;
        $sums[$side]=array_sum($values);
    }
    return ['rows'=>$rows,'side_averages'=>$averages,'side_sums'=>$sums,'side_samples'=>['own'=>count($sideTotals['own']),'enemy'=>count($sideTotals['enemy'])],'unknown'=>$unknown,'reviewed'=>count($sideTotals['own'])+count($sideTotals['enemy'])];
}

function battleTacticRanking(array $stats, string $metric, string $order = 'total', int $minimum = 1): array
{
    if(!in_array($metric,['damage','healing'],true))throw new InvalidArgumentException('Unknown metric');
    $rows=array_values(array_filter($stats['tactics'],fn($t)=>$t[$metric]>0 && $t[$metric.'_samples']>=$minimum));
    $field=$order==='average'?$metric.'_average':$metric;
    usort($rows,fn($a,$b)=>($b[$field]<=>$a[$field]) ?: ($b[$metric.'_samples']<=>$a[$metric.'_samples']) ?: strcmp($a['name'],$b['name']));
    return $rows;
}

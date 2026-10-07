<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
define('MOBUNAGA_ANALYSIS_ROOM',true);
require __DIR__.'/../includes/battle-import.php';
require __DIR__.'/../includes/battle-limit-break-observations-20261007.php';

try{
    $db=battleDb($argv[1]??'/var/www/.nobunaga-db.ini');
    $rows=battleReviewedLimitBreakObservations20261007();
    $result=syncBattleLimitBreakRoster($db,$rows);
    $loaded=loadBattleLimitBreakRoster($db,'S4');
    $own=0;$enemy=0;$ownPlayers=0;$enemyPlayers=0;
    foreach($loaded as $row){
        if(isset($row['own_name'])){$own+=(int)($row['own_limit_break_total']??0);if((int)($row['own_limit_break_total']??0)>0)$ownPlayers++;}
        if(isset($row['enemy_name'])){$enemy+=(int)($row['enemy_limit_break_total']??0);if((int)($row['enemy_limit_break_total']??0)>0)$enemyPlayers++;}
    }
    echo battleJson($result+['rows'=>count($loaded),'own_total'=>$own,'enemy_total'=>$enemy,'own_positive_players'=>$ownPlayers,'enemy_positive_players'=>$enemyPlayers]).PHP_EOL;
    exit(($own===145 && $enemy===140)?0:2);
}catch(Throwable $e){
    fwrite(STDERR,'凸数名簿DB登録失敗: '.$e->getMessage().PHP_EOL);
    exit(1);
}

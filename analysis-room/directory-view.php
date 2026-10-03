<?php
declare(strict_types=1);
if (!defined('MOBUNAGA_ANALYSIS_ROOM')) { http_response_code(404); exit; }

function renderEnemyDirectory(array $groups, int $requestedPage, string $csrf, string $query, bool $watch): string
{
    $perPage = 40;
    $pages = max(1, (int)ceil(count($groups) / $perPage));
    $page = max(1, min($requestedPage, $pages));
    $shown = array_slice($groups, ($page - 1) * $perPage, $perPage);
    $escape = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ob_start();
    ?>
    <p class="directory-count" role="status"><?=count($groups)?>件の名前・兵種 / <?=$page?> / <?=$pages?>ページ</p>
    <div class="enemy-directory-list">
    <?php foreach ($shown as $group): ?>
        <details class="enemy-history">
            <summary>
                <strong class="enemy-player"><?=$escape($group['name'] ?: '敵名未登録')?></strong>
                <span class="enemy-troop"><?=$escape($group['troop'] ?: '兵種未記録')?></span>
                <span class="enemy-history-count"><?=count($group['records'])?>記録<?=$group['watch']?' / ★要注意':''?></span>
                <?php if ($group['match'] !== ''): ?><small class="name-match"><?=$escape($group['match'])?></small><?php endif; ?>
                <span class="enemy-expand" aria-hidden="true">編成・日付 ＋</span>
            </summary>
            <div class="enemy-history-body">
            <?php foreach ($group['records'] as $record): ?>
                <article class="enemy-record" id="enemy-record-<?=$escape(str_replace(':', '-', $record['key']))?>">
                    <h4><?=$escape($record['formation'] ?: '編成未記録')?></h4>
                    <?php if ($record['members']): ?><div class="enemy-record-members">
                    <?php foreach ($record['members'] as $name): $portrait = generalPortrait((string)$name); ?>
                        <span><?php if ($portrait): ?><img src="<?=$escape($portrait)?>" alt="" loading="lazy" width="40" height="50"><?php endif; ?><?=$escape($name)?></span>
                    <?php endforeach; ?></div><?php endif; ?>
                    <dl class="enemy-record-meta">
                        <div><dt>対戦日時</dt><dd><?=$escape($record['battle_at'] ?: '未記録')?></dd></div>
                        <div><dt>兵種</dt><dd><?=$escape($record['troop'] ?: '未記録')?></dd></div>
                        <?php if ($record['posted_at'] !== ''): ?><div><dt>投稿日時</dt><dd><?=$escape($record['posted_at'])?></dd></div><?php endif; ?>
                        <?php if ($record['result'] !== ''): ?><div><dt>実戦結果</dt><dd><?=$escape($record['result'])?></dd></div><?php endif; ?>
                        <?php if ($record['video_at'] !== ''): ?><div><dt>動画位置</dt><dd><?=$escape($record['video_at'])?></dd></div><?php endif; ?>
                        <?php if ($record['season'] !== ''): ?><div><dt>シーズン</dt><dd><?=$escape($record['season'])?></dd></div><?php endif; ?>
                    </dl>
                    <?php if ($record['memo'] !== ''): ?><p class="enemy-record-memo"><?=nl2br($escape($record['memo']))?></p><?php endif; ?>
                    <?php if ($record['points']): ?><ul><?php foreach ($record['points'] as $point): ?><li><?=$escape($point)?></li><?php endforeach; ?></ul><?php endif; ?>
                    <div class="intel-meta">
                        <?php $url = $record['source_url']; if (filter_var($url, FILTER_VALIDATE_URL) && in_array(strtolower((string)parse_url($url, PHP_URL_SCHEME)), ['https', 'http'], true)): ?><a href="<?=$escape($url)?>" target="_blank" rel="noopener noreferrer">参照URL</a><?php endif; ?>
                        <?php foreach ($record['files'] as $n => $file): ?><a href="/analysis-room/intel-image.php?id=<?=(int)$file?>" target="_blank" rel="noopener noreferrer">添付画像<?=$n+1?></a><?php endforeach; ?>
                    </div>
                    <?php if ($record['submission_id']): ?>
                        <p class="intel-status">投稿 #<?=$record['submission_id']?> / <?=$escape(['new'=>'未処理','reviewed'=>'済み','archived'=>'保管済み'][$record['status']] ?? $record['status'])?></p>
                        <details class="enemy-metadata-edit"><summary>名前・兵種・編成・対戦日時を補完／訂正</summary>
                            <form method="post" class="intel-form">
                                <input type="hidden" name="action" value="update_enemy_metadata"><input type="hidden" name="csrf" value="<?=$escape($csrf)?>"><input type="hidden" name="intel_id" value="<?=$record['submission_id']?>">
                                <div class="intel-fields"><label>敵名<input name="enemy_name" maxlength="120" value="<?=$escape($record['name'])?>"></label><label>兵種<input name="enemy_troop" maxlength="80" list="enemy-troop-options" value="<?=$escape($record['troop'])?>" placeholder="未記録なら空欄"></label></div>
                                <label>編成・武将<input name="enemy_formation" maxlength="255" value="<?=$escape($record['formation'])?>"></label>
                                <label>対戦日時（ゲーム表示）<input type="text" name="battle_at" value="<?=$escape($record['battle_at'])?>" placeholder="YYYY-MM-DD HH:MM または YYYY-MM-DD"></label>
                                <p class="intel-help">本文・添付画像は保持します。不明な日時・兵種は空欄のままにしてください。</p><button type="submit">記録情報を保存</button>
                            </form>
                        </details>
                        <?php if ($record['status'] === 'new'): ?><form method="post" class="intel-done-form"><input type="hidden" name="action" value="mark_enemy_intel_reviewed"><input type="hidden" name="csrf" value="<?=$escape($csrf)?>"><input type="hidden" name="intel_id" value="<?=$record['submission_id']?>"><button class="intel-done" type="submit">済みにする</button></form><?php endif; ?>
                    <?php elseif ($record['formation_id'] !== ''): ?>
                        <form method="post"><input type="hidden" name="action" value="toggle_watch"><input type="hidden" name="csrf" value="<?=$escape($csrf)?>"><input type="hidden" name="formation_id" value="<?=$escape($record['formation_id'])?>"><input type="hidden" name="watch_flag" value="<?=$record['watch']?'0':'1'?>"><button type="submit" class="watch-toggle<?=$record['watch']?' on':''?>"><?=$record['watch']?'★ 要注意を解除':'☆ 要注意にする'?></button></form>
                    <?php endif; ?>
                </article>
            <?php endforeach; ?>
            </div>
        </details>
    <?php endforeach; ?>
    </div>
    <?php if (!$shown): ?><p class="archive-empty">一致する敵記録がありません。名前の一部分や別の表記で検索してください。</p><?php endif; ?>
    <?php if ($pages > 1): ?><nav class="directory-pagination" aria-label="敵一覧のページ">
        <?php foreach ([[$page-1,'前のページ'],[$page+1,'次のページ']] as [$p,$label]): if ($p<1 || $p>$pages) continue; ?>
            <a data-directory-page="<?=$p?>" href="?<?=$escape(http_build_query(['q'=>$query,'watch'=>$watch?'1':'','page'=>$p]))?>"><?=$label?></a>
        <?php endforeach; ?>
    </nav><?php endif; ?>
    <?php
    return (string)ob_get_clean();
}

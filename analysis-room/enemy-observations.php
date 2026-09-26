<?php
declare(strict_types=1);

if (!defined('MOBUNAGA_ANALYSIS_ROOM')) {
    http_response_code(404);
    exit;
}

return [
    'updated_at' => '2026-09-23',
    'source' => [
        'type' => 'video',
        'file_name' => '画面録画 2026-09-23 012415.mp4',
        'sha256' => 'd8a8e31d33df93d0b6bc002a09c83de18ed91d87115c56ba9e48274b881e96f6',
        'captured_at' => '2026-09-23 01:20:38',
        'duration' => '03:37',
        'analyst_note' => '画面に対戦日時が表示された記録だけを採用。日時が読めない対戦は推測で登録しない。',
    ],
    'formations' => [
        [
            'id' => 'hojo-dosetsu-ginchiyo',
            'members' => ['北条氏康', '立花道雪', '立花誾千代'],
            'attention_score' => 62,
            'confidence' => '中',
            'summary' => '動画内で3回確認された反復出現編成。勝利できた記録もあるが引分もあり、連戦時に兵力を残しやすい。',
            'watch_points' => ['立花勢の攻撃順と集中先', '北条氏康を含む継戦力', '同型が相手を変えて繰り返し出現'],
            'observations' => [
                ['battle_at' => '2026-09-22 00:34:47', 'opponent' => '一瀬楽章', 'result' => '勝利', 'video_at' => '02:25'],
                ['battle_at' => '2026-09-22 11:01:21', 'opponent' => '吹田メロード', 'result' => '引分', 'video_at' => '02:46'],
                ['battle_at' => '2026-09-22 18:18:53', 'opponent' => '山旦那', 'result' => '勝利', 'video_at' => '03:23'],
            ],
        ],
        [
            'id' => 'ataka-sanada-mori',
            'members' => ['安宅冬康', '真田昌幸', '毛利元就'],
            'attention_score' => 61,
            'confidence' => '低',
            'summary' => '1戦のみ確認。引分まで持ち込まれており、妨害・知略寄りの長期戦型として再検証が必要。',
            'watch_points' => ['真田昌幸の妨害', '毛利元就を軸にした知略戦', '引分になった原因の戦法順'],
            'observations' => [
                ['battle_at' => '2026-09-20 20:03:04', 'opponent' => '一瀬楽章', 'result' => '引分', 'video_at' => '01:50'],
            ],
        ],
        [
            'id' => 'naito-fukushima-hojo',
            'members' => ['内藤昌豊', '福島正則', '北条綱成'],
            'attention_score' => 55,
            'confidence' => '低',
            'summary' => '1戦のみ確認。勝利記録だが、こちらにも死傷・負傷が残っているため削り性能を継続観察する。',
            'watch_points' => ['福島正則と北条綱成の兵刃火力', '内藤昌豊の支援', '連戦時の削り量'],
            'observations' => [
                ['battle_at' => '2026-09-20 21:15:56', 'opponent' => 'ながら', 'result' => '勝利', 'video_at' => '02:04'],
            ],
        ],
        [
            'id' => 'sanada-baba-takeda',
            'members' => ['真田昌幸', '馬場信春', '武田信玄'],
            'attention_score' => 58,
            'confidence' => '低',
            'summary' => '武田軸に真田昌幸を加えた編成。勝利記録ではあるが、妨害と耐久が重なる型として扱う。',
            'watch_points' => ['真田昌幸の妨害が入る順番', '馬場信春の耐久', '武田信玄の主将火力'],
            'observations' => [
                ['battle_at' => '2026-09-22 00:34:48', 'opponent' => '一瀬楽章', 'result' => '勝利', 'video_at' => '02:31'],
            ],
        ],
        [
            'id' => 'hojo-ginchiyo-tsunanari',
            'members' => ['北条氏康', '立花誾千代', '北条綱成'],
            'attention_score' => 61,
            'confidence' => '低',
            'summary' => '北条2名に立花誾千代を組み合わせた型。引分記録のため、時間切れ・継戦力の両面を警戒する。',
            'watch_points' => ['北条2名の継戦力', '立花誾千代の攻撃先', '引分を招いた残存兵力'],
            'observations' => [
                ['battle_at' => '2026-09-22 11:01:23', 'opponent' => 'らいす', 'result' => '引分', 'video_at' => '02:53'],
            ],
        ],
        [
            'id' => 'obu-yamagata-takeda',
            'members' => ['飯富虎昌', '山県昌景', '武田信玄'],
            'attention_score' => 57,
            'confidence' => '低',
            'summary' => '武田3名の兵刃寄り編成。勝利記録だが、相手の凸数と火力の伸びを次回確認する。',
            'watch_points' => ['山県昌景の凸数', '飯富虎昌の初動', '武田信玄まで残した場合の火力'],
            'observations' => [
                ['battle_at' => '2026-09-22 11:01:23', 'opponent' => 'らいす', 'result' => '勝利', 'video_at' => '03:08'],
            ],
        ],
        [
            'id' => 'naito-obu-yamamoto',
            'members' => ['内藤昌豊', '飯富虎昌', '山本勘助'],
            'attention_score' => 68,
            'confidence' => '低',
            'summary' => '今回の動画で唯一敗北を確認した編成のため、暫定最警戒とする。凸表示の正確な数は拡大資料で再確認する。',
            'watch_points' => ['飯富虎昌の火力', '各武将の赤凸数の再確認', '山本勘助を含む妨害・削りの噛み合わせ'],
            'observations' => [
                ['battle_at' => '2026-09-22 18:18:54', 'opponent' => '山旦那', 'result' => '敗北', 'video_at' => '03:30'],
            ],
        ],
    ],
];

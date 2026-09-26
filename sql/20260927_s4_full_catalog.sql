-- モブナガ S4 新武将・固有特性・固有戦法・事件戦法 登録バッチ
-- 2026-09-27
-- ユーザー提供ゲーム画面を一次資料として登録。
-- tactic_level_values の is_derived=1 は Lv1→Lv10 を線形補間した参考値。端数表示はゲーム内と差が出る可能性あり。
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+09:00';

CREATE TABLE IF NOT EXISTS tactic_level_values (
  tactic_id VARCHAR(120) NOT NULL,
  metric_key VARCHAR(80) NOT NULL,
  metric_label VARCHAR(160) NOT NULL,
  level_no TINYINT UNSIGNED NOT NULL,
  metric_value DECIMAL(14,4) NULL,
  unit VARCHAR(32) NULL,
  is_derived TINYINT(1) NOT NULL DEFAULT 0,
  note VARCHAR(255) NULL,
  PRIMARY KEY (tactic_id, metric_key, level_no),
  KEY idx_tactic_level_values_tactic (tactic_id, level_no),
  CONSTRAINT fk_tactic_level_values_tactic FOREIGN KEY (tactic_id) REFERENCES tactics(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- S4新武将
INSERT INTO generals (id,name,kana,rarity,faction,family,cost,gender,current_tier,portrait) VALUES
('datemasamune','伊達政宗','だてまさむね',5,'群雄','date-clan',7,'男性','Tier0','assets/portraits/datemasamune.webp'),
('naganonarimasa','長野業正','ながのなりまさ',5,'上杉','uesugi-clan',7,'男性','Tier2','assets/portraits/naganonarimasa.webp'),
('satakeyoshishige','佐竹義重','さたけよししげ',5,'群雄','satake-clan',7,'男性','Tier2','assets/portraits/satakeyoshishige.webp'),
('miyoshijikkyuu','三好実休','みよしじっきゅう',5,'群雄','miyoshi-clan',6,'男性','Tier1','assets/portraits/miyoshijikkyuu.webp'),
('horinaomasa','堀直政','ほりなおまさ',5,'織田','oda-clan',5,'男性','Tier2','assets/portraits/horinaomasa.webp'),
('ookubonagayasu','大久保長安','おおくぼながやす',5,'徳川','tokugawa-clan',5,'男性','Tier4','assets/portraits/ookubonagayasu.webp'),
('fujibayashimasayasu','藤林正保','ふじばやしまさやす',5,'群雄','fujibayashi-clan',5,'男性','Tier4','assets/portraits/fujibayashimasayasu.webp'),
('uragamimunekage','浦上宗景','うらがみむねかげ',5,'群雄','uragami-clan',4,'男性','Tier3','assets/portraits/uragamimunekage.webp')
ON DUPLICATE KEY UPDATE name=VALUES(name),kana=VALUES(kana),rarity=VALUES(rarity),faction=VALUES(faction),family=VALUES(family),cost=VALUES(cost),gender=VALUES(gender),current_tier=VALUES(current_tier),portrait=VALUES(portrait);

INSERT INTO general_tiers (general_id,season,tier) VALUES
('datemasamune','S4','Tier0'),('naganonarimasa','S4','Tier2'),('satakeyoshishige','S4','Tier2'),('miyoshijikkyuu','S4','Tier1'),
('horinaomasa','S4','Tier2'),('ookubonagayasu','S4','Tier4'),('fujibayashimasayasu','S4','Tier4'),('uragamimunekage','S4','Tier3')
ON DUPLICATE KEY UPDATE tier=VALUES(tier);

INSERT INTO general_stats (general_id,attribute_name,level1,growth,level50) VALUES
('datemasamune','武勇',86,2.01,184.5),('datemasamune','知略',87,2.00,185.0),('datemasamune','統率',94,1.92,188.1),('datemasamune','速度',67,1.02,117.0),('datemasamune','政務',96,2.09,198.4),('datemasamune','魅力',81,1.80,169.2),
('naganonarimasa','武勇',81,1.29,144.2),('naganonarimasa','知略',91,2.05,191.4),('naganonarimasa','統率',91,2.05,191.4),('naganonarimasa','速度',45,0.52,70.5),('naganonarimasa','政務',65,0.58,93.4),('naganonarimasa','魅力',74,0.82,114.2),
('satakeyoshishige','武勇',88,2.31,201.2),('satakeyoshishige','知略',83,1.37,150.1),('satakeyoshishige','統率',88,1.68,170.3),('satakeyoshishige','速度',61,0.94,107.1),('satakeyoshishige','政務',86,1.72,170.3),('satakeyoshishige','魅力',91,2.01,189.5),
('miyoshijikkyuu','武勇',76,0.82,116.2),('miyoshijikkyuu','知略',85,2.09,187.4),('miyoshijikkyuu','統率',81,1.67,162.8),('miyoshijikkyuu','速度',42,0.68,75.3),('miyoshijikkyuu','政務',83,1.75,168.8),('miyoshijikkyuu','魅力',85,1.82,174.2),
('horinaomasa','武勇',70,0.63,100.9),('horinaomasa','知略',79,1.88,171.1),('horinaomasa','統率',75,1.56,151.4),('horinaomasa','速度',34,0.35,51.1),('horinaomasa','政務',85,1.86,176.1),('horinaomasa','魅力',78,1.45,149.1),
('ookubonagayasu','武勇',21,0.24,32.8),('ookubonagayasu','知略',65,1.82,154.2),('ookubonagayasu','統率',20,1.63,99.9),('ookubonagayasu','速度',65,0.98,113.0),('ookubonagayasu','政務',89,2.05,189.4),('ookubonagayasu','魅力',76,1.69,158.8),
('fujibayashimasayasu','武勇',71,1.80,159.2),('fujibayashimasayasu','知略',73,1.43,143.1),('fujibayashimasayasu','統率',43,0.84,84.2),('fujibayashimasayasu','速度',56,1.32,120.7),('fujibayashimasayasu','政務',8,0.10,12.9),('fujibayashimasayasu','魅力',59,0.77,96.7),
('uragamimunekage','武勇',65,1.12,119.9),('uragamimunekage','知略',70,1.66,151.3),('uragamimunekage','統率',60,1.02,110.0),('uragamimunekage','速度',38,0.79,76.7),('uragamimunekage','政務',62,0.77,99.7),('uragamimunekage','魅力',64,0.82,104.2)
ON DUPLICATE KEY UPDATE level1=VALUES(level1),growth=VALUES(growth),level50=VALUES(level50);

INSERT INTO general_tags (general_id,tag,kind) VALUES
('datemasamune','S4新武将','season'),('naganonarimasa','S4新武将','season'),('satakeyoshishige','S4新武将','season'),('miyoshijikkyuu','S4新武将','season'),
('horinaomasa','S4新武将','season'),('ookubonagayasu','S4新武将','season'),('fujibayashimasayasu','S4新武将','season'),('uragamimunekage','S4新武将','season')
ON DUPLICATE KEY UPDATE tag=VALUES(tag);

-- 特性（効果本文は未提示のため名称・位置を確定登録）
INSERT INTO general_traits (general_id,position_no,unlock_level,name,category,grade,target_text,effect) VALUES
('datemasamune',1,NULL,'独眼竜','固有特性','固有',NULL,NULL),('datemasamune',2,NULL,'昇り龍','固有特性','固有',NULL,NULL),('datemasamune',3,NULL,'善戦II','通常特性','II',NULL,NULL),('datemasamune',4,NULL,'高揚II','通常特性','II',NULL,NULL),
('naganonarimasa',1,NULL,'金城鉄壁','固有特性','固有',NULL,NULL),('naganonarimasa',2,NULL,'弓槍術II','通常特性','II',NULL,NULL),('naganonarimasa',3,NULL,'剛猛II','通常特性','II',NULL,NULL),('naganonarimasa',4,NULL,'守勢I','通常特性','I',NULL,NULL),
('satakeyoshishige',1,NULL,'坂東太郎','固有特性','固有',NULL,NULL),('satakeyoshishige',2,NULL,'弓砲術II','通常特性','II',NULL,NULL),('satakeyoshishige',3,NULL,'堅固I','通常特性','I',NULL,NULL),('satakeyoshishige',4,NULL,'尽力II','通常特性','II',NULL,NULL),
('miyoshijikkyuu',1,NULL,'物外軒','固有特性','固有',NULL,NULL),('miyoshijikkyuu',2,NULL,'砲術III','通常特性','III',NULL,NULL),('miyoshijikkyuu',3,NULL,'固守II','通常特性','II',NULL,NULL),('miyoshijikkyuu',4,NULL,'知恵I','通常特性','I',NULL,NULL),
('horinaomasa',1,NULL,'看破II','通常特性','II',NULL,NULL),('horinaomasa',2,NULL,'馬槍術I','通常特性','I',NULL,NULL),('horinaomasa',3,NULL,'威勢II','通常特性','II',NULL,NULL),('horinaomasa',4,NULL,'防護II','通常特性','II',NULL,NULL),
('ookubonagayasu',1,NULL,'馬術II','通常特性','II',NULL,NULL),('ookubonagayasu',2,NULL,'知恵II','通常特性','II',NULL,NULL),('ookubonagayasu',3,NULL,'急速III','通常特性','III',NULL,NULL),('ookubonagayasu',4,NULL,'忍耐I','通常特性','I',NULL,NULL),
('fujibayashimasayasu',1,NULL,'弓槍術II','通常特性','II',NULL,NULL),('fujibayashimasayasu',2,NULL,'血気II','通常特性','II',NULL,NULL),('fujibayashimasayasu',3,NULL,'武威II','通常特性','II',NULL,NULL),('fujibayashimasayasu',4,NULL,'看破I','通常特性','I',NULL,NULL),
('uragamimunekage',1,NULL,'弓術III','通常特性','III',NULL,NULL),('uragamimunekage',2,NULL,'知恵II','通常特性','II',NULL,NULL),('uragamimunekage',3,NULL,'防護II','通常特性','II',NULL,NULL),('uragamimunekage',4,NULL,'攻勢II','通常特性','II',NULL,NULL)
ON DUPLICATE KEY UPDATE name=VALUES(name),category=VALUES(category),grade=VALUES(grade),target_text=VALUES(target_text),effect=VALUES(effect);

-- S4固有戦法
INSERT INTO tactics (id,name,`rank`,category,activation_rate,effect,first_season,applicable_troop,acquisition,flag_damage,flag_heal,flag_buff,flag_debuff,flag_control,flag_special) VALUES
('s4-unique-datemasamune','伊達の粋','S','指揮','100%','戦闘開始時、自身は粋を5スタック獲得。毎ターン行動時、粋を1スタック消費し、敵軍単体に兵刃ダメージと計略ダメージをそれぞれ1回ずつ与える（Lv1→Lv10: 各46%→92%、対応属性依存、各ダメージ対象はランダム）。兵刃ダメージを2回、および計略ダメージを2回与えるたび、自身の武勇と知略が2.5%→5%上昇（対応属性依存、最大4回重ねがけ）。最大まで重ねがけした場合、武勇と知略の上昇効果が「粋を1スタック獲得」に変わる。','S4',NULL,'固有戦法 伊達政宗',1,0,1,0,0,1),
('s4-unique-naganonarimasa','上州の黄斑','S','指揮','100%','戦闘中、前のターンに通常攻撃を受けていた場合、37.5%→75%の確率（統率依存）で自身を攻撃した対象に3ターン消沈を付与（ダメージ率23%→46%、知略依存）。そうでない場合、15%→30%の確率（統率依存）で3ターン、敵軍複数（2名）に消沈を付与（ダメージ率23%→46%、知略依存）。消沈を付与する際、対象がすでに消沈状態なら、代わりに1ターン、18%→36%の疲弊を付与（統率依存）。大将技：疲弊の基本確率が2.5%→5%上昇。','S4',NULL,'固有戦法 長野業正',0,0,0,1,1,1),
('s4-unique-satakeyoshishige','鬼義重','S','能動','35%','敵軍複数（2名）に対して、統率を1ターンの間32.5→65減少（武勇依存）させ、兵刃ダメージ（107%→214%）を与える。大将技：同じ武将にこの効果が累計2回以上適用された場合、さらに7.5%→15%の確率（武勇依存）で1ターン威圧状態を付与。','S4',NULL,'固有戦法 佐竹義重',1,0,0,1,1,1),
('s4-unique-miyoshijikkyuu','風流武者','S','受動','100%','自身が初めて能動または突撃戦法を発動した時、40%→80%の確率（知略依存）で自軍複数（2名）の兵力を回復（回復率66%→132%、知略依存）。自身が2回目に能動または突撃戦法を発動した時、40%→80%の確率（知略依存）で2ターンの間、自軍複数（2名）の計略与ダメージが15%→30%上昇（知略依存、最大2回まで重ねがけ可能）。奇数ターンには発動回数のカウントがリセット。','S4',NULL,'固有戦法 三好実休',0,1,1,0,0,0),
('s4-unique-horinaomasa','股肱之臣','S','能動','45%','1ターンの間、自軍複数（2～3名）が回生を3回獲得（回復率27%→54%、知略依存）。効果終了時、自軍武将の回生の残り回数1回につき、1ターンの間、その武将の与ダメージが5.5%→11%上昇（知略依存）。','S4',NULL,'固有戦法 堀直政',0,1,1,0,0,1),
('s4-unique-ookubonagayasu','伝馬疾駆','S','能動','45%','1ターンの間、友軍単体の武勇と速度を増加（最大レベル画像で10、知略依存）させ、さらにその友軍は行動前に敵軍単体へ兵刃ダメージを与える（最大レベル画像で51%、自身の知略および友軍とその相手との速度差に依存）。この効果は継続時間終了後に別の友軍単体へ転移（転移回数は1回のみ）。','S4',NULL,'固有戦法 大久保長安',1,0,1,0,0,1),
('s4-unique-fujibayashimasayasu','神出鬼没','S','能動','50%','2ターンの間、自身が通常攻撃の対象となる確率が大幅に低下し、次の通常攻撃後、攻撃対象に追加で兵刃ダメージ（149%→298%）を与える。','S4',NULL,'固有戦法 藤林正保',1,0,1,0,0,0),
('s4-unique-uragamimunekage','天神山残照','S','受動','100%','通常攻撃後、25%の確率で対象に計略ダメージ（最大レベル画像で106%、知略依存）。4ターン目終了まで、毎ターン行動前に自身の武勇と知略が1ターンの間30増加（知略依存）し、増加した属性はターンごとに25%ずつ減少。5ターン目開始時、知略が最も高い友軍単体に1ターン混乱を付与。大将技：属性増加効果の継続ターン数は5に、増加した属性のターンごとの減少割合は20%ずつに変化。','S4',NULL,'固有戦法 浦上宗景',1,0,1,0,1,1)
ON DUPLICATE KEY UPDATE name=VALUES(name),`rank`=VALUES(`rank`),category=VALUES(category),activation_rate=VALUES(activation_rate),effect=VALUES(effect),first_season=VALUES(first_season),applicable_troop=VALUES(applicable_troop),acquisition=VALUES(acquisition),flag_damage=VALUES(flag_damage),flag_heal=VALUES(flag_heal),flag_buff=VALUES(flag_buff),flag_debuff=VALUES(flag_debuff),flag_control=VALUES(flag_control),flag_special=VALUES(flag_special);

INSERT INTO general_unique_tactics (general_id,name,category,effect) SELECT 'datemasamune',name,category,effect FROM tactics WHERE id='s4-unique-datemasamune' ON DUPLICATE KEY UPDATE name=VALUES(name),category=VALUES(category),effect=VALUES(effect);
INSERT INTO general_unique_tactics (general_id,name,category,effect) SELECT 'naganonarimasa',name,category,effect FROM tactics WHERE id='s4-unique-naganonarimasa' ON DUPLICATE KEY UPDATE name=VALUES(name),category=VALUES(category),effect=VALUES(effect);
INSERT INTO general_unique_tactics (general_id,name,category,effect) SELECT 'satakeyoshishige',name,category,effect FROM tactics WHERE id='s4-unique-satakeyoshishige' ON DUPLICATE KEY UPDATE name=VALUES(name),category=VALUES(category),effect=VALUES(effect);
INSERT INTO general_unique_tactics (general_id,name,category,effect) SELECT 'miyoshijikkyuu',name,category,effect FROM tactics WHERE id='s4-unique-miyoshijikkyuu' ON DUPLICATE KEY UPDATE name=VALUES(name),category=VALUES(category),effect=VALUES(effect);
INSERT INTO general_unique_tactics (general_id,name,category,effect) SELECT 'horinaomasa',name,category,effect FROM tactics WHERE id='s4-unique-horinaomasa' ON DUPLICATE KEY UPDATE name=VALUES(name),category=VALUES(category),effect=VALUES(effect);
INSERT INTO general_unique_tactics (general_id,name,category,effect) SELECT 'ookubonagayasu',name,category,effect FROM tactics WHERE id='s4-unique-ookubonagayasu' ON DUPLICATE KEY UPDATE name=VALUES(name),category=VALUES(category),effect=VALUES(effect);
INSERT INTO general_unique_tactics (general_id,name,category,effect) SELECT 'fujibayashimasayasu',name,category,effect FROM tactics WHERE id='s4-unique-fujibayashimasayasu' ON DUPLICATE KEY UPDATE name=VALUES(name),category=VALUES(category),effect=VALUES(effect);
INSERT INTO general_unique_tactics (general_id,name,category,effect) SELECT 'uragamimunekage',name,category,effect FROM tactics WHERE id='s4-unique-uragamimunekage' ON DUPLICATE KEY UPDATE name=VALUES(name),category=VALUES(category),effect=VALUES(effect);

-- S4事件戦法（画像で確認できた範囲）
INSERT INTO tactics (id,name,`rank`,category,activation_rate,effect,first_season,applicable_troop,acquisition,flag_damage,flag_heal,flag_buff,flag_debuff,flag_control,flag_special) VALUES
('s4-event-kisakuseishou','奇策制勝','S','受動','100%','戦闘中、固有能動戦法の与ダメージが14%→28%上昇（知略依存）。自身の固有能動戦法発動に成功すると、35%→70%の確率（知略依存）で2%→4%の心攻を獲得（知略依存、最大4回まで重ねがけ可能）。','S4',NULL,'S4事件「勘助の秘策」',0,1,1,0,0,1),
('s4-event-echigosentegumi','越後先手組','S','兵種','100%','騎兵が先手必勝の越後先手組に進化。戦闘中、自軍全体の速度が12→24増加。2ターン目から、毎ターン自軍全体が行動する前に追加効果が発生する（画像下部の全文は未確認のため、確認済み範囲のみ登録）。','S4','騎兵専用','S4事件「長尾景虎起つ」',0,0,1,0,0,1),
('s4-event-oikuzushi','追い崩し','S','能動','35%','敵軍単体に計略ダメージ（73%→146%、知略依存）を与え、1ターンの間、対象に萎縮を付与。','S4',NULL,'S4事件「関東管領追放」',1,0,0,1,1,0),
('s4-event-mikawabushi','三河武士','S','兵種','100%','足軽が忠勇無双の三河武士に進化。戦闘中、自軍全体の統率が8→16増加。自軍全体が合計3回の通常攻撃を受けると発動し、次のターン開始時に「不屈」を1回発動して自軍全体の兵力を回復（30%→60%、統率依存）。4回目の不屈発動時は代わりに自軍の各武将がそれぞれランダムな敵軍単体にダメージ（41%→82%、武勇と知略の高い方に依存）を与え、以降は不屈を発動しない。徳川家康が装備時、統率の増加効果はさらに自身の統率の影響を受ける。','S4','足軽専用','S4事件「松平家独立」',1,1,1,0,0,1)
ON DUPLICATE KEY UPDATE name=VALUES(name),`rank`=VALUES(`rank`),category=VALUES(category),activation_rate=VALUES(activation_rate),effect=VALUES(effect),first_season=VALUES(first_season),applicable_troop=VALUES(applicable_troop),acquisition=VALUES(acquisition),flag_damage=VALUES(flag_damage),flag_heal=VALUES(flag_heal),flag_buff=VALUES(flag_buff),flag_debuff=VALUES(flag_debuff),flag_control=VALUES(flag_control),flag_special=VALUES(flag_special);

-- Lv1→Lv10 線形補間テーブル。画像で矢印表記された端点のみ補間。
DELETE FROM tactic_level_values WHERE tactic_id IN ('s4-unique-datemasamune','s4-unique-naganonarimasa','s4-unique-satakeyoshishige','s4-unique-miyoshijikkyuu','s4-unique-horinaomasa','s4-unique-fujibayashimasayasu','s4-event-kisakuseishou','s4-event-oikuzushi','s4-event-mikawabushi');

INSERT INTO tactic_level_values (tactic_id,metric_key,metric_label,level_no,metric_value,unit,is_derived,note)
WITH RECURSIVE lv(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM lv WHERE n<10), metrics AS (
SELECT 's4-unique-datemasamune' tactic_id,'damage_rate' metric_key,'兵刃/計略ダメージ率' metric_label,46.0 v1,92.0 v10,'%' unit UNION ALL
SELECT 's4-unique-datemasamune','stat_up','武勇・知略上昇率',2.5,5.0,'%' UNION ALL
SELECT 's4-unique-naganonarimasa','proc_attacked','通常攻撃を受けた場合の発動率',37.5,75.0,'%' UNION ALL
SELECT 's4-unique-naganonarimasa','proc_other','通常攻撃を受けていない場合の発動率',15.0,30.0,'%' UNION ALL
SELECT 's4-unique-naganonarimasa','depression_rate','消沈ダメージ率',23.0,46.0,'%' UNION ALL
SELECT 's4-unique-naganonarimasa','fatigue_rate','疲弊付与率',18.0,36.0,'%' UNION ALL
SELECT 's4-unique-naganonarimasa','commander_fatigue_bonus','大将技 疲弊基本確率上昇',2.5,5.0,'%' UNION ALL
SELECT 's4-unique-satakeyoshishige','command_down','統率減少',32.5,65.0,'point' UNION ALL
SELECT 's4-unique-satakeyoshishige','damage_rate','兵刃ダメージ率',107.0,214.0,'%' UNION ALL
SELECT 's4-unique-satakeyoshishige','intimidate_rate','大将技 威圧付与率',7.5,15.0,'%' UNION ALL
SELECT 's4-unique-miyoshijikkyuu','first_proc','初回発動率',40.0,80.0,'%' UNION ALL
SELECT 's4-unique-miyoshijikkyuu','heal_rate','回復率',66.0,132.0,'%' UNION ALL
SELECT 's4-unique-miyoshijikkyuu','second_proc','2回目発動率',40.0,80.0,'%' UNION ALL
SELECT 's4-unique-miyoshijikkyuu','strategy_damage_up','計略与ダメージ上昇',15.0,30.0,'%' UNION ALL
SELECT 's4-unique-horinaomasa','rebirth_heal','回生 回復率',27.0,54.0,'%' UNION ALL
SELECT 's4-unique-horinaomasa','damage_up_per_rebirth','回生残数1回ごとの与ダメージ上昇',5.5,11.0,'%' UNION ALL
SELECT 's4-unique-fujibayashimasayasu','extra_damage','追加兵刃ダメージ率',149.0,298.0,'%' UNION ALL
SELECT 's4-event-kisakuseishou','unique_active_damage_up','固有能動戦法 与ダメージ上昇',14.0,28.0,'%' UNION ALL
SELECT 's4-event-kisakuseishou','heart_proc','心攻獲得確率',35.0,70.0,'%' UNION ALL
SELECT 's4-event-kisakuseishou','heart_rate','心攻',2.0,4.0,'%' UNION ALL
SELECT 's4-event-oikuzushi','damage_rate','計略ダメージ率',73.0,146.0,'%' UNION ALL
SELECT 's4-event-mikawabushi','command_up','統率上昇',8.0,16.0,'point' UNION ALL
SELECT 's4-event-mikawabushi','heal_rate','不屈 回復率',30.0,60.0,'%' UNION ALL
SELECT 's4-event-mikawabushi','fourth_damage_rate','4回目不屈 ダメージ率',41.0,82.0,'%'
)
SELECT tactic_id,metric_key,metric_label,lv.n,ROUND(v1 + (v10-v1)*(lv.n-1)/9,4),unit,IF(lv.n IN (1,10),0,1),IF(lv.n IN (1,10),'ゲーム画面の端点','Lv1→Lv10の線形補間参考値') FROM metrics CROSS JOIN lv;

-- 固定値 / 最大Lvのみ確認できた値
INSERT INTO tactic_level_values (tactic_id,metric_key,metric_label,level_no,metric_value,unit,is_derived,note) VALUES
('s4-unique-ookubonagayasu','stat_up_max','武勇・速度増加（最大Lv）',10,10,'point',0,'最大レベル画面で確認'),
('s4-unique-ookubonagayasu','damage_rate_max','行動前兵刃ダメージ率（最大Lv）',10,51,'%',0,'最大レベル画面で確認'),
('s4-unique-uragamimunekage','normal_proc','通常攻撃後の計略発動率',1,25,'%',0,'画面表示値'),
('s4-unique-uragamimunekage','normal_proc','通常攻撃後の計略発動率',10,25,'%',0,'画面表示値'),
('s4-unique-uragamimunekage','strategy_damage_max','計略ダメージ率',10,106,'%',0,'最大レベル画面で確認'),
('s4-unique-uragamimunekage','stat_up','武勇・知略増加',1,30,'point',0,'画面表示値'),
('s4-unique-uragamimunekage','stat_up','武勇・知略増加',10,30,'point',0,'画面表示値')
ON DUPLICATE KEY UPDATE metric_label=VALUES(metric_label),metric_value=VALUES(metric_value),unit=VALUES(unit),is_derived=VALUES(is_derived),note=VALUES(note);

INSERT INTO schema_versions (version,description) VALUES ('2026-09-27-s4-full-catalog','S4 generals traits unique tactics event tactics and level values') ON DUPLICATE KEY UPDATE description=VALUES(description);

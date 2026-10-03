<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
define('MOBUNAGA_ANALYSIS_ROOM', true);
const INTEL_FORM_KEY = 'enemy_intel';
require __DIR__ . '/../includes/enemy-directory.php';
require __DIR__ . '/../includes/enemy-intel-storage.php';
require __DIR__ . '/../analysis-room/directory-view.php';
function generalPortrait(string $name): ?string { return null; }
function check(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }

check(enemyNormalizeName(' Ａｌｉｃｅ＿１２ ') === 'alice12', 'fullwidth, punctuation and case');
check(enemyNormalizeName('ﾔﾏﾀﾞ') === enemyNormalizeName('やまだ'), 'halfwidth voiced kana');
check(enemyNameMatch('山田太朗', '山田太郎')['label'] === '似た名前・本人か確認', 'Japanese one-character typo');
check(enemyNameMatch('山田', '山田太郎')['score'] === 90, 'partial name');
check(enemyNameMatch('山太', '山田') === null, 'short queries do not overmatch');
check(enemyNameMatch('alic', 'Alice')['score'] === 90, 'case-insensitive partial');
check(enemyNameMatch('alcie', 'Alice')['score'] > 0, 'adjacent transposition');
check(enemyNameMatch('全く無関係', '山田太郎') === null, 'unrelated names excluded');

$archive = ['formations' => [['id'=>'fixture','members'=>['徳川家康','本多忠勝','本多正信'],'observations'=>[['opponent'=>'山田太郎','battle_at'=>'2026-09-22 12:34:56','result'=>'引分']], 'summary'=>'計略対策', 'watch_points'=>[]]]];
$sub = fn(int $id, array $payload, int $file=0) => ['id'=>$id,'payload_json'=>json_encode($payload, JSON_UNESCAPED_UNICODE),'status'=>'new','created_at'=>'2026-10-04 00:00:00','file_id'=>$file];
$rows = [
 $sub(1,['enemy_name'=>'山田太郎','enemy_troop'=>'弓','enemy_formation'=>'徳川家康・本多忠勝','battle_at'=>'2026-10-03 22:00','memo'=>'一つ目'],5),
 $sub(1,['enemy_name'=>'山田太郎','enemy_troop'=>'弓','enemy_formation'=>'徳川家康・本多忠勝','battle_at'=>'2026-10-03 22:00','memo'=>'一つ目'],6),
 $sub(2,['enemy_name'=>'山田太郎','enemy_troop'=>'弓','enemy_formation'=>'豊臣秀吉・まつ','battle_at'=>'2026-10-03 23:00','memo'=>'二つ目']),
 $sub(3,['enemy_name'=>'山田太郎','enemy_troop'=>'騎','enemy_formation'=>'別兵種','memo'=>'日付不明']),
 $sub(4,['enemy_name'=>'山田太朗','enemy_troop'=>'弓','enemy_formation'=>'別人','memo'=>'別人']),
 $sub(5,['memo'=>'画像だけの投稿']), $sub(6,['memo'=>'別の画像だけの投稿']),
 $sub(7,['enemy_name'=>'<img src=x onerror=alert(1)>','enemy_formation'=>'<script>alert(2)</script>','memo'=>'<b>本文</b>','source_url'=>'javascript:alert(3)']),
];
$records = enemyDirectoryRecords($archive,$rows,['fixture'=>true]);
check(count($records)===8,'attachments do not duplicate observations');
check($records[1]['files']===[5,6],'every attachment retained');
$groups=enemyDirectoryGroups($records,'山田太朗');
check($groups[0]['name']==='山田太朗','exact name ranked above similar names');
check(count(array_values(array_filter($groups,fn($g)=>$g['name']==='山田太郎'&&$g['troop']==='弓'))[0]['records'])===2,'same name/troop exposes two dated formations');
check(count(array_filter(enemyDirectoryGroups($records,'山田太郎'),fn($g)=>$g['name']==='山田太郎'))===3,'same player remains split by troop/unknown troop');
check(count(enemyDirectoryGroups($records,'',true))===1,'watch filter uses observed flags');
check(count(array_filter(enemyDirectoryGroups($records),fn($g)=>$g['name']===''))===2,'unnamed uploads are never merged');
check(count(enemyDirectoryGroups($records,'まつ'))===1,'formation search includes uploaded data');
$html=renderEnemyDirectory(enemyDirectoryGroups($records),1,'test-token','',false);
check(strpos($html,'<script>alert(2)</script>')===false&&strpos($html,'javascript:alert(3)')===false,'escape text and reject unsafe URLs');
check(strpos($html,'&lt;script&gt;')!==false,'source text remains visible safely');
check(strpos($html,'id=5')!==false&&strpos($html,'id=6')!==false,'both private image links visible');
check(strpos($html,'対戦日時</dt><dd>未記録')!==false&&strpos($html,'投稿日時</dt><dd>2026-10-04')!==false,'posting time never fabricated as battle time');
check(enemyMetadata(['battle_at'=>'2026-10-03T23:01:02'])['battle_at']==='2026-10-03 23:01:02','explicit game timestamp normalization');
try { enemyMetadata(['battle_at'=>'2026-02-30T12:00']); throw new RuntimeException('invalid date accepted'); } catch (InvalidArgumentException $e) {}

// Real SQL execution with a test-only SQLite adapter for MySQL casts/row locks.
class DirectoryTestDb extends PDO {
 public function __construct(){parent::__construct('sqlite::memory:');$this->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);$this->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC);}
 public function prepare(string $query,array $options=[]):PDOStatement|false{return parent::prepare(str_replace([' FOR UPDATE','CAST(? AS JSON)'],['','?'],$query),$options);}
}
$db=new DirectoryTestDb();
$db->exec('CREATE TABLE form_submissions(id INTEGER PRIMARY KEY,form_key TEXT,payload_json TEXT,status TEXT,created_at TEXT); CREATE TABLE form_submission_files(id INTEGER PRIMARY KEY,submission_id INTEGER);');
$insert=$db->prepare('INSERT INTO form_submissions VALUES(?,?,?,?,?)');
for($i=1;$i<=305;$i++)$insert->execute([$i,INTEL_FORM_KEY,json_encode(['enemy_name'=>'古い敵'.$i,'memo'=>'保持する本文','source_url'=>'https://example.com/','future'=>['nested'=>'保持']],JSON_UNESCAPED_UNICODE),$i===1?'archived':'new','2026-10-01 12:00:00']);
$insert->execute([400,'other_form','{}','new','2026-10-01']);$insert->execute([401,INTEL_FORM_KEY,'{}','deleted','2026-10-01']);$insert->execute([402,INTEL_FORM_KEY,'{}','spam','2026-10-01']);
$db->exec('INSERT INTO form_submission_files VALUES(5,1),(6,1)');
$loaded=loadEnemyIntel($db);check(count(enemyDirectoryRecords([],$loaded,[]))===305,'all 305 records searchable, archived included, spam/deleted/other forms excluded');
check(count(enemyDirectoryGroups(enemyDirectoryRecords([],$loaded,[]),'古い敵1'))>0,'older-than-200 records findable');
$input=['enemy_name'=>'訂正した敵','enemy_troop'=>'騎兵','enemy_formation'=>'新しい編成','battle_at'=>'2026-10-03T20:00'];
check(updateEnemyMetadata($db,1,$input)==='','metadata update succeeds');
$saved=json_decode($db->query('SELECT payload_json FROM form_submissions WHERE id=1')->fetchColumn(),true);
check($saved['memo']==='保持する本文'&&$saved['future']['nested']==='保持'&&$saved['source_url']==='https://example.com/','memo/source/unknown fields retained');
check($saved['enemy_troop']==='騎馬'&&$saved['battle_at']==='2026-10-03 20:00','new metadata stored');
check((int)$db->query('SELECT COUNT(*) FROM form_submission_files WHERE submission_id=1')->fetchColumn()===2,'no attachments changed');
check(updateEnemyMetadata($db,400,$input)!==''&&updateEnemyMetadata($db,401,$input)!=='','unrelated/deleted records cannot be edited');
check(updateEnemyMetadata($db,1,['battle_at'=>'2026-02-30T12:00'])!==''&&!$db->inTransaction(),'invalid date leaves no transaction/data change');
$page2=renderEnemyDirectory(enemyDirectoryGroups(enemyDirectoryRecords([],$loaded,[])),2,'test-token','',false);
check(substr_count($page2,'class="enemy-history"')===40&&strpos($page2,'data-directory-page="3"')!==false,'directory pagination retains access to older records');
check(enemyMetadata(['battle_at'=>'2026-10-03'])['battle_at']==='2026-10-03','date-only records never receive an invented time');
$db->prepare('UPDATE form_submissions SET payload_json=? WHERE id=2')->execute([json_encode(['enemy_name'=>'旧形式','memo'=>'保存','battle_at'=>'2026年10月3日'])]);check(updateEnemyMetadata($db,2,['enemy_name'=>'名前だけ訂正','battle_at'=>'2026年10月3日'])==='','editing a name preserves an unchanged legacy date');
echo "Enemy directory: UTF-8 fuzzy names, separate identities/troops, history, unknown dates, private attachments, >200 records, SQL metadata retention and pagination PASS\n";

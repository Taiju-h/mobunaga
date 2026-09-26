<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

const DB_CONFIG = '/var/www/.nobunaga-db.ini';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40000000;

function respond(int $status, array $data): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function cfg(): array {
    if (!is_readable(DB_CONFIG)) respond(503, ['ok'=>false,'error'=>'DB設定が未登録です','config_path'=>DB_CONFIG]);
    $ini = parse_ini_file(DB_CONFIG, true, INI_SCANNER_RAW);
    $c = is_array($ini) && isset($ini['mysql']) && is_array($ini['mysql']) ? $ini['mysql'] : [];
    if (empty($c['database']) || empty($c['user']) || !array_key_exists('password', $c)) respond(503, ['ok'=>false,'error'=>'DB設定が不完全です']);
    return $c;
}
function pdo(): PDO {
    $c = cfg();
    $socket = trim((string)($c['unix_socket'] ?? ''));
    if ($socket !== '') $dsn = 'mysql:unix_socket=' . $socket . ';dbname=' . $c['database'] . ';charset=utf8mb4';
    else $dsn = 'mysql:host=' . ($c['host'] ?? 'localhost') . ';port=' . ($c['port'] ?? '3306') . ';dbname=' . $c['database'] . ';charset=utf8mb4';
    try {
        return new PDO($dsn, (string)$c['user'], (string)$c['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (Throwable $e) { respond(503, ['ok'=>false,'error'=>'DBへ接続できません']); }
}
function clean(string $v, int $max): string { return mb_substr(trim($v), 0, $max, 'UTF-8'); }
function formationKey(string $v): string {
    $v = clean($v, 120);
    if ($v === '' || !preg_match('/^[A-Za-z0-9_-]+$/', $v)) respond(400, ['ok'=>false,'error'=>'編成IDが不正です']);
    return $v;
}
function clientIp(): string { return (string)($_SERVER['REMOTE_ADDR'] ?? ''); }
function sameOriginPost(): bool {
    $host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
    $host = preg_replace('/:\d+$/', '', $host);
    $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin === '') return false;
    $oHost = strtolower((string)(parse_url($origin, PHP_URL_HOST) ?? ''));
    return $oHost !== '' && hash_equals($host, $oHost);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$db = pdo();

if ($method === 'GET') {
    $key = formationKey((string)($_GET['formation_id'] ?? ''));
    $st = $db->prepare("SELECT id, formation_key, report_type, result_type, poster_name, comment_text, opponent_text, image_mime, image_size, created_at FROM formation_reports WHERE formation_key=? AND status='published' ORDER BY id DESC LIMIT 100");
    $st->execute([$key]);
    $rows = $st->fetchAll();
    foreach ($rows as &$row) $row['image_url'] = '/api/formation-report-image.php?id=' . (int)$row['id'];
    respond(200, ['ok'=>true,'reports'=>$rows]);
}

if ($method !== 'POST') respond(405, ['ok'=>false,'error'=>'Method Not Allowed']);
if (!sameOriginPost()) respond(403, ['ok'=>false,'error'=>'送信元を確認できません']);
if (!empty($_POST['website'])) respond(400, ['ok'=>false,'error'=>'送信できません']);

$key = formationKey((string)($_POST['formation_id'] ?? ''));
$type = (string)($_POST['report_type'] ?? 'win_with');
$result = (string)($_POST['result_type'] ?? 'win');
if (!in_array($type, ['win_with','counter_win'], true)) respond(400, ['ok'=>false,'error'=>'投稿種別が不正です']);
if (!in_array($result, ['win','loss','draw'], true)) respond(400, ['ok'=>false,'error'=>'結果が不正です']);
$name = clean((string)($_POST['poster_name'] ?? ''), 80); if ($name === '') $name = '匿名';
$comment = clean((string)($_POST['comment_text'] ?? ''), 1000);
$opponent = clean((string)($_POST['opponent_text'] ?? ''), 255);

$c = cfg();
$salt = trim((string)($c['ip_salt'] ?? ''));
if (strlen($salt) < 32) respond(503, ['ok'=>false,'error'=>'DB設定の ip_salt を32文字以上で設定してください']);
$ipHash = hash('sha256', $salt . '|' . clientIp());
$rate = $db->prepare("SELECT COUNT(*) FROM formation_reports WHERE ip_hash=? AND created_at >= (NOW() - INTERVAL 10 MINUTE)");
$rate->execute([$ipHash]);
if ((int)$rate->fetchColumn() >= 5) respond(429, ['ok'=>false,'error'=>'短時間の投稿数が多いため、少し待ってください']);

if (!isset($_FILES['image']) || !is_array($_FILES['image']) || (int)($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) respond(400, ['ok'=>false,'error'=>'画像を選択してください']);
$file = $_FILES['image'];
$size = (int)($file['size'] ?? 0);
if ($size < 1 || $size > MAX_IMAGE_BYTES) respond(400, ['ok'=>false,'error'=>'画像は10MB以下にしてください']);
$tmp = (string)($file['tmp_name'] ?? '');
if ($tmp === '' || !is_uploaded_file($tmp)) respond(400, ['ok'=>false,'error'=>'アップロード画像を確認できません']);
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = (string)$finfo->file($tmp);
if (!in_array($mime, ['image/jpeg','image/png','image/webp'], true)) respond(400, ['ok'=>false,'error'=>'JPG / PNG / WebP のみ投稿できます']);
$info = @getimagesize($tmp);
if (!is_array($info) || empty($info[0]) || empty($info[1])) respond(400, ['ok'=>false,'error'=>'正しい画像ファイルではありません']);
$width = (int)$info[0]; $height = (int)$info[1];
if ($width < 1 || $height < 1 || ($width * $height) > MAX_IMAGE_PIXELS) respond(400, ['ok'=>false,'error'=>'画像サイズが大きすぎます']);
$detectedMime = (string)($info['mime'] ?? '');
if ($detectedMime !== '' && !hash_equals($mime, $detectedMime)) respond(400, ['ok'=>false,'error'=>'画像形式が一致しません']);
$imageData = file_get_contents($tmp);
if ($imageData === false || strlen($imageData) !== $size) respond(500, ['ok'=>false,'error'=>'画像を読み込めません']);

try {
    $st = $db->prepare("INSERT INTO formation_reports (formation_key, report_type, result_type, poster_name, comment_text, opponent_text, image_mime, image_size, image_data, ip_hash, status) VALUES (?,?,?,?,?,?,?,?,?,?,'published')");
    $st->bindValue(1, $key, PDO::PARAM_STR);
    $st->bindValue(2, $type, PDO::PARAM_STR);
    $st->bindValue(3, $result, PDO::PARAM_STR);
    $st->bindValue(4, $name, PDO::PARAM_STR);
    $st->bindValue(5, $comment, PDO::PARAM_STR);
    $st->bindValue(6, $opponent, PDO::PARAM_STR);
    $st->bindValue(7, $mime, PDO::PARAM_STR);
    $st->bindValue(8, $size, PDO::PARAM_INT);
    $st->bindValue(9, $imageData, PDO::PARAM_LOB);
    $st->bindValue(10, $ipHash, PDO::PARAM_STR);
    $st->execute();
    $id = (int)$db->lastInsertId();
} catch (Throwable $e) {
    respond(500, ['ok'=>false,'error'=>'投稿を保存できません']);
}
respond(201, ['ok'=>true,'id'=>$id,'image_url'=>'/api/formation-report-image.php?id='.$id]);

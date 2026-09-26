<?php
declare(strict_types=1);
header('Cache-Control: no-store, private');
header('Pragma: no-cache');
header("Content-Security-Policy: default-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

session_name('mobunaga_analysis_room');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();
if (empty($_SESSION['authorized'])) {
    header('Location: /analysis-room/index.php');
    exit;
}

const DB_CONFIG = '/var/www/.nobunaga-db.ini';
require_once __DIR__ . '/_catalog-export.php';

function e(string $value): string { return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function connectDb(): PDO {
    if (!is_readable(DB_CONFIG)) throw new RuntimeException('DB設定ファイルを読めません: ' . DB_CONFIG);
    $ini = parse_ini_file(DB_CONFIG, true, INI_SCANNER_RAW);
    $c = is_array($ini) && isset($ini['mysql']) && is_array($ini['mysql']) ? $ini['mysql'] : [];
    if (empty($c['database']) || empty($c['user']) || !array_key_exists('password', $c)) throw new RuntimeException('DB設定に database / user / password がありません。');
    $socket = trim((string)($c['unix_socket'] ?? ''));
    $dsn = $socket !== ''
        ? 'mysql:unix_socket=' . $socket . ';dbname=' . $c['database'] . ';charset=utf8mb4'
        : 'mysql:host=' . ($c['host'] ?? 'localhost') . ';port=' . ($c['port'] ?? '3306') . ';dbname=' . $c['database'] . ';charset=utf8mb4';
    return new PDO($dsn, (string)$c['user'], (string)$c['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}

if (empty($_SESSION['catalog_export_csrf'])) $_SESSION['catalog_export_csrf'] = bin2hex(random_bytes(32));
$status = null;
$result = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!hash_equals((string)$_SESSION['catalog_export_csrf'], (string)($_POST['csrf'] ?? ''))) {
        http_response_code(403);
        $status = ['ok'=>false,'message'=>'CSRFトークンが一致しません。'];
    } else {
        try {
            $result = mobunaga_export_catalog(connectDb(), dirname(__DIR__));
            $status = ['ok'=>true,'message'=>'MySQLから database.live.json を再生成しました。'];
        } catch (Throwable $e) {
            $status = ['ok'=>false,'message'=>'生成失敗: '.$e->getMessage()];
        }
    }
}
?><!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>公開JSON再生成 | モブナガ</title><style>body{font-family:system-ui,-apple-system,sans-serif;background:#efe9d9;color:#2b2924;margin:0}.wrap{max-width:860px;margin:40px auto;padding:0 18px}.card{background:#fffdf6;border:1px solid #c4b17f;border-radius:14px;padding:24px;box-shadow:0 10px 30px #0001}h1{margin-top:0}.ok,.ng{padding:12px 14px;border-radius:9px;margin:18px 0}.ok{background:#e5f5e8;color:#145c2b}.ng{background:#fde8e5;color:#8c241c}.actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.actions button{font:700 16px inherit;padding:12px 20px;border:0;border-radius:9px;background:#77591e;color:#fff;cursor:pointer}.actions a{color:#31566b}.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:18px 0}.fact{background:#f7f2e7;border:1px solid #d8caaa;border-radius:10px;padding:14px}.fact strong{display:block;font-size:24px}</style></head><body><div class="wrap"><div class="card"><h1>公開JSON再生成</h1><p>MySQLの武将・能力値・Tier・特性・固有戦法・戦法を <code>assets/database.live.json</code> へ書き出します。サイト本体はこのlive JSONを優先して読み込みます。</p><?php if($status):?><div class="<?=$status['ok']?'ok':'ng'?>"><?=e($status['message'])?></div><?php endif;?><?php if($result):?><div class="facts"><div class="fact">武将<strong><?=e((string)$result['generals'])?></strong></div><div class="fact">戦法<strong><?=e((string)$result['tactics'])?></strong></div><div class="fact">JSONサイズ<strong><?=e(number_format((int)$result['bytes']))?> B</strong></div></div><p><code><?=e((string)$result['path'])?></code></p><?php endif;?><form method="post" class="actions" onsubmit="return confirm('MySQLの内容で公開JSONを再生成します。よろしいですか？')"><input type="hidden" name="csrf" value="<?=e((string)$_SESSION['catalog_export_csrf'])?>"><button type="submit">database.live.json を再生成</button><a href="/admin/s4-import.php">S4登録へ</a><a href="/analysis-room/index.php">資料館へ戻る</a></form></div></div></body></html>
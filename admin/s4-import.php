<?php
declare(strict_types=1);
header('Cache-Control: no-store, private');
header('Pragma: no-cache');
header("Content-Security-Policy: default-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

require_once __DIR__ . '/../includes/analysis-session.php';
if (empty($_SESSION['authorized'])) {
    header('Location: /analysis-room/index.php');
    exit;
}

const DB_CONFIG = '/var/www/.nobunaga-db.ini';
const SQL_FILE = __DIR__ . '/../sql/20260927_s4_full_catalog.sql';
require_once __DIR__ . '/_catalog-export.php';

function e(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

if (empty($_SESSION['s4_import_csrf'])) {
    $_SESSION['s4_import_csrf'] = bin2hex(random_bytes(32));
}

$status = null;
$counts = [];
$exportResult = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $token = (string)($_POST['csrf'] ?? '');
    if (!hash_equals((string)$_SESSION['s4_import_csrf'], $token)) {
        http_response_code(403);
        $status = ['ok' => false, 'message' => 'CSRFトークンが一致しません。'];
    } elseif (!is_readable(DB_CONFIG)) {
        $status = ['ok' => false, 'message' => 'DB設定ファイルを読めません: ' . DB_CONFIG];
    } elseif (!is_readable(SQL_FILE)) {
        $status = ['ok' => false, 'message' => 'SQLバッチを読めません: ' . SQL_FILE];
    } else {
        try {
            $ini = parse_ini_file(DB_CONFIG, true, INI_SCANNER_RAW);
            $c = is_array($ini) && isset($ini['mysql']) && is_array($ini['mysql']) ? $ini['mysql'] : [];
            if (empty($c['database']) || empty($c['user']) || !array_key_exists('password', $c)) {
                throw new RuntimeException('DB設定に database / user / password がありません。');
            }
            $socket = trim((string)($c['unix_socket'] ?? ''));
            $dsn = $socket !== ''
                ? 'mysql:unix_socket=' . $socket . ';dbname=' . $c['database'] . ';charset=utf8mb4'
                : 'mysql:host=' . ($c['host'] ?? 'localhost') . ';port=' . ($c['port'] ?? '3306') . ';dbname=' . $c['database'] . ';charset=utf8mb4';

            $db = new PDO($dsn, (string)$c['user'], (string)$c['password'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);

            $sql = (string)file_get_contents(SQL_FILE);
            $sql = preg_replace('/^\xEF\xBB\xBF/', '', $sql) ?? $sql;
            $sql = preg_replace('/^[\t ]*--.*(?:\r\n|\n|\r|$)/m', '', $sql) ?? $sql;

            $lines = preg_split('/\r\n|\n|\r/', $sql) ?: [];
            $buffer = '';
            $statements = [];
            foreach ($lines as $line) {
                if (trim($line) === '' && $buffer === '') continue;
                $buffer .= $line . "\n";
                if (preg_match('/;\s*$/', $line)) {
                    $statement = trim($buffer);
                    $buffer = '';
                    if ($statement !== '') $statements[] = preg_replace('/;\s*$/', '', $statement) ?? $statement;
                }
            }
            if (trim($buffer) !== '') $statements[] = trim($buffer);

            $executed = 0;
            foreach ($statements as $index => $statement) {
                if ($statement === '') continue;
                try {
                    $db->exec($statement);
                    $executed++;
                } catch (Throwable $statementError) {
                    $preview = preg_replace('/\s+/', ' ', trim($statement)) ?? trim($statement);
                    if (mb_strlen($preview) > 180) $preview = mb_substr($preview, 0, 180) . '…';
                    throw new RuntimeException('SQL #' . ($index + 1) . ' で失敗: ' . $statementError->getMessage() . ' / ' . $preview, 0, $statementError);
                }
            }

            $queries = [
                'S4武将' => "SELECT COUNT(*) FROM general_tiers WHERE season='S4'",
                'S4固有戦法' => "SELECT COUNT(*) FROM tactics WHERE id LIKE 's4-unique-%'",
                'S4事件戦法' => "SELECT COUNT(*) FROM tactics WHERE id LIKE 's4-event-%'",
                'S4レベル値' => "SELECT COUNT(*) FROM tactic_level_values WHERE tactic_id LIKE 's4-%'",
                'S4特性' => "SELECT COUNT(*) FROM general_traits gt JOIN general_tiers gti ON gti.general_id=gt.general_id AND gti.season='S4'",
            ];
            foreach ($queries as $label => $query) $counts[$label] = (int)$db->query($query)->fetchColumn();

            try {
                $exportResult = mobunaga_export_catalog($db, dirname(__DIR__));
                $status = ['ok' => true, 'message' => $executed . ' SQLステートメントを実行し、database.live.json も更新しました。'];
            } catch (Throwable $exportError) {
                $status = ['ok' => false, 'message' => 'MySQL登録は完了しましたが、公開JSON生成に失敗しました: ' . $exportError->getMessage() . ' 「公開JSON再生成」から再実行してください。'];
            }
        } catch (Throwable $ex) {
            $status = ['ok' => false, 'message' => '実行失敗: ' . $ex->getMessage()];
        }
    }
}
?><!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>S4 データ登録 | モブナガ</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;background:#efe9d9;color:#2b2924;margin:0}.wrap{max-width:900px;margin:40px auto;padding:0 18px}.card{background:#fffdf6;border:1px solid #c4b17f;border-radius:14px;padding:24px;box-shadow:0 10px 30px #0001}h1{margin:0 0 8px}.muted{color:#6c6453}.path{font-family:ui-monospace,monospace;background:#f6f0df;padding:10px;border-radius:8px;overflow:auto}.warn{background:#fff1d7;border-left:5px solid #b47b13;padding:12px 14px;margin:18px 0}.ok,.ng{padding:12px 14px;border-radius:9px;margin:18px 0}.ok{background:#e5f5e8;color:#145c2b}.ng{background:#fde8e5;color:#8c241c}.actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.actions button{font:700 16px inherit;padding:12px 20px;border:0;border-radius:9px;background:#77591e;color:#fff;cursor:pointer}.actions a{color:#31566b}.counts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:18px}.count{background:#f7f2e7;border:1px solid #d8caaa;border-radius:10px;padding:14px}.count strong{display:block;font-size:26px;color:#795b16}.export{margin:14px 0;padding:12px;background:#edf4f6;border-radius:9px}</style>
</head>
<body><div class="wrap"><div class="card">
<h1>S4 データ登録</h1>
<p class="muted">S4新武将8名・能力値・Tier・特性・固有戦法・事件戦法・Lv1→Lv10参考値をMySQLへUPSERTし、そのまま公開JSONも再生成します。</p>
<div class="path"><?=e(SQL_FILE)?></div>
<div class="warn"><strong>再実行可能です。</strong> 同じIDは更新されます。Lv2〜Lv9のうち画像に直接表示されていない値は、Lv1→Lv10を線形補間した参考値として <code>is_derived=1</code> で保存します。</div>
<?php if ($status): ?><div class="<?=$status['ok']?'ok':'ng'?>"><?=e($status['message'])?></div><?php endif; ?>
<?php if ($counts): ?><div class="counts"><?php foreach($counts as $label=>$count): ?><div class="count"><span><?=e($label)?></span><strong><?=$count?></strong></div><?php endforeach; ?></div><?php endif; ?>
<?php if ($exportResult): ?><div class="export">公開JSON：<?=e((string)$exportResult['path'])?> ／ 武将 <?=e((string)$exportResult['generals'])?>名 ／ 戦法 <?=e((string)$exportResult['tactics'])?>件</div><?php endif; ?>
<form method="post" class="actions" onsubmit="return confirm('S4登録バッチをMySQLへ実行し、公開JSONも更新します。よろしいですか？')">
<input type="hidden" name="csrf" value="<?=e((string)$_SESSION['s4_import_csrf'])?>">
<button type="submit">S4データを登録 / 更新</button>
<a href="/admin/export-catalog.php">公開JSON再生成</a><a href="/admin/diagnostics.php">DB診断</a><a href="/analysis-room/index.php">資料館へ戻る</a>
</form>
</div></div></body></html>

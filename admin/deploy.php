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

function e(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

$target = (string)($_GET['target'] ?? '');
$allowed = [
    'test' => ['/usr/local/bin/uzero-deploy', 'mobunaga-test', 'normal'],
    'production' => ['/usr/local/bin/uzero-deploy', 'mobunaga', 'normal'],
];
$roots = [
    'test' => '/var/www/nobunaga-test',
    'production' => '/var/www/uzero.style/nobunaga',
];
$status = null;
$output = [];
$exitCode = null;

if ($target !== '') {
    if (!isset($allowed[$target])) {
        http_response_code(400);
        $status = ['ok' => false, 'message' => '不明なデプロイ先です。'];
    } else {
        $parts = array_map('escapeshellarg', $allowed[$target]);
        $command = 'sudo -n ' . implode(' ', $parts) . ' 2>&1';
        exec($command, $output, $exitCode);

        if ($exitCode === 0) {
            $root = $roots[$target];
            $importer = $root . '/tools/import-s4-cli.php';
            if (is_file($importer)) {
                $syncOutput = [];
                $syncExit = null;
                exec('php ' . escapeshellarg($importer) . ' --import-only 2>&1', $syncOutput, $syncExit);
                $output[] = '--- S4 MySQL sync ---';
                array_push($output, ...$syncOutput);

                if ($syncExit !== 0) {
                    $exitCode = $syncExit;
                    $status = ['ok' => false, 'message' => 'S4 MySQL登録・検証で失敗しました（exit ' . $syncExit . '）'];
                } else {
                    $output[] = '--- JSON rebuild after S4 sync ---';
                    $rebuildOutput = [];
                    $rebuildExit = null;
                    exec($command, $rebuildOutput, $rebuildExit);
                    array_push($output, ...$rebuildOutput);
                    $exitCode = $rebuildExit;
                    $status = $rebuildExit === 0
                        ? ['ok' => true, 'message' => ($target === 'test' ? 'テスト' : '本番') . 'デプロイ＋S4 MySQL登録＋公開JSON再生成 完了']
                        : ['ok' => false, 'message' => 'S4登録後の公開JSON再生成で失敗しました（exit ' . $rebuildExit . '）'];
                }
            } else {
                $status = ['ok' => true, 'message' => ($target === 'test' ? 'テスト' : '本番') . 'デプロイ完了（S4自動登録ツール未配置）'];
            }
        } else {
            $status = ['ok' => false, 'message' => 'デプロイ失敗（exit ' . $exitCode . '）'];
        }
    }
}
?><!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>モブナガ デプロイ</title><style>
body{font-family:system-ui,-apple-system,sans-serif;background:#efe9d9;color:#2b2924;margin:0}.wrap{max-width:900px;margin:40px auto;padding:0 18px}.card{background:#fffdf6;border:1px solid #c4b17f;border-radius:14px;padding:24px;box-shadow:0 10px 30px #0001}h1{margin:0 0 8px}.muted{color:#6c6453}.links{display:flex;gap:12px;flex-wrap:wrap;margin:22px 0}.links a{display:inline-block;text-decoration:none;font-weight:800;padding:13px 18px;border-radius:9px;border:1px solid #9b7b32;color:#4d3a0f;background:#f5e7be}.links a.prod{background:#7b1f1f;color:#fff;border-color:#7b1f1f}.ok,.ng{padding:12px 14px;border-radius:9px;margin:18px 0}.ok{background:#e5f5e8;color:#145c2b}.ng{background:#fde8e5;color:#8c241c}pre{white-space:pre-wrap;word-break:break-word;background:#1e2328;color:#e9eef2;padding:16px;border-radius:10px;overflow:auto}.back{color:#31566b}
</style></head><body><div class="wrap"><div class="card"><h1>モブナガ デプロイ</h1><p class="muted">ログイン済みなら、ここからデプロイ→S4 MySQL登録/検証→公開JSON再生成までまとめて実行します。テストは staging、本番は main です。</p><div class="links"><a href="?target=test">テストを今すぐデプロイ</a><a class="prod" href="?target=production">本番を今すぐデプロイ</a></div><?php if($status): ?><div class="<?=$status['ok']?'ok':'ng'?>"><?=e($status['message'])?></div><?php endif; ?><?php if($output): ?><pre><?=e(implode("\n", $output))?></pre><?php endif; ?><p><a class="back" href="/analysis-room/index.php">資料館へ戻る</a></p></div></div></body></html>

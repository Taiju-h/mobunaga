<?php
declare(strict_types=1);
header('Cache-Control: no-store, private');
header('Pragma: no-cache');
header("Content-Security-Policy: default-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

require_once __DIR__ . '/../includes/analysis-session.php';
mobunagaRequireLogin();

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
            $baseImporter = $root . '/tools/import-json-to-mysql-safe.php';
            $s4Importer = $root . '/tools/import-s4-cli.php';
            $limitBreakImporter = $root . '/bin/import-limit-break-roster.php';

            if (!is_file($baseImporter)) {
                $status = ['ok' => false, 'message' => '全武将JSON→MySQL互換インポーターがありません。'];
                $exitCode = 91;
            } elseif (!is_file($s4Importer)) {
                $status = ['ok' => false, 'message' => 'S4自動登録ツールがありません。'];
                $exitCode = 92;
            } elseif (!is_file($limitBreakImporter)) {
                $status = ['ok' => false, 'message' => '凸数名簿DB登録ツールがありません。'];
                $exitCode = 93;
            } else {
                $baseOutput = [];
                $baseExit = null;
                exec('php ' . escapeshellarg($baseImporter) . ' 2>&1', $baseOutput, $baseExit);
                $output[] = '--- FULL catalog MySQL sync ---';
                array_push($output, ...$baseOutput);

                if ($baseExit !== 0) {
                    $exitCode = $baseExit;
                    $status = ['ok' => false, 'message' => '全武将のMySQL同期で失敗しました（exit ' . $baseExit . '）'];
                } else {
                    $s4Output = [];
                    $s4Exit = null;
                    exec('php ' . escapeshellarg($s4Importer) . ' --import-only 2>&1', $s4Output, $s4Exit);
                    $output[] = '--- S4 MySQL override / verification ---';
                    array_push($output, ...$s4Output);

                    if ($s4Exit !== 0) {
                        $exitCode = $s4Exit;
                        $status = ['ok' => false, 'message' => 'S4 MySQL登録・検証で失敗しました（exit ' . $s4Exit . '）'];
                    } else {
                        $limitOutput = [];
                        $limitExit = null;
                        exec('php ' . escapeshellarg($limitBreakImporter) . ' 2>&1', $limitOutput, $limitExit);
                        $output[] = '--- Reviewed convex roster DB sync ---';
                        array_push($output, ...$limitOutput);

                        if ($limitExit !== 0) {
                            $exitCode = $limitExit;
                            $status = ['ok' => false, 'message' => '凸数名簿のDB同期で失敗しました（exit ' . $limitExit . '）'];
                        } else {
                            $output[] = '--- JSON rebuild after full + S4 sync ---';
                            $rebuildOutput = [];
                            $rebuildExit = null;
                            exec($command, $rebuildOutput, $rebuildExit);
                            array_push($output, ...$rebuildOutput);
                            $exitCode = $rebuildExit;
                            $status = $rebuildExit === 0
                                ? ['ok' => true, 'message' => ($target === 'test' ? 'テスト' : '本番') . 'デプロイ＋全武将同期＋S4上書き＋凸数名簿DB同期＋公開JSON再生成 完了']
                                : ['ok' => false, 'message' => '同期後の公開JSON再生成で失敗しました（exit ' . $rebuildExit . '）'];
                        }
                    }
                }
            }
        } else {
            $status = ['ok' => false, 'message' => 'デプロイ失敗（exit ' . $exitCode . '）'];
        }
    }
}
?><!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>モブナガ デプロイ</title><style>
body{font-family:system-ui,-apple-system,sans-serif;background:#efe9d9;color:#2b2924;margin:0}.wrap{max-width:900px;margin:40px auto;padding:0 18px}.card{background:#fffdf6;border:1px solid #c4b17f;border-radius:14px;padding:24px;box-shadow:0 10px 30px #0001}h1{margin:0 0 8px}.muted{color:#6c6453}.links{display:flex;gap:12px;flex-wrap:wrap;margin:22px 0}.links a{display:inline-block;text-decoration:none;font-weight:800;padding:13px 18px;border-radius:9px;border:1px solid #9b7b32;color:#4d3a0f;background:#f5e7be}.links a.prod{background:#7b1f1f;color:#fff;border-color:#7b1f1f}.ok,.ng{padding:12px 14px;border-radius:9px;margin:18px 0}.ok{background:#e5f5e8;color:#145c2b}.ng{background:#fde8e5;color:#8c241c}pre{white-space:pre-wrap;word-break:break-word;background:#1e2328;color:#e9eef2;padding:16px;border-radius:10px;overflow:auto}.back{color:#31566b}
</style></head><body><div class="wrap"><div class="card"><h1>モブナガ デプロイ</h1><p class="muted">ログイン済みなら、ここからデプロイ→全武将JSONをMySQLへ同期→S4データを上書き→公開JSON再生成までまとめて実行します。</p><div class="links"><a href="?target=test">テストを今すぐデプロイ</a><a class="prod" href="?target=production">本番を今すぐデプロイ</a></div><?php if($status): ?><div class="<?=$status['ok']?'ok':'ng'?>"><?=e($status['message'])?></div><?php endif; ?><?php if($output): ?><pre><?=e(implode("\n", $output))?></pre><?php endif; ?><p><a class="back" href="/analysis-room/index.php">資料館へ戻る</a></p></div></div></body></html>

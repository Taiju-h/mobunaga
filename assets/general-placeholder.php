<?php
declare(strict_types=1);
header('X-Content-Type-Options: nosniff');
$slug = isset($_GET['slug']) && is_string($_GET['slug']) ? preg_replace('/[^a-z0-9_-]/i','',$_GET['slug']) : 'general';

// 資料館など旧 /assets/details/*.webp 参照は、武将録で使っている
// /assets/portraits/*.webp をそのまま再利用する。
$portrait = __DIR__ . '/portraits/' . $slug . '.webp';
if ($slug !== '' && is_file($portrait) && is_readable($portrait)) {
    $size = filesize($portrait);
    header('Content-Type: image/webp');
    if ($size !== false) header('Content-Length: ' . $size);
    header('Cache-Control: public, max-age=86400');
    readfile($portrait);
    exit;
}

header('Content-Type: image/svg+xml; charset=utf-8');
header('Cache-Control: public, max-age=300');
$label = $slug !== '' ? strtoupper(substr($slug,0,2)) : '将';
$label = htmlspecialchars($label, ENT_QUOTES|ENT_SUBSTITUTE, 'UTF-8');
echo '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="14" fill="#183f49"/><circle cx="60" cy="49" r="24" fill="#d7b15e"/><path d="M22 112c4-23 19-35 38-35s34 12 38 35" fill="#d7b15e"/><text x="60" y="58" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="700" fill="#173f49">'.$label.'</text></svg>';

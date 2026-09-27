<?php
declare(strict_types=1);
header('Content-Type: application/xml; charset=UTF-8');
header('Cache-Control: public, max-age=3600');

$base = 'https://nobunaga.mobs.tokyo';
$dbPath = __DIR__ . '/assets/database.json';
$formationsPath = __DIR__ . '/assets/formations.json';
$db = is_readable($dbPath) ? json_decode((string)file_get_contents($dbPath), true) : [];
$formations = is_readable($formationsPath) ? json_decode((string)file_get_contents($formationsPath), true) : [];

$urls = [
    $base . '/',
    $base . '/help/',
    $base . '/simulator/',
    $base . '/research/',
    $base . '/s4-startdash/',
    $base . '/s4-startdash/land4/',
    $base . '/s4-startdash/land5/',
];

foreach (($db['generals'] ?? []) as $row) {
    $id = (string)($row['id'] ?? '');
    if ($id !== '' && preg_match('/^[a-z0-9_-]+$/', $id)) {
        $urls[] = $base . '/share.php?type=general&amp;id=' . rawurlencode($id);
    }
}
foreach (($db['tactics'] ?? []) as $row) {
    $id = (string)($row['id'] ?? '');
    if ($id !== '' && preg_match('/^[a-z0-9_-]+$/', $id)) {
        $urls[] = $base . '/share.php?type=tactic&amp;id=' . rawurlencode($id);
    }
}
foreach (($formations['formations'] ?? []) as $row) {
    $id = (string)($row['id'] ?? '');
    if ($id !== '' && preg_match('/^[a-z0-9_-]+$/', $id)) {
        $urls[] = $base . '/share.php?type=formation&amp;id=' . rawurlencode($id);
    }
}

$urls = array_values(array_unique($urls));
echo "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
echo "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n";
foreach ($urls as $url) {
    echo '  <url><loc>' . $url . "</loc></url>\n";
}
echo "</urlset>\n";

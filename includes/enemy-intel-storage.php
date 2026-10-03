<?php
declare(strict_types=1);
if (!defined('MOBUNAGA_ANALYSIS_ROOM')) { http_response_code(404); exit; }

function loadEnemyIntel(PDO $db): array
{
    // Fetch attachment identifiers, never image bytes. Search must include records older than the latest 200.
    $st = $db->prepare("SELECT s.id,s.payload_json,s.status,s.created_at,f.id AS file_id FROM form_submissions s LEFT JOIN form_submission_files f ON f.submission_id=s.id WHERE s.form_key=? AND s.status IN ('new','reviewed','archived') ORDER BY s.id DESC,f.id");
    $st->execute([INTEL_FORM_KEY]);
    return $st->fetchAll();
}

function updateEnemyMetadata(PDO $db, int $id, array $input): string
{
    if ($id < 1) return '記録が見つかりません。';
    try {
        $db->beginTransaction();
        $st = $db->prepare("SELECT payload_json FROM form_submissions WHERE id=? AND form_key=? AND status IN ('new','reviewed','archived') FOR UPDATE");
        $st->execute([$id, INTEL_FORM_KEY]);
        $row = $st->fetch();
        if (!$row) throw new RuntimeException('記録が見つかりません。');
        $payload = json_decode((string)$row['payload_json'], true);
        if (!is_array($payload)) throw new RuntimeException('既存データを読み込めないため、更新を止めました。');
        $unchangedDate = enemyText($input['battle_at'] ?? '') === enemyText($payload['battle_at'] ?? $payload['battle_date'] ?? '');
        $validate = $input;
        if ($unchangedDate) $validate['battle_at'] = '';
        $metadata = enemyMetadata($validate);
        if ($unchangedDate) $metadata['battle_at'] = enemyText($input['battle_at'] ?? '');
        // Preserve the memo, source, future fields and every attachment. Update only the displayed metadata.
        $json = json_encode(array_replace($payload, $metadata), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $st = $db->prepare('UPDATE form_submissions SET payload_json=CAST(? AS JSON) WHERE id=? AND form_key=?');
        $st->execute([$json, $id, INTEL_FORM_KEY]);
        $db->commit();
        return '';
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        return $e instanceof InvalidArgumentException || ($e instanceof RuntimeException && !$e instanceof PDOException) ? $e->getMessage() : '記録情報を保存できませんでした。';
    }
}

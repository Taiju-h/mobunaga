<?php
declare(strict_types=1);
require __DIR__.'/../includes/short-links.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if (($_SERVER['REQUEST_METHOD']??'GET')!=='POST') { header('Allow: POST'); http_response_code(405); echo '{"error":"Method not allowed"}'; exit; }
if (($_SERVER['HTTP_ORIGIN']??'')!=='https://nobunaga.mobs.tokyo') { http_response_code(403); echo '{"error":"Invalid origin"}'; exit; }
try {
    $input=json_decode(file_get_contents('php://input',false,null,0,4097),true,8,JSON_THROW_ON_ERROR);
    if (!is_array($input) || !is_string($input['url']??null)) throw new InvalidArgumentException('Missing URL');
    $target=shortLinkTarget($input['url']);
    $code=shortLinkCreate(shortLinkDb(),$target);
    echo json_encode(['url'=>'https://nobunaga.mobs.tokyo/'.$code],JSON_UNESCAPED_SLASHES);
} catch (InvalidArgumentException|JsonException $e) {
    http_response_code(400); echo '{"error":"Invalid URL"}';
} catch (Throwable $e) {
    http_response_code(503); echo '{"error":"Short links unavailable"}';
}

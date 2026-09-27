<?php
// Legacy shared URLs only route to the catalog. No JSON/DB/template dependency.
header('Cache-Control: no-store');
$types = array('general'=>'generals', 'tactic'=>'tactics', 'formation'=>'formations');
$type = isset($_GET['type']) && is_string($_GET['type']) ? $_GET['type'] : '';
$id = isset($_GET['id']) && is_string($_GET['id']) ? $_GET['id'] : '';
if (!isset($types[$type]) || !preg_match('/^[a-z0-9_-]{1,120}$/D', $id)) {
    http_response_code(404);
    exit('Not found');
}
$params = array('open'=>$types[$type], 'id'=>$id);
if (isset($_GET['season']) && is_string($_GET['season']) && preg_match('/^[1-9][0-9]?$/D', $_GET['season'])) {
    $params['season'] = $_GET['season'];
}
header('Location: /?'.http_build_query($params).'#'.$types[$type], true, 302);
exit;

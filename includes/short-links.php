<?php
declare(strict_types=1);

/** Only catalog views can be shortened; never accept external or action URLs. */
function shortLinkTarget(string $url): string
{
    if (strlen($url)>2000 || preg_match('/[\x00-\x20\x7f\\\\]/', $url)) throw new InvalidArgumentException('Invalid URL');
    $p=parse_url($url);
    if (!$p || ($p['scheme']??'')!=='https' || ($p['host']??'')!=='nobunaga.mobs.tokyo' || isset($p['user']) || isset($p['pass']) || isset($p['port']) || !in_array($p['path']??'/', ['/','/index.html'],true)) throw new InvalidArgumentException('Invalid destination');
    parse_str($p['query']??'', $query);
    $out=[];
    foreach ($query as $key=>$value) {
        if (!is_string($value)) throw new InvalidArgumentException('Invalid parameter');
        $valid=match($key) {
            'open'=>in_array($value,['generals','tactics','formations'],true),
            'id'=>(bool)preg_match('/^[a-z0-9_-]{1,120}$/D',$value),
            'season'=>(bool)preg_match('/^[1-9][0-9]?$/D',$value),
            'seasons'=>(bool)preg_match('/^[1-9][0-9]?(?:,[1-9][0-9]?)*$/D',$value),
            default=>false
        };
        if (!$valid) throw new InvalidArgumentException('Invalid parameter');
        $out[$key]=$value;
    }
    ksort($out);
    $fragment=$p['fragment']??'';
    if ($fragment!=='' && !in_array($fragment,['generals','tactics','formations'],true)) throw new InvalidArgumentException('Invalid view');
    return '/'.($out?'?'.http_build_query($out,'','&',PHP_QUERY_RFC3986):'').($fragment!==''?'#'.$fragment:'');
}

function shortLinkDb(): PDO
{
    $ini=parse_ini_file('/var/www/.nobunaga-db.ini',true,INI_SCANNER_RAW);
    $c=$ini['mysql']??[];
    $dsn=!empty($c['unix_socket'])?'mysql:unix_socket='.$c['unix_socket']:'mysql:host='.($c['host']??'localhost').';port='.($c['port']??3306);
    return new PDO($dsn.';dbname='.$c['database'].';charset=utf8mb4',$c['user'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
}

function shortLinkCreate(PDO $db, string $target): string
{
    // Stored in MySQL so deploys never remove existing shared URLs.
    $db->exec("CREATE TABLE IF NOT EXISTS short_links (code VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY, target_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE, target_url TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX(created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $hash=hash('sha256',$target);
    $find=$db->prepare('SELECT code FROM short_links WHERE target_hash=?');
    $find->execute([$hash]);
    if ($code=$find->fetchColumn()) return $code;
    if ((int)$db->query('SELECT COUNT(*) FROM short_links WHERE created_at >= NOW() - INTERVAL 1 MINUTE')->fetchColumn()>=60) throw new RuntimeException('Too many links');
    $insert=$db->prepare('INSERT INTO short_links (code,target_hash,target_url) VALUES (?,?,?)');
    $alphabet='abcdefghijklmnopqrstuvwxyz0123456789';
    for($attempt=0;$attempt<40;$attempt++) {
        $code=chr(random_int(97,122));
        for($i=1;$i<3+intdiv($attempt,10);$i++) $code.=$alphabet[random_int(0,35)];
        if (file_exists(dirname(__DIR__).'/'.$code)) continue;
        try { $insert->execute([$code,$hash,$target]); return $code; }
        catch(PDOException $e) {
            if ((string)$e->getCode()!=='23000') throw $e;
            $find->execute([$hash]);
            if ($existing=$find->fetchColumn()) return $existing;
        }
    }
    throw new RuntimeException('Could not allocate link');
}

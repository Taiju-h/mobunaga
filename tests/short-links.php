<?php
declare(strict_types=1);
require __DIR__.'/../includes/short-links.php';
function check(bool $ok):void { if(!$ok) throw new RuntimeException('Short link validation failed'); }
check(shortLinkTarget('https://nobunaga.mobs.tokyo/?season=4&open=generals&id=takeda#generals')==='/?id=takeda&open=generals&season=4#generals');
check(shortLinkTarget('https://nobunaga.mobs.tokyo/?seasons=1%2C4#formations')==='/?seasons=1%2C4#formations');
check(shortLinkTarget('https://nobunaga.mobs.tokyo/index.html')==='/');
foreach (['https://evil.example/','//evil.example/','https://nobunaga.mobs.tokyo@evil.example/','https://user@nobunaga.mobs.tokyo/','https://nobunaga.mobs.tokyo:443/','https://nobunaga.mobs.tokyo/admin/deploy.php','https://nobunaga.mobs.tokyo/?next=https://evil.example','https://nobunaga.mobs.tokyo/?id[]=x','https://nobunaga.mobs.tokyo/?id=%0d%0aLocation:evil','https://nobunaga.mobs.tokyo/#evil',"https://nobunaga.mobs.tokyo/\r\nX:evil"] as $bad) {
    try { shortLinkTarget($bad); throw new RuntimeException('Unsafe destination accepted'); }
    catch (InvalidArgumentException $e) {}
}
echo "short-links: catalog context preserved; external/action/control/array destinations rejected PASS\n";

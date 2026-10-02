/* Run: NODE_PATH=<path containing playwright> node tests/consultation-flow.cjs
 * Serve repository at http://127.0.0.1:8765, or set CONSULTATION_TEST_URL. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const context={URL};context.globalThis=context;vm.createContext(context);
for(const f of ['core.js','evidence.js'])vm.runInContext(fs.readFileSync(path.join(root,'consultation',f),'utf8'),context);
const C=context.MobunagaConsult;
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const base=read('assets/formations.json'),s4=read('assets/s4-templates.json');
const db=C.catalog(read('assets/database.json'),read('assets/s4-additions.json'),base);
const index=C.evidenceIndex(db,4),forms=C.templatesForSeason(base,s4,4);
assert.equal(forms.length,105);
const anchor=forms[0].members[0].general_id;
const exclude=forms[0].members[1].general_id;
assert(C.eligible(forms,anchor,[exclude]).every(f=>f.members.every(m=>m.general_id!==exclude)));
const baseline=C.candidates(forms,{general:anchor,purpose:'pvp',counters:[],excluded:[]},index);
const strict=C.candidates(forms,{general:anchor,purpose:'pvp',counters:['confusion','heal'],match:'all',excluded:[]},index);
assert(strict.every(r=>r.evidence.supports.confusion.length&&r.evidence.supports.heal.length));
assert(strict.length<=baseline.length);
// Receiving normal attacks is not itself a defensive counter.
const fake={id:'test',members:[{general_id:'oohouritsuru',tactics:[]}]};
assert.equal(C.formationEvidence(fake,index).supports.attack.length,0);
const kenshin=C.formationEvidence({members:[{general_id:'uesugikenshin',tactics:[]}]},index);
assert(kenshin.supports.confusion.some(e=>e.name==='義の将'));
assert.equal(kenshin.supports.stop.length,0);
// Future tactics must never yield earlier-season evidence, including name fallbacks.
const early=C.evidenceIndex(db,1);
assert.equal(early.tactics.has('tr027'),false);
const earlyEvidence=C.formationEvidence({members:[{general_id:'uesugikenshin',tactics:[{tactic_id:'tr027',tactic_name:'直諫敢行'}]}]},early);
assert(!earlyEvidence.supports.burst.some(e=>e.name==='直諫敢行'));
(async()=>{
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:["--no-sandbox"]}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.CONSULTATION_TEST_URL||'http://127.0.0.1:8765/consultation/?season=4');
await page.locator('#workspace').waitFor({state:'visible'});
const title=()=>page.locator('#step-title').innerText();
assert.equal(await title(),'目的');
await page.locator('[data-purpose=land]').click();assert.equal(await title(),'土地レベル');
assert(await page.locator('[data-next]').isDisabled());
await page.locator('[data-level="6"]').click();await page.locator('[data-next]').click();
assert.equal(await title(),'使いたい武将');assert(await page.locator('[data-next]').isDisabled());
assert.equal(await page.locator('[data-general]').count(),137);
await page.locator('#family').selectOption({label:'豊臣家'});assert((await page.locator('[data-general]').count())<137);
await page.locator('#family').selectOption('');
await page.locator('[data-general="matsu"]').click();
await page.locator('#query').fill('存在しない武将');assert.equal(await page.locator('[data-general]').count(),0);
assert((await page.locator('#selected-general').innerText()).includes('まつ'));
await page.locator('#query').fill('');await page.locator('[data-next]').click();assert.equal(await title(),'その他の武将を引き算');
assert(await page.locator('[data-exclude="matsu"]').isDisabled());
const prior=await page.locator('#exclusion-summary').innerText();
await page.locator('[data-exclude="sanadamasayuki"]').click();
assert.notEqual(await page.locator('#exclusion-summary').innerText(),prior);
await page.locator('#exclusion-summary [data-exclude="sanadamasayuki"]').click();
assert.equal(await page.locator('#exclusion-summary').innerText(),prior);
await page.locator('.flow-roster [data-exclude="sanadamasayuki"]').click();
await page.locator('[data-next]').click();assert.equal(await title(),'編成一覧');
assert.equal(await page.locator('.candidate .soldier strong').filter({hasText:'真田昌幸'}).count(),0);
assert((await page.locator('#step-content').innerText()).includes('土地6'));
await page.screenshot({path:'/tmp/mobunaga-flow-land.png',fullPage:true});
// Going back and changing an upstream answer invalidates later completion.
await page.locator('#flow [data-go="general"]').click();await page.locator('[data-unpin="matsu"]').click();await page.locator('[data-general="kikkawahiroie"]').click();
assert(await page.locator('#flow [data-go="results"]').isDisabled());
await page.locator('[data-next]').click();await page.locator('[data-next]').click();
assert((await page.locator('.empty').innerText()).includes('0件'));
// PvP skips land/enemy/exclusion questions and supports multiple filters.
await page.locator('[data-purpose=pvp]').click();assert.equal(await title(),'使いたい武将');
await page.locator('[data-general="matsu"]').click();await page.locator('[data-next]').click();assert.equal(await title(),'編成一覧');
assert((await page.locator('.candidate').count())>0);
await page.locator('.candidate .evidence').first().locator('summary').first().click();
assert((await page.locator('.candidate').first().innerText()).includes('淑徳'));
// Meta: multi select, search must preserve selected enemies, per-enemy comparison.
await page.locator('[data-purpose=meta]').click();assert.equal(await title(),'メタしたいテンプレート');
assert(await page.locator('[data-next]').isDisabled());
await page.locator('[data-enemy-check]').nth(0).check();await page.locator('[data-enemy-check]').nth(1).check();
await page.locator('#enemy-query').fill('存在しない武将');assert.equal(await page.locator('[data-enemy-check]').count(),0);
assert((await page.locator('.selection-summary').innerText()).includes('2編成'));
await page.locator('#enemy-query').fill('');await page.locator('[data-next]').click();
await page.locator('[data-general="matsu"]').click();await page.locator('[data-next]').click();

assert.equal(await page.locator('.candidate').first().locator('.matchup').count(),2);
await page.screenshot({path:'/tmp/mobunaga-flow-meta.png',fullPage:true});
// Earlier season resets all answers and changes both URL and catalog.
await page.locator('#season').selectOption('1');assert.equal(await title(),'目的');
assert(page.url().includes('season=1'));
await page.locator('[data-purpose=pvp]').click();assert.equal(await page.locator('[data-general="datemasamune"]').count(),0);
await page.reload();await page.locator('#workspace').waitFor({state:'visible'});assert.equal(await page.locator('#season').inputValue(),'1');
await page.locator('#season').selectOption('4');
// Mobile layout and one-step screen. No horizontal overflow.
await page.setViewportSize({width:390,height:844});
await page.locator('[data-purpose=land]').click();await page.locator('[data-level="8"]').click();await page.locator('[data-next]').click();
await page.locator('[data-general="matsu"]').click();
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.screenshot({path:'/tmp/mobunaga-flow-mobile.png',fullPage:true});
assert.deepEqual(errors,[]);
console.log(JSON.stringify({ok:true,templates:forms.length,journeys:['land','pvp','meta'],checked:'exclusions, explicit choices, multiple enemies, evidence, zero results, backtracking, seasons, mobile'},null,2));
await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

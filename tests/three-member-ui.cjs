const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8765/consultation/?season=4');await page.locator('#workspace').waitFor({state:'visible'});
await page.locator('[data-purpose=pvp]').click();assert.equal(await page.locator('.empty-slot').count(),3);
for(const id of ['kakizakikageie','matsu','toyotomihideyoshi'])await page.locator(`[data-general=${id}]`).click();
assert.equal(await page.locator('.selected-slot').count(),3);assert.equal(await page.locator('.empty-slot').count(),0);assert.equal(await page.locator('.balance-radar').count(),1);
assert.equal(await page.locator('[data-pin-candidate]').count(),0);assert((await page.locator('.advisor-recommendations').innerText()).includes('3人を選択済み'));
await page.locator('[data-tactic-goal]').selectOption('mitigation');
if(!await page.locator('[data-apply-tactic]').count())await page.locator('[data-tactic-goal]').selectOption('recovery');
assert((await page.locator('[data-apply-tactic]').count())>0);
const before=await page.locator('.quick-tactics [data-tactic]').evaluateAll(els=>els.map(e=>e.value));await page.locator('[data-apply-tactic]').first().click();const after=await page.locator('.quick-tactics [data-tactic]').evaluateAll(els=>els.map(e=>e.value));assert.equal(before.filter((v,i)=>v!==after[i]).length,1);assert.equal(after.length,6);
await page.locator('[data-unpin=toyotomihideyoshi]').click();assert.equal(await page.locator('[data-tactic-goal]').count(),0);assert((await page.locator('[data-pin-candidate]').count())>0);
for(const sort of ['martial','intellect','defense','healing']){await page.locator('[data-recommend-sort]').selectOption(sort);const vals=await page.locator('[data-sort-value]').evaluateAll(els=>els.map(e=>Number(e.dataset.sortValue)));assert(vals.every((v,i)=>i===0||vals[i-1]>=v));}
const id=await page.locator('[data-pin-candidate]').first().getAttribute('data-pin-candidate');await page.locator('[data-pin-candidate]').first().click();assert.equal(await page.locator(`[data-unpin=${id}]`).count(),1);assert.equal(await page.locator('.selected-slot').count(),3);assert.equal(await page.locator('[data-pin-candidate]').count(),0);assert.equal(await page.locator('.quick-tactics [data-tactic]').count(),6);
await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('.selection-heading').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/mobunaga-three-mobile.png'});
assert.deepEqual(errors,[]);console.log('Three-member UI: visible slots, direct selection, full-team diagnostic, tactic adoption, all four sort orders, selecting recommended third, mobile PASS');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

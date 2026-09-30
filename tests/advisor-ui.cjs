const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.CONSULTATION_TEST_URL||'http://127.0.0.1:8765/consultation/?season=4');
await page.locator('#workspace').waitFor({state:'visible'});
await page.locator('[data-purpose=pvp]').click();
await page.locator('[data-general=kakizakikageie]').click();await page.locator('[data-general=matsu]').click();
assert(!(await page.locator('[data-general=toyotomihideyoshi]').isDisabled()));
assert.equal(await page.locator('[data-unpin]').count(),2);
await page.locator('[data-next]').click();await page.locator('[data-next]').click();
assert((await page.locator('#advisor-root .brief h3').innerText()).includes('柿崎景家・まつ'));
for(const candidate of await page.locator('.candidate').all()){const t=await candidate.innerText();assert(t.includes('まつ')&&t.includes('柿崎景家'));}
// Exclude a recommended member, shrink and restore. Both fixed members stay selected.
const first=await page.locator('[data-unowned]').first().getAttribute('data-unowned');
await page.locator('[data-unowned]').first().click();
assert.equal(await page.locator(`[data-preview="${first}"]`).count(),0);
assert.equal(await page.locator(`.unowned-small[data-restore="${first}"]`).count(),1);
assert((await page.evaluate(()=>JSON.parse(localStorage.getItem('mobunagaAdvisorUnowned')))).includes(first));
await page.locator(`[data-restore="${first}"]`).click();
assert.equal(await page.locator(`[data-unowned="${first}"]`).count(),1);
await page.locator('[data-preview]').first().click();assert.equal(await page.locator('#advisor-root .advisor-settings .profile-settings').count(),3);
await page.locator('[data-clear-preview]').click();assert.equal(await page.locator('#advisor-root .advisor-settings .profile-settings').count(),2);
// Load a derived template and edit command-dependent healing on any holder.
await page.locator('.rikuryoku-variants>summary').click();assert((await page.locator('[data-variant]').count())>0);
await page.locator('[data-variant]').first().click();assert((await page.locator('#advisor-root .selection-summary').innerText()).includes('原典とは別案'));
await page.locator('.advisor-settings>summary').click();
assert.equal(await page.locator('.rikuryoku-settings').count(),1);
const owner=await page.locator('[data-stat=rikuryokuRate]').getAttribute('data-owner');
await page.locator('[data-stat=rikuryokuRate]').fill('50');await page.locator('[data-stat=rikuryokuRate]').press('Tab');
assert.equal(await page.locator('[data-stat=rikuryokuRate]').inputValue(),'50');
await page.locator('[data-stat=rikuryokuHeal]').fill('160');await page.locator('[data-stat=rikuryokuHeal]').press('Tab');
await page.locator('[data-stat=rikuryokuTarget]').selectOption('others');
await page.locator('[data-scenario=activeUptime]').fill('0');await page.locator('[data-scenario=activeUptime]').press('Tab');
assert.equal(await page.locator('[data-stat=rikuryokuTarget]').inputValue(),'others');
assert.equal(await page.locator(`[data-stat=rikuryokuHeal][data-owner="${owner}"]`).inputValue(),'160');
await page.setViewportSize({width:390,height:844});
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.locator('.advisor-settings>summary').click();
await page.locator('#advisor-root').screenshot({path:'/tmp/mobunaga-advisor-mobile.png'});
// Removing the last fixed member must invalidate results and never crash.
await page.locator('[data-unpin=matsu]').click();await page.locator('[data-unpin=kakizakikageie]').click();
assert.equal(await page.locator('#step-title').innerText(),'使いたい武将');assert(await page.locator('#flow [data-go=results]').isDisabled());
await page.locator('#season').selectOption('3');await page.locator('[data-purpose=pvp]').click();await page.locator('[data-general=matsu]').click();await page.locator('[data-next]').click();await page.locator('[data-next]').click();
assert.equal(await page.locator('.rikuryoku-variants').count(),0);assert.equal(await page.locator('option[value=naganonarimasa-rikuryokudoushin]').count(),0);
assert.deepEqual(errors,[]);console.log('Advisor UI: two fixed, unowned restore/storage, preview, Nagano replacement and inputs, mobile, backtracking, season isolation PASS');
await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

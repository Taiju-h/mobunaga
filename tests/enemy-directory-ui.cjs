const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),{JSDOM,VirtualConsole,CookieJar}=require('jsdom'),path=require('node:path');
const base=process.env.ARCHIVE_TEST_URL||'http://127.0.0.1:8777/analysis-room/index.php',php=process.env.PHP_BIN||'php',root=path.resolve(__dirname,'..');
(async()=>{
 const unauth=await fetch(base+'?format=directory&q=一瀬');assert.equal(unauth.status,401);assert((await unauth.json()).error.includes('再入館'));assert(unauth.headers.get('cache-control').includes('private'));
 const login=await fetch(base);assert((await login.text()).includes('name="passphrase"'));
 const helper=await fetch(new URL('/analysis-room/directory-view.php',base));assert.equal(helper.status,404);
 // Create a disposable local test session, never a production sign-in or production credential.
 const sid=execFileSync(php,['-n','-r','require "includes/analysis-session.php"; mobunagaAuthorize(); $_SESSION["csrf"]="test-only-token"; echo session_id();'],{cwd:root,encoding:'utf8'}).trim();
 const cookie='mobunaga_analysis_room='+sid,jar=new CookieJar();jar.setCookieSync(cookie,base);
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=await JSDOM.fromURL(base,{cookieJar:jar,resources:'usable',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){w.AbortController=AbortController;w.AbortSignal=AbortSignal;w.fetch=(u,o)=>fetch(new URL(u,w.location.href),{...o,headers:{...o?.headers,Cookie:cookie}});}}),w=dom.window,d=w.document;
 const wait=async predicate=>{for(let i=0;i<150&&!predicate();i++)await new Promise(r=>setTimeout(r,20));assert(predicate(),JSON.stringify({errors,ready:d.readyState,error:d.querySelector('.directory-error')?.textContent,result:d.querySelector('[data-enemy-results]')?.textContent.slice(0,100)}));};
 await wait(()=>d.readyState==='complete'&&!!d.querySelector('[data-enemy-search]')); const initial=d.querySelector('[data-enemy-results]').textContent;
 assert(d.querySelector('.enemy-player'));assert(d.querySelector('.enemy-troop').textContent.includes('未記録'));assert(!d.querySelector('.enemy-history').open);
 d.querySelector('.enemy-history>summary').click();assert(d.querySelector('.enemy-history').open);assert(d.querySelector('.enemy-record-meta').textContent.includes('対戦日時'));assert(d.querySelector('.enemy-record h4').textContent.length>0);
 const query=d.querySelector('input[name=q]'),form=d.querySelector('[data-enemy-search]');
 query.focus();query.value='一瀬楽長';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>d.querySelector('.name-match')?.textContent.includes('似た名前'));
 assert([...d.querySelectorAll('.enemy-player')].every(e=>e.textContent==='一瀬楽章'));assert(w.location.search.includes('q='));
 query.value='いない敵です';query.dispatchEvent(new w.Event('input',{bubbles:true}));await wait(()=>!!d.querySelector('.archive-empty'));assert(d.querySelector('.archive-empty').textContent.includes('一致する敵記録がありません'));
 query.value='';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>d.querySelector('[data-enemy-results]').textContent===initial);
 assert.equal(d.activeElement,query,'search textbox retains focus');
 const snapshot=d.querySelector('[data-enemy-results]').innerHTML;w.fetch=async()=>({ok:false,status:401,json:async()=>({error:'入館の有効期限が切れました。合言葉で再入館してください。'})});
 form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>!d.querySelector('.directory-error').hidden&&d.querySelector('.directory-error').textContent.includes('再入館'));assert.equal(d.querySelector('[data-enemy-results]').innerHTML,snapshot,'failure preserves previous records');
 // A late response from an older search cannot overwrite a newer query.
 const pending=[];w.fetch=()=>new Promise(resolve=>pending.push(resolve));query.value='古い検索';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));query.value='新しい検索';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 pending[1]({ok:true,json:async()=>({html:'<p>最新の検索結果</p>'})});await wait(()=>d.querySelector('[data-enemy-results]').textContent.includes('最新の検索結果'));pending[0]({ok:true,json:async()=>({html:'<p>古い検索結果</p>'})});await new Promise(r=>setTimeout(r,30));assert(!d.querySelector('[data-enemy-results]').textContent.includes('古い検索結果'));
 const badPost=await fetch(base,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/x-www-form-urlencoded'},body:'action=update_enemy_metadata&csrf=wrong&intel_id=1&enemy_name=forbidden'});assert.equal(badPost.status,403);
 assert.deepEqual(errors,[]);dom.window.close();console.log('Enemy directory UI: auth/CSRF gates, compact click-to-expand history, fuzzy live search, empty results, expired sessions and stale-response protection PASS');
})().catch(e=>{console.error(e);process.exit(1)});

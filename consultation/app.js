"use strict";
(() => {
const C=window.MobunagaConsult,$=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const version=document.documentElement.dataset.version;
const url=path=>path+"?v="+encodeURIComponent(version);
function storedSeason(){try{return Number(localStorage.getItem("mobunagaSeason"));}catch{return 0;}}
const requested=Number(new URLSearchParams(location.search).get("season"));
const initial=[1,2,3,4].includes(requested)?requested:([1,2,3,4].includes(storedSeason())?storedSeason():4);
const state={season:initial,purpose:"",step:"general",furthest:0,level:null,general:"",generals:[],enemies:[],counters:[],excluded:[],family:"",query:"",enemyQuery:"",enemyTier:"",match:"all"};
let catalog,base,s4,allGenerals=[],templates=[],counts=new Map(),generalMap=new Map(),index;
const labels={general:"使いたい武将を3人選ぶ",results:"Tier平均と比較"};
async function getJSON(path){const r=await fetch(url(path),{cache:"no-cache"});if(!r.ok)throw Error("HTTP "+r.status);return r.json();}
async function liveOrBase(name){const r=await fetch(url("../assets/"+name+".live.json"),{cache:"no-cache"});if(r.ok)return r.json();if(r.status!==404)throw Error("HTTP "+r.status);return getJSON("../assets/"+name+".json");}
function image(g){const p=g?.portrait;return typeof p==="string"&&/^assets\/portraits\/[a-z0-9_-]+\.webp$/.test(p)?'<img class="portrait" src="'+esc(url("../"+p))+'" alt="" loading="lazy">':'<span class="portrait portrait-fallback" aria-hidden="true">将</span>';}
function sourceLink(href,text){const safe=C.safeLink(href);return safe?'<a href="'+esc(safe)+'" target="_blank" rel="noopener">'+esc(text)+'</a>':esc(text);}
function formationHTML(f,open=false){
 const members=f.members.map(m=>'<div class="soldier">'+image(generalMap.get(m.general_id))+'<div><span>'+esc(m.role)+'</span><strong>'+esc(m.general_name)+'</strong></div></div>').join("");
 const body=f.members.map(m=>'<section><h4>'+esc(m.general_name)+'</h4><dl><dt>戦法</dt><dd>'+m.tactics.map(t=>esc(t.tactic_name)).join(" / ")+'</dd><dt>能力振り</dt><dd>'+esc(m.attribute_plan||"記載なし")+'</dd><dt>主兵学</dt><dd>'+esc(m.main_school||"記載なし")+'</dd><dt>副兵学</dt><dd>'+esc(m.sub_school||"記載なし")+'</dd></dl></section>').join("");
 return '<details class="formation"'+(open?' open':'')+'><summary><div class="formation-title"><span class="tag">'+esc(f.tier||"評価未収録")+'</span><b>'+esc(f.troops?.replaceAll(",","・")||"兵種未指定")+'</b><small>'+esc(f.id)+(f.cost?' / COST '+esc(f.cost):'')+'</small></div><div class="team-row">'+members+'</div></summary><div class="formation-body"><div class="member-grid">'+body+'</div>'+((f.requirement||f.template_notes)?'<div class="source-note"><b>掲載条件・代替案</b>'+esc([f.requirement,f.template_notes].filter(Boolean).join("\n"))+'</div>':'')+'<p class="source-link">'+sourceLink(f.source?.source_url,"出典の編成表 "+(f.source_index||"")+" を確認")+'</p><p class="fine">Tierは出典の掲載評価。表記を保持しているため、戦法名に表記揺れが含まれる場合があります。</p></div></details>';
}
function reset(){advisorUI.clearPreview();Object.assign(state,{purpose:"",step:"general",furthest:0,level:null,general:"",generals:[],enemies:[],counters:[],excluded:[],family:"",query:"",enemyQuery:"",enemyTier:"",match:"all"});}
function route(){return ["general","results"];}
function invalidate(){state.furthest=route().indexOf(state.step);}
function go(step){state.step=step;state.furthest=Math.max(state.furthest,route().indexOf(step));render();$("step-title").focus();}
function summary(step){return step==='general'?state.generals.map(id=>generalMap.get(id)?.name).join('・')||'未選択':'攻撃・防御・回復・妨害';}
function allowedNext(){return state.generals.length>0;}

function refreshSeason(){
 allGenerals=catalog.generals.filter(g=>C.firstSeason(g)<=state.season);generalMap=new Map(allGenerals.map(g=>[g.id,g]));
 templates=C.templatesForSeason(base,s4,state.season).filter(f=>f.members.every(m=>generalMap.has(m.general_id)));
 counts=C.popularity(allGenerals,templates);index=C.evidenceIndex(catalog,state.season);
 $("source-count").textContent="S"+state.season+" · "+templates.length+"編成";
 $("source-link").href=state.season===4?s4.meta.source_url:"https://www.sanguo-zhi.com/entry/s"+state.season+"-template/";
 $("data-summary").textContent="武将"+allGenerals.length+"名 / "+new Set(allGenerals.map(C.family)).size+"家門 · 採用件数はS"+state.season+"の掲載表のみ";
 document.querySelectorAll('a.brand,.header-tools>a').forEach(a=>a.href="../?season="+state.season);
 render();
}
function visibleGenerals(){const q=state.query.normalize("NFKC").trim().toLowerCase();return C.rank(allGenerals,templates).filter(g=>(!state.family||C.family(g)===state.family)&&(!q||(g.name+" "+(g.kana||"")).normalize("NFKC").toLowerCase().includes(q)));}
function filters(){return '<div class="roster-filters"><div class="field"><label for="family">家門を選択</label><select id="family"><option value="">全家門</option>'+[...new Set(allGenerals.map(C.family))].sort((a,b)=>a.localeCompare(b,"ja")).map(f=>'<option'+(state.family===f?' selected':'')+' value="'+esc(f)+'">'+esc(f)+'</option>').join("")+'</select></div><div class="field"><label for="query">武将名で検索</label><input type="search" id="query" value="'+esc(state.query)+'" placeholder="武将名・ふりがな" autocomplete="off"></div></div>';}
function rosterHTML(exclude=false){const visible=visibleGenerals();const related=C.eligible(templates,state.generals);const pairs=C.popularity(allGenerals,related);
 return '<div class="roster-heading"><b>人気順</b><span>'+visible.length+' / '+allGenerals.length+'名</span></div><p class="fine">S'+state.season+'のテンプレート採用件数順。0件の武将も選べます。</p><div class="roster flow-roster">'+(visible.length?visible.map(g=>{
 const pinned=exclude&&state.generals.includes(g.id),removed=state.excluded.includes(g.id);
 return '<button class="general-button'+(removed?' excluded':'')+'" '+(exclude?'data-exclude':'data-general')+'="'+esc(g.id)+'" aria-pressed="'+(exclude?removed:state.generals.includes(g.id))+'"'+(pinned||(!exclude&&state.generals.length===3&&!state.generals.includes(g.id))?' disabled':'')+'>'+image(g)+'<span><b>'+esc(g.name)+'</b><small>'+esc(C.family(g))+' / COST '+esc(g.cost??"—")+'</small>'+(exclude?'<small>'+(pinned?'軸に固定':removed?'除外中・押すと戻す':'候補に残す・押すと除外')+' / 同時採用 '+(pairs.get(g.id)||0)+'件</small>':'')+'</span><span class="count">'+(counts.get(g.id)||0)+'<small>件</small></span></button>';
 }).join(""):'<p class="empty">該当する武将がいません。家門か検索条件を変更してください。</p>')+'</div>';
}
function selectedGeneral(){return '<div class="selection-heading"><b>使いたい武将：'+state.generals.length+' / 3人</b><span class="fine">3人選ぶと自動でTier比較へ。1〜2人でも進めます</span></div><p class="fine">最初に選んだ武将が仮大将です。空き枠は比較画面で選べます。選択済みの武将を押すと解除します。</p><div class="general-slots">'+[0,1,2].map(i=>{const g=generalMap.get(state.generals[i]);return g?'<button class="small-button selected-slot" data-unpin="'+esc(g.id)+'">'+image(g)+'<span>'+esc(g.name)+'<small>'+(i===0?'仮大将':'副将')+' / 解除 ×</small></span></button>':'<div class="empty-slot"><b>'+ (i+1)+'人目：未選択</b><small>今選ぶ／後で推薦から選ぶ</small></div>';}).join('')+'</div>'+(state.generals.length?'<p class="fine">'+state.generals.length+'人を固定 / 同時採用 '+C.eligible(templates,state.generals).length+'編成'+(state.generals.length===3?' / 3人の戦法込みで比較します':'')+'</p>':'');}
function allExcluded(){return [...new Set([...state.excluded,...advisorUI.unowned()])].filter(id=>!state.generals.includes(id));}

function resultsHTML(){const matches=C.eligible(templates,state.generals,allExcluded());
 return '<div id="advisor-root"></div><details class="guide published-matches"><summary>選んだ武将を含む掲載テンプレート（'+matches.length+'件）</summary><p class="fine">掲載戦法を読み込んで、Tier平均との位置を比較できます。</p>'+matches.map(f=>'<article class="candidate">'+formationHTML(f)+'<button class="small-button" data-assess-template="'+esc(f.id)+'">この掲載戦法で比較</button></article>').join('')+(matches.length?'':'<p>同時採用の掲載例は未収録です。上の3枠で構成を続けられます。</p>')+'</details>';
}

function render(focusId){
 const focus=focusId?$(focusId):null,pos=focus?.selectionStart;
  $("context").textContent="S"+state.season+" / 攻撃・防御・回復・妨害";
 $("step-title").textContent=labels[state.step];
 const path=route(),current=path.indexOf(state.step);
 $("flow").innerHTML=path.map((step,i)=>'<div class="flow-node"><button data-go="'+step+'"'+(i>state.furthest?' disabled':'')+(step===state.step?' aria-current="step"':'')+'><i>'+String(i+1).padStart(2,"0")+'</i><span><b>'+labels[step]+'</b><small>'+esc(i<=state.furthest?summary(step):"未選択")+'</small></span></button></div>').join("");
 let html="";
 if(state.step==="general")html='<div id="selected-general">'+selectedGeneral()+'</div>'+filters()+'<div id="roster-content">'+rosterHTML()+'</div>';
 if(state.step==="results")html=resultsHTML();
 $("step-content").innerHTML=html;if(state.step==="results")advisorUI.mount($("advisor-root"),{state,catalog,index,templates,generals:allGenerals,excluded:allExcluded(),onReplace:ids=>{state.generals=ids;state.general=ids[0]||'';advisorUI.clearPreview();if(!ids.length){go('general');return;}render();},onChange:()=>render(),onLeader:id=>{if(!state.generals.includes(id))return;state.generals=[id,...state.generals.filter(x=>x!==id)];state.general=id;render();},onPin:id=>{if(state.generals.length<3&&!state.generals.includes(id)){state.generals.push(id);state.general=state.generals[0];render();}}});
 $("flow-actions").innerHTML=(current>0?'<button class="small-button" data-back>前へ戻る</button>':'')+(current<path.length-1?'<button class="small-button next" data-next'+(!allowedNext()?' disabled':'')+'>'+((path[current+1]==="results")?'Tier平均と比較する':'次へ：'+labels[path[current+1]])+'</button>':'');
 if(focusId&&$(focusId)){const el=$(focusId);el.focus();if(typeof pos==="number"&&el.type==="search")el.setSelectionRange(pos,pos);}
}
function updateRoster(){const el=$("roster-content");if(el)el.innerHTML=rosterHTML(state.step==="exclude");}
function toggle(list,value){return list.includes(value)?list.filter(x=>x!==value):[...list,value];}
document.addEventListener("click",e=>{const b=e.target.closest("button");if(!b||!catalog||b.disabled)return;
 if(b.dataset.assessTemplate){advisorUI.useTemplate(templates.find(f=>f.id===b.dataset.assessTemplate));return;}
 if(b.id==="restart"){reset();go("general");return;}
 if(b.hasAttribute("data-next")){if(allowedNext()){state.family="";state.query="";go(route()[route().indexOf(state.step)+1]);}return;}
 if(b.hasAttribute("data-back")){go(route()[route().indexOf(state.step)-1]);return;}
 if(b.dataset.go){if(route().indexOf(b.dataset.go)<=state.furthest)go(b.dataset.go);return;}
 if(b.dataset.general||b.dataset.unpin){const id=b.dataset.general||b.dataset.unpin;if(!state.generals.includes(id)&&state.generals.length>=3)return;state.generals=toggle(state.generals,id);state.general=state.generals[0]||'';state.excluded=state.excluded.filter(x=>!state.generals.includes(x));advisorUI.clearPreview();if(state.step==='general'&&state.generals.length===3){state.family='';state.query='';go('results');return;}if(state.step==='results'&&!state.generals.length){state.step='general';invalidate();go('general');return;}if(state.step!=='results')invalidate();const scroll=document.querySelector('.flow-roster')?.scrollTop||0;render();if(document.querySelector('.flow-roster'))document.querySelector('.flow-roster').scrollTop=scroll;return;}

});
document.addEventListener("change",e=>{const el=e.target;if(el.id==="season"){state.season=Number(el.value);try{localStorage.setItem("mobunagaSeason",String(state.season));}catch{}document.cookie="mobunaga_season="+state.season+"; Path=/; Max-Age=31536000; SameSite=Lax"+(location.protocol==="https:"?"; Secure":"");const u=new URL(location.href);u.searchParams.set("season",String(state.season));history.replaceState(null,"",u);reset();if(catalog)refreshSeason();return;}
 if(!catalog)return;
 if(el.id==="family"){state.family=el.value;updateRoster();}

});
document.addEventListener("input",e=>{if(!catalog)return;if(e.target.id==="query"){state.query=e.target.value;updateRoster();}});
const advisorUI=window.MobunagaAdvisorUI({esc,image,sourceLink});
$("season").value=String(state.season);
document.addEventListener("error",e=>{const img=e.target;if(img?.matches?.("img.portrait")){const fallback=document.createElement("span");fallback.className="portrait portrait-fallback";fallback.setAttribute("aria-hidden","true");fallback.textContent="将";img.replaceWith(fallback);}},true);
(async()=>{try{const result=await Promise.all([liveOrBase("database"),liveOrBase("formations"),getJSON("../assets/s4-additions.json"),getJSON("../assets/s4-templates.json")]);if(!Array.isArray(result[0].generals)||!Array.isArray(result[1].formations)||!Array.isArray(result[3].formations))throw Error("Invalid catalog");catalog=C.catalog(result[0],result[2],result[1]);base=result[1];s4=result[3];refreshSeason();$("workspace").hidden=false;$("load-status").hidden=true;}catch(error){$("load-status").textContent="資料を読み込めませんでした。通信状態を確認して再読み込みしてください。";const retry=document.createElement("button");retry.className="small-button";retry.textContent="再読み込み";retry.addEventListener("click",()=>location.reload());$("load-status").append(" ",retry);console.error("Formation consultation load failed",error);}})();
})();

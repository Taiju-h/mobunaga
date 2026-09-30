"use strict";
(() => {
const C=window.MobunagaConsult,$=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const version=document.documentElement.dataset.version;
const url=path=>path+"?v="+encodeURIComponent(version);
function storedSeason(){try{return Number(localStorage.getItem("mobunagaSeason"));}catch{return 0;}}
const requested=Number(new URLSearchParams(location.search).get("season"));
const initial=[1,2,3,4].includes(requested)?requested:([1,2,3,4].includes(storedSeason())?storedSeason():4);
const state={season:initial,purpose:"land",level:7,mode:"general",family:"",query:"",general:"",counter:"confusion",enemy:""};
let catalog,base,s4,allGenerals=[],templates=[],counts=new Map(),generalMap=new Map();
const counters={
confusion:{label:"混乱",text:"主力自身の混乱耐性と、部隊全体の対策を分けて考えます。謙信の特性は自身の混乱確率を下げるもので、全員への完全無効ではありません。",ids:["uesugikenshin"],reason:"自身の混乱耐性から検討"},
active:{label:"敵の能動戦法",text:"無策を与える候補から検討します。先に動けるか、相手に耐性がないかが条件です。指揮・受動まで止める効果とは扱いません。",ids:["kakizakikageie"],reason:"固有戦法の無策から検討"},
attack:{label:"通常攻撃・突撃",text:"止める手段と、受けて反撃につなぐ手段を分けます。大祝鶴の編成案は受け役の耐久確認が前提です。通常攻撃が多い相手に必ず有利とは限りません。",ids:["oohouritsuru"],reason:"味方の被通常攻撃を利用する案"},
heal:{label:"回復・持久戦",text:"回復不可・被回復効果の低下を検討し、対象と持続時間を確認します。武将を選び、掲載戦法の効果と相手の耐性を照合してください。",ids:[],reason:""},
burst:{label:"高火力速攻",text:"序盤の軽減・制御と、回復が間に合う行動順を確認します。能力が整う前に主力が倒れないことを優先して、掲載編成を比較します。",ids:[],reason:""},
stop:{label:"自軍の行動阻害",text:"混乱・無策・封撃などを分け、止まる攻撃手段を確認します。単一の耐性で全ての阻害を防げるとは判断しません。",ids:["uesugikenshin","kakizakikageie"],reason:"個別の耐性と凸条件を確認"}
};
const tips={
oohouritsuru:"役割：味方への通常攻撃を火力に変える。吉川広家を受け役にする案は検証候補です。狙われる手段と回復・軽減を用意し、実際の被害を確認してください。鶴の条件は味方が通常攻撃を「受ける」ことです。",
kikkawahiroie:"役割：大祝鶴と組ませる受け役を検討。自己回復を活かす案ですが、誰が攻撃を引き受けるか、残る1枠が何を補うかを確認します。この組み合わせの低兵損実績は未検証です。効果文が未収録の場合は、ゲーム内の現行効果を確認してください。",
uesugikenshin:"役割：味方の手数を溜めの機会につなげる。相方の採用件数に加え、行動順と通常攻撃が止まる場面を確認します。混乱耐性は謙信本人への効果として考え、部隊全体の対策と分けます。",
kakizakikageie:"役割：突撃火力と無策。相方には攻撃機会を支える働きを求めます。連撃・行動順・制御耐性の条件を確認し、止まったときに他の2人が果たす役割まで比較します。"
};
async function getJSON(path){const r=await fetch(url(path),{cache:"no-cache"});if(!r.ok)throw Error("HTTP "+r.status);return r.json();}
async function liveOrBase(name){const r=await fetch(url("../assets/"+name+".live.json"),{cache:"no-cache"});if(r.ok)return r.json();if(r.status!==404)throw Error("HTTP "+r.status);return getJSON("../assets/"+name+".json");}
function image(g){const p=g?.portrait;return typeof p==="string"&&/^assets\/portraits\/[a-z0-9_-]+\.webp$/.test(p)?'<img class="portrait" src="'+esc(url("../"+p))+'" alt="" loading="lazy">':'<span class="portrait portrait-fallback" aria-hidden="true">将</span>';}
function sourceLink(href,text){const safe=C.safeLink(href);return safe?'<a href="'+esc(safe)+'" target="_blank" rel="noopener">'+esc(text)+'</a>':esc(text);}
function setPurposeControls(){document.querySelectorAll("[data-purpose]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.purpose===state.purpose)));document.querySelectorAll("[data-level]").forEach(b=>b.setAttribute("aria-pressed",String(Number(b.dataset.level)===state.level)));document.querySelectorAll("[data-mode]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.mode===state.mode)));$("land-field").hidden=state.purpose!=="land";$("meta-field").hidden=state.purpose!=="meta";$("counter-field").hidden=state.mode!=="counter";}
function refreshSeason(){
 allGenerals=catalog.generals.filter(g=>C.firstSeason(g)<=state.season);
 generalMap=new Map(allGenerals.map(g=>[g.id,g]));
 templates=C.templatesForSeason(base,s4,state.season).filter(f=>f.members.every(m=>generalMap.has(m.general_id)));
 counts=C.popularity(allGenerals,templates);
 const families=[...new Set(allGenerals.map(C.family))].sort((a,b)=>a.localeCompare(b,"ja"));
 $("family").innerHTML='<option value="">全家門</option>'+families.map(f=>'<option value="'+esc(f)+'">'+esc(f)+'</option>').join("");
 if(!families.includes(state.family))state.family="";$("family").value=state.family;
 const enemies=templates.filter(f=>C.tier(f)<=0.5).sort((a,b)=>C.tier(a)-C.tier(b)||a.source_index-b.source_index);
 if(!enemies.some(f=>f.id===state.enemy))state.enemy=enemies[0]?.id||"";
 $("enemy").innerHTML=enemies.length?enemies.map(f=>'<option value="'+esc(f.id)+'">'+esc(f.tier+" / "+f.name+" / "+f.id)+'</option>').join(""):'<option value="">上位編成は未収録</option>';
 $("enemy").value=state.enemy;
 $("source-count").textContent="S"+state.season+" · "+templates.length+"編成";
 $("source-link").href=state.season===4?s4.meta.source_url:"https://www.sanguo-zhi.com/entry/s"+state.season+"-template/";
 $("data-summary").textContent="武将"+allGenerals.length+"名 / "+families.length+"家門 · 採用件数はS"+state.season+"の掲載表のみ";
 render();
}
function visibleGenerals(){const q=state.query.normalize("NFKC").trim().toLowerCase();return C.rank(allGenerals,templates).filter(g=>(!state.family||C.family(g)===state.family)&&(!q||(g.name+" "+g.kana).normalize("NFKC").toLowerCase().includes(q)));}
function formationHTML(f,open=false){
 const members=f.members.map(m=>'<div class="soldier">'+image(generalMap.get(m.general_id))+'<div><span>'+esc(m.role)+'</span><strong>'+esc(m.general_name)+'</strong></div></div>').join("");
 const body=f.members.map(m=>'<section><h4>'+esc(m.general_name)+'</h4><dl><dt>戦法</dt><dd>'+m.tactics.map(t=>esc(t.tactic_name)).join(" / ")+'</dd><dt>能力振り</dt><dd>'+esc(m.attribute_plan||"記載なし")+'</dd><dt>主兵学</dt><dd>'+esc(m.main_school||"記載なし")+'</dd><dt>副兵学</dt><dd>'+esc(m.sub_school||"記載なし")+'</dd></dl></section>').join("");
 return '<details class="formation"'+(open?' open':'')+'><summary><div class="formation-title"><span class="tag">'+esc(f.tier||"評価未収録")+'</span><b>'+esc(f.troops?.replaceAll(",","・")||"兵種未指定")+'</b><small>'+esc(f.id)+(f.cost?' / COST '+esc(f.cost):'')+'</small></div><div class="team-row">'+members+'</div></summary><div class="formation-body"><div class="member-grid">'+body+'</div>'+((f.requirement||f.template_notes)?'<div class="source-note"><b>掲載条件・代替案</b>'+esc([f.requirement,f.template_notes].filter(Boolean).join("\n"))+'</div>':'')+'<p class="source-link">'+sourceLink(f.source?.source_url,"出典の編成表 "+(f.source_index||"")+" を確認")+'</p><p class="fine">Tierは出典の掲載評価。表記を保持しているため、戦法名に表記揺れが含まれる場合があります。</p></div></details>';
}
function render(){
 setPurposeControls();
 const visible=visibleGenerals();
 if(!visible.some(g=>g.id===state.general))state.general=visible[0]?.id||"";
 $("roster-count").textContent=visible.length+" / "+allGenerals.length+"名";
 $("roster").innerHTML=visible.length?visible.map(g=>'<button class="general-button" data-general="'+esc(g.id)+'" aria-pressed="'+(state.general===g.id)+'">'+image(g)+'<span><b>'+esc(g.name)+'</b><small>'+esc(C.family(g))+' / COST '+esc(g.cost??"—")+'</small></span><span class="count">'+counts.get(g.id)+'<small>件</small></span></button>').join(""):'<p class="empty">該当する武将がいません。名前か家門を変更してください。</p>';
 $("context").textContent="S"+state.season+" / "+(state.purpose==="land"?"土地 Lv."+state.level+" / 低兵損・安定性":state.purpose==="pvp"?"対人戦 / 役割と相性":"特定メタ / 対面の条件");
 const enemy=templates.find(f=>f.id===state.enemy);
 $("enemy-content").innerHTML=state.purpose==="meta"?(enemy?'<h3 class="section-title">対策する相手</h3>'+formationHTML(enemy)+'<p class="warning">相手の戦法・兵種を確認して、自軍候補を選んでください。以下の編成が相手に有利と判定されたわけではありません。</p>':'<p class="empty">このシーズンの上位テンプレートは未収録です。</p>'):"";
 const counter=counters[state.counter];
 const candidateIds=counter.ids.filter(id=>generalMap.has(id));
 // Season filtering applies to names and explanatory text, not only roster rows.
 const counterText=state.season<C.firstSeason(catalog.generals.find(g=>g.id==="kakizakikageie")||{tiers:[{season:3}]})&&state.counter==="active"?"無策を付与する手段と、相手より先に動ける条件を確認します。このシーズンの具体的な武将候補は未収録です。":counter.text;
 $("counter-content").innerHTML=state.mode==="counter"?'<div class="brief"><small>対策 / '+esc(counter.label)+'</small><h3>必要な役割を決める</h3><p>'+esc(counterText)+'</p><p class="fine">対策方針は検討案です。武将選択後に掲載編成を比較します。</p></div>':"";
 $("counter-options").innerHTML=candidateIds.length?'<p class="fine">'+esc(counter.reason)+'</p><div class="partner-list">'+candidateIds.map(id=>'<button data-general="'+esc(id)+'" data-reset-family>'+esc(generalMap.get(id).name)+'</button>').join("")+'</div>':'<p class="fine">具体候補は未収録。家門と武将を選んで戦法を確認してください。</p>';
 const g=generalMap.get(state.general);
 $("result-title").textContent=g?g.name+"を軸に考える":"条件に合う武将がいません";
 $("general-content").innerHTML=g?'<div class="brief"><div class="profile-title">'+image(g)+'<div><small>個性を確認</small><h3>'+esc(g.name)+'</h3><span>'+esc(C.family(g))+' / COST '+esc(g.cost??"—")+'</span></div></div><p><b>'+esc(g.unique_tactic?.name||"固有戦法未収録")+'</b></p><p class="effect">'+esc(g.unique_tactic?.effect||"効果文は未収録です。")+'</p><div class="profile-links"><a href="../?open=generals&amp;id='+encodeURIComponent(g.id)+'&amp;season='+state.season+'#generals">武将録で特性・凸条件を確認</a></div></div>':"";
 const related=g?templates.filter(f=>f.members.some(m=>m.general_id===g.id)):[];
 const partners=g?C.partners(g.id,templates):[];
 $("partners").innerHTML=partners.length?'<div class="section-heading"><h3>よく一緒に採用される相方</h3><span>同時採用件数</span></div><div class="partner-list">'+partners.map(p=>'<button data-general="'+esc(p.id)+'" data-reset-family>'+esc(p.name)+'<b>'+p.count+'件</b></button>').join("")+'</div><p class="fine">掲載された組み合わせの頻度です。相性の実測値や、完全な代替関係を示すものではありません。</p>':"";
 $("template-count").textContent=related.length+"件";
 $("template-note").textContent="人気順の母数：S"+state.season+"の掲載テンプレート "+templates.length+"件。1編成につき武将1名を1回集計。戦法・兵種が異なる掲載案は別編成として数えます。";
 $("templates").innerHTML=related.length?related.map((f,i)=>formationHTML(f,i===0)).join(""):'<div class="empty"><b>この武将の掲載編成は0件です</b>このシーズンのテンプレートに登場していません。固有戦法の条件から相方を検討できますが、未確認の三人編成は提示しません。</div>';
 $("purpose-guide").innerHTML=state.purpose==="land"?'<section class="guide"><div class="section-heading"><h3>土地'+state.level+'での兵損確認</h3><span>テンプレートと戦報は別集計</span></div><div class="stats"><div><span>条件一致の戦報</span><b>未集計</b></div><div><span>想定兵損</span><b>未判定</b></div><div><span>連戦可否</span><b>未判定</b></div></div><p class="fine">上の編成は掲載テンプレートです。土地'+state.level+'の低兵損実績を保証するものではありません。Discord戦報との照合は未実施です。</p><ul><li>守備隊・兵種・レベル・兵力・凸・戦法をそろえて比較。</li><li>'+(state.level>=7?'初戦後の残兵力と、次の守備隊への対応を確認。':'低兵損だった相手と苦手な相手を分けて確認。')+'</li><li>兵損の中央値と最大値を記録し、安定して連戦できるかを見る。</li></ul></section>':'<section class="guide"><h3 class="section-title">実戦で比較すること</h3><ul><li>主力が止まった原因と、補助が間に合う行動順。</li><li>相手の兵種・速度・耐性を踏まえた戦法の成立条件。</li><li>勝敗と残兵力を分け、同条件の複数戦で確認。</li></ul></section>';
 const tip=g?(tips[g.id]||"同時採用件数が多い相方から掲載例を確認し、固有戦法の発動条件を誰が支えているかを見ます。代替時は、失う制御・回復・行動順・兵種の補助を一つずつ比較してください。完全な上位・下位互換の判定は未実施です。"):"";
 $("tips").innerHTML=tip?'<aside class="tips"><header><img src="../assets/mobunaga.png" alt="" loading="lazy"><div><h3>モブナガ TIPS</h3><small>役割と相性の検討案</small></div></header><p>'+esc(tip)+'</p></aside>':"";
}
document.addEventListener("click",e=>{const b=e.target.closest("button");if(!b||!catalog)return;if(b.dataset.purpose)state.purpose=b.dataset.purpose;if(b.dataset.level)state.level=Number(b.dataset.level);if(b.dataset.mode)state.mode=b.dataset.mode;if(b.dataset.general){state.general=b.dataset.general;if(b.hasAttribute("data-reset-family")){state.family="";state.query="";$("family").value="";$("query").value="";}}render();});
$("season").value=String(state.season);
$("season").addEventListener("change",e=>{state.season=Number(e.target.value);try{localStorage.setItem("mobunagaSeason",String(state.season));}catch{}document.cookie="mobunaga_season="+state.season+"; Path=/; Max-Age=31536000; SameSite=Lax"+(location.protocol==="https:"?"; Secure":"");state.general="";state.family="";state.query="";$("query").value="";if(catalog)refreshSeason();});
$("family").addEventListener("change",e=>{state.family=e.target.value;if(catalog)render();});
$("query").addEventListener("input",e=>{state.query=e.target.value;if(catalog)render();});
$("counter").addEventListener("change",e=>{state.counter=e.target.value;if(catalog)render();});
$("enemy").addEventListener("change",e=>{state.enemy=e.target.value;if(catalog)render();});
document.addEventListener("error",e=>{const img=e.target;if(img?.matches?.("img.portrait")){const fallback=document.createElement("span");fallback.className="portrait portrait-fallback";fallback.setAttribute("aria-hidden","true");fallback.textContent="将";img.replaceWith(fallback);}},true);
(async()=>{try{const result=await Promise.all([liveOrBase("database"),liveOrBase("formations"),getJSON("../assets/s4-additions.json"),getJSON("../assets/s4-templates.json")]);if(!Array.isArray(result[0].generals)||!Array.isArray(result[1].formations)||!Array.isArray(result[3].formations))throw Error("Invalid catalog");catalog=C.catalog(result[0],result[2],result[1]);base=result[1];s4=result[3];refreshSeason();$("workspace").hidden=false;$("load-status").hidden=true;}catch(error){$("load-status").textContent="資料を読み込めませんでした。通信状態を確認して再読み込みしてください。";const retry=document.createElement("button");retry.className="small-button";retry.textContent="再読み込み";retry.addEventListener("click",()=>location.reload());$("load-status").append(" ",retry);console.error("Formation consultation load failed",error);}})();
})();

"use strict";
/* Reviewed effect mappings. These identify tools to consider, never matchup wins.
 * The full current catalog effect and source accompany every match.
 * Missing mappings are unknown, not evidence of absence. */
(function(root){
const C=root.MobunagaConsult;
const COUNTERS={
 confusion:{label:"混乱を防ぎたい",detail:"洞察・浄化・混乱耐性。本人だけか、味方にも届くかを確認します。"},
 active:{label:"敵の能動戦法を止めたい",detail:"無策を付与する手段。準備・発動率・先に動ける条件を確認します。"},
 attack:{label:"通常攻撃・突撃に備えたい",detail:"封撃、対象誘導、通常攻撃・突撃への軽減を確認します。"},
 heal:{label:"敵の回復を抑えたい",detail:"回復不可・被回復効果の低下。対象と効果時間を確認します。"},
 burst:{label:"序盤の大ダメージに備えたい",detail:"序盤に働く軽減・回避。発動前の被害や対象外の味方には注意します。"},
 stop:{label:"行動阻害から味方を守りたい",detail:"洞察・浄化・個別耐性。防げる状態と対象は効果ごとに異なります。"}
};
// Keys are catalog IDs; names alone never trigger an unreviewed match.
const TACTICS={
 tr004:["confusion","stop"],tr007:["active"],tr009:["attack"],tr015:[],tr016:["heal"],
 tr019:["stop"],tr020:["confusion","stop"],tr022:["burst"],tr025:["active"],
 tr027:["burst"],tr033:["active"],tr034:["burst"],tr047:["active","attack"],
 tr057:["confusion","stop"],tr059:["attack"],tr062:["attack"],tr064:["attack"],
 tr068:["burst"],tr071:["burst"],tr074:["active"],tr099:["heal"],tr103:["active"],tr107:["attack"]
};
const GENERALS={
 andouchikasue:["confusion","stop"],babanobuharu:["confusion","stop"],
 dateterumune:["active","attack"],haratoratane:["burst"],higuchikanetoyo:["confusion","stop"],
 hondamasanobu:["burst"],hoshinamasatoshi:["active"],houjoutsunashige:["active","attack"],
 ikedasen:["active","attack"],jukeini:["confusion","stop","burst"],kakizakikageie:["active"],
 kanisaizou:["heal"],obutoramasa:["attack"],okabemotonobu:["confusion","stop"],
 saegusamasazada:["burst"],shibatakatsuie:["confusion","stop"],suwahime:["confusion","stop"],
 suzukisadayuu:["active","attack"],takahashijouun:["confusion","stop"],takedayoshinobu:["active"],
 tsudasanchou:["active","attack"],usamisadamitsu:["stop"],wakizakayasuharu:["burst"]
};
const TRAITS={uesugikenshin:{"義の将":["confusion"]},matsu:{"淑徳":["confusion","stop"]}};
const THREAT_GENERALS={
 kichou:["confusion","stop"],maedakeiji:["confusion","stop","attack"],
 sanadamasayuki:["confusion","stop"],shibatashigeie:["confusion","stop"],
 ogou:["confusion","stop"],tsudasanchou:["confusion","stop"],
 tachibanaginchiyo:["stop"],kakizakikageie:["attack","stop"],
 uesugikenshin:["attack"],dateterumune:["stop"],hoshinamasatoshi:["stop"],
 houjoutsunashige:["stop"],ikedasen:["stop"],obutoramasa:["stop"],suzukisadayuu:["stop"],takedayoshinobu:["attack","stop"]
};
const THREAT_TACTICS={tr007:["stop"],tr015:["confusion","stop"],tr025:["stop"],tr028:["confusion","stop"],tr033:["stop"],tr047:["stop"],tr054:["confusion","stop"],tr059:["stop"],tr062:["stop"],tr074:["confusion","stop"],tr096:["confusion","stop"],tr103:["stop"]};
function evidenceIndex(catalog,n){
 const generals=new Map(catalog.generals.filter(g=>C.firstSeason(g)<=n).map(g=>[g.id,g]));
 const tactics=new Map(catalog.tactics.filter(t=>!C.season(t.first_season)||C.season(t.first_season)<=n).map(t=>[t.id,t]));
 const byName=new Map();for(const t of tactics.values()){if(!byName.has(t.name))byName.set(t.name,[]);byName.get(t.name).push(t);}
 return {generals,tactics,byName};
}
function formationEvidence(f,index){
 const supports=Object.fromEntries(Object.keys(COUNTERS).map(k=>[k,[]]));
 const threats=Object.fromEntries(Object.keys(COUNTERS).map(k=>[k,[]]));let missing=0;
 function add(item,provided=[],risk=[]){if(!item.effect){missing++;return;}
  for(const k of provided) supports[k].push(item);
  for(const k of risk) threats[k].push(item);
  // A recovery rate / rest / lifesteal is a concrete recovery tool, not an anti-heal sentence.
  if(/回復率|休養|離反|心攻/.test(item.effect)&&!risk.includes("heal"))threats.heal.push(item);
 }
 for(const m of f.members){
  const g=index.generals.get(m.general_id);if(!g){missing++;continue;}
  const u=g.unique_tactic||{};
  add({owner:g.name,name:u.name||"固有戦法",effect:u.effect,source:g.source?.source_url,kind:"固有戦法"},GENERALS[g.id],THREAT_GENERALS[g.id]);
  for(const trait of g.traits||[]){const mapped=TRAITS[g.id]?.[trait.name];if(mapped)add({owner:g.name,name:trait.name,effect:trait.effect,source:g.source?.source_url,kind:"特性 / "+trait.unlock_level},mapped);}
  for(const mt of m.tactics||[]){
   const matches=index.byName.get(mt.tactic_name)||[];
   const t=index.tactics.get(mt.tactic_id)||(matches.length===1?matches[0]:null);
   if(!t){missing++;continue;}
   const risk=[...(THREAT_TACTICS[t.id]||[])];
   if(t.category==="能動")risk.push("active");if(t.category==="突撃")risk.push("attack");
   add({owner:g.name,name:t.name,effect:t.effect,source:t.source?.source_url,kind:t.category||"装備戦法"},TACTICS[t.id],risk);
  }
 }
 return {supports,threats,missing};
}
function eligible(formations,general,excluded=[]){const removed=new Set(excluded);return formations.filter(f=>f.members.some(m=>m.general_id===general)&&f.members.every(m=>!removed.has(m.general_id)));}
function candidates(formations,state,index){
 const enemies=formations.filter(f=>(state.enemies||[]).includes(f.id)).map(f=>({formation:f,evidence:formationEvidence(f,index)}));
 const selected=state.purpose==="land"?[]:(state.counters||[]);
 return eligible(formations,state.general,state.excluded).map(f=>{
  const evidence=formationEvidence(f,index);
  const matched=selected.filter(k=>evidence.supports[k]?.length);
  const coverage=enemies.map(enemy=>{const needs=Object.keys(COUNTERS).filter(k=>enemy.evidence.threats[k].length);return {enemy,needs,matched:needs.filter(k=>evidence.supports[k].length)};});
  return {formation:f,evidence,matched,coverage};
 }).filter(r=>selected.length===0||(state.match==="any"?r.matched.length>0:r.matched.length===selected.length))
 .sort((a,b)=>b.matched.length-a.matched.length||b.coverage.filter(c=>c.matched.length).length-a.coverage.filter(c=>c.matched.length).length||C.tier(a.formation)-C.tier(b.formation)||(a.formation.source_index||0)-(b.formation.source_index||0));
}
function steps(purpose){return purpose==="land"?["purpose","level","general","exclude","results"]:purpose==="meta"?["purpose","enemies","general","counter","results"]:["purpose","general","counter","results"];}
Object.assign(C,{COUNTERS,evidenceIndex,formationEvidence,eligible,candidates,steps});
})(typeof window!=="undefined"?window:globalThis);

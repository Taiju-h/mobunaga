"use strict";
(function(root){
const A=root.MobunagaAdvisor,C=root.MobunagaConsult;
const attributes={martial:'武勇',intellect:'知略',defense:'統率'};
function focus(g,config={}){if(attributes[config.focus])return config.focus;const stats={...A.baseStats(g),...config};return Object.keys(attributes).sort((a,b)=>Number(stats[b])-Number(stats[a]))[0];}
function resolve(t,index){return index.tactics.has(t.tactic_id)?t.tactic_id:index.byName.get(t.tactic_name)?.length===1?index.byName.get(t.tactic_name)[0].id:null;}
function affiliation(profiles,season,mode){
 const families=profiles.map(p=>p.general.family);
 if(!families.length||families.some(f=>!f))return {eligible:false,reason:'家門データが未確認です'};
 if(mode==='alliance'){
  if(season<3)return {eligible:false,reason:'会盟の陣はS3以降です'};
  if(new Set(families).size!==families.length)return {eligible:false,reason:'会盟は全員が異なる家門である必要があります'};
  if(!['能動','突撃'].includes(profiles[0].uniqueKind))return {eligible:false,reason:'会盟の大将は固有が能動・突撃の武将にしてください。種類未確認も推薦対象外です'};
  return {eligible:true,reason:profiles.length===3?'異なる3家門・大将条件を満たしています':'残りの枠も別家門から探します'};
 }
 return {eligible:new Set(families).size===1,reason:new Set(families).size===1?'固定武将と同じ家門から探します':'固定武将の家門が異なります。会盟を選ぶか、固定武将を選び直してください'};
}
function modeFor(ids,overrides,index,requested){
 if(ids.some(id=>(overrides[id]?.tactics||[]).includes('tr113')))return 'alliance';
 if(requested)return requested;
 const ps=ids.map(id=>A.profile(index.generals.get(id),overrides[id],index));
 return ps.length>1&&new Set(ps.map(p=>p.general.family)).size===ps.length&&['能動','突撃'].includes(ps[0].uniqueKind)?'alliance':'family';
}
function rankedTactics(g,config,index,formations,options={}){
 const attribute=focus(g,config),counts=new Map(),chosen=options.counters||[];
 // Count only actual equipped appearances in this season's published templates.
 for(const f of formations){if(C.season(f.season)!==options.season)continue;for(const m of f.members){if(m.general_id!==g.id)continue;for(const mt of m.tactics||[]){const id=resolve(mt,index);if(id)counts.set(id,(counts.get(id)||0)+1);}}}
 const ranked=[],byName=new Map();
 for(const t of index.tactics.values()){const previous=byName.get(t.name);if(!previous||(!A.tacticModel(previous.id)&&A.tacticModel(t.id)))byName.set(t.name,t);}
 for(const t of byName.values()){
  if(!t.effect||['内政','兵種','陣形'].includes(t.category)||t.id==='tr113'||t.name===g.unique_tactic?.name)continue;
  if(t.applicable_troop&&!['全兵種','汎用'].includes(t.applicable_troop))continue;
  const text=t.effect,model=A.tacticModel(t.id),kinds=new Set((model?.e||[]).map(e=>e.kind));
  const directPhysical=kinds.has('physical')||/兵刃ダメージ[（(]/.test(text),directMagic=kinds.has('magic')||/計略ダメージ[（(]/.test(text);
  const scaling={martial:/武勇依存/.test(text)||directPhysical,intellect:/知略依存/.test(text)||directMagic,defense:/統率依存/.test(text)};
  const compatible=scaling[attribute],otherOnly=!compatible&&Object.values(scaling).some(Boolean);
  const utility=kinds.has('dr')||kinds.has('weaken')||kinds.has('shield')||kinds.has('heal')||/回復率|被ダメージ.*低下|与ダメージ.*低下/.test(text);
  const evidence=C.formationEvidence({members:[{general_id:g.id,tactics:[{tactic_id:t.id}]}]},index);
  const matches=chosen.filter(k=>evidence.supports[k]?.some(e=>e.name===t.name));
  let score=(compatible?36:otherOnly?-40:8)+Math.min(24,6*Math.log2(1+(counts.get(t.id)||0)))+matches.length*22;
  if(options.purpose==='land'&&utility)score+=16;
  if(options.purpose!=='land'&&kinds.has('control'))score+=3;
  if(t.category==='突撃'&&A.baseStats(g).normals===0)continue;
  if(t.category==='突撃'&&(g.unique_tactic?.effect||'').startsWith('通常攻撃後'))score+=8;
  const reasons=[...(compatible?[attributes[attribute]+'を活かす']:otherOnly?['別属性依存・適性要確認']:['属性に依存しにくい補助']),...(counts.get(t.id)?['本人の掲載採用 '+counts.get(t.id)+'件']:[]),...matches.map(k=>C.COUNTERS[k].label),...(options.purpose==='land'&&utility?['土地向けの継戦・軽減候補']:[])];
  ranked.push({id:t.id,score,reasons,modeled:!!model});
 }
 return ranked.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
}
function team(ids,overrides,index,formations,options={}){
 const mode=modeFor(ids,overrides,index,options.mode),used=new Set(),configs={},details={},key=id=>index.tactics.get(id)?.name||id;
 for(const id of ids){const o=overrides[id]||{},locks=o.manualSlots||((o.tactics||[]).map(()=>true));configs[id]={...o,tactics:[0,1].map(i=>locks[i]?o.tactics?.[i]||'':'')};details[id]=[0,1].map(i=>locks[i]?{manual:true,reasons:['手動指定・掲載戦法を保持']}:null);configs[id].tactics.filter(Boolean).forEach(t=>used.add(key(t)));}
 const preliminary=ids.map(id=>A.profile(index.generals.get(id),configs[id],index));const rule=affiliation(preliminary,options.season,mode);
 // The formation consumes one real slot, even while a two-member team is incomplete.
 if(mode==='alliance'&&rule.eligible&&!used.has(key('tr113'))&&index.tactics.has('tr113')){
  const holders=[...ids.slice(1),ids[0]];for(const id of holders){const slot=details[id].findIndex(d=>!d);if(slot>=0){configs[id].tactics[slot]='tr113';details[id][slot]={reasons:['異なる家門で組むため会盟の陣を装備'],formation:true};used.add(key('tr113'));break;}}
 }
 for(const id of ids){const g=index.generals.get(id),ranked=rankedTactics(g,configs[id],index,formations,options);for(let slot=0;slot<2;slot++){if(details[id][slot])continue;const choice=ranked.find(t=>!used.has(key(t.id)));if(choice){configs[id].tactics[slot]=choice.id;details[id][slot]=choice;used.add(key(choice.id));}}}
 const profiles=ids.map(id=>A.profile(index.generals.get(id),configs[id],index));
 const equipped=profiles.some(p=>p.tactics.includes('tr113'));
 return {mode,configs,details,profiles,rule:mode==='alliance'&&rule.eligible&&!equipped?{eligible:false,reason:'会盟の陣を入れる装備枠がありません。1枠を自動に戻すか手動で装備してください'}:rule};
}
function recommend(anchors,generals,overrides,index,scenario,season,excluded=[],formations=[],options={}){
 if(!anchors.length)return [];options={...options,season};
 const base=team(anchors,overrides,index,formations,options),before=A.analyze(base.profiles,scenario,season);if(!base.rule.eligible)return [];
 return generals.filter(g=>index.generals.has(g.id)&&!anchors.includes(g.id)&&!excluded.includes(g.id)).map(g=>{
  // Freeze the fixed members' current loadout so candidate evaluation cannot silently swap it.
  const locked={...overrides};for(const id of anchors)locked[id]={...base.configs[id],manualSlots:[true,true]};
  const plan=team([...anchors,g.id],locked,index,formations,{...options,mode:base.mode});if(!plan.rule.eligible)return null;
  const assessment=A.analyze(plan.profiles,scenario,season),delta=assessment.score-before.score;
  const adopted=formations.filter(f=>[...anchors,g.id].every(id=>f.members.some(m=>m.general_id===id))).length;
  return {general:g,assessment,plan,delta,score:delta,adopted,reasons:[...(assessment.attack>before.attack?['火力の改善']:[]),...(assessment.recovery>before.recovery?['回復不足の縮小']:[]),...(assessment.defense>before.defense?['耐久の補強']:[]),...(assessment.mitigation>before.mitigation?['軽減手段の追加']:[]),...(assessment.controlChance>before.controlChance?['状態異常の機会を追加']:[]),base.mode==='alliance'?'会盟の家門・大将条件を満たす候補':'同じ家門']};
 }).filter(Boolean).sort((a,b)=>b.score-a.score||b.adopted-a.adopted||a.general.name.localeCompare(b.general.name,'ja'));
}
root.MobunagaLoadout={attributes,focus,affiliation,modeFor,rankedTactics,team,recommend};
})(typeof window!=="undefined"?window:globalThis);

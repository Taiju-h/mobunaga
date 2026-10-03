"use strict";
(function(root){
const A=root.MobunagaAdvisor,B=root.MobunagaBalance,L=root.MobunagaLoadout;
const goals={attack:'attack',defense:'mitigation',recovery:'recovery',status:'control'};
function cautions(balance,reference,complete,assessment){
 if(!complete)return [];
 const out=reference?.axes?balance.axes.map((axis,i)=>({...axis,target:reference.axes[i].value,gap:reference.axes[i].value-axis.value,goal:goals[axis.key]})).filter(x=>x.gap>.05):[];
 const checks=assessment?[
  ['attack',assessment.attack<1,'登録済み火力が攻撃ボーダーに未達'],
  ['recovery',assessment.recovery<1,'対象ごとの必要回復に不足'],
  ['defense',assessment.actors.some(x=>x.risk),'回復で補い切れない被弾負担あり']
 ]:[];
 for(const [key,needed,reason] of checks){if(!needed)continue;const existing=out.find(x=>x.key===key);if(existing)existing.reason=reason;else out.push({...balance.axes.find(x=>x.key===key),target:null,gap:null,goal:goals[key],reason});}
 return out;
}
function swaps(plan,generals,index,templates,scenario,season,excluded=[]){
 if(plan.profiles.length!==3)return [];
 const order=plan.profiles.map(p=>p.general.id),before=B.evaluate(A.analyze(plan.profiles,scenario,season)),blocked=new Set([...order,...excluded]),out=[];
 const locked=Object.fromEntries(order.map(id=>[id,{...plan.configs[id],manualSlots:[true,true]}]));
 for(let slot=0;slot<3;slot++)for(const general of generals){
  if(blocked.has(general.id)||!index.generals.has(general.id))continue;
  const ids=[...order];ids[slot]=general.id;
  // The two retained members keep their actual equipment and ranks; a new member starts at 0凸.
  const next=L.team(ids,locked,index,templates,{season,mode:plan.mode});
  if(!next.rule.eligible)continue;
  const assessment=A.analyze(next.profiles,scenario,season),balance=B.evaluate(assessment);
  const deltas=balance.axes.map((axis,i)=>axis.value-before.axes[i].value);
  if(!deltas.some(x=>x>.05))continue;
  out.push({general,slot,removed:plan.profiles[slot].general,ids,plan:next,assessment,balance,deltas});
 }
 return out;
}
function forAxis(candidates,key,limit=3){
 const axis=['attack','defense','recovery','status'].indexOf(key),seen=new Set();
 return candidates.filter(c=>c.deltas[axis]>.05).sort((a,b)=>b.deltas[axis]-a.deltas[axis]||a.assessment.unknown.length-b.assessment.unknown.length||a.general.id.localeCompare(b.general.id)).filter(c=>{if(seen.has(c.general.id))return false;seen.add(c.general.id);return true;}).slice(0,limit);
}
root.MobunagaPlanning={cautions,swaps,forAxis};
})(typeof window==='undefined'?globalThis:window);

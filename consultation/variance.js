"use strict";
(function(root){
function random(seed=246813579){let x=seed>>>0;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function summary(xs){const sorted=[...xs].sort((a,b)=>a-b),mean=xs.reduce((a,b)=>a+b,0)/xs.length;return {low:sorted[Math.floor((xs.length-1)*.1)],high:sorted[Math.ceil((xs.length-1)*.9)],mean};}
function evaluate(profiles,scenario={},season=4,samples=1000){
 const A=root.MobunagaAdvisor,B=root.MobunagaBalance,rng=random(),axis=[[],[],[],[]],power=[],need=[],earlyNeed=[],healing=[],casts=new Map();
 const reference=A.analyze(profiles,scenario,season);
 profiles.forEach((p,i)=>p.effects.forEach(e=>{if(!e.unmodeled&&e.p!==null&&['能動','突撃'].includes(e.kind))casts.set(i+':'+(e.id||'unique'),{owner:p.general.name,name:e.name,model:e,ownerIndex:i,earlyValues:[],defensive:e.e.some(x=>['dr','defenseBoost','taunt','weaken','heal','shield'].includes(x.kind)),values:[]});}));
 for(let k=0;k<samples;k++){
  const trace={rng,casts:{}},a=A.analyze(profiles,scenario,season,trace),b=B.evaluate(a);
  b.axes.forEach((x,i)=>axis[i].push(x.value));power.push(b.power);need.push(a.required);healing.push(a.healing);
  const early=a.rows.slice(0,3);earlyNeed.push(early.reduce((s,r)=>s+r.need.reduce((a,b)=>a+b,0),0)/early.length);
  for(const [key,row] of casts){row.values.push(trace.casts[key]||0);row.earlyValues.push(trace.earlyCasts?.[key]||0);}
 }
 const noCast=(r,turns)=>{if(r.model.kind!=='能動')return null;const alliance=r.model.isUnique&&r.ownerIndex===0&&reference.allianceEquipped ? .13 : 0;const p=Math.min(1,r.model.p+alliance)*reference.cfg.activeUptime/100;return Math.pow(1-p,Math.max(0,turns-(r.model.prepare||0)));};
 return {samples,turns:reference.cfg.turns,axes:axis.map(summary),power:summary(power),need:summary(need),earlyNeed:summary(earlyNeed),healing:summary(healing),casts:[...casts.values()].map(r=>({...r,...summary(r.values),zero:noCast(r,reference.cfg.turns)??r.values.filter(x=>x===0).length/samples,earlyZero:noCast(r,Math.min(3,reference.cfg.turns))??r.earlyValues.filter(x=>x===0).length/samples,values:undefined,earlyValues:undefined,model:undefined})),unknown:reference.unknown.length};
}
root.MobunagaVariance={random,summary,evaluate};
})(typeof window==='undefined'?globalThis:window);

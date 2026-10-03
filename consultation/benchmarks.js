"use strict";
(function(root){
const C=root.MobunagaConsult,A=root.MobunagaAdvisor,B=root.MobunagaBalance;
const tiers=['Tier0','Tier1','Tier2'];
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
function publishedProfiles(members,index){
 const missing=[];
 const profiles=[...members].sort((a,b)=>(a.slot||0)-(b.slot||0)).map(m=>{
   const tactics=(m.tactics||[]).slice(0,2).map(mt=>{
    const matches=index.byName.get(mt.tactic_name)||[];
    const t=index.tactics.get(mt.tactic_id)||(matches.length===1?matches[0]:null);
    if(!t){missing.push(m.general_name+' / '+(mt.tactic_name||mt.tactic_id||'戦法未記載'));return mt.tactic_id||'__missing__';}return t.id;
   });
   // Published equipment is fixed. Never substitute an automatic tactic into a benchmark.
   return A.profile(index.generals.get(m.general_id),{tactics,rank:0},index);
  });
 return {profiles,missing};
}
function build(templates,index,scenario={},season=4){
 const groups=tiers.map(tier=>({tier,rows:[],skipped:[]})),seen=new Set();let otherTiers=0;
 for(const f of templates){
  if(C.season(f.season)!==season||seen.has(f.id))continue;seen.add(f.id);
  const group=groups.find(g=>g.tier===f.tier);if(!group){otherTiers++;continue;}
  const members=[...f.members].sort((a,b)=>(a.slot||0)-(b.slot||0));
  if(members.length!==3||members.some(m=>!index.generals.has(m.general_id))){group.skipped.push({id:f.id,reason:'3名の武将資料が揃わない'});continue;}
  const {profiles,missing}=publishedProfiles(members,index);
  const assessment=A.analyze(profiles,scenario,season),balance=B.evaluate(assessment);
  const effects=profiles.flatMap(p=>p.effects),modeled=effects.filter(e=>!e.unmodeled&&e.p!==null).length;
  group.rows.push({id:f.id,name:f.name,tier:f.tier,source:f.source?.source_url,axes:balance.axes,power:balance.power,durability:assessment.durability,healing:assessment.healing,modeled,effects:effects.length+missing.length,missing,unknown:assessment.unknown,profiles});
 }
 return {season,otherTiers,groups:groups.map(g=>({...g,count:g.rows.length,axes:[0,1,2,3].map(i=>({key:['attack','defense','recovery','status'][i],value:mean(g.rows.map(r=>r.axes[i].value))})),power:mean(g.rows.map(r=>r.power)),durability:mean(g.rows.map(r=>r.durability)),healing:mean(g.rows.map(r=>r.healing)),partial:g.rows.filter(r=>r.unknown.length||r.missing.length).length,coverage:{modeled:g.rows.reduce((s,r)=>s+r.modeled,0),effects:g.rows.reduce((s,r)=>s+r.effects,0)}}))};
}
function compare(balance,benchmarks,complete){return benchmarks.groups.map(g=>({tier:g.tier,count:g.count,axes:balance.axes.map((axis,i)=>({...axis,average:g.axes[i].value,delta:complete&&g.count?axis.value-g.axes[i].value:null})),powerGap:complete&&g.count?balance.power-g.power:null}));}
root.MobunagaBenchmarks={tiers,build,compare,publishedProfiles};
})(typeof window==='undefined'?globalThis:window);

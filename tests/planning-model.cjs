const assert=require('node:assert/strict');
for(const f of ['core','evidence','advisor','balance','loadout','benchmarks','planning'])require('../consultation/'+f);
const C=MobunagaConsult,A=MobunagaAdvisor,B=MobunagaBalance,L=MobunagaLoadout,P=MobunagaPlanning,T=MobunagaBenchmarks;
const base=require('../assets/formations.json'),s4=require('../assets/s4-templates.json'),catalog=C.catalog(require('../assets/database.json'),require('../assets/s4-additions.json'),base),idx=C.evidenceIndex(catalog,4);
const ids=['hondatadakatsu','hondamasanobu','sakaitadatsugu'];
const plan=L.team(ids,{hondatadakatsu:{rank:1,tactics:['tr068','tr024'],manualSlots:[true,true]}},idx,s4.formations,{season:4});
const snapshot=JSON.stringify(plan),before=B.evaluate(A.analyze(plan.profiles)),candidates=P.swaps(plan,[...idx.generals.values()],idx,s4.formations,{},4);
assert(candidates.length>0);assert.equal(JSON.stringify(plan),snapshot,'source team stays intact');
for(const c of candidates){
 assert(c.plan.rule.eligible);assert.equal(c.ids.length,3);assert.equal(new Set(c.ids).size,3);assert(!ids.includes(c.general.id));assert.equal(c.plan.profiles[c.slot].rank,0);
 for(let i=0;i<3;i++)if(i!==c.slot){assert.equal(c.plan.profiles[i].rank,plan.profiles[i].rank);assert.deepEqual(c.plan.profiles[i].tactics,plan.profiles[i].tactics);}
 assert.deepEqual(c.deltas,c.balance.axes.map((x,i)=>x.value-before.axes[i].value));
}
for(const key of ['attack','defense','recovery','status']){const rows=P.forAxis(candidates,key),i=before.axes.findIndex(a=>a.key===key);assert(rows.every(c=>c.deltas[i]>0));assert(rows.every((c,j)=>!j||rows[j-1].deltas[i]>=c.deltas[i]));assert.equal(new Set(rows.map(c=>c.general.id)).size,rows.length);}
const none=P.swaps(plan,[...idx.generals.values()],idx,s4.formations,{},4,[...idx.generals.keys()]);assert.deepEqual(none,[]);
assert.deepEqual(P.cautions(before,{axes:before.axes},true),[]);assert.deepEqual(P.cautions(before,{axes:before.axes.map(x=>({...x,value:100}))},false),[]);
assert(P.cautions(before,{axes:before.axes.map(x=>({...x,value:100}))},true).every(w=>w.gap>0));
const baselineWarnings=P.cautions(before,{axes:before.axes},true,{attack:0,recovery:.5,actors:[{risk:true}]});assert.deepEqual(baselineWarnings.map(w=>w.key),['attack','recovery','defense']);assert(baselineWarnings.every(w=>w.gap===null&&w.reason));
const fixed=T.publishedProfiles(s4.formations[0].members,idx);assert.equal(fixed.profiles.length,3);assert(fixed.profiles.every(p=>p.rank===0));
const earlyIdx=C.evidenceIndex(catalog,2),earlyForms=C.templatesForSeason(base,s4,2),earlyPlan=L.team(['hondatadakatsu','hondamasanobu','sakaitadatsugu'],{},earlyIdx,earlyForms,{season:2});
assert(P.swaps(earlyPlan,catalog.generals,earlyIdx,earlyForms,{},2).every(c=>earlyIdx.generals.has(c.general.id)&&c.plan.profiles.flatMap(p=>p.tactics).filter(Boolean).every(id=>earlyIdx.tactics.has(id))));
console.log('Planning model: replacement gains, retained equipment/ranks, 0-rank candidates, ownership, family rules, fixed enemy loadouts and season isolation PASS');

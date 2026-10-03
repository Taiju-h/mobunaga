const assert=require('node:assert/strict');
require('../consultation/core');require('../consultation/evidence');require('../consultation/advisor');require('../consultation/balance');require('../consultation/benchmarks');
const C=MobunagaConsult,A=MobunagaAdvisor,B=MobunagaBalance,T=MobunagaBenchmarks;
const base=require('../assets/formations.json'),s4=require('../assets/s4-templates.json');const catalog=C.catalog(require('../assets/database.json'),require('../assets/s4-additions.json'),base),idx=C.evidenceIndex(catalog,4);
const result=T.build(s4.formations,idx,{},4);assert.deepEqual(result.groups.map(g=>g.count),[3,41,12]);assert.equal(result.otherTiers,49);
for(const g of result.groups){for(let i=0;i<4;i++)assert.equal(g.axes[i].value,g.rows.reduce((sum,r)=>sum+r.axes[i].value,0)/g.count);for(const r of g.rows){const f=s4.formations.find(f=>f.id===r.id);assert.deepEqual(r.profiles.map(p=>p.tactics),f.members.map(m=>m.tactics.map(t=>idx.tactics.has(t.tactic_id)?t.tactic_id:(idx.byName.get(t.tactic_name)?.length===1?idx.byName.get(t.tactic_name)[0].id:t.tactic_id||'__missing__'))));}}
const r=result.groups[0].rows[0],balance=B.evaluate(A.analyze(r.profiles));const single=T.build([s4.formations[0]],idx,{},4);assert(T.compare(balance,single,true)[0].axes.every(x=>x.delta===0));assert(T.compare(balance,single,false)[0].axes.every(x=>x.delta===null));assert(T.compare(balance,single,true)[1].axes.every(x=>x.delta===null));
assert.deepEqual(T.build([...s4.formations,s4.formations[0]],idx).groups.map(g=>g.count),[3,41,12]);
const bad={...s4.formations[0],id:'missing-general',members:s4.formations[0].members.map((m,i)=>({...m,general_id:i===0?'nonexistent':m.general_id}))};const skipped=T.build([bad],idx);assert.equal(skipped.groups[0].count,0);assert.equal(skipped.groups[0].skipped.length,1);
assert.equal(T.build(s4.formations,C.evidenceIndex(catalog,2),{},2).groups.reduce((s,g)=>s+g.count,0),0);
const changed=T.build(s4.formations,idx,{turns:1},4);assert.notEqual(changed.groups[0].power,result.groups[0].power);
// Changing one's equipment must not affect the published reference.
r.profiles[0].tactics=[];assert.deepEqual(T.build(s4.formations,idx).groups[0].axes,result.groups[0].axes);
console.log('Tier benchmarks: exact seasonal counts, arithmetic means, fixed published equipment, missing tiers, zero gaps, deduplication, conditions and isolation PASS');

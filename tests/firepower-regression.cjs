const assert=require('node:assert/strict');
require('../consultation/core');require('../consultation/evidence');require('../consultation/advisor');require('../consultation/balance');
const C=MobunagaConsult,A=MobunagaAdvisor,B=MobunagaBalance;
const idx=C.evidenceIndex(C.catalog(require('../assets/database.json'),require('../assets/s4-additions.json'),require('../assets/formations.json')),4);
const ids=['tachibanaginchiyo','tachibanadousetsu','hondatadakatsu'];
const run=(t,extra={})=>A.analyze(ids.map((id,i)=>A.profile(idx.generals.get(id),{tactics:i?[]:[t],...(!i?extra:{})},idx)));
const base=run('tr004');
for(const t of ['tr002','tr006','tr011','tr013','tr026','s4-ifuurinrin']){const a=run(t),b=B.evaluate(a);assert(b.power>B.evaluate(base).power,t);assert(b.axes[0].value>B.evaluate(base).axes[0].value,t);assert(a.healing<base.healing,t);}
const missing=run('tr053');assert.equal(missing.profiles[0].effects[1].p,null);assert.equal(missing.actors[0].physical,base.actors[0].physical);
assert(run('tr053',{tacticRates:{tr053:40}}).actors[0].physical>base.actors[0].physical);
const high=run('tr004',{physicalExtra:3000}),higher=run('tr013',{physicalExtra:3000});assert(B.evaluate(high).power>100);assert(B.evaluate(higher).axes[0].value>B.evaluate(high).axes[0].value,'no hard 100-point cap');
const g=idx.generals.get(ids[0]);const p=A.profile(g,{tactics:['tr013']},idx);const one=A.analyze([p],{turns:1}),two=A.analyze([p],{turns:2});assert.equal(one.actors[0].magic,0);assert(Math.abs(two.actors[0].magic-(104+74)*3*.35/2)<1e-9,'preparation and burn coefficients');
console.log('Firepower: healing swaps, physical/magic/normal/splash, missing rates, manual rates, preparation/burn and high-power differentiation PASS');

const assert=require('node:assert/strict');
require('../consultation/core');require('../consultation/evidence');require('../consultation/advisor');require('../consultation/balance');require('../consultation/variance');
const A=MobunagaAdvisor,V=MobunagaVariance;
const blank=(id='a')=>({general:{id,name:id,family:id},martial:150,intellect:150,defense:150,normals:1,weight:1,tactics:[],effects:[],unknown:[],physicalExtra:0,magicExtra:0,healExtra:0});
const attack=p=>({...blank(),effects:[{name:'攻撃',kind:'能動',p,e:[{kind:'physical',rate:100/p,targets:1}]}]});
const low=V.evaluate([attack(.2)],{},4,4000),high=V.evaluate([attack(.8)],{},4,4000);
assert(Math.abs(low.power.mean-high.power.mean)<1);assert(low.power.high-low.power.low>high.power.high-high.power.low);
assert(Math.abs(low.casts[0].zero-Math.pow(.8,8))<1e-12);assert(Math.abs(low.casts[0].earlyZero-Math.pow(.8,3))<1e-12);
const fixed=V.evaluate([attack(1)],{},4,20);assert.equal(fixed.power.low,fixed.power.high);assert.equal(fixed.casts[0].zero,0);
const prep=attack(1);prep.effects[0].prepare=1;assert.equal(V.evaluate([prep],{},4,20).casts[0].mean,4);assert.equal(V.evaluate([prep],{turns:1},4,20).casts[0].zero,1);
const ps=[blank('a'),blank('b'),blank('c')];ps[1].tactics=['tr024'];ps[1].effects=[{...A.tacticModel('tr024'),name:'自立の志',id:'tr024',p:.4}];
let v=V.evaluate(ps,{},4,1000);assert(v.axes[1].high>v.axes[1].low);assert(v.need.high>v.need.low);assert(Math.abs(v.casts[0].earlyZero-.216)<1e-12);
const trace={rng:()=>.99,casts:{}};const failed=A.analyze(ps,{},4,trace);assert.equal(failed.rows[0].normalShares[1],1/3);assert(Math.abs(failed.rows[0].need[1]-200/3)<1e-9);
const success=A.analyze(ps,{},4,{rng:()=>0,casts:{}});assert.equal(success.rows[0].normalShares[1],1);assert(Math.abs(success.rows[0].need[1]-((200*.5/3+200*.5)/1.55))<1e-9);
// One cast drives both damage and healing; do not sample those independently.
const linked=blank();linked.effects=[{name:'攻撃回復',kind:'能動',p:.4,e:[{kind:'magic',rate:100,targets:1},{kind:'heal',rate:50,targets:1}]}];const linkedResult=A.analyze([linked],{},4,{rng:V.random(),casts:{}});assert.equal(linkedResult.actors[0].magic,linkedResult.healing*2);
assert.deepEqual(V.evaluate(ps,{},4,30),V.evaluate(ps,{},4,30));
console.log('Variance: equal-mean volatility, exact nonactivation/early risk, deterministic casts, preparation, correlated defense/taunt and damage/healing PASS');

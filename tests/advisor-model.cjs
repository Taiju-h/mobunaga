const assert=require('node:assert/strict');
require('../consultation/core.js');require('../consultation/evidence.js');require('../consultation/advisor.js');
const C=global.MobunagaConsult,A=global.MobunagaAdvisor;
const close=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const base=require('../assets/formations.json'),s4=require('../assets/s4-templates.json');const db=C.catalog(require('../assets/database.json'),require('../assets/s4-additions.json'),base),index=C.evidenceIndex(db,4);
const simple=(id,defense=150)=>({general:{id,name:id,family:id,faction:id,gender:'男性'},martial:100,intellect:100,defense,normals:1,weight:1,physicalExtra:0,magicExtra:0,healExtra:0,tactics:[],effects:[],unknown:[],uniqueKind:'能動'});
const team=()=>[simple('a'),simple('b'),simple('c')];
let ps=team(),plain=A.analyze(ps);close(plain.required,200);
ps.forEach(p=>p.defense=300);close(A.analyze(ps).required,100);
// Low command is not rejected when mitigation achieves an equivalent lower load.
ps=team();ps[0].effects=[{name:'敵与ダメ低下',kind:'指揮',p:1,e:[{kind:'weaken',rate:.5,targets:3,until:3}]}];
let mitigated=A.analyze(ps);close(mitigated.rows[0].need.reduce((s,x)=>s+x,0),100);close(mitigated.rows[3].need.reduce((s,x)=>s+x,0),200);
ps[1].effects=[{name:'味方軽減',kind:'指揮',p:1,e:[{kind:'dr',rate:.5,targets:3,until:3}]}];close(A.analyze(ps).rows[0].need.reduce((s,x)=>s+x,0),50);
// A 300-command tank does not make the other two members safe.
ps=team();ps[0].defense=300;ps[0].healExtra=300;const tank=A.analyze(ps);assert.equal(tank.actors[0].risk,false);assert.equal(tank.actors[1].risk,true);assert.equal(tank.actors[2].risk,true);assert(tank.effective<40);
// Exact user-provided attack boundaries, no pooling magic into martial damage.
ps=team();ps[0].martial=250;ps[0].physicalExtra=100;assert(A.analyze(ps).actors[0].attackIndex>=1);
ps[0].martial=249;assert(A.analyze(ps).actors[0].attackIndex<1);
ps[0].martial=200;ps[0].normals=3;assert.equal(A.analyze(ps).actors[0].attackIndex,1);
ps[0].normals=2.99;assert(A.analyze(ps).actors[0].attackIndex<1);
ps[0].martial=199;assert.equal(A.analyze(ps).actors[0].attackIndex,0);
ps[0].intellect=250;ps[0].magicExtra=200;assert(A.analyze(ps).actors[0].attackIndex>=1);
// A 35%-proc guaranteed control is a 35% opportunity, not a guaranteed proc.
ps=team();ps[0].effects=[{name:'制御',kind:'能動',p:.35,e:[{kind:'control',rate:1,targets:1,status:'無策'}]}];assert(Math.abs(A.analyze(ps,{turns:1}).controlChance-.35)<1e-9);
ps[0].effects[0].kind='突撃';ps[0].normals=3;assert(Math.abs(A.analyze(ps,{turns:1}).controlChance-(1-.65**3))<1e-9);
assert.equal(A.analyze(ps,{turns:1,enemyResistance:100}).controlChance,0);
// Active interruption and heal prevention are separate.
ps=team();ps[0].effects=[{name:'回復',kind:'能動',p:1,e:[{kind:'heal',rate:200,targets:3}]}];assert.equal(A.analyze(ps,{activeUptime:0}).healing,0);assert.equal(A.analyze(ps,{healAllowed:0}).healing,0);
ps[0].effects[0].kind='指揮';assert.equal(A.analyze(ps,{activeUptime:0}).healing,600);
assert.deepEqual(A.castTimeline(1,4,1),[0,1,0,1]);
// Only three different factions with an eligible leader can activate the equipped formation.
ps=team();ps[0].effects=[{name:'固有',isUnique:true,kind:'能動',p:.4,e:[{kind:'physical',rate:100,targets:1}]}];ps[1].tactics=['tr113'];assert.equal(A.analyze(ps,{turns:1},4).actors[0].physical,153);ps[2].general.faction='b';assert.equal(A.analyze(ps,{turns:1},4).actors[0].physical,140);
const forms=C.templatesForSeason(base,s4,4),fixed=['matsu','kakizakikageie'];assert(C.eligible(forms,fixed).every(f=>fixed.every(id=>f.members.some(m=>m.general_id===id))));
const recommendations=A.recommend(fixed,db.generals,{},index,{},4,['toyotomihideyoshi'],forms);assert(!recommendations.some(r=>r.general.id==='toyotomihideyoshi'));assert(recommendations.every(r=>!fixed.includes(r.general.id)));assert(recommendations.every(r=>Number.isFinite(r.score)));
const unknown=A.profile(index.generals.get('uesugikenshin'),{},index);assert(unknown.unknown.length>0);
console.log('Advisor model: borders, mitigation expiry, per-member exposure, healing coverage, status probability, alliance, exclusion PASS');
// Nagano's transmissible heal is command-scaled, but the unknown curve is never invented.
const nago=index.generals.get('naganonarimasa'),rik=A.RIKURYOKU;
const rProfile=opts=>A.profile(nago,{tactics:[rik],...opts},index);
let rp=rProfile({}),ra=A.analyze([rp,simple('b'),simple('c')],{turns:1});close(ra.healing,.34*82*2);
close(A.analyze([rProfile({defense:600}),simple('b'),simple('c')],{turns:1}).healing,ra.healing);
ra=A.analyze([rProfile({rikuryokuRate:50,rikuryokuHeal:100,rikuryokuTarget:'lowest'}),simple('b'),simple('c')],{turns:1,activeUptime:0});close(ra.actors[0].healing,50);close(ra.actors[1].healing,25);close(ra.healing,100);
ra=A.analyze([rProfile({rikuryokuRate:50,rikuryokuHeal:100,rikuryokuTarget:'others'}),simple('b'),simple('c')],{turns:1});close(ra.actors[0].healing,0);close(ra.actors[1].healing,50);
const snapshot=JSON.stringify(forms),variants=A.replacementVariants(forms,index);assert(variants.length>0);assert.equal(JSON.stringify(forms),snapshot);
assert(variants.every(v=>v.configs.length===3&&v.configs.every(c=>c.tactics.length<=2)&&v.configs.flatMap(c=>c.tactics).filter(id=>id===rik).length===1));
assert(variants.some(v=>v.mitigationDelta<0));assert(variants.some(v=>v.attackDelta<0));assert(variants.every(v=>Number.isFinite(v.delta)));
assert.equal(A.replacementVariants(forms,index,{}, {},3).length,0);
assert(A.replacementVariants(forms,index,{}, {},4,fixed,['toyotomihideyoshi']).every(v=>fixed.every(id=>v.formation.members.some(m=>m.general_id===id))&&!v.formation.members.some(m=>m.general_id==='toyotomihideyoshi')));
console.log(`Nagano: ${forms.length} source templates evaluated, ${variants.length} one-slot variants; healing targets, interruption, manual scaling, losses, source immutability and seasons PASS`);

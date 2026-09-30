const assert=require('node:assert/strict');
require('../consultation/core');require('../consultation/evidence');require('../consultation/advisor');require('../consultation/loadout');
const C=global.MobunagaConsult,A=global.MobunagaAdvisor,L=global.MobunagaLoadout;
const db=C.catalog(require('../assets/database.json'),require('../assets/s4-additions.json'),require('../assets/formations.json')),index=C.evidenceIndex(db,4),forms=require('../assets/s4-templates.json').formations;
const names=p=>p.profiles.flatMap(p=>p.tactics);
const opt={season:4,purpose:'pvp',mode:'family'};
let p=L.team(['kakizakikageie'],{},index,forms,opt);assert.equal(p.profiles[0].tactics.filter(Boolean).length,2);assert(p.details.kakizakikageie.every(t=>t.reasons.some(r=>r.includes('武勇'))));
const physical=names(p);
p=L.team(['kakizakikageie'],{kakizakikageie:{focus:'intellect'}},index,forms,opt);assert.notDeepEqual(names(p),physical);assert(p.details.kakizakikageie.every(t=>t.reasons.some(r=>r.includes('知略'))));
p=L.team(['kakizakikageie'],{kakizakikageie:{martial:100,intellect:400}},index,forms,opt);assert.equal(L.focus(p.profiles[0].general,p.configs.kakizakikageie),'intellect');
// Attribute-neutral recovery/mitigation may fill a support role. Purpose/counters affect ranking.
const g=index.generals.get('toyotomihideyoshi');const rank=o=>L.rankedTactics(g,{},index,forms,{...opt,...o});
assert.notDeepEqual(rank({purpose:'land'}).map(t=>t.id),rank({purpose:'pvp'}).map(t=>t.id));
assert(rank({counters:['confusion']}).find(t=>t.id==='tr004').score>rank({}).find(t=>t.id==='tr004').score);
// Explicit/manual empty slots are respected; automatic slots reselect, with no duplicate automatic equipment.
p=L.team(['kakizakikageie','uesugikenshin'],{kakizakikageie:{tactics:['tr002',''],manualSlots:[true,false],focus:'intellect'}},index,forms,opt);
assert.equal(p.configs.kakizakikageie.tactics[0],'tr002');assert.equal(new Set(names(p)).size,4);
p=L.team(['kakizakikageie'],{kakizakikageie:{tactics:['','tr002'],manualSlots:[true,true]}},index,forms,opt);assert.deepEqual(names(p),['','tr002']);
// Strict same-family filter checks all anchors; no bonus-only exceptions.
let rec=A.recommend(['kakizakikageie'],db.generals,{},index,{},4,[],forms,opt);assert(rec.length>0);assert(rec.every(r=>r.general.family==='uesugi-clan'));assert(rec.every(r=>r.plan.configs[r.general.id].tactics.filter(Boolean).length===2));
assert.equal(A.recommend(['kakizakikageie','matsu'],db.generals,{},index,{},4,[],forms,opt).length,0);
const ally={...opt,mode:'alliance'};
rec=A.recommend(['kakizakikageie','matsu'],db.generals,{},index,{},4,[],forms,ally);assert(rec.length>0);assert(rec.every(r=>new Set(r.assessment.profiles.map(p=>p.general.family)).size===3&&r.assessment.allianceEquipped));
const base=L.team(['kakizakikageie','matsu'],{},index,forms,ally);assert(rec.every(r=>['kakizakikageie','matsu'].every(id=>JSON.stringify(r.plan.configs[id].tactics)===JSON.stringify(base.configs[id].tactics))));
assert.equal(A.recommend(['toyotomihideyoshi'],db.generals,{},index,{},4,[],forms,ally).length,0);
assert.equal(A.recommend(['matsu','kakizakikageie'],db.generals,{},index,{},4,[],forms,ally).length,0);
assert.equal(A.recommend(['kakizakikageie','uesugikenshin'],db.generals,{},index,{},4,[],forms,ally).length,0);
const excluded=rec[0].general.id;assert(!A.recommend(['kakizakikageie','matsu'],db.generals,{},index,{},4,[excluded],forms,ally).some(r=>r.general.id===excluded));
// A manually equipped formation invokes strict alliance even when family mode was requested.
const manual={kakizakikageie:{tactics:['tr113','tr002'],manualSlots:[true,true]}};
assert(A.recommend(['kakizakikageie'],db.generals,manual,index,{},4,[],forms,opt).every(r=>r.general.family!=='uesugi-clan'));
// No later-season equipment or recommendations; missing leader type is never guessed.
const early=C.evidenceIndex(db,1),earlyForms=C.templatesForSeason(require('../assets/formations.json'),{},1);
p=L.team(['toyotomihideyoshi'],{},early,earlyForms,{season:1,purpose:'land',mode:'family'});assert(names(p).every(id=>early.tactics.has(id)));assert(!names(p).includes(A.RIKURYOKU));assert(!names(p).includes('tr113'));
assert.equal(L.recommend(['toyotomihideyoshi'],db.generals,{},early,{},1,[],earlyForms,{mode:'alliance'}).length,0);
// Every source general receives a finite, two-slot baseline without mutating source data.
const snapshot=JSON.stringify(forms);
for(const g of db.generals){p=L.team([g.id],{},index,forms,opt);assert.equal(p.configs[g.id].tactics.filter(Boolean).length,2);assert(Number.isFinite(A.analyze(p.profiles).score));assert.equal(new Set(names(p).map(id=>index.tactics.get(id)?.name)).size,2);const command=L.team([g.id],{[g.id]:{focus:'defense'}},index,forms,opt);assert.equal(new Set(names(command).map(id=>index.tactics.get(id)?.name)).size,2);}
assert.equal(JSON.stringify(forms),snapshot);
console.log('Loadouts: all 137 generals, attribute/purpose defaults, manual preservation, strict family/alliance, fixed equipment, unknown leaders, exclusion, seasons PASS');

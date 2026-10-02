'use strict';
// Read every source effect. Candidate axes are review hints, never numeric bonuses.
const fs=require('node:fs'),path=require('node:path');
require('../consultation/core.js');require('../consultation/evidence.js');require('../consultation/advisor.js');
const C=MobunagaConsult,A=MobunagaAdvisor,root=path.join(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const db=C.catalog(read('assets/database.json'),read('assets/s4-additions.json'),read('assets/formations.json')),index=C.evidenceIndex(db,4);
const axes=text=>Object.entries({attack:/兵刃|計略|ダメージ|武勇|知略|会心|連撃|反撃/,defense:/被ダメ|軽減|統率|鉄壁|回避|挑発|通常攻撃を受ける|分担/,recovery:/回復|離反|心攻|休養/,status:/洞察|耐性|解除|麻痺|混乱|無策|封撃|威圧|疲弊/}).filter(([,re])=>re.test(text||'')).map(([axis])=>axis);
const rows=[];
for(const g of index.generals.values()){
 const p=A.profile(g,{rank:5},index),u=p.effects[0];
 rows.push({type:'unique',owner:g.id,name:u.name,source:g.source?.source_url,axes:axes(u.effect),status:u.unmodeled?'unmodeled':'partial',calculations:u.e.map(e=>e.kind),notes:u.note||null});
 for(const t of g.traits||[]){const audit=p.traitAudit.find(x=>x.name===t.name);rows.push({type:'trait',owner:g.id,name:t.name,unlock:A.traitUnlock(t),source:g.source?.source_url,axes:axes(t.effect),status:audit?.status||'未計算',basis:audit?.basis||'解除条件未確認'});}
}
for(const t of index.tactics.values()){const m=A.tacticModel(t.id);rows.push({type:'tactic',id:t.id,name:t.name,source:t.source?.source_url,axes:axes(t.effect),status:m?'partial':'unmodeled',calculations:m?.e.map(e=>e.kind)||[],notes:m?.note||null});}
const summary={};for(const r of rows){const key=r.type+':'+r.status;summary[key]=(summary[key]||0)+1;}
const report={season:4,description:'全効果の計算対応表。axesは原文からの確認候補であり加点ルールではない。partialは登録済みの効果だけを計算し、完全再現を意味しない。',summary,entries:rows};
fs.writeFileSync(path.join(root,'consultation/effect-coverage.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({entries:rows.length,summary}));

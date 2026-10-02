"use strict";
(function(root){
const clamp=x=>Math.max(0,Math.min(100,x));
// Editorial role scores, deliberately separate from expected damage/healing rates.
function evaluate(a){
 const sources=a.profiles.flatMap(p=>p.effects.map(e=>({owner:p.general.id,name:e.name,text:e.effect||'',kinds:e.e.map(x=>x.kind)}))),notes=[];
 const traits=a.profiles.flatMap(p=>(p.activeTraits||[]).map(t=>({owner:p.general.id,name:t.name,text:t.effect||'',kinds:[]})));
 sources.push(...traits);
 const offensive=s=>s.kinds.includes('control')||/(?:麻痺|混乱|無策|封撃|威圧|回復不可)(?:状態)?(?:を|に)[^。]*付与/.test(s.text);
 const defensive=s=>s.kinds.some(k=>['protect','cleanse'].includes(k))||/洞察|耐性|浄化|(?:弱体|制御|状態異常)[^。]*解除/.test(s.text);
 const count=re=>sources.filter(s=>re.test(s.text)).length;
 const controlSources=sources.filter(offensive).length;
 const protectionSources=sources.filter(defensive).length;
 const quantitativeProtection=a.actors.reduce((s,x)=>s+x.protection,0)/a.actors.length;
 const inflict=clamp(100*a.rows.reduce((s,r)=>s+r.controlChance,0)/a.rows.length+12*controlSources);
 const resist=clamp(100*quantitativeProtection+15*protectionSources);
 let recovery=clamp(a.recovery*70+10*count(/回復率|兵力を回復/));
 const gin=a.profiles.find(p=>p.general.id==='tachibanaginchiyo');
 if(gin){
  const providers=sources.filter(s=>s.owner!==gin.general.id&&/麻痺/.test(s.text)&&offensive(s));
  if(providers.length){recovery=clamp(recovery+20);notes.push('誾千代＋'+[...new Set(providers.map(s=>a.profiles.find(p=>p.general.id===s.owner).general.name))].join('・')+'：味方の麻痺付与で、誾千代の条件付き回復を支援（比較用の回復点＋20）。行動順・麻痺の命中で変動します。');}
  else notes.push('誾千代の回復は敵の麻痺が条件。別の麻痺役を加えると回復条件を補えます。');
 }
 const power=a.actors.reduce((v,x)=>v+(x.physical*x.profile.martial+x.magic*x.profile.intellect)/1500,0);
 const defense=clamp(100*a.durability/(1+a.durability));
 const axes=[{key:'attack',label:'火力',value:clamp(power)},{key:'defense',label:'防御',value:defense},{key:'recovery',label:'回復',value:recovery},{key:'status',label:'状態異常',value:(inflict+resist)/2}].map(x=>({...x,value:Math.round(x.value)}));
 if(a.profiles.some(p=>p.activeTraits?.some(t=>/通常攻撃を受ける確率中幅上昇/.test(t.effect))))notes.push('被通常攻撃率の中幅上昇は、比重'+a.cfg.aggroMedium+'倍と仮定した比較です。実倍率は未確認。比較条件から1倍にすると誘導増加を除いた結果になります。');
 const families=a.profiles.map(p=>p.general.family),threeFamilies=a.complete&&families.every(Boolean)&&new Set(families).size===3;
 const leaders=threeFamilies&&a.cfg? a.profiles.filter(p=>['能動','突撃'].includes(p.uniqueKind)).map(p=>p.general.id):[];
 return {axes,inflict:Math.round(inflict),resist:Math.round(resist),notes,threeFamilies,leaders,unknown:a.unknown.length};
}
root.MobunagaBalance={evaluate};
})(typeof window!=="undefined"?window:globalThis);

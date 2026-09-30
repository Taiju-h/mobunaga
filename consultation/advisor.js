"use strict";
/* Transparent heuristic, not the game's damage formula. Rates are Lv10 coefficients.
 * Unknown mechanics stay unknown; no zero-damage/zero-healing conclusion follows. */
(function(root){
const C=root.MobunagaConsult;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,Number(v)||0));
const mean=a=>a.reduce((s,x)=>s+x,0)/(a.length||1);
const sum=a=>a.reduce((s,x)=>s+x,0);
const defaultScenario={turns:8,enemyRate:200,activeUptime:100,normalUptime:100,healAllowed:100,enemyResistance:0,physicalShare:50,enemyHits:3};
const D=(kind,rate,targets=1,extra={})=>({kind,rate,targets,...extra});
// Only reviewed, unambiguous portions are quantified. Notes name omissions.
const RIKURYOKU='naganonarimasa-rikuryokudoushin';
const T={
 'naganonarimasa-rikuryokudoushin':{kind:'指揮',p:.34,e:[D('heal',82,2,{target:'rikuryoku',scaling:'統率'})],note:'発動率と回復率は統率依存。上乗せ式は未確定なので、表記34%・82%を初期値とし実機表示で補正。回復先は兵力条件で変更'},
 tr002:{prepare:1,e:[D('physical',254,3)]},tr003:{prepare:1,e:[D('magic',142,2),D('heal',106,2)]},
 tr004:{e:[D('heal',260,1,{target:'injured'}),D('cleanse',1,1,{target:'injured'})]},
 tr005:{e:[D('physical',106,3)],note:'封撃・無策を条件とする威圧は未加算'},
 tr007:{prepare:1,e:[D('control',1,2,{status:'無策',duration:2})]},
 tr008:{e:[D('physical',228),D('control',1,1,{status:'麻痺',duration:2,stopChance:.3})],note:'会心の条件付き追加分は未加算'},
 tr015:{prepare:1,e:[D('control',1,2,{status:'混乱',duration:2})]},
 tr016:{prepare:1,e:[D('magic',98,3,{duration:2,dot:true}),D('control',1,3,{status:'回復不可',duration:2})]},
 tr017:{e:[D('heal',132,2)],note:'兵力50%以下で増える回復率は未加算'},
 tr018:{e:[D('double',1,1,{target:'self'}),D('double',1,1,{target:'other'})]},
 tr019:{e:[D('double',1,1,{target:'self'}),D('protect',1,1,{target:'self',status:'封撃耐性'})]},
 tr020:{e:[D('protect',1,1,{target:'other',duration:2,status:'洞察'})],note:'最後に行動する場合は自身が対象。対象・行動順の確定は別途必要'},
 tr022:{e:[D('dr',.20,2,{target:'opposite',duration:2})],note:'異性の対象がいなければ除外。肩代わり分は未計算'},
 tr027:{e:[D('dr',.24,2,{duration:2})],note:'属性依存の増分・2重掛け・初動の発動率増加は未加算'},
 tr028:{e:[D('magic',162),D('control',1,1,{status:'混乱'})],note:'既混乱時の追加ダメージは未加算'},
 tr029:{prepare:1,e:[D('magic',254,3)]},tr032:{e:[D('physical',168),D('magic',168)]},
 tr033:{e:[D('physical',172),D('control',1,1,{status:'無策'})]},
 tr036:{e:[D('magic',102,2),D('weaken',.12,2,{duration:2})]},
 tr039:{e:[D('heal',108,2)]},tr041:{e:[D('physical',84,1,{hits:3})],note:'2〜4回は各回数が同確率と仮定して平均3回'},
 tr043:{e:[D('magic',186),D('shield',1,1,{target:'other'})]},
 tr047:{prepare:1,e:[D('control',1,2,{status:'無策または封撃'})],note:'2ターンへの延長分は未加算'},
 tr054:{e:[D('magic',146),D('control',1,1,{status:'混乱'})]},
 tr057:{e:[D('cleanse',1,2)],note:'能力上昇分は実能力値入力で反映'},
 tr059:{e:[D('magic',136),D('control',1,1,{status:'封撃',duration:2})]},
 tr061:{prepare:1,e:[D('heal',144,2.5)],note:'2〜3名は平均2.5名の仮定。南蛮系対象への増量は未加算'},
 tr062:{kind:'指揮',p:1,e:[D('control',1,2,{status:'封撃',schedule:[.70,.56,.42,0,0,0,0,0]})]},
 tr067:{kind:'指揮',p:1,e:[D('weaken',.28,2,{until:3})]},
 tr068:{kind:'指揮',p:1,e:[D('dr',.18,2,{until:3})],note:'兵刃/計略の追加6%・属性依存増分・大将技の分担は未加算'},
 tr069:{kind:'指揮',p:1,e:[D('heal',122,2,{schedule:'keifuu'})]},
 tr071:{kind:'指揮',p:1,e:[D('dr',.22,2,{until:4})]},
 tr072:{kind:'指揮',p:1,e:[D('heal',108,2,{from:5})]},
 tr080:{kind:'受動',p:1,e:[D('heal',140,1,{target:'self'})]},
 tr094:{kind:'受動',p:1,e:[D('heal',100,1,{target:'self'})]},
 tr096:{e:[D('physical',192),D('control',1,1,{status:'混乱'})]},
 tr097:{e:[D('shield',2,1,{target:'leader'})],note:'大将自身の装備時は鉄壁1回。敵の属性低下は未数値化'},
 tr098:{e:[D('physical',158),D('magic',158)],note:'相手との属性差による実ダメージ増減は未計算'},
 tr099:{e:[D('magic',260),D('control',1,1,{status:'被回復低下'})]},
 tr101:{e:[D('physical',316)]},tr103:{e:[D('control',1,1,{status:'無策'})]},
 tr104:{e:[D('physical',232),D('heal',54,1,{target:'self',from:3})]},
 tr113:{kind:'陣形',p:1,e:[],note:'3家門・大将固有の種類を満たす場合のみ大将固有の発動率+13ポイント。副将の兵力順が不明なため副将の増減は未計算'}
};
const G={
 oichi:{kind:'能動',p:.5,e:[D('heal',118,2)],note:'発動率50%は出典の運用解説から確認。与ダメ上昇は未加算'},
 houjouujiyasu:{kind:'未確認',e:[],note:'出典の固有欄と運用解説で種別・確率の記載が整合しないため、鉄壁の数値計算は保留'},
 toyotomihideyoshi:{kind:'指揮',p:1,e:[D('heal',76,2.35)],note:'2名回復が35%で全体になるモデル。属性依存増分は未計算'},
 hondamasanobu:{kind:'指揮',p:1,e:[D('dr',.35,3,{until:2}),D('heal',66,3,{from:3,until:5})],note:'回避を平均軽減に換算する仮定。必ず軽減されるわけではない'},
 jukeini:{kind:'指揮',p:1,e:[D('dr',.18,1,{target:'leader',until:2}),D('protect',1,1,{target:'leader',until:2,status:'洞察'})],note:'後半の離反・心攻は未計算'},
 saegusamasazada:{kind:'指揮',p:1,e:[D('dr',.22,2,{until:4})]},
 haratoratane:{kind:'受動',p:1,e:[D('dr',.35,1,{target:'self'})],note:'騎兵・鉄砲相手の追加軽減は未加算'},
 takahashijouun:{kind:'受動',p:1,e:[D('protect',1,1,{target:'self',status:'洞察'})],note:'属性条件の火力上昇は未加算'},
 kakizakikageie:{kind:'突撃',p:.9,e:[D('physical',108),D('physical',108,1,{chance:.5}),D('control',.4,1,{status:'無策'})],note:'無策確率の累積、大将時の追加20%、既無策時の回復は未加算'},
 datemasamune:{p:1,kind:'未確認',trigger:'turn',e:[D('physical',92,1,{until:5}),D('magic',92,1,{until:5})],note:'初期5スタックのみ。属性上昇・粋の再獲得・大将追加は未加算。固有種別は要確認'},
 kurodakanbee:{p:1,kind:'未確認',trigger:'turn',e:[D('magic',88,1,{hits:1.5,chance:.6})],note:'1〜2回を平均1.5回と仮定。奇策・大将の追加確率は未加算'},
 kanisaizou:{prepare:1,kind:'能動',e:[D('physical',522),D('control',1,1,{status:'回復不可',duration:3})]},
 suwahime:{kind:'能動',p:.45,e:[D('cleanse',1,2)]},
 hachisukaiemasa:{alias:'tr039'},hoshinamasatoshi:{alias:'tr033'},shibatashigeie:{alias:'tr054'},
 ikedasen:{alias:'tr047'},takedayoshinobu:{alias:'tr103'},kunishimotosuke:{alias:'tr104'},
 oohouritsuru:{kind:'未確認',e:[],note:'友軍の被通常攻撃が条件。被弾回数・対象が未確定なので火力の自動加算なし'},
 kikkawahiroie:{kind:'未確認',noNormal:true,e:[],note:'通常攻撃しない。固有効果文が未整備のため自己回復を数値化できません'}
};
function probability(t){const a=String(t?.activation_rate||'');const m=a.match(/([\d.]+)\s*\(Lv10\)/i);if(m)return clamp(+m[1]/100);
 const e=String(t?.effect||'').normalize('NFKC');const x=e.match(/発動確率\s*[\d.]+%\s*→\s*([\d.]+)%/)||e.match(/発動確率\s*([\d.]+)%/);return x?clamp(+x[1]/100):null;}
function baseStats(g){const get=k=>Number((g.stats||[]).find(s=>(s.attribute||s.stat)===k)?.level50)||0;return {martial:get('武勇'),intellect:get('知略'),defense:get('統率'),normals:G[g.id]?.noNormal?0:1,weight:1,physicalExtra:0,magicExtra:0,healExtra:0,tactics:[],uniqueRate:null,uniqueKind:'',rikuryokuRate:34,rikuryokuHeal:82,rikuryokuTarget:'average'};}
function resolveModel(g,t,index,isUnique){
 let def=isUnique?G[g.id]:T[t.id],source=t;
 if(def?.alias){source=index.tactics.get(def.alias)||t;def=T[def.alias];}
 const kind=def?.kind||source.category||(String(t.effect).startsWith('通常攻撃後')?'突撃':String(t.effect).startsWith('1ターンの準備後')?'能動':'未確認');
 const p=def?.p??probability(source);
 return {...(def||{}),kind,p,e:def?.e||[],name:t.name||'固有戦法',effect:t.effect||'',source:g.source?.source_url,unmodeled:!def};
}
function profile(g,override={},index){const p={...baseStats(g),...override,general:g};for(const k of ['martial','intellect','defense'])p[k]=clamp(p[k],0,1000);p.weight=clamp(p.weight,0,100);p.normals=clamp(p.normals,0,10);
 p.effects=[];p.unknown=[];const unique=resolveModel(g,g.unique_tactic||{},index,true);
 if(p.uniqueKind)unique.kind=p.uniqueKind;
 if(p.uniqueRate!==null&&p.uniqueRate!==''&&p.uniqueRate!==undefined)unique.p=clamp(p.uniqueRate/100);
 p.uniqueKind=unique.kind;p.effects.push({...unique,isUnique:true});
 for(const id of [...new Set(p.tactics||[])].slice(0,2)){const t=index.tactics.get(id);if(!id)continue;if(t)p.effects.push({...resolveModel(g,t,index,false),source:t.source?.source_url,id});else p.unknown.push('装備戦法のデータなし / '+id);}
 for(const e of p.effects){if(e.id===RIKURYOKU){e.p=clamp(p.rikuryokuRate/100);e.e=e.e.map(x=>({...x,rate:clamp(p.rikuryokuHeal,0,1000)}));}if(e.unmodeled)p.unknown.push(e.name+'：数値モデル未登録');else if(e.p===null)p.unknown.push(e.name+'：発動率未収録');if(e.note)p.unknown.push(e.name+'：'+e.note);}
 return p;
}
// Exact finite-horizon expectation for this simplified cast/preparation/cooldown process.
function castTimeline(p,turns,prepare=0,cooldown=0,availability=1){
 p=clamp(p)*clamp(availability);let states=new Map([[0,1]]);const out=[];
 for(let t=0;t<turns;t++){const next=new Map(),put=(k,v)=>next.set(k,(next.get(k)||0)+v);let casts=0;
 for(const [wait,mass] of states){if(wait>0){if(wait===1){casts+=mass;put(-cooldown,mass);}else put(wait-1,mass);}else if(wait<0)put(wait+1,mass);else{put(0,mass*(1-p));if(prepare)put(prepare,mass*p);else{casts+=mass*p;put(-cooldown,mass*p);}}}
 out.push(casts);states=next;
 }return out;
}
function alliance(profiles,season){if(season<3)return {eligible:false,reason:'会盟の陣はS3以降'};if(profiles.length!==3)return {eligible:false,reason:'会盟は3名が揃ってから判定'};
 const factions=profiles.map(p=>p.general.family);if(factions.some(f=>!f)||new Set(factions).size!==3)return {eligible:false,reason:'会盟は3名の家門がすべて異なる必要があります'};
 if(!['能動','突撃'].includes(profiles[0].uniqueKind))return {eligible:false,reason:'大将固有が能動・突撃かを確認してください'};
 return {eligible:true,reason:'3家門・大将固有の条件を満たす会盟候補（装備時のみ有効）'};
}
function recipients(effect,owner,profiles){const n=profiles.length,all=profiles.map((_,i)=>i);let ids=all;
 if(effect.target==='rikuryoku'){const mode=profiles[owner].rikuryokuTarget;if(mode==='lowest')return profiles.map((_,i)=>i===owner?1:1/Math.max(1,n-1));if(mode==='others')return profiles.map((_,i)=>i===owner?0:Math.min(1,2/Math.max(1,n-1)));}
 if(effect.target==='self')ids=[owner];if(effect.target==='leader')ids=[0];if(effect.target==='other')ids=all.filter(i=>i!==owner);
 if(effect.target==='opposite'){const sex=profiles[owner].general.gender;const opposite=all.filter(i=>i!==owner&&sex&&profiles[i].general.gender&&profiles[i].general.gender!==sex);ids=opposite.length?[owner,...opposite]:[];}
 const targets=effect.target==='self'||effect.target==='leader'?1:effect.targets;
 return profiles.map((_,i)=>ids.includes(i)?Math.min(1,targets/Math.max(1,ids.length)):0);
}
function schedule(e,t,profile){if(t<(e.from||1)||t>(e.until||8))return 0;if(Array.isArray(e.schedule))return e.schedule[t-1]||0;if(e.schedule==='keifuu')return t%2===0?.8:profile.general.gender==='女性'?.2:0;return 1;}
function analyze(profiles,scenario={},season=4){
 const cfg={...defaultScenario,...scenario};cfg.turns=Math.round(clamp(cfg.turns,1,8));cfg.enemyRate=clamp(cfg.enemyRate,1,2000);
 for(const key of ['activeUptime','normalUptime','healAllowed','enemyResistance','physicalShare'])cfg[key]=clamp(cfg[key],0,100);cfg.enemyHits=clamp(cfg.enemyHits,1,30);
 const n=profiles.length;if(!n)return null;const w=profiles.map(p=>p.weight),totalWeight=sum(w);const shares=w.map(x=>totalWeight?x/totalWeight:1/n);
 const a=alliance(profiles,season),hasAlliance=profiles.some(p=>p.tactics.includes('tr113'));
 const timelines=profiles.map((p,i)=>p.effects.map(model=>{
 let chance=model.p;if(chance===null)return {model,values:Array(cfg.turns).fill(0),unknown:true};
 if(model.isUnique&&i===0&&hasAlliance&&a.eligible)chance=clamp(chance+.13);
 const active=model.kind==='能動',trigger=model.kind==='突撃';
 const values=active?castTimeline(chance,cfg.turns,model.prepare||0,model.cooldown||0,cfg.activeUptime/100):Array(cfg.turns).fill(trigger?chance*p.normals*cfg.normalUptime/100:chance);
 return {model,values,chance};
 }));
 const rows=[],weakenSources=new Set(),drSources=new Set(),unknown=profiles.flatMap(p=>p.unknown.map(s=>p.general.name+' / '+s));
 if(hasAlliance&&!a.eligible)unknown.push('会盟の陣：成立条件を満たしていないため効果を加算していません');
 const actorTotals=profiles.map(()=>({physical:0,magic:0,heal:0,activeHeal:0,normals:0}));
 let controlNone=1;
 for(let turn=1;turn<=cfg.turns;turn++){
  const physical=profiles.map(()=>0),magic=profiles.map(()=>0),heal=profiles.map(()=>0),activeHeal=profiles.map(()=>0),dr=profiles.map(()=>1),shield=profiles.map(()=>0),protect=profiles.map(()=>0),doubles=profiles.map(()=>0);
  profiles.forEach((p,owner)=>{for(const {model,values,unknown:missing} of timelines[owner]){if(missing)continue;for(const e of model.e.filter(e=>e.kind==='double')){let miss=1;for(let t=Math.max(0,turn-(e.duration||1));t<turn;t++)miss*=1-clamp(values[t]*schedule(e,t+1,p));recipients(e,owner,profiles).forEach((v,i)=>{doubles[i]=Math.max(doubles[i],clamp((1-miss)*v));});}}});
  const normalsAt=profiles.map((p,i)=>(p.normals+Math.max(0,2-p.normals)*doubles[i])*cfg.normalUptime/100);
  const weakened={physical:1,magic:1};let controlMiss=1,hardStop=0;
  profiles.forEach((p,owner)=>{for(const {model,values,chance,unknown:missing} of timelines[owner]){if(missing)continue;
   for(const e of model.e){const current=schedule(e,turn,p),duration=e.duration||1;let uptime=1;
    // Repeated same-source effects refresh; they do not add indefinitely.
    for(let t=Math.max(0,turn-duration);t<turn;t++)uptime*=1-clamp(values[t]*schedule(e,t+1,p));uptime=1-uptime;
    const casts=(model.kind==='突撃'?chance*normalsAt[owner]:values[turn-1])*current,proc=casts*(e.chance??1),targets=e.targets||1,hits=e.hits||1;
    const rec=recipients(e,owner,profiles),token=p.general.id+':'+model.name;
    if(e.kind==='physical'||e.kind==='magic'){const amount=e.rate*targets*hits*(e.dot?uptime:proc);(e.kind==='physical'?physical:magic)[owner]+=amount;}
    if(e.kind==='heal'){const amount=e.rate*proc*cfg.healAllowed/100;rec.forEach((v,i)=>{heal[i]+=amount*v;if(model.kind==='能動')activeHeal[i]+=amount*v;});actorTotals[owner].heal+=sum(rec)*amount;if(model.kind==='能動')actorTotals[owner].activeHeal+=sum(rec)*amount;}
    if(e.kind==='dr'&&uptime){rec.forEach((v,i)=>dr[i]*=1-clamp(e.rate*uptime*v));drSources.add(token);}
    if(e.kind==='weaken'&&uptime){const r=clamp(e.rate*uptime*targets/3*(1-cfg.enemyResistance/100));weakened.physical*=1-r;weakened.magic*=1-r;weakenSources.add(token);}
    if(e.kind==='shield')rec.forEach((v,i)=>shield[i]+=proc*(model.id==='tr097'&&owner===0?1:e.rate)*v);
    if(e.kind==='protect'||e.kind==='cleanse')rec.forEach((v,i)=>protect[i]=Math.max(protect[i],clamp(uptime*v)));
    if(e.kind==='double')rec.forEach((v,i)=>doubles[i]=Math.max(doubles[i],clamp(uptime*v)));
    if(e.kind==='control'){const application=clamp(e.rate*(e.chance??1)*(1-cfg.enemyResistance/100));const attempts=casts;let event=clamp(attempts*application);if(model.kind==='突撃'){const tries=normalsAt[owner],whole=Math.floor(tries),fraction=tries-whole,q=clamp(chance*application*current);event=(1-fraction)*(1-Math.pow(1-q,whole))+fraction*(1-Math.pow(1-q,whole+1));}controlMiss*=1-event;if(e.stopChance)hardStop+=uptime*e.rate*e.stopChance*targets*(1-cfg.enemyResistance/100);}
   }
  }});
  profiles.forEach((p,i)=>{const normals=(p.normals+Math.max(0,2-p.normals)*doubles[i])*cfg.normalUptime/100;physical[i]+=100*normals+clamp(p.physicalExtra,0,5000);magic[i]+=clamp(p.magicExtra,0,5000);heal[i]+=clamp(p.healExtra,0,5000)*cfg.healAllowed/100;actorTotals[i].physical+=physical[i];actorTotals[i].magic+=magic[i];actorTotals[i].normals+=normals;});
  const enemyFactor=weakened.physical*cfg.physicalShare/100+weakened.magic*(1-cfg.physicalShare/100);
  const need=profiles.map((p,i)=>cfg.enemyRate*shares[i]*150/Math.max(1,p.defense)*dr[i]*enemyFactor);
  const covered=heal.map((v,i)=>Math.min(v,need[i]));
  const row={turn,physical,magic,heal,activeHeal,need,covered,dr,shield,protect,enemyReduction:1-enemyFactor,controlChance:1-controlMiss,hardStop};rows.push(row);controlNone*=controlMiss;
 }
 const actors=profiles.map((p,i)=>{const physical=actorTotals[i].physical/cfg.turns,magic=actorTotals[i].magic/cfg.turns,normals=actorTotals[i].normals/cfg.turns;
 const attackIndex=Math.max(p.martial>=250?physical/200:0,p.intellect>=250?magic/200:0,p.martial>=200?normals/3:0);
 const need=mean(rows.map(r=>r.need[i])),healing=mean(rows.map(r=>r.heal[i])),shield=mean(rows.map(r=>r.shield[i]));return {profile:p,physical,magic,normals,attackIndex,need,healing,shield,protection:mean(rows.map(r=>r.protect[i])),activeHeal:actorTotals[i].activeHeal/cfg.turns,healsProduced:actorTotals[i].heal/cfg.turns,
  load:need/(cfg.enemyRate*shares[i]||1),gap:Math.max(0,need-healing),risk:need>cfg.enemyRate*shares[i]/2&&healing<need};});
 const healing=mean(rows.map(r=>sum(r.heal))),required=mean(rows.map(r=>sum(r.need))),effective=mean(rows.map(r=>sum(r.covered)));
 const attack=Math.max(...actors.map(a=>a.attackIndex)),recovery=required?effective/required:1;
 const mitigation=weakenSources.size+drSources.size,defense=mean(actors.map((a,i)=>a.risk?Math.min(.5,a.shield/Math.max(1,cfg.enemyHits*shares[i])):1));
 return {profiles,cfg,rows,actors,unknown,complete:n===3,alliance:a,allianceEquipped:hasAlliance&&a.eligible,attack,healing,required,effective,recovery,mitigation,weakenCount:weakenSources.size,drCount:drSources.size,defense,controlChance:1-controlNone,
  score:40*Math.min(1,attack)+30*recovery+20*defense+8*Math.min(1,mitigation/2)+2*(1-controlNone),
  deficits:[...(attack<1?['攻撃']:[]),...(actors.some(a=>a.risk)?['耐久']:[]),...(recovery<1?['回復']:[]),...(mitigation<2?['軽減']:[])]};
}
function recommend(...args){if(!root.MobunagaLoadout)throw new Error('Load consultation/loadout.js before recommending a team');return root.MobunagaLoadout.recommend(...args);}
function replacementVariants(formations,index,overrides={},scenario={},season=4,anchors=[],excluded=[]){
 if(season<4||!index.tactics.has(RIKURYOKU))return [];
 const variants=[];
 for(const f of formations){if(C.season(f.season)!==season||!anchors.every(id=>f.members.some(m=>m.general_id===id))||f.members.some(m=>excluded.includes(m.general_id)))continue;
  const configs=f.members.map(m=>({...overrides[m.general_id],tactics:(m.tactics||[]).map(t=>index.tactics.has(t.tactic_id)?t.tactic_id:index.byName.get(t.tactic_name)?.length===1?index.byName.get(t.tactic_name)[0].id:'')}));
  if(configs.some(c=>c.tactics.includes(RIKURYOKU)))continue;
  const before=analyze(f.members.map((m,i)=>profile(index.generals.get(m.general_id),configs[i],index)),scenario,season);
  f.members.forEach((m,i)=>{for(let slot=0;slot<2;slot++){
   const next=configs.map(c=>({...c,tactics:[...c.tactics]})),removedId=next[i].tactics[slot],removed=index.tactics.get(removedId);
   next[i].tactics[slot]=RIKURYOKU;
   const assessment=analyze(f.members.map((x,j)=>profile(index.generals.get(x.general_id),next[j],index)),scenario,season);
   variants.push({formation:f,owner:m.general_id,slot,removed:removed?.name||m.tactics?.[slot]?.tactic_name||'空き枠',removedKnown:!!T[removedId],configs:next,before,assessment,delta:assessment.score-before.score,
    healingDelta:assessment.healing-before.healing,attackDelta:sum(assessment.actors.map(a=>a.physical+a.magic))-sum(before.actors.map(a=>a.physical+a.magic)),mitigationDelta:assessment.mitigation-before.mitigation,controlDelta:assessment.controlChance-before.controlChance});
  }});
 }
 return variants.sort((a,b)=>Number(b.removedKnown)-Number(a.removedKnown)||b.delta-a.delta);
}
root.MobunagaAdvisor={tacticModel:id=>T[id]||null,RIKURYOKU,replacementVariants,defaultScenario,baseStats,profile,analyze,recommend,probability,castTimeline,alliance};
})(typeof window!=="undefined"?window:globalThis);

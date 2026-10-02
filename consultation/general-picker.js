"use strict";
(function(root){
 const labels={heal:'回復持ち',status:'状態異常付与',multi:'複数攻撃',taunt:'挑発持ち',buff:'能力アップ',allyAttack:'仲間の攻撃力アップ'};
 const sorts={normal:'通常（掲載人気順）',武勇:'武勇順',知略:'知力（知略）順',統率:'統率順',速度:'速度順'};
 const normalize=s=>String(s||'').normalize('NFKC').replace(/\s/g,'').toLowerCase();
 function features(g){
  const t=normalize(g.unique_tactic?.effect),out=[];
  // These are search hints from the unique tactic only, not numeric battle evaluations.
  const clauses=t.split(/[。；;]/);
  if(/回復率|兵力[^。]{0,24}回復(?!不可)|回復効果|(?:離反|心攻|休養)[^。]{0,24}(?:獲得|付与)|(?:獲得|付与)[^。]{0,12}(?:離反|心攻|休養)/.test(t))out.push('heal');
  if(clauses.some(s=>/(?:敵|対象)/.test(s)&&/(?:麻痺|混乱|無策|封撃|威圧|疲弊|回復不可|火傷|水攻め|中毒|消沈|潰走|撹乱)[^。]{0,100}(?:付与|状態に)/.test(s)))out.push('status');
  if(clauses.some(s=>/敵軍?(?:全体|複数)|敵[^。]{0,8}[2３3２]名/.test(s)&&/ダメージ/.test(s))||/乱舞[^。]{0,60}(?:獲得|付与)/.test(t)||/獲得[^。]{0,20}乱舞/.test(t)||/ランダムな敵軍単体/.test(t)&&/(?:[2-9]回|複数回)/.test(t))out.push('multi');
  if(/挑発[^。]{0,70}付与/.test(t))out.push('taunt');
  if(clauses.some(s=>/(?:自身|自軍|友軍|味方)/.test(s)&&/(?:武勇|知略|統率|速度|全属性|能力)[^。]{0,50}(?:増加|上昇|向上)/.test(s)))out.push('buff');
  if(clauses.some(s=>/(?:自軍|友軍|味方)[^。]{0,100}(?:(?:与ダメージ|武勇|知略)[^。]{0,45}(?:増加|上昇|向上)|(?:会心|奇策|連撃|乱舞)[^。]{0,30}(?:獲得|付与))/.test(s)))out.push('allyAttack');
  return out;
 }
 function stat(g,key){const v=g.stats?.find(s=>s.attribute===key)?.level50;return v==null?null:Number(v);}
 function defaultFamily(gs,family){return gs.length>=2&&gs.every(g=>family(g)===family(gs[0]))?family(gs[0]):'';}
 function filter(gs,options,family){const q=normalize(options.query);return gs.filter(g=>(!options.family||family(g)===options.family)&&(!q||normalize(g.name+' '+g.kana+' '+g.unique_tactic?.name+' '+g.unique_tactic?.effect).includes(q))&&(options.features||[]).every(f=>features(g).includes(f))).sort((a,b)=>options.sort&&options.sort!=='normal'?(stat(b,options.sort)??-Infinity)-(stat(a,options.sort)??-Infinity)||a.name.localeCompare(b.name,'ja'):0);}
 root.MobunagaGeneralPicker={labels,sorts,features,stat,defaultFamily,filter};
})(typeof window==='undefined'?globalThis:window);

/* The supplied linear model is a hypothesis, not a verified game damage formula. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DamageMath = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function base(valor, defense, troops) {
    return 1.37 * (valor - defense) + 0.037 * troops + 175;
  }
  function activationDistribution(probability, turns, preparation = 0) {
    if (!Number.isFinite(probability) || probability < 0 || probability > 1 || !Number.isInteger(turns) || turns < 1 || turns > 50 || !Number.isInteger(preparation) || preparation < 0 || preparation > 5)
      throw new RangeError("発動率・ターン数・準備ターンを確認してください。");
    let states = new Map([["0,0", 1]]);
    for (let turn = 1; turn <= turns; turn++) {
      const next = new Map();
      const add = (remaining, completed, weight) => {
        if (!weight) return;
        const key = remaining + "," + completed;
        next.set(key, (next.get(key) || 0) + weight);
      };
      for (const [key, weight] of states) {
        const [remaining, completed] = key.split(",").map(Number);
        if (remaining) add(remaining - 1, completed + (remaining === 1 ? 1 : 0), weight);
        else {
          add(0, completed, weight * (1 - probability));
          add(preparation, completed + (preparation === 0 ? 1 : 0), weight * probability);
        }
      }
      states = next;
    }
    const distribution = Array(turns + 1).fill(0);
    for (const [key, weight] of states) distribution[Number(key.split(",")[1])] += weight;
    const mean = distribution.reduce((sum, weight, count) => sum + weight * count, 0);
    const quantile = (q) => {
      let cumulative = 0;
      for (let count = 0; count < distribution.length; count++) {
        cumulative += distribution[count];
        if (cumulative + 1e-12 >= q) return count;
      }
      return turns;
    };
    return { distribution, mean, lower: quantile(0.05), upper: quantile(0.95), zero: distribution[0], firstTurn: probability ? 1 / probability + preparation : Infinity };
  }
  function calculate(input) {
    const required = ["valor","defense","troops","valorBoost","defenseDrop","rate","probability","turns","preparation","hits"];
    if (required.some((key) => !Number.isFinite(input[key]))) return { valid:false, reason:"すべての欄に数値を入力してください。" };
    const {valor,defense,troops,valorBoost,defenseDrop,rate,probability,turns,preparation,hits} = input;
    if ([valor,defense,troops,defenseDrop,rate].some((v)=>v<0) || valor+valorBoost<0 || probability<0 || probability>100 || !Number.isInteger(turns) || turns<1 || turns>50 || !Number.isInteger(preparation) || preparation<0 || preparation>5 || !Number.isInteger(hits) || hits<1 || hits>10)
      return { valid:false, reason:"入力範囲を確認してください。ターンは1〜50、発動率は0〜100%、兵刃回数は1〜10です。" };
    const before = base(valor,defense,troops);
    const after = base(valor+valorBoost,defense-defenseDrop,troops);
    if (defense-defenseDrop<0) return { valid:false,before,after,reason:"補正後の統率が負になります。ゲーム内の統率下限が未確認のため、この条件は評価しません。" };
    if (before<=0 || after<=0) return { valid:false,before,after,reason:"基礎式の値が0以下です。式の適用範囲・最低ダメージ処理が未確認のため、ダメージは算出範囲外です。" };
    const activations = activationDistribution(probability/100,turns,preparation);
    const perActivation = ((after*rate)/100)*hits;
    if (![before,after,perActivation,perActivation*turns,((before*rate)/100)*hits*turns,after/before].every(Number.isFinite)) return { valid:false,reason:"数値が大きすぎるため計算できません。入力値を確認してください。" };
    return { valid:true,before,after,increase:after-before,increasePercent:(after/before-1)*100,perActivation,expected:perActivation*activations.mean,expectedBefore:((before*rate)/100)*hits*activations.mean,perTurn:(perActivation*activations.mean)/turns,lower:perActivation*activations.lower,upper:perActivation*activations.upper,activations };
  }
  function preset(tactic) {
    const activation = String(tactic.activation_rate || "");
    const level10 = activation.match(/([\d.]+)\s*%?\s*\(Lv10\)/i);
    const fixed = activation.match(/^\s*([\d.]+)\s*%?\s*$/);
    const probability = level10 || fixed ? Number((level10 || fixed)[1]) : null;
    const effect = String(tactic.effect || "");
    const matches = [...effect.matchAll(/兵刃ダメージ[（(](?:ダメージ率)?([\d.]+)%[→～]([\d.]+)%/g),...effect.matchAll(/([\d.]+)%[→～]([\d.]+)%の兵刃ダメージ/g)].sort((a,b)=>a.index-b.index);
    const rate = matches.length ? Number(matches[0][2]) : null;
    const prep = effect.match(/([1-5])ターンの準備/);
    const preparation = prep ? Number(prep[1]) : 0;
    const complex = /ランダム|\d[～〜~]\d回|[2-9]回|毎ターン|持続|火傷|中毒|逃亡|追加|確率で|場合|対象が|会心|発動するたび/.test(effect);
    const eligible = ["能動","突撃"].includes(tactic.category) && matches.length===1 && probability!==null && probability>=0 && probability<=100 && !complex && (!effect.includes("準備") || !!prep);
    return { rate, probability, preparation, eligible, scope:"Lv10・最初の兵刃1撃・対象1体。計略・追加効果は含まない" };
  }
  return { base,activationDistribution,calculate,preset };
});

if (typeof document !== "undefined") {
  const GA_ID = "G-C7QV2JBGPY";
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID);
  if (!document.querySelector('script[data-mobunaga-ga4]')) {
    const ga = document.createElement("script");
    ga.async = true;
    ga.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
    ga.dataset.mobunagaGa4 = "1";
    document.head.appendChild(ga);
  }

  const version = document.documentElement.dataset.dataVersion || "1";
  const addStyle = (href, marker) => {
    if (document.querySelector(`link[data-${marker}]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${href}?v=${encodeURIComponent(version)}`;
    link.dataset[marker] = "1";
    document.head.appendChild(link);
  };
  const addScript = (src, marker, onload) => {
    if (document.querySelector(`script[data-${marker}]`)) return;
    const script = document.createElement("script");
    script.src = `${src}?v=${encodeURIComponent(version)}`;
    script.async = false;
    script.dataset[marker] = "1";
    if (onload) script.addEventListener("load", onload);
    document.head.appendChild(script);
  };
  addStyle("assets/tactics-overview.css", "tacticsOverview");
  addScript("assets/tactics-overview.js", "tacticsOverview", () => {
    try { if (typeof render === "function" && typeof db !== "undefined" && db) render(); } catch (_) {}
  });
  addStyle("assets/formation-community.css", "formationCommunity");
  addScript("assets/formation-community.js", "formationCommunity");
  if (document.querySelector("#results")) {
    addStyle("assets/season-context.css", "seasonContext");
    addScript("assets/season-context.js", "seasonContext");
  }
  const addHelpLink = () => {
    const nav = document.querySelector(".navigation");
    if (!nav || nav.querySelector('[href="help/"]')) return;
    const link = document.createElement("a");
    link.className = "nav-item research-nav-link";
    link.href = "help/";
    link.innerHTML = '<span class="nav-seal" aria-hidden="true">？</span><span>使い方<small>資料館への登録方法も確認</small></span><b aria-hidden="true">›</b>';
    nav.appendChild(link);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addHelpLink); else addHelpLink();
}
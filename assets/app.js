"use strict";
const $ = (selector) => document.querySelector(selector);
const DATA_VERSION = document.documentElement.dataset.dataVersion || "1";
const versioned = (path) =>
  path + (path.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(DATA_VERSION);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const normalized = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const number = (value) => (value == null ? "—" : Number(value).toFixed(1));
const statAttribute = (row) => row?.attribute ?? row?.stat;
const stat = (g, name) =>
  g.stats.find((row) => statAttribute(row) === name)?.level50;
// Clockwise from the top, matching the in-game ability display.
const GAME_STAT_ORDER = ["知略", "武勇", "魅力", "政務", "速度", "統率"];
const tierScore = (value) =>
  /god/i.test(value)
    ? -1
    : Number(String(value || "Tier99").replace(/[^\d.]/g, ""));
const titles = {
  formations: "編成指南",
  generals: "武将録",
  tactics: "戦法録",
};
const descriptions = {
  formations:
    "三将の組み合わせから、戦法・兵学まで。<br>自軍に合う一手を、ここから探す。",
  generals:
    "名将たちの能力と、秘めたる特性を知る。<br>一人ひとりの力を、編成へつなげる。",
  tactics:
    "戦の流れを変える、一手を見極める。<br>戦法の効果と伝授元を、手元の資料に。",
};
const filterIds = [
  "query",
  "season",
  "faction",
  "troop",
  "danger",
  "rarity",
  "sort",
  "category",
  "rank",
  "tactic-sort",
];
const PAGE_SIZE = 24;
let db,
  kind = "formations",
  page = 1,
  filtered = [],
  detailStack = [],
  formationError = false;
let generalMap = new Map(),
  tacticMap = new Map(),
  detailImages = {};
let comparison = new Map();
let formationAnalysisMap = new Map(),
  goodJobFormations = [];
const formationLimitBreaks = new Map();
const damageNumber = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 1,
});

function compareTactics() {
  comparison = new Map();
  const values = { valor: 337, troops: 10000, defense: 500, turns: 8 };
  const valid = true;
  let reason = valid ? "" : "比較条件を入力範囲内の数値にしてください。";
  for (const t of db.tactics) {
    const preset = DamageMath.preset(t);
    const result =
      valid && preset.eligible
        ? DamageMath.calculate({
            ...values,
            valorBoost: 0,
            defenseDrop: 0,
            hits: 1,
            ...preset,
          })
        : null;
    if (result && !result.valid) reason = result.reason;
    comparison.set(t.id, { preset, result: result?.valid ? result : null });
  }
  const count = [...comparison.values()].filter((row) => row.result).length;
  $("#comparison-note").textContent =
    reason ||
    `試算可能 ${count} / ${db.tactics.length}件。Lv10・対象1体・最初の兵刃1撃を比較。計略・追加効果は含みません。未収録・複雑な条件の戦法は未試算です。`;
}

function sourceLink(url, label) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return esc(label);
    return `<a href="${esc(u.href)}" target="_blank" rel="noopener">${esc(label)} ↗</a>`;
  } catch {
    return esc(label);
  }
}
function badge(label, extra = "") {
  return `<span class="badge ${extra}">${esc(label)}</span>`;
}
function portrait(g, className = "portrait") {
  return g?.portrait &&
    /^assets\/portraits\/[a-z0-9_-]+\.webp$/.test(g.portrait)
    ? `<img class="${className}" src="${esc(versioned(g.portrait))}" alt="" loading="lazy">`
    : '<span class="portrait-fallback" aria-hidden="true">将</span>';
}
function troopLabel(value) {
  return value ? value.split(",").join("・") : "兵種未指定";
}
function setOptions(id, values, placeholder) {
  const node = $("#" + id),
    selected = node.value;
  node.replaceChildren(
    new Option(placeholder, ""),
    ...values.map((value) => new Option(value, value)),
  );
  if (values.includes(selected)) node.value = selected;
}
function formationCard(f) {
  const leader = f.members[0].general_name;
  const analysis = formationAnalysisMap.get(f.id);
  const danger = analysis?.base_danger_deviation;
  const required = new Map((analysis?.required_limit_breaks || []).map((row) => [row.general_id, row.required_limit_break]));
  return `<button class="card formation-card" data-open="formations" data-id="${esc(f.id)}" aria-label="S${esc(f.season)} ${esc(f.name)}の編成詳細"><div class="card-top">${badge("S" + f.season)}${f.tier ? badge(f.tier + (f.tier_provisional ? "（暫定）" : "")) : ""}${danger == null ? "" : badge("要注意度 " + danger, "danger-badge")}<span class="card-id">編成 ${esc(f.id.toUpperCase())}</span></div><div class="formation-portraits">${f.members.map((m) => `<div class="soldier"><div class="soldier-image">${portrait(generalMap.get(m.general_id), "")}<span class="soldier-role">${esc(m.role)}</span></div><span class="soldier-name">${esc(m.general_name)}</span>${required.get(m.general_id) == null ? "" : `<span class="red-limit-break" title="成立に必要な凸数">${"◆".repeat(required.get(m.general_id))}</span>`}</div>`).join("")}</div><h3 class="formation-title">${esc(f.variant_label || leader + "隊")}</h3><div class="formation-meta"><span>${esc(f.faction)}</span><span>／</span><span>${esc(troopLabel(f.troops))}</span></div><div class="formation-loadout">${f.members.map((m, i) => `<div><span>${i === 0 ? "主将" : "副将" + i}</span><b>${esc(m.tactics.map((t) => t.tactic_name).join("・"))}</b></div>`).join("")}</div><div class="card-bottom"><span>${esc(f.requirement || (Number(f.season) > 1 ? "戦法・兵学・能力振り" : "戦法・能力振り"))}</span><span>凸と対策を見る ›</span></div></button>`;
}

function totalStats(g, attributes = GAME_STAT_ORDER) {
  const values = attributes.map((name) => stat(g, name));
  if (values.some((value) => value == null || value === "" || !Number.isFinite(Number(value)))) return null;
  return Math.round(values.reduce((sum, value) => sum + Number(value), 0) * 10) / 10;
}
function combatStats(g) {
  return totalStats(g, ["武勇", "知略", "統率", "速度"]);
}
function totalStatsHTML(g) {
  return `<span class="stat-total" title="Lv50：戦闘属性は武勇・知略・統率・速度、総合値は政務・魅力を含む6能力の合計"><span>戦闘属性</span><strong>${number(combatStats(g))}</strong><span class="stat-total-slash">/</span><small class="stat-total-overall"><span>総合</span> ${number(totalStats(g))}</small></span>`;
}
function costHTML(g) {
  const cost = Number(g.cost);
  const emphasis = cost === 7 ? "cost-high" : cost === 6 ? "cost-next" : cost === 3 || cost === 4 ? "cost-low" : "cost-normal";
  return `<span class="cost-badge ${emphasis}"><span>COST</span><strong>${esc(g.cost ?? "—")}</strong></span>`;
}

function generalCard(g) {
  return `<button class="card general-card" data-open="generals" data-id="${esc(g.id)}" aria-label="${esc(g.name)}の詳細"><div class="card-head">${portrait(g)}<div><span class="stars">${"★".repeat(Math.min(g.rarity || 0, 5))}</span><h3>${esc(g.name)}</h3><span class="meta">${esc(g.faction)} ／ ${costHTML(g)}</span></div>${badge(g.current_tier || "未評価", "tier-badge")}</div><div class="stats-heading">${totalStatsHTML(g)}</div><div class="stats">${["武勇", "知略", "統率", "速度"].map((name) => `<span>${name}<b>${number(stat(g, name))}</b></span>`).join("")}</div><p class="skill-line">固有戦法　${esc(g.unique_tactic?.name || "未収録")}</p></button>`;
}
function tacticCard(t) {
  const entry = comparison.get(t.id);
  const result = entry?.result;
  const estimate = result
    ? `<div class="tactic-estimate">兵刃1撃の累計期待値 <b>${damageNumber.format(result.expected)}</b><small>1ターン平均 ${damageNumber.format(result.perTurn)} ／ 8ターン</small></div>`
    : `<div class="tactic-estimate">未試算<small>${entry?.preset.probability === null ? "発動率が未収録" : entry?.preset.rate === null ? "兵刃倍率が未収録・対象外" : "比較条件・複合効果を詳細で確認"}</small></div>`;
  return `<button class="card tactic-card" data-open="tactics" data-id="${esc(t.id)}" aria-label="${esc(t.name)}の詳細">${badge(t.rank + " 戦法")} ${badge(t.category)}<h3>${esc(t.name)}</h3><p class="effect">${esc(t.effect || "元資料に効果の記載がありません。")}</p><span class="meta">発動率 ${esc(t.activation_rate || "—")}</span>${estimate}</button>`;
}
function searchText(row) {
  if (kind === "formations")
    return [
      row.name,
      row.faction,
      row.troops,
      formationAnalysisMap.get(row.id)?.base_danger_deviation,
      ...row.members.flatMap((m) => [
        m.general_name,
        generalMap.get(m.general_id)?.kana,
        m.main_school,
        m.sub_school,
        m.attribute_plan,
        ...m.tactics.map((t) => t.tactic_name),
      ]),
    ].join(" ");
  if (kind === "generals")
    return [row.name, row.kana, row.unique_tactic?.name].join(" ");
  return [row.name, row.effect, row.category].join(" ");
}
function render() {
  if (!db) return;
  const keywords = normalized($("#query").value)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  filtered = db[kind].filter((row) =>
    keywords.every((word) => normalized(searchText(row)).includes(word)),
  );
  if (kind === "formations") {
    filtered = filtered.filter(
      (f) =>
        (!$("#season").value || String(f.season) === $("#season").value) &&
        (!$("#faction").value || f.faction === $("#faction").value) &&
        (!$("#danger").value || (formationAnalysisMap.get(f.id)?.base_danger_deviation ?? 0) >= Number($("#danger").value)) &&
        (!$("#troop").value ||
          ($("#troop").value === "unspecified"
            ? !f.troops
            : f.troops.split(",").includes($("#troop").value))),
    );
    filtered.sort(
      (a, b) =>
        b.season - a.season ||
        (formationAnalysisMap.get(b.id)?.base_danger_deviation ?? 0) - (formationAnalysisMap.get(a.id)?.base_danger_deviation ?? 0) ||
        (a.source_index ?? 0) - (b.source_index ?? 0) || a.id.localeCompare(b.id),
    );
  } else if (kind === "generals") {
    filtered = filtered.filter(
      (g) =>
        (!$("#faction").value || g.faction === $("#faction").value) &&
        (!$("#rarity").value || String(g.rarity) === $("#rarity").value),
    );
    const order = $("#sort").value;
    filtered.sort((a, b) =>
      order === "kana"
        ? (a.kana || a.name).localeCompare(b.kana || b.name, "ja")
        : order === "tier"
          ? tierScore(a.current_tier) - tierScore(b.current_tier)
          : order === "combat"
            ? (combatStats(b) ?? -Infinity) - (combatStats(a) ?? -Infinity)
            : order === "total"
            ? (totalStats(b) ?? -Infinity) - (totalStats(a) ?? -Infinity)
            : (stat(b, order) ?? -Infinity) - (stat(a, order) ?? -Infinity),
    );
  } else {
    compareTactics();
    filtered = filtered.filter(
      (t) =>
        (!$("#category").value || t.category === $("#category").value) &&
        (!$("#rank").value || t.rank === $("#rank").value),
    );
    const order = $("#tactic-sort").value;
    const score = (t) =>
      order === "expected"
        ? comparison.get(t.id)?.result?.expected
        : comparison.get(t.id)?.preset.probability;
    filtered.sort((a, b) => {
      if (order) {
        const av = score(a),
          bv = score(b);
        if (av == null && bv != null) return 1;
        if (av != null && bv == null) return -1;
        if (av != null && bv != null && av !== bv) return bv - av;
      }
      return a.name.localeCompare(b.name, "ja");
    });
  }
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  page = Math.min(page, pages);
  $("#result-count").textContent = filtered.length;
  $("#result-unit").textContent =
    kind === "formations" ? " 編成" : kind === "generals" ? " 名" : " 件";
  $("#page-range").textContent = filtered.length
    ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)}件を表示`
    : "";
  $("#page-indicator").textContent = `${page} / ${pages}`;
  $("#previous-page").disabled = page <= 1;
  $("#next-page").disabled = page >= pages;
  $(".pagination").hidden = filtered.length <= PAGE_SIZE;
  const card =
    kind === "formations"
      ? formationCard
      : kind === "generals"
        ? generalCard
        : tacticCard;
  $("#results").innerHTML =
    formationError && kind === "formations"
      ? '<div class="status error-status">編成資料を読み込めませんでした。<button data-reload>再読み込み</button></div>'
      : filtered.length
        ? filtered
            .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
            .map(card)
            .join("")
        : '<div class="status">該当する資料がありません。<br>検索語や絞り込み条件を変更してください。</div>';
}
function changeKind(next, preserve = false) {
  if (!titles[next]) next = "formations";
  kind = next;
  page = 1;
  if (!preserve)
    filterIds.forEach(
      (id) => ($("#" + id).value = id === "sort" ? "kana" : ""),
    );
  document.querySelectorAll("[data-kind]").forEach((node) => {
    if (node.dataset.kind === kind) node.setAttribute("aria-current", "page");
    else node.removeAttribute("aria-current");
  });
  document.querySelectorAll("[data-scopes]").forEach((node) => {
    node.hidden = !node.dataset.scopes.split(" ").includes(kind);
  });
  $("#page-title").textContent = titles[kind];
  $("#breadcrumb-current").textContent = titles[kind];
  $("#page-description").innerHTML = descriptions[kind];
  $("#catalog-title").textContent = {
    formations: "編成目録",
    generals: "武将目録",
    tactics: "戦法目録",
  }[kind];
  $("#catalog-subtitle").textContent = {
    formations: "シーズン・兵種・要注意度から絞り込む",
    generals: "武将の能力と特性を調べる",
    tactics: "戦法の効果と伝授元を調べる",
  }[kind];
  $("#stat-note").textContent =
    kind === "generals"
      ? "能力値はLv50の基礎値"
      : kind === "formations"
        ? "要注意度は取得元評価を初期変換した編集値です"
        : "効果未掲載の戦法は、推測で補完していません";
  $("#query").placeholder = {
    formations: "例：黒田 ねね ／ 七十二の計",
    generals: "武将名・読み・固有戦法で検索",
    tactics: "戦法名・効果で検索",
  }[kind];
  $("#query-label").textContent =
    kind === "tactics" ? "戦法を検索" : "武将・戦法を検索";
  $("#latest-season").hidden = kind !== "formations";
  $("#browse-generals").hidden = kind === "generals";
  if (db) {
    setOptions(
      "faction",
      [
        ...new Set(
          (kind === "formations" ? db.formations : db.generals)
            .map((g) => g.faction)
            .filter(Boolean),
        ),
      ].sort(),
      "すべての勢力",
    );
    render();
  }
  if (location.hash !== "#" + kind) history.replaceState(null, "", "#" + kind);
  document.title = titles[kind] + "｜モブナガの軍議戦略サイト";
}
function section(title, body) {
  return `<section class="detail-section"><h3>${esc(title)}</h3>${body}</section>`;
}
function reference(type, id, label, className = "") {
  if (!id || !(type === "generals" ? generalMap : tacticMap).has(id))
    return esc(label);
  return `<button type="button" class="reference-link ${className}" data-open="${type}" data-id="${esc(id)}">${esc(label)}</button>`;
}
function sourceHTML(source, formation) {
  if (!source) return "";
  const when = source.fetched_at
    ? new Date(source.fetched_at).toLocaleDateString("ja-JP")
    : "";
  return `<div class="source"><p>出典：${sourceLink(source.source_url, source.title?.split("｜")[0] || "取得元を見る")}</p><p>取得日：${esc(when)}${formation?.source_index ? " ／ 元記事の編成表 " + esc(formation.source_index) + " 番目" : ""}</p>${formation ? "<p>Tierに「暫定」とあるものはモブナガの編集評価、それ以外は攻略記事の掲載時点の評価です。編成の条件・代替案・詳しい解説は出典をご確認ください。兵種の明記がない編成は「未指定」としています。</p>" : ""}</div>`;
}
function mobunagaTips(body) {
  if (!body) return "";
  return `<aside class="detail-section mobunaga-tips" aria-label="モブナガ TIPS"><header class="mobunaga-tips-heading"><span class="mobunaga-tips-avatar"><img src="${esc(versioned("assets/mobunaga.png"))}" alt="" loading="lazy"></span><div><h3>モブナガ TIPS</h3><small>独自の考察・試算</small></div></header><div class="mobunaga-tips-body">${body}</div></aside>`;
}

function tipsMeter(label, parts, max, note = "") {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return `<div class="tips-meter-row"><div class="tips-meter-label"><strong>${esc(label)}</strong><span>${esc(note)}</span></div><div class="tips-meter-track" role="img" aria-label="${esc(label + '：' + parts.map(p => p.label + ' ' + p.value).join('、'))}">${parts.map(p => `<span class="tips-meter-fill tips-meter-${p.tone}" style="width:${Math.max(0, Math.min(100, p.value / max * 100))}%"></span>`).join("")}</div><div class="tips-meter-values">${parts.map(p => `<span><i class="tips-key tips-meter-${p.tone}"></i>${esc(p.label)} <b>${Number(p.value).toFixed(2).replace(/\\.?0+$/, "")}</b></span>`).join("")}<strong>計 ${Number(total.toFixed(2))}</strong></div></div>`;
}
function generalTipsVisual(g) {
  const figure = (title, caption, body) => `<figure class="tips-figure"><figcaption><strong>${esc(title)}</strong><p>${esc(caption)}</p></figcaption>${body}</figure>`;
  if (g.id === "uragamimunekage") {
    const base = Number(stat(g, "武勇"));
    const intellect = Number(stat(g, "知略"));
    if (!Number.isFinite(base) || !Number.isFinite(intellect)) return "";
    const chart = (commander) => {
      const decay = commander ? .8 : .75;
      const turns = commander ? 5 : 4;
      return Array.from({length:6}, (_, i) => {
        const bonus = i < turns ? 60 * decay ** i : 0;
        return tipsMeter(`${i + 1}T`, [{label:"基礎武勇",value:base,tone:"base"},{label:"上乗せ",value:bonus,tone:"boost"}], base + 60,
          `知略 ${(intellect + bonus).toFixed(2)}${i === 4 ? " ／ 友軍へ混乱" : ""}`);
      }).join("");
    };
    return figure("武勇・知略の上乗せ残量", "Lv50・初回の上乗せを+60と仮定した計算例。青は基礎武勇、緑は上乗せ。知略にも同じ量を加算します。実際の初回上昇量は知略などの条件で変わります。",
      `<div class="tips-chart-grid"><section><h4>通常時：毎ターン25％減</h4>${chart(false)}</section><section><h4>大将時：毎ターン20％減</h4>${chart(true)}</section></div>`) +
      figure("実測した上乗せと、その後の目安", "1T・2Tは実測。3T・4Tは初回値から計算した目安です。武勇・知略共通。",
        [55.46,41.59,55.46*.75**2,55.46*.75**3].map((value,i)=>tipsMeter(`${i+1}T`,[{label:"上乗せ",value,tone:"boost"}],55.46,i<2?"実測":"計算")).join("")) +
      figure("通常攻撃後の追加計略", "Lv10のダメージ率。属性上昇の終了後も、この追加効果は継続します。実ダメージは兵力・知略・敵の防御などで変わります。",
        tipsMeter("通常攻撃後",[{label:"計略ダメージ率（％）",value:106,tone:"strategy"}],106));
  }
  if (g.id === "datemasamune") {
    const base = Number(stat(g,"武勇")), intellect = Number(stat(g,"知略"));
    if (!Number.isFinite(base) || !Number.isFinite(intellect)) return "";
    return figure("独眼竜：武勇と知略のバランスが重要", "差が小さいほど与ダメージ上昇が大きくなり、差が20％を超えると無効。以下は上限値で、現在の能力値での上昇率ではありません。",
      tipsMeter("通常時の上限",[{label:"与ダメージ上昇（％）",value:10,tone:"boost"}],15) +
      tipsMeter("大将時の上限",[{label:"与ダメージ上昇（％）",value:15,tone:"boost"}],15) +
      '<p class="tips-flow">武勇 ≒ 知略：独眼竜の効果を高く保つ<br>知略 ＞ 武勇：竜騎兵を計略側へ<br>差を広げすぎる：独眼竜の効果が低下</p>') +
      figure("「粋」の残量：初期5 → 毎ターン1消費", "補充がない場合の例。各ターンの行動後の残量です。毎回の消費で兵刃・計略の両方を放ちます。",
      Array.from({length:6},(_,i)=>`<div class="tips-stock-row"><strong>${i+1}T</strong><span class="tips-stock" role="img" aria-label="残り${Math.max(0,4-i)}粋">${Array.from({length:5},(_,j)=>`<i class="${j<4-i?'is-full':''}"></i>`).join("")}</span><b>${Math.max(0,4-i)} / 5</b><small>${i<5?"1消費 → 兵刃＋計略":"補充がなければ停止"}</small></div>`).join("") +
      '<p class="tips-flow">兵刃2回 ＋ 計略2回 → 能力上昇1段階<br>4段階到達後、同条件を満たすと「粋」を1補充</p>') +
      figure("武勇・知略：条件達成ごとに上昇", "Lv50の基礎値に5％ずつ加算した計算例。横軸はターン数ではなく、強化の段階です。他の強化効果は含みません。",
        Array.from({length:5},(_,i)=>tipsMeter(`${i}段階（+${i*5}％）`,[{label:"基礎武勇",value:base,tone:"base"},{label:"上乗せ",value:base*.05*i,tone:"boost"}],base*1.2,`知略 ${(intellect*(1+.05*i)).toFixed(2)}`)).join("")) +
      figure("「粋」1消費のダメージ率", "兵刃と計略は別々に計算されます。棒はダメージ率の内訳で、実ダメージの合計ではありません。",
        tipsMeter("Lv1",[{label:"兵刃（％）",value:46,tone:"base"},{label:"計略（％）",value:46,tone:"strategy"}],184) +
        tipsMeter("Lv10",[{label:"兵刃（％）",value:92,tone:"base"},{label:"計略（％）",value:92,tone:"strategy"}],184) +
        '<p>大将時：4段階到達後の次の粋消費で、さらに兵刃134％・計略134％。</p>' +
        tipsMeter("大将の追加分",[{label:"追加兵刃（％）",value:134,tone:"base"},{label:"追加計略（％）",value:134,tone:"strategy"}],268) + '<p><strong>開幕から5ターン、兵刃と計略の二段攻撃を毎ターン！</strong></p><p>イメージは、一撃を控えめにした「乱世の華」を毎ターン放つような連続攻撃。初期の「粋」5つで発動抽選に頼らず攻め続け、武勇・知略の強化も狙えます。安定した手数が政宗の強みです！</p><p>さらに大将なら、強化が4段階に達した後の次の粋消費で、追加の二段攻撃も。粋の補充まで回れば、序盤の勢いを長期戦へつなげられます。</p>');
  }
  return "";
}

function tipsParagraphs(text) {
  return String(text || "").split(/\n\n+/).filter(Boolean).map((paragraph) => {
    const heading = paragraph.match(/^【([^】]+)】([\s\S]*)$/);
    return heading ? `<h4>${esc(heading[1])}</h4><p>${esc(heading[2])}</p>` : `<p>${esc(paragraph)}</p>`;
  }).join("");
}
function splitEditorialEffect(effect) {
  const text = String(effect || "");
  const index = text.search(/【(?:伊達政宗との相性|Lv50の見方|実数イメージ)】/);
  return index < 0 ? { effect: text, tips: "" } : { effect: text.slice(0, index), tips: text.slice(index) };
}

function formationDetail(f) {
  const analysis = formationAnalysisMap.get(f.id);
  const limitBreak = formationLimitBreaks.get(f.id) ?? 0;
  const score = analysis?.score_by_limit_break?.find((row) => row.limit_break === limitBreak) || { danger_deviation: 50, meta_grade: "—" };
  const required = new Map((analysis?.required_limit_breaks || []).map((row) => [row.general_id, row.required_limit_break]));
  let html = `<div class="detail-head"><div><p>編成指南 ／ ${esc(f.id.toUpperCase())}</p><h2 id="detail-title">${esc(f.variant_label || f.members[0].general_name + "隊")}</h2><p>${esc(f.name)}</p><div class="detail-meta">${badge("S" + f.season)}${f.tier ? badge(f.tier + (f.tier_provisional ? "（暫定）" : "")) : ""}${analysis ? badge("要注意度偏差値 " + score.danger_deviation, "danger-badge") : ""}${badge(f.faction)}${badge(troopLabel(f.troops))}${f.requirement ? badge(f.requirement) : ""}</div></div></div>`;
  if (analysis) html += `<section class="limit-break-panel"><div><strong>相手の凸数</strong><p>凸が増えるほど要注意度が上がり、こちらのメタ有効度は下がります。</p></div><div class="limit-break-buttons" role="group" aria-label="相手の凸数">${[0,1,2,3,4,5].map((value) => `<button type="button" data-limit-break="${value}" data-formation-id="${esc(f.id)}" aria-pressed="${value === limitBreak}">${value}凸</button>`).join("")}</div><div class="danger-result"><span>要注意度偏差値</span><b>${score.danger_deviation}</b><span>メタ有効度</span><b>${esc(score.meta_grade)}</b></div></section>`;

  html += `<div class="member-details">${f.members.map((m) => `<article class="member-detail"><div class="member-detail-heading">${portrait(generalMap.get(m.general_id))}<div><small>${esc(m.role)}</small><h3>${reference("generals", m.general_id, m.general_name)}</h3></div></div><dl><dt>伝授戦法</dt><dd>${m.tactics.map((t) => `<div class="tactic-link">${reference("tactics", t.tactic_id, t.tactic_name)}</div>`).join("")}</dd><dt>能力振り</dt><dd>${esc(m.attribute_plan || "記載なし")}</dd><dt>主兵学</dt><dd>${esc(m.main_school || "記載なし")}</dd><dt>副兵学</dt><dd>${esc(m.sub_school || "記載なし")}</dd>${m.equipment ? `<dt>装備</dt><dd>${esc(m.equipment)}</dd>` : ""}</dl></article>`).join("")}</div>`;
  html += f.members.map((m) => required.get(m.general_id) == null ? "" : `<p class="red-limit-break-note">${esc(m.general_name)}：必須 ${required.get(m.general_id)}凸 ${"◆".repeat(required.get(m.general_id))}</p>`).join("");
  if (f.members.some((m) => m.tactics.some((t) => !t.tactic_id)))
    html +=
      '<p class="notice">一部の戦法名は取得元の表記を保持しています。戦法録との対応が確定していないものにはリンクを付けていません。</p>';
  if (f.template_notes) html += section("掲載条件・代替案", `<p style="white-space:pre-line">${esc(f.template_notes)}</p>`);
  if (f.editorial) html += `<p class="notice">${esc(f.requirement)}。戦法名は日本版の戦法録に対応付けています。</p>`;
  return html + sourceHTML(f.source, f) + (f.editorial ? mobunagaTips(`<h4>このテンプレートの紹介</h4><p>${esc(f.editorial.summary)}</p><h4>条件・注意点</h4><p>${esc(f.editorial.warning)}</p><h4>Tierの根拠（モブナガ暫定評価）</h4><p>${esc(f.tier_basis)}</p>`) : "") + (analysis ? mobunagaTips(`<h4>このテンプレートの紹介</h4><p>${esc(analysis.summary)}</p><h4>主な動き</h4><p>${esc(analysis.movement)}</p><h4>要注意ポイント</h4><p>${esc(analysis.warning)}</p><h4>メタ内容</h4><p>${esc(analysis.meta)}</p>`) : "");
}
function relatedFormations(id, type) {
  const rows = db.formations.filter((f) =>
    f.members.some((m) =>
      type === "generals"
        ? m.general_id === id
        : m.tactics.some((t) => t.tactic_id === id),
    ),
  );
  if (!rows.length) return "";
  return section(
    "採用されている編成（" + rows.length + "件）",
    `<div class="relation-list">${rows
      .slice(0, 12)
      .map(
        (f) =>
          `<button data-open="formations" data-id="${esc(f.id)}">S${esc(f.season)}・${esc(f.members[0].general_name)}隊 / ${esc(f.id)}</button>`,
      )
      .join(
        "",
      )}</div>${rows.length > 12 ? '<p class="notice">一部を表示しています。編成指南で武将名・戦法名から検索できます。</p>' : ""}`,
  );
}
function generalCouncilFeature(g) {
  if (g.id !== "ookubonagayasu" || (window.MobunagaSeason?.current?.() || 1) < 4) return "";
  const members = [
    ["oyamadanobushige", "小山田信茂"], ["endounaotsune", "遠藤直経"],
    ["fukudomechikamasa", "福留親政"], ["shimotakasadakiyo", "下方貞清"],
    ["ookubonagayasu", "大久保長安"],
  ];
  const membersHTML = members.map(([id, name]) => `<div class="council-member"><img src="${esc(versioned(`assets/portraits/${id}.webp`))}" alt="${esc(name)}" width="70" height="86" loading="lazy">${reference("generals", id, name)}</div>`).join("");
  const screenshot = esc(versioned("assets/guides/ookubonagayasu-council.png"));
  return section("特集｜天下の総代官・利点の発動条件", `<div class="council-feature">
    <p class="council-label">S4 ／ 運営回答・ゲーム画面で確認</p>
    <p><strong>評定所で4種類の拡張技能を揃え、大久保長安も同時に任命すると利点効果を得られます。</strong></p>
    <h4>運営が案内した任命例</h4>
    <div class="council-members">${membersHTML}</div>
    <p>上記5人を同時に任命する例です。条件は「木材・鉄鉱・石材・兵糧拡張」の4技能と大久保長安の同時任命。各武将と技能の個別対応は、今回の回答では示されていません。</p>
    <h4>ゲーム画面の技能説明</h4>
    <dl class="definition"><dt>技能名</dt><dd>天下の総代官（S）</dd><dt>種類・対象</dt><dd>産業 ／ 自身</dd><dt>利点</dt><dd>木産・鉄産・石産・農産拡張を同時に配備している時、自身の資源調達の割合が7.5%→9.4%上昇（政務依存・画像の表示値）。</dd><dt>欠点</dt><dd>4種類を同時に配備していない時、自身の資源調達の割合が10%低下。</dd></dl>
    <div class="council-effects" aria-label="画像に表示された利点と欠点"><div><b>条件成立：＋7.5%→9.4%（政務依存）</b><div class="council-track"><span class="council-positive"></span></div></div><div><b>条件未成立：−10%</b><div class="council-track"><span class="council-negative"></span></div></div><small>棒は表示値の大きさを比較。利点の棒は表示上限9.4%。全武将・全条件で一律9.4%という意味ではありません。</small></div>
    <figure class="council-screenshot"><a href="${screenshot}" target="_blank" rel="noopener"><img src="${screenshot}" alt="天下の総代官の技能概要。4種類の拡張を同時配備すると利点、未成立時は10%低下。" width="1855" height="1002" loading="lazy"></a><figcaption>ゲーム内の技能概要。画像を押すと原寸表示。</figcaption></figure>
    <details><summary>運営回答の原文・出典</summary><blockquote>領主様、こんにちは！大久保長安の評定衆技能につきまして、評定所に「木材・鉄鉱・石材・兵糧拡張」の4つの評定衆技能を持つ武将と、大久保長安を同時に任命することで、利点効果を得られます。例えば、「小山田信茂」「遠藤直経」「福留親政」「下方貞清」と「大久保長安」を同時に任命すること。</blockquote><p>2026年9月28日掲載。運営回答の共有文とゲーム内画像を参照。回答では「木材・鉄鉱・石材・兵糧拡張」、ゲーム画像では「木産・鉄産・石産・農産拡張」と表記されています。</p></details>
  </div>`);
}
function generalDetail(g) {
  const detailImage = detailImages[g.id];
  const hasDetail =
    typeof detailImage === "string" &&
    /^assets\/details\/[a-z0-9_-]+\.webp$/.test(detailImage);
  const image = hasDetail
    ? `<a href="${esc(versioned(detailImage))}" target="_blank" rel="noopener" aria-label="${esc(g.name)}のカード画像を開く"><img class="general-full-image" src="${esc(versioned(detailImage))}" alt="${esc(g.name)}の武将カード"></a>`
    : portrait(g, "general-full-image");
  const rows = GAME_STAT_ORDER.map(
    (name) => g.stats.find((s) => statAttribute(s) === name) || { attribute: name },
  );
  const fans = Array.from(
    { length: Math.min(Math.max(Number(g.rarity) || 0, 0), 5) },
    () => `<img src="${esc(versioned("assets/rank-fan.svg"))}" alt="">`,
  ).join("");
  const troopSummary = g.troops.length
    ? g.troops
        .map((t) => t.troop + (t.bonus == null ? "" : " +" + t.bonus))
        .join("・")
    : "未収録";
  let html = `<div class="general-overview"><figure class="general-card-image">${image}<figcaption>${hasDetail ? "武将カード・画像を押すと開きます" : "顔画像（詳細カード未収録）"}</figcaption></figure><section class="general-profile" aria-label="武将能力"><header class="game-profile-header"><p>${esc(g.kana)}</p><h2 id="detail-title">${esc(g.name)}</h2><div class="rank-fans" role="img" aria-label="レアリティ 星${esc(g.rarity)}">${fans}</div></header><div class="profile-level">Lv.50</div><div class="profile-facts"><span>勢力　${esc(g.faction)}</span>${costHTML(g)}</div><div class="stats-heading detail-stats-heading">${totalStatsHTML(g)}</div>${abilityRadar(g)}<div class="game-troop-line">兵種適性<b>${esc(troopSummary)}</b></div>${g.unique_tactic ? `<div class="game-skill-line"><span aria-hidden="true">固</span>${esc(g.unique_tactic.name)}</div>` : ""}</section></div>`;
  html += section(
    "能力値",
    `<table class="ability-table"><thead><tr><th>属性</th><th>Lv1</th><th>成長</th><th>Lv50</th></tr></thead><tbody>${rows.map((s) => `<tr><th>${esc(statAttribute(s))}</th><td>${number(s.level1)}</td><td>${s.growth == null ? "—" : Number(s.growth).toFixed(2)}</td><td>${number(s.level50)}</td></tr>`).join("")}</tbody></table>`,
  );
  html += section(
    "兵種ボーナス",
    g.troops.length
      ? g.troops
          .map(
            (t) =>
              `<span class="pill">${esc(t.troop)} ${t.bonus == null ? "—" : "+" + esc(t.bonus)}${t.cap_bonus == null ? "" : "（上限 +" + esc(t.cap_bonus) + "）"}</span>`,
          )
          .join("")
      : "<p>未収録</p>",
  );
  if (g.unique_tactic)
    html += section(
      "固有戦法・" + g.unique_tactic.name,
      `<span class="pill">${esc(g.unique_tactic.category)}</span><p>${esc(g.unique_tactic.effect)}</p>`,
    );
  html += section(
    "武将特性",
    g.traits.length
      ? g.traits
          .map(
            (t) =>
              `<div class="trait"><h4><small>${esc(t.unlock_level)}</small>${esc(t.name)}</h4><p>${esc(t.effect)}</p></div>`,
          )
          .join("")
      : "<p>未収録</p>",
  );
  if (g.tags.length)
    html += section(
      "タグ",
      g.tags.map((t) => `<span class="pill">${esc(t.tag)}</span>`).join(""),
    );
  if (g.tiers.length)
    html += section(
      "シーズン別評価",
      g.tiers
        .map((t) => `<span class="pill">${esc(t.season)} ${esc(t.tier)}</span>`)
        .join(""),
    );
  const grants = db.tactics.filter((t) =>
    t.general_ids?.includes(g.id) &&
    !String(t.id).startsWith("s4-unique-") &&
    t.name !== g.unique_tactic?.name &&
    !String(t.acquisition || "").includes("固有")
  );
  if (grants.length)
    html += section(
      "伝授戦法",
      grants
        .map(
          (t) =>
            `<p>${reference("tactics", t.id, t.name)} ／ ${esc(t.rank)} ${esc(t.category)}</p>`,
        )
        .join(""),
    );
  const commentary = g.commentary && Number(g.commentary_season || 1) <= (window.MobunagaSeason?.current?.() || 1) ? g.commentary : "";
  return html + generalCouncilFeature(g) + relatedFormations(g.id, "generals") + sourceHTML(g.source) + mobunagaTips(commentary ? generalTipsVisual(g) + tipsParagraphs(commentary) : "");
}
function abilityRadar(g) {
  const limit = Math.max(
    300,
    Math.ceil(
      Math.max(
        ...db.generals.flatMap((row) =>
          row.stats.map((s) => Number(s.level50) || 0),
        ),
      ) / 50,
    ) * 50,
  );
  const values = GAME_STAT_ORDER.map((name) => stat(g, name));
  const complete = values.every(
    (value) => value != null && Number.isFinite(Number(value)),
  );
  const point = (i, ratio) => {
    const angle = ((-90 + i * 60) * Math.PI) / 180;
    return [
      160 + 68 * ratio * Math.cos(angle),
      118 + 68 * ratio * Math.sin(angle),
    ]
      .map((n) => n.toFixed(2))
      .join(",");
  };
  const hexagon = (ratio) =>
    GAME_STAT_ORDER.map((_, i) => point(i, ratio)).join(" ");
  const labels = GAME_STAT_ORDER.map((name, i) => {
    const [x, y] = point(i, 1.42).split(",");
    return `<text class="radar-label" x="${x}" y="${Number(y) - 5}" text-anchor="middle">${esc(name)}</text><text class="radar-number" x="${x}" y="${Number(y) + 15}" text-anchor="middle">${number(values[i])}</text>`;
  }).join("");
  const polygon = complete
    ? GAME_STAT_ORDER.map((_, i) => point(i, Math.min(1, Number(values[i]) / limit))).join(" ")
    : hexagon(0);
  return `<div class="ability-radar${complete ? "" : " is-empty"}" aria-label="Lv50能力レーダー"><svg viewBox="0 0 320 236" role="img"><polygon class="radar-background" points="${hexagon(1)}"></polygon><polygon class="radar-grid" points="${hexagon(1)}"></polygon><polygon class="radar-grid radar-grid-inner" points="${hexagon(.5)}"></polygon>${GAME_STAT_ORDER.map((_,i)=>`<line class="radar-axis" x1="160" y1="118" x2="${point(i,1).split(",")[0]}" y2="${point(i,1).split(",")[1]}"></line>`).join("")}<polygon class="radar-values" points="${polygon}"></polygon>${labels}</svg>${complete ? `<p>Lv50基礎値 ／ 最大目安 ${limit}</p>` : "<p>能力値は未収録です</p>"}</div>`;
}
function tacticDetail(t) {
  const editorial = splitEditorialEffect(t.effect);
  const entry = comparison.get(t.id);
  const result = entry?.result;
  const acquisition = t.acquisition || "取得元未収録";
  const owners = t.general_ids.map((id) => generalMap.get(id)).filter(Boolean);
  return (
    `<div class="detail-head"><div><p>戦法録</p><h2 id="detail-title">${esc(t.name)}</h2><div class="detail-meta">${badge(t.rank + " 戦法")}${badge(t.category)}${t.first_season ? badge(t.first_season + "～") : ""}</div></div></div>` +
    section("効果", `<p>${esc(editorial.effect || "元資料に効果の記載がありません。")}</p>`) +
    section(
      "発動・適用",
      `<dl class="definition"><dt>発動率</dt><dd>${esc(t.activation_rate || "未収録")}</dd><dt>適用兵種</dt><dd>${esc(t.applicable_troop || "指定なし")}</dd></dl>`,
    ) +
    section(
      "取得方法",
      `<p>${esc(acquisition)}</p>${owners.length ? `<div class="owner-list">${owners.map((g) => reference("generals", g.id, g.name)).join("")}</div>` : ""}`,
    ) +
    relatedFormations(t.id, "tactics") +
    sourceHTML(t.source) +
    mobunagaTips(tipsParagraphs(editorial.tips) + "<h4>兵刃1撃の試算</h4>" + (
      result
        ? `<p>共通条件：武勇337 / 兵力10,000 / 相手統率500 / 8ターン / 対象1体。</p><dl class="definition"><dt>1回ダメージ</dt><dd>${damageNumber.format(result.hit)}</dd><dt>1ターン平均</dt><dd>${damageNumber.format(result.perTurn)}</dd><dt>8ターン累計期待値</dt><dd>${damageNumber.format(result.expected)}</dd></dl><p><a href="simulator/">独立シミュレーターで条件を変える ›</a></p>`
        : `<p>${esc(entry?.preset.note || "効果文から兵刃の発動率・倍率を一意に取得できないため、試算していません。")}</p><p><a href="simulator/">独立シミュレーターで手入力して試す ›</a></p>`
    ))
  );
}
function openDetail(type, id, fromBack = false) {
  const row = type === "generals" ? generalMap.get(id) : type === "tactics" ? tacticMap.get(id) : db?.[type]?.find((r) => r.id === id);
  if (!row) return;
  const dialog = $("#detail");
  if (!dialog.open) detailStack = [];
  if (!fromBack) detailStack.push({ type, id });
  $("#detail-back").hidden = detailStack.length < 2;
  $("#detail-content").innerHTML =
    type === "formations"
      ? formationDetail(row)
      : type === "generals"
        ? generalDetail(row)
        : tacticDetail(row);
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  $("#detail-title").setAttribute("tabindex", "-1");
  $("#detail-title").focus({ preventScroll: true });
  document.dispatchEvent(new CustomEvent("mobunaga:detailopen", { detail: { type, id } }));
}
async function fetchJSON(name) {
  // A malformed/live server error is surfaced, not silently replaced with older data.
  const live = await fetch(versioned(`assets/${name}.live.json`), {
    cache: "no-cache",
  });
  if (live.ok) return live.json();
  if (live.status !== 404) throw new Error(`HTTP ${live.status}`);
  const initial = await fetch(versioned(`assets/${name}.json`), {
    cache: "force-cache",
  });
  if (!initial.ok) throw new Error(`HTTP ${initial.status}`);
  return initial.json();
}
async function start() {
  const results = await Promise.allSettled([
    fetchJSON("database"),
    fetchJSON("formations"),
    fetch(versioned("assets/detail-images.json"), { cache: "force-cache" }).then((response) => {
      if (!response.ok) throw new Error("Image catalog unavailable");
      return response.json();
    }),
    fetch(versioned("assets/formation-analysis.json"), { cache: "force-cache" }).then((response) => {
      if (!response.ok) throw new Error("Formation analysis unavailable");
      return response.json();
    }),
  ]);
  if (
    results[2].status === "fulfilled" &&
    results[2].value &&
    typeof results[2].value === "object"
  )
    detailImages = results[2].value;
  if (results[0].status === "rejected") throw results[0].reason;
  db = results[0].value;
  if (!Array.isArray(db.generals) || !Array.isArray(db.tactics))
    throw new Error("Invalid catalog");
  generalMap = new Map(db.generals.map((g) => [g.id, g]));
  tacticMap = new Map(db.tactics.map((t) => [t.id, t]));
  formationError =
    results[1].status === "rejected" ||
    !Array.isArray(results[1].value?.formations);
  db.formations = formationError ? [] : results[1].value.formations;
  if (results[3].status === "fulfilled") {
    formationAnalysisMap = new Map(results[3].value.analyses.map((row) => [row.formation_id, row]));
    goodJobFormations = results[3].value.good_job_formations || [];
  }
  $("#total-generals").textContent = db.generals.length;
  $("#total-tactics").textContent = db.tactics.length;
  $("#total-formations").textContent = formationError
    ? "—"
    : db.formations.length;
  renderGoodJobs();
  setOptions(
    "category",
    [...new Set(db.tactics.map((t) => t.category).filter(Boolean))].sort(),
    "すべての種別",
  );
  $("#updated").textContent =
    "武将・戦法データ作成：" +
    new Date(db.meta.generated_at).toLocaleDateString("ja-JP") +
    (formationError ? "" : " ／ 編成資料：選択シーズンまで");
  changeKind(location.hash.slice(1) || "formations", true);
}
$("#filters").addEventListener("submit", (e) => e.preventDefault());
$("#filter-toggle").addEventListener("click", () => {
  const expanded = $("#filters").classList.toggle("filters-expanded");
  $("#filter-toggle").setAttribute("aria-expanded", String(expanded));
  $("#filter-toggle").textContent = expanded
    ? "絞り込み条件 ▴"
    : "絞り込み条件 ▾";
});
filterIds.forEach((id) =>
  $("#" + id).addEventListener(id === "query" ? "input" : "change", () => {
    page = 1;
    render();
  }),
);
function renderGoodJobs() {
  $("#good-job-list").innerHTML = goodJobFormations.map((row) => `<article class="good-job-card"><span>検証候補</span><h3>${esc(row.name)}</h3><p><strong>目的</strong>${esc(row.purpose)}</p><p><strong>動き</strong>${esc(row.operation)}</p><small>${esc(row.caution)}</small></article>`).join("");
}
$("#reset").addEventListener("click", () => changeKind(kind));
document
  .querySelectorAll("[data-kind]")
  .forEach((n) =>
    n.addEventListener("click", () => changeKind(n.dataset.kind)),
  );
function chooseSeason(season) {
  changeKind("formations");
  if (window.MobunagaSeason?.select) window.MobunagaSeason.select(Number(season));
  render();
  $("#catalog").scrollIntoView({ block: "start", behavior: "smooth" });
}
document
  .querySelectorAll("[data-season]")
  .forEach((n) =>
    n.addEventListener("click", () => chooseSeason(n.dataset.season)),
  );
$("#latest-season").addEventListener("click", () => chooseSeason("4"));
$("#browse-generals").addEventListener("click", () => changeKind("generals"));
$("#previous-page").addEventListener("click", () => {
  page--;
  render();
  $("#catalog").scrollIntoView({ block: "start" });
});
$("#next-page").addEventListener("click", () => {
  page++;
  render();
  $("#catalog").scrollIntoView({ block: "start" });
});
document.addEventListener("click", (e) => {
  const limitBreak = e.target.closest("[data-limit-break]");
  if (limitBreak) {
    formationLimitBreaks.set(limitBreak.dataset.formationId, Number(limitBreak.dataset.limitBreak));
    const formation = db.formations.find((row) => row.id === limitBreak.dataset.formationId);
    if (formation) $("#detail-content").innerHTML = formationDetail(formation);
    return;
  }
  const button = e.target.closest("[data-open]");
  if (button) openDetail(button.dataset.open, button.dataset.id);
  if (e.target.closest("[data-reload]")) location.reload();
});
$("#close-detail").addEventListener("click", () => $("#detail").close());
$("#detail-back").addEventListener("click", () => {
  if (detailStack.length > 1) {
    detailStack.pop();
    const previous = detailStack.at(-1);
    openDetail(previous.type, previous.id, true);
  }
});
$("#detail").addEventListener("click", (e) => {
  if (e.target !== $("#detail")) return;
  const r = e.target.getBoundingClientRect();
  if (
    e.clientX < r.left ||
    e.clientX > r.right ||
    e.clientY < r.top ||
    e.clientY > r.bottom
  )
    e.target.close();
});
window.addEventListener("hashchange", () => changeKind(location.hash.slice(1)));
changeKind(location.hash.slice(1) || "formations", true);
start()
  .catch(() => {
    $("#results").innerHTML =
      '<div class="status error-status">資料を読み込めませんでした。<br>通信状況を確認して、再読み込みしてください。<button data-reload>再読み込み</button></div>';
    $("#updated").textContent = "データ読み込み失敗";
  })
  .finally(() => {
    const loading = $("#app-loading");
    if (!loading) return;
    loading.classList.add("is-complete");
    setTimeout(() => loading.remove(), 240);
  });


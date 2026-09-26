"use strict";

(() => {
  const TURNS = 8;
  let tacticView = localStorage.getItem("mobunaga-tactic-view") || "cards";
  let effectFilter = localStorage.getItem("mobunaga-tactic-effect") || "all";
  let overviewSort = localStorage.getItem("mobunaga-tactic-sort") || "name";

  function pct(value, approximate = false) {
    return Number.isFinite(value) ? `${Math.round(value * 10) / 10}%${approximate ? "※" : ""}` : "—";
  }

  function count(value) {
    return Number.isFinite(value) ? `${Math.round(value * 100) / 100}回` : "—";
  }

  function effectTags(t) {
    const text = `${t.name || ""} ${t.effect || ""}`;
    const tags = [];
    const add = (key, label) => {
      if (!tags.some((row) => row.key === key)) tags.push({ key, label });
    };
    if (/兵刃|ダメージ|計略|火傷|中毒|逃亡/.test(text)) add("damage", "ダメージ");
    if (/回復|治療|兵力を回復|兵力回復|回復率|離反/.test(text)) add("heal", "回復");
    if (/上昇|増加|強化|与えるダメージ.*上|被ダメージ.*下|先攻|連撃|会心|鉄壁|抵抗|洞察|離反/.test(text)) add("buff", "強化");
    if (/低下|減少|弱体|被ダメージ.*上|与えるダメージ.*下|破陣|脆弱/.test(text)) add("debuff", "弱体");
    if (/威圧|混乱|恐慌|挑発|禁療|封印|砕心|虚弱|行動不能|制御/.test(text)) add("control", "制御");
    if (!tags.length) add("special", "特殊");
    return tags;
  }

  function activationRate(t) {
    const text = String(t.activation_rate || "");
    const match =
      text.match(/([\d.]+)\s*%?\s*\(Lv10\)/i) ||
      text.match(/Lv10[^\d]*([\d.]+)\s*%/i) ||
      text.match(/([\d.]+)\s*%/);
    return match ? Number(match[1]) : null;
  }

  function preparationTurns(t) {
    const text = String(t.effect || "");
    const patterns = [
      /([1-5])\s*ターン(?:の)?準備/,
      /([1-5])\s*ターン準備/,
      /準備(?:状態)?(?:に入る|に入り|する|を行う)?[^0-9]{0,12}([1-5])\s*ターン/,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return Number(match[1]);
    }
    return 0;
  }

  function extractRate(text, type) {
    const token = type === "heal" ? "(?:回復|治療|兵力回復)" : "(?:兵刃|計略)ダメージ";
    const patterns = [
      new RegExp(`${token}[（(][^）)]*?(?:ダメージ率|回復率)?\\s*([\\d.]+)%\\s*[→～〜~]\\s*([\\d.]+)%[^）)]*[）)]`, "g"),
      new RegExp(`([\\d.]+)%\\s*[→～〜~]\\s*([\\d.]+)%[^。]{0,18}${token}`, "g"),
      new RegExp(`${token}[（(][^）)]*?(?:ダメージ率|回復率)?\\s*([\\d.]+)%[^）)]*[）)]`, "g"),
      new RegExp(`(?:ダメージ率|回復率)?\\s*([\\d.]+)%[^。]{0,18}${token}`, "g"),
    ];
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      if (!match) continue;
      const value = match[2] != null ? Number(match[2]) : Number(match[1]);
      if (Number.isFinite(value)) return value;
    }
    return null;
  }

  function directDamageRate(t) {
    const text = String(t.effect || "");
    const preset = DamageMath.preset(t);
    if (Number.isFinite(Number(preset.rate))) return Number(preset.rate);
    return extractRate(text, "damage");
  }

  function directHealRate(t) {
    return extractRate(String(t.effect || ""), "heal");
  }

  function lifestealRate(t) {
    const text = String(t.effect || "");
    const patterns = [
      /離反(?:率)?[^\d]{0,12}([\d.]+)%\s*[→～〜~]\s*([\d.]+)%/,
      /([\d.]+)%\s*[→～〜~]\s*([\d.]+)%[^。]{0,20}離反/,
      /離反(?:率)?[^\d]{0,12}([\d.]+)%/,
      /([\d.]+)%[^。]{0,20}離反/,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (!match) continue;
      const value = match[2] != null ? Number(match[2]) : Number(match[1]);
      if (Number.isFinite(value)) return value;
    }
    return null;
  }

  function meanAt(probability, preparation) {
    try {
      return DamageMath.activationDistribution(probability / 100, TURNS, preparation).mean;
    } catch {
      return null;
    }
  }

  function rateSummary(t) {
    const damageRate = directDamageRate(t);
    const directHeal = directHealRate(t);
    const lifesteal = lifestealRate(t);
    const probability = activationRate(t);
    const preparation = preparationTurns(t);
    const derivedHeal = !Number.isFinite(directHeal) && Number.isFinite(lifesteal) && Number.isFinite(damageRate);
    const healRate = Number.isFinite(directHeal)
      ? directHeal
      : derivedHeal
        ? damageRate * lifesteal / 100
        : null;

    if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
      return {
        damageRate, healRate, directHeal, lifesteal, derivedHeal, probability: null, preparation,
        mean: null, lowerMean: null, upperMean: null,
        damageExpected: null, damageLower: null, damageUpper: null,
        healExpected: null, healLower: null, healUpper: null,
      };
    }

    const mean = meanAt(probability, preparation);
    const lowerRaw = meanAt(probability / 2, preparation);
    const upperMean = meanAt(Math.min(100, probability * 2), preparation);
    const lowerMean = Number.isFinite(lowerRaw) ? Math.floor(lowerRaw) : null;

    const damageExpected = Number.isFinite(damageRate) && Number.isFinite(mean) ? damageRate * mean : null;
    const damageLower = Number.isFinite(damageRate) && Number.isFinite(lowerMean) ? damageRate * lowerMean : null;
    const damageUpper = Number.isFinite(damageRate) && Number.isFinite(upperMean) ? damageRate * upperMean : null;

    return {
      damageRate,
      healRate,
      directHeal,
      lifesteal,
      derivedHeal,
      probability,
      preparation,
      mean,
      lowerMean,
      upperMean,
      damageExpected,
      damageLower,
      damageUpper,
      healExpected: derivedHeal && Number.isFinite(lifesteal) && Number.isFinite(damageExpected)
        ? damageExpected * lifesteal / 100
        : Number.isFinite(healRate) && Number.isFinite(mean) ? healRate * mean : null,
      healLower: derivedHeal && Number.isFinite(lifesteal) && Number.isFinite(damageLower)
        ? damageLower * lifesteal / 100
        : Number.isFinite(healRate) && Number.isFinite(lowerMean) ? healRate * lowerMean : null,
      healUpper: derivedHeal && Number.isFinite(lifesteal) && Number.isFinite(damageUpper)
        ? damageUpper * lifesteal / 100
        : Number.isFinite(healRate) && Number.isFinite(upperMean) ? healRate * upperMean : null,
    };
  }

  function tagHtml(t) {
    return effectTags(t)
      .map((tag) => `<span class="tactic-effect-tag tactic-effect-${tag.key}">${esc(tag.label)}</span>`)
      .join("");
  }

  function metric(t, order) {
    const s = rateSummary(t);
    if (order === "damageExpected") return s.damageExpected;
    if (order === "damageUpper") return s.damageUpper;
    if (order === "damageLower") return s.damageLower;
    if (order === "healExpected") return s.healExpected;
    if (order === "healUpper") return s.healUpper;
    if (order === "healLower") return s.healLower;
    if (order === "singleDamage") return s.damageRate;
    if (order === "singleHeal") return s.healRate;
    if (order === "probability") return s.probability;
    if (order === "mean") return s.mean;
    return null;
  }

  function visibleRows() {
    let rows = filtered.slice();
    if (effectFilter !== "all") {
      rows = rows.filter((t) => effectTags(t).some((tag) => tag.key === effectFilter));
    }
    rows.sort((a, b) => {
      if (overviewSort !== "name") {
        const av = metric(a, overviewSort), bv = metric(b, overviewSort);
        if (av == null && bv != null) return 1;
        if (av != null && bv == null) return -1;
        if (av != null && bv != null && av !== bv) return bv - av;
      }
      return a.name.localeCompare(b.name, "ja");
    });
    return rows;
  }

  function compactValues(s) {
    const approx = !!s.derivedHeal;
    return `<div class="tactic-compact-values">
      <span class="tactic-damage-number"><small>ダメ期待</small><b>${pct(s.damageExpected)}</b></span>
      <span class="tactic-damage-number"><small>ダメ上振れ</small><b>${pct(s.damageUpper)}</b></span>
      <span class="tactic-damage-number"><small>ダメ下振れ</small><b>${pct(s.damageLower)}</b></span>
      <span class="tactic-heal-number"><small>回復期待</small><b>${pct(s.healExpected, approx)}</b></span>
      <span class="tactic-heal-number"><small>回復上振れ</small><b>${pct(s.healUpper, approx)}</b></span>
      <span class="tactic-heal-number"><small>回復下振れ</small><b>${pct(s.healLower, approx)}</b></span>
    </div>`;
  }

  tacticCard = function tacticCardOverview(t) {
    const s = rateSummary(t);
    const note = s.mean == null
      ? "平均発動回数を算出できません"
      : `8T / 通常 ${count(s.mean)} / 下振れ ${count(s.lowerMean)} / 上振れ ${count(s.upperMean)}${s.preparation ? ` / 準備${s.preparation}T` : ""}`;
    const lifestealNote = s.derivedHeal
      ? `※ 離反${Number.isFinite(s.lifesteal) ? ` ${pct(s.lifesteal)}` : ""}由来の回復値。表示はこの戦法で抽出できたダメージ分だけを基準に計算。他のダメージにも離反が適用される場合、実際の回復量はさらに増えます。`
      : "";
    return `<button class="card tactic-card tactic-overview-card" data-open="tactics" data-id="${esc(t.id)}" aria-label="${esc(t.name)}の詳細">
      <div class="tactic-card-head">${badge(t.rank + " 戦法")} ${badge(t.category)}<div class="tactic-effect-tags">${tagHtml(t)}</div></div>
      <h3>${esc(t.name)}</h3>
      <p class="effect">${esc(t.effect || "元資料に効果の記載がありません。")}</p>
      <span class="meta">発動率 ${esc(t.activation_rate || "—")}</span>
      ${compactValues(s)}
      <div class="tactic-rate-note">${esc(note)}${lifestealNote ? `<br>${esc(lifestealNote)}` : ""}</div>
    </button>`;
  };

  function ensureToolbar() {
    let host = document.querySelector("#tactic-overview-toolbar");
    if (!host) {
      host = document.createElement("div");
      host.id = "tactic-overview-toolbar";
      host.className = "tactic-overview-toolbar";
      const resultBar = document.querySelector(".result-bar");
      resultBar?.parentNode.insertBefore(host, resultBar.nextSibling);
    }
    host.hidden = kind !== "tactics";
    if (kind !== "tactics") return;
    const tabs = [
      ["all", "すべて"], ["damage", "ダメージ"], ["heal", "回復"], ["buff", "強化"], ["debuff", "弱体化"], ["control", "制御"], ["special", "特殊"],
    ];
    host.innerHTML = `<div class="tactic-effect-tabs" role="tablist" aria-label="効果カテゴリ">${tabs.map(([key,label]) => `<button type="button" data-effect-filter="${key}" aria-pressed="${effectFilter === key}">${label}</button>`).join("")}</div>
      <div class="tactic-toolbar-right"><label>並び替え<select id="tactic-overview-sort">
        <option value="name"${overviewSort === "name" ? " selected" : ""}>戦法名順</option>
        <option value="damageExpected"${overviewSort === "damageExpected" ? " selected" : ""}>ダメージ期待値 高い順</option>
        <option value="damageUpper"${overviewSort === "damageUpper" ? " selected" : ""}>ダメージ上振れ 高い順</option>
        <option value="damageLower"${overviewSort === "damageLower" ? " selected" : ""}>ダメージ下振れ 高い順</option>
        <option value="healExpected"${overviewSort === "healExpected" ? " selected" : ""}>回復期待値 高い順</option>
        <option value="healUpper"${overviewSort === "healUpper" ? " selected" : ""}>回復上振れ 高い順</option>
        <option value="healLower"${overviewSort === "healLower" ? " selected" : ""}>回復下振れ 高い順</option>
        <option value="singleDamage"${overviewSort === "singleDamage" ? " selected" : ""}>ダメージ単発 高い順</option>
        <option value="singleHeal"${overviewSort === "singleHeal" ? " selected" : ""}>回復単発 高い順</option>
        <option value="probability"${overviewSort === "probability" ? " selected" : ""}>発動率 高い順</option>
        <option value="mean"${overviewSort === "mean" ? " selected" : ""}>平均発動回数 高い順</option>
      </select></label>
      <div class="tactic-view-toggle"><span>表示</span><button type="button" data-tactic-view="cards" aria-pressed="${tacticView === "cards"}">カード</button><button type="button" data-tactic-view="table" aria-pressed="${tacticView === "table"}">表</button></div></div>`;
  }

  function redrawCards() {
    if (kind !== "tactics") return;
    const rows = visibleRows();
    const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    page = Math.min(page, pages);
    const start = (page - 1) * PAGE_SIZE;
    const end = page * PAGE_SIZE;
    const results = document.querySelector("#results");
    document.querySelector("#result-count").textContent = rows.length;
    document.querySelector("#page-range").textContent = rows.length ? `${start + 1}–${Math.min(end, rows.length)}件を表示` : "";
    document.querySelector("#page-indicator").textContent = `${page} / ${pages}`;
    document.querySelector("#previous-page").disabled = page <= 1;
    document.querySelector("#next-page").disabled = page >= pages;
    document.querySelector(".pagination").hidden = rows.length <= PAGE_SIZE;
    if (results) results.innerHTML = rows.length ? rows.slice(start, end).map(tacticCard).join("") : '<div class="status">該当する資料がありません。<br>検索語や絞り込み条件を変更してください。</div>';
  }

  function buildTable() {
    let host = document.querySelector("#tactic-overview-table");
    if (!host) {
      host = document.createElement("section");
      host.id = "tactic-overview-table";
      host.className = "tactic-overview-table";
      const results = document.querySelector("#results");
      results.parentNode.insertBefore(host, results);
    }
    host.hidden = kind !== "tactics" || tacticView !== "table";
    document.querySelector("#results")?.classList.toggle("tactic-cards-hidden", kind === "tactics" && tacticView === "table");
    document.querySelector(".pagination")?.classList.toggle("tactic-cards-hidden", kind === "tactics" && tacticView === "table");
    if (kind !== "tactics" || tacticView !== "table") return;

    const rows = visibleRows().map((t) => ({ t, s: rateSummary(t), tags: effectTags(t) }));
    host.innerHTML = `<div class="tactic-table-heading"><div><strong>戦法倍率 俯瞰表</strong><small>8ターン基準。通常は実発動率、下振れは発動率1/2、上振れは発動率2倍（上限100%）で平均発動回数を計算。※は離反から算出した回復値で、当該戦法で抽出できたダメージ分のみを基準にしています。</small></div><span>${rows.length}件</span></div>
      <div class="tactic-table-scroll"><table><thead><tr><th>戦法</th><th>効果</th><th>種別</th><th>発動率</th><th>準備</th><th>通常回数</th><th>下振れ回数</th><th>上振れ回数</th><th>ダメ期待</th><th>ダメ上振れ</th><th>ダメ下振れ</th><th>回復期待</th><th>回復上振れ</th><th>回復下振れ</th></tr></thead><tbody>${rows.map(({ t, s, tags }) => `<tr data-open="tactics" data-id="${esc(t.id)}" tabindex="0"><th><span class="tactic-rank-mini">${esc(t.rank)}</span>${esc(t.name)}</th><td><div class="tactic-effect-tags">${tags.map((tag) => `<span class="tactic-effect-tag tactic-effect-${tag.key}">${esc(tag.label)}</span>`).join("")}</div></td><td>${esc(t.category || "—")}</td><td>${esc(t.activation_rate || "—")}</td><td>${s.preparation ? `${s.preparation}T` : "—"}</td><td>${count(s.mean)}</td><td>${count(s.lowerMean)}</td><td>${count(s.upperMean)}</td><td class="tactic-damage-number"><strong>${pct(s.damageExpected)}</strong></td><td class="tactic-damage-number">${pct(s.damageUpper)}</td><td class="tactic-damage-number">${pct(s.damageLower)}</td><td class="tactic-heal-number"><strong>${pct(s.healExpected, s.derivedHeal)}</strong></td><td class="tactic-heal-number">${pct(s.healUpper, s.derivedHeal)}</td><td class="tactic-heal-number">${pct(s.healLower, s.derivedHeal)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  const baseRender = render;
  render = function renderWithTacticOverview() {
    baseRender();
    ensureToolbar();
    if (kind === "tactics") redrawCards();
    buildTable();
  };

  document.addEventListener("change", (event) => {
    if (event.target?.id === "tactic-overview-sort") {
      overviewSort = event.target.value || "name";
      localStorage.setItem("mobunaga-tactic-sort", overviewSort);
      page = 1;
      redrawCards();
      buildTable();
    }
  });

  document.addEventListener("click", (event) => {
    const effect = event.target.closest("[data-effect-filter]");
    if (effect) {
      effectFilter = effect.dataset.effectFilter || "all";
      localStorage.setItem("mobunaga-tactic-effect", effectFilter);
      page = 1;
      ensureToolbar();
      redrawCards();
      buildTable();
      return;
    }
    const toggle = event.target.closest("[data-tactic-view]");
    if (toggle) {
      tacticView = toggle.dataset.tacticView === "table" ? "table" : "cards";
      localStorage.setItem("mobunaga-tactic-view", tacticView);
      ensureToolbar();
      buildTable();
      return;
    }
    const row = event.target.closest("#tactic-overview-table tr[data-open]");
    if (!row) return;
    const card = document.querySelector(`#results [data-open="tactics"][data-id="${CSS.escape(row.dataset.id)}"]`);
    if (card) card.click();
    else if (typeof openDetail === "function") openDetail("tactics", row.dataset.id);
  });

  document.addEventListener("keydown", (event) => {
    const row = event.target.closest?.("#tactic-overview-table tr[data-open]");
    if (row && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      row.click();
    }
  });
})();

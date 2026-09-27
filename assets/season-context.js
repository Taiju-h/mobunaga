"use strict";
(() => {
  const STORAGE_KEY = "mobunagaSeason";
  const COOKIE_KEY = "mobunaga_season";
  const MAX_WAIT = 200;
  let originals = null;
  let selected = Number(localStorage.getItem(STORAGE_KEY) || 0);
  let viewSeasons = new Set();
  let allView = true;
  let waitCount = 0;
  let additionsReady = false;
  let additionsLoading = false;

  const seasonNo = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(1, Math.trunc(value));
    const m = String(value || "").match(/S?(\d+)/i);
    return m ? Math.max(1, Number(m[1])) : null;
  };
  const generalFirstSeason = (g) => {
    const values = (g?.tiers || []).map((row) => seasonNo(row.season)).filter(Boolean);
    return values.length ? Math.min(...values) : 1;
  };
  const generalForSeason = (g, n) => {
    const clone = { ...g };
    const tiers = (g?.tiers || []).filter((row) => (seasonNo(row.season) || 999) <= n);
    const exact = tiers.find((row) => seasonNo(row.season) === n);
    const latest = tiers.sort((a,b)=>(seasonNo(b.season)||0)-(seasonNo(a.season)||0))[0];
    clone.tiers = tiers;
    clone.current_tier = (exact || latest)?.tier || g.current_tier;
    return clone;
  };
  const tacticFirstSeason = (t) => seasonNo(t?.first_season) || 1;
  const allSeasons = () => {
    if (!originals) return [1,2,3,4];
    const values = new Set([1]);
    originals.generals.forEach((g) => (g.tiers || []).forEach((row) => { const n=seasonNo(row.season); if(n) values.add(n); }));
    originals.formations.forEach((f) => { const n=seasonNo(f.season); if(n) values.add(n); });
    originals.tactics.forEach((t) => { const n=tacticFirstSeason(t); if(n) values.add(n); });
    values.add(4);
    return [...values].sort((a,b)=>a-b);
  };
  const availableSeasons = () => allSeasons().filter((n) => n <= (selected || 1));
  const setCookie = (n) => {
    document.cookie = `${COOKIE_KEY}=${encodeURIComponent(n)}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  };
  const current = () => selected || Number(localStorage.getItem(STORAGE_KEY) || 0) || 1;
  window.MobunagaSeason = { current, generalFirstSeason, tacticFirstSeason, select: (n) => setSeason(Number(n), true) };

  const hasUsefulValue = (value) => {
    if (value == null) return false;
    if (typeof value === "string") return value.trim() !== "";
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return true;
  };
  const mergeWithoutBlanks = (base, extra) => {
    const merged = { ...(base || {}) };
    for (const [key, value] of Object.entries(extra || {})) {
      if (!hasUsefulValue(value)) continue;
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        merged[key] &&
        typeof merged[key] === "object" &&
        !Array.isArray(merged[key])
      ) {
        merged[key] = mergeWithoutBlanks(merged[key], value);
      } else {
        merged[key] = value;
      }
    }
    return merged;
  };

  function mergeS4Additions(payload) {
    if (!payload || typeof db === "undefined" || !db) return;
    const generals = Array.isArray(payload.generals) ? payload.generals : [];
    const tactics = Array.isArray(payload.tactics) ? payload.tactics : [];
    const patches = Array.isArray(payload.patch_tactics) ? payload.patch_tactics : [];
    for (const patch of patches) {
      const target = db.tactics.find((row) => row.name === patch.name || row.name?.startsWith(patch.name + " "));
      if (target) Object.assign(target, mergeWithoutBlanks(patch, target));
    }
    for (const general of generals) {
      const index = db.generals.findIndex((row) => row.id === general.id || row.name === general.name);
      // Additions supply missing fields only; the exported catalog is authoritative.
      // Older additions use "stat", while cards and radar charts read "attribute".
      const fallback = {
        ...general,
        stats: (general.stats || []).map((row) => ({
          ...row, attribute: row.attribute || row.stat,
        })),
      };
      if (index >= 0) db.generals[index] = mergeWithoutBlanks(fallback, db.generals[index]);
      else db.generals.push(fallback);
      // Editorial commentary is versioned separately from generated MySQL effects.
      const mergedGeneral = index >= 0 ? db.generals[index] : db.generals[db.generals.length - 1];
      if (general.commentary) {
        mergedGeneral.commentary = general.commentary;
        mergedGeneral.commentary_season = general.commentary_season;
      }
    }
    for (const tactic of tactics) {
      const index = db.tactics.findIndex((row) => row.id === tactic.id || row.name === tactic.name);
      if (index >= 0) db.tactics[index] = mergeWithoutBlanks(tactic, db.tactics[index]);
      else db.tactics.push(tactic);
    }
    if (db.meta) {
      db.meta.generals = db.generals.length;
      db.meta.tactics = db.tactics.length;
    }
  }

  async function loadS4Additions() {
    if (additionsReady || additionsLoading) return;
    additionsLoading = true;
    try {
      const version = document.documentElement.dataset.dataVersion || "1";
      const response = await fetch(`assets/s4-additions.json?v=${encodeURIComponent(version)}`, { cache: "force-cache" });
      if (response.ok) mergeS4Additions(await response.json());
    } catch (error) {
      console.warn("S4 additions could not be loaded", error);
    } finally {
      additionsReady = true;
      additionsLoading = false;
      waitForData();
    }
  }

  function ensureSeasonTabStyles() {
    if (document.querySelector("#catalog-season-tab-style")) return;
    const style = document.createElement("style");
    style.id = "catalog-season-tab-style";
    style.textContent = `
      .catalog-season-tabs{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:0 0 14px;padding:12px 14px;border:1px solid #c5b997;background:linear-gradient(90deg,#f6f1e4,#e9eef0)}
      .catalog-season-tabs>span{font-weight:700;font-size:12px;color:#665d45;margin-right:4px}
      .catalog-season-tabs button{height:38px;padding:0 14px;border:1px solid #b5a985;background:#f7f2e5;color:#675b3d;font:700 14px var(--serif,serif);box-shadow:inset 0 0 0 1px #fff8;display:inline-flex;align-items:center;gap:7px}
      .catalog-season-tabs button:hover{background:#e3d5ad}
      .catalog-season-tabs .season-all[aria-pressed="true"]{background:linear-gradient(#8c6b2f,#6d501e);color:#fff6da;border-color:#74541f;box-shadow:0 2px 5px #5c481f33}
      .catalog-season-tabs .season-check[aria-pressed="true"]{background:#fff9e9;border-color:#8e6b2d;color:#4b3a1d;box-shadow:inset 0 0 0 2px #c4a05655}
      .catalog-season-tabs .tick{width:17px;height:17px;border:1px solid #aa9b76;background:#fffdf6;display:inline-grid;place-items:center;font:900 12px/1 sans-serif;color:transparent}
      .catalog-season-tabs .season-check[aria-pressed="true"] .tick{background:#6f5728;border-color:#6f5728;color:#fff7db}
      .catalog-season-tabs small{margin-left:auto;color:#81765d;font-size:10px}
      @media(max-width:700px){.catalog-season-tabs{gap:7px}.catalog-season-tabs button{padding:0 10px}.catalog-season-tabs small{width:100%;margin-left:0}}
    `;
    document.head.appendChild(style);
  }

  function ensureCatalogSeasonTabs() {
    ensureSeasonTabStyles();
    let tabs = document.querySelector("#catalog-season-tabs");
    if (!tabs) {
      tabs = document.createElement("div");
      tabs.id = "catalog-season-tabs";
      tabs.className = "catalog-season-tabs";
      tabs.setAttribute("role", "group");
      tabs.setAttribute("aria-label", "一覧のシーズン絞り込み");
      const filters = document.querySelector("#filters");
      if (filters) filters.parentNode.insertBefore(tabs, filters);
    }
    renderCatalogSeasonTabs();
  }

  function renderCatalogSeasonTabs() {
    const tabs = document.querySelector("#catalog-season-tabs");
    if (!tabs) return;
    const seasons = availableSeasons();
    if (allView) viewSeasons = new Set(seasons);
    const buttons = seasons.map((n) => {
      const checked = viewSeasons.has(n);
      return `<button type="button" class="season-check" data-catalog-season="${n}" aria-pressed="${checked}"><span class="tick" aria-hidden="true">✓</span>S${n}</button>`;
    }).join("");
    tabs.innerHTML = `<span>シーズン</span><button type="button" class="season-all" data-catalog-all aria-pressed="${allView}">すべて</button>${buttons}<small>最初は全選択。S数字を最初に押すと、そのシーズンだけに絞り込みます。</small>`;
  }

  function ensureHeaderPicker() {
    if (document.querySelector("#global-season-picker")) return;
    const top = document.querySelector(".topbar");
    if (!top) return;
    const wrap = document.createElement("label");
    wrap.className = "global-season-picker";
    wrap.innerHTML = '<span>あなたのシーズン</span><select id="global-season-picker" aria-label="表示シーズン"></select>';
    const edition = top.querySelector(".top-edition");
    if (edition) top.insertBefore(wrap, edition); else top.appendChild(wrap);
    wrap.querySelector("select").addEventListener("change", (e) => setSeason(Number(e.currentTarget.value), true));
  }

  function fillPickers() {
    const options = allSeasons();
    document.querySelectorAll("#global-season-picker, #season-choice").forEach((select) => {
      const old = Number(select.value || selected || 0);
      select.replaceChildren(...options.map((n) => new Option(`S${n}`, String(n))));
      if (options.includes(old)) select.value = String(old);
    });
  }

  function ensureFirstVisitDialog() {
    if (selected || document.querySelector("#season-gate")) return;
    const gate = document.createElement("div");
    gate.id = "season-gate";
    gate.className = "season-gate";
    gate.innerHTML = '<div class="season-gate-card" role="dialog" aria-modal="true" aria-labelledby="season-gate-title"><p class="eyebrow">ネタバレ防止</p><h2 id="season-gate-title">あなたのシーズンは？</h2><p>選んだシーズンまでに登場する武将・戦法だけを表示し、編成テンプレートとコメントもそのシーズンに合わせます。</p><label>現在のシーズン<select id="season-choice"></select></label><button id="season-start" type="button">このシーズンで見る</button></div>';
    document.body.appendChild(gate);
    fillPickers();
    const select = gate.querySelector("#season-choice");
    const seasons = allSeasons();
    select.value = String(seasons.at(-1) || 1);
    document.documentElement.classList.remove("season-pending");
    gate.querySelector("#season-start").addEventListener("click", () => setSeason(Number(select.value), true));
  }

  function tidyLegacySeasonControls() {
    const oldSeasonFilter = document.querySelector("#season");
    if (oldSeasonFilter) {
      oldSeasonFilter.value = "";
      const label = oldSeasonFilter.closest("label");
      if (label) label.hidden = true;
    }
    const latest = document.querySelector("#latest-season");
    if (latest) latest.hidden = true;
    const goodJobs = document.querySelector("#good-job-section");
    if (goodJobs) goodJobs.hidden = true;
  }

  function selectedSeasonList() {
    return [...viewSeasons].sort((a,b)=>a-b);
  }

  function displayTierSeason(g) {
    const seasons = selectedSeasonList();
    const n = seasons.length ? Math.max(...seasons) : (selected || 1);
    return generalForSeason(g, n);
  }

  function applyViewSeasons() {
    if (!originals || !selected || typeof db === "undefined" || !db) return;
    const allowed = new Set(availableSeasons());
    viewSeasons = new Set([...viewSeasons].filter((n) => allowed.has(n)));
    if (!viewSeasons.size) {
      allView = true;
      viewSeasons = new Set(availableSeasons());
    }

    if (allView) {
      db.generals = originals.generals.filter((g) => generalFirstSeason(g) <= selected).map((g) => generalForSeason(g, selected));
      db.tactics = originals.tactics.filter((t) => tacticFirstSeason(t) <= selected);
      db.formations = originals.formations.filter((f) => (seasonNo(f.season) || 999) <= selected);
    } else {
      db.generals = originals.generals.filter((g) => viewSeasons.has(generalFirstSeason(g))).map(displayTierSeason);
      db.tactics = originals.tactics.filter((t) => viewSeasons.has(tacticFirstSeason(t)));
      db.formations = originals.formations.filter((f) => viewSeasons.has(seasonNo(f.season)));
    }

    if (typeof generalMap !== "undefined") generalMap = new Map(db.generals.map((g) => [g.id, g]));
    if (typeof tacticMap !== "undefined") tacticMap = new Map(db.tactics.map((t) => [t.id, t]));
    const tg = document.querySelector("#total-generals"), tt = document.querySelector("#total-tactics"), tf = document.querySelector("#total-formations");
    if (tg) tg.textContent = String(db.generals.length);
    if (tt) tt.textContent = String(db.tactics.length);
    if (tf) tf.textContent = String(db.formations.length);
    tidyLegacySeasonControls();
    renderCatalogSeasonTabs();
    if (typeof changeKind === "function" && typeof kind !== "undefined") changeKind(kind, true);
    else if (typeof render === "function") render();
  }

  function applyFilter() {
    if (!originals || !selected || typeof db === "undefined" || !db) return;
    const picker = document.querySelector("#global-season-picker");
    if (picker) picker.value = String(selected);
    document.documentElement.dataset.userSeason = String(selected);
    allView = true;
    viewSeasons = new Set(availableSeasons());
    ensureCatalogSeasonTabs();
    applyViewSeasons();
    document.documentElement.classList.remove("season-pending");
    document.dispatchEvent(new CustomEvent("mobunaga:seasonchange", { detail:{ season:selected, viewSeasons:selectedSeasonList(), allView } }));
  }

  function setSeason(n, persist) {
    const choices = allSeasons();
    if (!Number.isInteger(n) || !choices.includes(n)) return;
    selected = n;
    if (persist) localStorage.setItem(STORAGE_KEY, String(n));
    setCookie(n);
    document.querySelector("#season-gate")?.remove();
    applyFilter();
  }

  document.addEventListener("click", (e) => {
    const allButton = e.target.closest("[data-catalog-all]");
    if (allButton && originals) {
      e.preventDefault();
      e.stopImmediatePropagation();
      allView = true;
      viewSeasons = new Set(availableSeasons());
      applyViewSeasons();
      return;
    }

    const catalogButton = e.target.closest("[data-catalog-season]");
    if (catalogButton && originals) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const n = Number(catalogButton.dataset.catalogSeason);
      if (!Number.isInteger(n) || !availableSeasons().includes(n)) return;

      if (allView) {
        allView = false;
        viewSeasons = new Set([n]);
      } else if (viewSeasons.has(n)) {
        viewSeasons.delete(n);
        if (!viewSeasons.size) {
          allView = true;
          viewSeasons = new Set(availableSeasons());
        }
      } else {
        viewSeasons.add(n);
        const seasons = availableSeasons();
        if (viewSeasons.size === seasons.length && seasons.every((s) => viewSeasons.has(s))) allView = true;
      }
      applyViewSeasons();
      return;
    }

    const seasonButton = e.target.closest("[data-season]");
    if (seasonButton && originals) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (typeof chooseSeason === "function") chooseSeason(seasonButton.dataset.season);
      else setSeason(Number(seasonButton.dataset.season), true);
      return;
    }
  }, true);

  function waitForData() {
    if (typeof db === "undefined" || !db || !Array.isArray(db.generals) || !Array.isArray(db.tactics) || !Array.isArray(db.formations)) {
      if (++waitCount < MAX_WAIT) setTimeout(waitForData, 50);
      return;
    }
    if (!additionsReady) {
      loadS4Additions();
      return;
    }
    originals = { generals:[...db.generals], tactics:[...db.tactics], formations:[...db.formations] };
    const seasons = allSeasons();
    if (selected && !seasons.includes(selected)) selected = 0;
    ensureHeaderPicker();
    fillPickers();
    if (selected) {
      setCookie(selected);
      applyFilter();
    } else {
      ensureFirstVisitDialog();
    }
  }

  waitForData();
})();

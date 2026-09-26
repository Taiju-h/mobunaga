"use strict";
(() => {
  const STORAGE_KEY = "mobunagaSeason";
  const COOKIE_KEY = "mobunaga_season";
  const MAX_WAIT = 200;
  let originals = null;
  let selected = Number(localStorage.getItem(STORAGE_KEY) || 0);
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
    return [...values].sort((a,b)=>a-b);
  };
  const setCookie = (n) => {
    document.cookie = `${COOKIE_KEY}=${encodeURIComponent(n)}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  };
  const current = () => selected || Number(localStorage.getItem(STORAGE_KEY) || 0) || 1;
  window.MobunagaSeason = { current, generalFirstSeason, tacticFirstSeason };

  function mergeS4Additions(payload) {
    if (!payload || typeof db === "undefined" || !db) return;
    const generals = Array.isArray(payload.generals) ? payload.generals : [];
    const tactics = Array.isArray(payload.tactics) ? payload.tactics : [];
    const patches = Array.isArray(payload.patch_tactics) ? payload.patch_tactics : [];

    for (const patch of patches) {
      const target = db.tactics.find((row) => row.name === patch.name || row.name?.startsWith(patch.name + " "));
      if (target) Object.assign(target, patch);
    }
    for (const general of generals) {
      const index = db.generals.findIndex((row) => row.id === general.id || row.name === general.name);
      if (index >= 0) db.generals[index] = { ...db.generals[index], ...general };
      else db.generals.push(general);
    }
    for (const tactic of tactics) {
      const index = db.tactics.findIndex((row) => row.id === tactic.id || row.name === tactic.name);
      if (index >= 0) db.tactics[index] = { ...db.tactics[index], ...tactic };
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
      const available = new Set(db?.formations?.map((f) => String(f.season)) || []);
      oldSeasonFilter.value = available.has(String(selected)) ? String(selected) : "";
      const label = oldSeasonFilter.closest("label");
      if (label) label.hidden = true;
    }
    const latest = document.querySelector("#latest-season");
    if (latest) latest.innerHTML = `S${selected}の編成を見る <span aria-hidden="true">›</span>`;
    const goodJobs = document.querySelector("#good-job-section");
    if (goodJobs) goodJobs.hidden = true;
  }

  function formationsForSeason(n) {
    const exact = originals.formations.filter((f) => seasonNo(f.season) === n);
    if (exact.length) return exact;
    const previous = originals.formations
      .map((f) => seasonNo(f.season))
      .filter((value) => value && value <= n);
    const latestAvailable = previous.length ? Math.max(...previous) : null;
    return latestAvailable == null
      ? []
      : originals.formations.filter((f) => seasonNo(f.season) === latestAvailable);
  }

  function applyFilter() {
    if (!originals || !selected || typeof db === "undefined" || !db) return;
    db.generals = originals.generals.filter((g) => generalFirstSeason(g) <= selected).map((g)=>generalForSeason(g,selected));
    db.tactics = originals.tactics.filter((t) => tacticFirstSeason(t) <= selected);
    db.formations = formationsForSeason(selected);
    if (typeof generalMap !== "undefined") generalMap = new Map(db.generals.map((g) => [g.id, g]));
    if (typeof tacticMap !== "undefined") tacticMap = new Map(db.tactics.map((t) => [t.id, t]));
    const tg = document.querySelector("#total-generals"), tt = document.querySelector("#total-tactics"), tf = document.querySelector("#total-formations");
    if (tg) tg.textContent = String(db.generals.length);
    if (tt) tt.textContent = String(db.tactics.length);
    if (tf) tf.textContent = String(db.formations.length);
    const picker = document.querySelector("#global-season-picker");
    if (picker) picker.value = String(selected);
    document.documentElement.dataset.userSeason = String(selected);
    tidyLegacySeasonControls();
    if (typeof changeKind === "function" && typeof kind !== "undefined") changeKind(kind, true);
    else if (typeof render === "function") render();
    document.documentElement.classList.remove("season-pending");
    document.dispatchEvent(new CustomEvent("mobunaga:seasonchange", { detail:{ season:selected } }));
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
    const seasonButton = e.target.closest("[data-season]");
    if (seasonButton && originals) {
      e.preventDefault(); e.stopImmediatePropagation();
      setSeason(Number(seasonButton.dataset.season), true);
      return;
    }
    if (e.target.closest("#latest-season") && originals) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (typeof changeKind === "function") changeKind("formations");
      tidyLegacySeasonControls();
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
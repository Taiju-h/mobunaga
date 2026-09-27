"use strict";
(() => {
  const PARAM = "seasons";
  const initialUrl = new URL(location.href);
  const initialRaw = initialUrl.searchParams.get(PARAM) || "";
  const initialSeasons = [...new Set(initialRaw.split(",").map((v) => Number(v)).filter((n) => Number.isInteger(n) && n >= 1 && n <= 9))].sort((a,b)=>a-b);
  const shareIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8 15.8 6.2M8.2 13.2l7.6 4.6"/></svg>';
  let currentDetail = null;

  if (initialSeasons.length) {
    const maxSeason = Math.max(...initialSeasons);
    const saved = Number(localStorage.getItem("mobunagaSeason") || 0);
    if (!saved || saved < maxSeason) localStorage.setItem("mobunagaSeason", String(maxSeason));
  }

  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = (state, title, url) => {
    if (typeof url === "string" && url.startsWith("#")) return originalReplaceState(state, title, `${location.pathname}${location.search}${url}`);
    return originalReplaceState(state, title, url);
  };

  function currentKind() {
    const value = location.hash.replace(/^#/, "").split("?")[0];
    return ["formations", "generals", "tactics"].includes(value) ? value : "formations";
  }
  function checkedSeasons() {
    return [...document.querySelectorAll("[data-catalog-season][aria-pressed='true']")]
      .map((button) => Number(button.dataset.catalogSeason)).filter(Number.isInteger).sort((a,b)=>a-b);
  }
  function allSelected() { return document.querySelector("[data-catalog-all]")?.getAttribute("aria-pressed") === "true"; }
  function selectedViewerSeason() {
    const selected = checkedSeasons();
    if (selected.length) return Math.max(...selected);
    const saved = Number(localStorage.getItem("mobunagaSeason") || 0);
    return saved || 1;
  }
  function syncUrlFromUi() {
    if (!document.querySelector("[data-catalog-season]")) return;
    const url = new URL(location.href);
    if (allSelected()) url.searchParams.delete(PARAM);
    else {
      const selected = checkedSeasons();
      if (selected.length) url.searchParams.set(PARAM, selected.join(","));
      else url.searchParams.delete(PARAM);
    }
    url.hash = currentKind();
    originalReplaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }
  async function shareUrl(button, url, title = document.title) {
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        button.classList.add("is-copied");
        button.title = "URLをコピーしました";
        setTimeout(() => { button.classList.remove("is-copied"); button.title = "共有"; }, 1500);
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
      try { await navigator.clipboard.writeText(url); } catch (_) {}
    }
  }
  function ensureStyles() {
    if (document.querySelector("#catalog-share-style")) return;
    const style = document.createElement("style");
    style.id = "catalog-share-style";
    style.textContent = `
      .catalog-share-button,.detail-share-icon{width:42px;height:42px;min-width:42px;padding:0;border:1px solid #b79b59;border-radius:9px;background:#fffaf0;color:#7b5e19;display:inline-grid;place-items:center;cursor:pointer;box-shadow:0 2px 5px #17374822}
      .catalog-share-button svg,.detail-share-icon svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8}
      .catalog-share-button:hover,.detail-share-icon:hover{background:#f5e7be}
      .catalog-share-button.is-copied,.detail-share-icon.is-copied{background:#e4f2e7;color:#27613a}
      .catalog-season-tabs .catalog-share-button{margin-left:auto}
      #detail .dialog-top .detail-share-icon{margin-left:auto;margin-right:8px}
      #detail .dialog-top .detail-share-icon + #close-detail{margin-left:0}
      @media(max-width:700px){.catalog-season-tabs .catalog-share-button{margin-left:4px}.catalog-share-button,.detail-share-icon{width:38px;height:38px;min-width:38px}}
    `;
    document.head.appendChild(style);
  }
  function removeLegacyShareBlock() {
    const root = document.querySelector("#detail-content");
    if (!root) return;
    root.querySelector("#entity-share")?.remove();
    const matches = [...root.querySelectorAll("section,aside,div")].filter((node) => {
      const text = (node.textContent || "").replace(/\s+/g, " ");
      return text.includes("このページを共有") &&
        (text.includes("URLをコピー") || text.includes("共有ページを開く") || text.includes("S4表示用"));
    });
    const deepest = matches.filter((node) => !matches.some((other) => other !== node && node.contains(other)));
    deepest.forEach((node) => node.remove());
  }
  function addCatalogShareButton() {
    const tabs = document.querySelector("#catalog-season-tabs");
    if (!tabs || tabs.querySelector("[data-share-catalog]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.shareCatalog = "1";
    button.className = "catalog-share-button";
    button.innerHTML = shareIcon;
    button.title = "この絞り込み状態を共有";
    button.setAttribute("aria-label", "この絞り込み状態を共有");
    button.addEventListener("click", async () => { syncUrlFromUi(); await shareUrl(button, location.href); });
    tabs.appendChild(button);
  }
  function addDetailShareButton() {
    const top = document.querySelector("#detail .dialog-top");
    const close = document.querySelector("#close-detail");
    if (!top || !close || top.querySelector("[data-share-detail]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.shareDetail = "1";
    button.className = "detail-share-icon";
    button.innerHTML = shareIcon;
    button.title = "この資料を共有";
    button.setAttribute("aria-label", "この資料を共有");
    button.addEventListener("click", async () => {
      if (!currentDetail) return;
      const type = { generals: "general", tactics: "tactic", formations: "formation" }[currentDetail.type];
      if (!type) return;
      const u = new URL("share.php", location.href);
      u.searchParams.set("type", type);
      u.searchParams.set("id", currentDetail.id);
      u.searchParams.set("season", String(selectedViewerSeason()));
      await shareUrl(button, u.href, document.querySelector("#detail-title")?.textContent || document.title);
    });
    top.insertBefore(button, close);
  }
  function applyInitialSelection() {
    if (!initialSeasons.length) return true;
    const buttons = [...document.querySelectorAll("[data-catalog-season]")];
    if (!buttons.length) return false;
    const available = buttons.map((button) => Number(button.dataset.catalogSeason));
    const wanted = initialSeasons.filter((n) => available.includes(n));
    if (!wanted.length) return true;
    const first = buttons.find((button) => Number(button.dataset.catalogSeason) === wanted[0]);
    if (first) first.click();
    for (const season of wanted.slice(1)) {
      const button = buttons.find((item) => Number(item.dataset.catalogSeason) === season);
      if (button && button.getAttribute("aria-pressed") !== "true") button.click();
    }
    return true;
  }
  let initialApplied = false;
  function refresh() {
    ensureStyles();
    removeLegacyShareBlock();
    addCatalogShareButton();
    addDetailShareButton();
    if (!initialApplied && applyInitialSelection()) initialApplied = true;
    if (initialApplied) syncUrlFromUi();
  }
  document.addEventListener("click", (event) => {
    const opener = event.target.closest("[data-open]");
    if (opener) currentDetail = { type: opener.dataset.open, id: opener.dataset.id };
    if (event.target.closest("[data-catalog-season], [data-catalog-all], [data-kind]")) setTimeout(refresh, 0);
  }, true);
  window.addEventListener("hashchange", () => setTimeout(refresh, 0));
  const observer = new MutationObserver(() => refresh());
  document.addEventListener("DOMContentLoaded", () => {
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-pressed", "open"] });
    refresh();
  });
})();

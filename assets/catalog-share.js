"use strict";
(() => {
  const PARAM = "seasons";
  const initialUrl = new URL(location.href);
  const initialRaw = initialUrl.searchParams.get(PARAM) || "";
  const initialSeasons = [...new Set(initialRaw.split(",").map((v) => Number(v)).filter((n) => Number.isInteger(n) && n >= 1 && n <= 9))].sort((a,b)=>a-b);

  if (initialSeasons.length) {
    const maxSeason = Math.max(...initialSeasons);
    const saved = Number(localStorage.getItem("mobunagaSeason") || 0);
    if (!saved || saved < maxSeason) localStorage.setItem("mobunagaSeason", String(maxSeason));
  }

  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = (state, title, url) => {
    if (typeof url === "string" && url.startsWith("#")) {
      return originalReplaceState(state, title, `${location.pathname}${location.search}${url}`);
    }
    return originalReplaceState(state, title, url);
  };

  function currentKind() {
    const value = location.hash.replace(/^#/, "").split("?")[0];
    return ["formations", "generals", "tactics"].includes(value) ? value : "formations";
  }

  function checkedSeasons() {
    return [...document.querySelectorAll("[data-catalog-season][aria-pressed='true']")]
      .map((button) => Number(button.dataset.catalogSeason))
      .filter(Number.isInteger)
      .sort((a,b)=>a-b);
  }

  function allSelected() {
    return document.querySelector("[data-catalog-all]")?.getAttribute("aria-pressed") === "true";
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

  function addShareButton() {
    const tabs = document.querySelector("#catalog-season-tabs");
    if (!tabs || tabs.querySelector("[data-share-catalog]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.shareCatalog = "1";
    button.className = "catalog-share-button";
    button.textContent = "この状態を共有";
    button.title = "現在のシーズン絞り込みを含むURLをコピー";
    button.addEventListener("click", async () => {
      syncUrlFromUi();
      const url = location.href;
      try {
        if (navigator.share) {
          await navigator.share({ title: document.title, url });
        } else {
          await navigator.clipboard.writeText(url);
          button.textContent = "URLをコピーしました";
          setTimeout(() => { button.textContent = "この状態を共有"; }, 1600);
        }
      } catch (error) {
        if (error?.name === "AbortError") return;
        try {
          await navigator.clipboard.writeText(url);
          button.textContent = "URLをコピーしました";
          setTimeout(() => { button.textContent = "この状態を共有"; }, 1600);
        } catch (_) {}
      }
    });
    tabs.appendChild(button);

    if (!document.querySelector("#catalog-share-style")) {
      const style = document.createElement("style");
      style.id = "catalog-share-style";
      style.textContent = `
        .catalog-season-tabs .catalog-share-button{margin-left:auto;background:linear-gradient(#2e6681,#214c62);border-color:#214c62;color:#fff;font-weight:800;box-shadow:0 2px 5px #17374833}
        .catalog-season-tabs .catalog-share-button:hover{background:linear-gradient(#3a7794,#285d76)}
        @media(max-width:700px){.catalog-season-tabs .catalog-share-button{margin-left:0;width:100%;justify-content:center}}
      `;
      document.head.appendChild(style);
    }
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
    addShareButton();
    if (!initialApplied && applyInitialSelection()) initialApplied = true;
    if (initialApplied) syncUrlFromUi();
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-catalog-season], [data-catalog-all], [data-kind]")) {
      setTimeout(refresh, 0);
    }
  }, true);

  window.addEventListener("hashchange", () => setTimeout(refresh, 0));
  const observer = new MutationObserver(() => refresh());
  document.addEventListener("DOMContentLoaded", () => {
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
    refresh();
  });
})();

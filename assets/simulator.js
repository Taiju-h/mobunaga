"use strict";
const $sim = (selector) => document.querySelector(selector);
const SIM_DATA_VERSION = document.documentElement.dataset.dataVersion || "1";
const versionedSim = (path) => path + (path.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(SIM_DATA_VERSION);
const simForm = $sim("#simulator-form");
const favoriteKey = "mobunaga.favorite-generals.v1";
const selectedSeason = Number(localStorage.getItem("mobunagaSeason") || 0);
if (!selectedSeason) location.replace("../");
let catalog = { generals: [], tactics: [] };
let formations = [];
let analysisMap = new Map();
let generalMap = new Map();
let favorites = loadFavorites();
const fmt = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 });

function escSim(value) { return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
function seasonNo(value){const m=String(value||"").match(/S?(\d+)/i);return m?Number(m[1]):null;}
function generalFirstSeason(g){const s=(g.tiers||[]).map((r)=>seasonNo(r.season)).filter(Boolean);return s.length?Math.min(...s):1;}
function tacticFirstSeason(t){return seasonNo(t.first_season)||1;}
function generalForSeason(g){const clone={...g};const rows=(g.tiers||[]).filter((r)=>(seasonNo(r.season)||999)<=selectedSeason).sort((a,b)=>(seasonNo(b.season)||0)-(seasonNo(a.season)||0));const exact=rows.find((r)=>seasonNo(r.season)===selectedSeason);clone.current_tier=(exact||rows[0])?.tier||g.current_tier;return clone;}
function loadFavorites() { try { const value = JSON.parse(localStorage.getItem(favoriteKey) || "[]"); return Array.isArray(value) ? value.filter((id) => typeof id === "string") : []; } catch { return []; } }
function saveFavorites() { localStorage.setItem(favoriteKey, JSON.stringify(favorites)); }
function stat(general, attribute) { return general?.stats?.find((row) => row.attribute === attribute)?.level50; }
async function fetchWithFallback(name) { const live = await fetch(versionedSim(`../assets/${name}.live.json`), { cache: "force-cache" }); if (live.ok) return live.json(); if (live.status !== 404) throw new Error(`HTTP ${live.status}`); const response = await fetch(versionedSim(`../assets/${name}.json`), { cache: "force-cache" }); if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); }
function renderFavorites() { const rows = favorites.map((id) => generalMap.get(id)).filter(Boolean); $sim("#favorite-generals").innerHTML = rows.length ? rows.map((general) => `<button type="button" data-favorite-general="${escSim(general.id)}">★ ${escSim(general.name)}</button>`).join("") : "<span>このシーズンで表示できるお気に入りはありません</span>"; }
function syncFavoriteButton() { const id = $sim("#attacker-general").value; const active = favorites.includes(id); $sim("#favorite-toggle").disabled = !id; $sim("#favorite-toggle").textContent = active ? "★ 登録済み" : "☆ お気に入り"; $sim("#favorite-toggle").setAttribute("aria-pressed", String(active)); }
function updateAttacker() { const general = generalMap.get($sim("#attacker-general").value); const value = stat(general, $sim("#attack-axis").value); if (value != null) $sim("#attack-stat").value = Number(value).toFixed(1); syncFavoriteButton(); renderResult(); }
function updateDefender() { const formation = formations.find((row) => row.id === $sim("#meta-formation").value); const leader = formation ? generalMap.get(formation.members[0].general_id) : null; const value = stat(leader, $sim("#defense-axis").value); if (value != null) $sim("#defense-stat").value = Number(value).toFixed(1); const analysis = formation ? analysisMap.get(formation.id) : null; const limitBreak = Number($sim("#meta-limit-break").value); const score = analysis?.score_by_limit_break?.find((row) => row.limit_break === limitBreak); $sim("#meta-danger").innerHTML = score ? `<span>要注意度偏差値</span><b>${score.danger_deviation}</b><small>こちらのメタ有効度 ${escSim(score.meta_grade)}</small>` : "<span>要注意度偏差値</span><b>—</b><small>相手を選択してください</small>"; renderResult(); }
function applyTactic() { const tactic = catalog.tactics.find((row) => row.id === $sim("#damage-tactic").value); if (!tactic) return renderResult(); const preset = DamageMath.preset(tactic); if (preset.rate != null) simForm.elements.rate.value = preset.rate; if (preset.probability != null) simForm.elements.probability.value = preset.probability; simForm.elements.preparation.value = preset.preparation; simForm.elements.hits.value = 1; renderResult(); }
function renderResult() { const input = {}; for (const node of simForm.querySelectorAll("input[name]")) input[node.name] = node.valueAsNumber; const result = DamageMath.calculate(input); const error = $sim("#simulator-error"); if (!simForm.checkValidity() || !result.valid) { error.hidden = false; error.textContent = result.reason || "入力値を確認してください。"; $sim("#simulator-output").innerHTML = "<p>条件を整えると試算結果が表示されます。</p>"; return; } error.hidden = true; const attacker = generalMap.get($sim("#attacker-general").value)?.name || "手動入力"; const target = formations.find((row) => row.id === $sim("#meta-formation").value); const attackAxis = $sim("#attack-axis").value; const defenseAxis = $sim("#defense-axis").value; $sim("#simulator-output").innerHTML = `<header><p>${escSim(attacker)} ／ ${escSim(target?.members[0].general_name || "手動入力の相手")}</p><h2>${escSim(attackAxis)} 対 ${escSim(defenseAxis)} の試算</h2></header><div class="sim-results"><article><span>補正前の基礎値</span><b>${fmt.format(result.before)}</b></article><article><span>補正後の基礎値</span><b>${fmt.format(result.after)}</b><small>＋${fmt.format(result.increasePercent)}%</small></article><article class="primary"><span>累計期待ダメージ</span><b>${fmt.format(result.expected)}</b><small>${input.turns}ターン</small></article><article><span>下振れ 5%点</span><b>${fmt.format(result.lower)}</b></article><article><span>上振れ 95%点</span><b>${fmt.format(result.upper)}</b></article><article><span>平均発動回数</span><b>${fmt.format(result.activations.mean)}</b><small>0回 ${fmt.format(result.activations.zero * 100)}%</small></article></div>`; }
async function startSimulator() {
  const [db, formationData, analysisData] = await Promise.all([fetchWithFallback("database"), fetchWithFallback("formations"), fetch(versionedSim("../assets/formation-analysis.json"), { cache: "force-cache" }).then((response) => response.json())]);
  catalog = { ...db, generals:(db.generals||[]).filter((g)=>generalFirstSeason(g)<=selectedSeason).map(generalForSeason), tactics:(db.tactics||[]).filter((t)=>tacticFirstSeason(t)<=selectedSeason) };
  formations = (formationData.formations||[]).filter((f)=>Number(f.season)===selectedSeason);
  analysisMap = new Map(analysisData.analyses.map((row) => [row.formation_id, row]));
  generalMap = new Map(catalog.generals.map((row) => [row.id, row]));
  document.querySelector(".top-edition").textContent = `S${selectedSeason} ／ 独立シミュレーター`;
  const generals = [...catalog.generals].sort((a, b) => (a.kana || a.name).localeCompare(b.kana || b.name, "ja"));
  $sim("#attacker-general").append(...generals.map((general) => new Option(`${general.name}（武勇 ${fmt.format(stat(general, "武勇"))}／知略 ${fmt.format(stat(general, "知略"))}）`, general.id)));
  const representative = [...formations].sort((a, b) => (analysisMap.get(b.id)?.base_danger_deviation || 0) - (analysisMap.get(a.id)?.base_danger_deviation || 0)).filter((row, index, rows) => rows.findIndex((candidate) => candidate.members[0].general_id === row.members[0].general_id) === index).slice(0, 20);
  $sim("#meta-formation").append(...representative.map((formation) => new Option(`要注意度 ${analysisMap.get(formation.id)?.base_danger_deviation ?? "—"}｜S${formation.season} ${formation.members[0].general_name}隊`, formation.id)));
  const eligibleTactics = catalog.tactics.filter((row) => DamageMath.preset(row).rate != null).sort((a, b) => a.name.localeCompare(b.name, "ja"));
  $sim("#damage-tactic").append(...eligibleTactics.map((tactic) => new Option(tactic.name, tactic.id)));
  renderFavorites();
  const requested = new URLSearchParams(location.search).get("tactic");
  if (requested && eligibleTactics.some((row) => row.id === requested)) { $sim("#damage-tactic").value = requested; applyTactic(); } else renderResult();
}
$sim("#attacker-general").addEventListener("change", updateAttacker);
$sim("#attack-axis").addEventListener("change", () => { $sim("#defense-axis").value = $sim("#attack-axis").value === "武勇" ? "統率" : "知略"; updateAttacker(); updateDefender(); });
$sim("#meta-formation").addEventListener("change", updateDefender);
$sim("#defense-axis").addEventListener("change", updateDefender);
$sim("#meta-limit-break").addEventListener("change", updateDefender);
$sim("#damage-tactic").addEventListener("change", applyTactic);
$sim("#favorite-toggle").addEventListener("click", () => { const id = $sim("#attacker-general").value; if (!id) return; favorites = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id]; saveFavorites(); renderFavorites(); syncFavoriteButton(); });
$sim("#favorite-generals").addEventListener("click", (event) => { const button = event.target.closest("[data-favorite-general]"); if (!button) return; $sim("#attacker-general").value = button.dataset.favoriteGeneral; updateAttacker(); $sim("#attacker-general").focus(); });
simForm.addEventListener("submit", (event) => { event.preventDefault(); renderResult(); });
simForm.addEventListener("input", renderResult);
simForm.addEventListener("reset", () => setTimeout(() => { syncFavoriteButton(); renderResult(); }, 0));
startSimulator().catch(() => { $sim("#simulator-error").hidden = false; $sim("#simulator-error").textContent = "資料を読み込めませんでした。通信状況を確認して再読み込みしてください。"; }).finally(() => { const loading = $sim("#app-loading"); if (!loading) return; loading.classList.add("is-complete"); setTimeout(() => loading.remove(), 240); });
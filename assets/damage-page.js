"use strict";
const DAMAGE_DATA_VERSION = document.documentElement.dataset.dataVersion || "1";
const versionedDamage = (path) =>
  path + (path.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(DAMAGE_DATA_VERSION);
const damageForm = document.querySelector("#damage-form");
const damageOutput = document.querySelector("#damage-output");
const damageError = document.querySelector("#damage-error");
const tacticPicker = document.querySelector("#damage-tactic");
const presetNote = document.querySelector("#preset-note");
const displayNumber = (v, digits = 2) =>
  new Intl.NumberFormat("ja-JP", { maximumFractionDigits: digits }).format(v);
let damageCatalog = [];

function renderDamage() {
  const values = {};
  for (const input of damageForm.querySelectorAll("input[name]"))
    values[input.name] = input.valueAsNumber;
  const result = DamageMath.calculate(values);
  if (!result.valid || !damageForm.checkValidity()) {
    damageOutput.replaceChildren();
    damageError.hidden = false;
    damageError.textContent =
      result.reason || "入力欄の範囲・刻みを確認してください。";
    if (Number.isFinite(result.before))
      damageError.textContent +=
        " 補正前の式の値：" + displayNumber(result.before);
    return;
  }
  damageError.hidden = true;
  const a = result.activations;
  const tile = (label, value, note, primary = false) =>
    `<div class="damage-result${primary ? " primary" : ""}"><span>${label}</span><b>${value}</b><small>${note}</small></div>`;
  damageOutput.innerHTML = `<div class="damage-results">${
    tile(
      "補正前の基礎兵刃",
      displayNumber(result.before),
      "戦法倍率・発動率を掛ける前",
    ) +
    tile(
      "補正後の基礎兵刃",
      displayNumber(result.after),
      "増加量 " +
        (result.increase >= 0 ? "＋" : "") +
        displayNumber(result.increase),
    ) +
    tile(
      "基礎兵刃の増加率",
      (result.increasePercent >= 0 ? "＋" : "") +
        displayNumber(result.increasePercent, 1) +
        "%",
      "丸める前の値から算出",
    ) +
    tile(
      "期待ダメージ",
      displayNumber(result.expected),
      values.turns + "ターン合計・対象1体",
      true,
    ) +
    tile(
      "下振れ（5%点）",
      displayNumber(result.lower),
      a.lower + "回の攻撃完了に相当",
    ) +
    tile(
      "上振れ（95%点）",
      displayNumber(result.upper),
      a.upper + "回の攻撃完了に相当",
    )
  }</div><div class="damage-breakdown"><p>補正なしの期待ダメージ：<strong>${displayNumber(result.expectedBefore)}</strong><br>
  1発動あたりの兵刃ダメージ：<strong>${displayNumber(result.perActivation)}</strong><br>
  1ターンあたりの期待ダメージ：<strong>${displayNumber(result.perTurn)}</strong></p>
  <p>平均攻撃完了回数：<strong>${displayNumber(a.mean)}回</strong><br>
  初回攻撃までの平均：<strong>${Number.isFinite(a.firstTurn) ? displayNumber(a.firstTurn) + "ターン" : "発動しない"}</strong><br>
  ${values.turns}ターン内に攻撃が完了しない確率：<strong>${displayNumber(a.zero * 100)}%</strong></p></div>
  <details class="damage-breakdown"><summary>攻撃完了回数ごとの確率</summary><div class="damage-distribution">${a.distribution.map((weight, count) => (weight > 0 ? `<div><span>${count}回</span><meter min="0" max="1" value="${weight}" aria-label="${count}回の確率">${displayNumber(weight * 100)}%</meter><span>${displayNumber(weight * 100)}%</span></div>` : "")).join("")}</div></details>`;
}

function chooseTactic(id) {
  const tactic = damageCatalog.find((t) => t.id === id);
  if (!tactic) {
    presetNote.textContent =
      "手動入力です。戦法の効果文に合わせて、倍率・発動率・準備・兵刃回数を設定してください。";
    return;
  }
  const p = DamageMath.preset(tactic);
  damageForm.elements.rate.value = p.rate ?? "";
  damageForm.elements.probability.value = p.probability ?? "";
  damageForm.elements.preparation.value = p.preparation;
  damageForm.elements.hits.value = 1;
  presetNote.textContent =
    tactic.name +
    "：" +
    p.scope +
    "。" +
    (p.eligible
      ? "発動条件が毎ターン成立する場合の試算です。"
      : "条件付き・複数回などの効果は自動反映しません。効果文を確認し、入力値を調整してください。") +
    (p.rate === null || p.probability === null
      ? " 未収録の数値は空欄です。手動で入力してください。"
      : "");
  const effect = document.createElement("span");
  effect.style.display = "block";
  effect.textContent = "効果：" + (tactic.effect || "未収録");
  presetNote.append(effect);
  renderDamage();
}
async function loadTactics() {
  let response = await fetch(versionedDamage("../../assets/database.live.json"), {
    cache: "force-cache",
  });
  if (response.status === 404)
    response = await fetch(versionedDamage("../../assets/database.json"), {
      cache: "force-cache",
    });
  if (!response.ok) throw new Error("Catalog unavailable");
  const data = await response.json();
  if (!Array.isArray(data.tactics)) throw new Error("Invalid catalog");
  damageCatalog = data.tactics;
  const requested = new URLSearchParams(location.search).get("tactic");
  for (const t of data.tactics
    .filter((t) => DamageMath.preset(t).rate !== null || t.id === requested)
    .sort((a, b) => a.name.localeCompare(b.name, "ja")))
    tacticPicker.append(new Option(t.name, t.id));
  if (requested) {
    if (damageCatalog.some((t) => t.id === requested)) {
      tacticPicker.value = requested;
      chooseTactic(requested);
    } else
      presetNote.textContent =
        "指定の戦法が見つかりません。現在は手動入力の値で試算しています。";
  }
}
damageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  renderDamage();
});
damageForm.addEventListener("input", renderDamage);
tacticPicker.addEventListener("change", () => chooseTactic(tacticPicker.value));
damageForm.addEventListener("reset", () =>
  setTimeout(() => {
    tacticPicker.value = "";
    presetNote.textContent = "初期値に戻しました。数値は手動でも変更できます。";
    renderDamage();
  }, 0),
);
renderDamage();
loadTactics().catch(() => {
  presetNote.textContent =
    "戦法データを読み込めませんでした。手動入力で試算できます。";
});

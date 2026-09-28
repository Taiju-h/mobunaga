(() => {
  'use strict';
  function calculate(v) {
    const factor = 1 + v.margin / 100;
    const capacity = v.siege * v.rounds;
    const siegeBase = Math.ceil(v.durability / capacity);
    const siegeTarget = Math.ceil(v.durability * factor / capacity);
    const mainTarget = v.guards === null ? null : Math.ceil(v.guards * factor / v.clears);
    return { siegeBase, siegeTarget, people: Math.ceil(siegeTarget / v.perPerson), mainTarget };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { calculate };
  if (typeof document === 'undefined') return;
  const form = document.getElementById('gate-form');
  const output = document.getElementById('gate-results');
  if (!form || !output) return;
  const fmt = n => n.toLocaleString('ja-JP');
  function bar(available, required) {
    const ratio = Math.min(100, available / required * 100);
    const gap = required - available;
    return `<p>予定 ${fmt(available)}隊 / 余裕込み目標 ${fmt(required)}隊 → ${gap > 0 ? `${fmt(gap)}隊不足` : `数の計画上は充足（${fmt(-gap)}隊余裕）`}</p><div class="bar" aria-hidden="true"><span style="width:${ratio}%"></span></div>`;
  }
  function render() {
    if (!form.checkValidity()) {
      output.textContent = '入力値を確認してください。空欄や範囲外の値があるため計算を停止しています（駐城部隊数だけは未入力でも構いません）。';
      return;
    }
    const v = {};
    for (const input of form.querySelectorAll('input')) v[input.name] = input.value === '' ? null : Number(input.value);
    const r = calculate(v);
    const siegeReady = v.siegeLevel >= 20 && v.siegeTroops >= 9000;
    const mainReady = v.mainLevel >= 35 && v.mainTroops >= 16500;
    output.innerHTML = `<article class="result-card"><h4>兵器の動員計画</h4><div class="big-number">${fmt(r.siegeTarget)}隊</div><p>余裕${v.margin}%込み / 理論上は${fmt(r.siegeBase)}隊。1人${v.perPerson}隊なら${fmt(r.people)}人。</p>${bar(v.availableSiege, r.siegeTarget)}<p>設定：武将Lv${v.siegeLevel}・${fmt(v.siegeTroops)}兵 / 攻城値${fmt(v.siege)} × ${v.rounds}回。</p><p class="warning">${siegeReady ? 'Lv20・9,000兵という旧シーズンの参考条件は満たしています。ただしS4での完走は未検証です。' : '旧シーズンの参考条件（Lv20・9,000兵）を下回っています。指定回数の完走を前提に動員数へ算入する前に、戦報を確認してください。'} レベル・兵力を変えても、攻城値と完走回数は自動変更されません。</p></article><article class="result-card"><h4>殲滅の動員計画</h4>${r.mainTarget === null ? '<p><b>関所の実際の駐城部隊数を入力すると必要数を表示します。</b></p>' : `<div class="big-number">${fmt(r.mainTarget)}隊</div><p>守軍${v.guards}隊 / 主力1隊で${v.clears}隊分を処理する仮定 / 余裕${v.margin}%。</p>${bar(v.availableMain, r.mainTarget)}`}<p>設定：武将Lv${v.mainLevel}・${fmt(v.mainTroops)}兵。</p><p class="warning">${mainReady ? '当サイトの暫定育成目標（Lv35・16,500兵）には到達。' : '当サイトの暫定育成目標（Lv35・16,500兵）には未到達。'} この判定は関所での勝利・低損・安全を示しません。処理隊数相当は実際の同関所の戦報で調整してください。</p></article>`;
  }
  form.addEventListener('input', render);
  form.addEventListener('submit', e => e.preventDefault());
  form.addEventListener('reset', () => setTimeout(render, 0));
  render();
})();

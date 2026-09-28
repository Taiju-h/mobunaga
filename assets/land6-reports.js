(() => {
  'use strict';
  function matches(report, enemies, allies, result) {
    return (!enemies.size || enemies.has(report.enemy)) &&
      (!allies.size || report.allies.some(id => allies.has(id))) &&
      (!result || report.result === result);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { matches };
  if (typeof document === 'undefined') return;
  const enemies = new Set(), allies = new Set();
  const cards = [...document.querySelectorAll('[data-report]')];
  const buttons = [...document.querySelectorAll('.face-filter')];
  const resultSelect = document.getElementById('battle-result');
  const status = document.getElementById('battle-status');
  function render() {
    let count = 0;
    cards.forEach(card => {
      const row = { enemy: card.dataset.enemy, allies: card.dataset.allies.split(' '), result: card.dataset.result };
      card.hidden = !matches(row, enemies, allies, resultSelect.value);
      if (!card.hidden) count++;
    });
    buttons.forEach(button => button.setAttribute('aria-pressed', String((button.dataset.group === 'enemy' ? enemies : allies).has(button.dataset.general))));
    status.textContent = `${count} / ${cards.length}件 · 敵大将 ${enemies.size}名 / 自軍武将 ${allies.size}名を選択`;
    document.getElementById('no-battles').hidden = count > 0;
  }
  buttons.forEach(button => button.addEventListener('click', () => {
    const selected = button.dataset.group === 'enemy' ? enemies : allies;
    const id = button.dataset.general;
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    render();
  }));
  resultSelect.addEventListener('change', render);
  document.getElementById('clear-battles').addEventListener('click', () => {
    enemies.clear(); allies.clear(); resultSelect.value = ''; render();
  });
  render();
})();

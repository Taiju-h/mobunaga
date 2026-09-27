(() => {
  const form = document.querySelector('[data-filters]');
  if (!form) return;
  const cards = [...document.querySelectorAll('[data-enemy]')];
  const status = document.querySelector('[data-status]');
  const empty = document.querySelector('[data-empty]');
  const update = () => {
    const query = form.elements.query.value.trim().normalize('NFKC');
    const troop = form.elements.troop.value;
    const risk = form.elements.risk.value;
    let count = 0;
    for (const card of cards) {
      const shown = (!query || card.textContent.normalize('NFKC').includes(query))
        && (!troop || card.dataset.troop === troop)
        && (!risk || card.dataset.risks.split(',').includes(risk));
      card.hidden = !shown;
      if (shown) count++;
    }
    status.textContent = `${count} / ${cards.length} 編成を表示 · 簡単 → 困難`;
    empty.hidden = count !== 0;
  };
  form.addEventListener('input', update);
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('reset', () => setTimeout(update, 0));
  update();
})();

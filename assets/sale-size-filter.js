(() => {
  const sizeOrder = ['xxs', 'xs', 's', 's/m', 'm', 'm/l', 'l', 'l/xl', 'xl', 'xxl'];

  function init() {
    const filter = document.querySelector('[data-sale-size-filter]');
    const results = filter?.closest('results-list');
    const cards = [...(results?.querySelectorAll('.product-grid__item[data-sale-variants]') || [])];
    if (!filter || !results || !cards.length) return;

    const available = new Set();
    const entries = cards.map((card) => {
      const variants = new Map();
      for (const pair of card.dataset.saleVariants.split('|')) {
        const [rawSize, id] = pair.trim().split(':');
        const size = rawSize?.trim().toLowerCase();
        if (!size || !id) continue;
        available.add(size);
        if (!variants.has(size)) variants.set(size, id.trim());
      }
      return { card, variants };
    });

    const label = document.createElement('span');
    label.className = 'sale-size-filter__label';
    label.textContent = 'Shop sale by available size';
    const choices = document.createElement('div');
    choices.className = 'sale-size-filter__choices';
    const count = document.createElement('span');
    count.className = 'sale-size-filter__count';
    count.setAttribute('aria-live', 'polite');
    const sizes = [...available].sort((a, b) => {
      const ai = sizeOrder.indexOf(a);
      const bi = sizeOrder.indexOf(b);
      return (ai < 0 ? 100 : ai) - (bi < 0 ? 100 : bi) || a.localeCompare(b);
    });

    function apply() {
      const selected = new URL(window.location.href).searchParams.get('sale_size')?.trim().toLowerCase() || '';
      let visible = 0;
      for (const { card, variants } of entries) {
        const match = !selected || variants.has(selected);
        card.hidden = !match;
        if (match) visible++;
        for (const link of card.querySelectorAll('.tcc-card__link, .tcc-card__title')) {
          if (!link.dataset.saleOriginalHref) link.dataset.saleOriginalHref = link.href;
          const url = new URL(link.dataset.saleOriginalHref);
          if (selected && variants.has(selected)) url.searchParams.set('variant', variants.get(selected));
          link.href = url.href;
        }
      }
      results.toggleAttribute('data-sale-size-active', !!selected);
      count.textContent = `${visible} ${visible === 1 ? 'item' : 'items'} available${selected ? ` in ${selected.toUpperCase()}` : ''}`;
      for (const button of choices.querySelectorAll('button')) {
        button.setAttribute('aria-pressed', String(button.dataset.size === selected));
      }
    }

    for (const size of ['', ...sizes]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.size = size;
      button.textContent = size ? size.toUpperCase() : 'All sizes';
      button.addEventListener('click', () => {
        const url = new URL(window.location.href);
        if (size) url.searchParams.set('sale_size', size);
        else url.searchParams.delete('sale_size');
        history.pushState({}, '', url);
        apply();
      });
      choices.append(button);
    }
    filter.replaceChildren(label, choices, count);
    apply();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  window.addEventListener('popstate', init);
  document.addEventListener('shopify:section:load', init);
  document.addEventListener('shopify:collection:update', (event) => {
    if (event.promise?.then) event.promise.then(init);
    else requestAnimationFrame(init);
  });
})();

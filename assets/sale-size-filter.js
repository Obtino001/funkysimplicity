// Size filtering that respects stock.
// Shopify's native "Size" filter (filter.v.option.size) returns every product that *has* the
// size, even when it is sold out. Each grid card carries its in-stock size -> variant pairs
// (data-size-variants), so when a size is selected — via the native filter or the sale page
// pills (?sale_size=) — we hide cards where that size is sold out and link the rest straight
// to the in-stock variant.
(() => {
  const sizeOrder = ['xxs', 'xs', 's', 's/m', 'm', 'm/l', 'l', 'l/xl', 'xl', 'xxl'];

  function parseVariants(card) {
    const variants = new Map();
    for (const pair of (card.dataset.sizeVariants || '').split('|')) {
      const [rawSize, id] = pair.trim().split(':');
      const size = rawSize?.trim().toLowerCase();
      if (!size || !id) continue;
      if (!variants.has(size)) variants.set(size, id.trim());
    }
    return variants;
  }

  function selectedSizes() {
    const params = new URL(window.location.href).searchParams;
    const sizes = [];
    for (const [key, value] of params) {
      const isNativeSize = key.startsWith('filter.v.option.') && /size|maat/i.test(key);
      if (isNativeSize || key === 'sale_size') sizes.push(value.trim().toLowerCase());
    }
    return sizes.filter(Boolean);
  }

  function apply() {
    const results = document.querySelector('results-list');
    if (!results) return;
    const selected = selectedSizes();
    let visible = 0;

    for (const card of results.querySelectorAll('.product-grid__item[data-size-variants]')) {
      const variants = parseVariants(card);
      const match = selected.find((size) => variants.has(size));
      const show = !selected.length || !!match;
      if (card.hidden === show) card.hidden = !show;
      if (show) visible++;

      for (const link of card.querySelectorAll('.tcc-card__link, .tcc-card__title')) {
        if (!link.dataset.originalHref) link.dataset.originalHref = link.href;
        const url = new URL(link.dataset.originalHref);
        if (match) url.searchParams.set('variant', variants.get(match));
        if (link.href !== url.href) link.href = url.href;
      }
    }

    if (results.hasAttribute('data-size-filter-active') !== selected.length > 0) {
      results.toggleAttribute('data-size-filter-active', selected.length > 0);
    }
    renderSalePills(results, selected, visible);
  }

  function renderSalePills(results, selected, visible) {
    const filter = results.querySelector('[data-sale-size-filter]');
    if (!filter) return;

    const available = new Set();
    for (const card of results.querySelectorAll('.product-grid__item[data-size-variants]')) {
      for (const size of parseVariants(card).keys()) available.add(size);
    }
    const sizes = [...available].sort((a, b) => {
      const ai = sizeOrder.indexOf(a);
      const bi = sizeOrder.indexOf(b);
      return (ai < 0 ? 100 : ai) - (bi < 0 ? 100 : bi) || a.localeCompare(b);
    });
    const current = new URL(window.location.href).searchParams.get('sale_size')?.trim().toLowerCase() || '';

    const label = document.createElement('span');
    label.className = 'sale-size-filter__label';
    label.textContent = 'Shop sale by available size';
    const choices = document.createElement('div');
    choices.className = 'sale-size-filter__choices';
    for (const size of ['', ...sizes]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.size = size;
      button.textContent = size ? size.toUpperCase() : 'All sizes';
      button.setAttribute('aria-pressed', String(size === current));
      button.addEventListener('click', () => {
        const url = new URL(window.location.href);
        if (size) url.searchParams.set('sale_size', size);
        else url.searchParams.delete('sale_size');
        history.pushState({}, '', url);
        apply();
      });
      choices.append(button);
    }
    const count = document.createElement('span');
    count.className = 'sale-size-filter__count';
    count.setAttribute('aria-live', 'polite');
    const shown = selected.map((s) => s.toUpperCase()).join(' / ');
    count.textContent = `${visible} ${visible === 1 ? 'item' : 'items'} available${shown ? ` in ${shown}` : ''}`;
    filter.replaceChildren(label, choices, count);
  }

  // Filters, sorting and infinite scroll re-render the grid in place without a page load,
  // so re-apply whenever product cards are added or re-rendered.
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  }

  function start() {
    apply();
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes') return schedule();
        for (const node of m.addedNodes) {
          if (node instanceof Element && (node.matches('.product-grid__item') || node.querySelector('.product-grid__item'))) {
            return schedule();
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-size-variants', 'hidden'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('popstate', schedule);
  document.addEventListener('shopify:section:load', schedule);
})();

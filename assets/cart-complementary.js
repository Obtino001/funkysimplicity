/**
 * `<cart-complementary-panel>` — the "You may also like" panel beside the cart
 * drawer.
 *
 * Complementary products are configured per product in the Shopify
 * Search & Discovery app, so the recommendations route is queried once per cart
 * line. Results are merged, de-duplicated, and stripped of anything already in
 * the cart; if nothing is left the panel stays hidden.
 *
 * Option selection and add-to-cart are handled by the delegated listeners in
 * `cart-drawer-recommendations.js`, which this element notifies by dispatching
 * `cart:recommendations:rendered` once its cards are in the DOM.
 */

class CartComplementaryPanel extends HTMLElement {
  /** @type {AbortController | null} */
  #controller = null;

  connectedCallback() {
    this.#load();
  }

  disconnectedCallback() {
    this.#controller?.abort();
  }

  /**
   * Requests one recommendations section for a single seed product.
   * @param {string} productId
   * @param {AbortSignal} signal
   * @returns {Promise<Element[]>}
   */
  async #fetchFor(productId, signal) {
    const { url, limit, intent, sectionId } = this.dataset;

    const endpoint = new URL(url ?? '/recommendations/products', window.location.origin);
    endpoint.searchParams.set('product_id', productId);
    endpoint.searchParams.set('limit', limit || '6');
    endpoint.searchParams.set('intent', intent || 'complementary');
    endpoint.searchParams.set('section_id', sectionId || 'cart-complementary-products');

    const response = await fetch(endpoint, { signal });
    if (!response.ok) return [];

    const markup = await response.text();
    const document_ = new DOMParser().parseFromString(markup, 'text/html');

    return [...document_.querySelectorAll('.cart-complementary-card')];
  }

  async #load() {
    const target = this.querySelector('[data-complementary-target]');
    const seedIds = (this.dataset.productIds || '').split(',').filter(Boolean);
    if (!(target instanceof HTMLElement) || seedIds.length === 0) return;

    this.#controller?.abort();
    this.#controller = new AbortController();
    const { signal } = this.#controller;

    const excluded = new Set((this.dataset.excludeIds || '').split(',').filter(Boolean));
    const limit = Number(this.dataset.limit || 6);

    try {
      const batches = await Promise.all(
        seedIds.map((id) => this.#fetchFor(id, signal).catch(() => /** @type {Element[]} */ ([])))
      );

      /** @type {Element[]} */
      const cards = [];
      const seen = new Set();

      // Round-robin across seeds so every cart line contributes before any repeats.
      const depth = Math.max(...batches.map((batch) => batch.length), 0);

      for (let index = 0; index < depth && cards.length < limit; index++) {
        for (const batch of batches) {
          if (cards.length >= limit) break;

          const card = batch[index];
          if (!(card instanceof HTMLElement)) continue;

          const id = card.dataset.productId ?? '';
          if (!id || seen.has(id) || excluded.has(id)) continue;

          seen.add(id);
          cards.push(card);
        }
      }

      if (cards.length === 0) return;

      const list = document.createElement('div');
      list.className = 'cart-complementary__list';
      list.append(...cards);

      target.replaceChildren(list);
      this.hidden = false;

      this.dispatchEvent(new CustomEvent('cart:recommendations:rendered', { bubbles: true }));
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') console.error(error);
    }
  }
}

if (!customElements.get('cart-complementary-panel')) {
  customElements.define('cart-complementary-panel', CartComplementaryPanel);
}

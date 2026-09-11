/**
 * Cart drawer extras.
 *
 * - `<cart-drawer-recommendations>` fetches the "Compare your style" list from
 *   the product recommendations route and renders it inside the drawer.
 * - Delegated handlers drive the image carousels (cart lines + recommendations),
 *   the recommendation variant pickers, and their add-to-cart buttons.
 *
 * Written without theme imports so it can be loaded from any drawer render.
 */

const SELECTED = 'is-selected';

/**
 * Shopify `money` in JSON keeps HTML entities (`&euro;`). textContent prints them raw.
 * @param {string} value
 * @returns {string}
 */
function decodeMoney(value) {
  if (!value) return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

/* -------------------------------------------------------------------------- */
/* Media carousels                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Moves a `[data-media-carousel]` track by one slide.
 * @param {HTMLElement} carousel
 * @param {number} direction -1 for previous, 1 for next.
 */
function moveCarousel(carousel, direction) {
  const track = carousel.querySelector('[data-media-track]');
  if (!(track instanceof HTMLElement)) return;

  const count = track.children.length;
  if (count < 2) return;

  const current = Number(carousel.dataset.mediaIndex || 0);
  const next = (current + direction + count) % count;

  carousel.dataset.mediaIndex = String(next);
  track.style.transform = `translateX(${next * -100}%)`;
}

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const button = target?.closest('[data-media-prev], [data-media-next]');
  if (!(button instanceof HTMLElement)) return;

  const carousel = button.closest('[data-media-carousel]');
  if (!(carousel instanceof HTMLElement)) return;

  event.preventDefault();
  event.stopPropagation();
  moveCarousel(carousel, button.hasAttribute('data-media-next') ? 1 : -1);
});

/* -------------------------------------------------------------------------- */
/* Recommendation variant pickers                                             */
/* -------------------------------------------------------------------------- */

/**
 * Reads the variant payload embedded in a recommendation card.
 * @param {HTMLElement} card
 * @returns {Array<{id: number, available: boolean, options: string[], price: string}>}
 */
function readVariants(card) {
  const script = card.querySelector('[data-recommendation-variants]');
  if (!script) return [];

  try {
    return JSON.parse(script.textContent || '[]');
  } catch {
    return [];
  }
}

/**
 * Returns the currently selected option value for each option position.
 * @param {HTMLElement} card
 * @returns {string[]}
 */
function readSelection(card) {
  const groups = [...card.querySelectorAll('[data-option-position]')];
  const selection = [];

  for (const group of groups) {
    const position = Number(group.getAttribute('data-option-position') || 0);
    const selected = group.querySelector(`.${SELECTED}`);
    if (position > 0) selection[position - 1] = selected?.getAttribute('data-option-value') ?? '';
  }

  return selection;
}

/**
 * Syncs price, availability and the add button to the current selection.
 * @param {HTMLElement} card
 */
function updateCard(card) {
  const variants = readVariants(card);
  const selection = readSelection(card);
  const match = variants.find((variant) => selection.every((value, index) => variant.options[index] === value));

  const price = card.querySelector('[data-recommendation-price]');
  if (price && match) price.textContent = decodeMoney(match.price);

  // Compare-at price and savings pill only exist on the complementary cards.
  const compare = card.querySelector('[data-recommendation-compare]');
  const savings = card.querySelector('[data-recommendation-savings]');
  const discounted = Boolean(match?.savings && match.savings !== match.price && match.compare_at_price);

  if (compare instanceof HTMLElement) {
    compare.hidden = !discounted;
    if (discounted && match) compare.textContent = decodeMoney(match.compare_at_price);
  }

  if (savings instanceof HTMLElement) {
    savings.hidden = !discounted;
    if (discounted && match) savings.textContent = `Save ${decodeMoney(match.savings)}`;
  }

  const addButton = card.querySelector('[data-recommendation-add]');
  if (addButton instanceof HTMLElement) {
    const available = Boolean(match?.available);
    addButton.dataset.variantId = match ? String(match.id) : '';
    addButton.setAttribute('aria-disabled', available ? 'false' : 'true');
  }

  // Cross out option values that have no available variant given the rest of the selection.
  for (const group of card.querySelectorAll('[data-option-position]')) {
    const position = Number(group.getAttribute('data-option-position') || 0);
    if (position < 1) continue;

    for (const button of group.querySelectorAll('[data-option-value]')) {
      const value = button.getAttribute('data-option-value') ?? '';
      const candidate = selection.slice();
      candidate[position - 1] = value;

      const reachable = variants.some(
        (variant) =>
          variant.available && candidate.every((selected, index) => !selected || variant.options[index] === selected)
      );

      button.classList.toggle('is-unavailable', !reachable);
    }
  }
}

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const button = target?.closest('[data-option-value]');
  if (!(button instanceof HTMLElement)) return;

  const group = button.closest('[data-option-position]');
  const card = button.closest('[data-cart-recommendation]');
  if (!(group instanceof HTMLElement) || !(card instanceof HTMLElement)) return;

  event.preventDefault();

  for (const sibling of group.querySelectorAll('[data-option-value]')) {
    const isTarget = sibling === button;
    sibling.classList.toggle(SELECTED, isTarget);
    sibling.setAttribute('aria-pressed', isTarget ? 'true' : 'false');
  }

  updateCard(card);
});

/* -------------------------------------------------------------------------- */
/* Add to cart from a recommendation                                          */
/* -------------------------------------------------------------------------- */

/**
 * Re-renders the cart drawer contents in place, keeping the dialog open.
 */
async function refreshCartDrawer() {
  const inner = document.querySelector('[data-hydration-key="cart-drawer-inner"]');
  if (!(inner instanceof HTMLElement)) return;

  const root = window.Shopify?.routes?.root ?? '/';
  const response = await fetch(`${root}?section_id=cart-drawer-section`);
  if (!response.ok) return;

  const markup = await response.text();
  const fresh = new DOMParser()
    .parseFromString(markup, 'text/html')
    .querySelector('[data-hydration-key="cart-drawer-inner"]');

  if (fresh instanceof HTMLElement) {
    inner.className = fresh.className;
    inner.replaceChildren(...fresh.childNodes);
  }
}

document.addEventListener('click', async (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const button = target?.closest('[data-recommendation-add]');
  if (!(button instanceof HTMLElement)) return;

  event.preventDefault();

  const variantId = button.dataset.variantId;
  if (!variantId || button.getAttribute('aria-disabled') === 'true' || button.classList.contains('is-loading')) return;

  const host = button.closest('cart-drawer-recommendations, cart-complementary-panel');
  const addUrl = host instanceof HTMLElement ? host.dataset.cartAddUrl || '/cart/add' : '/cart/add';

  button.classList.add('is-loading');

  try {
    const response = await fetch(`${addUrl}.js`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [{ id: Number(variantId), quantity: 1 }] }),
    });

    if (!response.ok) throw new Error(`Add to cart failed: ${response.status}`);

    document.dispatchEvent(new CustomEvent('cart:update', { bubbles: true }));

    // The item is in the cart now, so it no longer belongs in the side panel.
    const card = button.closest('.cart-complementary-card');
    if (card instanceof HTMLElement) card.remove();

    await refreshCartDrawer();
  } catch (error) {
    console.error(error);
  } finally {
    button.classList.remove('is-loading');
  }
});

/* -------------------------------------------------------------------------- */
/* <cart-drawer-recommendations>                                              */
/* -------------------------------------------------------------------------- */

class CartDrawerRecommendations extends HTMLElement {
  /** @type {AbortController | null} */
  #controller = null;

  connectedCallback() {
    this.#load();
  }

  /** Re-fetch after the cart drawer is hydrated following a cart update. */
  refresh() {
    this.#load();
  }

  disconnectedCallback() {
    this.#controller?.abort();
  }

  async #load() {
    const { url, productId, limit, sectionId } = this.dataset;
    const target = this.querySelector('[data-recommendations-target]');
    if (!url || !productId || !(target instanceof HTMLElement)) return;

    this.#controller?.abort();
    this.#controller = new AbortController();

    const endpoint = new URL(url, window.location.origin);
    endpoint.searchParams.set('product_id', productId);
    endpoint.searchParams.set('limit', limit || '4');
    endpoint.searchParams.set('section_id', sectionId || 'cart-drawer-recommendations');

    try {
      const response = await fetch(endpoint, { signal: this.#controller.signal });
      if (!response.ok) return;

      const markup = await response.text();
      const list = new DOMParser().parseFromString(markup, 'text/html').querySelector('.cart-recommendations__list');
      if (!list) return;

      target.replaceChildren(list);
      this.hidden = false;

      for (const card of this.querySelectorAll('[data-cart-recommendation]')) {
        if (card instanceof HTMLElement) updateCard(card);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') console.error(error);
    }
  }
}

// The cart drawer updates its markup through Shopify hydration, which can
// preserve an already-connected custom element. In that path
// `connectedCallback` does not run again, so re-request recommendations once
// the refreshed cart markup is in the DOM. A hard page reload used to be the
// only way to make "Compare Your Style" return.
function refreshDrawerRecommendations() {
  window.setTimeout(() => {
    document.querySelectorAll('cart-drawer-recommendations').forEach((element) => {
      if (element instanceof CartDrawerRecommendations && element.isConnected) element.refresh();
    });
  }, 350);
}

document.addEventListener('cart:updated', refreshDrawerRecommendations);
document.addEventListener('shopify:cart:lines-update', refreshDrawerRecommendations);

/**
 * Other modules render cards sharing the `data-cart-recommendation` contract and
 * announce them here so option availability is applied by the same code path.
 */
document.addEventListener('cart:recommendations:rendered', (event) => {
  const root = event.target instanceof Element ? event.target : document;

  for (const card of root.querySelectorAll('[data-cart-recommendation]')) {
    if (card instanceof HTMLElement) updateCard(card);
  }
});

if (!customElements.get('cart-drawer-recommendations')) {
  customElements.define('cart-drawer-recommendations', CartDrawerRecommendations);
}

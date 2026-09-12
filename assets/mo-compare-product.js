class MoCompareProduct extends HTMLElement {
  constructor() {
    super();
    this.controller = null;
  }

  connectedCallback() {
    this.loadRecommendations();
  }

  disconnectedCallback() {
    this.controller?.abort();
  }

  async loadRecommendations() {
    const target = this.querySelector('[data-mo-compare-recommendations]');
    const { productId, url, sectionId, limit } = this.dataset;

    if (!(target instanceof HTMLElement) || !productId || !url) return;

    this.controller?.abort();
    this.controller = new AbortController();

    const endpoint = new URL(url, window.location.origin);
    endpoint.searchParams.set('product_id', productId);
    endpoint.searchParams.set('limit', limit || '8');
    endpoint.searchParams.set('section_id', sectionId || 'mo-compare-recommendations');
    endpoint.searchParams.set('intent', 'related');

    try {
      const response = await fetch(endpoint, { signal: this.controller.signal });
      if (!response.ok) throw new Error(`Compare recommendations failed: ${response.status}`);

      const markup = await response.text();
      const source = new DOMParser()
        .parseFromString(markup, 'text/html')
        .querySelector('[data-mo-compare-recommendations]');

      if (!(source instanceof HTMLElement) || !source.innerHTML.trim()) {
        target.replaceChildren();
        return;
      }

      target.replaceChildren(...source.childNodes);
      this.dispatchEvent(new CustomEvent('cart:recommendations:rendered', { bubbles: true }));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error(error);
      target.replaceChildren();
    }
  }
}

if (!customElements.get('mo-compare-product')) {
  customElements.define('mo-compare-product', MoCompareProduct);
}

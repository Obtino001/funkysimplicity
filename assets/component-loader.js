/**
 * Loads optional custom-element modules only when their markup is present.
 * The observer also covers quick-add content and Shopify theme-editor renders.
 */
const componentModules = new Map([
  ['accordion-custom', () => import('@theme/accordion-custom')],
  ['deferred-media, product-model', () => import('@theme/media')],
  ['product-price', () => import('@theme/product-price')],
  ['product-sku-component', () => import('@theme/product-sku')],
  ['product-inventory', () => import('@theme/product-inventory')],
  ['show-more-component', () => import('@theme/show-more')],
  ['slideshow-component', () => import('@theme/slideshow')],
  ['layered-slideshow-component', () => import('@theme/layered-slideshow')],
  ['anchored-popover-component', () => import('@theme/anchored-popover')],
  ['floating-panel-component', () => import('@theme/floating-panel')],
  ['video-background-component', () => import('@theme/video-background')],
  ['quantity-selector-component', () => import('@theme/component-quantity-selector')],
  ['media-gallery', () => import('@theme/media-gallery')],
  ['rte-formatter', () => import('@theme/rte-formatter')],
  ['volume-pricing', () => import('@theme/volume-pricing')],
  ['price-per-item', () => import('@theme/price-per-item')],
  ['volume-pricing-info', () => import('@theme/volume-pricing-info')],
  [
    'localization-form-component, dropdown-localization-component, drawer-localization-component',
    () => import('@theme/localization'),
  ],
]);

const requestedModules = new Set();

/** @param {ParentNode | Element} root */
function loadComponentsWithin(root) {
  for (const [selector, loadModule] of componentModules) {
    if (requestedModules.has(selector)) continue;

    const rootMatches = root instanceof Element && root.matches(selector);
    if (!rootMatches && !root.querySelector(selector)) continue;

    requestedModules.add(selector);
    loadModule().catch((error) => {
      requestedModules.delete(selector);
      console.error(`Unable to load component module for ${selector}`, error);
    });
  }
}

loadComponentsWithin(document);

const componentObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node instanceof Element) loadComponentsWithin(node);
    }
  }
});

componentObserver.observe(document.documentElement, { childList: true, subtree: true });

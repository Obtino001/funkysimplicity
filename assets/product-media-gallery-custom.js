class MoProductGallery extends HTMLElement {
  #activeIndex = 0;
  #touchStartX = 0;
  #touchStartY = 0;

  connectedCallback() {
    if (this.hasAttribute('data-initialized')) return;

    this.main = this.querySelector('.mo-product-main-slider');
    this.slides = Array.from(this.querySelectorAll('.mo-main-slide'));
    this.thumbnails = Array.from(this.querySelectorAll('.mo-thumb-slide'));
    this.previousButton = this.querySelector('[data-gallery-previous]');
    this.nextButton = this.querySelector('[data-gallery-next]');

    if (!this.main || !this.slides.length) return;

    this.setAttribute('data-initialized', '');
    this.previousButton?.addEventListener('click', this.#showPrevious);
    this.nextButton?.addEventListener('click', this.#showNext);
    this.thumbnails.forEach((thumbnail) => thumbnail.addEventListener('click', this.#selectThumbnail));
    this.main.addEventListener('touchstart', this.#onTouchStart, { passive: true });
    this.main.addEventListener('touchend', this.#onTouchEnd, { passive: true });
    document.addEventListener('click', this.#selectVariantMedia);

    this.#show(0, false);
    this.main.classList.add('is-ready');
  }

  disconnectedCallback() {
    this.previousButton?.removeEventListener('click', this.#showPrevious);
    this.nextButton?.removeEventListener('click', this.#showNext);
    this.thumbnails?.forEach((thumbnail) => thumbnail.removeEventListener('click', this.#selectThumbnail));
    this.main?.removeEventListener('touchstart', this.#onTouchStart);
    this.main?.removeEventListener('touchend', this.#onTouchEnd);
    document.removeEventListener('click', this.#selectVariantMedia);
    this.removeAttribute('data-initialized');
  }

  #showPrevious = () => this.#show(this.#activeIndex - 1);

  #showNext = () => this.#show(this.#activeIndex + 1);

  #selectThumbnail = (event) => {
    const index = Number(event.currentTarget.dataset.index);
    if (Number.isInteger(index)) this.#show(index);
  };

  #selectVariantMedia = (event) => {
    if (!(event.target instanceof Element)) return;

    const swatch = event.target.closest('.hammock-swatch');
    const mediaId = swatch?.dataset.variantMediaId;
    if (!mediaId) return;

    const index = this.slides.findIndex((slide) => slide.dataset.mediaId === mediaId);
    if (index >= 0) this.#show(index);
  };

  #onTouchStart = (event) => {
    this.#touchStartX = event.changedTouches[0]?.clientX ?? 0;
    this.#touchStartY = event.changedTouches[0]?.clientY ?? 0;
  };

  #onTouchEnd = (event) => {
    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - this.#touchStartX;
    const deltaY = touch.clientY - this.#touchStartY;
    if (Math.abs(deltaX) < 50 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    this.#show(deltaX > 0 ? this.#activeIndex - 1 : this.#activeIndex + 1);
  };

  #show(index, scrollThumbnail = true) {
    const lastIndex = this.slides.length - 1;
    const nextIndex = Math.max(0, Math.min(index, lastIndex));

    this.slides[this.#activeIndex]?.querySelectorAll('video').forEach((video) => video.pause());
    this.#activeIndex = nextIndex;

    this.slides.forEach((slide, slideIndex) => {
      const active = slideIndex === nextIndex;
      slide.classList.toggle('is-active', active);
      slide.hidden = !active;
      slide.setAttribute('aria-hidden', String(!active));
    });

    this.thumbnails.forEach((thumbnail, thumbnailIndex) => {
      const active = thumbnailIndex === nextIndex;
      thumbnail.classList.toggle('is-active', active);
      if (active) thumbnail.setAttribute('aria-current', 'true');
      else thumbnail.removeAttribute('aria-current');
    });

    if (scrollThumbnail) {
      this.thumbnails[nextIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }

    if (this.previousButton) this.previousButton.disabled = nextIndex === 0;
    if (this.nextButton) this.nextButton.disabled = nextIndex === lastIndex;
  }
}

if (!customElements.get('mo-product-gallery')) {
  customElements.define('mo-product-gallery', MoProductGallery);
}

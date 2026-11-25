import { api } from '../shared/api.js';

// Used only when the server settings or the chosen picture cannot be loaded.
const FALLBACK_IMAGE = '/images/hero-placeholder.svg';

export async function initHero() {
  initParallax();
  const img = document.getElementById('hero-image');
  img.addEventListener('load', () => img.classList.add('is-loaded'));
  img.addEventListener('error', () => {
    if (!img.src.endsWith(FALLBACK_IMAGE)) img.src = FALLBACK_IMAGE;
  });
  try {
    img.src = (await api('/settings')).heroImage;
  } catch {
    img.src = FALLBACK_IMAGE;
  }
}

function initParallax() {
  const layers = [...document.querySelectorAll('[data-parallax]')];
  const hero = document.querySelector('.hero');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let queued = false;

  const draw = () => {
    queued = false;
    const y = reduced.matches ? 0 : Math.min(window.scrollY, hero.offsetHeight);
    for (const layer of layers) {
      layer.style.transform = `translate3d(0, ${(y * Number(layer.dataset.parallax)).toFixed(1)}px, 0)`;
    }
  };
  addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(draw);
  }, { passive: true });
  reduced.addEventListener('change', draw);
  draw();
}

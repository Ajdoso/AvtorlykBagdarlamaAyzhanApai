import { initHero } from './hero.js';
import { initLibrary } from './library.js';
import { initTopics } from './topics.js';

function initHeader() {
  const header = document.getElementById('site-header');
  const button = document.getElementById('menu-button');
  const nav = document.getElementById('site-nav');
  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
  };
  button.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  nav.addEventListener('click', (event) => { if (event.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      setOpen(false);
      button.focus();
    }
  });
  const update = () => header.classList.toggle('is-solid', window.scrollY > 40);
  addEventListener('scroll', update, { passive: true });
  update();
}

function initReveal() {
  if (!('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('js');
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
}

initHeader();
initReveal();
initTopics();
initLibrary();
initHero();

import { h } from './utils.js';

const PATH = 'M12 2.600l2.900 5.900 6.500.950-4.700 4.600 1.100 6.450L12 17.450 6.200 20.500l1.100-6.450-4.700-4.600 6.500-.950z';

function star(on) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', on ? 'star is-on' : 'star');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', PATH);
  svg.append(path);
  return svg;
}

// Read-only rating.
export function stars(rating) {
  const filled = Math.round(rating);
  return h('span', { class: 'stars', role: 'img', 'aria-label': `5 жұлдыздан ${String(rating).replace('.', ',')}` },
    [1, 2, 3, 4, 5].map((n) => star(n <= filled)));
}

// Five radio buttons that look like stars.
export function starInput(name, value) {
  const labels = ['Нашар', 'Орташадан төмен', 'Орташа', 'Жақсы', 'Өте жақсы'];
  const note = h('span', { class: 'star-note' }, value ? labels[value - 1] : 'Жұлдызшаны таңдаңыз');
  const options = [1, 2, 3, 4, 5].map((n) => {
    const input = h('input', { type: 'radio', name, value: n, 'aria-label': `${n} жұлдыз, ${labels[n - 1].toLowerCase()}` });
    input.checked = n === value;
    return h('label', { class: 'star-option' }, input, star(n <= (value ?? 0)));
  });
  const paint = (n) => options.forEach((o, i) => o.lastChild.classList.toggle('is-on', i < n));
  const chosen = () => options.findIndex((o) => o.firstChild.checked) + 1;
  const group = h('div', { class: 'star-input' }, options);
  group.addEventListener('change', () => {
    paint(chosen());
    note.textContent = labels[chosen() - 1];
  });
  group.addEventListener('pointerover', (event) => {
    const index = options.indexOf(event.target.closest('.star-option'));
    if (index >= 0 && event.pointerType === 'mouse') paint(index + 1);
  });
  group.addEventListener('pointerleave', () => paint(chosen()));
  return h('fieldset', { class: 'star-field' }, h('legend', {}, 'Бағаңыз'), group, note);
}

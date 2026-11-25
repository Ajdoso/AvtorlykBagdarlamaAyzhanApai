export const CATEGORIES = {
  cleaning: 'Тазартқыш заттар',
  food: 'Тағам химиясы',
  cosmetics: 'Косметика және гигиена',
  medicine: 'Дәрі-дәрмектер',
  general: 'Жалпы материалдар',
};

export const DOCUMENT_TYPES = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'];
export const IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'webp', 'avif'];

// Creates an element. Strings become text nodes, so user content is never parsed as HTML.
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children.flat().filter((c) => c !== null && c !== undefined));
  return el;
}

// 'H2O' -> H<sub>2</sub>O
export function formula(text) {
  return text.split(/(\d+)/).filter(Boolean).map((part) => (/^\d+$/.test(part) ? h('sub', {}, part) : part));
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} Б`;
  const kb = bytes / 1024;
  const round = (n) => (n < 10 ? n.toFixed(1).replace('.0', '').replace('.', ',') : String(Math.round(n)));
  return kb < 1000 ? `${round(kb)} КБ` : `${round(kb / 1024)} МБ`;
}

export function formatDate(iso) {
  const d = new Date(iso);
  return [d.getDate(), d.getMonth() + 1].map((n) => String(n).padStart(2, '0')).concat(d.getFullYear()).join('.');
}

export const normalize = (text) => text.toLocaleLowerCase('kk');

export function fillCategories(select) {
  select.replaceChildren(
    h('option', { value: '' }, 'Санатты таңдаңыз'),
    ...Object.entries(CATEGORIES).map(([value, label]) => h('option', { value }, label)),
  );
}

export function fileType(ext) {
  return h('span', { class: 'file-type', 'data-ext': ext }, ext.toUpperCase());
}

const FLASK = '<svg viewBox="0 0 72 72" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M28 10h16M31 10v18L14 56a5 5 0 0 0 4 8h36a5 5 0 0 0 4-8L41 28V10"/><path d="M22 46h28"/><circle cx="33" cy="55" r="2"/><circle cx="42" cy="53" r="3"/></svg>';

export function stateBlock({ title, text, action }) {
  const block = h('div', { class: 'state' });
  block.innerHTML = FLASK; // static markup only
  block.append(h('h3', {}, title), h('p', {}, text));
  if (action) block.append(h('button', { class: 'button button-quiet', type: 'button', onclick: action.run }, action.label));
  return block;
}

export function toast(message, { error = false } = {}) {
  let host = document.querySelector('.toasts');
  if (!host) {
    host = h('div', { class: 'toasts', role: 'status' });
    document.body.append(host);
  }
  const item = h('div', { class: `toast${error ? ' is-error' : ''}` }, message);
  host.append(item);
  setTimeout(() => item.remove(), error ? 7000 : 4500);
}

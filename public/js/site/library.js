import { api } from '../shared/api.js';
import { CATEGORIES, fileType, formatDate, formatSize, h, stateBlock } from '../shared/utils.js';

const list = document.getElementById('file-list');
const status = document.getElementById('file-status');

let files = [];

function card(file) {
  return h('article', { class: 'file-card' },
    h('div', { class: 'file-top' },
      fileType(file.ext),
      h('div', {}, h('p', { class: 'file-category' }, CATEGORIES[file.category]), h('h3', {}, file.title))),
    h('p', { class: 'file-desc' }, file.description),
    h('div', { class: 'file-foot' },
      h('p', { class: 'file-meta' },
        `${file.ext.toUpperCase()}, ${formatSize(file.size)}`, h('br'),
        file.author ? `Авторы: ${file.author}` : formatDate(file.createdAt)),
      h('a', {
        class: 'button button-small', href: `/api/files/${file.id}/download`, download: true,
        'aria-label': `Жүктеу: ${file.title}`,
      }, 'Жүктеу')));
}

function render() {
  status.textContent = `${files.length} материал бар`;
  if (files.length) {
    list.replaceChildren(...files.map(card));
    return;
  }
  list.replaceChildren(stateBlock({ title: 'Әзірге материал жоқ', text: 'Материалдар жақын арада қосылады.' }));
}

async function load() {
  list.setAttribute('aria-busy', 'true');
  list.replaceChildren(...Array.from({ length: 3 }, () => h('div', { class: 'skeleton' })));
  status.textContent = 'Материалдар жүктелуде';
  try {
    files = await api('/files');
    render();
  } catch (error) {
    status.textContent = 'Материалдар жүктелмеді';
    list.replaceChildren(stateBlock({
      title: 'Материалдар жүктелмеді', text: error.message, action: { label: 'Қайталау', run: load },
    }));
  } finally {
    list.removeAttribute('aria-busy');
  }
}

export function initLibrary() {
  load();
}

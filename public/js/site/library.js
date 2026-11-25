import { api } from '../shared/api.js';
import { createDropzone, handleForm, metaProblem, setupDialog } from '../shared/forms.js';
import {
  CATEGORIES, fileType, fillCategories, formatDate, formatSize, h, normalize, stateBlock, toast,
} from '../shared/utils.js';

const list = document.getElementById('file-list');
const status = document.getElementById('file-status');
const search = document.getElementById('file-search');
const filters = document.getElementById('file-filters');
const dialog = document.getElementById('submit-dialog');

let files = [];
let category = 'all';

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
  const query = normalize(search.value.trim());
  const shown = files.filter((f) =>
    (category === 'all' || f.category === category) && normalize(`${f.title} ${f.description}`).includes(query));
  status.textContent = `${shown.length} материал табылды`;
  if (shown.length) {
    list.replaceChildren(...shown.map(card));
  } else if (!files.length) {
    list.replaceChildren(stateBlock({
      title: 'Әзірге материал жоқ', text: 'Алғашқы материалды сіз ұсына аласыз.',
      action: { label: 'Материал ұсыну', run: () => dialog.showModal() },
    }));
  } else {
    list.replaceChildren(stateBlock({
      title: 'Ештеңе табылмады', text: 'Басқа сөзбен іздеңіз немесе барлық санатты ашыңыз.',
      action: { label: 'Сүзгіні тазалау', run: () => { search.value = ''; setCategory('all'); } },
    }));
  }
}

function setCategory(value) {
  category = value;
  for (const chip of filters.children) chip.setAttribute('aria-pressed', String(chip.dataset.value === value));
  render();
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

function initSubmission() {
  const form = document.getElementById('submit-form');
  fillCategories(form.elements.category);
  const dropzone = createDropzone(form.querySelector('[data-dropzone]'), 'document');
  setupDialog(dialog);
  document.querySelector('[data-open-submit]').addEventListener('click', () => dialog.showModal());
  handleForm(form, {
    busyLabel: 'Жіберілуде…',
    validate: () => metaProblem(form) || dropzone.problem(),
    send: async (data) => {
      await api('/submissions', { method: 'POST', body: data });
      form.reset();
      dropzone.reset();
      dialog.close();
      toast('Материал тексеруге жіберілді.');
    },
  });
}

export function initLibrary() {
  for (const [value, label] of [['all', 'Барлығы'], ...Object.entries(CATEGORIES)]) {
    filters.append(h('button', {
      class: 'chip', type: 'button', 'data-value': value, 'aria-pressed': String(value === 'all'),
      onclick: () => setCategory(value),
    }, label));
  }
  search.addEventListener('input', render);
  initSubmission();
  load();
}

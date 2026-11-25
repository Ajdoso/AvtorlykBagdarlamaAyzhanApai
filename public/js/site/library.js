import { api } from '../shared/api.js';
import { createDropzone, handleForm, metaProblem, setupDialog } from '../shared/forms.js';
import { sendFileForm } from '../shared/upload.js';
import {
  CATEGORIES, fileType, fillCategories, formatDate, formatSize, h, stateBlock, toast,
} from '../shared/utils.js';

const list = document.getElementById('file-list');
const status = document.getElementById('file-status');
const dialog = document.getElementById('submit-dialog');

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
  list.replaceChildren(stateBlock({
    title: 'Әзірге материал жоқ', text: 'Алғашқы материалды сіз ұсына аласыз.',
    action: { label: 'Материал ұсыну', run: () => dialog.showModal() },
  }));
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
      await sendFileForm(data, { startPath: '/uploads', path: '/submissions' });
      form.reset();
      dropzone.reset();
      dialog.close();
      toast('Материал тексеруге жіберілді.');
    },
  });
}

export function initLibrary() {
  initSubmission();
  load();
}

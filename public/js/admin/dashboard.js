import { api as request } from '../shared/api.js';
import { createDropzone, handleForm, metaProblem, setupDialog } from '../shared/forms.js';
import {
  CATEGORIES, fileType, fillCategories, formatDate, formatSize, h, stateBlock, toast,
} from '../shared/utils.js';

const $ = (id) => document.getElementById(id);

// Any expired session sends the admin back to the login page.
async function api(path, options) {
  try {
    return await request(path, options);
  } catch (error) {
    if (error.status === 401) location.href = '/admin';
    throw error;
  }
}

/* ---------- File list ---------- */
const list = $('admin-files');
const FILTERS = { all: 'Барлығы', pending: 'Тексеруде', approved: 'Жарияланған' };
let files = [];
let filter = 'all';
let activeFile = null;

function row(file) {
  const pending = file.status === 'pending';
  const details = [
    CATEGORIES[file.category], formatSize(file.size), formatDate(file.createdAt),
    pending ? null : `${file.downloads} рет жүктелген`, file.author ? `авторы: ${file.author}` : null,
  ].filter(Boolean).join(', ');
  return h('article', { class: 'admin-file' },
    fileType(file.ext),
    h('div', {},
      h('h3', {}, file.title),
      h('p', {}, file.description),
      h('p', {}, details),
      pending ? h('p', { class: 'pending' }, 'Тексеруді күтіп тұр') : null),
    h('div', { class: 'admin-file-actions' },
      pending ? h('button', { class: 'button button-small', type: 'button', onclick: (e) => approve(file, e.currentTarget) }, 'Жариялау') : null,
      h('a', { class: 'button button-quiet button-small', href: `/api/files/${file.id}/download`, download: true, 'aria-label': `Жүктеу: ${file.title}` }, 'Жүктеу'),
      h('button', { class: 'button button-quiet button-small', type: 'button', onclick: () => openEdit(file), 'aria-label': `Өзгерту: ${file.title}` }, 'Өзгерту'),
      h('button', { class: 'button button-small text-danger', type: 'button', onclick: () => openDelete(file), 'aria-label': `Жою: ${file.title}` }, 'Жою')));
}

function renderFilters() {
  $('status-filter').replaceChildren(...Object.entries(FILTERS).map(([value, label]) => {
    const count = value === 'all' ? files.length : files.filter((f) => f.status === value).length;
    return h('button', {
      type: 'button', 'aria-pressed': String(filter === value),
      onclick: () => { filter = value; render(); },
    }, `${label} (${count})`);
  }));
}

function render() {
  renderFilters();
  const shown = files.filter((f) => filter === 'all' || f.status === filter);
  if (shown.length) list.replaceChildren(...shown.map(row));
  else if (filter === 'pending') list.replaceChildren(stateBlock({ title: 'Тексеретін файл жоқ', text: 'Келушілер ұсынған материалдар осында шығады.' }));
  else list.replaceChildren(stateBlock({ title: 'Әзірге файл жоқ', text: '«Файл қосу» бөлімінен алғашқы материалды жариялаңыз.' }));
}

async function load({ quiet = false } = {}) {
  if (!quiet) list.replaceChildren(...Array.from({ length: 3 }, () => h('div', { class: 'skeleton' })));
  try {
    files = await api('/admin/files');
    render();
  } catch (error) {
    list.replaceChildren(stateBlock({ title: 'Файлдар жүктелмеді', text: error.message, action: { label: 'Қайталау', run: () => load() } }));
  }
}

async function approve(file, button) {
  button.disabled = true;
  try {
    await api(`/admin/files/${file.id}/approve`, { method: 'POST' });
    toast('Материал жарияланды.');
    await load({ quiet: true });
  } catch (error) {
    button.disabled = false;
    toast(error.message, { error: true });
  }
}

/* ---------- Edit and delete ---------- */
const editForm = $('edit-form');
fillCategories(editForm.elements.category);
setupDialog($('edit-dialog'));
setupDialog($('delete-dialog'));

function openEdit(file) {
  activeFile = file;
  for (const name of ['title', 'category', 'description']) editForm.elements[name].value = file[name];
  editForm.querySelector('.form-error').hidden = true;
  $('edit-dialog').showModal();
}

handleForm(editForm, {
  busyLabel: 'Сақталуда…',
  validate: () => metaProblem(editForm),
  send: async (data) => {
    await api(`/admin/files/${activeFile.id}`, { method: 'PATCH', body: Object.fromEntries(data) });
    $('edit-dialog').close();
    toast('Өзгерістер сақталды.');
    await load({ quiet: true });
  },
});

function openDelete(file) {
  activeFile = file;
  $('delete-name').textContent = `«${file.title}»`;
  $('delete-dialog').showModal();
}

$('delete-confirm').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await api(`/admin/files/${activeFile.id}`, { method: 'DELETE' });
    toast('Файл жойылды.');
    await load({ quiet: true });
  } catch (error) {
    toast(error.message, { error: true });
  } finally {
    button.disabled = false;
    $('delete-dialog').close();
  }
});

/* ---------- Upload ---------- */
const uploadForm = $('upload-form');
fillCategories(uploadForm.elements.category);
const uploadZone = createDropzone(uploadForm.querySelector('[data-dropzone]'), 'document');
handleForm(uploadForm, {
  busyLabel: 'Жүктелуде…',
  validate: () => metaProblem(uploadForm) || uploadZone.problem(),
  send: async (data) => {
    await api('/admin/files', { method: 'POST', body: data });
    uploadForm.reset();
    uploadZone.reset();
    toast('Файл жарияланды.');
    await load({ quiet: true });
  },
});

/* ---------- Hero image ---------- */
const preview = $('hero-preview');
let savedHero = '';
let objectUrl = '';

function showHero({ heroImage, isDefault }) {
  savedHero = heroImage;
  preview.src = heroImage;
  $('hero-reset').hidden = isDefault;
}

const heroFileForm = $('hero-file-form');
const heroZone = createDropzone(heroFileForm.querySelector('[data-dropzone]'), 'image', (file) => {
  URL.revokeObjectURL(objectUrl);
  objectUrl = file ? URL.createObjectURL(file) : '';
  preview.src = objectUrl || savedHero;
});
handleForm(heroFileForm, {
  busyLabel: 'Жүктелуде…',
  validate: () => heroZone.problem(),
  send: async (data) => {
    const result = await api('/admin/hero/file', { method: 'PUT', body: data });
    heroZone.reset();
    showHero(result);
    toast('Басты сурет ауыстырылды.');
  },
});

function imageLoads(url) {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(false), 15000);
    img.onload = () => { clearTimeout(timer); resolve(true); };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    img.src = url;
  });
}

const heroUrlForm = $('hero-url-form');
handleForm(heroUrlForm, {
  busyLabel: 'Тексерілуде…',
  validate: () => (/^https?:\/\/.+/i.test(heroUrlForm.elements.url.value.trim()) ? '' : 'Сурет сілтемесі https:// деп басталуы керек.'),
  send: async (data) => {
    const url = data.get('url').trim();
    if (!(await imageLoads(url))) throw new Error('Бұл сілтемеден сурет ашылмады. Суреттің тікелей сілтемесін қойыңыз.');
    showHero(await api('/admin/hero/url', { method: 'PUT', body: { url } }));
    heroUrlForm.reset();
    toast('Басты сурет ауыстырылды.');
  },
});

$('hero-reset').addEventListener('click', async () => {
  try {
    showHero(await api('/admin/hero', { method: 'DELETE' }));
    toast('Бастапқы сурет қайтарылды.');
  } catch (error) {
    toast(error.message, { error: true });
  }
});

/* ---------- Logout ---------- */
$('logout').addEventListener('click', async () => {
  try {
    await api('/admin/logout', { method: 'POST' });
    location.href = '/admin';
  } catch (error) {
    toast(error.message, { error: true });
  }
});

load();
api('/settings').then(showHero).catch((error) => toast(error.message, { error: true }));

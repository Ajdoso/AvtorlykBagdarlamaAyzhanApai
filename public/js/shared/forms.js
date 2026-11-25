import { DOCUMENT_TYPES, IMAGE_TYPES, formatSize, h } from './utils.js';

const PRESETS = {
  document: { name: 'file', types: DOCUMENT_TYPES, maxMb: 25, hint: 'PDF, Word, PowerPoint, Excel немесе TXT, 25 МБ дейін' },
  image: { name: 'image', types: IMAGE_TYPES, maxMb: 8, hint: 'JPG, PNG, WebP немесе AVIF, 8 МБ дейін' },
};

// Turns a placeholder <div> into a drag-and-drop file field.
export function createDropzone(host, preset, onChange = () => {}) {
  const { name, types, maxMb, hint } = PRESETS[preset];
  const input = h('input', { type: 'file', name, accept: types.map((t) => `.${t}`).join(','), required: true });
  const prompt = 'Файлды таңдаңыз немесе осында сүйреңіз';
  const title = h('strong', {}, prompt);
  const note = h('span', {}, hint);
  const zone = h('label', { class: 'dropzone' }, input, title, note);

  const update = () => {
    const file = input.files[0];
    title.textContent = file ? file.name : prompt;
    note.textContent = file ? `${formatSize(file.size)}. Ауыстыру үшін басыңыз` : hint;
    onChange(file);
  };
  input.addEventListener('change', update);
  // The transparent input covers the zone, so dropping onto it works natively.
  for (const type of ['dragenter', 'dragover']) zone.addEventListener(type, () => zone.classList.add('is-over'));
  for (const type of ['dragleave', 'drop']) zone.addEventListener(type, () => zone.classList.remove('is-over'));
  host.replaceWith(zone);

  return {
    reset() { input.value = ''; update(); },
    problem() {
      const file = input.files[0];
      if (!file) return 'Файлды таңдаңыз.';
      if (!types.includes(file.name.split('.').pop().toLowerCase())) return `Бұл файл түрі қабылданбайды. ${hint}.`;
      if (file.size > maxMb * 1024 * 1024) return `Файл тым үлкен. Шегі — ${maxMb} МБ.`;
      return '';
    },
  };
}

export function metaProblem(form) {
  if (form.elements.title.value.trim().length < 3) return 'Атауын жазыңыз (кемінде 3 таңба).';
  if (!form.elements.category.value) return 'Санатты таңдаңыз.';
  if (form.elements.description.value.trim().length < 5) return 'Қысқаша сипаттама жазыңыз (кемінде 5 таңба).';
  return '';
}

// Wires submit: validation, busy label, error message.
export function handleForm(form, { validate, send, busyLabel }) {
  const errorBox = form.querySelector('.form-error');
  const button = form.querySelector('[type=submit]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (button.disabled) return;
    const showError = (text) => {
      errorBox.textContent = text;
      errorBox.hidden = !text;
      if (text) errorBox.scrollIntoView({ block: 'nearest' });
    };
    const problem = validate?.() || '';
    showError(problem);
    if (problem) return;
    const label = button.textContent;
    button.disabled = true;
    button.textContent = busyLabel;
    try {
      await send(new FormData(form));
    } catch (error) {
      showError(error.message);
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  });
}

export function setupDialog(dialog) {
  dialog.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) dialog.close();
  });
}

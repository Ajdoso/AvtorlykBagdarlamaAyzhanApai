import { stars } from '../shared/stars.js';
import { formatDate, h, stateBlock, toast } from '../shared/utils.js';

const FILTERS = {
  all: ['Барлығы', () => true],
  unanswered: ['Жауапсыз', (r) => r.status === 'published' && !r.reply],
  pending: ['Тексеруде', (r) => r.status === 'pending'],
  hidden: ['Жасырылған', (r) => r.status === 'hidden'],
};

export function initAdminReviews(api) {
  const list = document.getElementById('admin-reviews');
  const filterBox = document.getElementById('review-filter');
  const summary = document.getElementById('admin-review-summary');
  const dialog = document.getElementById('review-delete-dialog');
  let items = [];
  let filter = 'all';

  async function act(button, path, options, message) {
    button.disabled = true;
    try {
      await api(`/admin/reviews/${path}`, options);
      toast(message);
      await load({ quiet: true });
    } catch (error) {
      button.disabled = false;
      toast(error.message, { error: true });
    }
  }

  function askDelete(review) {
    document.getElementById('review-delete-text').textContent = `${review.name} жазған пікір біржола жойылады. Автор жаңа пікір жаза алады.`;
    const button = document.getElementById('review-delete-confirm');
    button.onclick = async () => {
      await act(button, review.id, { method: 'DELETE' }, 'Пікір жойылды.');
      button.disabled = false;
      dialog.close();
    };
    dialog.showModal();
  }

  function replyForm(review, onCancel) {
    const text = h('textarea', { class: 'input', rows: 3, maxlength: 1000, 'aria-label': 'Жауап мәтіні' });
    text.value = review.reply ?? '';
    const save = h('button', { class: 'button button-small', type: 'submit' }, 'Жауапты жариялау');
    const form = h('form', { class: 'form reply-form' }, text, h('div', { class: 'admin-file-actions' }, save,
      h('button', { class: 'button button-quiet button-small', type: 'button', onclick: onCancel }, 'Бас тарту')));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (text.value.trim().length < 2) {
        toast('Жауапты жазыңыз.', { error: true });
        return;
      }
      act(save, `${review.id}/reply`, { method: 'PUT', body: { reply: text.value } }, 'Жауап жарияланды.');
    });
    return form;
  }

  function row(review) {
    const button = (label, onclick, style = 'button-quiet') =>
      h('button', { class: `button button-small ${style}`, type: 'button', onclick, 'aria-label': `${label}: ${review.name}` }, label);
    const setStatus = (status, message) => (e) =>
      act(e.currentTarget, `${review.id}/status`, { method: 'PUT', body: { status } }, message);
    const el = h('article', { class: 'admin-review' });

    const actions = h('div', { class: 'admin-file-actions' },
      button(review.reply ? 'Жауапты өзгерту' : 'Жауап беру', () => {
        const form = replyForm(review, () => el.replaceWith(row(review)));
        actions.replaceWith(form);
        form.querySelector('textarea').focus();
      }, review.reply ? 'button-quiet' : ''),
      review.reply ? button('Жауапты жою', (e) => act(e.currentTarget, `${review.id}/reply`, { method: 'DELETE' }, 'Жауап жойылды.')) : null,
      review.status === 'published' ? button('Жасыру', setStatus('hidden', 'Пікір жасырылды.')) : null,
      review.status !== 'published' && !review.blocked ? button('Жариялау', setStatus('published', 'Пікір жарияланды.')) : null,
      button(review.blocked ? 'Бұғаттан шығару' : 'Авторды бұғаттау', (e) =>
        act(e.currentTarget, `users/${review.userId}/blocked`, { method: 'PUT', body: { blocked: !review.blocked } },
          review.blocked ? 'Автор бұғаттан шығарылды.' : 'Автор бұғатталды, пікірі жасырылды.'), 'text-danger'),
      button('Жою', () => askDelete(review), 'text-danger'));

    const state = review.blocked ? 'Авторы бұғатталған'
      : { pending: 'Тексеруді күтіп тұр', hidden: 'Сайтта көрінбейді' }[review.status];
    el.append(
      h('div', { class: 'review-head' },
        h('h3', {}, review.name), stars(review.rating),
        h('p', {}, `@${review.username}, ${formatDate(review.createdAt)}`)),
      h('p', { class: 'review-body' }, review.body),
      ...(state ? [h('p', { class: 'pending' }, state)] : []),
      ...(review.reply ? [h('div', { class: 'review-reply' }, h('b', {}, 'Сіздің жауабыңыз'), h('p', { class: 'review-body' }, review.reply))] : []),
      actions,
    );
    return el;
  }

  function render() {
    filterBox.replaceChildren(...Object.entries(FILTERS).map(([value, [label, test]]) =>
      h('button', {
        type: 'button', 'aria-pressed': String(filter === value),
        onclick: () => { filter = value; render(); },
      }, `${label} (${items.filter(test).length})`)));
    const shown = items.filter(FILTERS[filter][1]);
    if (shown.length) list.replaceChildren(...shown.map(row));
    else list.replaceChildren(stateBlock({ title: 'Пікір жоқ', text: 'Бұл бөлімде әзірге пікір жоқ.' }));
  }

  async function load({ quiet = false } = {}) {
    if (!quiet) list.replaceChildren(h('div', { class: 'skeleton' }));
    try {
      const data = await api('/admin/reviews');
      items = data.items;
      summary.textContent = data.total ? `Орташа баға ${data.average.toFixed(1).replace('.', ',')}, жарияланған пікір: ${data.total}` : '';
      render();
    } catch (error) {
      list.replaceChildren(stateBlock({ title: 'Пікірлер жүктелмеді', text: error.message, action: { label: 'Қайталау', run: () => load() } }));
    }
  }

  dialog.addEventListener('click', (event) => { if (event.target.closest('[data-close]')) dialog.close(); });
  load();
}

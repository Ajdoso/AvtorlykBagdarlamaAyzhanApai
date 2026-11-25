import { api } from '../shared/api.js';
import { handleForm, setupDialog } from '../shared/forms.js';
import { starInput, stars } from '../shared/stars.js';
import { formatDate, h, stateBlock, toast } from '../shared/utils.js';
import { account, onAccountChange, openAccount, refreshAccount } from './account.js';

const summaryBox = document.getElementById('review-summary');
const writeBox = document.getElementById('review-write');
const list = document.getElementById('review-list');
const moreButton = document.getElementById('review-more');
const confirmDialog = document.getElementById('confirm-dialog');

let items = [];

/* ---------- Summary ---------- */
function renderSummary({ total, average, counts }) {
  if (!total) {
    summaryBox.replaceChildren(h('p', {}, 'Сайт әлі бағаланбаған.'));
    return;
  }
  summaryBox.replaceChildren(
    h('div', { class: 'score' },
      h('strong', {}, average.toFixed(1).replace('.', ',')),
      h('div', {}, stars(average), h('span', {}, `${total} пікір`))),
    h('ul', { class: 'score-bars' }, counts.map(({ rating, count }) =>
      h('li', {},
        h('span', {}, `${rating} жұлдыз`),
        h('span', { class: 'bar', 'aria-hidden': 'true' }, h('i', { style: `width:${(count / total) * 100}%` })),
        h('span', {}, String(count))))),
  );
}

/* ---------- List ---------- */
function card(review) {
  return h('article', { class: 'review' },
    h('div', { class: 'review-head' },
      h('h3', {}, review.name),
      stars(review.rating),
      h('p', {}, `${formatDate(review.createdAt)}${review.edited ? ' (өзгертілген)' : ''}`)),
    h('p', { class: 'review-body' }, review.body),
    review.reply ? h('div', { class: 'review-reply' },
      h('b', {}, 'Әкімшінің жауабы'),
      h('p', { class: 'review-body' }, review.reply)) : null);
}

async function load({ more = false } = {}) {
  if (!more) list.replaceChildren(h('div', { class: 'skeleton' }), h('div', { class: 'skeleton' }));
  moreButton.disabled = true;
  try {
    const data = await api(`/reviews?offset=${more ? items.length : 0}`);
    const known = new Set(more ? items.map((r) => r.id) : []);
    items = [...(more ? items : []), ...data.items.filter((r) => !known.has(r.id))];
    renderSummary(data);
    moreButton.hidden = !data.hasMore;
    if (items.length) list.replaceChildren(...items.map(card));
    else list.replaceChildren(stateBlock({ title: 'Әзірге пікір жоқ', text: 'Сайт туралы ойыңызды алғаш болып жазыңыз.' }));
  } catch (error) {
    if (more) toast(error.message, { error: true });
    else {
      moreButton.hidden = true;
      list.replaceChildren(stateBlock({ title: 'Пікірлер жүктелмеді', text: error.message, action: { label: 'Қайталау', run: () => load() } }));
    }
  } finally {
    moreButton.disabled = false;
  }
}

/* ---------- Writing ---------- */
function askConfirm({ title, text, label, run }) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-text').textContent = text;
  const button = document.getElementById('confirm-run');
  button.textContent = label;
  button.onclick = async () => {
    button.disabled = true;
    try {
      await run();
    } catch (error) {
      toast(error.message, { error: true });
    } finally {
      button.disabled = false;
      confirmDialog.close();
    }
  };
  confirmDialog.showModal();
}

async function reload() {
  await refreshAccount();
  await load();
}

function renderGuest() {
  writeBox.replaceChildren(
    h('h3', {}, 'Пікір қалдырыңыз'),
    h('p', {}, 'Сайтты бағалау үшін аккаунт керек. Ол үшін логин мен құпиясөз жеткілікті.'),
    h('div', { class: 'write-actions' },
      h('button', { class: 'button', type: 'button', onclick: () => openAccount('register') }, 'Тіркелу'),
      h('button', { class: 'button button-quiet', type: 'button', onclick: () => openAccount('login') }, 'Кіру')));
}

const NOTES = {
  pending: 'Пікіріңізді әкімші тексеріп жатыр. Тексерілген соң сайтта шығады.',
  hidden: 'Пікіріңізді әкімші сайттан жасырды.',
};

function renderForm() {
  const { user, review } = account;
  const note = NOTES[review?.status];
  const text = h('textarea', { class: 'input', name: 'body', rows: 5, maxlength: 1000, placeholder: 'Не ұнады, нені жақсарту керек?' });
  text.value = review?.body ?? '';
  const form = h('form', { class: 'form', novalidate: true },
    h('h3', {}, review ? `${user.name}, пікіріңіз` : `${user.name}, сайт қалай екен?`),
    note ? h('p', { class: 'write-note' }, note) : null,
    starInput('rating', review?.rating),
    h('label', { class: 'field' }, 'Пікіріңіз', text),
    h('p', { class: 'form-error', role: 'alert', hidden: true }),
    h('button', { class: 'button', type: 'submit' }, review ? 'Өзгерісті сақтау' : 'Пікірді жариялау'),
    h('div', { class: 'write-actions' },
      review?.status === 'published' ? h('button', {
        class: 'button button-small text-danger', type: 'button',
        onclick: () => askConfirm({
          title: 'Пікірді жою керек пе?', text: 'Пікіріңіз бен бағаңыз сайттан біржола жойылады.', label: 'Пікірді жою',
          run: async () => {
            await api('/reviews/mine', { method: 'DELETE' });
            toast('Пікір жойылды.');
            await reload();
          },
        }),
      }, 'Пікірді жою') : null,
      h('button', {
        class: 'button button-small text-danger', type: 'button',
        onclick: () => askConfirm({
          title: 'Аккаунтты жою керек пе?', text: 'Аккаунтыңыз бен пікіріңіз біржола жойылады.', label: 'Аккаунтты жою',
          run: async () => {
            await api('/users/me', { method: 'DELETE' });
            toast('Аккаунт жойылды.');
            await reload();
          },
        }),
      }, 'Аккаунтты жою')));
  handleForm(form, {
    busyLabel: 'Жіберілуде…',
    validate: () => {
      if (!form.elements.rating.value) return 'Жұлдызша санын таңдаңыз.';
      if (text.value.trim().length < 10) return 'Пікіріңізді толығырақ жазыңыз (кемінде 10 таңба).';
      return '';
    },
    send: async () => {
      try {
        const saved = await api('/reviews/mine', {
          method: 'PUT', body: { rating: Number(form.elements.rating.value), body: text.value },
        });
        toast(saved.review.status === 'published' ? 'Пікір жарияланды.' : 'Пікір тексеруге жіберілді.');
        await reload();
      } catch (error) {
        if (error.status === 401) {
          await refreshAccount();
          openAccount();
        }
        throw error;
      }
    },
  });
  writeBox.replaceChildren(form);
}

export function initReviews() {
  setupDialog(confirmDialog);
  moreButton.addEventListener('click', () => load({ more: true }));
  onAccountChange(() => (account.user ? renderForm() : renderGuest()));
  load();
}

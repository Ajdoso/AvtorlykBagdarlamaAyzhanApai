// Sign in, registration and the header button.
import { api } from '../shared/api.js';
import { handleForm, setupDialog } from '../shared/forms.js';
import { toast } from '../shared/utils.js';

const dialog = document.getElementById('account-dialog');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const headerButton = document.getElementById('account-button');
const listeners = [];

export const account = { user: null, review: null, ready: false };
export const onAccountChange = (listener) => listeners.push(listener);

export async function refreshAccount() {
  const { user, review } = await api('/reviews/mine');
  Object.assign(account, { user, review, ready: true });
  headerButton.textContent = user ? 'Шығу' : 'Кіру';
  headerButton.hidden = false;
  listeners.forEach((listener) => listener());
}

/* ---------- Registration puzzle (see server/spam.js) ---------- */
let challenge = null;

async function solve() {
  const { id, bits, waitMs } = await api('/users/challenge', { method: 'POST' });
  const openedAt = Date.now();
  const encoder = new TextEncoder();
  for (let nonce = 0; ; nonce += 1) {
    const hash = new DataView(await crypto.subtle.digest('SHA-256', encoder.encode(`${id}:${nonce}`)));
    if (hash.getUint32(0) >>> (32 - bits) === 0) {
      return { challengeId: id, nonce: String(nonce), readyAt: openedAt + waitMs + 300 };
    }
  }
}

async function takeChallenge() {
  const { readyAt, ...answer } = await (challenge ?? solve());
  challenge = null; // each answer works once
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, readyAt - Date.now())));
  return answer;
}

function prepareChallenge() {
  challenge ??= solve();
  challenge.catch(() => { challenge = null; }); // a failed attempt is repeated on submit
}

/* ---------- Dialog ---------- */
export function openAccount(mode = 'login') {
  const register = mode === 'register';
  registerForm.hidden = !register;
  loginForm.hidden = register;
  document.getElementById('account-title').textContent = register ? 'Тіркелу' : 'Аккаунтқа кіру';
  document.getElementById('account-switch').textContent = register ? 'Аккаунтым бар' : 'Жаңа аккаунт ашу';
  if (register) prepareChallenge();
  if (!dialog.open) dialog.showModal();
  (register ? registerForm : loginForm).querySelector('input').focus();
}

async function finish(message) {
  loginForm.reset();
  registerForm.reset();
  dialog.close();
  toast(message);
  await refreshAccount();
}

export async function signOut() {
  await api('/users/logout', { method: 'POST' });
  toast('Аккаунттан шықтыңыз.');
  await refreshAccount();
}

export function initAccount() {
  setupDialog(dialog);
  document.getElementById('account-switch').addEventListener('click', () =>
    openAccount(registerForm.hidden ? 'register' : 'login'));
  headerButton.addEventListener('click', () => {
    if (account.user) signOut().catch((error) => toast(error.message, { error: true }));
    else openAccount();
  });

  handleForm(loginForm, {
    busyLabel: 'Тексерілуде…',
    validate: () => (loginForm.elements.username.value && loginForm.elements.password.value ? '' : 'Логин мен құпиясөзді жазыңыз.'),
    send: async (data) => {
      await api('/users/login', { method: 'POST', body: Object.fromEntries(data) });
      await finish('Қош келдіңіз!');
    },
  });

  handleForm(registerForm, {
    busyLabel: 'Тіркелуде…',
    validate: () => {
      const { name, username, password } = registerForm.elements;
      if (name.value.trim().length < 2) return 'Атыңызды жазыңыз.';
      if (!/^[a-z0-9_]{3,24}$/i.test(username.value.trim())) return 'Логин 3–24 таңбадан тұрады: латын әріптері, сандар және _ белгісі.';
      if (password.value.length < 8) return 'Құпиясөз кемінде 8 таңба болуы керек.';
      return '';
    },
    send: async (data) => {
      const body = { ...Object.fromEntries(data), ...(await takeChallenge()) };
      try {
        await api('/users/register', { method: 'POST', body });
      } catch (error) {
        prepareChallenge();
        throw error;
      }
      await finish('Аккаунт ашылды. Енді пікір қалдыра аласыз.');
    },
  });

  refreshAccount().catch(() => listeners.forEach((listener) => listener()));
}

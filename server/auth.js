import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_READY, ON_VERCEL } from './config.js';
import * as store from './store.js';

const COOKIE = 'admin_session';
const TTL = 8 * 60 * 60 * 1000;

const digest = (v) => createHash('sha256').update(String(v)).digest();
const same = (a, b) => timingSafeEqual(digest(a), digest(b));
// Only a hash is stored. Changing the admin login also ends every session.
const tokenHash = (token) => digest(`${token}:${ADMIN_EMAIL}:${ADMIN_PASSWORD}`).toString('hex');

function readToken(req) {
  return (req.headers.cookie || '').match(/(?:^|;\s*)admin_session=([a-f0-9]{64})/)?.[1];
}

export async function isAdmin(req) {
  const token = readToken(req);
  return Boolean(token) && store.hasSession(tokenHash(token));
}

export async function requireAdmin(req, res, next) {
  if (await isAdmin(req)) return next();
  res.status(401).json({ error: 'Сессия аяқталды. Жүйеге қайта кіріңіз.' });
}

// SameSite=Strict keeps other websites from acting with the admin's session.
const cookieOptions = (req) => ({ httpOnly: true, sameSite: 'strict', secure: ON_VERCEL || req.secure, path: '/' });

export async function login(req, res) {
  if (!ADMIN_READY) {
    return res.status(503).json({ error: 'Vercel баптауында ADMIN_PASSWORD айнымалысы орнатылмаған.' });
  }
  const { email = '', password = '' } = req.body || {};
  const emailOk = same(String(email).trim().toLowerCase(), ADMIN_EMAIL.toLowerCase());
  const passwordOk = same(password, ADMIN_PASSWORD);
  if (!emailOk || !passwordOk) {
    return res.status(401).json({ error: 'Электрондық пошта немесе құпиясөз қате.' });
  }
  const token = randomBytes(32).toString('hex');
  await store.addSession(tokenHash(token), TTL);
  await store.clearHits(`login:${req.ip}`);
  res.cookie(COOKIE, token, { ...cookieOptions(req), maxAge: TTL });
  res.json({ ok: true });
}

export async function logout(req, res) {
  const token = readToken(req);
  if (token) await store.removeSession(tokenHash(token));
  res.clearCookie(COOKIE, cookieOptions(req));
  res.json({ ok: true });
}

export function rateLimit({ name, max, windowMs, message }) {
  return async (req, res, next) => {
    if (await store.hit(`${name}:${req.ip}`, windowMs) > max) return res.status(429).json({ error: message });
    next();
  };
}

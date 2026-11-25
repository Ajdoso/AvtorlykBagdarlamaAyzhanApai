import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './config.js';

const COOKIE = 'admin_session';
const TTL = 8 * 60 * 60 * 1000;
const sessions = new Map(); // token -> expiry; a server restart signs everyone out

const digest = (v) => createHash('sha256').update(String(v)).digest();
const same = (a, b) => timingSafeEqual(digest(a), digest(b));

function readToken(req) {
  return (req.headers.cookie || '').match(/(?:^|;\s*)admin_session=([a-f0-9]{64})/)?.[1];
}

export function isAdmin(req) {
  const token = readToken(req);
  const expiry = token && sessions.get(token);
  if (!expiry) return false;
  if (expiry < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function requireAdmin(req, res, next) {
  if (isAdmin(req)) return next();
  res.status(401).json({ error: 'Сессия аяқталды. Жүйеге қайта кіріңіз.' });
}

// SameSite=Strict keeps other websites from acting with the admin's session.
const cookieOptions = (req) => ({ httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/' });

export function login(req, res) {
  const { email = '', password = '' } = req.body || {};
  const emailOk = same(String(email).trim().toLowerCase(), ADMIN_EMAIL.toLowerCase());
  const passwordOk = same(password, ADMIN_PASSWORD);
  if (!emailOk || !passwordOk) {
    return res.status(401).json({ error: 'Электрондық пошта немесе құпиясөз қате.' });
  }
  const token = randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + TTL);
  res.cookie(COOKIE, token, { ...cookieOptions(req), maxAge: TTL });
  res.json({ ok: true });
}

export function logout(req, res) {
  sessions.delete(readToken(req));
  res.clearCookie(COOKIE, cookieOptions(req));
  res.json({ ok: true });
}

// With failuresOnly, only 401 answers are counted (used for the login form).
export function rateLimit({ max, windowMs, message, failuresOnly = false }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    for (const [ip, entry] of hits) if (entry.reset < now) hits.delete(ip);
    const entry = hits.get(req.ip) || { count: 0, reset: now + windowMs };
    hits.set(req.ip, entry);
    if (entry.count >= max) return res.status(429).json({ error: message });
    if (failuresOnly) res.on('finish', () => { if (res.statusCode === 401) entry.count += 1; });
    else entry.count += 1;
    next();
  };
}

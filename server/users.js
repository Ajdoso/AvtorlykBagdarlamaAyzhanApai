// Visitor accounts. Only a login, a display name and a password hash are stored.
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Router } from 'express';
import { rateLimit } from './auth.js';
import { ON_VERCEL } from './config.js';
import { query } from './db.js';
import { UserError } from './errors.js';
import { checkChallenge, cleanText, isRude, issueChallenge, refuseSpam } from './spam.js';
import { clearHits, hit } from './store.js';

const COOKIE = 'user_session';
const TTL = 30 * 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const scryptAsync = promisify(scrypt);
const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [salt, key] = stored.split(':').map((part) => Buffer.from(part, 'hex'));
  return timingSafeEqual(await scryptAsync(password, salt, 64), key);
}
// Checked when the login does not exist, so both cases take the same time.
const DUMMY_HASH = await hashPassword(randomBytes(16).toString('hex'));

function readToken(req) {
  return (req.headers.cookie || '').match(/(?:^|;\s*)user_session=([a-f0-9]{64})/)?.[1];
}

export async function currentUser(req) {
  const token = readToken(req);
  if (!token) return undefined;
  return (await query(
    `SELECT u.id, u.username, u.name FROM user_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND NOT u.blocked`,
    [tokenHash(token)],
  ))[0];
}

export async function requireUser(req, res, next) {
  req.user = await currentUser(req);
  if (req.user) return next();
  res.status(401).json({ error: 'Алдымен аккаунтқа кіріңіз.' });
}

const cookieOptions = (req) => ({ httpOnly: true, sameSite: 'strict', secure: ON_VERCEL || req.secure, path: '/' });

async function startSession(req, res, userId) {
  const token = randomBytes(32).toString('hex');
  await query('DELETE FROM user_sessions WHERE expires_at < now()');
  await query('INSERT INTO user_sessions VALUES ($1, $2, $3)', [
    tokenHash(token), userId, new Date(Date.now() + TTL).toISOString(),
  ]);
  res.cookie(COOKIE, token, { ...cookieOptions(req), maxAge: TTL });
}

function readAccount(body) {
  const username = String(body?.username ?? '').trim().toLowerCase();
  const name = cleanText(body?.name).replace(/\n/g, ' ');
  const password = String(body?.password ?? '');
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    throw new UserError('Логин 3–24 таңбадан тұрады: латын әріптері, сандар және _ белгісі.');
  }
  if (name.length < 2 || name.length > 40 || !/\p{L}{2}/u.test(name)) throw new UserError('Атыңызды жазыңыз (2–40 таңба).');
  refuseSpam(name);
  if (isRude(name) || /[әa]кімш|админ|admin|модератор|moderator/iu.test(`${name} ${username}`)) {
    throw new UserError('Бұл атты қолдануға болмайды.');
  }
  if (password.length < 8 || password.length > 100) throw new UserError('Құпиясөз кемінде 8 таңба болуы керек.');
  if (password.toLowerCase().includes(username) || /^(.)\1+$|^12345678|^qwerty|^password/i.test(password)) {
    throw new UserError('Бұл құпиясөз тым оңай. Басқасын ойлап табыңыз.');
  }
  return { username, name, password };
}

export const users = Router();

// Limits are per address; they leave room for a class sharing one school network.
users.post('/challenge', rateLimit({
  name: 'challenge', max: 120, windowMs: HOUR, message: 'Әрекет тым көп. Бір сағаттан кейін қайталаңыз.',
}), async (req, res) => res.json(await issueChallenge()));

users.post('/register', rateLimit({
  name: 'register', max: 60, windowMs: HOUR, message: 'Тіркелу әрекеті тым көп. Бір сағаттан кейін қайталаңыз.',
}), async (req, res) => {
  const account = readAccount(req.body);
  if ((await query('SELECT 1 FROM users WHERE username = $1', [account.username])).length) {
    throw new UserError('Бұл логин бос емес. Басқасын таңдаңыз.');
  }
  await checkChallenge(req.body);
  const id = randomUUID();
  const created = await query(
    `INSERT INTO users (id, username, name, password_hash) VALUES ($1,$2,$3,$4)
     ON CONFLICT (username) DO NOTHING RETURNING id`,
    [id, account.username, account.name, await hashPassword(account.password)],
  );
  if (!created.length) throw new UserError('Бұл логин бос емес. Басқасын таңдаңыз.');
  await startSession(req, res, id);
  res.status(201).json({ user: { username: account.username, name: account.name } });
});

users.post('/login', rateLimit({
  name: 'user-login', max: 60, windowMs: HOUR / 4, message: 'Кіру әрекеті тым көп. 15 минуттан кейін қайталаңыз.',
}), async (req, res) => {
  const username = String(req.body?.username ?? '').trim().toLowerCase().slice(0, 24);
  const password = String(req.body?.password ?? '').slice(0, 100);
  const key = `account:${username}`;
  if (await hit(key, HOUR / 4) > 10) {
    throw new UserError('Бұл логинге кіру әрекеті тым көп. 15 минуттан кейін қайталаңыз.', 429);
  }
  const user = (await query('SELECT * FROM users WHERE username = $1', [username]))[0];
  const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) throw new UserError('Логин немесе құпиясөз қате.');
  if (user.blocked) throw new UserError('Бұл аккаунт бұғатталған.', 403);
  await clearHits(key);
  await startSession(req, res, user.id);
  res.json({ user: { username: user.username, name: user.name } });
});

users.post('/logout', async (req, res) => {
  const token = readToken(req);
  if (token) await query('DELETE FROM user_sessions WHERE token_hash = $1', [tokenHash(token)]);
  res.clearCookie(COOKIE, cookieOptions(req));
  res.json({ ok: true });
});

// Deletes the account together with its review and sessions.
users.delete('/me', requireUser, async (req, res) => {
  await query('DELETE FROM users WHERE id = $1', [req.user.id]);
  res.clearCookie(COOKIE, cookieOptions(req));
  res.json({ ok: true });
});

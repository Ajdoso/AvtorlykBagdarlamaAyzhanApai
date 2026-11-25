// Spam protection for accounts and reviews.
import { createHash, randomUUID } from 'node:crypto';
import { UserError } from './errors.js';
import { query } from './db.js';

/* ---------- Registration challenge ----------
   The browser must solve a small puzzle. A person never notices it; a bot pays for every account.
   Each challenge works once, and not sooner than MIN_AGE_MS after it was issued. */
const DIFFICULTY_BITS = 14;
const MIN_AGE_MS = 2500;
const LIFETIME_MS = 30 * 60_000;

export async function issueChallenge() {
  await query('DELETE FROM challenges WHERE expires_at < now()');
  const id = randomUUID();
  const now = Date.now();
  await query('INSERT INTO challenges VALUES ($1, $2, $3)', [
    id, new Date(now + MIN_AGE_MS).toISOString(), new Date(now + LIFETIME_MS).toISOString(),
  ]);
  return { id, bits: DIFFICULTY_BITS, waitMs: MIN_AGE_MS };
}

export async function checkChallenge(body) {
  const failed = new UserError('Тексеруден өтпеді. Бетті жаңартып, қайталап көріңіз.');
  const id = String(body?.challengeId ?? '');
  const nonce = String(body?.nonce ?? '');
  // "website" is hidden from people; only bots fill it in.
  if (body?.website || !/^[0-9a-f-]{36}$/.test(id) || !/^\d{1,9}$/.test(nonce)) throw failed;
  const hash = createHash('sha256').update(`${id}:${nonce}`).digest();
  if (hash.readUInt32BE(0) >>> (32 - DIFFICULTY_BITS) !== 0) throw failed;
  const rows = await query(
    'DELETE FROM challenges WHERE id = $1 AND valid_from <= now() AND expires_at > now() RETURNING id', [id],
  );
  if (!rows.length) throw failed;
}

/* ---------- Text rules ---------- */
const LINK = /https?:|www\.|\b(?:t\.me|wa\.me|bit\.ly)\b|[\p{L}\d-]{2,}\.(?:com|net|org|info|ru|рф|kz|қаз|xyz|top|site|online|link|shop|club|io|me|ly)(?![\p{L}\d])/iu;
const CONTACT = /\+?\d[\d\s()\-]{8,}\d|[^\s@]+@[^\s@]+\.[^\s@]+/;
const REPEATED = /(.)\1{6,}/u;
// Word beginnings that send a review to the admin instead of publishing it at once.
const RUDE = ['хуй', 'хуе', 'хуё', 'пизд', 'бляд', 'блять', 'сука', 'суки', 'ебан', 'ебат', 'ёбан', 'мудак', 'гандон',
  'долбоеб', 'долбоёб', 'сіктір', 'сиктир', 'қотақ', 'котак', 'жәлеп', 'fuck', 'bitch', 'shit'];

export function cleanText(value) {
  return String(value ?? '')
    .normalize('NFC')
    // control, invisible and text-direction characters (line breaks stay)
    .replace(/(?!\n)[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function refuseSpam(text) {
  if (LINK.test(text)) throw new UserError('Мәтінге сілтеме қосуға болмайды.');
  if (CONTACT.test(text)) throw new UserError('Телефон нөмірі мен электрондық поштаны жазбаңыз.');
  if (REPEATED.test(text)) throw new UserError('Бір таңба тым көп қайталанған.');
}

export function isRude(text) {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  return words.some((word) => RUDE.some((start) => word.startsWith(start)));
}

// Same text with different spacing, case or punctuation counts as a copy.
export function fingerprint(text) {
  const letters = text.toLowerCase().replace(/[^\p{L}\d]/gu, '');
  return createHash('sha256').update(letters).digest('hex');
}

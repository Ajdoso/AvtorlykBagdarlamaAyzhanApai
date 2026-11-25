// Reviews: one per account, with a 1-5 star rating, a text and an optional admin reply.
// status: published (on the site), pending (waits for the admin), hidden (removed by the admin)
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { query } from './db.js';
import { UserError } from './errors.js';
import { cleanText, fingerprint, isRude, refuseSpam } from './spam.js';
import { hit } from './store.js';
import { currentUser, requireUser } from './users.js';

const PAGE = 10;
const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const FIELDS = `r.id, r.rating, r.body, r.reply, r.replied_at AS "repliedAt", r.created_at AS "createdAt",
  r.edited`;

async function summary() {
  const rows = await query("SELECT rating, count(*)::int AS n FROM reviews WHERE status = 'published' GROUP BY rating");
  const counts = [5, 4, 3, 2, 1].map((rating) => ({ rating, count: rows.find((r) => r.rating === rating)?.n ?? 0 }));
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  const points = counts.reduce((sum, c) => sum + c.rating * c.count, 0);
  return { total, average: total ? Math.round((points / total) * 10) / 10 : null, counts };
}

async function ownReview(userId) {
  return (await query(`SELECT ${FIELDS}, r.status FROM reviews r WHERE r.user_id = $1`, [userId]))[0] ?? null;
}

/* ---------- Public ---------- */
export const reviews = Router();

reviews.get('/', async (req, res) => {
  const offset = Math.min(Math.max(Number.parseInt(req.query.offset, 10) || 0, 0), 100_000);
  const rows = await query(
    `SELECT ${FIELDS}, u.name FROM reviews r JOIN users u ON u.id = r.user_id
     WHERE r.status = 'published' ORDER BY r.created_at DESC, r.id LIMIT $1 OFFSET $2`,
    [PAGE + 1, offset],
  );
  res.json({ ...(await summary()), items: rows.slice(0, PAGE), hasMore: rows.length > PAGE });
});

reviews.get('/mine', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.json({ user: null, review: null });
  res.json({ user: { username: user.username, name: user.name }, review: await ownReview(user.id) });
});

reviews.put('/mine', requireUser, async (req, res) => {
  const rating = Number(req.body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new UserError('Жұлдызша санын таңдаңыз.');
  const body = cleanText(req.body?.body);
  if (body.length < 10 || !/\p{L}{3}/u.test(body)) throw new UserError('Пікіріңізді толығырақ жазыңыз (кемінде 10 таңба).');
  if (body.length > 1000) throw new UserError('Пікір 1000 таңбадан аспауы керек.');
  refuseSpam(body);
  if (await hit(`review:${req.user.id}`, 60 * 60 * 1000) > 10) {
    throw new UserError('Пікірді тым жиі өзгерттіңіз. Бір сағаттан кейін қайталаңыз.', 429);
  }
  const print = fingerprint(body);
  const copies = await query('SELECT 1 FROM reviews WHERE fingerprint = $1 AND user_id <> $2', [print, req.user.id]);
  if (copies.length) throw new UserError('Дәл осындай пікір бар. Өз сөзіңізбен жазыңыз.');

  // An edit never brings back a review that the admin hid or has not checked yet.
  await query(
    `INSERT INTO reviews AS r (id, user_id, rating, body, fingerprint, status) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id) DO UPDATE SET
       rating = EXCLUDED.rating, body = EXCLUDED.body, fingerprint = EXCLUDED.fingerprint, edited = true,
       status = CASE WHEN r.status = 'published' THEN EXCLUDED.status ELSE r.status END`,
    [randomUUID(), req.user.id, rating, body, print, isRude(body) ? 'pending' : 'published'],
  );
  res.json({ review: await ownReview(req.user.id) });
});

reviews.delete('/mine', requireUser, async (req, res) => {
  const removed = await query(
    "DELETE FROM reviews WHERE user_id = $1 AND status = 'published' RETURNING id", [req.user.id],
  );
  if (!removed.length) throw new UserError('Бұл пікірді жою мүмкін емес.', 403);
  res.json({ ok: true });
});

/* ---------- Admin ---------- */
export const adminReviews = Router();

adminReviews.get('/', async (req, res) => {
  const items = await query(
    `SELECT ${FIELDS}, r.status, u.id AS "userId", u.name, u.username, u.blocked
     FROM reviews r JOIN users u ON u.id = r.user_id ORDER BY r.created_at DESC LIMIT 500`,
  );
  res.json({ ...(await summary()), items });
});

async function change(id, sql, params = []) {
  if (!UUID.test(id) || !(await query(sql, [id, ...params])).length) throw new UserError('Пікір табылмады.', 404);
}

adminReviews.put('/:id/reply', async (req, res) => {
  const reply = cleanText(req.body?.reply);
  if (reply.length < 2) throw new UserError('Жауапты жазыңыз.');
  if (reply.length > 1000) throw new UserError('Жауап 1000 таңбадан аспауы керек.');
  await change(req.params.id, 'UPDATE reviews SET reply = $2, replied_at = now() WHERE id = $1 RETURNING id', [reply]);
  res.json({ ok: true });
});
adminReviews.delete('/:id/reply', async (req, res) => {
  await change(req.params.id, 'UPDATE reviews SET reply = NULL, replied_at = NULL WHERE id = $1 RETURNING id');
  res.json({ ok: true });
});
adminReviews.put('/:id/status', async (req, res) => {
  const status = req.body?.status;
  if (!['published', 'hidden'].includes(status)) throw new UserError('Сұрау қате құрылған.');
  await change(
    req.params.id,
    `UPDATE reviews r SET status = $2 FROM users u
     WHERE r.id = $1 AND u.id = r.user_id AND NOT (u.blocked AND $2 = 'published') RETURNING r.id`,
    [status],
  );
  res.json({ ok: true });
});
adminReviews.delete('/:id', async (req, res) => {
  await change(req.params.id, 'DELETE FROM reviews WHERE id = $1 RETURNING id');
  res.json({ ok: true });
});

// Blocking signs the visitor out and hides their review.
adminReviews.put('/users/:id/blocked', async (req, res) => {
  const blocked = req.body?.blocked === true;
  await change(req.params.id, 'UPDATE users SET blocked = $2 WHERE id = $1 RETURNING id', [blocked]);
  if (blocked) {
    await query('DELETE FROM user_sessions WHERE user_id = $1', [req.params.id]);
    await query("UPDATE reviews SET status = 'hidden' WHERE user_id = $1", [req.params.id]);
  }
  res.json({ ok: true });
});

import { query } from './db.js';

const COLUMNS = `id, title, description, category, author, ext, pathname, size, status, downloads,
  created_at AS "createdAt"`;
const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

/* Files */
export const listFiles = () => query(`SELECT ${COLUMNS} FROM files ORDER BY created_at DESC`);

export async function getFile(id) {
  if (!UUID.test(id)) return undefined;
  return (await query(`SELECT ${COLUMNS} FROM files WHERE id = $1`, [id]))[0];
}

export async function addFile(f) {
  await query(
    `INSERT INTO files (id, title, description, category, author, ext, pathname, size, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [f.id, f.title, f.description, f.category, f.author, f.ext, f.pathname, f.size, f.status],
  );
}

export async function updateMeta(id, { title, description, category }) {
  if (!UUID.test(id)) return false;
  const rows = await query(
    'UPDATE files SET title = $2, description = $3, category = $4 WHERE id = $1 RETURNING id',
    [id, title, description, category],
  );
  return rows.length > 0;
}

export async function approveFile(id) {
  if (!UUID.test(id)) return false;
  return (await query("UPDATE files SET status = 'approved' WHERE id = $1 RETURNING id", [id])).length > 0;
}

export async function removeFile(id) {
  if (!UUID.test(id)) return undefined;
  return (await query('DELETE FROM files WHERE id = $1 RETURNING pathname', [id]))[0];
}

export const countDownload = (id) => query('UPDATE files SET downloads = downloads + 1 WHERE id = $1', [id]);

/* Hero image */
export async function getHero() {
  return (await query("SELECT value FROM settings WHERE key = 'hero'"))[0]?.value ?? null;
}

// Returns the value that was replaced.
export async function setHero(value) {
  const old = await getHero();
  if (value) {
    await query("INSERT INTO settings VALUES ('hero', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [value]);
  } else {
    await query("DELETE FROM settings WHERE key = 'hero'");
  }
  return old;
}

/* Sessions */
export async function addSession(tokenHash, ttlMs) {
  await query('DELETE FROM sessions WHERE expires_at < now()');
  await query('INSERT INTO sessions VALUES ($1, $2)', [tokenHash, new Date(Date.now() + ttlMs).toISOString()]);
}

export async function hasSession(tokenHash) {
  return (await query('SELECT 1 FROM sessions WHERE token_hash = $1 AND expires_at > now()', [tokenHash])).length > 0;
}

export const removeSession = (tokenHash) => query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);

/* Uploads that have started but are not attached to anything yet */
export const addUpload = (u) =>
  query('INSERT INTO uploads VALUES ($1,$2,$3,$4,$5)', [u.id, u.pathname, u.kind, u.isAdmin, u.expiresAt.toISOString()]);

export async function getUpload(id) {
  if (!UUID.test(id)) return undefined;
  return (await query('SELECT pathname, kind FROM uploads WHERE id = $1 AND expires_at > now()', [id]))[0];
}

// Removes the row, so each upload can be used only once.
export async function takeUpload(id, kind, isAdmin) {
  if (!UUID.test(id)) return undefined;
  return (await query(
    'DELETE FROM uploads WHERE id = $1 AND kind = $2 AND is_admin = $3 AND expires_at > now() RETURNING pathname',
    [id, kind, isAdmin],
  ))[0];
}

export async function takeExpiredUploads() {
  const rows = await query("DELETE FROM uploads WHERE expires_at < now() - interval '1 hour' RETURNING pathname");
  return rows.map((r) => r.pathname);
}

/* Rate limits */
export async function hit(key, windowMs) {
  const rows = await query(
    `INSERT INTO rate_limits AS r VALUES ($1, 1, $2)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN r.reset_at < now() THEN 1 ELSE r.count + 1 END,
       reset_at = CASE WHEN r.reset_at < now() THEN EXCLUDED.reset_at ELSE r.reset_at END
     RETURNING count`,
    [key, new Date(Date.now() + windowMs).toISOString()],
  );
  if (rows[0].count === 1) await query("DELETE FROM rate_limits WHERE reset_at < now() - interval '1 day'");
  return rows[0].count;
}

export const clearHits = (key) => query('DELETE FROM rate_limits WHERE key = $1', [key]);

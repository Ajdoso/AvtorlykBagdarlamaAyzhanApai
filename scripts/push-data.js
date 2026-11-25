// Copies the local files and hero image to the Vercel project (Neon + Blob).
// Stop the local server first, then: npm run push-data   (needs .env.local from "vercel env pull")
// Safe to run again: files that are already online are skipped.
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { put } from '@vercel/blob';
import { DATABASE_URL, DATA_DIR, PORT, USE_BLOB } from '../server/config.js';
import { query } from '../server/db.js';

if (!DATABASE_URL || !USE_BLOB) {
  console.error('DATABASE_URL or the Blob settings are missing from .env.local. Connect both stores, then run: vercel env pull .env.local');
  process.exit(1);
}
if (await fetch(`http://127.0.0.1:${PORT}/`).then(() => true, () => false)) {
  console.error('Stop the local server (npm start) first, then run this again.');
  process.exit(1);
}

const pg = await PGlite.create(path.join(DATA_DIR, 'pg'));
const upload = (pathname) => put(pathname, fs.readFileSync(path.join(DATA_DIR, pathname)), {
  access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/octet-stream',
});

const { rows } = await pg.query('SELECT * FROM files');
const online = new Set((await query('SELECT id FROM files')).map((r) => r.id));
for (const f of rows) {
  if (online.has(f.id)) {
    console.log('skip ', f.title);
    continue;
  }
  await upload(f.pathname);
  await query(
    `INSERT INTO files (id, title, description, category, author, ext, pathname, size, status, downloads, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [f.id, f.title, f.description, f.category, f.author, f.ext, f.pathname, f.size, f.status, f.downloads, f.created_at],
  );
  console.log('sent ', f.title);
}

const hero = (await pg.query("SELECT value FROM settings WHERE key = 'hero'")).rows[0]?.value;
if (hero) {
  if (hero.startsWith('/hero/')) await upload(hero.slice(1));
  await query("INSERT INTO settings VALUES ('hero', $1) ON CONFLICT DO NOTHING", [hero]);
  console.log('sent  hero image');
}
await pg.close();
console.log('Done.');

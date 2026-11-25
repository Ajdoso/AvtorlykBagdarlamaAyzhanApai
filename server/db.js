// One SQL layer for both places: Neon Postgres online, embedded Postgres (PGlite) locally.
import fs from 'node:fs';
import path from 'node:path';
import { DATABASE_URL, DATA_DIR, ON_VERCEL } from './config.js';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS files (
    id uuid PRIMARY KEY, title text NOT NULL, description text NOT NULL, category text NOT NULL,
    author text NOT NULL DEFAULT '', ext text NOT NULL, pathname text NOT NULL UNIQUE, size integer NOT NULL,
    status text NOT NULL, downloads integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now())`,
  'CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY, value text NOT NULL)',
  'CREATE TABLE IF NOT EXISTS sessions (token_hash text PRIMARY KEY, expires_at timestamptz NOT NULL)',
  `CREATE TABLE IF NOT EXISTS uploads (
    id uuid PRIMARY KEY, pathname text NOT NULL, kind text NOT NULL, is_admin boolean NOT NULL,
    expires_at timestamptz NOT NULL)`,
  'CREATE TABLE IF NOT EXISTS rate_limits (key text PRIMARY KEY, count integer NOT NULL, reset_at timestamptz NOT NULL)',
];

async function connect() {
  let run;
  if (DATABASE_URL) {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(DATABASE_URL);
    run = (text, params) => sql.query(text, params);
  } else {
    if (ON_VERCEL) throw new Error('DATABASE_URL is missing: connect a Neon database to this Vercel project.');
    const { PGlite } = await import('@electric-sql/pglite');
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const pg = await PGlite.create(path.join(DATA_DIR, 'pg'));
    run = async (text, params) => (await pg.query(text, params)).rows;
  }
  for (const statement of SCHEMA) {
    // Two cold starts may create the same table at once; the loser's error is harmless.
    await run(statement, []).catch((err) => {
      if (!['23505', '42P07'].includes(err.code)) throw err;
    });
  }
  if (!DATABASE_URL) await importOldData(run);
  return run;
}

// Earlier versions kept metadata in data/db.json. It is read once and then renamed.
async function importOldData(run) {
  const oldFile = path.join(DATA_DIR, 'db.json');
  if (!fs.existsSync(oldFile)) return;
  const old = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
  for (const f of old.files) {
    await run(
      `INSERT INTO files (id, title, description, category, author, ext, pathname, size, status, downloads, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,
      [f.id, f.title, f.description, f.category, f.author, f.ext, `files/${f.storedName}`, f.size, f.status, f.downloads, f.createdAt],
    );
  }
  if (old.heroImage) await run('INSERT INTO settings VALUES ($1,$2) ON CONFLICT DO NOTHING', ['hero', old.heroImage]);
  fs.renameSync(oldFile, path.join(DATA_DIR, 'db.imported.json'));
}

let connection;
export async function query(text, params = []) {
  connection ??= connect();
  let run;
  try {
    run = await connection;
  } catch (err) {
    connection = undefined; // try again on the next request
    throw err;
  }
  return run(text, params);
}

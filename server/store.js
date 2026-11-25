// Small JSON store: data/db.json holds metadata, data/files holds the documents.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DATA_DIR, FILES_DIR, HERO_DIR, SEED_DIR } from './config.js';

const DB_FILE = path.join(DATA_DIR, 'db.json');
for (const dir of [FILES_DIR, HERO_DIR]) fs.mkdirSync(dir, { recursive: true });

let db;
if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} else {
  db = { heroImage: null, files: seedFiles() };
  save();
}

function seedFiles() {
  const manifest = path.join(SEED_DIR, 'manifest.json');
  if (!fs.existsSync(manifest)) return [];
  return JSON.parse(fs.readFileSync(manifest, 'utf8')).map(({ file, ...meta }) => {
    const ext = path.extname(file).slice(1);
    const id = randomUUID();
    const storedName = `${id}.${ext}`;
    const target = path.join(FILES_DIR, storedName);
    fs.copyFileSync(path.join(SEED_DIR, file), target);
    return {
      ...meta, id, ext, storedName, author: '', status: 'approved',
      size: fs.statSync(target).size, downloads: 0, createdAt: new Date().toISOString(),
    };
  });
}

function save() {
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

export const listFiles = () => [...db.files].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
export const getFile = (id) => db.files.find((f) => f.id === id);

export function addFile(file) {
  db.files.push(file);
  save();
  return file;
}

export function updateFile(id, patch) {
  const file = getFile(id);
  if (file) {
    Object.assign(file, patch);
    save();
  }
  return file;
}

export function removeFile(id) {
  const file = getFile(id);
  if (!file) return false;
  fs.rmSync(path.join(FILES_DIR, file.storedName), { force: true });
  db.files = db.files.filter((f) => f.id !== id);
  save();
  return true;
}

export const getHero = () => db.heroImage;

export function setHero(value) {
  const old = db.heroImage;
  db.heroImage = value;
  save();
  if (old?.startsWith('/hero/') && old !== value) {
    fs.rmSync(path.join(HERO_DIR, path.basename(old)), { force: true });
  }
}

// An upload has three steps:
//   1. startUpload   the server approves the name and size and returns where to send the file
//   2. the browser sends the file (straight to Vercel Blob online, so the 4.5 MB function limit does not apply)
//   3. finishUpload  the server checks what arrived before the file is used
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { CATEGORIES, FILE_EXTENSIONS, IMAGE_EXTENSIONS, MAX_FILE_MB, MAX_IMAGE_MB } from './config.js';
import { UserError } from './errors.js';
import { storage } from './storage.js';
import * as store from './store.js';

const KINDS = {
  document: { folder: 'files', extensions: FILE_EXTENSIONS, maxMb: MAX_FILE_MB },
  hero: { folder: 'hero', extensions: IMAGE_EXTENSIONS, maxMb: MAX_IMAGE_MB },
};
export const maxBytes = (kind) => KINDS[kind].maxMb * 1024 * 1024;
export const extOf = (name) => path.extname(name).slice(1).toLowerCase();

export async function startUpload(body) {
  const kind = body?.kind;
  if (kind !== 'document' && kind !== 'hero') throw new UserError('Сұрау қате құрылған.');
  const { folder, extensions, maxMb } = KINDS[kind];
  const ext = extOf(String(body.name ?? ''));
  if (!extensions.includes(ext)) {
    throw new UserError(`Бұл файл түрі қабылданбайды. Рұқсат етілгені: ${extensions.join(', ').toUpperCase()}.`);
  }
  if (!(Number(body.size) > 0)) throw new UserError('Файл бос.');
  if (Number(body.size) > maxBytes(kind)) throw new UserError(`Файл тым үлкен. Шегі — ${maxMb} МБ.`);

  const id = randomUUID();
  const pathname = `${folder}/${randomUUID()}.${ext}`;
  await store.addUpload({ id, pathname, kind, isAdmin: true, expiresAt: new Date(Date.now() + 30 * 60_000) });
  // A fixed neutral type: visitors always get the file as a download, never as a page.
  const contentType = 'application/octet-stream';
  const target = await storage.uploadTarget({ id, pathname, contentType, maxBytes: maxBytes(kind) });
  return { id, contentType, ...target };
}

// The first bytes must agree with the extension, so a renamed file is refused.
const bytes = (...values) => (b) => values.every((v, i) => b[i] === v);
const ascii = (from, text) => (b) => b.toString('latin1', from, from + text.length) === text;
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04);
const OLE = bytes(0xd0, 0xcf, 0x11, 0xe0);
const JPG = bytes(0xff, 0xd8, 0xff);
const CHECKS = {
  pdf: (b) => b.toString('latin1').includes('%PDF-'),
  docx: ZIP, pptx: ZIP, xlsx: ZIP,
  doc: OLE, ppt: OLE, xls: OLE,
  txt: (b) => !b.includes(0),
  jpg: JPG, jpeg: JPG,
  png: bytes(0x89, 0x50, 0x4e, 0x47),
  webp: ascii(8, 'WEBP'),
  avif: ascii(4, 'ftypavi'),
};

async function discard(pathname) {
  try {
    await storage.remove(pathname);
  } catch (err) {
    console.error('Could not remove', pathname, err.message);
  }
}

export async function finishUpload(uploadId, kind) {
  const upload = await store.takeUpload(String(uploadId ?? ''), kind, true);
  if (!upload) throw new UserError('Жүктеу уақыты өтіп кетті. Файлды қайта таңдаңыз.');
  const { pathname } = upload;
  const ext = extOf(pathname);
  const info = await storage.inspect(pathname);
  if (!info) throw new UserError('Файл серверге жетпеді. Қайталап көріңіз.');
  if (!info.size || info.size > maxBytes(kind) || !CHECKS[ext](info.start)) {
    await discard(pathname);
    throw new UserError('Файл бос, тым үлкен немесе мазмұны кеңейтіміне сәйкес емес.');
  }
  return { pathname, ext, size: info.size };
}

// Files that were sent but never attached (the visitor closed the page, for example).
export async function cleanUpAbandoned() {
  for (const pathname of await store.takeExpiredUploads()) await discard(pathname);
}

export { discard };

const text = (value, max) => String(value ?? '').trim().slice(0, max);

export function readMeta(body) {
  const title = text(body?.title, 120);
  const description = text(body?.description, 500);
  if (title.length < 3) throw new UserError('Атауын жазыңыз (кемінде 3 таңба).');
  if (!CATEGORIES.includes(body?.category)) throw new UserError('Санатты таңдаңыз.');
  if (description.length < 5) throw new UserError('Қысқаша сипаттама жазыңыз (кемінде 5 таңба).');
  return { title, description, category: body.category };
}

export async function createRecord(req) {
  const meta = readMeta(req.body);
  const file = await finishUpload(req.body.uploadId, 'document');
  try {
    await store.addFile({
      id: randomUUID(), ...meta, ...file,
      author: '',
      status: 'approved',
    });
  } catch (err) {
    await discard(file.pathname);
    throw err;
  }
}

export function parseHeroUrl(value) {
  const url = text(value, 1000);
  if (URL.canParse(url) && ['http:', 'https:'].includes(new URL(url).protocol)) return new URL(url).href;
  throw new UserError('Сурет сілтемесі https:// деп басталуы керек.');
}

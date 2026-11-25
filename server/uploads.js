import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import {
  CATEGORIES, FILES_DIR, FILE_EXTENSIONS, HERO_DIR, IMAGE_EXTENSIONS, MAX_FILE_MB, MAX_IMAGE_MB,
} from './config.js';

export class UserError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const extOf = (name) => path.extname(name).slice(1).toLowerCase();

function uploader(dir, field, extensions, maxMb) {
  return multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (req, file, cb) => cb(null, `${randomUUID()}.${extOf(file.originalname)}`),
    }),
    limits: { fileSize: maxMb * 1024 * 1024, files: 1, fields: 10, fieldSize: 10_000 },
    fileFilter: (req, file, cb) => {
      if (extensions.includes(extOf(file.originalname))) cb(null, true);
      else cb(new UserError(`Бұл файл түрі қабылданбайды. Рұқсат етілгені: ${extensions.join(', ').toUpperCase()}.`));
    },
  }).single(field);
}

export const uploadDocument = uploader(FILES_DIR, 'file', FILE_EXTENSIONS, MAX_FILE_MB);
export const uploadHero = uploader(HERO_DIR, 'image', IMAGE_EXTENSIONS, MAX_IMAGE_MB);

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

export function verifyContent(file) {
  const buffer = Buffer.alloc(Math.min(512, file.size));
  const fd = fs.openSync(file.path, 'r');
  fs.readSync(fd, buffer, 0, buffer.length, 0);
  fs.closeSync(fd);
  if (!file.size || !CHECKS[extOf(file.filename)](buffer)) {
    throw new UserError('Файл бос немесе мазмұны кеңейтіміне сәйкес емес.');
  }
}

export function discard(req) {
  if (req.file) fs.rmSync(req.file.path, { force: true });
}

const text = (value, max) => String(value ?? '').trim().slice(0, max);

export function readMeta(body) {
  const title = text(body?.title, 120);
  const description = text(body?.description, 500);
  if (title.length < 3) throw new UserError('Атауын жазыңыз (кемінде 3 таңба).');
  if (!CATEGORIES.includes(body?.category)) throw new UserError('Санатты таңдаңыз.');
  if (description.length < 5) throw new UserError('Қысқаша сипаттама жазыңыз (кемінде 5 таңба).');
  return { title, description, category: body.category };
}

export function buildRecord(req, status) {
  if (!req.file) throw new UserError('Файлды таңдаңыз.');
  const meta = readMeta(req.body);
  verifyContent(req.file);
  return {
    id: randomUUID(),
    ...meta,
    author: text(req.body.author, 80),
    ext: extOf(req.file.filename),
    storedName: req.file.filename,
    size: req.file.size,
    status,
    downloads: 0,
    createdAt: new Date().toISOString(),
  };
}

export function parseHeroUrl(value) {
  const url = text(value, 1000);
  if (URL.canParse(url) && ['http:', 'https:'].includes(new URL(url).protocol)) return new URL(url).href;
  throw new UserError('Сурет сілтемесі https:// деп басталуы керек.');
}

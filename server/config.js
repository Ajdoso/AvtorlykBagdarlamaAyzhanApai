import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ON_VERCEL = Boolean(process.env.VERCEL);

// Local storage only. On Vercel the site uses Neon Postgres and Vercel Blob.
export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
export const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const USE_BLOB = Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);

export const PORT = Number(process.env.PORT) || 3000;
// Only this computer can reach the local site by default (HOST=0.0.0.0 opens it to the network).
export const HOST = process.env.HOST || '127.0.0.1';

// Defaults for local use. On Vercel, login stays closed until ADMIN_PASSWORD is set there.
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@admin.kz';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
export const ADMIN_READY = !ON_VERCEL || Boolean(process.env.ADMIN_PASSWORD);

// ---------------------------------------------------------------------------
// HERO IMAGE: the default picture behind the title on the home page.
// Put your own picture in public/images/ and change this path, for example:
//   '/images/my-photo.jpg'    (1920x1200 or larger, main subject on the right)
// An image chosen in the admin panel takes priority over this one.
// ---------------------------------------------------------------------------
export const DEFAULT_HERO_IMAGE = '/images/hero-placeholder.svg';

export const CATEGORIES = ['cleaning', 'food', 'cosmetics', 'medicine', 'general'];
export const FILE_EXTENSIONS = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'];
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif'];
export const MAX_FILE_MB = 25;
export const MAX_IMAGE_MB = 8;
export const MAX_PENDING = 100; // unreviewed public submissions kept at once

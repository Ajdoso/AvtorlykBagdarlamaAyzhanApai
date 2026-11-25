import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
export const FILES_DIR = path.join(DATA_DIR, 'files');
export const HERO_DIR = path.join(DATA_DIR, 'hero');
export const SEED_DIR = path.join(ROOT, 'seed');

export const PORT = Number(process.env.PORT) || 3000;
// Only this computer can reach the site by default.
// Set HOST=0.0.0.0 to open it to a local network or a hosting platform.
export const HOST = process.env.HOST || '127.0.0.1';

// Change these through environment variables before putting the site online.
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@admin.kz';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

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

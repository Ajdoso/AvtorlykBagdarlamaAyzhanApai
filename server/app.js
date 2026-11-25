import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import express from 'express';
import * as config from './config.js';
import * as store from './store.js';
import { UserError } from './errors.js';
import { isAdmin, login, logout, rateLimit, requireAdmin } from './auth.js';
import { adminReviews, reviews } from './reviews.js';
import { storage, usesDisk } from './storage.js';
import {
  cleanUpAbandoned, createRecord, discard, extOf, finishUpload, maxBytes, parseHeroUrl, readMeta, startUpload,
} from './uploads.js';
import { users } from './users.js';

const app = express();
app.disable('x-powered-by');
// Behind a proxy (Vercel or other hosting) the visitor's address comes from a trusted header.
if (config.ON_VERCEL || process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // vercel.com/api/blob is where the browser sends uploads.
    'Content-Security-Policy':
      "default-src 'self'; connect-src 'self' https://vercel.com/api/blob/ https://vercel.com/api/blob; img-src 'self' data: blob: https: http:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  });
  next();
});
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '50kb' }));

const view = (name) => path.join(config.ROOT, 'views', name);
const HOUR = 60 * 60 * 1000;

/* ---------- Pages ---------- */
app.get('/', (req, res) => res.sendFile(view('index.html')));
app.get('/admin', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (await isAdmin(req)) return res.redirect('/admin/dashboard');
  res.sendFile(view('login.html'), { cacheControl: false });
});
app.get('/admin/dashboard', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!(await isAdmin(req))) return res.redirect('/admin');
  res.sendFile(view('dashboard.html'), { cacheControl: false });
});

/* ---------- Public API ---------- */
const publicView = ({ id, title, description, category, author, ext, size, downloads, createdAt }) =>
  ({ id, title, description, category, author, ext, size, downloads, createdAt });

async function heroState() {
  const custom = await store.getHero();
  return { heroImage: custom || config.DEFAULT_HERO_IMAGE, isDefault: !custom };
}

app.get('/api/settings', async (req, res) => res.json(await heroState()));

app.get('/api/files', async (req, res) => {
  res.json((await store.listFiles()).filter((f) => f.status === 'approved').map(publicView));
});

app.get('/api/files/:id/download', async (req, res, next) => {
  const file = await store.getFile(req.params.id);
  if (!file) return next();
  const admin = await isAdmin(req);
  if (file.status !== 'approved' && !admin) return next();
  const stream = await storage.open(file.pathname);
  if (!stream) return next();
  if (!admin) await store.countDownload(file.id);
  const safeName = file.title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').trim() || 'file';
  res.attachment(`${safeName}.${file.ext}`);
  res.type('application/octet-stream');
  await send(stream, res);
});

// The visitor may close the page half-way; that is not a server error.
async function send(stream, res) {
  try {
    await pipeline(stream, res);
  } catch (err) {
    if (err.code !== 'ERR_STREAM_PREMATURE_CLOSE') console.error('Stream failed:', err.message);
    res.destroy();
  }
}

app.get('/hero/:name', async (req, res, next) => {
  const { name } = req.params;
  if (!/^[0-9a-f-]{36}\.[a-z]{3,4}$/.test(name) || (await store.getHero()) !== `/hero/${name}`) return next();
  const stream = await storage.open(`hero/${name}`);
  if (!stream) return next();
  res.type(extOf(name));
  res.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, immutable');
  await send(stream, res);
});

/* ---------- Uploads ---------- */
if (usesDisk) {
  app.put('/api/uploads/:id/content', requireAdmin, async (req, res) => {
    res.set('Connection', 'close'); // a refused upload leaves the connection unusable
    const upload = await store.getUpload(req.params.id);
    if (!upload) throw new UserError('Жүктеу уақыты өтіп кетті. Файлды қайта таңдаңыз.');
    await storage.write(upload.pathname, req, maxBytes(upload.kind));
    res.json({ ok: true });
  });
}

/* ---------- Accounts and reviews ---------- */
app.use('/api/users', users);
app.use('/api/reviews', reviews);

/* ---------- Admin API ---------- */
app.post('/api/admin/login', rateLimit({
  name: 'login', max: 8, windowMs: HOUR / 4, message: 'Кіру әрекеті тым көп. 15 минуттан кейін қайталаңыз.',
}), login);
app.post('/api/admin/logout', logout);

const admin = express.Router();
admin.use(requireAdmin);

admin.get('/files', async (req, res) => {
  await cleanUpAbandoned();
  res.json((await store.listFiles()).map((f) => ({ ...publicView(f), status: f.status })));
});
admin.post('/uploads', async (req, res) => res.status(201).json(await startUpload(req.body)));
admin.post('/files', async (req, res) => {
  await createRecord(req);
  res.status(201).json({ ok: true });
});

admin.use('/reviews', adminReviews);

const found = (value) => {
  if (!value) throw new UserError('Файл табылмады.', 404);
  return value;
};
admin.patch('/files/:id', async (req, res) => {
  found(await store.updateMeta(req.params.id, readMeta(req.body)));
  res.json({ ok: true });
});
admin.post('/files/:id/approve', async (req, res) => {
  found(await store.approveFile(req.params.id));
  res.json({ ok: true });
});
admin.delete('/files/:id', async (req, res) => {
  const { pathname } = found(await store.removeFile(req.params.id));
  await discard(pathname);
  res.json({ ok: true });
});

async function replaceHero(value, res) {
  const old = await store.setHero(value);
  if (old?.startsWith('/hero/') && old !== value) await discard(old.slice(1));
  res.json(await heroState());
}
admin.put('/hero/file', async (req, res) => {
  const { pathname } = await finishUpload(req.body?.uploadId, 'hero');
  await replaceHero(`/${pathname}`, res);
});
admin.put('/hero/url', (req, res) => replaceHero(parseHeroUrl(req.body?.url), res));
admin.delete('/hero', (req, res) => replaceHero(null, res));
app.use('/api/admin', admin);

/* ---------- Static (on Vercel the CDN serves public/) ---------- */
app.use(express.static(path.join(config.ROOT, 'public')));

/* ---------- Errors ---------- */
app.use('/api', (req, res) => res.status(404).json({ error: 'Табылмады.' }));
app.use((req, res) => res.status(404).sendFile(view('404.html')));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof UserError) return res.status(err.status).json({ error: err.message });
  if (err.status >= 400 && err.status < 500) return res.status(err.status).json({ error: 'Сұрау қате құрылған.' });
  console.error(err);
  res.status(500).json({ error: 'Серверде қате шықты. Қайталап көріңіз.' });
});

export default app;

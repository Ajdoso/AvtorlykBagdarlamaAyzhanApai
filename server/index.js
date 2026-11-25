import path from 'node:path';
import express from 'express';
import multer from 'multer';
import * as config from './config.js';
import * as store from './store.js';
import { isAdmin, login, logout, rateLimit, requireAdmin } from './auth.js';
import {
  UserError, buildRecord, discard, parseHeroUrl, readMeta, uploadDocument, uploadHero, verifyContent,
} from './uploads.js';

const app = express();
app.disable('x-powered-by');
// Behind a reverse proxy (hosting), set TRUST_PROXY=1 so HTTPS and visitor IPs are detected.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data: blob: https: http:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
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
app.get('/admin', (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (isAdmin(req)) return res.redirect('/admin/dashboard');
  res.sendFile(view('login.html'), { cacheControl: false });
});
app.get('/admin/dashboard', (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!isAdmin(req)) return res.redirect('/admin');
  res.sendFile(view('dashboard.html'), { cacheControl: false });
});

/* ---------- Public API ---------- */
const publicView = ({ id, title, description, category, author, ext, size, downloads, createdAt }) =>
  ({ id, title, description, category, author, ext, size, downloads, createdAt });
const heroState = () => ({
  heroImage: store.getHero() || config.DEFAULT_HERO_IMAGE,
  isDefault: !store.getHero(),
});

app.get('/api/settings', (req, res) => res.json(heroState()));

app.get('/api/files', (req, res) => {
  res.json(store.listFiles().filter((f) => f.status === 'approved').map(publicView));
});

app.get('/api/files/:id/download', (req, res, next) => {
  const file = store.getFile(req.params.id);
  const admin = isAdmin(req);
  if (!file || (file.status !== 'approved' && !admin)) return next();
  const safeName = file.title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').trim() || 'file';
  if (!admin) store.updateFile(file.id, { downloads: file.downloads + 1 });
  res.download(path.join(config.FILES_DIR, file.storedName), `${safeName}.${file.ext}`, (err) => {
    if (err && !res.headersSent) next();
  });
});

const submitLimit = rateLimit({
  max: 10, windowMs: HOUR, message: 'Тым көп файл жіберілді. Бір сағаттан кейін қайталаңыз.',
});
function queueHasRoom(req, res, next) {
  const pending = store.listFiles().filter((f) => f.status === 'pending').length;
  next(pending >= config.MAX_PENDING ? new UserError('Тексеру кезегі толды. Кейінірек қайталаңыз.', 503) : undefined);
}
app.post('/api/submissions', submitLimit, queueHasRoom, uploadDocument, (req, res) => {
  store.addFile(buildRecord(req, 'pending'));
  res.status(201).json({ ok: true });
});

/* ---------- Admin API ---------- */
app.post('/api/admin/login', rateLimit({
  max: 8, windowMs: HOUR / 4, failuresOnly: true, message: 'Қате әрекет тым көп. 15 минуттан кейін қайталаңыз.',
}), login);
app.post('/api/admin/logout', logout);

const admin = express.Router();
admin.use(requireAdmin);

admin.get('/files', (req, res) => {
  res.json(store.listFiles().map((f) => ({ ...publicView(f), status: f.status })));
});
admin.post('/files', uploadDocument, (req, res) => {
  store.addFile(buildRecord(req, 'approved'));
  res.status(201).json({ ok: true });
});
admin.patch('/files/:id', (req, res) => {
  if (!store.updateFile(req.params.id, readMeta(req.body))) throw new UserError('Файл табылмады.', 404);
  res.json({ ok: true });
});
admin.post('/files/:id/approve', (req, res) => {
  if (!store.updateFile(req.params.id, { status: 'approved' })) throw new UserError('Файл табылмады.', 404);
  res.json({ ok: true });
});
admin.delete('/files/:id', (req, res) => {
  if (!store.removeFile(req.params.id)) throw new UserError('Файл табылмады.', 404);
  res.json({ ok: true });
});

admin.put('/hero/file', uploadHero, (req, res) => {
  if (!req.file) throw new UserError('Суретті таңдаңыз.');
  verifyContent(req.file);
  store.setHero(`/hero/${req.file.filename}`);
  res.json(heroState());
});
admin.put('/hero/url', (req, res) => {
  store.setHero(parseHeroUrl(req.body?.url));
  res.json(heroState());
});
admin.delete('/hero', (req, res) => {
  store.setHero(null);
  res.json(heroState());
});
app.use('/api/admin', admin);

/* ---------- Static ---------- */
const fonts = (name) => express.static(path.join(config.ROOT, 'node_modules/@fontsource-variable', name));
app.use('/fonts/geologica', fonts('geologica'));
app.use('/fonts/golos', fonts('golos-text'));
app.use('/hero', express.static(config.HERO_DIR));
app.use(express.static(path.join(config.ROOT, 'public')));

/* ---------- Errors ---------- */
app.use('/api', (req, res) => res.status(404).json({ error: 'Табылмады.' }));
app.use((req, res) => res.status(404).sendFile(view('404.html')));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  discard(req);
  if (res.headersSent) return next(err);
  if (err instanceof UserError) return res.status(err.status).json({ error: err.message });
  if (err instanceof multer.MulterError) {
    const limit = req.originalUrl.includes('/hero') ? config.MAX_IMAGE_MB : config.MAX_FILE_MB;
    const error = err.code === 'LIMIT_FILE_SIZE'
      ? `Файл тым үлкен. Шегі — ${limit} МБ.`
      : 'Файлды қабылдау мүмкін болмады.';
    return res.status(400).json({ error });
  }
  if (err.status >= 400 && err.status < 500) return res.status(err.status).json({ error: 'Сұрау қате құрылған.' });
  console.error(err);
  res.status(500).json({ error: 'Серверде қате шықты. Қайталап көріңіз.' });
});

app.listen(config.PORT, config.HOST, (err) => {
  if (err) {
    console.error(err.message);
    process.exit(1);
  }
  console.log(`Сайт:   http://localhost:${config.PORT}`);
  console.log(`Әкімші: http://localhost:${config.PORT}/admin`);
  if (config.HOST !== '127.0.0.1' && !process.env.ADMIN_PASSWORD) {
    console.warn('НАЗАР: әдепкі құпиясөз қолданылып тұр. ADMIN_PASSWORD айнымалысын орнатыңыз.');
  }
});

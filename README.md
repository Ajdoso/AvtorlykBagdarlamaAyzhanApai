# Химияның тұрмыста қолдануы

Қазақ тіліндегі білім беру сайты: ақпараттық бөлімдер, файлдар кітапханасы және әкімші панелі.
(Website in Kazakh with a file library and an admin panel. Node.js + Express, no build step, no external database.)

## Іске қосу / Run

Node.js 20 or newer is required.

```powershell
npm install
```

```powershell
npm start
```

- Сайт: http://localhost:3000
- Әкімші панелі: http://localhost:3000/admin (`admin@admin.kz` / `admin123`)

`npm run dev` restarts the server whenever server code changes.

## Басты суретті ауыстыру / Swap the hero image

1. **Admin panel (easiest):** `/admin` → «Басты сурет» → choose a file or paste an image link. «Бастапқы суретке қайтару» restores the default.
2. **In code:** copy your picture to `public/images/`, then change `DEFAULT_HERO_IMAGE` in `server/config.js` and restart.

Use a picture of 1920×1200 or larger with its main subject on the right: the title sits on the left.

## Құрылымы / Structure

| Path | What is there |
| --- | --- |
| `server/config.js` | Port, login, hero image, file limits |
| `server/index.js` | Pages and API routes |
| `server/auth.js` | Login sessions and rate limits |
| `server/uploads.js` | Upload checks |
| `server/store.js` | JSON storage |
| `views/` | HTML pages |
| `public/js/site/content.js` | Educational texts of the topic tabs |
| `public/css/base.css` | Colors and shared components |
| `seed/` | Sample materials copied in on the first start |
| `data/` | Uploaded files and database, created on first start. **Back this up.** Delete it to start over |

## Файл жіберу / Uploads

Visitors can submit a file with «Материал ұсыну». It stays hidden until the admin presses «Жариялау».
Allowed: PDF, DOC(X), PPT(X), XLS(X), TXT, up to 25 MB. Files are not virus-scanned, so check a submission before publishing it.

## Интернетке шығарар алдында / Before going online

| Variable | Purpose |
| --- | --- |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | **Replace the default login** |
| `HOST=0.0.0.0` | Accept connections from other devices |
| `PORT` | Port, 3000 by default |
| `TRUST_PROXY=1` | When behind an HTTPS reverse proxy |
| `DATA_DIR` | Storage folder; must be a persistent disk |

Serverless hosting with no persistent disk (Vercel, for example) will not keep uploads. Use a VPS or a host with a persistent volume.

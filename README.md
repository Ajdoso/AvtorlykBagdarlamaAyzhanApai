# Химияның тұрмыста қолдануы

Қазақ тіліндегі білім беру сайты: ақпараттық бөлімдер, файлдар кітапханасы және әкімші панелі.
Node.js + Express, no build step. Runs on Vercel (Neon Postgres + Vercel Blob) and locally with no accounts.

## Run locally

Node.js 22 or newer.

```powershell
npm install
```

```powershell
npm start
```

- Site: http://localhost:3000
- Admin: http://localhost:3000/admin (`admin@admin.kz` / `admin123`, local default)

Local data lives in `data/` and is not uploaded to Git. Local and online data are separate.

## Publish on Vercel

1. Push this folder to GitHub.
2. On vercel.com: **Add New > Project**, import the repository. Keep the default settings and press **Deploy**.
   Pages open already; files and login start working after steps 3-5.
3. In the project, **Storage**: create a **Neon** Postgres database and connect it (adds `DATABASE_URL`).
4. In **Storage**: create a **Blob** store with **Private** access and connect it (adds `BLOB_STORE_ID`).
   Connect both to Production and Development.
5. **Settings > Environment Variables**, for Production: add `ADMIN_PASSWORD` (a strong one) and, if you want, `ADMIN_EMAIL`.
   Online login is refused until `ADMIN_PASSWORD` exists.
6. **Deployments**: redeploy the latest one so it picks up the variables.

### Copy the local files online (once)

Stop the local server, then:

```powershell
npx vercel login
```

```powershell
npx vercel link
```

```powershell
npx vercel env pull .env.local
```

```powershell
npm run push-data
```

It can be run again safely; files already online are skipped.

## Hero image

1. **Admin panel:** `/admin` > «Басты сурет»: choose a file or paste a link.
2. **In code:** put a picture in `public/images/` and change `DEFAULT_HERO_IMAGE` in `server/config.js`.

Use 1920x1200 or larger with the subject on the right: the title sits on the left.

## Uploads

Visitors submit with «Материал ұсыну»; the file stays hidden until the admin presses «Жариялау».
PDF, DOC(X), PPT(X), XLS(X), TXT, up to 25 MB. Files are not virus-scanned: check before publishing.

## Structure

| Path | What is there |
| --- | --- |
| `api/index.js`, `vercel.json` | Vercel entry point and settings |
| `server/app.js` | Pages and API routes |
| `server/config.js` | Login, hero image, file limits |
| `server/db.js`, `server/store.js` | Database connection and queries |
| `server/storage.js` | File contents: Blob or `data/` |
| `server/uploads.js`, `server/auth.js` | Upload checks, login |
| `scripts/push-data.js` | Copies local files online |
| `views/`, `public/` | Pages, styles, scripts |
| `public/js/site/content.js` | Educational texts |

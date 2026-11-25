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

## Files

Only the admin adds files: PDF, DOC(X), PPT(X), XLS(X), TXT, up to 25 MB.

## Reviews and accounts

- A visitor registers with a display name, a login and a password (stored as a scrypt hash), then leaves one review with 1-5 stars.
  They can edit or delete it and delete the account. No email is collected, so a forgotten password cannot be restored.
- The admin replies to, hides or deletes reviews and blocks authors under «Пікірлер» in `/admin`.
- Spam protection (`server/spam.js`): one review per account, a hidden puzzle and a trap field at registration, limits per address
  and account, no links, phone numbers, emails, repeated characters or copied texts. Rude words send a review to the admin first.
- Everything is stored in the database; tables are created automatically.

## Structure

| Path | What is there |
| --- | --- |
| `api/index.js`, `vercel.json` | Vercel entry point and settings |
| `server/app.js` | Pages and API routes |
| `server/config.js` | Login, hero image, file limits |
| `server/db.js`, `server/store.js` | Database connection and queries |
| `server/storage.js` | File contents: Blob or `data/` |
| `server/uploads.js`, `server/auth.js` | Upload checks, admin login |
| `server/users.js`, `server/reviews.js`, `server/spam.js` | Accounts, reviews, spam protection |
| `scripts/push-data.js` | Copies local files online |
| `views/`, `public/` | Pages, styles, scripts |
| `public/js/site/content.js` | Educational texts |

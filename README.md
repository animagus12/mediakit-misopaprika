# mediakit-misopaprika

Creator dashboard for [@misopaprika](https://misopaprika.vercel.app): campaign
and brand CRM, invoicing, a public media kit, and a link-in-bio page.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_PASSWORD` | yes | Single shared password for the dashboard login. |
| `SESSION_SECRET` | yes | Signs the session cookie. Any long random string. |
| `KV_REST_API_URL` | yes | Upstash Redis. Without it every repository falls back to the read-only seeds in `data/`. |
| `KV_REST_API_TOKEN` | yes | Upstash Redis token. |
| `BLOB_READ_WRITE_TOKEN` | yes | Vercel Blob, for client-side image uploads. Read by the SDK, never referenced in code. |
| `CRON_SECRET` | yes | Authorizes the `/api/cron/*` routes. |
| `INSTAGRAM_ACCESS_TOKEN` | no | Instagram follower counts. Omit and the stat is simply absent. |
| `YOUTUBE_API_KEY` | no | YouTube subscriber counts. |
| `YOUTUBE_CHANNEL_ID` | no | Channel the YouTube cron reads. |

> `.env.local` in this repo points at the **live** Upstash store. Local dev
> shares production data.

## Architecture

UI to repository to service to external API or storage. Repositories expose
domain models only; no parsing or mapping lives in a component.

- `app/` App Router pages, server actions, and route handlers. Server
  Components by default.
- `repositories/` Domain models and reads. A `*.writer.server.ts` sibling holds
  the Redis-backed writes and is never imported from a client component.
- `services/` External APIs (Instagram, YouTube).
- `data/` Bundled JSON seeds. These are the fallback whenever Redis is not
  configured, not the primary store.
- `lib/` Pure helpers and shared server utilities.
- `components/ui/` shadcn primitives. Everything else is composed from them.

## Scheduled jobs

`vercel.json` runs daily crons that refresh cached social stats (YouTube at
11:30 AM IST and Instagram at 12:00 PM IST) and save an encrypted online backup
at 12:30 PM IST. All cron routes require `CRON_SECRET`. The backup job also
requires `BLOB_READ_WRITE_TOKEN` and retains only the newest three online
snapshots. These are the jobs' daily IST firing times.

## Backup and restore

Use **Backup & restore** in the dashboard to download a versioned JSON snapshot
of workspace records, create an encrypted online snapshot in Vercel Blob, or
restore from either source. Online snapshots are timestamped, paginated, and
the newest three are kept; creating another removes the oldest. A daily
snapshot is created automatically at 12:30 PM IST. Restoring
replaces all supported records in the current workspace, so the app asks for
confirmation first. A preview shows the snapshot timestamp, record counts, and
which drafts or published pages are present without exposing record contents;
timestamps in the viewer are shown in IST.
Backups include brands, campaigns, invoices, calendar and editor records,
affiliate records, media kit and links drafts and published content, Trash,
and recent activity. They exclude credentials and visitor analytics; uploaded
files in external storage are not copied (only their record links are
retained). Online snapshots use `SESSION_SECRET` for encryption; keep it stable
or previously saved online backups cannot be decrypted.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server. |
| `npm run build` | Production build. |
| `npm start` | Serve the production build. |
| `npm run lint` | ESLint. |

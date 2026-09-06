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

`vercel.json` runs two crons that refresh cached social stats: YouTube at
06:00 UTC and Instagram at 06:30 UTC. Both require `CRON_SECRET`.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server. |
| `npm run build` | Production build. |
| `npm start` | Serve the production build. |
| `npm run lint` | ESLint. |

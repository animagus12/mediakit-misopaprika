# mediakit-misopaprika

Creator dashboard for [@misopaprika](https://misopaprika.vercel.app): campaign
and brand CRM, invoicing, bookkeeping and TDS, a public media kit, and a
link-in-bio page.

## Features

### Public pages

Anyone with the link can open these.

- `/mediakit` The published media kit: audience stats, services and starting
  rates, booking terms, past collabs and featured content.
- `/links` Link-in-bio page with socials, creator codes and live follower
  counts. Views, unique visitors and link clicks are counted; the owner's own
  visits are not.

### Create

- **Edit Media kit** (`/mediakit-generator`) Draft, publish and save the media
  kit as an edge-to-edge A4 PDF.
- **Edit Links** (`/links-editor`) Sections, links, scheduling and per-link
  click stats. Draft and publish, with Ctrl+S to save.

### Manage

- **Dashboard** (`/`) Active campaigns, payments due, what needs attention and
  audience figures.
- **Campaigns** Every brand deal: deliverables, status, usage rights and
  renewals, payments and costs.
- **Content calendar** Own reels and brand deals on one calendar.
- **Invoices** Create, edit and download invoices as PDF, with payments and
  overdue tracking.
- **Editor workspace** Video editing jobs and editor payouts.
- **Affiliates** Creator codes, commission periods and payouts.
- **Payments** Money in and out by financial year: cash flow, profit, partner
  settle-ups, purchases brands pay back, and CSV export.
- **TDS & tax** TDS withheld from brand payments, by financial year.
- **Brands** Brands, agencies, contacts and notes, with each brand's deal and
  payment history.
- **Activity**, **Trash** and **Backup & restore** Change log, undo for
  deletes, and JSON or encrypted online backups.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router, Server Components, Server
  Actions) and React 19, in strict TypeScript.
- [shadcn/ui](https://ui.shadcn.com) on Radix, Tailwind CSS 4, lucide icons.
- [Upstash Redis](https://upstash.com) as the data store, Vercel Blob for
  uploads.
- Puppeteer with `@sparticuz/chromium` for server-rendered PDFs.
- Vitest for tests. Hosted on Vercel.

> This Next.js version has breaking changes from older releases. Read the
> guide in `node_modules/next/dist/docs/` before relying on an API (see
> [`AGENTS.md`](AGENTS.md)).

## Getting started

Requires Node.js 24 (the version CI uses).

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with
`APP_PASSWORD`.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_PASSWORD` | yes | Single shared password for the dashboard login. |
| `SESSION_SECRET` | yes | Signs the session cookie and encrypts online backups. Any long random string. |
| `KV_REST_API_URL` | yes | Upstash Redis. Without it every repository falls back to the read-only seeds in `data/`, and every save fails. |
| `KV_REST_API_TOKEN` | yes | Upstash Redis token. |
| `BLOB_READ_WRITE_TOKEN` | yes | Vercel Blob, for client-side image uploads. Read by the SDK, never referenced in code. |
| `CRON_SECRET` | yes | Authorizes the `/api/cron/*` routes. |
| `INSTAGRAM_ACCESS_TOKEN` | no | Instagram follower counts. Omit and the stat is simply absent. |
| `YOUTUBE_API_KEY` | no | YouTube subscriber counts. |
| `YOUTUBE_CHANNEL_ID` | no | Channel the YouTube cron reads. |
| `CHROME_EXECUTABLE_PATH` | no | Local dev only: the Chrome or Edge that renders invoice and media kit PDFs. Omit to use one installed in the usual place. On Vercel the bundled `@sparticuz/chromium` is used. |

[`.env.example`](.env.example) explains each one in more detail.

> `.env.local` in this repo points at the **live** Upstash store. Local dev
> shares production data.

## Access

`proxy.ts` sends every dashboard page to `/login` without a valid session
cookie. `/mediakit` and `/links` stay public; the proxy only gives their
visitors an anonymous id for unique-visitor counts. API routes check the
session themselves, the `/api/cron/*` routes check `CRON_SECRET`, and
`/api/links/click` is public but only counts ids on the published links page.
Every server action starts with `requireSession()`.

## Architecture

UI to repository to service to external API or storage. Repositories expose
domain models only; no parsing or mapping lives in a component.

- `app/` App Router pages, server actions, and route handlers. Server
  Components by default.
- `components/` Feature components by area (`campaigns/`, `invoice/`,
  `payments/` and so on), composed from the shadcn primitives in
  `components/ui/`.
- `repositories/` Domain models and reads. A `*.writer.server.ts` sibling holds
  the Redis-backed writes and is never imported from a client component.
- `services/` External APIs (Instagram, YouTube), PDF rendering and backups.
- `lib/` Pure, tested business rules (money, TDS, invoices, the payment
  ledger) and shared server utilities.
- `hooks/` Client hooks, such as the Ctrl+S save shortcut.
- `data/` Bundled JSON seeds. These are the fallback whenever Redis is not
  configured, not the primary store.

Each collection lives under one Redis key as a whole array, and every write
is read, modify, write. Reads use `getRedis()` from `lib/cache.ts` and fall
back to the seed; writes use `requireRedis()`, which throws when the store is
not configured instead of losing the write.

## Money, dates and tax

- All amounts are rupees, rounded to the paisa by `lib/money.ts`, and shown
  with Indian digit grouping (1,00,000).
- Days are `yyyy-mm-dd` keys in India time (`Asia/Kolkata`, see
  `lib/day.ts`), whatever zone the server or browser is in. Older records keep
  `DD/MM/YYYY` sheet dates, converted by `toIsoDate` and `toSheetDate` in
  `lib/campaigns.ts`.
- Reports run on the Indian financial year, 1 April to 31 March
  (`lib/financialYear.ts`).
- Payments are a ledger (`lib/payments.ts`): a deal's or invoice's paid
  amount, balance and TDS are worked out from its recorded payments. Money in
  always lands in the business account. Costs one partner paid personally are
  settled 50/50 between the partners (`lib/partners.ts`).
- Profit counts TDS withheld and barter received as income; purchases a brand
  pays back count toward cash flow only (`lib/moneyBook.ts`).

## PDFs

Invoices and the media kit are rendered on the server by headless Chromium
(`services/printPdf.server.ts`) from their print pages (`/invoices/print`,
`/mediakit-generator/print`), through `/api/invoice/pdf` and
`/api/mediakit/pdf`. The result is the same A4 page from any device. On a
phone, the finished PDF is offered to the share sheet.

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
| `npm run typecheck` | Generate Next's route types, then `tsc --noEmit`. |
| `npm test` | Vitest, once. |
| `npm run ledger:report` | Read a downloaded backup (`LEDGER_BACKUP=path/to/backup.json`) and report what the payment ledger changes in it. Never touches the store. |

## Testing

Tests sit next to the code they cover (`lib/*.test.ts`,
`repositories/*.test.ts`) and run without Redis. Shared builders for deals,
invoices and payments are in `lib/testing/fixtures.ts`.
`lib/ledgerParity.test.ts` pins the money reports to a snapshot in
`lib/__snapshots__/`; update it with `npx vitest run -u` only when a change
to the figures is intended.

## Contributing

- Work on a branch and open the pull request against `develop`.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org)
  (`feat(payments): ...`, `fix(invoices): ...`).
- Add each user-facing change to [`CHANGELOG.md`](CHANGELOG.md) under
  **Unreleased**, in plain language for the creator who uses the app.

Every pull request to `develop` or `main` runs lint, typecheck and test on
GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

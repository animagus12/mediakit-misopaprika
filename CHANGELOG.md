# Changelog

## [Unreleased]
### Added
- **Remember me** on the login form (`components/auth/LoginForm.tsx`) — checking it requests a 30-day session (`REMEMBER_ME_DURATION_MS` in `lib/auth.ts`) instead of the default

### Changed
- Renamed the shared-password auth from `invoice-*` to generic names, since it now gates the whole dashboard rather than just the invoice generator: `lib/invoice-auth.ts` → `lib/auth.ts`, `app/api/invoice-auth/route.ts` → `app/api/auth/route.ts`, `components/invoice/InvoiceLoginForm.tsx` → `components/auth/LoginForm.tsx`, cookie `invoice_session` → `app_session`, env vars `INVOICE_PASSWORD` → `APP_PASSWORD` and `INVOICE_SESSION_SECRET` → `SESSION_SECRET` (updated in `.env.example`/`.env.local`); `proxy.ts`, `app/login/page.tsx`, `app/api/mediakit/upload/route.ts`, and `components/common/NavBar.tsx` updated to match, and the login form's post-login redirect default changed from `/invoice-generator` to `/`
- `lib/auth.ts` — default session lifetime cut from 1 day to 4 hours (`DEFAULT_SESSION_DURATION_MS`); `createSessionToken()` now takes a `durationMs` argument instead of a hardcoded constant, and `app/api/auth/route.ts` picks 4 hours or 30 days based on the login form's `rememberMe` flag

## [1.7.0] - 2026-08-25
### Added
- **Vercel Blob** (`@vercel/blob`) — `/mediakit-generator`'s image pickers (profile photo, collab logos, tile covers) now upload files directly from the browser to Blob storage via `app/api/mediakit/upload/route.ts`, instead of inlining them as base64 in the saved data; requires `BLOB_READ_WRITE_TOKEN`

### Changed
- `components/mediakit/MediaKitGenerator.tsx` — `handleFileChange` uploads to Blob and stores the resulting URL, instead of reading the file into a base64 data URL with `FileReader`
- `next.config.ts` — dropped the `serverActions.bodySizeLimit` override; the draft/published payload no longer carries images, so the default limit is plenty
- `components/mediakit/mediakit.module.css`, `components/invoice/invoice.module.css` — the A4 preview's scale-to-fit is now a pure CSS container query (`.stage { container-type: inline-size }` + `.stageInner { zoom: min(1, calc(100cqw / 210mm)) }`) instead of a `useEffect`-measured `transform: scale()`; removed the now-unused `lib/useMediaKitStageFit.ts` and the matching JS fit logic in `InvoiceGenerator.tsx`, and simplified `MediaKitPublicView.tsx` back to a Server Component

### Fixed
- Save/Publish crashing when an image had just been changed — inline base64 images could push the request past the Proxy's `proxyClientMaxBodySize` (10MB default), silently truncating the body and corrupting the Server Action payload instead of failing cleanly
- Media kit/invoice preview flashing full-size (effectively zoomed in) on load, most noticeable on mobile — the JS-computed scale only applied after the first paint/hydration, so the fixed 210mm-wide sheet briefly rendered unscaled and cropped before snapping to size

## [1.6.0] - 2026-08-25
### Changed
- `repositories/mediakit.writer.server.ts` — media kit draft/published data now reads and writes through Upstash Redis (KV) instead of `fs`, falling back to the bundled `data/mediakit.json` as the seed default; `lib/cache.ts` exports `getRedis()` for reuse
- `app/mediakit-generator/page.tsx` and `components/common/AppShell.tsx` — load the media kit draft via the new async `getMediaKitData()` instead of the old sync, build-time-bundled JSON import
- `.env.example` — notes that `KV_REST_API_URL`/`KV_REST_API_TOKEN` now also gate Save/Publish, not just the view counter

### Fixed
- Save/Publish on `/mediakit-generator` failing in production — Vercel's serverless filesystem is read-only, so the previous `fs.writeFile` to `data/mediakit.json`/`data/mediakit.published.json` could only ever succeed in `next dev`

## [1.5.0] - 2026-08-25
### Added
- Optional Instagram link on the media kit header — the handle becomes clickable on the published kit when set; the email now links out as a `mailto:` too
- Optional per-logo and per-tile links on `/mediakit-generator` — each collab logo and top-performing content tile can point to a URL (e.g. an Instagram post) and becomes clickable on the published kit
- **Vercel Analytics** — `<Analytics />` from `@vercel/analytics/next` wired into the root layout to track page views across the app

### Changed
- Renamed the invoice-generator login route from `/invoice-generator/login` to `/login`
- `repositories/mediakit.ts` — `MediaKitCollabs.logos` is now `MediaKitLogo[]` (`{ src, url }`) instead of `string[]`; `MediaKitTileInput` gained a `url` field — `data/mediakit.json` and `data/mediakit.published.json` migrated to the new shape
- `components/mediakit/MediaKitLogoGrid.tsx` — logo grid now lays out 4 per row (was 6) to make room for each logo's link input

### Fixed

---

## [1.4.0] - 2026-08-25

### Added
- **Media kit generator** (`/mediakit-generator`) — standalone, live-editable one-page media kit (header/stats, services & add-ons, past collabs logo grid, top-performing content tiles) with browser print-to-PDF export; no new dependencies
- `data/mediakit.json` + `repositories/mediakit.ts` — repository-backed media kit defaults (header, stats, services, add-ons, collabs, tiles)
- `lib/mediakit.ts` — `computeMediaKitLayout()` fits the logo grid and content tiles onto a single fixed-height A4 page based on logo count and row mode
- `components/mediakit/` — `MediaKitGenerator`, `MediaKitControls`, `MediaKitLogoGrid`, `MediaKitTileEditor`, `MediaKitImagePickerButton`, `MediaKitPreview`, and a scoped `mediakit.module.css`
- `components/ui/textarea.tsx` — added via the shadcn CLI to support the media kit form
- Add/remove past-collab logo slots (up to 20) with auto/1-row/2-row layout modes
- Click-to-replace image picker for the profile photo, each collab logo, and each reel/tile cover
- `public/mediakit/` — default logos, doodles, tile photos, and profile photo assets
- **Save changes** on `/mediakit-generator` persists edits to `data/mediakit.json` via a server action (`saveMediaKit`), so changes survive a reload instead of living only in form state
- `repositories/mediakit.writer.server.ts` — server-only `fs` write for the media kit JSON, kept out of the client-safe repository barrel
- `lib/mediakit.ts` — `toMediaKitData()` maps editable form state back to the persisted `MediaKitData` shape
- `next.config.ts` — raised the server actions body size limit to 20mb to fit the base64-encoded photo/logos/tile covers the save payload can carry
- **Publish** on `/mediakit-generator` writes a separate published snapshot (`data/mediakit.published.json`) and makes it viewable, read-only, at the new `/mediakit` route — a shareable link with no editing controls
- `repositories/mediakit.writer.server.ts` — `publishMediaKitData()` / `getPublishedMediaKitData()` for writing and reading the published snapshot (returns `null`/404 until the first publish)
- `lib/mediakit.ts` — `toFormState()`, the inverse of `toMediaKitData()`, shared by the generator (seeding the editable draft) and the new public page (rendering a published snapshot)
- `lib/useMediaKitStageFit.ts` — scale-to-fit-viewport hook extracted from the generator so the editor stage and the new public preview share identical sizing behavior
- `components/mediakit/MediaKitPublicView.tsx` — read-only A4 sheet renderer for `/mediakit`, reusing `MediaKitPreview` with no controls panel
- `components/mediakit/MediaKitFontsProvider.tsx` — media kit font loading extracted out of `/mediakit-generator`'s layout so it can be shared with `/mediakit`'s layout too
- `lib/navigation.ts` — shared list of dashboard link entries (href, title, description, icon, access) consumed by both the dashboard home page and the sidebar

### Changed
- Renamed the invoice generator route from `/invoice` to `/invoice-generator`
- `/mediakit-generator` now sits behind the same shared password-protected session as `/invoice-generator`
- Dashboard home page (`/`) replaced the old scroll-anchored landing sections with a grid of link cards to `/mediakit`, `/mediakit-generator`, and `/invoice-generator`
- `components/common/AppSideBar.tsx` — sidebar links now point at real routes instead of anchor-scroll links (`#hero`, `#analytics`, ...), and its header photo now comes from `mediakitRepository` instead of a static logo
- `proxy.ts` — matcher now includes `/`, so the dashboard home page requires the same invoice-generator session as `/invoice-generator`
- `app/mediakit-generator/actions.ts` — `saveMediaKit`/`publishMediaKit` now also revalidate the root layout so the sidebar photo picks up edits immediately
- `components/invoice/InvoiceControls.tsx` — invoice number field now spans the full row width instead of sharing it with the date field
- `components/invoice/invoice.module.css` — panel width consolidated into a `--invoice-panel-width` custom property shared by the desktop and stacked mobile layouts
- `lib/invoice-auth.ts` — the HMAC signing key is now imported once and cached instead of being re-imported on every `sign()` call

### Removed
- `components/sections/` (`Hero`, `Analytics`, `AnalyticsClient`, `Audience`, `Brands`, `Services`, `Videos`, `Contact`) and their backing repositories and data files (`repositories/{hero,analytics,audience,brands,services,videos,contact,sections}.ts`, `data/{hero,analytics,audience,brands,services,videos,contact,sections}.json`) — superseded by the dashboard link grid
- `lib/cache.ts` — `getCachedYouTubeAnalytics()`, unused once the analytics repository was removed

---

## [1.3.0] - 2026-08-24

### Added
- **Invoice generator** (`/invoice`) — standalone, live-editable A4 invoice with browser print-to-PDF export; no new dependencies
- `data/invoice.json` + `repositories/invoice.ts` — repository-backed invoice defaults, deliverable presets, payee details, and barter defaults
- `lib/invoice.ts` — pure formatting/calculation helpers (money, dates, line totals, balance due)
- `components/invoice/` — `InvoiceGenerator`, `InvoiceControls`, `InvoiceLineItemEditor`, `InvoiceImageUploadField`, `InvoicePreview`, and a scoped `invoice.module.css`
- `components/ui/label.tsx`, `select.tsx`, `checkbox.tsx` — added via the shadcn CLI to support the invoice form
- `app/(dashboard)/` route group — carries the sidebar/navbar chrome so `/invoice` renders standalone without it
- Optional "Name" (contact person) field under Billed to, shown on the invoice above the brand name when filled
- Optional QR code and stamp/seal image uploads on the invoice, each independently removable; QR defaults to the account's UPI QR (`public/invoice/qr.jpeg`) when not overridden
- **Password-protected `/invoice`** — `proxy.ts` gates the route behind a signed session cookie; unauthenticated visitors are redirected to `/invoice/login`
- `lib/invoice-auth.ts` — HMAC-signed, expiring session tokens (Web Crypto) and constant-time password verification
- `app/api/invoice-auth/route.ts` — verifies `INVOICE_PASSWORD` and issues the httpOnly session cookie
- `components/invoice/InvoiceLoginForm.tsx` + `app/invoice/login/page.tsx` — password entry form
- `app/robots.ts` — disallows `/invoice`; both `/invoice` and `/invoice/login` set `noindex, nofollow`
- `.env.example` — documents `INVOICE_PASSWORD` and `INVOICE_SESSION_SECRET`

### Changed
- `app/layout.tsx` — trimmed to the root shell (fonts + theme provider); sidebar/navbar moved into the new `app/(dashboard)/layout.tsx`
- `repositories/index.ts` — exports `invoiceRepository` and its types
- "UGC Ad Reel (unposted)" quick-fill preset now includes an Ad Usage line, matching the other presets
- Quick-fill presets no longer prefill the line-item sub-line bullet

### Fixed
- Line-item ids were generated with `Math.random()` during the initial render, causing a React hydration mismatch; switched to deterministic ids for the first render and a counter-based generator for anything added afterward
- Invoice form fields were missing `htmlFor`/`id` associations between labels and inputs
- QTY column was center-aligned, which visually drifted between the regular- and bold-weight rows; switched to right-aligned to match the other numeric columns
- Signature/stamp artwork repositioned to sit flush against the invoice's right edge, matching the source design

### Removed
- "Copy row for transactions sheet" button and its clipboard handler
- Unused hint text under the invoice panel's brand bar

---

## [1.1.0] - 2026-06-21

### Added
- **YouTube API integration** — analytics data is now fetched live from the YouTube Data API v3 instead of being hardcoded
- **Daily caching via Vercel Cron** — a cron job fires every day at 6 AM UTC, fetches channel stats and recent video metrics, and stores them in Upstash Redis (26-hour TTL)
- `services/youtube.ts` — fetches channel statistics, uploads playlist, and per-video stats (views, likes, comments); calculates engagement rate and average views
- `lib/cache.ts` — Upstash Redis wrapper; gracefully no-ops when Redis is not configured (falls back to JSON)
- `app/api/cron/refresh-youtube/route.ts` — protected cron endpoint secured by `CRON_SECRET`
- `vercel.json` — Vercel Cron schedule (`0 6 * * *`)
- `components/sections/AnalyticsClient.tsx` — extracted client-side interactive UI (range selector, stat cards)
- `.env.example` — documents required environment variables

### Changed
- `components/sections/Analytics.tsx` — converted from a client component to an async Server Component; delegates interactive rendering to `AnalyticsClient`
- `repositories/analytics.ts` — `get()` is now async; overlays live YouTube data from Redis onto the JSON fallback (Instagram data remains in JSON)

---

## [1.0.0] - 2026-06-21

### Added
- **Repository architecture** — introduced a repository layer between UI components and JSON data files following the `UI → Repository → Service → External API` pattern
- `repositories/` — added typed repositories for all data domains: analytics, audience, brands, contact, hero, sections, services, videos
- `repositories/index.ts` — central export for all repositories and their TypeScript interfaces
- `CLAUDE.md` — project guidelines covering architecture, code style, Next.js conventions, and response format

### Changed
- All section components (`Analytics`, `Audience`, `Brands`, `Contact`, `Hero`, `Services`, `Videos`) updated to import data via their respective repositories instead of directly from JSON
- `components/common/AppSideBar.tsx` — sidebar updated to use sections repository
- `app/page.tsx` — page layout updated to use repository-driven sections

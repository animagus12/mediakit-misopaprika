# Changelog

## [Unreleased]
### Added
- **Unique visitor count** on `/mediakit-generator`, shown alongside the existing total-views badge
- `lib/visitor.ts` — anonymous first-party visitor cookie name/max-age, shared between `proxy.ts` and the `/mediakit` page
- `lib/cache.ts` — `recordMediaKitVisitor()` / `getMediaKitUniqueVisitors()`, backed by a Redis `SADD`/`SCARD` set (`mediakit_unique_visitors`), separate from the existing total-views counter
- `proxy.ts` — now also matches `/mediakit` (public, no auth added) purely to assign a first-time visitor an `mk_visitor_id` cookie, making the request+response cookie visible to the same render via `NextResponse.next({ request })`
- `components/common/AppShell.tsx` — sidebar+navbar shell (`SidebarProvider` + `TooltipProvider` + `AppSideBar` + `NavBar`) extracted from the dashboard layout so it can be reused elsewhere
- `/mediakit-generator` and `/invoice-generator` now render inside `AppShell`, giving both screens the same sidebar navigation and top navbar (theme toggle, Home, logout) as the rest of the dashboard — previously they had no navigation chrome at all
- `components/mediakit/MediaKitControls.tsx` — second `Badge` ("N unique visitors", `Users` icon) next to the views badge

### Changed
- `app/globals.css` — `--primary` / `--sidebar-primary` (light and dark) switched from the indigo/violet accent to a neutral black/white palette, matching the dashboard's black theme
- `app/(dashboard)/layout.tsx` — now just delegates to `AppShell`
- `app/(dashboard)/page.tsx` — carries its own `px-4` gutter now that the shared shell no longer applies one globally (previously inherited from the old dashboard-only layout)
- `components/mediakit/mediakit.module.css` / `components/invoice/invoice.module.css` — chrome colors (panel background, borders, muted text, legend/toast/hover accents) switched from fixed navy-blue hex values to the app's neutral black/gray theme tokens; the printed A4 sheet itself keeps its own fixed brand colors, unaffected
- `app/mediakit/page.tsx` / `app/mediakit-generator/page.tsx` / `components/mediakit/MediaKitGenerator.tsx` — thread the new `uniqueVisitors` count and visitor cookie through to the controls panel

### Fixed
- `/mediakit-generator` and `/invoice-generator` control panels ignored the app's light/dark theme toggle — their chrome colors were hardcoded hex values instead of referencing `globals.css` tokens, so switching themes had no visible effect there; now they follow the toggle like the rest of the app

### Removed

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

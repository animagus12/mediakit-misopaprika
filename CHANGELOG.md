# Changelog

## [Unreleased]

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

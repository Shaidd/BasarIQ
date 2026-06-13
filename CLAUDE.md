# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**BasarIQ** — a community-driven beef price intelligence web app for Israel. Users log prices (manually, via photo OCR, or automated web extraction), and the app recommends the single best vendor for a shopping list, accounting for proximity and delivery coverage.

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14+ App Router, TypeScript, Tailwind CSS |
| Maps | Leaflet + OpenStreetMap; Nominatim for geocoding |
| Charts | Recharts |
| Backend/DB | Supabase (Postgres + RLS + Auth + Storage + Edge Functions) |
| DB extensions | `pg_trgm` (fuzzy alias search), `earthdistance` or PostGIS (geo radius) |
| LLM | Claude API — model `claude-sonnet-4-6`; vision for photos, text for scraped pages |
| Scheduled jobs | Supabase cron → Edge Functions (nightly extraction); GitHub Actions fallback |
| Hosting | Vercel (frontend) + Supabase Cloud |
| CI | GitHub Actions: typecheck, lint, DB migration check |

## Commands

```bash
# Development
npm run dev          # Next.js dev server
npm run build        # Production build
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint

# Supabase (local)
npx supabase start         # Start local Supabase stack
npx supabase db reset      # Apply migrations + seed from scratch
npx supabase db push       # Push migrations to remote
npx supabase gen types     # Regenerate TypeScript types from DB schema → supabase/types.ts
npx supabase functions serve  # Run edge functions locally

# Testing
npm test             # Run tests
npm test -- --testPathPattern=<file>  # Run a single test file
```

## Build Order (Milestones)

Work through milestones in order — each is independently shippable:

- **M0 — Foundation:** ✅ Supabase schema + RLS policies + seed data (cut catalog, vendor directory from Excel, historical prices)
- **M1 — Core loop:** ✅ Auth (magic link + Google OAuth), vendor/cut browse, manual price entry, per-cut history chart
- **M2 — Photo OCR:** ✅ Upload → Next.js API route (`/api/ocr`) → Claude vision extraction → confirm screen → audit trail
- **M3 — Sourcing engine:** Shopping lists, geo radius + delivery region scoring, single-best-store results UI
- **M4 — Community layer:** Flags, moderator dashboard, vendor suggestions, invite management
- **M5 — Web extraction:** `vendor_sources`, nightly cron job (Supabase Edge Function), extraction review queue

## Architecture

### Data flow

```
User → Next.js App Router (Vercel)
         ↓ Supabase client (RLS-enforced)
         ↓ Next.js API route /api/ocr  ← photo uploads (M2)
              ↓ Claude API (vision extraction)
         ↓ Supabase Edge Functions     ← nightly web extraction only (M5)
              ↓ Claude API (text extraction — same JSON contract)
         ↓ Postgres (cuts, vendors, price_observations, …)
```

### Key modules

**Cut alias resolution** (`lib/aliases.ts`) — shared by manual search, photo OCR, and web extraction. Pipeline: normalize input (strip nikud, punctuation, ₪/kg tokens, lowercase) → exact match on `cut_aliases` → trigram fuzzy match (pg_trgm, similarity ≥ 0.75, top 3) → null if no match. User corrections on the OCR confirm screen are logged to `alias_suggestions` for moderator promotion.

**Claude extraction contract** — one shared JSON schema used by both photo OCR and web extraction (`lib/types/ocr.ts`):
```ts
type ExtractionRow = {
  raw_text: string;           // exact text as seen in the image
  matched_cut_id: string | null;  // resolved by resolve_cut_alias() RPC; null if unmatched
  matched_cut_name: string | null; // cut name as Claude read it (Hebrew or English)
  price: number | null;
  unit: 'per_kg' | 'per_100g' | 'per_unit' | 'ambiguous';
  confidence: number; // 0–1
  needs_review: boolean;
}
```
Claude returns `matched_cut_name` (the raw text label); alias resolution runs server-side via `resolve_cut_alias` RPC and populates `matched_cut_id`. Normalize all prices to ₪/kg before storing (`per_100g` × 10). If unit is ambiguous, set `needs_review: true` — never guess.

**Photo OCR pipeline** (M2) —
- `app/api/ocr/route.ts` — POST endpoint; accepts `multipart/form-data` (`image` + `vendorId`); uploads to Supabase Storage `photos` bucket; inserts `photos` row (audit trail written before calling Claude so it survives API failures); calls `claude-sonnet-4-6` vision with bilingual prompt; runs `resolve_cut_alias` RPC on each row; persists `extraction_json` back to the `photos` row.
- `app/actions/ocr.ts` — `saveOcrObservations` server action; bulk-inserts confirmed rows into `price_observations` with `source='photo'`; logs unresolved `matched_cut_name` values to `alias_suggestions` for moderator promotion.
- `components/OcrUploader.tsx` — client step machine: select vendor → camera/upload → preview → extracting spinner → confirm screen (per-row cut picker + price field + include toggle) → done/error.

**Sourcing engine** (`lib/sourcing.ts`) — candidate set = pickup vendors within radius ∪ delivery vendors whose `delivery_regions` cover user's region. Score = Σ(price × kg) + delivery_fee. Coverage rule: vendor must cover ≥ 70% of list weight; missing cuts penalized at regional 30-day median × 1.15. Exclude delivery vendors below `delivery_min_order`. Always surface data freshness — never silently use stale data.

**Freshness rules:** manual/photo valid 21 days; web_auto 7 days; sale prices expire at `sale_ends_at`. UI badges: 🟢 ≤ 7d / 🟡 8–21d / 🔴 expired (shown but excluded from scoring).

### Database schema (key tables)

- `cuts` + `cut_aliases` — canonical catalog with Israeli numbering, Hebrew/English names, primal, kosher notes (educational only)
- `vendors` — includes `region` (fixed enum: `north|haifa|sharon|center|jerusalem|shfela|south`), `delivers`, `delivery_regions` (`text[]`, `['*']` = nationwide), `delivery_fee`, `delivery_min_order`, `status` (`pending|active|closed|merged`)
- `price_observations` — `source` (`manual|photo|web_auto`), `confidence`, `photo_id`, `status` (`active|hidden|removed`), `last_seen_at` (bumped by dedup)
- `vendor_sources` + `ingestion_runs` — web extraction scheduling and failure tracking
- `flags` — observation flags; notify moderator immediately, no auto-hide
- `invites` — single-use codes (7-day expiry), tracking inviter/invitee

### Auth & roles

Supabase Auth (magic link + Google OAuth). Roles stored in user profile table: `viewer | contributor | moderator`. RLS enforces:
- All `active` rows readable by authenticated users
- Observations writable by contributors; `contributor_id = auth.uid()` enforced server-side
- Own observation editable within 24h; after that, moderator only
- Vendors/cuts/aliases mutations: moderator only (non-moderators create `pending` rows)

### Outlier guard

On price insert: if price is outside [0.3×, 3×] of cut's 90-day regional median → warn user but allow with explicit confirm. `web_auto` outliers always go to moderator review queue.

### Web extraction auto-write rules

Write directly only when: cut matched + price unambiguous in ₪/kg + price within 3× trailing 90-day median. Dedup: identical (vendor, cut, price) within 7 days → bump `last_seen_at` instead of inserting. 3 consecutive fetch failures → mark source `broken`, notify moderator.

## UI Conventions

- **Language:** English LTR. Cut names displayed bilingually (English + Hebrew) everywhere.
- **Bidi:** Hebrew input in search boxes, cut pickers, and OCR confirm screens — use `dir="auto"` on text inputs and display elements containing Hebrew.
- **PWA:** Manual price entries queue offline and sync on reconnect. Photo upload requires connectivity.
- **One vendor per photo** — enforced in UI (no multi-vendor photo flows in v1).

## Decisions Already Made

- UI language: English LTR, bilingual cut names
- Access: invite-only (no public signup)
- Geo scope: all Israel, fixed 7-region taxonomy
- Community size: <10 trusted users — flags notify moderator, no auto-hide, no reputation system
- Kashrut: no filtering/data on vendors; cut-level notes are educational metadata only
- Multi-stop routing: v2
- Price predictions: v2+
- Government price feeds: v2

## Seed Data

Three existing assets to import at M0:
1. Vendor Excel (Sharon + Galilee butchers: name, city, rating, price level) → `vendors` table
2. Cut catalog reference (Israeli numbers, Hebrew names, kosher notes) → `cuts` + `cut_aliases`
3. Historical React tracker entries → `price_observations` with `source=manual`

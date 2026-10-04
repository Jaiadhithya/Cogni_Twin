# Prompt: CogniTwin frontend overhaul

> **How to use this prompt**
>
> The work is split into **4 phases**, each meant to run as its own Sonnet 5.5 session, so you can choose the effort level per phase.
>
> 1. Open a new Claude Code session at `C:\ML Project`, set the effort level, paste everything below the line, attach the **Omni – Platform** reference image, and add one line at the end, for example: **`Do Phase 1 only.`**
> 2. When it finishes, it stops and updates `docs/FRONTEND_OVERHAUL_PROGRESS.md`.
> 3. For the next phase, start a fresh session and send the same prompt + image with **`Do Phase 2 only.`**, and so on.
>
> | Phase | What | Suggested effort |
> |---|---|---|
> | 1 | Foundation: design system, motion system, component kit, app shell, data layer, demo mode | **High** — everything else is built on it |
> | 2 | Core pages: Dashboard, Forecast & What-If, Ask AI, Upload | Medium (High if you can afford one more) |
> | 3 | New pages: Scenarios, Data Explorer, Datasets, Documents, Settings | Medium |
> | 4 | Landing, loading/error/404, clean-up, tests, lint, accessibility, Playwright | Medium |

---

You are rebuilding the frontend of **CogniTwin**, an AI decision-support web app for small and mid-sized Indian retail businesses. A user uploads their sales data, and CogniTwin builds a "digital twin" of the business: a dashboard of what's happening, a forecast of what's coming, what-if scenarios ("what if I raise prices 10%?"), plain-English questions answered with charts, and recommended actions.

The current frontend in `frontend/` works, but its design is a messy mix of several styles, and its code hides backend failures behind fake demo data. **Your job is a full visual and structural rebuild** to a single, clean design system based on the attached reference image, wired honestly to the existing backend.

**This work runs in four phases, one phase per session.** The user's message names the phase to do (e.g. "Do Phase 2 only"). Sections 1–8 are the shared specification that applies to every phase; **§9 defines exactly what each phase covers.** Do only the named phase, then stop (see §10). If no phase is named, ask which one before starting.

Read this whole prompt before writing any code.

---

## 1. The reference design

The attached image is **"Omni – Platform" by @shevmikye** (Neuform). Treat it as the source of truth for the look and feel. It shows a landing hero with a product window inside it. Its KPI cards with change badges, period picker, chart card and glass surfaces are the pattern for **the whole app**, not just the landing page. Its floating pill navigation (logo + links + CTA in a glass capsule) is the pattern for the app's navigation too. **The left sidebar shown inside the reference's product window is deliberately not used** — see §3.1.

What to take from it:
- **Light, airy, glassy.** Near-white background with a very soft pastel gradient wash (blue → lavender → faint warm yellow at the edges). Content sits on frosted white "glass" cards.
- **Calm, confident typography.** Very large, tight headlines; quiet grey body text; generous whitespace.
- **Restrained colour.** Mostly neutral. Blue is the main accent, purple the secondary accent, green for positive change.
- **Rounded, soft surfaces.** Large radii, thin translucent borders, soft diffused shadows. Pill-shaped buttons.
- **Premium motion.** Smooth, purposeful animation throughout — page transitions, staggered reveals, numbers that count, charts that draw, gliding active indicators (see §2.5). It should feel as polished as Linear, Stripe or Apple.
- **Clear hierarchy in data.** KPI card = small grey label → big number → small tinted change badge.

What **not** to carry over from the old design: the dark graphite/amber theme, Space Grotesk / Plus Jakarta / JetBrains Mono fonts, monospace "terminal" labels, breathing status dots, glow effects, WebGL/canvas backgrounds, custom cursors, and the 1-second live clock.

---

## 2. Design system (built in Phase 1)

Define everything as tokens. With Tailwind v4 use `@theme` in `frontend/src/app/globals.css`. No hard-coded hex values in components — only tokens.

### 2.1 Colour

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#F7F8FB` | Page background (under the gradient wash) |
| `--color-surface` | `rgb(255 255 255 / 0.72)` | Glass cards |
| `--color-surface-solid` | `#FFFFFF` | Inputs, menus, tables, anything that needs full contrast |
| `--color-border` | `rgb(15 23 42 / 0.08)` | Card and input borders |
| `--color-border-strong` | `rgb(15 23 42 / 0.14)` | Hover / focus-adjacent borders |
| `--color-ink` | `#0F172A` | Headlines, key numbers |
| `--color-ink-2` | `#475569` | Body text |
| `--color-ink-3` | `#64748B` | Labels, captions (must still pass AA on white) |
| `--color-primary` | `#3B82F6` | Primary accent, links, active nav, main chart series |
| `--color-primary-ink` | `#1D4ED8` | Primary text on light tints |
| `--color-primary-tint` | `#EFF6FF` | Active nav background, primary badges |
| `--color-accent` | `#A855F7` | Secondary accent: AI features, forecast series, gradient end |
| `--color-accent-tint` | `#F5F3FF` | AI/insight card backgrounds |
| `--color-positive` | `#16A34A` | Positive change text (darker than the reference's `#4ADE80` so it passes contrast) |
| `--color-positive-tint` | `#F0FDF4` | Positive badge background |
| `--color-negative` | `#DC2626` | Negative change text |
| `--color-negative-tint` | `#FEF2F2` | Negative badge background |
| `--color-warning` | `#B45309` / tint `#FFFBEB` | Warnings (low confidence, demo mode) |
| `--color-cta` | `#0F172A` | The dark pill CTA ("Deploy Now" style) |

Rules:
- **Green and red mean good and bad. Never use them as decoration.**
- Purple is reserved for AI-generated content (insights, recommendations, AI answers, forecast lines) so users learn "purple = the model said this".
- The blue→purple gradient (`linear-gradient(90deg, var(--color-primary), var(--color-accent))`) is used **only** for the landing headline accent word and at most one hero element. Nowhere in the app.
- Chart palette, in order: primary blue, accent purple, `#06B6D4` cyan, `#F59E0B` amber, `#64748B` slate. Forecast = purple; actuals = blue; confidence band = purple at 12% opacity.

Page background: `--color-bg` plus a fixed, very subtle radial gradient wash (blue top-left, lavender top-right, warm yellow bottom-right, each ≤ 10% opacity). One CSS background, no images, no canvas.

### 2.2 Typography
- **One family: Inter**, loaded with `next/font/google` (weights 400, 500, 600, 700). Remove every other font.
- Use `font-variant-numeric: tabular-nums` for all numbers in KPIs, tables and charts.
- Scale (size / line-height / weight / tracking):
  - Display (landing hero): 72 / 1.0 / 600 / −0.035em (clamp down to 44 on mobile)
  - H1 (page title): 30 / 1.2 / 600 / −0.02em
  - H2 (card title): 18 / 1.4 / 600 / −0.01em
  - KPI number: 32 / 1.1 / 600 / −0.02em
  - Body: 15 / 1.6 / 400
  - Small / label: 13 / 1.4 / 500, colour `--color-ink-3`
  - Eyebrow pill ("NEXT-GEN WORKFLOWS" style): 12 / 600 / +0.06em uppercase — **landing page only**.

### 2.3 Shape, depth, motion
- Radius: cards 20px, inner panels 14px, inputs/buttons 12px, pills/badges 9999px.
- Glass card: `background: var(--color-surface); backdrop-filter: blur(16px) saturate(140%); border: 1px solid var(--color-border); box-shadow: 0 1px 2px rgb(15 23 42 / 0.04), 0 8px 24px rgb(15 23 42 / 0.06);`
- Provide a solid fallback when `backdrop-filter` is unsupported.
- Spacing scale on a 4px grid; card padding 24px desktop, 16px mobile; grid gap 20–24px.
- Motion is a first-class part of the design. See **§2.5** — it must feel premium.

### 2.4 Buttons, badges, inputs
- **Primary CTA**: dark pill (`--color-cta`, white text), optional trailing icon — matches "Deploy Now".
- **Secondary**: white pill with `--color-border-strong` border — matches "Explore Platform".
- **Tertiary / ghost**: text button with primary colour.
- **Change badge**: pill, 12px semibold, tinted background, e.g. `+14.2%` green on green tint; negative red on red tint; neutral slate.
- **Inputs**: solid white, 12px radius, 1px border, 3px primary focus ring at 30% opacity.
- Icons: `lucide-react`, 16–20px, stroke 1.75, colour inherits.

### 2.5 Motion and transitions (premium feel)

The app must feel **premium, fluid and alive** — think Linear, Vercel, Stripe, Apple. Motion should make the interface feel expensive and responsive, never busy or gimmicky. Every animation has a purpose: guiding attention, showing cause and effect, or confirming an action.

**Tooling.** Use `framer-motion` (already installed; `motion` API) for orchestrated, layout and gesture animations, and CSS transitions for simple hovers. Put all motion values in one module, `src/lib/motion.ts` — no ad-hoc durations or easings in components.

**Motion tokens:**
- Easing: `easeOutExpo` `cubic-bezier(0.16, 1, 0.3, 1)` for entrances; `cubic-bezier(0.4, 0, 0.2, 1)` for state changes; springs for anything the user drags or toggles (`stiffness ~300, damping ~30`, no visible wobble).
- Durations: micro 120–160ms (hover, press), standard 220–280ms (menus, tabs, cards), emphasis 400–600ms (page entrance, hero, charts). Nothing slower than 700ms except the landing hero.
- Stagger: 40–60ms between siblings, maximum ~8 staggered items per group.

**Required moments:**
1. **Page transitions** — content fades in with a slight upward move (8–12px) and a subtle blur-to-sharp (`blur(4px)` → `0`); the floating nav pill stays still. Use the App Router with `AnimatePresence` / a template-level wrapper so navigating between pages feels seamless, not like a full reload.
2. **Staggered reveal** — on first load of a page, KPI cards, then charts, then secondary cards rise in sequence.
3. **Number count-up** — KPI numbers and what-if results animate from the previous value to the new one (~600ms, easeOutExpo, tabular figures so digits don't jitter). On dataset or period change they tween, not jump.
4. **Charts draw in** — lines draw left-to-right, bars grow from the baseline, the forecast band fades in after the line; on data change they morph smoothly (Recharts animation props tuned to the motion tokens).
5. **Nav active indicator** — the active link's pill **glides** between links in the floating nav with a shared `layoutId`; the nav compacts smoothly on scroll; the Data menu and mobile sheet spring open. Same sliding pill for segmented controls (period picker, tabs).
6. **Cards** — on hover, lift 2px with a slightly deeper shadow and a faint border brighten (160ms). Press: scale to 0.98.
7. **Buttons** — CTA hover: subtle sheen/gradient sweep or icon nudge (arrow moves 2–3px). Press feedback on every button.
8. **What-if responsiveness** — as sliders move, the scenario line and delta numbers update with a smooth tween; a soft pulse on the delta badge when it settles.
9. **Training progress** — `JobStatus` animates between queued → fitting → done with a smooth progress shimmer and a satisfying check-mark draw on success.
10. **Ask AI** — the user's message slides in; an elegant "thinking" indicator (three softly pulsing dots or a shimmer line, purple); the answer streams in by section — text fades in, then charts draw, then action cards stagger.
11. **Overlays** — dialogs and drawers scale from 0.96 + fade with a backdrop blur fade; dropdowns and tooltips spring in from their trigger origin; toasts slide in and stack smoothly.
12. **Skeletons** — a soft, slow shimmer (1.6s) rather than a flashing pulse; cross-fade from skeleton to content, never pop.
13. **Landing hero** — headline words reveal in a stagger with a slight blur-in; the gradient word has a slow, subtle hue drift; the product window floats in with a gentle 3D tilt that follows the mouse a few degrees (desktop only) and very slow ambient floating. Feature cards reveal on scroll.

**Restraint and performance (equally required):**
- Animate only `transform`, `opacity` and `filter`; never animate layout properties like width/height/top except through framer-motion `layout`.
- Target a steady 60fps on a mid-range laptop. No continuous background animation inside the app (ambient motion is allowed only on the landing hero, and it must pause when off-screen).
- **Respect `prefers-reduced-motion`**: replace movement with simple opacity fades, disable count-ups (show final values), tilt and ambient motion. Provide a `useReducedMotion`-aware helper in `motion.ts` and use it everywhere.
- Motion must never delay the user: content is interactive immediately; entrance animations don't block clicks; repeated navigation doesn't replay long sequences.

---

## 3. App shell and pages

### 3.1 Shell: floating pill navigation (no sidebar)

**Do not use a left sidebar.** Navigation is a **floating glass pill bar** at the top of every app page, in the same style as the Omni reference's landing nav, so the landing page and the app share one navigation language.

**Layout (desktop, ≥ 1024px):**
- A centred capsule floating 16px below the top of the viewport (`position: sticky` inside the page flow, `max-width` ≈ 1120px, full radius, glass card recipe from §2.3 with a slightly stronger shadow). Content scrolls underneath it.
- Inside the pill, left to right:
  1. **Logo**: the CogniTwin mark + wordmark; links to `/dashboard`.
  2. **Primary links**: Dashboard · Forecast · Scenarios · Ask AI.
  3. **"Data" menu**: a dropdown (Radix menu, spring-in from its trigger) listing Data Explorer, Datasets, Documents and Upload, each with an icon and a one-line description. The "Data" trigger shows as active when the current page is one of these.
  4. A thin divider, then on the right: **dataset selector** (compact, shows the active dataset's filename), **health dot** (green/amber/red; tooltip and click show the full status: "All systems normal", "Degraded: document search offline", "Backend offline"), **search button** (opens the command palette), and a **Settings** icon button.
- **Active link indicator**: a filled primary-tint pill behind the active link that **glides** between links with a shared `layoutId`. Hover shows a faint neutral pill.
- **Amber "Demo data" badge**: when demo mode is on, a small amber pill attached just below the nav pill (centred), visible on every page.
- **Scroll behaviour**: once the page scrolls past ~24px, the pill compacts slightly (height 56 → 48px, stronger background opacity), animated per §2.5. It never hides.

**Page header**: below the nav, each page has its own `PageHeader` (title, short description, page-level actions on the right). The page title is no longer in a top bar.

**Command palette (Ctrl/⌘+K)**: a centred dialog with a search box listing every page, the user's datasets ("Switch to kirana_sales.csv") and common actions (Upload data, Retrain model, Ask a question). Keyboard navigable, opened from the search button or the shortcut.

**Tablet (768–1023px):** same pill; the primary links collapse to icons with tooltips, the "Data" menu stays, and the dataset selector shrinks to an icon that opens a menu.

**Mobile (< 768px):** the pill shows only the logo, the health dot and a menu button. The menu button opens a **full-screen sheet** (slides up, backdrop blur) with all pages grouped (Overview, Plan, Understand, Data, Settings), the dataset selector and the demo-mode status.

**Accessibility:** the pill is a `<nav aria-label="Main">`; links carry `aria-current="page"`; the Data menu and the mobile sheet are fully keyboard operable and restore focus on close; the health dot has a text label for screen readers.

### 3.2 Pages (13)

Routes live under `frontend/src/app/`. The `(app)` group holds everything with the shell.

| Route | Page | Content |
|---|---|---|
| `/` | **Landing** | Use the same floating pill nav style as the app (logo, a few section links, "Open dashboard" dark pill CTA on the right). Recreate the reference hero: eyebrow pill, huge headline with a gradient accent word (e.g. "Run your business *ahead of time.*"), subtext, dark pill CTA "Open dashboard" + secondary "See how it works", and a glass product window showing a real-looking CogniTwin dashboard (static markup, not live data). Below: 3–4 feature cards (Forecast, What-If, Ask AI, Recommendations), a short "how it works" (Upload → Twin → Decide), and a simple footer. No pricing/customers sections. |
| `/dashboard` | **Dashboard** | KPI row (4 cards: e.g. revenue, units, avg order value, growth — derive from `/data/summary`); main trend chart with period picker; category breakdown; top items table; a purple **Insight** card from `/forecast/explain-prescribe` (recommended actions); a small **Model health** card (backtest MAPE from `/forecast/backtest`, model tier, last trained). |
| `/forecast` | **Forecast & What-If** | Forecast chart with actuals (blue), forecast (purple) and uncertainty band (purple tint; show both 80% and 95% when returned, with the method label). Horizon picker 30/60/90. "Retrain" button showing **live job status** (queued → fitting → done/failed) by polling `/forecast/jobs/{id}`. What-if panel: sliders/inputs for each available lever; results show volume delta, **profit impact** and **margin warning** (from `profit`), **optimal price** (from `pricing`) — each with its "unavailable because…" reason when null. "Save scenario" button. Attribution panel with the `method` label ("Factor attribution", "SHAP (exact)", "Linear coefficients"). |
| `/scenarios` | **Scenarios** | List of saved scenarios for the active dataset; select 2–4 to compare side by side (table + overlaid chart). |
| `/ask` | **Ask AI** | Chat layout. Each answer card: answer text, charts (use the `charts` spec), insights, recommended actions, and a **source chip** (Data / Forecast / Documents / Relationship) plus confidence. Collapsible "Show SQL" and data table. Suggested starter questions. Rename the old `/query` route to `/ask` and redirect `/query` → `/ask`. |
| `/explorer` | **Data Explorer** | Column profile table (from `/data/{id}/profile`), correlation heatmap (`/data/{id}/correlations`, Pearson/Spearman toggle, show *n* per pair on hover), scatter plot for any two numeric columns (`/data/{id}/scatter`). |
| `/datasets` | **Datasets** | Table of uploads (`/data/uploads`): name, rows, uploaded date, status; row actions "Set active" and "Delete" (`DELETE /data/uploads/{id}`, with a confirm dialog that names the dataset and says it also deletes its trained model). |
| `/documents` | **Documents** | Upload PDFs (`POST /documents/upload`) and semantic search (`POST /documents/search`) with result snippets. **The backend has no endpoint to list or delete documents** — do not invent one; show upload + search only and list the missing endpoints in your final report. |
| `/upload` | **Upload Data** | Large keyboard-accessible drop zone for CSV (`POST /ingest/csv`), progress, then a result card (rows, detected date/target columns) with "Train model" and "Go to dashboard" actions. Real validation errors from the backend, verbatim. Rename the old `/ingest` route to `/upload` and redirect `/ingest` → `/upload`. |
| `/settings` | **Settings** | Demo mode toggle, number/currency format preview, about/version, backend health details. Client-side only (localStorage, wrapped in try/catch). |
| loading | **Loading** | Route-level `loading.tsx` with skeletons shaped like the page (not spinners). |
| error | **Error** | Route-level `error.tsx`: plain-language message, the request id if the backend returned one, "Try again". |
| not found | **404** | Friendly page with a link back to Dashboard. |

Every page must work at 375px (mobile), 768px (tablet) and 1440px (desktop) with no horizontal scroll.

---

## 4. Data layer

- Keep the existing same-origin proxy: the browser calls `/api/...` and `next.config.ts` rewrites to `BACKEND_API_URL` (default `http://localhost:8000/api/v1`).
- **API key**: the backend may require an `X-API-Key` header (exempt: `/health`, `/docs`, `/openapi.json`). The key must **never** reach the browser. Replace the rewrite with a Next.js Route Handler proxy (`src/app/api/[...path]/route.ts`) that forwards method, body, query and multipart uploads, and adds `X-API-Key` from a **server-only** env var `BACKEND_API_KEY` when set. Document it in `frontend/.env.local.example`.
- **Types**: generate TypeScript types from the backend's OpenAPI schema with `openapi-typescript` (script: `npm run gen:api`, reading `http://localhost:8000/openapi.json`, output `src/lib/api/schema.d.ts`; commit the generated file). Several endpoints return `Any` — write narrow hand types for those next to the generated ones. No `any` in new code.
- **Fetching**: use **TanStack Query** (`@tanstack/react-query`). One typed client function per endpoint in `src/lib/api/`, one hook per resource in `src/lib/hooks/`. Query keys always include the active dataset id. Invalidate the right queries after upload, delete, train and save-scenario.
- **Backend envelope**: success responses are `{ status, data, meta? }`; errors are `{ status, error: { type, message, details } }` (some endpoints use FastAPI's `detail`). Normalise both into one `ApiError` with `status`, `type`, `message`, `requestId`.
- **Training is a background job**: `POST /forecast/train` returns `202` with `{ job_id, status }`; poll `GET /forecast/jobs/{job_id}` every 2s until `succeeded`/`failed`, then refetch status/forecast. Show the job's own `error` text on failure.
- **Active dataset**: store the selected dataset id in the URL (`?dataset=`) and mirror it in a small context so links keep the selection. Default to the most recent upload.
- **Currency and numbers**: everything is INR. One formatter module using `Intl.NumberFormat('en-IN', …)`: full (`₹1,24,500`), compact (`₹1.2 L`, `₹3.4 Cr`), percent, signed delta. No `$` anywhere.

### Backend endpoints (all under `/api/v1`)

```
GET    /health
POST   /ingest/csv                          multipart "file"
GET    /data/summary?dataset_id=
GET    /data/uploads?page=&page_size=
DELETE /data/uploads/{upload_id}
GET    /data/{dataset_id}/profile
GET    /data/{dataset_id}/correlations?method=pearson|spearman
GET    /data/{dataset_id}/scatter?x=&y=&limit=
POST   /forecast/train[?wait=true]          { granularity, dataset_id }
GET    /forecast/jobs/{job_id}
GET    /forecast/predict?horizon_days=&dataset_id=
GET    /forecast/status?dataset_id=
GET    /forecast/backtest?test_days=&dataset_id=
POST   /forecast/simulate                   { mutations, horizon_days, dataset_id, save?, name?, unit_cost? }
GET    /forecast/simulations?dataset_id=&page=
GET    /forecast/simulations/compare?ids=a,b,c
GET    /forecast/explain-prescribe?horizon_days=&dataset_id=
GET    /forecast/explain/{product_id}
POST   /query                               { question, dataset_id }
POST   /documents/upload                    multipart "file" (PDF only, size-capped)
POST   /documents/search                    { query, top_k }
```

Read the actual request/response shapes from `backend/src/api/schemas/*.py` and the routers in `backend/src/api/` — do not guess field names. **Do not modify the backend.** If the UI needs something the backend doesn't provide, leave a clear "not available yet" state and list it in your final report.

---

## 5. Honesty rules (non-negotiable)

The old frontend silently replaced failed requests with fabricated numbers. That must not survive the rebuild.

1. **Every data panel has four states**, built as shared components and used everywhere:
   - **Loading** — skeleton in the shape of the content.
   - **Empty** — explains what's missing and offers the next step ("No dataset yet — Upload a CSV").
   - **Error** — the real reason in plain language, a "Retry" button, and the request id if present.
   - **Data**.
2. **No automatic fallbacks to demo data.** Ever. A failed request shows the error state.
3. **Demo mode** is an explicit switch in Settings (off by default). When on, the app reads from `src/lib/demo/` fixtures instead of the backend, and an amber "Demo data" badge is visible on every page. Demo fixtures must look plausible and use INR.
4. **Never compute business results in the browser to stand in for the backend** (the old client-side "elasticity" what-if fallback and the fake SHAP forces must go). The frontend displays what the backend returns.
5. **Show the backend's caveats.** When a response includes a `method`, `reason`, `confidence`, `notes`, `extrapolated`, low-confidence flag, or a null value with a reason, render it — e.g. "Optimal price unavailable: demand is inelastic", "Low confidence — only 40 days of history".
6. **Degraded backend is normal, not fatal.** If `/health` reports Qdrant unreachable, the Documents page and document answers show "Document search is offline"; everything else keeps working.

---

## 6. Component kit

Build these in `frontend/src/components/ui/` (primitives) and `frontend/src/components/<feature>/`, each typed, accessible, and used consistently:

`AppShell`, `NavPill` (floating nav with `DataMenu` and the mobile `NavSheet`), `CommandPalette`, `DatasetSelector`, `HealthDot`, `DemoBadge`, `PageHeader`, `GlassCard`, `KpiCard`, `ChangeBadge`, `ChartCard`, `PeriodPicker` (segmented), `Button` (cta/secondary/ghost, sizes), `Input`, `Select`, `Slider`, `Tabs`, `Table` (sortable, sticky header, horizontal scroll on mobile), `Dialog` (focus-trapped confirm), `Toast`, `Skeleton`, `EmptyState`, `ErrorState`, `InsightCard` (purple, for AI recommendations), `SourceChip`, `MethodLabel`, `DropZone` (keyboard + click + drag), `JobStatus` (training progress).

Charts: keep **Recharts**. Create one shared chart theme module (axis/grid/tooltip styles, palette from §2.1) and use it for every chart. Tooltips are solid white cards with tabular numbers in INR. Every chart has an accessible text summary (`aria-label` or visually hidden caption).

---

## 7. Clean-up

Delete the old design and dead code once replaced. At minimum review and remove: the old dark theme tokens and fonts in `globals.css`/`layout.tsx`; `components/context/CursorContext.tsx`; `components/forecast/VolumetricTwinNode.tsx`; `components/landing/EnlargedThreadCanvas.tsx`; `components/layout/ObservatoryHeader.tsx` and `BottomDock.tsx`; the `Cybernetic*` UI components; `lib/elasticity.ts` (client-side simulation); `lib/mockData.ts` (move anything useful into `lib/demo/`); and any npm dependency no longer imported. Verify with a grep before deleting each file. Don't leave unused exports behind.

---

## 8. Quality bar

- **TypeScript strict**, no `any` in new code, `npx tsc --noEmit` clean.
- **ESLint clean** (`npm run lint` — it currently reports ~74 errors; the rebuilt code must report 0). Then add `eslint` to the frontend CI job in `.github/workflows/backend.yml`.
- **Accessibility**: WCAG 2.1 AA contrast; every interactive element reachable and operable by keyboard with a visible focus ring; landmarks (`nav`, `main`, `header`); form labels; `aria-live` for job status and toasts; dialogs trap focus and restore it.
- **Performance**: server components by default, `"use client"` only where interactivity requires it; no always-running intervals/rAF loops (the only exception is the landing hero's ambient motion, which pauses off-screen); all motion follows §2.5 and holds 60fps; lazy-load chart-heavy sections below the fold; `next build` must succeed with no warnings you introduced.
- **Tests** (Jest + Testing Library, already set up):
  - formatters (INR full/compact/percent/delta);
  - API error normalisation;
  - training-job polling hook (queued → running → succeeded; failure shows job error);
  - each of Loading/Empty/Error/Data for at least Dashboard and Forecast;
  - demo mode on/off (badge visible, no backend calls when on);
  - reduced motion: count-ups show final values immediately and no movement animations run when `prefers-reduced-motion` is set.
  - Add **Playwright** with one smoke test of the demo path: landing → dashboard → forecast → ask, running against demo mode so it needs no backend.
- Update or replace the existing tests in `frontend/tests/` so `npm test` passes.

---

## 9. Phases

Each phase lists its **goal**, **scope**, **out of scope**, and **exit checks**. Stay inside the scope of the phase you were given. If you notice something that belongs to a later phase, note it in the progress file instead of doing it.

### Phase 1 — Foundation

**Goal:** everything later phases build on, done properly. After this phase, building a page should be mostly assembling existing pieces.

**Scope:**
1. **Explore first.** Read `frontend/src` (pages, `lib/api.ts`, `context/DatasetContext.tsx`, components), `frontend/package.json`, `next.config.ts`, and the backend schemas/routers in `backend/src/api/`. Current versions: Next.js 16, React 19, Tailwind v4, Recharts 3, Jest 30.
2. **Design system (§2.1–2.4):** tokens in `globals.css` via `@theme`, Inter via `next/font`, page background wash, glass card recipe. Remove the old fonts and theme tokens from `globals.css`/`layout.tsx`. Old pages may look broken until Phase 2/3; that is expected, but they must still compile.
3. **Motion system (§2.5):** `src/lib/motion.ts` with easing/duration/stagger tokens, reusable variants (page enter, stagger container/item, fade-blur, scale-in), a count-up hook/component, a reduced-motion helper, and the page-transition wrapper at the `(app)` layout/template level.
4. **Component kit (§6):** all primitives and shared components, with their motion built in (hover lift, press, gliding `layoutId` indicators, overlay springs, shimmer skeletons). Include `EmptyState`, `ErrorState` and `Skeleton`.
5. **App shell (§3.1):** `AppShell`, `NavPill` (floating pill nav, Data menu, mobile sheet), `CommandPalette`, `DatasetSelector`, `HealthDot`, `DemoBadge`. No left sidebar. Add placeholder pages for any of the 13 routes that do not exist yet, each showing the shell with an `EmptyState` saying "Coming in Phase N".
6. **Data layer (§4):** Route Handler proxy with server-only `BACKEND_API_KEY`; `openapi-typescript` generation (`npm run gen:api`) with the generated file committed; TanStack Query provider; typed client functions and hooks for **all** endpoints in §4; error normalisation into `ApiError`; INR formatters; active-dataset handling via `?dataset=`; the training-job polling hook.
7. **Demo mode (§5):** settings store, `src/lib/demo/` fixtures covering every endpoint the pages will use, and the switch that makes hooks read fixtures instead of the network.
8. **Chart theme:** one shared Recharts theme module (palette, axes, grid, tooltip, animation timings from `motion.ts`).
9. **Component gallery** at `/dev/kit` (not in the nav; rendered only in development) showing every component in each state, so later phases and reviewers can see the kit.
10. **Tests:** formatters, `ApiError` normalisation, training-job polling hook, demo-mode switch, reduced-motion helper.

**Out of scope:** the real content of the 13 pages; deleting old page components (Phase 4).

**Exit checks:** `npx tsc --noEmit` and `npm test` pass; `npm run build` succeeds; `/dev/kit` renders every component correctly at 375/768/1440px and with reduced motion; the shell, the nav pill's gliding indicator and page transitions are smooth; a hook call against the running backend returns typed data.

### Phase 2 — Core pages

**Goal:** the four pages that make up the main demo flow, fully built with the Phase 1 kit.

**Scope:**
0. **First, replace the navigation.** Phase 1 built a left sidebar; the design has since changed to the floating pill nav in §3.1. Build `NavPill` (with the Data menu, scroll-compact behaviour and mobile sheet), `CommandPalette` and `HealthDot`; switch `AppShell` to them; move the page title into each page's `PageHeader`; delete the sidebar and the old top bar (and their tests/gallery entries), and update `/dev/kit` to show the new nav. Check it at 375/768/1440px before building pages. Commit this on its own.

Then build `/dashboard`; `/forecast` (Forecast & What-If, including live training progress, profit/pricing/uncertainty with caveats, save scenario, attribution with method label); `/ask` (Ask AI, with a `/query` → `/ask` redirect); `/upload` (with an `/ingest` → `/upload` redirect). Follow §3.2 for content and §2.5 for the motion moments on these pages (count-ups, chart draw-in, staggered reveal, what-if live tween, Ask AI streaming reveal, training progress). Every panel uses the four states from §5. Add Loading/Empty/Error/Data tests for Dashboard and Forecast.

**Out of scope:** other pages; the landing page; deleting old code.

**Exit checks:** each page works against the live backend and in demo mode; each passes the visual and motion check (§10.3) at 375/768/1440px; no fabricated data on failure; `tsc`, `npm test` and `npm run build` pass.

### Phase 3 — New pages

**Goal:** the remaining app pages.

**Scope:** `/scenarios` (list + compare 2–4); `/explorer` (profile table, correlation heatmap with Pearson/Spearman toggle, scatter for any two numeric columns); `/datasets` (table, set active, delete with confirm dialog); `/documents` (upload + search only; there is no list/delete endpoint, so show that limitation gracefully and record it); `/settings` (demo toggle, format preview, about, health details). Apply §2.5 motion and §5 states throughout.

**Out of scope:** the landing page; deleting old code; Playwright.

**Exit checks:** same as Phase 2, for these pages.

### Phase 4 — Landing, polish and clean-up

**Goal:** finish the product and leave the codebase clean.

**Scope:**
1. **Landing page `/`** per §3.2, including the cinematic hero motion from §2.5 (staggered blur-in headline, drifting gradient word, mouse-tilt product window that pauses off-screen) and scroll-revealed feature cards.
2. **Route-level** `loading.tsx` (page-shaped skeletons), `error.tsx` and `not-found.tsx` with the same premium styling.
3. **Clean-up (§7):** delete the old design code and unused dependencies; make sure `/dev/kit` is excluded from production builds.
4. **Quality (§8):** ESLint to 0 errors and add `eslint` to the frontend CI job in `.github/workflows/backend.yml`; accessibility pass across all pages; reduced-motion test; replace/update the old tests in `frontend/tests/`.
5. **Playwright** smoke test of the demo path (landing → dashboard → forecast → ask) in demo mode.
6. **Consistency pass:** same spacing, radii, type and motion everywhere; fix anything that drifted in Phases 2–3.

**Exit checks:** the full definition of done (§11).

---

## 10. Working rules (every phase)

1. **Start by reading `docs/FRONTEND_OVERHAUL_PROGRESS.md`** if it exists. It records what earlier phases built, decisions made, and known issues. Reuse what exists; do not rebuild it.
2. **Commits:** one commit per meaningful step, Conventional Commits (e.g. `feat(ui): design tokens and glass card primitives`, `feat(forecast): what-if panel with live profit impact`). Do not push, amend existing commits, or skip hooks.
3. **Visual and motion check after each page or component group:** run the dev server (`npm run dev` in `frontend/`, backend on `localhost:8000`) and check at 375 / 768 / 1440 px in a browser, in live and demo mode. Compare against the reference image. Check that page transitions, staggered reveals, count-ups, chart draw-in and hover states play smoothly, and that everything still works with reduced motion (emulate `prefers-reduced-motion: reduce`).
4. **Never modify the backend.** Record any backend gap in the progress file.
5. **Stop and ask** if a decision is not covered here, or if you would need a new paid service.
6. **End of phase:** make sure the exit checks pass, then create or update **`docs/FRONTEND_OVERHAUL_PROGRESS.md`** and commit it. For each completed phase it must record:
   - what was built (files, components, pages) and where;
   - decisions later phases must follow;
   - exit-check results (commands run and outcomes);
   - known issues, deviations from this prompt, and backend gaps;
   - what the next phase should start with.
7. **Then stop.** Print a short phase report (phase, commits, what changed, exit-check results, open issues) and do not begin the next phase.

---

## 11. Definition of done (after Phase 4)

- All 13 pages exist, share one consistent design that clearly matches the reference, and work at mobile/tablet/desktop widths.
- The app feels premium in motion: every required moment in §2.5 is implemented, smooth at 60fps, and degrades to simple fades under reduced motion.
- No fabricated data anywhere outside explicit demo mode; every panel handles loading/empty/error/data.
- Training shows live progress; what-if shows profit, pricing and uncertainty with their caveats; Ask AI shows sources and charts; Datasets can delete; Explorer shows profile/correlations/scatter.
- `npx tsc --noEmit`, `npm run lint`, `npm test`, `npx playwright test` and `npm run build` all pass.
- Old design code and unused dependencies removed.

**Final report** (end of Phase 4): a table of phases → commits → what changed; a short description of each page; test results; the backend gaps you hit (e.g. no document list/delete endpoint) and any `Any`-typed endpoints you had to hand-type; and anything skipped and why.

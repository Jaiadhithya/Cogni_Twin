# Frontend overhaul — progress

Spec: [`FRONTEND_OVERHAUL_PROMPT.md`](FRONTEND_OVERHAUL_PROMPT.md). One section per completed phase.

| Phase | Status |
|---|---|
| 1 — Foundation | **Done** |
| 2 — Core pages (Dashboard, Forecast & What-If, Ask AI, Upload) | Not started |
| 3 — New pages (Scenarios, Explorer, Datasets, Documents, Settings) | Not started |
| 4 — Landing, polish, clean-up, Playwright | Not started |

---

## Phase 1 — Foundation

### What was built

All paths are under `frontend/`.

| Area | Where | Notes |
|---|---|---|
| Design tokens | `src/app/globals.css` | Tailwind v4 `@theme`: colour, radius, shadow, motion tokens. Type scale as `t-display / t-h1 / t-h2 / t-kpi / t-body / t-label / t-eyebrow` utilities. `glass`, `skeleton`, `text-gradient-brand` utilities. Fixed pastel wash on `body`. Reduced-motion CSS. |
| Font | `src/app/layout.tsx` | Inter only (`next/font/google`, 400–700). Old fonts and dark theme removed. |
| Motion system | `src/lib/motion.ts` | Easing/duration/stagger/spring tokens, `variants` (pageEnter, staggerContainer/Item, fadeBlur, fade, scaleIn, slideInRight), `usePrefersReducedMotion`, `useVariants(name)`, `toReducedVariants`, `chartAnimation(reduced)`. |
| Page transition | `src/app/(app)/template.tsx` | Fade + 10px rise + blur-to-sharp on every navigation; sidebar and top bar stay still. The very first load skips the entrance so SSR content is visible before hydration. |
| Formatters | `src/lib/formatters.ts` | `formatInr`, `formatInrCompact` (₹1.2 L / ₹3.4 Cr), `formatInrDelta`, `formatPercent`, `formatSignedPercent`, `formatNumber(Compact)`, `formatDate/DateTime/DateShort`, `trendOf`. Percent helpers take **percent units** (12.5 = 12.5%), matching the backend. |
| Chart theme | `src/lib/chart-theme.ts`, `src/components/charts/chart-tooltip.tsx` | Palette (CSS-variable colours), axis/grid/margin/line props, solid white tooltip. |
| API client | `src/lib/api/` | `client.ts` (fetch + envelope unwrap), `errors.ts` (`ApiError`, `normalizeError`, `describeError`), `endpoints.ts` (one function per endpoint in §4), `types.ts` (generated + hand types), `schema.d.ts` (generated, committed). |
| Proxy | `src/app/api/[...path]/route.ts` | Forwards method, query, body (streamed multipart OK) to `BACKEND_API_URL`; adds `X-API-Key` from server-only `BACKEND_API_KEY`; drops cookies; returns `502 BACKEND_UNREACHABLE` in the backend envelope when the backend is down. `.env.local.example` documents both variables. `next.config.ts` rewrite removed. |
| Type generation | `scripts/gen-api.mjs`, `npm run gen:api` | Reads `http://localhost:8000/openapi.json`; override with `OPENAPI_SOURCE=<url or file>`. |
| Data hooks | `src/lib/hooks/` | `queries.ts` (one hook per read resource), `mutations.ts`, `training.ts` (`useTrainingJob`), `core.ts` (`useDataSource`, `keys`). TanStack Query provider in `src/components/providers.tsx`. |
| Demo mode | `src/lib/settings.ts`, `src/lib/demo/` | `useDemoMode()`/`useSettings()` (localStorage, try/catch, external store). `demoSource` implements the same surface as `endpoints.ts`; in-memory uploads/saved scenarios/training jobs. Query keys start with `live`/`demo`, so caches never mix. |
| Active dataset | `src/lib/dataset-context.tsx` | `?dataset=` is the source of truth; mirrored to localStorage; default is the newest upload. `useActiveDataset()` → `{datasetId, dataset, datasets, setDatasetId, withDataset(href)}`. |
| Component kit | `src/components/ui/*` | `button` (+`ButtonLink`), `glass-card`, `kpi-card`, `change-badge`, `count-up`, `chart-card`, `segmented-control` (+`PeriodPicker`), `tabs`, `input`, `select`, `slider`, `switch`, `table` (`DataTable`), `dialog` (+`ConfirmDialog`), `toast`, `skeleton` (+Kpi/Chart/Table/Text), `empty-state`, `error-state`, `data-state`, `insight-card`, `source-chip`, `method-label`, `drop-zone`, `job-status`, `page-header`, `reveal` (`RevealGroup/RevealItem/FadeBlur`). |
| Shell | `src/components/layout/*` | `app-shell`, `sidebar` (240px / icon rail on tablet / drawer on mobile, gliding `layoutId` indicator), `top-bar`, `dataset-selector`, `health-pill` (+`health.ts`), `demo-badge`, `page-search`, `nav.ts`, `coming-soon`. |
| Routes | `src/app/(app)/…` | New shell layout. Placeholders ("Coming in Phase N"): `/scenarios`, `/ask`, `/explorer`, `/datasets`, `/documents`, `/upload`. `/settings` already has the working **Demo mode** switch (rest is Phase 3). `/dev/kit` is the component gallery (dev only). |
| Legacy | `src/legacy/`, `src/app/(app)/(legacy)/` | Old design code moved here, unchanged apart from import paths. `/dashboard`, `/forecast`, `/ingest`, `/query` still run on it inside the new shell (see known issues). |
| Tests | `tests/*.test.ts(x)` | See results below. |

### Decisions later phases must follow

1. **Fetch only through hooks** in `src/lib/hooks` and pass `datasetId` from `useActiveDataset()`. Hooks stay idle until a dataset id exists. Never call `endpoints.ts` from a component (it would bypass demo mode).
2. **Every data panel uses `<DataState>`** (Loading skeleton → Empty → Error with Retry + request id → Data). A failed request is always the Error state; there is no fallback to fixtures.
3. **A new endpoint = three edits**: `endpoints.ts`, a hook, and the same function in `src/lib/demo/index.ts` (the `DataSource` type will fail to compile if you forget the last one).
4. **Pages use `PageHeader` for the H1.** The top bar shows the section name as plain text, not a heading.
5. **Motion**: import durations/easings/variants from `src/lib/motion.ts`; use `RevealGroup/RevealItem` for the staggered reveal, `CountUp` for numbers, `useVariants()` for anything custom, `chartAnimation(reduced)` for Recharts. Wrap nothing in raw `motion.*` with literal durations.
6. **Charts**: build on `ChartCard` (the `summary` prop is required — it is the accessible text) and `src/lib/chart-theme.ts`. Actuals = `chartColors.actual`, forecast = `chartColors.forecast`, band = `chartColors.band` at `bandOpacity`.
7. **Purple is only for model output** (`InsightCard`, forecast series, AI answers). The blue→purple gradient is for the landing headline only.
8. **File naming**: kebab-case in `components/`. New code never imports from `src/legacy`.
9. **Dev servers**: `next.config.ts` honours `NEXT_DIST_DIR` so a second dev/build can run beside another without sharing `.next`. A local, uncommitted `.claude/launch.json` starts the frontend on port 3100 with `NEXT_DIST_DIR=.next-dev`.
10. After backend schema changes run `npm run gen:api` and commit `schema.d.ts`. Two schemas share the name `PrescriptiveAction`; the generator suffixes them (`src__api__schemas__explain_prescribe__PrescriptiveAction`, `…__query__…`).

### Exit checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean. |
| `npm test` | **10 suites, 80 tests pass** (4 legacy suites kept passing + formatters, API errors/client, training-job polling, demo mode, reduced motion, four states/health/helpers). |
| ESLint on all new code (`src/app src/components src/lib`, excluding `src/legacy`, `(legacy)`, `schema.d.ts`) | **0 errors, 0 warnings.** Whole-repo `npm run lint` still reports the legacy errors; Phase 4 deletes that code and adds ESLint to CI. |
| `npm run build` (`NEXT_DIST_DIR=.next-build`) | Succeeds; all 15 routes build. |
| Proxy against a mock backend (production `next start`) | `X-API-Key` added server-side; cookies not forwarded; query string, JSON and **multipart** bodies pass through; status codes and `x-request-id` returned; API key string not present in `.next/static`. |
| Browser, 375 / 768 / 1440 px (`/dev/kit`, `/settings`, `/dashboard`, drawer) | No horizontal scroll in the new shell/gallery; rail icons at 768; drawer at 375; selector, badge, health pill, search render. |
| Demo mode in the browser | Badge shows, selector lists the two demo datasets, `?dataset=` is set, summary KPIs load with **no `/api` calls**, retrain goes queued → fitting → "Model trained". |
| Backend offline in the browser | Health pill "Backend offline", selector "Could not load datasets", no fabricated data in the new shell. |
| Dialog focus | Traps focus, Escape closes, focus returns to the opening button (needed a fix: Radix only restores focus for `Dialog.Trigger`; see `use-return-focus.ts`). |
| **Not done: hook call against the running backend** | The backend could not be started here (Postgres/Qdrant not running; Python env lacks `prometheus_client` and others). Typed responses were verified through unit tests with mocked `fetch` and through the proxy against a mock server. **Run this once against the real backend:** open `/dev/kit#data` with Demo mode off. |
| **Not verified in a browser: reduced motion** | The pane has no `prefers-reduced-motion` emulation. Covered by unit tests (`usePrefersReducedMotion`, count-up shows the final value with no tween, variants become opacity-only, chart animation off) and `MotionConfig reducedMotion="user"`. |
| **Not verified frame by frame: motion smoothness** | Screenshots cannot show motion. Sidebar indicator moves to the active item (checked via DOM) and the animations are transform/opacity/filter only, but the 60fps claim has not been measured. |

### Known issues, deviations, backend gaps

**Known issues (all go away in Phase 2/4)**
- `/dashboard`, `/forecast`, `/ingest`, `/query` are the **old pages** in the new shell. They look broken (dead dark-theme classes) and **still fall back to fabricated demo data when a request fails** (honesty rule violation). Phase 2 replaces them. `/ask` and `/upload` placeholders link to `/query` and `/ingest` meanwhile; `isActivePath` in `nav.ts` has two legacy aliases to delete in Phase 2.
- `(app)/(legacy)/layout.tsx` mounts the old `DatasetProvider`, which also calls `/data/uploads` and `/data/summary` — duplicate requests on those four pages only.
- `src/app/page.tsx` (landing), `not-found.tsx`, `(legacy)/loading.tsx`, `(legacy)/error.tsx` still use the old design (Phase 4).
- `/dev/kit` is excluded from production only by `notFound()` in a `force-dynamic` page; Phase 4 should remove the route from production builds entirely.
- With Demo mode on, the first (server-rendered) paint shows it off for a moment (e.g. the Settings switch), then corrects after hydration.
- Dev-mode hydration in the browser pane is slow (several seconds); not a production concern but expect a blank content area at first load in dev.

**Deviations from the prompt**
- Added the `radix-ui` package (Dialog, Select, Slider, Tabs, RadioGroup, Switch) for focus trapping and keyboard behaviour, and `@tanstack/react-query`, dev `openapi-typescript`.
- Extra components: `Switch`, `DataState`, `Reveal*`, `PageSearch`, `ComingSoon`, `DataTable`, `ButtonLink`, a `danger` button variant (for delete confirms).
- The top-bar search jumps to a page or sends the text to `/ask?q=…` (Phase 2 should read `q`).
- `/settings` ships the Demo switch now because demo mode needs a switch to be testable; the rest of Settings is Phase 3.
- `next.config.ts` gained the `NEXT_DIST_DIR` override. `.gitignore` ignores `.next-*/`.
- Legacy tests keep passing against `src/legacy`; they are removed in Phase 4.

**Backend gaps / quirks found (backend not modified)**
- No request id header: the id appears only inside 500 messages ("quote reference <uuid>"). `normalizeError` parses it from the message, or from `x-request-id` if one ever appears.
- `GET /health` and `POST /ingest/csv` return **bare** payloads (no `{status, data}` envelope). The client passes them through.
- `/health` is served at `/api/v1/health` (via `API_PREFIX`), i.e. `/api/health` through the proxy.
- Endpoints typed `Any`/`dict` and therefore hand-typed in `src/lib/api/types.ts`: `/data/summary`, `/data/uploads` delete result, `/data/{id}/profile|correlations|scatter`, `/health`, `/ingest/csv`, and `/forecast/simulate`'s `uncertainty`, `profit`, `pricing`, `shap_*_forces`.
- `POST /forecast/simulate` returns lever forces but **no attribution `method` label**; a method label exists only on `GET /forecast/explain/{product_id}` and `anomaly_root_cause.method`. Phase 2's attribution panel needs to take its label from one of those or show the forces without one.
- `/data/summary` returns the legacy-table shape (`name`/`revenue` rows, `total_orders`) when no dataset is found, and `kpis`/`timeline` rows when one is; `top_products[].quantity_sold` is not returned for dynamic datasets.
- No documents list/delete endpoint (Phase 3 Documents page = upload + search only).
- `POST /forecast/train?wait=true` exists but is deliberately not wrapped; training always goes through the polled job.
- `fetch` cannot report upload progress; the Phase 2 Upload page needs an `XMLHttpRequest` path (or an indeterminate state) for the progress bar.
- OpenAPI was exported offline by importing the FastAPI app with `prometheus_client` stubbed (scratch script, not added to the repo).

### Reviewer notes after Phase 1 (2026-10-04)

- **Fixed in the backend:** `GET /data/uploads` used to read the legacy `upload_records` table, which nothing writes since the typed pipeline was removed, so it always returned `[]` and every page showed "No dataset yet" against a real backend. It now lists `dataset_metadata` (the real ingested datasets), keeping the same record shape (`entity_type: "dynamic"`, `status: "completed"`, counts 0). Verified end to end against Supabase: an upload appears in the list, `/dashboard` auto-selects it and writes `?dataset=` to the URL, delete removes it.
- **Verified against the real backend (Supabase):** proxy health/uploads/summary/ingest (multipart streaming)/delete; `X-API-Key` stays server-side; `/api/%2e%2e/...` is rejected by Next with a 404.
- **Open issue for Phase 2:** in `next dev`, `/dev/kit` does not hydrate (server HTML renders, but only 2 of ~780 elements get React fibers, no client requests fire, no console errors, health pill stays "Checking…"). `/dashboard` in the same session hydrates normally. Reproduced after a dev-server restart. Investigate early in Phase 2 (likely something in `gallery.tsx` suspending or failing silently during hydration); the gallery is the reviewer's main way to check the kit.
- Qdrant is intentionally not running during the overhaul; ignore "document search offline" until the final check.

### Start Phase 2 with

1. Read this file and open `/dev/kit` (dev server) to see the kit.
2. Build `/dashboard` first: delete `(app)/(legacy)/dashboard`, create `(app)/dashboard/page.tsx` from `PageHeader`, `RevealGroup` of four `KpiCard`s (`useSummary`), `ChartCard` + `PeriodPicker` trend (`summary.timeline`), category breakdown, top-items `DataTable`, an `InsightCard` from `useExplainPrescribe`, and a model-health card from `useBacktest` + `useForecastStatus`. Every panel in `DataState`.
3. Then `/forecast` (use `useForecast`, `useSimulate`, `useTrainingJob`, `JobStatus`), `/ask` (`useAskQuestion`; also add the `/query` → `/ask` redirect and read `?q=`), `/upload` (`useIngestCsv`, `DropZone`; add the `/ingest` → `/upload` redirect). As each legacy page is replaced, delete its folder and remove the matching alias in `nav.ts`.
4. Add Loading/Empty/Error/Data tests for Dashboard and Forecast, following `tests/demo-mode.test.tsx` and `tests/kit-states.test.tsx`.
5. When all four legacy routes are gone, delete `(app)/(legacy)/layout.tsx` and check whether `src/legacy/context`, `lib/api.ts`, `lib/mockData.ts` and `lib/elasticity.ts` are unused.

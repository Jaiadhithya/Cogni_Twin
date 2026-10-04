# CogniTwin frontend

Next.js 16 (App Router), React 19, Tailwind v4, Recharts, TanStack Query, framer-motion, Radix primitives.

```bash
npm install
cp .env.local.example .env.local   # BACKEND_API_URL, optional BACKEND_API_KEY (server-only)
npm run dev                         # http://localhost:3000, backend expected on :8000
```

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint (must be clean; runs in CI) |
| `npx tsc --noEmit` | Type check |
| `npm test` | Jest + Testing Library |
| `npm run test:e2e` | Playwright against a production build in Demo mode (no backend needed). Includes axe accessibility scans, a no-horizontal-scroll check at 375/768/1440px and a reduced-motion check |
| `npm run gen:api` | Regenerate `src/lib/api/schema.d.ts` from `http://localhost:8000/openapi.json` (`OPENAPI_SOURCE=` to override) |

## How it is organised

- `src/app/(app)/…` pages (shared floating-pill nav shell in `layout.tsx`); `src/app/page.tsx` is the landing page.
- `src/components/ui` the kit; `/dev/kit` (development only) shows every component in each state.
- `src/lib/api` typed client, one function per backend endpoint; `src/lib/hooks` one hook per resource. **Components fetch only through hooks** so Demo mode (`src/lib/demo`) works everywhere.
- `src/lib/motion.ts` every easing, duration and variant; `src/lib/chart-theme.ts` the shared chart look.
- `src/app/api/[...path]/route.ts` same-origin proxy to the backend; adds `X-API-Key` server-side.

The design rules (tokens, motion, honesty about data) are in `docs/FRONTEND_OVERHAUL_PROMPT.md`; build history and decisions in `docs/FRONTEND_OVERHAUL_PROGRESS.md`.

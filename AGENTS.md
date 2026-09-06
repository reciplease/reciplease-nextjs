# AGENTS.md — Reciplease frontend (reciplease-nextjs)

## Tech stack

- **Package manager: yarn (classic v1)** — install with `yarn`, not `npm
  install`. The lockfile is `yarn.lock`; there is no `package-lock.json` (if
  one appears, it's a mistake — delete it). Individual `package.json` scripts
  still invoke `npm run <script>` internally (e.g. `check`, `build`) — that's
  fine, it just runs the same `scripts` entry regardless of which package
  manager launched it; it doesn't mean npm is the intended installer.
- **Next.js 16** (`next`), **React 18**, **TypeScript 5**. Node >=24
  (`engines` in `package.json`).
- Routing is split: **Pages Router** for UI (`src/pages/**`) and **App
  Router** route handlers as a thin BFF (`src/app/api/**`) that proxy to the
  Java backend via `backendFetch` (`src/lib/backend.ts`).
- **Tailwind CSS 4** (`@tailwindcss/postcss`) for styling — inline utility
  classes, no CSS modules.
- **SWR** for client-side data fetching/caching.
- **next-auth** for authentication (Google/GitHub OAuth); see
  `src/lib/auth-options.ts`.
- API types are generated from the Java backend's OpenAPI schema via
  `openapi-typescript` (`yarn codegen:types` / `npm run codegen:types`) into
  `src/types/generated/api.ts` — this file is gitignored, never hand-write it.
- `@zxing/browser` / `@zxing/library` for barcode scanning (see
  `src/components/scanner/BarcodeScanner.tsx`).
- Dev server default is **Turbopack** (`next dev`). Note: Turbopack refuses
  to start if `node_modules` is a symlink resolving outside the project
  root (e.g. a symlink into another git worktree) — use a real `node_modules`
  for anything that needs `next dev`/`next build` to actually run.

## Target devices

The app must stay usable on a **colour e-ink tablet** (slow panel refresh,
not grayscale — don't drop colour to "optimise" for it). Practically this
means treating every device as `prefers-reduced-motion: reduce`-first:
animations/transitions are a progressive enhancement, never load-bearing for
understanding the UI. The app already has a reduce-motion system — reuse it,
don't build a parallel one:

- `src/lib/settings.tsx` reads `prefers-reduced-motion` on load and exposes a
  manual "Reduced"/"Automatic" override in Settings.
- Both apply the `.reduce-motion` class to `<html>`; `src/styles/main.css`
  zeroes out `animation-duration`/`transition-duration` under it.
- Any new CSS animation (Tailwind `animate-*` utilities included) is covered
  automatically as long as it's a real CSS `animation`/`transition` — don't
  implement motion with `setInterval`/`requestAnimationFrame` loops that
  bypass this.

Quick reference for what test suites exist in this repo and how to run them.

## Test suites

| Type        | Location                          | What it covers                                                   | Runner    |
|-------------|------------------------------------|--------------------------------------------------------------------|-----------|
| Unit/component | `src/__tests__/**`              | lib helpers, BFF route handlers, pages/components (React Testing Library) | Jest (`jest.config.js`, jsdom) |
| End-to-end  | `e2e/*.spec.ts`                    | Real browser, real pages, BFF calls intercepted with `page.route(...)` mocks | Playwright (`playwright.config.ts`) |

Backend (Java) tests live in the `reciplease` repo, including its own
Cucumber e2e suite — see that repo's `AGENTS.md`.

## Running tests

```bash
npm test              # Jest — unit/component tests (fast, no browser)
npm run test:watch    # Jest in watch mode
npm run test:e2e      # Playwright — full browser e2e (starts `next dev` itself)
npm run test:e2e:ui   # Playwright with its interactive UI runner
npm run check         # tsc --noEmit + eslint (run this too before pushing)
```

CI (`.github/workflows/ci.yml`) runs all three: `yarn run check`, `yarn test`,
then a separate `e2e` job that installs Chromium and runs `yarn test:e2e`.

### Playwright specifics

- `playwright.config.ts` boots the dev server itself
  (`NEXT_PUBLIC_AUTH_DISABLED=true`, `BACKEND_URL=https://app.reciplease.org`)
  — `NEXT_PUBLIC_AUTH_DISABLED` only bypasses the middleware/`AccessGate`
  redirect, it does **not** make `useSession()` report "authenticated". Any
  spec that needs an authenticated session must additionally mock
  `**/api/auth/session` with `page.route(...)` (see `e2e/house-settings.spec.ts`
  for the pattern).
- Since `BACKEND_URL` points at the real production API, specs intercept
  every BFF route they touch (`/api/inventory`, `/api/houses/*`, etc.) via
  `page.route(...)` rather than letting requests reach prod — see any existing
  spec for the pattern. Don't add a spec that lets a mutating call (POST/PATCH/
  DELETE) fall through unmocked to `route.continue()`.
- On Ubuntu 26.04/WSL2, `playwright install` itself can fail; if so, retry with
  `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 npx playwright install`.

## Code style

No comments. None — not "what" comments, not "why" comments, not JSDoc.
Code must be self-documenting: if a comment feels necessary, that's a signal
to rename something, extract a well-named function/variable, or restructure
the logic instead of explaining it. Clean Code rules here. This applies to
new code and to code you touch; don't go out of your way to strip comments
from files you aren't otherwise editing.

If you are editing a comment, remove it unless it adds something the code
itself does not already describe.

## Writing new tests

- New `src/lib/*` helper or hook → `src/__tests__/lib/*.test.ts(x)`. SWR-based
  hooks: `jest.mock('swr')` and assert on the key/fetcher passed to
  `useSWR.mockReturnValue(...)` (see `src/__tests__/lib/houses.test.ts`).
- New BFF route (`src/app/api/**/route.ts`) → mirror an existing route test in
  `src/__tests__/app/api/**`, with `jest.mock('@/lib/backend', () => ({
  backendFetch: jest.fn() }))` and `/** @jest-environment node */` at the top
  (these run in Next's Route Handler/Node context, not jsdom).
- New page → `src/__tests__/pages/**`, mock `@/lib/houses`/`next-auth/react`/
  `next/router` as needed (see `src/__tests__/pages/settings/house.test.tsx`).
- New cross-page user flow (sign-in state, real navigation, clipboard, etc.) →
  add a spec under `e2e/`, following the session/route-mocking pattern above.

## A real bug Playwright catches that Jest/tsc don't

Importing anything from a module that pulls in `next/headers` (e.g.
`src/lib/backend.ts`) inside a Pages Router file (`src/pages/**`) breaks the
dev server/build, even if the import is never called — `next/headers` is
App-Router-only. Jest mocks the module away and `tsc --noEmit` doesn't run the
bundler, so neither catches it; only an actual `next dev`/`next build` (which
is what Playwright's `webServer` boots) does. If a Pages Router file needs
something like `BACKEND_URL`, import it from `src/lib/backend-url.ts`
(no `next/headers` dependency) instead of `src/lib/backend.ts`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

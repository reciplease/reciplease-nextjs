# AGENTS.md — Reciplease frontend (reciplease-nextjs)

Quick reference for what test suites exist in this repo and how to run them.
Next.js app, pages router for UI (`src/pages/**`), App Router route handlers
acting as a thin BFF (`src/app/api/**`) that proxy to the Java backend via
`backendFetch` (`src/lib/backend.ts`).

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

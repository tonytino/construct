# Construct Changelog

All notable changes to the construct template will be documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

## Propagation Tags

Each entry is tagged to guide agents propagating changes to construct instances:

- `[propagate]` — should be applied to all existing instances where possible
- `[template-only]` — affects the template or scaffold process only, not instances
- `[manual]` — requires human judgment before applying to instances

---

## [Unreleased]

<!--
Pending entries now live as fragment files under changelog.d/ (one per PR), so
PRs no longer collide on this block. Run `pnpm changelog:preview` to render the
pending section and `pnpm changelog:release <version>` to fold the fragments
into a versioned section here. Do not hand-edit this block.
-->

---

## [0.3.0] - 2026-06-25

### Added

- `[propagate]` Wired up TanStack Query (SSR-aware): `app/router.tsx` creates a `QueryClient` and wraps the router with `routerWithQueryClient`; `app/routes/__root.tsx` uses `createRootRouteWithContext` so loaders get a typed `context.queryClient`; `app/routes/index.tsx` shows a prefetched `useSuspenseQuery` example. Added `@tanstack/react-router-with-query`.
- `[template-only]` Added a production-build smoke CI job (`pnpm build && pnpm start`) that asserts the homepage returns 200 and its bundled stylesheet resolves — catching prod-only breakage the dev-server E2E misses.
- `[propagate]` Added a `GET /api/health` liveness route (kept in scaffolded projects) and made the request-validation example route optional: scaffold no longer strips it, and `node scripts/remove-example.mjs` deletes it plus drops `@hono/zod-validator` for projects that don't want it.
- `[propagate]` Added an interactive `Counter` example component with a `@testing-library/user-event` test, demonstrating the full Testing Library + Vitest flow (render → real click → assert). Switched the jest-dom setup import to the Vitest-specific entry (`@testing-library/jest-dom/vitest`).
- `[propagate]` Added an unused-dependency CI check (`pnpm knip`, configured in `knip.json`) that fails when a declared dependency is imported nowhere — the guardrail that would have caught the previously-unused `@tanstack/react-query`. Documented in `docs/agents/dependencies.md`.
- `[propagate]` Pinned the Node version: `engines.node` (`>=22`) in `package.json` and a root `.nvmrc`. CI now reads the pin via `actions/setup-node` `node-version-file` (in `ci.yml` and `validate-template.yml`) so the declared version and CI can't drift.
- `[propagate]` Changelog entries are now fragment files under `changelog.d/` (one per PR) instead of a hand-edited `## [Unreleased]` block, eliminating changelog merge conflicts. Adds `scripts/changelog.mjs` (`preview` / `check` / `release <version>`) and a CI check that requires every PR to add a fragment (skippable with the `skip-changelog` label). Scaffolded instances inherit the system.

### Changed

- `[template-only]` Hardened the CI workflows: least-privilege `permissions`, concurrency cancellation of superseded runs, and SHA-pinned actions.
- `[template-only]` Hardened the E2E assertion and added Vitest coverage configuration.
- `[propagate]` Completed the `pnpm.overrides` set and switched it to exact pins: all **25** `@tanstack/*` router/start internal packages are now pinned to their exact resolved versions (`1.114.29`–`1.114.35`) instead of the original `~1.114.3` range, matching the policy in `docs/agents/dependencies.md`. (The `[0.2.0]` entry's "17 packages / `~1.114.3`" records what that release shipped; this entry records the later completion so the CHANGELOG no longer contradicts `package.json`.)

### Fixed

- `[propagate]` Bundle the stylesheet via a `?url` import in `app/routes/__root.tsx` so the production build is styled — referencing the source path 404s after `vinxi build`.
- `[propagate]` Made `env`/`db` lazy and pure, so importing them (e.g. transitively in unit tests) no longer requires a live `DATABASE_URL`.
- `[propagate]` The `/api` catch-all now forwards `OPTIONS`/`HEAD` to Hono, and the Hono app centralizes JSON 404 and 500 error handling without leaking internals.
- `[propagate]` Type-check the `db/` directory (added to `tsconfig` `include`) and made the documented `~/db/*` import alias resolve in tsc, Vite, and Vitest.
- `[propagate]` Fixed a hydration mismatch, dropdown defaults, and CRLF handling in the starter UI.
- `[propagate]` Reconciled the setup instructions across the README and docs with the actual scaffold and commands.
- `[template-only]` Hardened the scaffold script: argv-safe `execFileSync`, a re-run guard, and project-name slug validation.
- `[template-only]` Restored a green CI baseline (workflow gating, frozen lockfile, the pinned `@tanstack` build, and scaffold stdin handling).
- `[template-only]` Scaffold's label-setup recovery path now works. `scripts/labels.mjs` is runnable directly (`node scripts/labels.mjs`) via an `import.meta.url` main guard and is no longer deleted during scaffold, so the printed "set up labels later" instruction actually creates the labels. Scaffold reuses the same `createLabels()` helper.
- `[propagate]` Defined the `--color-muted-foreground` theme token in `app/styles/app.css` so the `text-muted-foreground` utility used by the starter routes actually renders (Tailwind v4 emits nothing for an undefined color utility).
- `[propagate]` Aligned the scaffold-generated README with the scaffold's "Next steps" output — one command order, and the `DATABASE_URL` step is now in both.
- `[propagate]` Clarified Neon connection-string guidance in `.env.example` and `docs/agents/environment.md`: with the `neon-http` driver the pooled vs. direct endpoint doesn't matter (the `-pooler` endpoint is for the WebSocket `Pool` driver).

---

## [0.2.0] - 2026-04-21

### Added

- `[propagate]` GitHub Issues-based agentic task management system with label taxonomy (`status:`, `type:`, `size:`, `safe:` groups)
- `[propagate]` `docs/agents/tasks.md` — agent workflow guide for discovering, claiming, and handing off work
- `[template-only]` `.github/ISSUE_TEMPLATE/agent-task.yml` and `bug-report.yml` for structured issue creation
- `[template-only]` `.github/workflows/ci.yml` — CI pipeline (lint, typecheck, unit tests, E2E) on push and PR
- `[template-only]` `.github/workflows/validate-template.yml` — scaffold-and-verify pipeline for every PR
- `[template-only]` `.github/workflows/release-check.yml` — enforces CHANGELOG entry and migration guide on version bumps
- `[template-only]` `scripts/labels.mjs` — exportable label definitions; scaffold creates them in GitHub automatically
- `[propagate]` `.env.example` with `DATABASE_URL` and Neon provisioning guide in `docs/agents/environment.md`
- `[template-only]` Unit tests for label definitions, issue templates, and CI workflow structure
- `[propagate]` Error boundary + 404 page in `app/routes/__root.tsx` via `notFoundComponent` and `errorComponent`
- `[propagate]` Example server function in `app/routes/index.tsx` demonstrating `createServerFn`
- `[propagate]` Example unit test (`app/utils/format.ts` + test) and component test (`app/components/Greeting.tsx` + test)
- `[propagate]` `postinstall: "tsr generate"` in `package.json` and `@tanstack/router-cli` dev dependency
- `[propagate]` `tsr.config.json` pointing route generator at `app/routes/` and `app/routeTree.gen.ts`
- `[propagate]` `pnpm.overrides` block pinning 17 `@tanstack/*` packages to `~1.114.3` to prevent v1.167 drift
- `[propagate]` `.gitignore` with `node_modules`, build outputs, env files, `routeTree.gen.ts`, `app.config.timestamp_*`, `.claude/`
- `[propagate]` `"preflight"` script — single-command validation (lint + typecheck + tests)
- `[propagate]` `"prepare": "lefthook install"` and `lefthook` dev dependency for pre-commit hooks
- `[propagate]` `lefthook.yml` with pre-commit hook running `biome check --staged` on staged files
- `[propagate]` `"packageManager": "pnpm@9.15.0"` for deterministic pnpm version across machines and CI
- `[propagate]` `.github/pull_request_template.md` with Summary / Issues / Test plan / Propagation checklist
- `[propagate]` `docs/agents/dependencies.md` — dependency governance policy (range strategy, override pattern, adding new packages)
- `[propagate]` `docs/agents/releases.md` — release convention for version bumps (CHANGELOG + migration guide + propagation)
- `[propagate]` `docs/agents/tooling.md` — when to use `pnpm check` vs `pnpm preflight` vs Lefthook
- `[template-only]` `docs/decisions/` — Architecture Decision Records framework with 5 initial ADRs (TanStack Start, dual-layer API, Neon, Biome, file-based routing)
- `[template-only]` `docs/migrations/` — versioned migration guide framework with `template.md` and `v0.2.md`

### Changed

- `[propagate]` Template version bumped to `0.2.0`; `.construct` records this on scaffold and propagation
- `[propagate]` `AGENTS.md` — "Before You Start" now references `TEMPLATE.md` when present; added "Finding Work", "Template Version Tracking" sections; Sub-Doc Index now points to `docs/decisions/`, `docs/migrations/`, `docs/agents/dependencies.md`, `docs/agents/releases.md`, `docs/agents/tooling.md`; `pnpm preflight` promoted to hard rule
- `[propagate]` `docs/agents/api.md` — expanded with decision table and server function examples
- `[propagate]` `docs/agents/propagation.md` — documents `.construct` version tracking, migration guide precedence, what propagates vs what stays template-only
- `[propagate]` `docs/agents/tasks.md` — adds `pnpm preflight` step and pre-commit hook section
- `[propagate]` `biome.json` — `files.ignore` now includes `app.config.timestamp_*` and `.claude/`
- `[propagate]` `.github/workflows/ci.yml` — `pnpm install --frozen-lockfile`, pnpm cache via `setup-node`, E2E gated on `CI_E2E_DATABASE_URL` secret
- `[template-only]` `TEMPLATE.md` — added maintainer callout for keeping `labels.mjs` and `tasks.md` in sync
- `[template-only]` `scripts/scaffold.mjs` — label setup step with human confirmation prompt added; substitutes project name into `AGENTS.md`

### Fixed

- `[template-only]` `drizzle.config.ts` — removed non-null assertion on `DATABASE_URL`; now throws a clear error if unset
- `[propagate]` TanStack v1.167 incompatibility (dropped vinxi support) — pinned to `~1.114.3` via `pnpm.overrides`

---

## [0.1.0] - 2026-04-13

### Added

- `[template-only]` Initial construct template release
- `[template-only]` TanStack Start v1 + TanStack Router + TanStack Query
- `[template-only]` Hono v4 API layer with RPC, mounted at `/api/*`
- `[template-only]` Drizzle ORM + Neon serverless Postgres
- `[template-only]` Tailwind CSS v4 with Oxide engine
- `[template-only]` Biome for linting and formatting
- `[template-only]` Vitest + Testing Library for unit/component tests
- `[template-only]` Playwright for E2E tests
- `[template-only]` Zod-based environment variable validation via `app/env.ts`
- `[template-only]` GitHub Actions CI workflow
- `[template-only]` Progressive agent documentation (`AGENTS.md` + `docs/agents/`)
- `[template-only]` Interactive scaffold script (`pnpm scaffold`)
- `[template-only]` `.construct` metadata written at scaffold time for version tracking

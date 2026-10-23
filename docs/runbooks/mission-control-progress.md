# Mission Control — progress

**ADR:** [0005](../adr/0005-mission-control-hub.md) · **Plan:** [mission-control-hub-plan.md](mission-control-hub-plan.md)

Track each stage with dated evidence. Do not mark a stage done without proof.

---

## Redesign brief — operational hub

**Users.** The owner operates Synarava alone across roughly fifteen services and
needs a dependable, low-cognitive-load view that works during quick checks as
well as incident triage.

**Jobs.** Within five seconds the screen must answer four questions: is the
system healthy, what needs attention, where has data stopped flowing, and what
is the safest next step. It must also make a stale collector unmistakable so a
silent monitoring failure cannot look like an all-clear.

**Hierarchy.** First: a compact status summary and collector recency. Second: a
fixed-geometry, read-only service map whose nodes communicate state without
color alone and whose edges animate only for fresh observed flow. Third: a calm,
severity-sorted Needs attention list containing the complete fix guidance and
copy-only prompt. On mobile, the same facts become a thumb-friendly vertical
list with no horizontal canvas.

**Decisions.** Keep topology and remediation separate so long hints can never
distort the map. Preserve the existing WiringConfig, providers, collector,
schema, and read-only contract. Reuse `@synarava/shell-kit`,
`@synarava/wiring-engine`, React Flow, and Synarava admin primitives rather than
introducing a new UI framework. Use the project’s porcelain/graphite surfaces,
Hanken Grotesk UI type, restrained Cormorant display moments, and a blueprint
grid expressed through hairlines and ports—not terminal cosplay. Motion is
state-bearing, interruptible, and reduced-motion safe; demo-backed placeholders
remain explicitly labeled.

### v1.1 architecture-map brief

**Users and jobs.** A solo operator needs one screen that explains both health
and ownership: what exists, how services exchange data, which boundaries are
weak, and where to inspect next without granting the map operational power.

**Hierarchy.** Health summary and collector trust lead; the grouped architecture
map is the primary workspace; the node inspector supplies counters, docs,
dependencies, environment metadata, and safe fix guidance; the attention ledger
remains the incident queue. Phone and tablet preserve the same facts as a list.

**Decisions.** Model `live`, `info`, and `placeholder` honestly; use unlabeled
smooth-step edges with `continuous` versus fresh `event` motion; allow only local
node positioning keyed by config version and environment; keep production and
staging metadata switchable while stating that health always belongs to the
current deployment. ADR-0006 records the owner-approved read-only boundary.

---

## Этап 1 — Подключить пакеты

- [2026-10-17T21:12:00Z] Read ADR-0005 and plan §0 (Simplicity Contract) + Stage 1 DoD in full before any package install / code.
- [2026-10-17T21:13:00Z] Checked existing `@synarava` wiring in this repo:
  - `@synarava/sku-contract` is **`workspace:*`** under `packages/sku-contract` (local monorepo), **not** GitHub Packages.
  - `next.config.ts` already has `transpilePackages: ["@synarava/sku-contract"]`.
  - Peer-deps named in plan: `clsx`, `lucide-react`, `tailwind-merge` are present; **`framer-motion` is not** (repo uses `motion`); **`zustand` is not** installed.
  - `docs/runbooks/deploy.md` currently states the project does **not** depend on private package registries / GitHub Packages tokens (Railpack install).
- [2026-10-17T21:13:30Z] Attempted to resolve pinned packages from public npm:
  - `npm view @synarava/wiring-engine` → **404** (not on registry.npmjs.org).
  - `npm view @synarava/shell-kit` → **404**.
- [2026-10-17T21:14:00Z] Attempted GitHub Packages / org access:
  - Org `synarava` exists (0 public repos).
  - `GET https://npm.pkg.github.com/@synarava/wiring-engine` → **401** without token.
  - Cloud Agent env has **no** `NODE_AUTH_TOKEN` / `NPM_TOKEN` / project `.npmrc` for `@synarava:registry`.
  - `gh` token (`cursor[bot]`) cannot list org packages (`[]`) / clone private package sources; npm.pkg.github.com with that token → `permission_denied`.
- [2026-10-17T21:14:30Z] **STOP per §0.** Cannot install `@synarava/wiring-engine@0.2.0` / `@synarava/shell-kit@0.1.3` without registry auth or forking/copying package code (forbidden). No stub/fork/copy written. Requested Cloud Agent secret `NODE_AUTH_TOKEN` + owner confirmation of package publish location.

### Owner answers (binding) — resumed 2026-10-18

1. Scope `@synarava`, registry `https://npm.pkg.github.com` (org `synarava`).
2. Published packages only — **no** vendoring/fork/copy.
3. Peers: install `zustand`. For `framer-motion` peer: do **not** add a second direct package — project has `motion@12`; pin peer via pnpm override (see note below).
4. Update `deploy.md`: remove «no private registry»; document `@synarava` + `NODE_AUTH_TOKEN`.

### Resume evidence

- [2026-10-18T22:18:00Z] Re-read ADR-0005 + plan §0 / Stage 1 DoD. `NODE_AUTH_TOKEN` present in Cloud Agent env.
- [2026-10-18T22:20:00Z] GitHub Packages **200** for `@synarava/wiring-engine@0.2.0` and `@synarava/shell-kit@0.1.3` (and `@synarava/liquid-glass` transitive).
- [2026-10-18T22:22:00Z] pnpm does **not** expand `${NODE_AUTH_TOKEN}` from committed project `.npmrc`. Added:
  - `.npmrc` — `@synarava:registry=https://npm.pkg.github.com` only
  - `scripts/ensure-github-packages-auth.mjs` + `scripts/pnpm-install-with-github-packages.mjs`
  - CI steps + `deploy.md` docs for local / Actions / Railway (`RAILPACK_INSTALL_CMD`)
- [2026-10-18T22:24:00Z] Installed pinned packages + `zustand@^4.5.7`. **framer-motion peer:** did **not** add a direct dependency. `motion@12.40.0` already depends on `framer-motion@12`; pnpm override pins `framer-motion: 12.40.0`. Package-name alias `framer-motion` → `motion` would break `motion/react` (re-exports real `framer-motion`).
- [2026-10-18T22:25:00Z] Stage 1 UI: `/admin/mission-control` renders one `defineWidget` probe inside `BaseShell` / `BaseWidget` (`MissionControlStage1Demo`). Nav entry `MC`.
- [2026-10-18T22:25:30Z] Unit tests: `lib/mission-control/__tests__/stage1-probe.test.ts` — 3 passed (ports contract + defineWidget registration + invalid direction rejection).
- [2026-10-18T22:26:00Z] `pnpm exec tsc --noEmit` green. `pnpm build` green (route list includes `/admin/mission-control`).
- [2026-10-18T22:35:00Z] Screenshot to store `media/mission-control-stage1-widget.png` **skipped** — this Cloud Agent VM has no `ADMIN_*` / `DATABASE_URL` in the process env (cannot login to `/admin/mission-control`). Build + route registration remain the render proof; owner can capture the PNG after staging deploy.

**Stage 1 status:** done (packages published-only, probe widget in shell, types + build + unit test green; live PNG optional / env-blocked here).

---

## Этап 2 — Схема состояния + контракт статуса

- [2026-10-19T21:00:00Z] Re-read plan §0 (Simplicity contract + Database rules for agents), Stage 2 DoD, and ADR-0005 in full before any schema/code. Fresh branch from `origin/staging`. Earlier unpushed Stage 2 branch (`cursor/mission-control-stage2-status-schema-4047`) not present — implementing fresh.
- [2026-10-19T21:01:00Z] **No database used.** Migration SQL generated with schema-only diff:
  `git show HEAD:prisma/schema.prisma > /tmp/old.prisma` → edit schema →
  `pnpm exec prisma migrate diff --from-schema-datamodel /tmp/old.prisma --to-schema-datamodel prisma/schema.prisma --script`.
  Never ran `migrate dev` / `reset` / `db push` / `db execute` / `--shadow-database-url`. Migration **not applied**.
- [2026-10-19T21:02:00Z] Schema: exactly 2 models — `ServiceNodeStatus` (`nodeKey` PK, `level`, `message?`, `counters?`, `href?`, `checkedAt`, `updatedAt`) and `ServiceFlowStatus` (`busKey` PK, `lastFlowAt?`, `level`, `updatedAt`) + enum `ServiceStatusLevel` (`ok|warn|down|unknown`). No third/history table.
- [2026-10-19T21:02:30Z] Migration folder: `prisma/migrations/20261019143000_mission_control_status/migration.sql` (diff output only).
- [2026-10-19T21:03:00Z] TS contract: `lib/mission-control/status.ts` (`ServiceStatusLevel` + read/write helpers). Unit test (mocked Prisma, no DB): `lib/mission-control/__tests__/status.test.ts` — **1 passed**.

**Stage 2 status:** schema + migration SQL + status type + mocked unit test in PR → `staging` (not applied; not merged). Waiting owner: continue Stage 3?

---

## Этап 3 — Канва-граф (patch bay)

- [2026-10-19T21:14:00Z] Re-read plan §0 (Simplicity contract + Database rules), Stage 3 DoD, ADR-0005, and this progress file in full before code. Branched from `origin/staging`, stacked `origin/cursor/mission-control-stage2-status-709d` (fast-forward) so Stage 3 includes `lib/mission-control/status.ts` without re-implementing it.
- [2026-10-19T21:15:00Z] **No database used.** No Prisma migrate/push/execute. Statuses for render = fixtures typed as `ServiceNodeStatusRecord` / `ServiceFlowStatusRecord` from `status.ts`.
- [2026-10-19T21:17:00Z] Exactly one new dependency: `@xyflow/react@^12.12.0`. No other new packages.
- [2026-10-19T21:20:00Z] Canvas on existing `/admin/mission-control`:
  - `lib/mission-control/wiring-config.json` — single `WiringConfig` (bindings for site→db, shopify→products, site→sentry, orders pulse).
  - `node-catalog.ts` — Stage 3/4 stub `WidgetPortManifest`s (labels/colors until live `defineWidget`s in Stage 4).
  - `canvas-model.ts` — pure map: level → color; `lastFlowAt` fresh (5 min) → `animated` edge; nodes non-draggable.
  - `MissionControlCanvas` — React Flow graph (read-only) + mobile collapsible list (`layout=auto|graph|list`).
  - Hub uses fixtures only (no DB reads). Attribution watermark left visible (no `hideAttribution`).
- [2026-10-19T21:20:30Z] Tests (mocked status fixtures, no DB):
  - `lib/mission-control/__tests__/canvas-model.test.ts` — node colors + animated vs idle edges + read-only flags (3).
  - `components/admin/mission-control/__tests__/mission-control-canvas.test.tsx` — render: colors, edge animation meta, collapsible mobile list (4).
  - All 7 passed.
- [2026-10-19T21:22:00Z] `pnpm exec tsc --noEmit` green. `APP_URL=http://localhost:3000 pnpm build` green (`/admin/mission-control` in route list).
- [2026-10-19T21:36:00Z] CI Quality Gates: lint error `@typescript-eslint/no-require-imports` in canvas test mock (`require("react")`). Replaced with ESM `import { createElement, … } from "react"`. Local eslint + 7 tests green; pushed fix (not merged).
- [2026-10-19T21:42:00Z] Review: fixture statuses need a visible admin notice. Added `mc-fixture-notice` (“Demo data. Live statuses arrive in Stage 4.”) on `MissionControlHub` + render test.
- [2026-10-19T21:50:00Z] CI green on `16790670` (6/6). PR #197 marked ready for review (not merged).

**Stage 3 status:** canvas + `@xyflow/react` + tests in PR #197 → `staging`, ready for review (not merged). Waiting owner: continue Stage 4?

---

## Этап 4 — Первые живые узлы

- [2026-10-19T22:00:00Z] Re-read plan §0 (Simplicity + Database rules), Stage 4 DoD, ADR-0005, and this progress file in full before code. Branched from `origin/staging`, merged `origin/cursor/mission-control-stage3-canvas-6397` (PR #197 still open) so canvas + fixture notice exist.
- [2026-10-19T22:05:00Z] **No migrate/push/execute; no status-table writes.** Live `shopify-sync` / `orders` use read-only Prisma queries on existing tables; `site-health` uses HTTP to `/api/health`. Unit tests mock Prisma + `fetch` (no real DB). Persistence of `ServiceNodeStatus` / `ServiceFlowStatus` remains Stage 5.
- [2026-10-19T22:10:00Z] Three live providers only:
  - `site-health` — HTTP GET `{APP_URL}/api/health` (`lib/mission-control/providers/site-health.ts`)
  - `shopify-sync` — age of latest `ProductSyncEvent` with `status=SUCCEEDED` (`shopify-sync.ts`)
  - `orders` — counters from `ShopifyWebhookDelivery` (`orders.ts`)
  - Orchestrator: `lib/mission-control/live-snapshot.ts` merges live + fixture placeholders (`db`, `products`, `sentry`).
- [2026-10-19T22:12:00Z] Hub notice: shown only while placeholders remain (`MISSION_CONTROL_PLACEHOLDER_NOTICE`); hidden when only live nodes. Sentry stays gray `unknown` placeholder; no Clarity/Meta/TikTok code.
- [2026-10-19T22:15:00Z] Tests (mocked Prisma/fetch, no DB):
  - providers: ok / warn / down / unknown each (12)
  - live-snapshot merge + placeholder filter (3)
  - hub notice show/hide (2)
  - Stage 3 canvas tests updated for sentry=`unknown`
- [2026-10-19T22:20:00Z] `pnpm exec vitest run lib/mission-control components/admin/mission-control` — **28 passed**. `pnpm exec tsc --noEmit` green. `APP_URL=http://localhost:3000 pnpm build` green (`/admin/mission-control` dynamic). Forbidden: no new deps, tables, action buttons, background jobs.

- [2026-10-19T22:16:00Z] CI green on `892189bb` (6/6). PR #200 marked ready for review (not merged).

**Stage 4 status:** live providers + page wiring in PR #200 → `staging`, ready for review (not merged). Waiting owner: continue Stage 5?

---

## Этап 5 — Коллектор + супербот (крон-воркер)

- [2026-10-19T22:45:00Z] Re-read plan §0 (Simplicity + Database rules), Stage 5 DoD, ADR-0005, and this progress file in full before code. Branched from `origin/staging` (Stage 3 #197 + Stage 4 #200 already merged). **No database used** in agent work; Prisma mocked in tests. No secrets requested.
- [2026-10-19T22:50:00Z] One new process only — `services/mission-control-collector` (thin Node 22 entry, zero new deps/tables). Logic in `lib/mission-control/collector/`:
  - Reuses providers (`site-health`, `shopify-sync`, `orders`) + `writeServiceNodeStatus` / `writeServiceFlowStatus`
  - Runs once per cron tick then exits (`pnpm mission-control:collect`)
  - Telegram via `fetch` only when level **changes into** `warn`/`down` (read previous first); token/chat from env, never logged
  - Drift: **log** WiringConfig nodes with no provider and not in `PLACEHOLDER_NODE_KEYS` (`db`, `products`, `sentry`)
- [2026-10-19T22:52:00Z] Railway owner doc (settings only, no secret values): [mission-control-collector-railway.md](mission-control-collector-railway.md). **No Railway apply.**
- [2026-10-19T22:55:00Z] Unit tests (mocked Prisma + fetch): ok→down alerts once; down→down / ok→ok no alert; Telegram failure does not crash; upserts called. Forbidden: fix/restart ability, new deps, new tables.

- [2026-10-19T23:05:00Z] CI green on HEAD `4340e6e7` (Quality Gates + Storefront smoke, push + pull_request). PR #202 marked ready for review (not merged).

**Stage 5 status:** collector worker + tests + Railway runbook merged via PR #202 → `staging`.

---

## Этап 6 — «Как чинить» в конфиге

- [2026-10-20T15:40:00Z] Re-read plan §0 (Simplicity + Database rules), Stage 6 DoD, ADR-0005, and this progress file in full before code. Branched from `origin/staging` (Stages 1–5 live). **No database used.** No new deps/tables. No Railway apply.
- [2026-10-20T15:45:00Z] Static `fixHint` / `fixPrompt` on each node in `lib/mission-control/wiring-config.json` (`nodes[]`):
  - Live (`site-health`, `shopify-sync`, `orders`): English hint + `fixPrompt` starting with safety preamble (read-only investigate; never prisma migrate/reset/diff, db push/execute, shadow DB; no prod write credentials; PR and wait).
  - Placeholders (`db`, `products`, `sentry`): generic “not connected yet” hint; **no** `fixPrompt`.
- [2026-10-20T15:50:00Z] Hub UI: warn/down/unknown cards show hint + read-only **Copy prompt** (clipboard only when prompt exists). No service-action buttons. No dynamic prompt generation.
- [2026-10-20T15:52:00Z] Collector Telegram alert body uses the node’s `fixHint` (still only on transitions into warn/down).
- [2026-10-20T15:55:00Z] Tests: wiring-config fix contract; canvas/list hint show/hide; collector alert contains hint.
- [2026-10-20T15:57:00Z] CI green on HEAD `4df47107` (Path filter + Quality Gates + Storefront smoke, push + pull_request). PR #205 ready for review (not merged).

**Stage 6 status:** PR [#205](https://github.com/KrystsiaK/synarava-jewelry/pull/205) → `staging`, ready for review (not merged). CI green.

---

## Product-screen redesign

- [2026-10-20] Reframed the hub around a five-second scan: system counts and collector recency first, fixed-size service topology second, severity-sorted remediation third. The live map stays read-only; links and clipboard copy remain its only actions.
- [2026-10-20] Rebuilt service nodes as compact `BaseWidget` cards with real React Flow ports, one-line status copy, shape/icon/text state cues, explicit demo-node labels, and fresh-only edge animation. Long `fixHint` text now lives exclusively in Needs attention.
- [2026-10-20] Added responsive list presentation for phone/tablet, explicit stale-collector and demo-data states, light/dark token styling, visible keyboard focus, and reduced-motion flow suppression.

## v1.1 architecture map + operations center

- [2026-10-20] Owner approved the scoped exception in ADR-0006: node drag is a
  local view preference only; environment switching changes metadata/links only.
  Neither can mutate a service, configuration source, provider, collector,
  schema, or database.
- [2026-10-20] Expanded the versioned WiringConfig into eight spatial groups,
  34 typed nodes, and explicit `continuous` / `event` flows. Added React Flow
  groups, MiniMap, controls, fixed cards, smooth-step arrows, localStorage layout
  recovery/reset, and the mobile list equivalent.
- [2026-10-20] Added an accessible near-fullscreen node inspector with live
  status/counters, environment link, upstream/downstream navigation, docs,
  copy-only remediation, and the first typed extension (`database`).
- [2026-10-20] External links that could not be verified from repository facts
  remain empty and visibly render **Owner TODO**. This includes service/vendor
  dashboards and operational destinations not already documented in the repo;
  no URL was invented. Architecture descriptions for those nodes are therefore
  informational assumptions pending owner review.
- [2026-10-20] Mission Control implementation and its 53 focused tests use
  fixtures/mocks only; no Prisma CLI command, credential, write, migration, or
  successful database connection was used. The required whole-app build and
  full-suite command reached pre-existing read-only integration paths, which
  failed closed against the unavailable localhost test database; no data was
  reached. No dependency, table, migration, provider, collector, schema, or
  collector data-flow change.
- [2026-10-20] Verification: Mission Control 53/53; typecheck green; scoped
  eslint zero errors/warnings; Storybook build green; Next production build
  green; six Playwright screenshots refreshed at 1440/768/390 in light/dark.
  Whole suite: 2091 passed, six existing real-DB integration tests could not run
  because the local test database is unavailable; CI is the authoritative gate.
- [2026-10-20] Added Storybook fixtures for mixed states, very long hint, 1 node, 12 nodes, stale collector, all-ok, and all-down. Captured light/dark evidence at 1440, 768, and 390 pixels in `docs/assets/mission-control/`.
- [2026-10-20] Added render coverage for node/hint separation, exact live-node attention filtering and severity order, stale collector visibility, and reduced-motion edge behavior. No database command or access; no provider, collector, schema, migration, or data-flow changes.

---

## Later stages

v1 complete after Stage 6 lands (see plan §4 Definition of Done).

---

## Full-screen canvas readability pass

- [2026-10-22] Rebuilt the desktop hub as a viewport-filling, no-page-scroll
  operations canvas with a slim environment/search/counts toolbar, fit/reset and
  fullscreen controls, a collapsible overview, and a persistent right inspector.
  Mobile remains the list presentation.
- [2026-10-22] Reworked map hierarchy: large live status/value/updated cards;
  compact one-line reference nodes; titled group frames with count and worst live
  status; reference-only groups collapsed by default; no MiniMap.
- [2026-10-22] Unified rendered and tested node geometry, moved the Commerce
  reference row clear of live cards, and added collision/bounds coverage. A
  dragged node cannot be left over a sibling. Pushing a group edge expands that
  group on the grid and shifts adjacent groups instead of overlapping them.
  Positions remain a local view preference under ADR-0006.
- [2026-10-22] Muted default flows and exposed labels/direction for selected,
  fresh, warning, and down paths; hovering a node dims unrelated topology.
- [2026-10-22] Added Storybook review states for mixed health, all-ok, all-down,
  inspector, production, and explicit light/dark capture. Refreshed screenshots
  at 1440, 768, and 390 pixels in `docs/assets/mission-control/`.
- [2026-10-22] Scope remained read-only: links and clipboard only. No dependency,
  table, schema, database, provider, or collector change.
- [2026-10-22] Verification: Mission Control 58/58, typecheck and scoped ESLint
  green, Storybook production build green, six responsive screenshots checked.
  Required `pnpm test:run` was executed: 2137/2148 passed; six existing real-DB
  integration tests failed closed because `127.0.0.1:55432` is unavailable, and
  five unrelated UI cases timed out only in the fully parallel run. Those five
  were rerun serially and passed 24/24. No database command or access was used.

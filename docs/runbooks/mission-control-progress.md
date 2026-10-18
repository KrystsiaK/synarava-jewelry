# Mission Control — progress

**ADR:** [0005](../adr/0005-mission-control-hub.md) · **Plan:** [mission-control-hub-plan.md](mission-control-hub-plan.md)

Track each stage with dated evidence. Do not mark a stage done without proof.

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

**Stage 1 status:** done (packages published-only, probe widget in shell, types + build + unit test green).

---

## Later stages

Not started. Next: **Этап 2 — Схема состояния + контракт статуса**.

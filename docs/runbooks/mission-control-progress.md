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

**Stage 1 status:** blocked — not green (no widget render, no build/type proof yet).

---

## ⚠️ ВОПРОСЫ

1. **GitHub Packages token:** Please add a PAT (or GitHub App token) with `read:packages` for the publisher of `@synarava/wiring-engine` / `@synarava/shell-kit` as Cloud Agent secret **`NODE_AUTH_TOKEN`**, so Stage 1 can `pnpm add` without copying package source.
2. **Publisher scope:** Are `wiring-engine@0.2.0` and `shell-kit@0.1.3` published under org **`synarava`**, under user **`KrystsiaK`**, or another owner? (Plan says GitHub Packages `@synarava`; confirm exact registry owner for `.npmrc`.)
3. **Plan vs repo fact:** Plan §1 says reuse the registry «как уже сделано для `@synarava/sku-contract`», but `sku-contract` is local `workspace:*`, not GitHub Packages. Confirm Stage 1 must pull **published** packages (not vendoring sources into `packages/`).
4. **Peer deps:** After install, may we add exact peers **`framer-motion`** and **`zustand`** (plan lists them; not currently in `package.json`)? Budget §0 treats `@synarava/*` peers as reuse, not the one new runtime dep (`@xyflow/react` is Stage 3). Confirm OK to add those two peers on Stage 1.
5. **Deploy note:** After packages are private-registry deps, `docs/runbooks/deploy.md` (no private registry) will need an update — OK as part of Stage 1 PR docs hygiene?

---

## Later stages

Not started (waiting for Stage 1 go).

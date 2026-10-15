# Portable SKU platform — production (Stage 6 prep)

**Status:** prep only — **no merge / no `railway config apply` / no n8n import** until Business Owner + Kiryl explicit go.  
**ADR:** [`docs/adr/0004-portable-sku-service-boundary.md`](../adr/0004-portable-sku-service-boundary.md) (amendment Stage 6)  
**Proposal:** [`docs/proposals/portable-sku-service.md`](../proposals/portable-sku-service.md) § Этап 6  
**IaC:** [`.railway/railway.ts`](../../.railway/railway.ts)  
**Staging twin:** [`portable-sku-platform-railway.md`](portable-sku-platform-railway.md)  
**CLI:** [railway config](https://docs.railway.com/cli/config)

## Safe production source branch

| Ref | Role |
| --- | --- |
| **`origin/staging`** | Integration source containing the complete Stage 6 release |
| **`origin/main`** | Only permitted production deploy branch |
| PR [#148](https://github.com/KrystsiaK/synarava-jewelry/pull/148) | The single `staging`→`main` release vehicle; direct pushes to `main` are forbidden |

PR #169 must first merge into **`staging`**. Then PR #148 must merge the complete current `staging` history into protected **`main`**. Production `sku-api` always deploys from **`main`** (`PROD_SKU_API_GITHUB_BRANCH`). The production plan-check fails unless `git merge-base --is-ancestor origin/staging origin/main` succeeds.

## Identity (hard guards)

| Item | Value |
| --- | --- |
| Display name | **`portable-sku-platform`** |
| Immutable project ID | **`6d7d5885-43eb-4283-b4a4-e552fc6dba7b`** |
| Production environment name | **`production`** |
| Immutable production environment ID | **`d8cb7dd8-5c26-4255-a8c5-7795f1993de6`** |
| Existing n8n | **`sku-platform-n8n`** (service ID `04d32fed-eae9-4219-8ebb-cc6cbc403c37`) |
| Existing n8n Postgres | **`sku-platform-n8n-postgres`** (service ID `e7f8a122-dfb5-498e-8002-23fb0f50e3ca`) |
| Existing n8n volume | **`sku-platform-n8n-volume`** (`PROD_N8N_VOLUME_NAME` — exact live name) |
| Existing n8n Postgres volume | **`postgres-volume`** — must not create/delete/replace |
| Production n8n image | **`n8nio/n8n:2.42.7`** (`PROD_N8N_IMAGE`) — **not** staging `2.44.1` |
| Staging n8n image | **`n8nio/n8n:2.44.1`** (`STAGING_N8N_IMAGE`) — separate pin |
| Expected **new** resources | **`sku-api`**, **`sku-postgres`** only |

## Exact expected Railway plan

| Action | Resource | Notes |
| --- | --- | --- |
| **create** | `sku-postgres` | Isolated production SKU DB |
| **create** | `sku-api` | Isolated production API sourced only from protected `main` after PR #148 |
| **adopt / no structural change** | `sku-platform-n8n` | Zero create/delete/replace; image stays `2.42.7` |
| **adopt / no structural change** | `sku-platform-n8n-postgres` | Zero create/delete/replace |
| **adopt / no structural change** | `sku-platform-n8n-volume` | Exact live volume name |
| **adopt / no structural change** | `postgres-volume` | Existing n8n-postgres volume — never recreate |
| **allowed update** | env on `sku-platform-n8n` | e.g. `SKU_API_URL` → private `:8080` of new `sku-api` |

## Plan gate (wired — not optional)

Gate module: [`scripts/lib/railway-prod-plan-gate.mjs`](../../scripts/lib/railway-prod-plan-gate.mjs)  
Plan check script: [`scripts/sku-platform-production-plan-check.sh`](../../scripts/sku-platform-production-plan-check.sh)

Hard fail when any of:

- Unknown plan format (no `changes` / `diff` / `operations` / `steps` array)
- Zero recognized changes
- Missing either create of `sku-api` or `sku-postgres`
- Any create other than those two
- Any delete/replace of any resource
- Create/delete/replace of `sku-platform-n8n`, `sku-platform-n8n-postgres`, `sku-platform-n8n-volume`, or `postgres-volume`

```bash
# Gate an existing plan JSON:
node scripts/lib/railway-prod-plan-gate.mjs .railway/local/sku-platform-production.plan.json

# Or run plan + gate together (wired):
./scripts/sku-platform-production-plan-check.sh
```

## Safe adoption sequence (status → pull → partials → plan+gate)

Helper: [`scripts/sku-platform-production-adopt-check.sh`](../../scripts/sku-platform-production-adopt-check.sh)  
Runs status → pull → partials, then **invokes** `sku-platform-production-plan-check.sh` (hard gate). Set `SKU_PLATFORM_SKIP_PLAN=1` only for pull inspection — **not** for go-live.

```bash
railway login
./scripts/sku-platform-production-adopt-check.sh
# 1) link + status (project ID + production env ID)
# 2) config pull --json → .railway/local/sku-platform-production.pull.json
# 3) config partials list
# 4) pnpm install + ./scripts/sku-platform-production-plan-check.sh (HARD GATE)
```

### Plan gate checklist — abort unless all true

- [ ] PR #169 is merged into `staging`, and PR #148 merged the complete current `staging` history into protected `main`
- [ ] Automated ancestry gate confirms `origin/main` contains `origin/staging`
- [ ] Environment is **production** and environment ID is `d8cb7dd8-5c26-4255-a8c5-7795f1993de6`
- [ ] Project ID is `6d7d5885-43eb-4283-b4a4-e552fc6dba7b`
- [ ] **Exactly two creates:** `sku-api` and `sku-postgres`
- [ ] **No** create / delete / replace of `sku-platform-n8n`
- [ ] **No** create / delete / replace of `sku-platform-n8n-postgres`
- [ ] **No** create / delete / replace of `sku-platform-n8n-volume` or `postgres-volume`
- [ ] Production n8n image remains **`n8nio/n8n:2.42.7`** (no upgrade to staging `2.44.1`)
- [ ] `sku-platform-production-plan-check.sh` exited 0
- [ ] Business Owner + Kiryl explicit go before any `railway config apply`

```bash
# ONLY after explicit go + gate above — NOT part of this prep PR
# railway config apply
```

## Production env vars (names only — no values)

### `sku-api` (new)

| Name | Purpose |
| --- | --- |
| `PORT` | Listen port (`8080`) |
| `SKU_DATABASE_URL` | From `sku-postgres` |
| `SKU_API_CREDENTIALS` | Per-workspace Bearer hashes (sealed) |
| `SKU_API_PRE_AUTH_RATE_LIMIT_PER_MIN` | Pre-auth rate limit |
| `SKU_API_RATE_LIMIT_PER_MIN` | Post-auth rate limit |

### `sku-platform-n8n` (adopt)

| Name | Purpose |
| --- | --- |
| `SKU_API_URL` | Private `http://${{sku-api.RAILWAY_PRIVATE_DOMAIN}}:8080` |
| `SKU_API_TOKEN` | Production Bearer (sealed) |
| `SKU_API_WORKSPACE` | `synarava-shop` |
| `CATALOG_ITEMS_JSON` | Audit batch JSON (sealed / ops-managed) |
| `TELEGRAM_CHAT_ID` | Shared **Synarava Ops** chat (sealed) |
| `N8N_*` / `DB_POSTGRESDB_*` / auth / encryption | Existing sealed vars — preserve |

Telegram **bot token** lives only in the production n8n Telegram credential (created inside n8n UI). **Never** commit tokens, chat IDs, or credential values.

### Synarava web (`synarava-shop` / production) — client

| Name | Purpose |
| --- | --- |
| `SKU_API_URL` | Public HTTPS host of production `sku-api` |
| `SKU_API_TOKEN` | Production Bearer (sealed) |
| `SKU_API_WORKSPACE` | `synarava-shop` |

**Kill switch / feature flag:** unset production web `SKU_API_URL` and/or `SKU_API_TOKEN` → Admin assign path treats sku-api as unconfigured ([`lib/sku/config.ts`](../../lib/sku/config.ts)). Validation/audit can stay read-only via API health. Secondary: deactivate the n8n workflow schedule.

## Workflow import (manual — do not execute in this prep)

Artifact: [`deploy/n8n/sku-catalog-audit.workflow.production.json`](../../deploy/n8n/sku-catalog-audit.workflow.production.json)

1. Open production n8n (`sku-platform-n8n`) UI.
2. Create Telegram credential for shared channel **Synarava Ops** (token not in git).
3. Create Header Auth credential for production `sku-api` Bearer.
4. Import the production workflow JSON.
5. Map credentials; confirm message header is exactly **`🔴 PRODUCTION · SKU AUDIT`**.
6. Keep workflow **inactive** until Business Owner go for the single draft-product pilot.
7. Set `TELEGRAM_CHAT_ID` / `CATALOG_ITEMS_JSON` as Railway env (names only in git).

## Limited rollout (one draft product)

1. Feature flag off (web `SKU_API_*` unset) until sku-api healthy.
2. Apply IaC only after **wired plan gate PASS** + explicit go.
3. Bootstrap production credentials + legacy import offline (ops).
4. Enable web `SKU_API_*` for production.
5. Create **exactly one** new **draft** Shopify product; assign SKU via Admin; confirm Shopify write-through.
6. Business Owner **manual confirmation** recorded (who / when / product handle).
7. Observe one full ops cycle (assign + optional audit notify).
8. Only then expand to more products / workspaces.

## Rollback

| Situation | Action |
| --- | --- |
| Before apply | No Railway change; leave PR open |
| After apply, before web enable | Stop/remove **new** `sku-api` / `sku-postgres` only under Kiryl direction — **never** delete `sku-platform-n8n*` or volumes |
| After web enable | Kill switch: unset web `SKU_API_URL` / `SKU_API_TOKEN`; deactivate n8n workflow |
| Bad SKU on the draft product | Keep draft unpublished; resolve via Admin / Shopify; do not bulk-rewrite catalog |

## Ordered manual production steps (human-only)

1. Merge PR #169 into `staging` through GitHub.
2. Merge the complete `staging` branch into protected `main` through PR #148; no direct push to `main`.
3. Confirm Business Owner + Kiryl go for Stage 6 apply (this prep does **not** grant it).
4. Run `./scripts/sku-platform-production-adopt-check.sh` (main ancestry → status → pull → partials → **plan+gate**).
5. Confirm gate PASS (exactly creates `sku-api` + `sku-postgres`; volumes/`sku-platform-n8n*` untouched).
6. `railway config apply` — **only** after explicit go.
7. Seal production `sku-api` credentials + Synarava web `SKU_API_*`.
8. Create Telegram credential inside production n8n (Synarava Ops).
9. Import production workflow JSON; keep inactive until pilot go.
10. Enable assign for **one draft** product; Business Owner confirms.
11. Rollback via kill switch if anything fails.

## Related

- Staging n8n ops: [`sku-catalog-audit-staging.md`](sku-catalog-audit-staging.md)
- Current status: [`docs/wiki/portable-sku-current-status.md`](../wiki/portable-sku-current-status.md)

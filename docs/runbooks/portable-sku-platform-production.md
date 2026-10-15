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
| **`origin/staging`** | **Safe source** for Stage 6 prep — holds Stages 1–5 + Telegram notify (#168) |
| `origin/main` | Behind staging; no SKU platform code yet |
| PR [#148](https://github.com/KrystsiaK/synarava-jewelry/pull/148) | Open `staging`→`main` vehicle — **do not merge** from this Stage 6 prep |

This runbook’s IaC PR should target **`staging`**. Production `sku-api` GitHub deploy branch is **`staging`** (`PROD_SKU_API_GITHUB_BRANCH`) until #148 lands; then switch to `main` in a follow-up before broader rollout.

## Identity (hard guards)

| Item | Value |
| --- | --- |
| Display name | **`portable-sku-platform`** |
| Immutable project ID | **`6d7d5885-43eb-4283-b4a4-e552fc6dba7b`** |
| Production environment name | **`production`** |
| Immutable production environment ID | **`d8cb7dd8-5c26-4255-a8c5-7795f1993de6`** |
| Existing n8n | **`sku-platform-n8n`** (service ID `04d32fed-eae9-4219-8ebb-cc6cbc403c37`) |
| Existing n8n Postgres | **`sku-platform-n8n-postgres`** (service ID `e7f8a122-dfb5-498e-8002-23fb0f50e3ca`) |
| Existing volumes | Adopt only — **never** create / delete / replace |
| Expected **new** resources | **`sku-api`**, **`sku-postgres`** only |

## Exact expected Railway plan

| Action | Resource | Notes |
| --- | --- | --- |
| **create** | `sku-postgres` | Isolated production SKU DB |
| **create** | `sku-api` | Isolated production API (branch `staging` until #148) |
| **adopt / no structural change** | `sku-platform-n8n` | Zero create/delete/replace; no image bump without justification |
| **adopt / no structural change** | `sku-platform-n8n-postgres` | Zero create/delete/replace |
| **adopt / no structural change** | volume named `PROD_N8N_VOLUME_NAME` (default `sku-platform-n8n-data`) | If pull shows another name, update constant — do not create |
| **allowed update** | env on `sku-platform-n8n` | e.g. `SKU_API_URL` → private `:8080` of new `sku-api` |

Unit gate: [`scripts/lib/railway-prod-plan-gate.mjs`](../../scripts/lib/railway-prod-plan-gate.mjs).

## Safe adoption sequence (status → pull → partials → plan)

Helper: [`scripts/sku-platform-production-adopt-check.sh`](../../scripts/sku-platform-production-adopt-check.sh)

```bash
railway login
./scripts/sku-platform-production-adopt-check.sh
# 1) link + status (project ID + production env ID)
# 2) config pull --json → .railway/local/sku-platform-production.pull.json
# 3) config partials list
# then:
pnpm install --frozen-lockfile
railway config plan
# optional: save plan JSON and evaluate with railway-prod-plan-gate
```

### Plan gate — abort unless all true

- [ ] Environment is **production** and environment ID is `d8cb7dd8-5c26-4255-a8c5-7795f1993de6`
- [ ] Project ID is `6d7d5885-43eb-4283-b4a4-e552fc6dba7b`
- [ ] **Creates only** `sku-api` and `sku-postgres`
- [ ] **No** create / delete / replace of `sku-platform-n8n`
- [ ] **No** create / delete / replace of `sku-platform-n8n-postgres`
- [ ] **No** create / delete / replace of existing volumes
- [ ] **No** n8n image/version change unless documented justification (primary: keep live tag)
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
2. Apply IaC only after plan gate + explicit go.
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

1. Confirm Business Owner + Kiryl go for Stage 6 apply (this prep does **not** grant it).
2. Run `./scripts/sku-platform-production-adopt-check.sh` (status → pull → partials).
3. Verify volume name vs `PROD_N8N_VOLUME_NAME`; adjust IaC if needed (no new volume).
4. `railway config plan` → plan gate (creates only sku-api + sku-postgres).
5. `railway config apply` — **only** after explicit go.
6. Seal production `sku-api` credentials + Synarava web `SKU_API_*`.
7. Create Telegram credential inside production n8n (Synarava Ops).
8. Import production workflow JSON; keep inactive until pilot go.
9. Enable assign for **one draft** product; Business Owner confirms.
10. Rollback via kill switch if anything fails.

## Related

- Staging n8n ops: [`sku-catalog-audit-staging.md`](sku-catalog-audit-staging.md)
- Current status: [`docs/wiki/portable-sku-current-status.md`](../wiki/portable-sku-current-status.md)

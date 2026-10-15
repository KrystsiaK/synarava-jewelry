# Portable SKU — current status

**As of:** 2026-10-15  
**Canonical plan:** [`portable-sku-service.md`](../proposals/portable-sku-service.md) · **Wiki:** [`portable-sku-service.md`](portable-sku-service.md)

| Stage | Status |
| --- | --- |
| 1–4 | On staging (sku-api + Synarava adapter + matrix) |
| 5 Slice A | Catalog audit API + CLI — shipped |
| 5 Slice B | Staging n8n catalog audit — **smoke Pass**; notify = **Telegram** (`Notify Telegram · SKU`) |
| 6 | **Prep PR** — production IaC/runbook/workflow import instructions; **no apply / no import / no merge** |

## Safe source for Stage 6

- **Source branch:** `staging` (ahead of `main`; includes #168 Telegram notify).
- **PR #148** (`staging`→`main`) remains the main-land vehicle — leave open; do not merge from Stage 6 prep.
- Production `sku-api` GitHub deploy branch stays `staging` until #148 merges (then switch to `main` in a follow-up).

## Stage 5 notify (live staging)

- Workflow: [`deploy/n8n/sku-catalog-audit.workflow.json`](../../deploy/n8n/sku-catalog-audit.workflow.json)
- Branch: `shouldNotify?` → **Notify Telegram · SKU** → Save checkpoint (true); Save checkpoint only (false)
- Message includes **🟡 STAGING** and [SKU Audit](https://synarava-shop-app-staging.up.railway.app/admin/settings#shared-sku-policy)
- Secrets: `$env.TELEGRAM_CHAT_ID` + n8n Telegram credential — **never** in git
- Temporary `NOTIFY_WEBHOOK_URL` / **Notify webhook** — removed from monorepo (synced with live staging)

## Stage 6 prep (not executed)

- Runbook: [`docs/runbooks/portable-sku-platform-production.md`](../runbooks/portable-sku-platform-production.md)
- Adopt-check: `scripts/sku-platform-production-adopt-check.sh` (`status` → `pull` → `partials` → then manual `plan`)
- Plan gate: creates **only** production `sku-api` + `sku-postgres`; zero create/delete/replace of `sku-platform-n8n*` / volumes
- Production workflow artifact (import instructions only): [`deploy/n8n/sku-catalog-audit.workflow.production.json`](../../deploy/n8n/sku-catalog-audit.workflow.production.json) — header **`🔴 PRODUCTION · SKU AUDIT`**
- Kill switch: unset production web `SKU_API_URL` / `SKU_API_TOKEN`
- Pilot: exactly one new **draft** Shopify product + Business Owner manual confirmation

## Gates

- PR #148 (`staging`→`main`) stays open — no main merge
- Stage 6 prep PR stays open — no merge/apply until Business Owner + explicit go
- No production n8n workflow import from agents
- No `railway config apply` without Kiryl + Business Owner confirm

## Runbooks

- [`sku-catalog-audit-staging.md`](../runbooks/sku-catalog-audit-staging.md)
- [`portable-sku-platform-railway.md`](../runbooks/portable-sku-platform-railway.md)
- [`portable-sku-platform-production.md`](../runbooks/portable-sku-platform-production.md)
- Matrix: [`portable-sku-staging-matrix.md`](../testing/portable-sku-staging-matrix.md)

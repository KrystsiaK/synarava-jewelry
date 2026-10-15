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

- **Integration source:** `staging` (includes #168 Telegram notify and, after merge, #169).
- **Production source:** protected `main` only.
- **PR #148** is the single `staging`→`main` release vehicle and must carry the complete current `staging` history; direct pushes to `main` are forbidden.
- Production plan/apply is blocked until the ancestry gate confirms `origin/main` contains `origin/staging`.

## Stage 5 notify (live staging)

- Workflow: [`deploy/n8n/sku-catalog-audit.workflow.json`](../../deploy/n8n/sku-catalog-audit.workflow.json)
- Branch: `shouldNotify?` → **Notify Telegram · SKU** → Save checkpoint (true); Save checkpoint only (false)
- Message includes **🟡 STAGING** and [SKU Audit](https://synarava-shop-app-staging.up.railway.app/admin/settings#shared-sku-policy)
- Secrets: `$env.TELEGRAM_CHAT_ID` + n8n Telegram credential — **never** in git
- Temporary `NOTIFY_WEBHOOK_URL` / **Notify webhook** — removed from monorepo (synced with live staging)

## Stage 6 prep (not executed)

- Runbook: [`docs/runbooks/portable-sku-platform-production.md`](../runbooks/portable-sku-platform-production.md)
- Adopt-check: `scripts/sku-platform-production-adopt-check.sh` (`status` → `pull` → `partials` → **wired** `sku-platform-production-plan-check.sh`)
- Plan gate (hard): exactly creates `sku-api` + `sku-postgres`; unknown/empty plan → fail; zero create/delete/replace of `sku-platform-n8n*` / `sku-platform-n8n-volume` / `postgres-volume`
- Images: staging `n8nio/n8n:2.44.1`; production adopt `n8nio/n8n:2.42.7` (no upgrade)
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

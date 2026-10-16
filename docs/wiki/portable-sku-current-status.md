# Portable SKU — current status

**As of:** 2026-10-16
**Canonical plan:** [`portable-sku-service.md`](../proposals/portable-sku-service.md) · **Wiki:** [`portable-sku-service.md`](portable-sku-service.md)

| Stage | Status |
| --- | --- |
| 1–4 | Shipped to production (sku-api + Synarava adapter + policy UI) |
| 5 Slice A | Catalog audit API + CLI — shipped |
| 5 Slice B | Staging n8n catalog audit — **smoke Pass**; notify = **Telegram** (`Notify Telegram · SKU`) |
| 6 | Production platform deployed; draft-product SKU assignment passed; n8n workflow imported but remains inactive while live Shopify sourcing lands |

## Live Shopify audit source (current change)

- n8n no longer owns a manually copied catalog list.
- `GET /api/ops/sku-catalog` authenticates with the existing SKU service Bearer, reads all live Shopify variants with cursor pagination, and returns only normalized `{ externalVariantId, sku }` rows.
- Shopify Admin credentials remain in Synarava web and are never copied to n8n.
- A complete snapshot is required; pagination or upstream failures abort the run. The shared bounded contract supports up to 5,000 variants.
- n8n sends that complete snapshot to sku-api, which compares it with the ledger and preserves the existing digest/Telegram checkpoint behavior.

## Stage 5 notify (live staging)

- Workflow: [`deploy/n8n/sku-catalog-audit.workflow.json`](../../deploy/n8n/sku-catalog-audit.workflow.json)
- Branch: `shouldNotify?` → **Notify Telegram · SKU** → Save checkpoint (true); Save checkpoint only (false)
- Message includes **🟡 STAGING** and [SKU Audit](https://synarava-shop-app-staging.up.railway.app/admin/settings#shared-sku-policy)
- Secrets: `$env.TELEGRAM_CHAT_ID` + n8n Telegram credential — **never** in git
- Temporary `NOTIFY_WEBHOOK_URL` / **Notify webhook** — removed from monorepo (synced with live staging)

## Production state

- Runbook: [`docs/runbooks/portable-sku-platform-production.md`](../runbooks/portable-sku-platform-production.md)
- Adopt-check: `scripts/sku-platform-production-adopt-check.sh` (`status` → `pull` → `partials` → **wired** `sku-platform-production-plan-check.sh`)
- Plan gate (hard): exactly creates `sku-api` + `sku-postgres`; unknown/empty plan → fail; zero create/delete/replace of `sku-platform-n8n*` / `sku-platform-n8n-volume` / `postgres-volume`
- Images: staging `n8nio/n8n:2.44.1`; production adopt `n8nio/n8n:2.42.7` (no upgrade)
- Production workflow artifact: [`deploy/n8n/sku-catalog-audit.workflow.production.json`](../../deploy/n8n/sku-catalog-audit.workflow.production.json) — header **`🔴 PRODUCTION · SKU AUDIT`**, canonical link `https://shop.synarava.com/admin/settings#shared-sku-policy`
- Kill switch: unset production web `SKU_API_URL` / `SKU_API_TOKEN`
- Pilot: production Draft product assigned `EY-ACC-001`; Shopify read-back passed.

## Gates

- Production n8n workflow stays inactive until the live-Shopify version is deployed, imported, manually executed once, and its item count is confirmed.
- Direct pushes to protected `main` remain forbidden; ship through `staging` and a PR to `main`.
- No additional production Railway apply is needed for catalog sourcing; the obsolete catalog variable can be removed later after the new workflow is verified.

## Runbooks

- [`sku-catalog-audit-staging.md`](../runbooks/sku-catalog-audit-staging.md)
- [`portable-sku-platform-railway.md`](../runbooks/portable-sku-platform-railway.md)
- [`portable-sku-platform-production.md`](../runbooks/portable-sku-platform-production.md)
- Matrix: [`portable-sku-staging-matrix.md`](../testing/portable-sku-staging-matrix.md)

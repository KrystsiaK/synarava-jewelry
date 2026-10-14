#!/usr/bin/env bash
# Safe adoption check for portable-sku-platform / staging.
# Exact sequence BEFORE `railway config plan` (and long before apply).
# Docs: docs/runbooks/portable-sku-platform-railway.md
# https://docs.railway.com/cli/config
set -euo pipefail

PROJECT_ID="${SKU_PLATFORM_PROJECT_ID:-6d7d5885-43eb-4283-b4a4-e552fc6dba7b}"
PROJECT_NAME="${SKU_PLATFORM_PROJECT_NAME:-portable-sku-platform}"
ENVIRONMENT="${SKU_PLATFORM_ENVIRONMENT:-staging}"
PARTIAL_NAME="${SKU_PLATFORM_PARTIAL:-sku}"
PULL_JSON="${SKU_PLATFORM_PULL_JSON:-/tmp/sku-platform-staging.pull.json}"

echo "==> 1) Link ${PROJECT_NAME} (${PROJECT_ID}) / ${ENVIRONMENT}"
railway link --project "${PROJECT_NAME}" --environment "${ENVIRONMENT}"

echo "==> 2) config pull --json (inspect live graph; do NOT overwrite committed .railway/railway.ts)"
railway config pull --json --environment "${ENVIRONMENT}" >"${PULL_JSON}"
echo "    wrote ${PULL_JSON}"
echo "    Confirm services named sku-api and sku-postgres exist (adopt by name)."

echo "==> 3) config partials list (ownership check)"
railway config partials list
echo "    Expect sku-api / sku-postgres unowned (*) or already owned by partial '${PARTIAL_NAME}'."
echo "    If owned by another named partial, transfer (dry-run first), e.g.:"
echo "      railway config partials transfer <source> ${PARTIAL_NAME} \\"
echo "        --resource service.sku-api --resource database.sku-postgres --dry-run"
echo "    Use exact addresses from 'partials list'. Do not release/transfer production resources."

echo "==> 4) Keep committed authoring file as source of truth"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git checkout -- .railway/railway.ts 2>/dev/null || true
fi
echo "    Committed .railway/railway.ts must declare service('sku-api') + postgres('sku-postgres')"
echo "    so plan adopts them (no recreate)."

echo "==> 5) NEXT (manual): pnpm install --frozen-lockfile && railway config plan"
echo "    Apply ONLY if plan has no create/delete/replace of existing sku-api / sku-postgres."
echo "    Creating staging n8n / n8n-postgres / n8n-data is expected."
echo "    Do NOT railway config apply until Kiryl confirms."

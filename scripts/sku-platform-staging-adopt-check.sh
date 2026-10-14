#!/usr/bin/env bash
# Safe adoption check for portable-sku-platform / staging.
# Exact sequence BEFORE railway config plan (and long before apply).
# Docs: docs/runbooks/portable-sku-platform-railway.md
# https://docs.railway.com/cli/config
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

readonly EXPECTED_PROJECT_ID="6d7d5885-43eb-4283-b4a4-e552fc6dba7b"
readonly EXPECTED_PROJECT_NAME="portable-sku-platform"
readonly EXPECTED_ENVIRONMENT="staging"
readonly PARTIAL_NAME="sku"
readonly LOCAL_DIR="${ROOT}/.railway/local"
readonly PULL_JSON="${LOCAL_DIR}/sku-platform-staging.pull.json"

abort() {
  echo "ERROR: $*" >&2
  exit 1
}

if [[ -n "${SKU_PLATFORM_ENVIRONMENT:-}" && "${SKU_PLATFORM_ENVIRONMENT}" != "${EXPECTED_ENVIRONMENT}" ]]; then
  abort "SKU_PLATFORM_ENVIRONMENT override forbidden; staging-only."
fi
if [[ -n "${RAILWAY_ENVIRONMENT:-}" && "${RAILWAY_ENVIRONMENT}" != "${EXPECTED_ENVIRONMENT}" ]]; then
  abort "RAILWAY_ENVIRONMENT override forbidden; staging-only."
fi
if [[ -n "${SKU_PLATFORM_PROJECT_ID:-}" && "${SKU_PLATFORM_PROJECT_ID}" != "${EXPECTED_PROJECT_ID}" ]]; then
  abort "SKU_PLATFORM_PROJECT_ID override forbidden."
fi

command -v railway >/dev/null || abort "railway CLI not found"
command -v node >/dev/null || abort "node is required to verify railway status --json"

mkdir -p "${LOCAL_DIR}"

echo "==> 1) Link ${EXPECTED_PROJECT_NAME} (${EXPECTED_PROJECT_ID}) / ${EXPECTED_ENVIRONMENT}"
railway link --project "${EXPECTED_PROJECT_NAME}" --environment "${EXPECTED_ENVIRONMENT}"

echo "==> 1b) Verify link via railway status --environment staging --json"
STATUS_JSON_FILE="${LOCAL_DIR}/railway-status-staging.json"
railway status --environment "${EXPECTED_ENVIRONMENT}" --json >"${STATUS_JSON_FILE}"
SKU_PLATFORM_EXPECTED_PROJECT_ID="${EXPECTED_PROJECT_ID}" \
SKU_PLATFORM_EXPECTED_ENVIRONMENT="${EXPECTED_ENVIRONMENT}" \
  node "${ROOT}/scripts/lib/railway-status-verify.mjs" "${STATUS_JSON_FILE}" \
  || abort "railway status verification failed"

echo "==> 2) config pull --json (inspect live graph; does NOT overwrite .railway/railway.ts)"
railway config pull --json --environment "${EXPECTED_ENVIRONMENT}" >"${PULL_JSON}"
echo "    wrote ${PULL_JSON} (ignored via .railway/local ignore file)"
echo "    Confirm services named sku-api and sku-postgres exist (adopt by name)."

echo "==> 3) config partials list (ownership check)"
railway config partials list
echo "    Expect sku-api / sku-postgres unowned (*) or already owned by partial '${PARTIAL_NAME}'."
echo "    If owned by another named partial, transfer (dry-run first), e.g.:"
echo "      railway config partials transfer <source> ${PARTIAL_NAME} \\"
echo "        --resource service.sku-api --resource database.sku-postgres --dry-run"
echo "    Use exact addresses from 'partials list'. Do not release/transfer production resources."

echo "==> 4) Authoring file"
echo "    Keep committed .railway/railway.ts as source of truth (script does not git checkout)."
echo "    It must declare service('sku-api') + postgres('sku-postgres') so plan adopts them."

echo "==> 5) NEXT (manual): pnpm install --frozen-lockfile && railway config plan"
echo "    Apply ONLY if plan has no create/delete/replace of existing sku-api / sku-postgres."
echo "    Creating staging n8n / n8n-postgres / n8n-data is expected."
echo "    Do NOT railway config apply until Kiryl confirms."

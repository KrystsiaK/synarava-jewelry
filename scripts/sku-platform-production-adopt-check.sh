#!/usr/bin/env bash
# Safe adoption check for portable-sku-platform / production (Stage 6).
# Exact sequence: status → pull → partials → plan+gate (wired).
# Docs: docs/runbooks/portable-sku-platform-production.md
# https://docs.railway.com/cli/config
#
# Does NOT run config apply. Does NOT import n8n workflows.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

readonly EXPECTED_PROJECT_ID="6d7d5885-43eb-4283-b4a4-e552fc6dba7b"
readonly EXPECTED_PROJECT_NAME="portable-sku-platform"
readonly EXPECTED_ENVIRONMENT="production"
readonly EXPECTED_ENVIRONMENT_ID="d8cb7dd8-5c26-4255-a8c5-7795f1993de6"
readonly PARTIAL_NAME="sku"
readonly LOCAL_DIR="${ROOT}/.railway/local"
readonly PULL_JSON="${LOCAL_DIR}/sku-platform-production.pull.json"
readonly PROD_N8N_NAME="sku-platform-n8n"
readonly PROD_N8N_PG_NAME="sku-platform-n8n-postgres"
readonly PROD_N8N_VOLUME_NAME="sku-platform-n8n-volume"
readonly PROD_N8N_PG_VOLUME_NAME="postgres-volume"
readonly PROD_N8N_SERVICE_ID="04d32fed-eae9-4219-8ebb-cc6cbc403c37"
readonly PROD_N8N_PG_SERVICE_ID="e7f8a122-dfb5-498e-8002-23fb0f50e3ca"
readonly PLAN_CHECK="${ROOT}/scripts/sku-platform-production-plan-check.sh"

abort() {
  echo "ERROR: $*" >&2
  exit 1
}

if [[ -n "${SKU_PLATFORM_ENVIRONMENT:-}" && "${SKU_PLATFORM_ENVIRONMENT}" != "${EXPECTED_ENVIRONMENT}" ]]; then
  abort "SKU_PLATFORM_ENVIRONMENT override forbidden; production-only for this script."
fi
if [[ -n "${RAILWAY_ENVIRONMENT:-}" && "${RAILWAY_ENVIRONMENT}" != "${EXPECTED_ENVIRONMENT}" ]]; then
  abort "RAILWAY_ENVIRONMENT override forbidden; production-only for this script."
fi
if [[ -n "${SKU_PLATFORM_PROJECT_ID:-}" && "${SKU_PLATFORM_PROJECT_ID}" != "${EXPECTED_PROJECT_ID}" ]]; then
  abort "SKU_PLATFORM_PROJECT_ID override forbidden."
fi
if [[ -n "${SKU_PLATFORM_ENVIRONMENT_ID:-}" && "${SKU_PLATFORM_ENVIRONMENT_ID}" != "${EXPECTED_ENVIRONMENT_ID}" ]]; then
  abort "SKU_PLATFORM_ENVIRONMENT_ID override forbidden."
fi

command -v railway >/dev/null || abort "railway CLI not found"
command -v node >/dev/null || abort "node is required to verify railway status --json"
[[ -x "${PLAN_CHECK}" || -f "${PLAN_CHECK}" ]] || abort "missing plan-check script: ${PLAN_CHECK}"

mkdir -p "${LOCAL_DIR}"

echo "==> Stage 6 production adopt-check (NO apply)"
echo "    project ${EXPECTED_PROJECT_NAME} (${EXPECTED_PROJECT_ID})"
echo "    environment ${EXPECTED_ENVIRONMENT} (${EXPECTED_ENVIRONMENT_ID})"

echo "==> 1) Link"
railway link --project "${EXPECTED_PROJECT_NAME}" --environment "${EXPECTED_ENVIRONMENT}"

echo "==> 1b) Verify link via railway status --environment production --json"
STATUS_JSON_FILE="${LOCAL_DIR}/railway-status-production.json"
railway status --environment "${EXPECTED_ENVIRONMENT}" --json >"${STATUS_JSON_FILE}"
SKU_PLATFORM_EXPECTED_PROJECT_ID="${EXPECTED_PROJECT_ID}" \
SKU_PLATFORM_EXPECTED_ENVIRONMENT="${EXPECTED_ENVIRONMENT}" \
SKU_PLATFORM_EXPECTED_ENVIRONMENT_ID="${EXPECTED_ENVIRONMENT_ID}" \
  node "${ROOT}/scripts/lib/railway-status-verify.mjs" "${STATUS_JSON_FILE}" \
  || abort "railway status verification failed"

echo "==> 2) config pull --json (inspect live graph; does NOT overwrite .railway/railway.ts)"
railway config pull --json --environment "${EXPECTED_ENVIRONMENT}" >"${PULL_JSON}"
echo "    wrote ${PULL_JSON} (ignored via .railway/local ignore file)"
echo "    Confirm existing:"
echo "      - ${PROD_N8N_NAME} (id ${PROD_N8N_SERVICE_ID})"
echo "      - ${PROD_N8N_PG_NAME} (id ${PROD_N8N_PG_SERVICE_ID})"
echo "      - volume ${PROD_N8N_VOLUME_NAME} (exact live name)"
echo "      - volume ${PROD_N8N_PG_VOLUME_NAME} (existing postgres volume — must not recreate)"
echo "    Confirm ABSENT (expected creates on plan): sku-api, sku-postgres"
echo "    Confirm production n8n image is n8nio/n8n:2.42.7 (IaC PROD_N8N_IMAGE; no upgrade)."

echo "==> 3) config partials list (ownership check)"
railway config partials list
echo "    Expect ${PROD_N8N_NAME} / ${PROD_N8N_PG_NAME} unowned (*) or already owned by partial '${PARTIAL_NAME}'."
echo "    If owned by another named partial, transfer (dry-run first), e.g.:"
echo "      railway config partials transfer <source> ${PARTIAL_NAME} \\"
echo "        --resource service.${PROD_N8N_NAME} \\"
echo "        --resource database.${PROD_N8N_PG_NAME} --dry-run"
echo "    Never release/delete production volumes."

echo "==> 4) Authoring file"
echo "    Keep committed .railway/railway.ts as source of truth."
echo "    Production branch must declare:"
echo "      CREATE: service('sku-api') + postgres('sku-postgres')"
echo "      ADOPT:  service('${PROD_N8N_NAME}') + postgres('${PROD_N8N_PG_NAME}') + volume('${PROD_N8N_VOLUME_NAME}')"
echo "      IMAGE:  PROD_N8N_IMAGE=n8nio/n8n:2.42.7 (not staging 2.44.1)"

SKIP_PLAN="${SKU_PLATFORM_SKIP_PLAN:-0}"
if [[ "${SKIP_PLAN}" == "1" ]]; then
  echo "==> 5) SKIP plan+gate (SKU_PLATFORM_SKIP_PLAN=1) — NOT for go-live"
  echo "    Run ./scripts/sku-platform-production-plan-check.sh before any apply."
  exit 0
fi

echo "==> 5) Plan + hard gate (required; wired)"
pnpm install --frozen-lockfile
bash "${PLAN_CHECK}"
echo "==> Adopt-check complete: plan gate PASS. Still do NOT apply without Business Owner + Kiryl go."

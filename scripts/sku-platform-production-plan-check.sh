#!/usr/bin/env bash
# Stage 6 production plan check — runs `railway config plan --json` and
# HARD-FAILS unless the plan gate passes.
#
# Required creates (exactly): sku-api, sku-postgres
# Forbidden create/delete/replace: sku-platform-n8n, sku-platform-n8n-postgres,
#   sku-platform-n8n-volume, postgres-volume
# Unknown plan format or 0 recognized changes → fail
#
# Does NOT run config apply. Does NOT import n8n workflows.
# Docs: docs/runbooks/portable-sku-platform-production.md
# https://docs.railway.com/cli/config
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

readonly EXPECTED_PROJECT_ID="6d7d5885-43eb-4283-b4a4-e552fc6dba7b"
readonly EXPECTED_PROJECT_NAME="portable-sku-platform"
readonly EXPECTED_ENVIRONMENT="production"
readonly EXPECTED_ENVIRONMENT_ID="d8cb7dd8-5c26-4255-a8c5-7795f1993de6"
readonly LOCAL_DIR="${ROOT}/.railway/local"
readonly PLAN_JSON="${LOCAL_DIR}/sku-platform-production.plan.json"
readonly GATE_JS="${ROOT}/scripts/lib/railway-prod-plan-gate.mjs"

abort() {
  echo "ERROR: $*" >&2
  exit 1
}

if [[ -n "${SKU_PLATFORM_ENVIRONMENT:-}" && "${SKU_PLATFORM_ENVIRONMENT}" != "${EXPECTED_ENVIRONMENT}" ]]; then
  abort "SKU_PLATFORM_ENVIRONMENT override forbidden; production-only."
fi
if [[ -n "${RAILWAY_ENVIRONMENT:-}" && "${RAILWAY_ENVIRONMENT}" != "${EXPECTED_ENVIRONMENT}" ]]; then
  abort "RAILWAY_ENVIRONMENT override forbidden; production-only."
fi

command -v railway >/dev/null || abort "railway CLI not found"
command -v node >/dev/null || abort "node is required for plan gate"
[[ -f "${GATE_JS}" ]] || abort "missing plan gate module: ${GATE_JS}"

mkdir -p "${LOCAL_DIR}"

PLAN_INPUT="${1:-}"

if [[ -n "${PLAN_INPUT}" ]]; then
  [[ -f "${PLAN_INPUT}" ]] || abort "plan file not found: ${PLAN_INPUT}"
  echo "==> Using provided plan JSON: ${PLAN_INPUT}"
  cp "${PLAN_INPUT}" "${PLAN_JSON}"
else
  echo "==> Link + verify production context before plan"
  railway link --project "${EXPECTED_PROJECT_NAME}" --environment "${EXPECTED_ENVIRONMENT}"
  STATUS_JSON_FILE="${LOCAL_DIR}/railway-status-production.json"
  railway status --environment "${EXPECTED_ENVIRONMENT}" --json >"${STATUS_JSON_FILE}"
  SKU_PLATFORM_EXPECTED_PROJECT_ID="${EXPECTED_PROJECT_ID}" \
  SKU_PLATFORM_EXPECTED_ENVIRONMENT="${EXPECTED_ENVIRONMENT}" \
  SKU_PLATFORM_EXPECTED_ENVIRONMENT_ID="${EXPECTED_ENVIRONMENT_ID}" \
    node "${ROOT}/scripts/lib/railway-status-verify.mjs" "${STATUS_JSON_FILE}" \
    || abort "railway status verification failed"

  echo "==> railway config plan --json (NO apply)"
  # Prefer JSON for the gate. If CLI rejects --json, fail closed (do not apply).
  if ! railway config plan --json --environment "${EXPECTED_ENVIRONMENT}" >"${PLAN_JSON}" 2>"${LOCAL_DIR}/sku-platform-production.plan.stderr"; then
    abort "railway config plan --json failed (see ${LOCAL_DIR}/sku-platform-production.plan.stderr). Gate requires machine-readable plan."
  fi
  echo "    wrote ${PLAN_JSON}"
fi

echo "==> Hard plan gate (scripts/lib/railway-prod-plan-gate.mjs)"
node "${GATE_JS}" "${PLAN_JSON}" || abort "production plan gate FAILED — do not apply"

echo "==> Plan gate PASS"
echo "    Expected creates only: sku-api, sku-postgres"
echo "    Existing n8n / postgres / volumes untouched structurally"
echo "    Do NOT railway config apply until Business Owner + Kiryl explicit go."
echo "    Do NOT import production n8n workflows from this script."

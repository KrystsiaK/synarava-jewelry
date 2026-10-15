/**
 * Stage 6 production plan gate for portable-sku-platform.
 * Forbids create/delete/replace of existing n8n / n8n-postgres / volumes.
 * Allows create only for sku-api + sku-postgres (and non-structural env updates).
 *
 * Accepts either:
 * - Railway `config plan --json` style objects (best-effort)
 * - A simple fixture shape used by unit tests
 *
 * https://docs.railway.com/cli/config
 */

export const FORBIDDEN_RESOURCE_NAMES = Object.freeze([
  "sku-platform-n8n",
  "sku-platform-n8n-postgres",
  "sku-platform-n8n-data",
]);

export const EXPECTED_CREATE_NAMES = Object.freeze(["sku-api", "sku-postgres"]);

/**
 * @param {unknown} change
 * @returns {{ action: string, name: string } | null}
 */
export function normalizePlanChange(change) {
  if (!change || typeof change !== "object") return null;
  const c = /** @type {Record<string, unknown>} */ (change);
  const actionRaw =
    (typeof c.action === "string" && c.action) ||
    (typeof c.op === "string" && c.op) ||
    (typeof c.type === "string" && c.type) ||
    "";
  const nameRaw =
    (typeof c.name === "string" && c.name) ||
    (typeof c.resource === "string" && c.resource) ||
    (typeof c.resourceName === "string" && c.resourceName) ||
    "";
  const action = actionRaw.trim().toLowerCase();
  const name = nameRaw.trim();
  if (!action || !name) return null;
  return { action, name };
}

/**
 * Extract change list from plan JSON (several CLI shapes).
 * @param {unknown} plan
 * @returns {Array<{ action: string, name: string }>}
 */
export function extractPlanChanges(plan) {
  if (!plan || typeof plan !== "object") return [];
  const p = /** @type {Record<string, unknown>} */ (plan);

  const candidates = [p.changes, p.diff, p.operations, p.steps];
  for (const list of candidates) {
    if (Array.isArray(list)) {
      return list
        .map(normalizePlanChange)
        .filter((x) => x !== null);
    }
  }

  // Nested `{ plan: { changes: [...] } }`
  if (p.plan && typeof p.plan === "object") {
    return extractPlanChanges(p.plan);
  }

  return [];
}

/**
 * @param {unknown} plan
 * @param {{
 *   forbiddenNames?: readonly string[],
 *   expectedCreates?: readonly string[],
 * }} [opts]
 */
export function evaluateProductionPlanGate(plan, opts = {}) {
  const forbiddenNames = opts.forbiddenNames ?? FORBIDDEN_RESOURCE_NAMES;
  const expectedCreates = opts.expectedCreates ?? EXPECTED_CREATE_NAMES;
  const forbiddenSet = new Set(forbiddenNames);
  const expectedCreateSet = new Set(expectedCreates);

  const changes = extractPlanChanges(plan);
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const creates = [];
  /** @type {string[]} */
  const mutationsOnExisting = [];

  for (const change of changes) {
    const { action, name } = change;
    const isCreate =
      action === "create" || action === "add" || action === "new";
    const isDelete =
      action === "delete" ||
      action === "remove" ||
      action === "destroy" ||
      action === "drop";
    const isReplace =
      action === "replace" ||
      action === "recreate" ||
      action === "force-recreate";

    if (isCreate) {
      creates.push(name);
      if (forbiddenSet.has(name)) {
        errors.push(
          `FORBIDDEN create of existing resource "${name}" (must adopt, not recreate)`,
        );
      } else if (!expectedCreateSet.has(name)) {
        errors.push(
          `UNEXPECTED create "${name}" — expected only: ${[...expectedCreateSet].join(", ")}`,
        );
      }
    }

    if (isDelete || isReplace) {
      if (forbiddenSet.has(name) || expectedCreateSet.has(name) || true) {
        // Any delete/replace of managed names is a hard fail for Stage 6.
        mutationsOnExisting.push(`${action}:${name}`);
        errors.push(
          `FORBIDDEN ${action} of "${name}" — Stage 6 plan must not delete/replace existing n8n/Postgres/volumes`,
        );
      }
    }
  }

  const createSet = new Set(creates);
  for (const expected of expectedCreateSet) {
    if (!createSet.has(expected)) {
      // Soft: plan fixtures may omit creates when testing forbidden-only.
      // Callers that require creates pass `requireExpectedCreates: true`.
    }
  }

  const requireExpectedCreates = opts.requireExpectedCreates === true;
  if (requireExpectedCreates) {
    for (const expected of expectedCreateSet) {
      if (!createSet.has(expected)) {
        errors.push(`MISSING expected create "${expected}"`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    creates,
    mutationsOnExisting,
    changeCount: changes.length,
  };
}

export function evaluateProductionPlanGateFromJson(raw, opts) {
  let plan;
  try {
    plan = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      errors: ["plan JSON is not valid JSON"],
      creates: [],
      mutationsOnExisting: [],
      changeCount: 0,
    };
  }
  return evaluateProductionPlanGate(plan, opts);
}

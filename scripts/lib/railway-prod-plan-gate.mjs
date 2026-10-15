/**
 * Stage 6 production plan gate for portable-sku-platform.
 *
 * Hard rules:
 * - Unknown plan format OR 0 recognized changes → fail
 * - Exactly two creates required: sku-api, sku-postgres
 * - Any other create OR any delete/replace → fail
 * - Existing sku-platform-n8n / sku-platform-n8n-postgres /
 *   sku-platform-n8n-volume / postgres-volume must not be created,
 *   deleted, or replaced
 *
 * Env updates on adopted services are allowed (not create/delete/replace).
 *
 * https://docs.railway.com/cli/config
 */

import fs from "node:fs";

export const FORBIDDEN_RESOURCE_NAMES = Object.freeze([
  "sku-platform-n8n",
  "sku-platform-n8n-postgres",
  "sku-platform-n8n-volume",
  "postgres-volume",
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
 * @param {unknown} plan
 * @returns {{
 *   formatKnown: boolean,
 *   changes: Array<{ action: string, name: string }>,
 * }}
 */
export function extractPlanChangesWithFormat(plan) {
  if (!plan || typeof plan !== "object") {
    return { formatKnown: false, changes: [] };
  }
  const p = /** @type {Record<string, unknown>} */ (plan);

  const candidates = [p.changes, p.diff, p.operations, p.steps];
  for (const list of candidates) {
    if (Array.isArray(list)) {
      return {
        formatKnown: true,
        changes: list.map(normalizePlanChange).filter((x) => x !== null),
      };
    }
  }

  if (p.plan && typeof p.plan === "object") {
    return extractPlanChangesWithFormat(p.plan);
  }

  return { formatKnown: false, changes: [] };
}

/** @deprecated Prefer extractPlanChangesWithFormat */
export function extractPlanChanges(plan) {
  return extractPlanChangesWithFormat(plan).changes;
}

/**
 * @param {string} action
 */
function isCreateAction(action) {
  return action === "create" || action === "add" || action === "new";
}

/**
 * @param {string} action
 */
function isDeleteAction(action) {
  return (
    action === "delete" ||
    action === "remove" ||
    action === "destroy" ||
    action === "drop"
  );
}

/**
 * @param {string} action
 */
function isReplaceAction(action) {
  return (
    action === "replace" ||
    action === "recreate" ||
    action === "force-recreate"
  );
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

  const { formatKnown, changes } = extractPlanChangesWithFormat(plan);
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const creates = [];
  /** @type {string[]} */
  const mutationsOnExisting = [];

  if (!formatKnown) {
    errors.push(
      "UNKNOWN plan format — expected a changes/diff/operations/steps array (hard fail)",
    );
    return {
      ok: false,
      errors,
      creates,
      mutationsOnExisting,
      changeCount: 0,
      formatKnown: false,
    };
  }

  if (changes.length === 0) {
    errors.push(
      "ZERO recognized plan changes — expected exactly two creates: sku-api, sku-postgres (hard fail)",
    );
    return {
      ok: false,
      errors,
      creates,
      mutationsOnExisting,
      changeCount: 0,
      formatKnown: true,
    };
  }

  for (const change of changes) {
    const { action, name } = change;

    if (isCreateAction(action)) {
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

    if (isDeleteAction(action) || isReplaceAction(action)) {
      mutationsOnExisting.push(`${action}:${name}`);
      errors.push(
        `FORBIDDEN ${action} of "${name}" — Stage 6 plan must not delete/replace existing n8n/Postgres/volumes`,
      );
    }
  }

  // Exactly the expected creates — always required (hard).
  const createSet = new Set(creates);
  for (const expected of expectedCreateSet) {
    if (!createSet.has(expected)) {
      errors.push(`MISSING expected create "${expected}"`);
    }
  }
  if (creates.length !== expectedCreateSet.size) {
    // Catch duplicates or extras already partially covered above.
    if (creates.length > expectedCreateSet.size) {
      errors.push(
        `EXPECTED exactly ${expectedCreateSet.size} creates (${[...expectedCreateSet].join(", ")}); got ${creates.length}: ${creates.join(", ")}`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    creates,
    mutationsOnExisting,
    changeCount: changes.length,
    formatKnown: true,
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
      formatKnown: false,
    };
  }
  return evaluateProductionPlanGate(plan, opts);
}

const isMain =
  process.argv[1] && process.argv[1].endsWith("railway-prod-plan-gate.mjs");
if (isMain) {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: railway-prod-plan-gate.mjs <plan.json>");
    process.exit(2);
  }
  const raw = fs.readFileSync(file, "utf8");
  const result = evaluateProductionPlanGateFromJson(raw);
  if (!result.ok) {
    console.error("FAIL production plan gate:");
    for (const err of result.errors) {
      console.error("  - " + err);
    }
    process.exit(1);
  }
  console.log(
    "OK production plan gate: creates=" +
      result.creates.join(",") +
      " changeCount=" +
      result.changeCount,
  );
}

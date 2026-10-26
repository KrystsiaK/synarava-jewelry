#!/usr/bin/env node
/**
 * THROWAWAY / one-shot audit — not production tooling.
 *
 * Read-only audit of "phantom" commerce conflicts on a database:
 * for every Product and Collection with a Shopify link, compute the same
 * compare the app uses after `readSynaravaStateForCompare`:
 *
 *   our*WindowFromRow(row)  →  diffShopifyProjections(our, shopifySnapshot)
 *
 * (`readSynaravaStateForCompare` itself is `server-only`; this script calls the
 * same row adapters + diff that that function uses.)
 *
 * Groups leaf diffs by normalized path (`variants[0].sku` → `variants[].sku`),
 * classifies each as PHANTOM (equal after trivial normalization) or REAL,
 * and prints aggregate counts only — never secrets or customer data.
 *
 * Usage (DATABASE_URL must already be set to the target DB; credentials from
 * env only — never hardcode):
 *   node --import tsx scripts/db/audit-phantom-diffs.mjs
 *
 * SELECT only. Never writes. Safe to delete after the audit PR lands.
 */
import { pathToFileURL } from "node:url";

const WEIGHT_TO_GRAMS = {
  GRAMS: 1,
  KILOGRAMS: 1000,
  OUNCES: 28.349523125,
  POUNDS: 453.59237,
};

/** `variants[0].sku` → `variants[].sku` (same collapse as labelForWindowPath). */
function normalizeDiffPath(path) {
  return String(path || "").replace(/\[\d+\]/g, "[]");
}

function valueType(value) {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return typeof value;
}

function isBlankish(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  return false;
}

function tryParseJson(value) {
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.trim();
  if (!trimmed) return { ok: false };
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    return { ok: false };
  }
}

function deepEqualJson(a, b) {
  if (Object.is(a, b)) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return Object.is(a, b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqualJson(a[i], b[i])) return false;
    }
    return true;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (!deepEqualJson(a[key], b[key])) return false;
  }
  return true;
}

function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function weightInGrams(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const unit = typeof value.unit === "string" ? value.unit.toUpperCase() : null;
  const raw = asNumber(value.value);
  if (!unit || raw == null) return null;
  const mult = WEIGHT_TO_GRAMS[unit];
  if (mult == null) return null;
  return Math.round(raw * mult * 10000) / 10000;
}

/**
 * PHANTOM when values are equal after trivial normalization; else REAL.
 * Matches the audit brief: null/undefined/""/whitespace, numeric decimals,
 * weight unit conversion, JSON-after-parse, NFC/trim.
 */
function isPhantomDiff(ourValue, shopifyValue) {
  if (Object.is(ourValue, shopifyValue)) return true;

  if (isBlankish(ourValue) && isBlankish(shopifyValue)) return true;

  if (typeof ourValue === "string" || typeof shopifyValue === "string") {
    const a = typeof ourValue === "string" ? ourValue.normalize("NFC").trim() : ourValue;
    const b = typeof shopifyValue === "string"
      ? shopifyValue.normalize("NFC").trim()
      : shopifyValue;
    if (typeof a === "string" && typeof b === "string" && a === b) return true;
    if (isBlankish(a) && isBlankish(b)) return true;
  }

  const numA = asNumber(ourValue);
  const numB = asNumber(shopifyValue);
  if (numA != null && numB != null && numA === numB) return true;

  const weightA = weightInGrams(ourValue);
  const weightB = weightInGrams(shopifyValue);
  if (weightA != null && weightB != null && weightA === weightB) return true;

  // Nested `{ value, unit }` weight objects already handled; also compare
  // measurement.weight wrappers if present.
  if (
    ourValue
    && shopifyValue
    && typeof ourValue === "object"
    && typeof shopifyValue === "object"
    && !Array.isArray(ourValue)
    && !Array.isArray(shopifyValue)
  ) {
    const nestedA = weightInGrams(ourValue.weight ?? ourValue);
    const nestedB = weightInGrams(shopifyValue.weight ?? shopifyValue);
    if (nestedA != null && nestedB != null && nestedA === nestedB) {
      // If both sides are weight-shaped and grams match, treat as phantom even
      // when unit strings differ (GRAMS vs KILOGRAMS).
      const looksWeight = (v) =>
        v != null
        && typeof v === "object"
        && (typeof v.unit === "string" || (v.weight && typeof v.weight.unit === "string"));
      if (looksWeight(ourValue) && looksWeight(shopifyValue)) return true;
    }
  }

  const jsonA = tryParseJson(ourValue);
  const jsonB = tryParseJson(shopifyValue);
  if (jsonA.ok && jsonB.ok && deepEqualJson(jsonA.value, jsonB.value)) return true;

  if (
    typeof ourValue === "object"
    && ourValue != null
    && typeof shopifyValue === "string"
  ) {
    const parsed = tryParseJson(shopifyValue);
    if (parsed.ok && deepEqualJson(ourValue, parsed.value)) return true;
  }
  if (
    typeof shopifyValue === "object"
    && shopifyValue != null
    && typeof ourValue === "string"
  ) {
    const parsed = tryParseJson(ourValue);
    if (parsed.ok && deepEqualJson(parsed.value, shopifyValue)) return true;
  }

  return false;
}

/** Shape label safe for logs — types + coarse categories, never raw content. */
function shapeLabel(value) {
  const t = valueType(value);
  if (t === "undefined" || t === "null") return t;
  if (t === "boolean") return `boolean:${value}`;
  if (t === "number") return Number.isInteger(value) ? "number:int" : "number:float";
  if (t === "string") {
    if (value === "") return 'string:""';
    if (value.trim() === "") return "string:whitespace";
    if (/^-?\d+(\.\d+)?$/.test(value.trim())) {
      return value.includes(".") ? "string:decimal" : "string:int";
    }
    const parsed = tryParseJson(value);
    if (parsed.ok) return "string:json";
    return `string:len${Math.min(value.length, 9999)}`;
  }
  if (t === "array") return `array:len${value.length}`;
  if (t === "object") {
    const keys = Object.keys(value).toSorted();
    if (typeof value.unit === "string" && "value" in value) {
      return `object:weight(${String(value.unit).toUpperCase()})`;
    }
    if (value.weight && typeof value.weight === "object") {
      const unit = typeof value.weight.unit === "string"
        ? String(value.weight.unit).toUpperCase()
        : "?";
      return `object:measurement.weight(${unit})`;
    }
    return `object:keys[${keys.slice(0, 8).join(",")}${keys.length > 8 ? ",…" : ""}]`;
  }
  return t;
}

function shapePairKey(ourValue, shopifyValue) {
  return `${shapeLabel(ourValue)} vs ${shapeLabel(shopifyValue)}`;
}

function bumpShape(group, ourValue, shopifyValue) {
  const key = shapePairKey(ourValue, shopifyValue);
  group.shapes.set(key, (group.shapes.get(key) ?? 0) + 1);
}

function ensureGroup(map, path) {
  let group = map.get(path);
  if (!group) {
    group = { path, phantom: 0, real: 0, shapes: new Map() };
    map.set(path, group);
  }
  return group;
}

const PRODUCT_SELECT = {
  id: true,
  extras: true,
  shopifySnapshot: true,
  shopifyProductId: true,
  name: true,
  slug: true,
  description: true,
  vendor: true,
  productType: true,
  status: true,
  seoTitle: true,
  seoDescription: true,
  shopifyCategoryId: true,
  shopifyCategoryName: true,
  tags: {
    select: { tag: { select: { name: true } } },
  },
  collections: {
    select: {
      collection: {
        select: {
          shopifyCollectionId: true,
          slug: true,
          name: true,
        },
      },
    },
  },
  variants: {
    orderBy: { createdAt: "asc" },
    select: {
      shopifyVariantId: true,
      sku: true,
      title: true,
      barcode: true,
      priceCents: true,
      compareAtCents: true,
      inventoryPolicy: true,
      stockOnHand: true,
      taxable: true,
      selectedOptions: true,
      shopifyInventoryItemId: true,
      requiresShipping: true,
      tracked: true,
      costCents: true,
      weightGrams: true,
    },
  },
};

const COLLECTION_SELECT = {
  id: true,
  extras: true,
  shopifySnapshot: true,
  shopifyCollectionId: true,
  name: true,
  slug: true,
  description: true,
  seoTitle: true,
  seoDescription: true,
};

async function auditEntity(options) {
  const {
    kind,
    row,
    ourWindow,
    shopifySnapshot,
    canonicalizeShopifyProjection,
    getProjectionPath,
    diffShopifyProjections,
    groups,
    stats,
  } = options;

  stats.entities += 1;
  if (ourWindow == null && shopifySnapshot == null) {
    stats.skippedEmpty += 1;
    return;
  }

  const diffs = diffShopifyProjections(ourWindow, shopifySnapshot);
  if (diffs.length === 0) {
    stats.clean += 1;
    return;
  }

  stats.withDiffs += 1;
  const left = canonicalizeShopifyProjection(ourWindow);
  const right = canonicalizeShopifyProjection(shopifySnapshot);

  for (const diff of diffs) {
    stats.leafDiffs += 1;
    const path = normalizeDiffPath(diff.path || "");
    const ourRaw = getProjectionPath(left, diff.path);
    const shopifyRaw = getProjectionPath(right, diff.path);
    const phantom = isPhantomDiff(ourRaw, shopifyRaw);
    const group = ensureGroup(groups, path);
    if (phantom) {
      group.phantom += 1;
      stats.phantom += 1;
    } else {
      group.real += 1;
      stats.real += 1;
    }
    bumpShape(group, ourRaw, shopifyRaw);
  }

  // kind kept for future per-kind breakdown without printing ids
  void kind;
  void row;
}

function printReport(groups, stats) {
  const rows = [...groups.values()].toSorted((a, b) => {
    const totalA = a.phantom + a.real;
    const totalB = b.phantom + b.real;
    if (totalB !== totalA) return totalB - totalA;
    return a.path.localeCompare(b.path);
  });

  console.log("=== phantom-diff audit (counts only; no entity ids / values) ===");
  console.log(JSON.stringify({
    entitiesScanned: stats.entities,
    entitiesClean: stats.clean,
    entitiesWithDiffs: stats.withDiffs,
    entitiesSkippedEmpty: stats.skippedEmpty,
    leafDiffs: stats.leafDiffs,
    phantomLeaves: stats.phantom,
    realLeaves: stats.real,
  }, null, 2));

  console.log("");
  console.log("| path | phantom count | real count | example shapes |");
  console.log("| --- | ---: | ---: | --- |");
  for (const row of rows) {
    const topShapes = [...row.shapes.entries()]
      .toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([shape, count]) => `${shape} (×${count})`)
      .join("; ");
    console.log(
      `| \`${row.path || "(root)"}\` | ${row.phantom} | ${row.real} | ${topShapes || "—"} |`,
    );
  }

  // Machine-readable companion for PR paste (still counts/shapes only).
  console.log("");
  console.log("=== JSON_TABLE_BEGIN ===");
  console.log(JSON.stringify(rows.map((row) => ({
    path: row.path,
    phantom: row.phantom,
    real: row.real,
    topShapes: [...row.shapes.entries()]
      .toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([shape, count]) => ({ shape, count })),
  })), null, 2));
  console.log("=== JSON_TABLE_END ===");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error(
      "audit-phantom-diffs: DATABASE_URL is required (staging). "
      + "Credentials must come from env — refusing to invent a connection string.",
    );
    process.exit(2);
  }

  // Hard guard: refuse obvious prod URLs if someone points DATABASE_URL at prod.
  const urlHint = process.env.DATABASE_URL;
  const looksProd = /[/_-]prod([/_-]|$)|\bproduction\b/i.test(
    // host/path only — never print credentials
    (() => {
      try {
        const u = new URL(urlHint);
        return `${u.hostname}${u.pathname}`;
      } catch {
        return "unparseable";
      }
    })(),
  );
  if (looksProd && process.env.AUDIT_ALLOW_PROD !== "1") {
    console.error(
      "audit-phantom-diffs: DATABASE_URL host/path looks like production. "
      + "Refusing (set AUDIT_ALLOW_PROD=1 only for intentional prod RO audits).",
    );
    process.exit(3);
  }

  const { db } = await import("../../lib/db.ts");
  const {
    ourProductWindowFromRow,
    ourCollectionWindowFromRow,
  } = await import("../../lib/sync/our-window-from-row.ts");
  const {
    diffShopifyProjections,
    canonicalizeShopifyProjection,
    getProjectionPath,
  } = await import("../../lib/shopify/shopify-projection-diff.ts");

  const groups = new Map();
  const stats = {
    entities: 0,
    clean: 0,
    withDiffs: 0,
    skippedEmpty: 0,
    leafDiffs: 0,
    phantom: 0,
    real: 0,
  };

  try {
    const products = await db.product.findMany({
      where: { shopifyProductId: { not: null } },
      select: PRODUCT_SELECT,
    });
    for (const product of products) {
      await auditEntity({
        kind: "PRODUCT",
        row: product,
        ourWindow: ourProductWindowFromRow(product),
        shopifySnapshot: product.shopifySnapshot,
        canonicalizeShopifyProjection,
        getProjectionPath,
        diffShopifyProjections,
        groups,
        stats,
      });
    }

    const collections = await db.collection.findMany({
      where: { shopifyCollectionId: { not: null } },
      select: COLLECTION_SELECT,
    });
    for (const collection of collections) {
      await auditEntity({
        kind: "COLLECTION",
        row: collection,
        ourWindow: ourCollectionWindowFromRow(collection),
        shopifySnapshot: collection.shopifySnapshot,
        canonicalizeShopifyProjection,
        getProjectionPath,
        diffShopifyProjections,
        groups,
        stats,
      });
    }

    printReport(groups, stats);
  } finally {
    await db.$disconnect();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (error) => {
    console.error("audit-phantom-diffs failed:", error?.message || String(error));
    try {
      const { db } = await import("../../lib/db.ts");
      await db.$disconnect();
    } catch {
      // ignore
    }
    process.exit(1);
  });
}

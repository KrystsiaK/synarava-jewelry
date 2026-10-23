import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard: automatic / read paths (webhooks, refresh, inspect, taxonomy load) must not
 * import or call Synarava content writers. Human Apply/Pull keep those writers.
 */

const root = join(process.cwd());

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

/** Extract a top-level exported async function body by name (brace-balanced). */
function extractExportedFunction(source: string, name: string): string {
  const start = source.search(new RegExp(`export async function ${name}\\s*\\(`));
  if (start < 0) throw new Error(`Function ${name} not found`);
  const braceStart = source.indexOf("{", start);
  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Unbalanced braces for ${name}`);
}

/** Call sites / imports that write Synarava content (not Prisma select reads). */
const SYNARAVA_WRITER_PATTERNS = [
  /applyShopifyProductTypeLabel/,
  /db\.product\.upsert/,
  /db\.collection\.upsert/,
  /db\.collection\.update/,
  /taxonomyValueLabel\.(upsert|create|update)/,
  /db\.productTranslation\.(upsert|create|update)/,
  /productVariant\.(upsert|update|create)/,
  /savePulledProduct/,
  /finishPulledProduct/,
  /applyShopifyProductToSynarava/,
  /pullShopifyProduct\s*\(/,
];

/** Forbidden keys on the Shopify-refresh product.update `data` object. */
const FORBIDDEN_REFRESH_DATA_KEYS = [
  "name",
  "priceCents",
  "status",
  "visibility",
  "workingSnapshot",
  "description",
  "slug",
  "sku",
  "productType",
  "vendor",
];

function productUpdateDataBlock(fnBody: string): string {
  const marker = "await db.product.update({";
  const start = fnBody.indexOf(marker);
  if (start < 0) throw new Error("db.product.update not found");
  const dataIdx = fnBody.indexOf("data:", start);
  if (dataIdx < 0) throw new Error("data: not found on product.update");
  const braceStart = fnBody.indexOf("{", dataIdx);
  let depth = 0;
  for (let i = braceStart; i < fnBody.length; i += 1) {
    if (fnBody[i] === "{") depth += 1;
    else if (fnBody[i] === "}") {
      depth -= 1;
      if (depth === 0) return fnBody.slice(braceStart, i + 1);
    }
  }
  throw new Error("Unbalanced data block");
}

describe("auto sync paths must not write Synarava data", () => {
  it("webhook products route only refreshes / flags — never applies", () => {
    const route = read("app/api/shopify/webhooks/products/route.ts");
    expect(route).toMatch(/refreshShopifyProductState/);
    expect(route).toMatch(/pullShopifyInventory/);
    expect(route).not.toMatch(/pullShopifyProduct/);
    expect(route).not.toMatch(/applyShopifyProductToSynarava/);
    expect(route).not.toMatch(/applyShopifyProductTypeLabel/);
    expect(route).not.toMatch(/status:\s*"ARCHIVED"/);
    expect(route).not.toMatch(/syncStatus:\s*"UNLINKED"/);
    expect(route).toMatch(/syncStatus:\s*"CONFLICT"/);
  });

  it("refreshShopifyProductState body has no Synarava content writers", () => {
    const source = read("lib/shopify/product-sync.ts");
    const body = extractExportedFunction(source, "refreshShopifyProductState");
    for (const pattern of SYNARAVA_WRITER_PATTERNS) {
      expect(body, `refresh must not match ${pattern}`).not.toMatch(pattern);
    }
    expect(body).toMatch(/shopifySnapshot/);
    expect(body).toMatch(/syncStatus/);
    const dataBlock = productUpdateDataBlock(body);
    for (const key of FORBIDDEN_REFRESH_DATA_KEYS) {
      expect(dataBlock, `refresh data must not write ${key}`).not.toMatch(
        new RegExp(`\\b${key}\\s*:`),
      );
    }
    expect(dataBlock).toMatch(/shopifySnapshot/);
    expect(dataBlock).toMatch(/syncStatus/);
  });

  it("pullShopifyInventory no longer writes stockOnHand", () => {
    const source = read("lib/shopify/product-sync.ts");
    const body = extractExportedFunction(source, "pullShopifyInventory");
    expect(body).not.toMatch(/stockOnHand\s*:/);
    expect(body).not.toMatch(/productVariant\.update/);
    expect(body).toMatch(/refreshShopifyProductState/);
  });

  it("AUTO reconcile route does not call product apply/pull writers", () => {
    const route = read("app/admin/api/shopify/reconcile/route.ts");
    expect(route).not.toMatch(/pullShopifyProduct/);
    expect(route).not.toMatch(/applyShopifyProductToSynarava/);
    expect(route).not.toMatch(/savePulledProduct/);
    expect(route).not.toMatch(/applyShopifyProductTypeLabel/);
    expect(route).toMatch(/runTranslationReconciliation/);
  });

  it("inspectProductSyncState refreshes Shopify only — never writes Synarava content", () => {
    const source = read("lib/shopify/product-sync.ts");
    const body = extractExportedFunction(source, "inspectProductSyncState");
    for (const pattern of SYNARAVA_WRITER_PATTERNS) {
      expect(body, `inspect must not match ${pattern}`).not.toMatch(pattern);
    }
    expect(body).not.toMatch(/writeThroughLocalCommerceToProjection/);
    expect(body).not.toMatch(/adoptShopifyProjectionField/);
    expect(body).not.toMatch(/agreedProjectionWrite/);
    expect(body).toMatch(/shopifySnapshot/);
    expect(body).toMatch(/ADOPT_SHOPIFY_FIELD/);
    const dataBlock = productUpdateDataBlock(body);
    for (const key of FORBIDDEN_REFRESH_DATA_KEYS) {
      expect(dataBlock, `inspect data must not write ${key}`).not.toMatch(
        new RegExp(`\\b${key}\\s*:`),
      );
    }
    expect(dataBlock).toMatch(/shopifySnapshot/);
    expect(dataBlock).toMatch(/syncStatus/);
  });

  it("taxonomy labels editor load does not seed TaxonomyValueLabel", () => {
    const action = read("app/admin/actions/taxonomy-labels.ts");
    expect(action).toMatch(/loadTaxonomyLabelsEditorPayload/);
    expect(action).not.toMatch(/ensureTaxonomySeedLabels/);
  });
});

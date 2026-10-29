/**
 * Phase 4 — dead-code / simplification inventory locks.
 * Findings: docs/audits/2026-10-28-dead-code.md
 * Report-only phase: no deletions. it.fails marks verified debt until a fix PR.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function listTsUnder(...parts: string[]): string[] {
  const dir = join(ROOT, ...parts);
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

function sourceImportCount(packageName: string): number {
  const needle = new RegExp(
    `from\\s+["']${packageName.replace("/", "\\/")}["']|require\\(\\s*["']${packageName.replace("/", "\\/")}["']\\s*\\)`,
  );
  let count = 0;
  for (const root of ["app", "lib", "components"]) {
    for (const file of listTsUnder(root)) {
      if (needle.test(readFileSync(file, "utf8"))) count += 1;
    }
  }
  return count;
}

describe("Phase 4 dead-code inventory (DEAD-*)", () => {
  it("Shopify product+reviews webhooks use parseShopifyWebhookJson (DEAD-001)", () => {
    const products = read("app/api/shopify/webhooks/products/route.ts");
    const reviews = read("app/api/shopify/webhooks/reviews/route.ts");
    expect(products).toMatch(/parseShopifyWebhookJson/);
    expect(reviews).toMatch(/parseShopifyWebhookJson/);
    expect(products).not.toMatch(/JSON\.parse\(\s*rawBody\s*\)/);
    expect(reviews).not.toMatch(/JSON\.parse\(\s*rawBody\s*\)/);
  });

  it("documents which order-family routes already use the safe parser", () => {
    for (const rel of [
      "app/api/shopify/webhooks/orders/paid/route.ts",
      "app/api/shopify/webhooks/orders/cancelled/route.ts",
      "app/api/shopify/webhooks/refunds/create/route.ts",
      "app/api/shopify/webhooks/returns/request/route.ts",
    ]) {
      expect(read(rel), rel).toMatch(/parseShopifyWebhookJson/);
    }
  });

  it("locks unused TipTap Link + visx pattern import counts (DEAD-002/003)", () => {
    expect(sourceImportCount("@tiptap/extension-link")).toBe(0);
    expect(sourceImportCount("@visx/pattern")).toBe(0);
    const pkg = JSON.parse(read("package.json")) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies["@tiptap/extension-link"]).toBeTruthy();
    expect(pkg.dependencies["@visx/pattern"]).toBeTruthy();
  });

  it("sku-api scripts are referenced from package.json (knip false positive)", () => {
    const pkg = JSON.parse(read("services/sku-api/package.json")) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };
    expect(pkg.scripts["audit:catalog"]).toContain("catalog-audit.mjs");
    expect(pkg.scripts.build).toContain("copy-prisma-client.mjs");
    expect(pkg.scripts["credentials:generate"]).toContain("generate-credentials.mjs");
    // DEAD-004 evidence: declared but sources import generated client
    expect(pkg.dependencies["@prisma/client"]).toBeTruthy();
    const skuSources = listTsUnder("services/sku-api/src");
    const prismaClientImports = skuSources.filter((f) =>
      /from\s+["']@prisma\/client["']/.test(readFileSync(f, "utf8")),
    );
    expect(prismaClientImports).toEqual([]);
  });

  it("storybook mocks are wired in viteFinal aliases (knip false positive)", () => {
    const main = read(".storybook/main.ts");
    for (const mock of [
      "./mocks/db.ts",
      "./mocks/next-image.tsx",
      "./mocks/next-link.tsx",
      "./mocks/next-navigation.ts",
      "./mocks/prisma-client-browser.ts",
      "./mocks/server-only.ts",
      "./mocks/node-crypto.ts",
      "./mocks/prisma-client.ts",
      "./mocks/storefront-href-action.ts",
    ]) {
      expect(main, mock).toContain(mock);
    }
  });

  it("deprecated aliases still equal canonical exports (DEAD-006)", () => {
    const hub = read("components/admin/mission-control/mission-control-hub.tsx");
    expect(hub).toMatch(
      /MISSION_CONTROL_FIXTURE_NOTICE\s*=\s*MISSION_CONTROL_PLACEHOLDER_NOTICE/,
    );
    const locales = read("lib/i18n/locales.ts");
    expect(locales).toMatch(/SUPPORTED_LOCALES\s*=\s*BOOTSTRAP_LOCALES/);
    const policy = read("lib/shopify/catalog-conflict-policy.ts");
    expect(policy).toMatch(
      /SCOPED_PRODUCT_COMMERCE_FIELD_LABELS\s*=\s*SCOPED_COMMERCE_FIELD_LABELS/,
    );
  });

  it("admin + catalog cursor decoders share base64url-json-cursor (DEAD-005)", () => {
    const admin = read("lib/admin/list-products.ts");
    const shop = read("lib/catalog/shop-query.ts");
    const helper = read("lib/cursor/base64url-json-cursor.ts");
    expect(admin).toMatch(/@\/lib\/cursor\/base64url-json-cursor/);
    expect(shop).toMatch(/@\/lib\/cursor\/base64url-json-cursor/);
    expect(helper).toMatch(/Buffer\.from\(raw,\s*"base64url"\)\.toString\("utf8"\)/);
  });

  it("inventories e2e waitForTimeout call sites (DEAD-007)", () => {
    const expected = [
      "e2e/admin-collections.spec.ts",
      "e2e/admin-pages.spec.ts",
      "e2e/admin-products.spec.ts",
      "e2e/admin-layout.spec.ts",
      "e2e/buy-again-notice.spec.ts",
    ];
    const hits: string[] = [];
    for (const file of readdirSync(join(ROOT, "e2e")).filter((n) => n.endsWith(".spec.ts"))) {
      const rel = `e2e/${file}`;
      if (/waitForTimeout\s*\(/.test(read(rel))) hits.push(rel);
    }
    expect(hits.toSorted()).toEqual(expected.toSorted());
  });
});

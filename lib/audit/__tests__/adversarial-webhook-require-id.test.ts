/**
 * REL-003 — missing x-shopify-webhook-id must 400 before claim.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

function webhookRouteFiles(): string[] {
  const root = join(ROOT, "app/api/shopify/webhooks");
  const routes: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "route.ts") routes.push(p);
    }
  };
  walk(root);
  return routes;
}

describe("webhook require id (REL-003)", () => {
  it("claimWebhookEvent requires a non-null webhookId string", () => {
    const src = read("lib/shopify/webhook-event.ts");
    expect(src).toMatch(/webhookId:\s*string;/);
    expect(src).not.toMatch(/webhookId:\s*string\s*\|\s*null/);
  });

  it("every webhook route rejects missing id with 400 before claim", () => {
    const routes = webhookRouteFiles();
    expect(routes.length).toBeGreaterThanOrEqual(6);
    for (const file of routes) {
      const src = readFileSync(file, "utf8");
      expect(src, file).toMatch(/readShopifyWebhookId/);
      expect(src, file).toMatch(/Missing Shopify webhook id[\s\S]*status:\s*400/);
    }
  });
});

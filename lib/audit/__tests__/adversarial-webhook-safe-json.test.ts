/**
 * REL-001 / REL-002 / DEAD-001 — products webhook uses safe JSON parse.
 * Shopify product-review webhooks were removed (local ProductReview).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("webhook safe JSON inventory (REL-001/002/DEAD-001)", () => {
  it("products route uses parseShopifyWebhookJson and returns 400 on bad JSON", () => {
    const src = read("app/api/shopify/webhooks/products/route.ts");
    expect(src).toMatch(/parseShopifyWebhookJson/);
    expect(src).not.toMatch(/const payload = JSON\.parse\(\s*rawBody\s*\)/);
    expect(src).toMatch(/Invalid webhook payload[\s\S]*status:\s*400/);
  });

  it("does not keep a Shopify reviews webhook route", () => {
    expect(() => read("app/api/shopify/webhooks/reviews/route.ts")).toThrow();
  });
});

const mocks = vi.hoisted(() => ({
  verifyShopifyWebhook: vi.fn(),
  readShopifyWebhookId: vi.fn((header: string | null) => header?.trim() || null),
  claimWebhookEvent: vi.fn(),
  refreshShopifyProductState: vi.fn(),
  pullShopifyInventory: vi.fn(),
  findUniqueProduct: vi.fn(),
  updateEvent: vi.fn(),
  findProducts: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTemplate: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: { SHOPIFY_WEBHOOK_SECRET: "secret" } }));
vi.mock("@/lib/shopify/webhooks", () => ({
  verifyShopifyWebhook: mocks.verifyShopifyWebhook,
  readShopifyWebhookId: mocks.readShopifyWebhookId,
}));
vi.mock("@/lib/shopify/webhook-event", () => ({
  claimWebhookEvent: mocks.claimWebhookEvent,
}));
vi.mock("@/lib/shopify/product-sync", () => ({
  refreshShopifyProductState: mocks.refreshShopifyProductState,
  pullShopifyInventory: mocks.pullShopifyInventory,
}));
vi.mock("@/lib/content/revalidate-storefront", () => ({
  revalidateStorefrontPath: mocks.revalidatePath,
  revalidateStorefrontTemplate: mocks.revalidateTemplate,
}));
vi.mock("@/lib/db", () => ({
  db: {
    product: {
      findUnique: mocks.findUniqueProduct,
      findMany: mocks.findProducts,
    },
    productSyncEvent: { update: mocks.updateEvent },
  },
}));

describe("products webhook bad JSON → 400", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyShopifyWebhook.mockReturnValue(true);
  });

  it("returns 400 and does not claim when body is not JSON", async () => {
    const { POST } = await import("@/app/api/shopify/webhooks/products/route");
    const response = await POST(
      new Request("http://localhost/api/shopify/webhooks/products", {
        method: "POST",
        headers: {
          "x-shopify-hmac-sha256": "sig",
          "x-shopify-webhook-id": "wh-1",
          "x-shopify-topic": "products/update",
        },
        body: "{not-json",
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.claimWebhookEvent).not.toHaveBeenCalled();
  });
});

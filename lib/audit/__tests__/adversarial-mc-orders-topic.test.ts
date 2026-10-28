/**
 * REL-008 — Mission Control orders provider must query REST topics
 * (`orders/paid`, `orders/cancelled`) as persisted by webhook routes.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("MC orders provider topics (REL-008)", () => {
  it("queries orders/paid and orders/cancelled, not GraphQL enum names", () => {
    const provider = read("lib/mission-control/providers/orders.ts");
    const paidRoute = read("app/api/shopify/webhooks/orders/paid/route.ts");
    const cancelledRoute = read(
      "app/api/shopify/webhooks/orders/cancelled/route.ts",
    );
    expect(paidRoute).toMatch(/"orders\/paid"/);
    expect(cancelledRoute).toMatch(/"orders\/cancelled"/);
    expect(provider).toMatch(/topic:\s*"orders\/paid"/);
    expect(provider).toMatch(/topic:\s*"orders\/cancelled"/);
    expect(provider).not.toMatch(/ORDERS_PAID|ORDERS_CANCELLED/);
  });
});

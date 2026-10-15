import { describe, expect, it } from "vitest";
import {
  CATALOG_AUDIT_MAX_BATCH,
  catalogAuditRequestSchema,
  catalogAuditResponseSchema,
  previewRequestSchema,
  workspaceKeySchema,
} from "./v1";

describe("sku-contract v1", () => {
  it("accepts workspace keys", () => {
    expect(workspaceKeySchema.parse("synarava-shop")).toBe("synarava-shop");
  });

  it("rejects invalid workspace keys", () => {
    expect(() => workspaceKeySchema.parse("Synarava Shop")).toThrow();
  });

  it("requires correlationId on preview", () => {
    expect(() =>
      previewRequestSchema.parse({ familyKey: "jewelry.necklace" }),
    ).toThrow();
    expect(
      previewRequestSchema.parse({
        familyKey: "jewelry.necklace",
        correlationId: "corr-test-001",
      }),
    ).toMatchObject({ familyKey: "jewelry.necklace" });
  });

  it("accepts catalog audit request within batch bound", () => {
    expect(
      catalogAuditRequestSchema.parse({
        items: [{ externalVariantId: "gid://shopify/ProductVariant/1", sku: "JW-NECK-001" }],
        previousDigest: null,
        correlationId: "corr-audit-contract",
      }),
    ).toMatchObject({ items: [{ sku: "JW-NECK-001" }] });
    expect(() =>
      catalogAuditRequestSchema.parse({
        items: Array.from({ length: CATALOG_AUDIT_MAX_BATCH + 1 }, (_, i) => ({
          externalVariantId: `v-${i}`,
          sku: "x",
        })),
        correlationId: "corr-audit-over",
      }),
    ).toThrow();
  });

  it("parses catalog audit response with llmEnabled false", () => {
    expect(
      catalogAuditResponseSchema.parse({
        ok: true,
        itemCount: 1,
        deviationCount: 0,
        deviations: [],
        digest: "abc",
        shouldNotify: false,
        durationMs: 12,
        llmEnabled: false,
        correlationId: "corr-audit-resp",
      }),
    ).toMatchObject({ llmEnabled: false, shouldNotify: false });
  });
});

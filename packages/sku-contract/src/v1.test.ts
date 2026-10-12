import { describe, expect, it } from "vitest";
import { previewRequestSchema, workspaceKeySchema } from "./v1.js";

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
});

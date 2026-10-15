import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  evaluateProductionPlanGate,
  evaluateProductionPlanGateFromJson,
  EXPECTED_CREATE_NAMES,
  FORBIDDEN_RESOURCE_NAMES,
} from "../lib/railway-prod-plan-gate.mjs";

const dir = dirname(fileURLToPath(import.meta.url));

describe("Stage 6 production Railway plan gate", () => {
  it("exports expected creates and forbidden adopt names", () => {
    expect([...EXPECTED_CREATE_NAMES]).toEqual(["sku-api", "sku-postgres"]);
    expect(FORBIDDEN_RESOURCE_NAMES).toContain("sku-platform-n8n");
    expect(FORBIDDEN_RESOURCE_NAMES).toContain("sku-platform-n8n-postgres");
    expect(FORBIDDEN_RESOURCE_NAMES).toContain("sku-platform-n8n-data");
  });

  it("passes when only sku-api + sku-postgres are created (env update allowed)", () => {
    const raw = readFileSync(
      join(dir, "fixtures/railway-prod-plan-ok.json"),
      "utf8",
    );
    const result = evaluateProductionPlanGateFromJson(raw, {
      requireExpectedCreates: true,
    });
    expect(result.ok).toBe(true);
    expect(result.creates).toEqual(["sku-api", "sku-postgres"]);
  });

  it("fails on replace of n8n or create of volume", () => {
    const raw = readFileSync(
      join(dir, "fixtures/railway-prod-plan-forbidden.json"),
      "utf8",
    );
    const result = evaluateProductionPlanGateFromJson(raw, {
      requireExpectedCreates: true,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("sku-platform-n8n"))).toBe(
      true,
    );
    expect(
      result.errors.some((e) => e.includes("sku-platform-n8n-data")),
    ).toBe(true);
  });

  it("fails on unexpected creates", () => {
    const result = evaluateProductionPlanGate(
      {
        changes: [
          { action: "create", name: "sku-api" },
          { action: "create", name: "sku-postgres" },
          { action: "create", name: "extra-redis" },
        ],
      },
      { requireExpectedCreates: true },
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("extra-redis"))).toBe(true);
  });
});

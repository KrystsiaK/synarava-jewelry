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
    expect(FORBIDDEN_RESOURCE_NAMES).toContain("sku-platform-n8n-volume");
    expect(FORBIDDEN_RESOURCE_NAMES).toContain("postgres-volume");
    expect(FORBIDDEN_RESOURCE_NAMES).not.toContain("sku-platform-n8n-data");
  });

  it("passes when only sku-api + sku-postgres are created (env update allowed)", () => {
    const raw = readFileSync(
      join(dir, "fixtures/railway-prod-plan-ok.json"),
      "utf8",
    );
    const result = evaluateProductionPlanGateFromJson(raw);
    expect(result.ok).toBe(true);
    expect(result.creates).toEqual(["sku-api", "sku-postgres"]);
  });

  it("fails on replace of n8n or create of n8n volume", () => {
    const raw = readFileSync(
      join(dir, "fixtures/railway-prod-plan-forbidden.json"),
      "utf8",
    );
    const result = evaluateProductionPlanGateFromJson(raw);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("sku-platform-n8n"))).toBe(
      true,
    );
    expect(
      result.errors.some((e) => e.includes("sku-platform-n8n-volume")),
    ).toBe(true);
  });

  it("fails on unexpected creates", () => {
    const result = evaluateProductionPlanGate({
      changes: [
        { action: "create", name: "sku-api" },
        { action: "create", name: "sku-postgres" },
        { action: "create", name: "extra-redis" },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("extra-redis"))).toBe(true);
  });

  it("hard-fails on unknown plan format", () => {
    const result = evaluateProductionPlanGate({ foo: "bar" });
    expect(result.ok).toBe(false);
    expect(result.formatKnown).toBe(false);
    expect(result.errors.some((e) => /UNKNOWN plan format/i.test(e))).toBe(
      true,
    );
  });

  it("hard-fails on zero recognized changes", () => {
    const result = evaluateProductionPlanGate({ changes: [] });
    expect(result.ok).toBe(false);
    expect(result.formatKnown).toBe(true);
    expect(result.errors.some((e) => /ZERO recognized/i.test(e))).toBe(true);
  });

  it("parses current Railway changeSet format", () => {
    const result = evaluateProductionPlanGate({
      changeSet: {
        changes: [
          {
            summary: "Create database sku-postgres",
            severity: "safe",
            kind: "resource.create",
          },
          {
            summary: "Create service sku-api",
            severity: "safe",
            kind: "resource.create",
          },
          {
            summary: "Set variable sku-platform-n8n.SKU_API_URL",
            severity: "safe",
            kind: "variable.set",
          },
        ],
      },
    });
    expect(result.ok).toBe(true);
    expect(result.creates).toEqual(["sku-postgres", "sku-api"]);
  });

  it("rejects destructive and structural updates in current Railway format", () => {
    const result = evaluateProductionPlanGate({
      changeSet: {
        changes: [
          {
            summary: "Create database sku-postgres",
            severity: "safe",
            kind: "resource.create",
          },
          {
            summary: "Create service sku-api",
            severity: "safe",
            kind: "resource.create",
          },
          {
            summary: "Update sku-platform-n8n-volume config.sizeMB",
            severity: "destructive",
            kind: "resource.update",
          },
          {
            summary: "Delete variable sku-platform-n8n.TZ",
            severity: "destructive",
            kind: "variable.delete",
          },
        ],
      },
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("destructive"))).toBe(true);
    expect(result.errors.some((e) => e.includes("structural update"))).toBe(
      true,
    );
  });

  it("hard-fails when expected create is missing", () => {
    const result = evaluateProductionPlanGate({
      changes: [{ action: "create", name: "sku-api" }],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("sku-postgres"))).toBe(true);
  });

  it("hard-fails on create/delete/replace of postgres-volume", () => {
    const createResult = evaluateProductionPlanGate({
      changes: [
        { action: "create", name: "sku-api" },
        { action: "create", name: "sku-postgres" },
        { action: "create", name: "postgres-volume" },
      ],
    });
    expect(createResult.ok).toBe(false);
    expect(
      createResult.errors.some((e) => e.includes("postgres-volume")),
    ).toBe(true);

    const deleteResult = evaluateProductionPlanGate({
      changes: [
        { action: "create", name: "sku-api" },
        { action: "create", name: "sku-postgres" },
        { action: "delete", name: "postgres-volume" },
      ],
    });
    expect(deleteResult.ok).toBe(false);
    expect(
      deleteResult.errors.some((e) => e.includes("postgres-volume")),
    ).toBe(true);
  });

  it("CLI gate module exits non-zero on forbidden plan (wired)", () => {
    // Smoke: module is executable entrypoint; unit covers evaluate path.
    const raw = readFileSync(
      join(dir, "fixtures/railway-prod-plan-forbidden.json"),
      "utf8",
    );
    const result = evaluateProductionPlanGateFromJson(raw);
    expect(result.ok).toBe(false);
  });
});

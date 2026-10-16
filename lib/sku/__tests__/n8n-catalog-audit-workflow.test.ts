import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = resolve(
  process.cwd(),
  "deploy/n8n/sku-catalog-audit.workflow.json",
);

type WorkflowNode = {
  readonly name: string;
  readonly type: string;
  readonly parameters?: Record<string, unknown>;
  readonly credentials?: Record<string, unknown>;
};

type WorkflowDoc = {
  readonly name: string;
  readonly nodes: readonly WorkflowNode[];
  readonly connections: Record<string, unknown>;
  readonly settings?: { readonly timezone?: string };
};

describe("sku-catalog-audit n8n workflow (Этап 5 Slice B)", () => {
  const workflow = JSON.parse(
    readFileSync(workflowPath, "utf8"),
  ) as WorkflowDoc;

  it("targets staging catalog audit with schedule + checkpoint + notify gate", () => {
    expect(workflow.name).toMatch(/staging/i);
    expect(workflow.settings?.timezone).toBe("UTC");

    const byName = new Map(workflow.nodes.map((n) => [n.name, n]));
    expect(byName.get("Schedule daily 03:00 UTC")?.type).toBe(
      "n8n-nodes-base.scheduleTrigger",
    );
    expect(byName.get("Load checkpoint")?.type).toBe("n8n-nodes-base.code");
    expect(byName.get("GET live Shopify SKU catalog")?.type).toBe(
      "n8n-nodes-base.httpRequest",
    );
    expect(byName.get("POST audit/catalog")?.type).toBe(
      "n8n-nodes-base.httpRequest",
    );
    expect(byName.get("shouldNotify?")?.type).toBe("n8n-nodes-base.if");
    expect(byName.get("Notify Telegram · SKU")?.type).toBe(
      "n8n-nodes-base.telegram",
    );
    expect(byName.has("Save checkpoint (after notify)")).toBe(true);
    expect(byName.has("Save checkpoint (no notify)")).toBe(true);

    const schedule = byName.get("Schedule daily 03:00 UTC");
    const rule = schedule?.parameters?.rule as {
      interval?: Array<{ expression?: string }>;
    };
    expect(rule?.interval?.[0]?.expression).toBe("0 3 * * *");

    const audit = byName.get("POST audit/catalog");
    expect(String(audit?.parameters?.url ?? "")).toContain("/audit/catalog");
    expect(audit?.parameters?.method).toBe("POST");

    const shopifyCatalog = byName.get("GET live Shopify SKU catalog");
    expect(shopifyCatalog?.parameters?.url).toBe(
      "https://synarava-shop-app-staging.up.railway.app/api/ops/sku-catalog",
    );
    expect(shopifyCatalog?.credentials).toEqual(audit?.credentials);

    const buildCode = String(
      (byName.get("Build audit payload")?.parameters as { jsCode?: string })?.jsCode ?? "",
    );
    expect(buildCode).toContain("snapshot.complete !== true");
    expect(buildCode).not.toContain("CATALOG_ITEMS_JSON");

    const loadCode = String(
      (byName.get("Load checkpoint")?.parameters as { jsCode?: string })
        ?.jsCode ?? "",
    );
    expect(loadCode).toContain("$getWorkflowStaticData('global')");
    expect(loadCode).toContain("previousDigest");

    const ifNode = byName.get("shouldNotify?");
    const conditions = ifNode?.parameters?.conditions as {
      conditions?: Array<{ leftValue?: string }>;
    };
    expect(conditions?.conditions?.[0]?.leftValue).toContain("shouldNotify");
  });

  it("wires Telegram notify only on IF true branch; checkpoint on both branches", () => {
    const connections = workflow.connections as Record<
      string,
      { main: Array<Array<{ node: string }>> }
    >;
    const ifBranches = connections["shouldNotify?"]?.main;
    expect(connections["Load checkpoint"]?.main?.[0]?.[0]?.node).toBe(
      "GET live Shopify SKU catalog",
    );
    expect(connections["GET live Shopify SKU catalog"]?.main?.[0]?.[0]?.node).toBe(
      "Build audit payload",
    );
    expect(ifBranches?.[0]?.[0]?.node).toBe("Notify Telegram · SKU");
    expect(ifBranches?.[1]?.[0]?.node).toBe("Save checkpoint (no notify)");
    expect(connections["Notify Telegram · SKU"]?.main?.[0]?.[0]?.node).toBe(
      "Save checkpoint (after notify)",
    );
  });

  it("Telegram message includes STAGING marker and SKU Audit link; no secrets", () => {
    const notify = workflow.nodes.find((n) => n.name === "Notify Telegram · SKU");
    expect(notify?.type).toBe("n8n-nodes-base.telegram");
    const text = String(notify?.parameters?.text ?? "");
    expect(text).toContain("🟡 STAGING");
    expect(text).toContain("SKU Audit");
    expect(text).toContain(
      "https://synarava-shop-app-staging.up.railway.app/admin/settings#shared-sku-policy",
    );
    expect(String(notify?.parameters?.chatId ?? "")).toContain(
      "$env.TELEGRAM_CHAT_ID",
    );
    expect(JSON.stringify(workflow)).not.toMatch(/\d{8,}:[A-Za-z0-9_-]{20,}/);
    expect(JSON.stringify(workflow)).not.toMatch(/bot[0-9]+:/i);
  });

  it("keeps the production workflow on the canonical site and live Shopify source", () => {
    const productionPath = resolve(
      process.cwd(),
      "deploy/n8n/sku-catalog-audit.workflow.production.json",
    );
    const production = JSON.parse(readFileSync(productionPath, "utf8")) as WorkflowDoc;
    const serialized = JSON.stringify(production);
    expect(serialized).toContain("https://shop.synarava.com/api/ops/sku-catalog");
    expect(serialized).toContain(
      "https://shop.synarava.com/admin/settings#shared-sku-policy",
    );
    expect(serialized).not.toContain("CATALOG_ITEMS_JSON");
    expect(serialized).not.toContain("synarava-shop-app-production.up.railway.app");
  });
});

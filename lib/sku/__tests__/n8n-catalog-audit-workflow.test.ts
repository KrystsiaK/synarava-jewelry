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
    expect(byName.get("POST audit/catalog")?.type).toBe(
      "n8n-nodes-base.httpRequest",
    );
    expect(byName.get("shouldNotify?")?.type).toBe("n8n-nodes-base.if");
    expect(byName.get("Notify webhook")?.type).toBe(
      "n8n-nodes-base.httpRequest",
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

  it("wires notify only on IF true branch; checkpoint on both branches", () => {
    const connections = workflow.connections as Record<
      string,
      { main: Array<Array<{ node: string }>> }
    >;
    const ifBranches = connections["shouldNotify?"]?.main;
    expect(ifBranches?.[0]?.[0]?.node).toBe("Notify webhook");
    expect(ifBranches?.[1]?.[0]?.node).toBe("Save checkpoint (no notify)");
    expect(connections["Notify webhook"]?.main?.[0]?.[0]?.node).toBe(
      "Save checkpoint (after notify)",
    );
  });
});

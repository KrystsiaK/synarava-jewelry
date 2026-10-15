import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = resolve(
  process.cwd(),
  "deploy/n8n/sku-catalog-audit.workflow.production.json",
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
  readonly meta?: { readonly synarava?: Record<string, unknown> };
};

describe("sku-catalog-audit n8n workflow (Этап 6 production — import only)", () => {
  const workflow = JSON.parse(
    readFileSync(workflowPath, "utf8"),
  ) as WorkflowDoc;

  it("targets production catalog audit with Telegram PRODUCTION header", () => {
    expect(workflow.name).toMatch(/production/i);
    expect(workflow.settings?.timezone).toBe("UTC");
    expect(workflow.meta?.synarava?.environment).toBe("production");
    expect(workflow.meta?.synarava?.telegramHeader).toBe(
      "🔴 PRODUCTION · SKU AUDIT",
    );

    const notify = workflow.nodes.find((n) => n.name === "Notify Telegram · SKU");
    expect(notify?.type).toBe("n8n-nodes-base.telegram");
    const text = String(notify?.parameters?.text ?? "");
    expect(text).toContain("🔴 PRODUCTION · SKU AUDIT");
    expect(text).not.toContain("🟡 STAGING");
    expect(String(notify?.parameters?.chatId ?? "")).toContain(
      "$env.TELEGRAM_CHAT_ID",
    );
  });

  it("contains no secrets or bot tokens", () => {
    expect(JSON.stringify(workflow)).not.toMatch(/\d{8,}:[A-Za-z0-9_-]{20,}/);
    expect(JSON.stringify(workflow)).not.toMatch(/bot[0-9]+:/i);
  });

  it("keeps notify only on IF true branch", () => {
    const connections = workflow.connections as Record<
      string,
      { main: Array<Array<{ node: string }>> }
    >;
    const ifBranches = connections["shouldNotify?"]?.main;
    expect(ifBranches?.[0]?.[0]?.node).toBe("Notify Telegram · SKU");
    expect(ifBranches?.[1]?.[0]?.node).toBe("Save checkpoint (no notify)");
  });
});

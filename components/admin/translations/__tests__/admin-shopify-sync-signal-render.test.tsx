/** @vitest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { AdminShopifyCheckProvider } from "@/components/admin/translations/admin-shopify-check-context";
import { AdminShopifySyncSignal } from "@/components/admin/translations/admin-shopify-sync-signal";
import type { ReconcileRunSummary } from "@/lib/shopify/reconciliation-run";

const longError =
  "Missing Shopify permission: read_markets. Enable the scope in the Shopify app and reconnect before marketing locale sync can finish.";

function failedRun(): ReconcileRunSummary {
  return {
    id: "run-fail",
    trigger: "AUTO",
    status: "FAILED",
    checkedCount: 0,
    differenceCount: 0,
    error: longError,
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:01:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:01:00.000Z",
  };
}

describe("AdminShopifySyncSignal render", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ run: failedRun() }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  });

  it("puts long error detail in title/aria without an in-flow detail line", async () => {
    const { container } = render(
      <AdminShopifyCheckProvider initialRunning={false}>
        <AdminShopifySyncSignal initialRun={failedRun()} connected />
      </AdminShopifyCheckProvider>,
    );

    expect(container.querySelector(".adm-sync-signal-stack")).toBeNull();
    expect(container.querySelector(".adm-sync-signal__detail")).toBeNull();

    const retry = await screen.findByRole("button", { name: /Check failed/i });
    await waitFor(() => {
      const chip = container.querySelector(".adm-sync-signal");
      expect(chip?.getAttribute("data-state")).toBe("failed");
      expect(chip?.getAttribute("title")).toContain("read_markets");
    });
    expect(retry.getAttribute("aria-label")).toContain("read_markets");
    expect(retry.getAttribute("aria-label")).toMatch(/Retry check/i);
  });
});

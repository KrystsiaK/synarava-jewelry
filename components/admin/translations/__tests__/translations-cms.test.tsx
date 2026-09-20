import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TranslationsCms, type ReconcileDifferenceRow } from "@/components/admin/translations/translations-cms";
import type { ReconcileRunSummary } from "@/lib/shopify/reconciliation-run";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const run: ReconcileRunSummary = {
  id: "run-1",
  trigger: "AUTO",
  status: "SUCCEEDED",
  checkedCount: 4,
  differenceCount: 2,
  error: null,
  startedAt: "2026-09-20T09:00:00.000Z",
  completedAt: "2026-09-20T09:00:02.000Z",
  createdAt: "2026-09-20T09:00:00.000Z",
};

const shared = {
  runId: "run-1",
  bindingId: "binding-1",
  rootEntityType: "PRODUCT" as const,
  rootEntityId: "product-1",
  entityLabel: "Lava Ring",
  locale: "pt-PT",
  targetKind: "NATIVE" as const,
  localFingerprint: "local",
  shopifyFingerprint: "remote",
  shopifyUpdatedAt: "2026-09-20T08:00:00.000Z",
  shopifyOutdated: false,
  href: "/admin/products/product-1",
};

const differences: ReconcileDifferenceRow[] = [
  {
    ...shared,
    id: "difference-1",
    fieldKey: "title",
    fieldLabel: "Title",
    kind: "CONFLICT",
    baseValue: "Anel",
    localValue: "Anel Lava",
    shopifyValue: "Anel Vulcânico",
  },
  {
    ...shared,
    id: "difference-2",
    fieldKey: "details",
    fieldLabel: "Details",
    targetKind: "METAOBJECT",
    kind: "LOCAL_ONLY",
    baseValue: { material: "Prata" },
    localValue: { material: "Prata reciclada", careNote: "Guardar seco" },
    shopifyValue: { material: "Prata" },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ run }) }));
});

describe("TranslationsCms", () => {
  it("shows only actionable differences with both source values and the common base", () => {
    render(<TranslationsCms initialRun={run} differences={differences} />);

    expect(screen.getByText("2 translated fields need review")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Lava Ring" })).toBeVisible();
    const titleComparison = screen.getByLabelText("Title comparison");
    expect(within(titleComparison).getByText("Anel Lava")).toBeVisible();
    expect(within(titleComparison).getByText("Anel Vulcânico")).toBeVisible();
    expect(screen.getByText("No side is selected automatically.", { exact: false })).toBeVisible();

    fireEvent.click(screen.getAllByText("Show last synced value")[0]);
    expect(screen.getByText("Anel")).toBeVisible();
  });

  it("renders structured copy as readable labeled content instead of raw JSON", () => {
    render(<TranslationsCms initialRun={run} differences={differences} />);

    expect(screen.getByText(/Care note/i)).toBeVisible();
    expect(screen.getByText("Guardar seco")).toBeVisible();
    expect(screen.queryByText(/\{"material"/)).not.toBeInTheDocument();
  });

  it("filters by the side that changed without leaving disabled equal rows", () => {
    render(<TranslationsCms initialRun={run} differences={differences} />);

    fireEvent.click(screen.getByRole("button", { name: /Needs a decision/ }));
    expect(screen.getByRole("heading", { name: "Title" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Details" })).not.toBeInTheDocument();
  });

  it("keeps an explicit manual check and refreshes server results", async () => {
    render(<TranslationsCms initialRun={run} differences={differences} />);

    fireEvent.click(screen.getByRole("button", { name: "Check now" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/admin/api/shopify/reconcile",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ trigger: "MANUAL" }) }),
    ));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("shows an explicit impact preview and submits only the chosen field", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ appliedCount: 1, failedCount: 0, results: [{ ok: true, message: "Applied" }] }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ run }) } as Response);
    render(<TranslationsCms initialRun={run} differences={differences} />);

    fireEvent.click(screen.getAllByRole("button", { name: /Keep Synarava Update Shopify with this value/i })[0]);
    expect(screen.getByRole("heading", { name: "Review 1 selected change" })).toBeVisible();
    expect(screen.getByText("Synarava → Shopify")).toBeVisible();
    expect(screen.getByText(/Unselected fields stay untouched/)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Apply selected" }));
    await waitFor(() => expect(fetch).toHaveBeenNthCalledWith(
      1,
      "/admin/api/shopify/reconcile/apply",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ choices: [{
          divergenceId: "difference-1",
          choice: "SYNARAVA",
          expectedLocalFingerprint: "local",
          expectedShopifyFingerprint: "remote",
        }] }),
      }),
    ));
  });

  it("requires a loss acknowledgement before applying an empty chosen value", () => {
    const destructive: ReconcileDifferenceRow = { ...differences[0], id: "clear-1", localValue: null };
    render(<TranslationsCms initialRun={run} differences={[destructive]} />);

    fireEvent.click(screen.getByRole("button", { name: /Keep Synarava This will clear Shopify/i }));
    expect(screen.getByRole("button", { name: "Apply selected" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /I understand that 1 selected value will be cleared/ }));
    expect(screen.getByRole("button", { name: "Apply selected" })).toBeEnabled();
  });

  it("requires a review acknowledgement for a multi-field apply", () => {
    render(<TranslationsCms initialRun={run} differences={differences} />);

    for (const button of screen.getAllByRole("button", { name: /Keep Synarava Update Shopify with this value/i })) {
      fireEvent.click(button);
    }
    expect(screen.getByRole("button", { name: "Apply selected" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /I reviewed all 2 selected changes/ }));
    expect(screen.getByRole("button", { name: "Apply selected" })).toBeEnabled();
  });
});

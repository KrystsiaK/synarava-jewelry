import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useCatalogConflictCheck } from "@/components/admin/shared/use-catalog-conflict-check";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

const pushToast = vi.fn();

vi.mock("@/components/admin/shared/admin-toast", () => ({
  useAdminToast: () => ({ pushToast }),
}));

const baseSignals: CatalogConflictSignals = {
  state: "ready",
  totalCount: 0,
  checkedAt: "2026-10-23T10:00:00.000Z",
  products: {},
  recentlyUpdatedProducts: {},
};

describe("useCatalogConflictCheck", () => {
  it("updates banner signals without opening a modal and stays silent on success", async () => {
    const nextSignals: CatalogConflictSignals = {
      ...baseSignals,
      totalCount: 2,
      checkedAt: "2026-10-23T11:00:00.000Z",
      products: {
        a: { shared: true, locales: [{ code: "en", name: "English", nativeName: "English", count: 1 }] },
      },
    };
    const runCheck = vi.fn().mockResolvedValue({
      signals: nextSignals,
      success: "Conflict check finished",
    });
    const onAfterCheck = vi.fn();

    const { result } = renderHook(() =>
      useCatalogConflictCheck({
        initialSignals: baseSignals,
        runCheck,
        onAfterCheck,
      }),
    );

    expect(result.current.signals.totalCount).toBe(0);

    await act(async () => {
      result.current.runConflictCheck();
    });

    await waitFor(() => {
      expect(result.current.signals.totalCount).toBe(2);
      expect(result.current.signals.checkedAt).toBe("2026-10-23T11:00:00.000Z");
    });

    expect(pushToast).not.toHaveBeenCalled();
    expect(onAfterCheck).toHaveBeenCalledOnce();
  });

  it("toasts a single error and never invents a modal-open side effect", async () => {
    const runCheck = vi.fn().mockResolvedValue({ error: "Shopify Admin API is not configured." });
    const onStoreMismatch = vi.fn();

    const { result } = renderHook(() =>
      useCatalogConflictCheck({
        initialSignals: baseSignals,
        runCheck,
        onStoreMismatch,
      }),
    );

    await act(async () => {
      result.current.runConflictCheck();
    });

    await waitFor(() => {
      expect(pushToast).toHaveBeenCalledWith({
        message: "Shopify Admin API is not configured.",
        tone: "error",
      });
    });
    expect(pushToast).toHaveBeenCalledTimes(1);
    expect(result.current.signals.totalCount).toBe(0);
    expect(onStoreMismatch).toHaveBeenCalledWith(null);
  });
});

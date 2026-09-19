import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ retryTranslationSyncAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/admin/actions/translation-sync", () => ({
  retryTranslationSyncAction: mocks.retryTranslationSyncAction,
}));

import { TranslationsCms, type TranslationOverviewRow } from "@/components/admin/translations/translations-cms";

const rows: TranslationOverviewRow[] = [
  {
    id: "page-1", entityType: "PAGE", entityId: "page-1", label: "Home", locale: "PT",
    status: "FAILED", href: "/admin/home", error: "Locale unavailable", updatedAt: "2026-09-19T10:00:00.000Z",
    actor: "editor@example.com", direction: "PUSH",
  },
  {
    id: "product-1", entityType: "PRODUCT", entityId: "product-1", label: "Ring", locale: "PT",
    status: "CONFLICT", href: "/admin/products/product-1", error: "Changed on both sides", updatedAt: null,
    actor: null, direction: "RECONCILE",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.retryTranslationSyncAction.mockResolvedValue({ success: "Translation synced." });
});

describe("TranslationsCms", () => {
  it("filters by actionable status and links to the correct entity", () => {
    render(<TranslationsCms rows={rows} />);
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "CONFLICT" } });
    expect(screen.getByText("Ring")).toBeVisible();
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Resolve conflict" })).toHaveAttribute("href", "/admin/products/product-1");
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("retries a failed target without offering an unsafe automatic conflict retry", async () => {
    render(<TranslationsCms rows={rows} />);
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "FAILED" } });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(mocks.retryTranslationSyncAction).toHaveBeenCalledWith("PAGE", "page-1"));
  });
});

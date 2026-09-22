import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EntityLocaleSyncControl } from "@/components/admin/translations/entity-locale-sync-control";

afterEach(() => vi.unstubAllGlobals());

describe("EntityLocaleSyncControl", () => {
  it("opens a focused conflict summary and retains a safe full-review path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      run: { id: "run-1", status: "SUCCEEDED", trigger: "LOCALE", checkedCount: 1, differenceCount: 1, error: null, startedAt: null, completedAt: null, createdAt: "2026-09-20T10:00:00.000Z" },
      differenceCount: 1,
      differences: [{
        id: "diff-1", runId: "run-1", bindingId: "binding-1", rootEntityType: "PRODUCT", rootEntityId: "product-1", entityLabel: "Pearl ring", locale: "en", fieldKey: "title", fieldLabel: "Title", targetKind: "NATIVE", kind: "CONFLICT", baseValue: "Old", localValue: "Local", shopifyValue: "Remote", localFingerprint: "a", shopifyFingerprint: "b", shopifyUpdatedAt: null, shopifyOutdated: false,
      }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<EntityLocaleSyncControl scope={{ entityType: "PRODUCT", entityId: "product-1" }} locale="en" localeLabel="English" />);

    await waitFor(() => expect(screen.getByText("1 difference")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    expect(screen.getByRole("heading", { name: /Shopify sync · English/i })).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Changed in both places")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Compare and decide/i })).toHaveAttribute(
      "href",
      expect.stringContaining("entityId=product-1"),
    );
  });
});

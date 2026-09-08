import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveCollectionAction: vi.fn(),
  deleteCollectionAction: vi.fn(),
}));

vi.mock("@/app/admin/actions/collections", () => ({
  saveCollectionAction: mocks.saveCollectionAction,
  deleteCollectionAction: mocks.deleteCollectionAction,
}));

import { EditCollectionForm } from "@/components/admin/collections/collection-edit-form";
import type { AdminCollection } from "@/components/admin/collections/collection-types";

function makeCollection(overrides: Partial<AdminCollection> = {}): AdminCollection {
  return {
    id: "collection-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02"),
    name: "Wanderlust",
    slug: "wanderlust",
    code: "WAND-01",
    subtitle: null,
    description: "A summer story.",
    manifesto: "Manifesto copy.",
    searchSummary: "Search helper text.",
    symbolismLabel: null,
    symbolismTitle: null,
    symbolismBody: null,
    symbolismBody2: null,
    heroImageUrl: "https://cdn.example.com/wanderlust.jpg",
    sortOrder: 0,
    status: "DRAFT",
    visibility: "PRIVATE",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EditCollectionForm", () => {
  it("renders existing collection values", () => {
    render(<EditCollectionForm collection={makeCollection()} />);

    expect(screen.getByRole("heading", { name: "Wanderlust" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Name/)).toHaveValue("Wanderlust");
    expect(screen.getByLabelText(/^Collection summary/)).toHaveValue("A summer story.");
  });

  it("saves through saveCollectionAction when the existing hero image is kept", async () => {
    mocks.saveCollectionAction.mockResolvedValue({ success: "Collection saved.", collection: makeCollection() });
    const onUpdated = vi.fn();
    const user = userEvent.setup();
    render(<EditCollectionForm collection={makeCollection()} onUpdated={onUpdated} />);

    await user.click(screen.getByRole("button", { name: "Update collection" }));
    await user.click(await screen.findByRole("button", { name: "Save collection" }));

    expect(mocks.saveCollectionAction).toHaveBeenCalledTimes(1);
    expect(onUpdated).toHaveBeenCalled();
  });

  it("deletes through deleteCollectionAction on confirm", async () => {
    mocks.deleteCollectionAction.mockResolvedValue({ success: "Deleted.", deletedCollectionId: "collection-1" });
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(<EditCollectionForm collection={makeCollection()} onDeleted={onDeleted} />);

    await user.click(screen.getByRole("button", { name: "Delete collection" }));
    await user.click(await screen.findByRole("button", { name: "Delete permanently" }));

    expect(mocks.deleteCollectionAction).toHaveBeenCalledTimes(1);
    expect(onDeleted).toHaveBeenCalledWith("collection-1");
  });
});

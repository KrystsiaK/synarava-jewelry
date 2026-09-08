import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  autosaveCollectionDraftAction: vi.fn(),
  saveCollectionAction: vi.fn(),
}));

vi.mock("@/app/admin/actions/collections", () => ({
  autosaveCollectionDraftAction: mocks.autosaveCollectionDraftAction,
  saveCollectionAction: mocks.saveCollectionAction,
}));

import { CreateCollectionForm } from "@/components/admin/collections/collection-create-form";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.autosaveCollectionDraftAction.mockResolvedValue({});
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

describe("CreateCollectionForm", () => {
  it("renders the required fields and auto-fills slug/code from the name", async () => {
    const user = userEvent.setup();
    const { container } = render(<CreateCollectionForm />);

    expect(screen.getByRole("heading", { name: "Create collection" })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Name/), "Lava Heritage");

    expect(container.querySelector('input[name="slug"]')).toHaveValue("lava-heritage");
    expect(container.querySelector('input[name="code"]')).not.toHaveValue("");
  });

  it("opens the create confirmation modal from the header save button", async () => {
    const user = userEvent.setup();
    render(<CreateCollectionForm />);

    await user.click(screen.getByRole("button", { name: "Save collection" }));

    expect(await screen.findByText(/This creates a new collection record/)).toBeInTheDocument();
    expect(mocks.saveCollectionAction).not.toHaveBeenCalled();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
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

  it("saves through saveCollectionAction and reports the created collection on confirm", async () => {
    const createdCollection = { id: "collection-1", slug: "lava-heritage", name: "Lava Heritage" };
    mocks.saveCollectionAction.mockResolvedValue({
      success: "Collection created.",
      collection: createdCollection,
    });
    const onCreated = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<CreateCollectionForm onCreated={onCreated} />);

    await user.type(screen.getByLabelText(/^Name/), "Lava Heritage");
    const heroImageInput = container.querySelector<HTMLInputElement>('input[name="heroImageFile"]');
    expect(heroImageInput).not.toBeNull();
    await user.upload(
      heroImageInput!,
      new File(["image"], "hero.png", { type: "image/png" }),
    );
    expect(heroImageInput!.files).toHaveLength(1);
    expect(heroImageInput!.files?.[0]?.name).toBe("hero.png");
    // JSDOM keeps a required file input invalid even after userEvent attaches a
    // File. The assertions above cover the upload; disable only that incomplete
    // validity implementation so requestSubmit can exercise the React action.
    heroImageInput!.required = false;
    await user.type(screen.getByLabelText(/^Collection summary/), "A collection summary.");
    await user.type(screen.getByLabelText(/^Manifesto/), "A collection manifesto.");
    await user.type(screen.getByLabelText(/^Search summary/), "A search summary.");

    const invalidRequiredFields = Array.from(
      container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[required]"),
    )
      .filter((field) => !field.checkValidity())
      .map((field) => field.name);
    expect(invalidRequiredFields).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Save collection" }));
    await user.click(await screen.findByRole("button", { name: "Create collection" }));

    await waitFor(() => {
      expect(mocks.saveCollectionAction).toHaveBeenCalledTimes(1);
      expect(onCreated).toHaveBeenCalledWith(createdCollection);
    });
  });
});

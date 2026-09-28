import { render, screen, waitFor, within } from "@testing-library/react";
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
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

async function applyLongText(user: ReturnType<typeof userEvent.setup>, label: string, value: string) {
  await user.click(screen.getByRole("button", { name: `Edit ${label}` }));
  const dialog = await screen.findByRole("dialog");
  const editor = within(dialog).getByRole("textbox", { name: label });
  await user.clear(editor);
  await user.type(editor, value);
  await user.click(within(dialog).getByRole("button", { name: "Apply changes" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
}

describe("CreateCollectionForm", () => {
  it("renders the required fields and auto-fills slug/code from the name", async () => {
    const user = userEvent.setup();
    const { container } = render(<CreateCollectionForm />);

    expect(screen.getByRole("heading", { name: "Create collection" })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Name\*/), "Lava Heritage");

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

    await user.type(screen.getByLabelText(/^Name\*/), "Lava Heritage");
    const heroImageInput = container.querySelector<HTMLInputElement>('input[name="heroImageFile"]');
    expect(heroImageInput).not.toBeNull();
    expect(heroImageInput).not.toBeRequired();
    await user.upload(
      heroImageInput!,
      new File(["image"], "hero.png", { type: "image/png" }),
    );
    expect(heroImageInput!.files).toHaveLength(1);
    expect(heroImageInput!.files?.[0]?.name).toBe("hero.png");
    await applyLongText(user, "Collection summary", "A collection summary.");
    await applyLongText(user, "Manifesto", "A collection manifesto.");
    await applyLongText(user, "Search summary", "A search summary.");

    await user.click(screen.getByRole("button", { name: "Save collection" }));
    await user.click(await screen.findByRole("button", { name: "Create collection" }));

    await waitFor(() => {
      expect(mocks.saveCollectionAction).toHaveBeenCalledTimes(1);
      expect(onCreated).toHaveBeenCalledWith(createdCollection);
    });
  });
});

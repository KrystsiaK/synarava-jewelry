import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveCollectionAction: vi.fn(),
  deleteCollectionAction: vi.fn(),
  checkOneCollectionConflictsAction: vi.fn(),
}));

vi.mock("@/app/admin/actions/collections", () => ({
  saveCollectionAction: mocks.saveCollectionAction,
  deleteCollectionAction: mocks.deleteCollectionAction,
}));

vi.mock("@/app/admin/actions/sync", () => ({
  checkOneCollectionConflictsAction: mocks.checkOneCollectionConflictsAction,
  loadCollectionCatalogConflictAction: vi.fn(),
  previewCollectionConflictResolutionAction: vi.fn(),
  applyCollectionConflictResolutionAction: vi.fn(),
}));

import { EditCollectionForm } from "@/components/admin/collections/collection-edit-form";
import type { AdminCollection } from "@/components/admin/collections/collection-types";
import type { AdminIssueSummary } from "@/components/admin/shared/admin-issue-types";

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
    seoTitle: null,
    seoDescription: null,
    symbolismLabel: null,
    symbolismTitle: null,
    symbolismBody: null,
    symbolismBody2: null,
    heroImageUrl: "https://cdn.example.com/wanderlust.jpg",
    sortOrder: 0,
    status: "DRAFT",
    visibility: "PRIVATE",
    shopifyCollectionId: null,
    translations: [],
    ...overrides,
  };
}

function makeIssue(overrides: Partial<AdminIssueSummary> = {}): AdminIssueSummary {
  return {
    id: "issue-1",
    key: "COLLECTION:collection-1:field-heroImageUrl:BROKEN_MEDIA",
    entityType: "COLLECTION",
    entityId: "collection-1",
    entityLabel: "Wanderlust",
    fieldPath: "field-heroImageUrl",
    issueType: "BROKEN_MEDIA",
    severity: "ERROR",
    status: "OPEN",
    title: "Collection hero image is broken",
    description: "The image URL does not load: /media/uploads/collections/broken.webp",
    targetHref: "/admin/collections/collection-1#field-heroImageUrl",
    firstSeenAt: new Date("2026-09-06T13:03:00Z"),
    lastSeenAt: new Date("2026-09-06T13:03:00Z"),
    resolvedAt: null,
    notificationSentAt: null,
    createdAt: new Date("2026-09-06T13:03:00Z"),
    updatedAt: new Date("2026-09-06T13:03:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // The active-locale tab is remembered in sessionStorage per collection slug, so
  // tests sharing a slug would otherwise leak their tab state across `it()` blocks.
  sessionStorage.clear();
  window.history.replaceState(null, "", "/admin/collections/collection-1");
  HTMLElement.prototype.scrollIntoView = vi.fn();
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

async function applyLongText(user: ReturnType<typeof userEvent.setup>, label: string, value: string) {
  await user.click(screen.getByRole("button", { name: `Edit ${label}` }));
  const dialog = await screen.findByRole("dialog");
  const editor = await waitFor(() => {
    const rich = dialog.querySelector<HTMLElement>(".adm-rich-text-editor__surface");
    if (rich) return rich;
    const area = dialog.querySelector<HTMLTextAreaElement>("textarea");
    if (area) return area;
    throw new Error(`Editor for ${label} not ready`);
  });
  editor.focus();
  if (editor instanceof HTMLTextAreaElement) {
    await user.clear(editor);
    await user.type(editor, value);
  } else {
    await user.paste(value);
  }
  await user.click(within(dialog).getByRole("button", { name: "Apply changes" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
}

function longTextPreview(label: string | RegExp) {
  const button = screen.getByRole("button", {
    name: typeof label === "string" ? `Edit ${label}` : new RegExp(`Edit ${label.source}`, label.flags),
  });
  return button.closest("[data-component='AdminRichTextField']")?.querySelector(".adm-long-text-preview__copy");
}

describe("EditCollectionForm", () => {
  it("renders existing collection values", () => {
    render(<EditCollectionForm collection={makeCollection()} />);

    expect(screen.getByRole("heading", { name: "Wanderlust" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^Name/ })).toHaveValue("Wanderlust");
    expect(longTextPreview("Collection summary")).toHaveTextContent("A summer story.");
  });

  it("uses the site-state dropdown and header icon actions", () => {
    render(<EditCollectionForm collection={makeCollection()} />);

    const siteState = document.querySelector("#field-workflowState");
    expect(siteState).not.toBeNull();
    expect(siteState).toHaveAttribute("data-validation-for", "workflowState");
    expect(screen.getByRole("combobox", { name: /Site state/ })).toHaveValue("DRAFT");
    expect(screen.getByRole("option", { name: "Draft — hidden" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Published — visible" })).toBeInTheDocument();

    expect(screen.queryByRole("link", { name: "Open page" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update collection" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete collection" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save collection" })).toBeInTheDocument();
  });

  it("surfaces open problems on the hero field and scrolls to the hash target", async () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 1;
    });
    window.history.replaceState(null, "", "/admin/collections/collection-1#field-heroImageUrl");

    render(<EditCollectionForm collection={makeCollection()} issues={[makeIssue()]} />);

    expect(screen.getByRole("button", { name: /Collection hero image is broken/i })).toBeInTheDocument();
    expect(document.getElementById("field-heroImageUrl")).not.toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Collection hero image is broken");
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
        inline: "nearest",
      });
    });
  });

  it("switches the same Name field's value with the locale tab, preserving independent EN/PT input", async () => {
    const user = userEvent.setup();
    const { container } = render(<EditCollectionForm collection={makeCollection({
      translations: [{
        id: "translation-pt", locale: "pt", name: "Rituais de Verão",
        description: null, manifesto: null, symbolismLabel: null, symbolismTitle: null,
        symbolismBody: null, symbolismBody2: null, searchSummary: null,
        reviewStatus: "DRAFT", syncStatus: "NOT_APPLICABLE", syncError: null,
      }],
    })} />);

    expect(screen.getByRole("textbox", { name: /^Name/ })).toHaveValue("Wanderlust");
    await user.click(screen.getByRole("tab", { name: "Português" }));

    // Same field, no longer required outside EN, now showing the PT value.
    expect(screen.getByRole("textbox", { name: /^Name/ })).toHaveValue("Rituais de Verão");

    await user.click(screen.getByRole("tab", { name: "English" }));
    expect(screen.getByRole("textbox", { name: /^Name/ })).toHaveValue("Wanderlust");

    // Both locales' real values are always in the hidden fields the server reads.
    expect(container.querySelector<HTMLInputElement>('input[type="hidden"][name="name"]')?.value).toBe("Wanderlust");
    expect(container.querySelector<HTMLInputElement>('input[type="hidden"][name="ptName"]')?.value).toBe("Rituais de Verão");
  });

  it("clears manifesto and search summary errors once those fields are filled", async () => {
    const user = userEvent.setup();
    const reportValidity = vi.spyOn(HTMLFormElement.prototype, "reportValidity");
    render(<EditCollectionForm collection={makeCollection({
      manifesto: "",
      searchSummary: "",
    })} />);

    await user.click(screen.getByRole("button", { name: "Save collection" }));

    expect(screen.getByText("Manifesto is required.")).toBeInTheDocument();
    expect(screen.getByText("Search summary is required.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.saveCollectionAction).not.toHaveBeenCalled();
    expect(reportValidity).not.toHaveBeenCalled();

    await applyLongText(user, "Manifesto", "A collection manifesto.");
    await applyLongText(user, "Search summary", "A search summary.");

    expect(screen.queryByText("Manifesto is required.")).not.toBeInTheDocument();
    expect(screen.queryByText("Search summary is required.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save collection" }));
    expect(await screen.findByRole("dialog", { name: /Save Wanderlust/ })).toBeInTheDocument();
    expect(screen.queryByText("Hero image is required.")).not.toBeInTheDocument();
  });

  it("accepts a chosen hero file and does not ask to select the current image again", async () => {
    const user = userEvent.setup();
    const reportValidity = vi.spyOn(HTMLFormElement.prototype, "reportValidity");
    const { container } = render(<EditCollectionForm collection={makeCollection({
      heroImageUrl: null,
    })} />);

    const heroImageInput = container.querySelector<HTMLInputElement>('input[name="heroImageFile"]');
    expect(heroImageInput).not.toBeRequired();
    await user.upload(
      heroImageInput!,
      new File(["image"], "hero.png", { type: "image/png" }),
    );

    await user.click(screen.getByRole("button", { name: "Save collection" }));

    expect(screen.queryByText("Hero image is required.")).not.toBeInTheDocument();
    expect(await screen.findByRole("dialog", { name: /Save Wanderlust/ })).toBeInTheDocument();
    expect(reportValidity).not.toHaveBeenCalled();
  });

  it("asks for a hero image on the image field when none is saved or chosen", async () => {
    const user = userEvent.setup();
    render(<EditCollectionForm collection={makeCollection({ heroImageUrl: null })} />);

    await user.click(screen.getByRole("button", { name: "Save collection" }));

    expect(screen.getByText("Hero image is required.")).toBeInTheDocument();
    expect(document.querySelector("[data-validation-for='heroImageFile']")).toContainElement(
      screen.getByText("Hero image is required."),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("drops the selected-image preview when the form resets the file input", async () => {
    const user = userEvent.setup();
    const { container } = render(<EditCollectionForm collection={makeCollection({
      heroImageUrl: null,
    })} />);
    const heroImageInput = container.querySelector<HTMLInputElement>('input[name="heroImageFile"]');
    await user.upload(
      heroImageInput!,
      new File(["image"], "hero.png", { type: "image/png" }),
    );
    expect(screen.getByText("Selected image")).toBeInTheDocument();

    act(() => {
      container.querySelector("form")!.reset();
    });

    await waitFor(() => {
      expect(screen.queryByText("Selected image")).not.toBeInTheDocument();
    });
  });

  it("saves through saveCollectionAction when the existing hero image is kept", async () => {
    mocks.saveCollectionAction.mockResolvedValue({ success: "Collection saved.", collection: makeCollection() });
    const onUpdated = vi.fn();
    const user = userEvent.setup();
    render(<EditCollectionForm collection={makeCollection()} onUpdated={onUpdated} />);

    await user.click(screen.getByRole("button", { name: "Save collection" }));
    const dialog = await screen.findByRole("dialog", { name: /Save Wanderlust/ });
    await user.click(within(dialog).getByRole("button", { name: "Save collection" }));

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

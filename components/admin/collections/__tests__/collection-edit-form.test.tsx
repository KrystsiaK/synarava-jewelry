import { render, screen, waitFor } from "@testing-library/react";
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
    symbolismLabel: null,
    symbolismTitle: null,
    symbolismBody: null,
    symbolismBody2: null,
    heroImageUrl: "https://cdn.example.com/wanderlust.jpg",
    sortOrder: 0,
    status: "DRAFT",
    visibility: "PRIVATE",
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
});

function longTextPreview(label: string | RegExp) {
  const button = screen.getByRole("button", {
    name: typeof label === "string" ? `Edit ${label}` : new RegExp(`Edit ${label.source}`, label.flags),
  });
  return button.closest("[data-component='AdminLongTextField']")?.querySelector(".adm-long-text-preview__copy");
}

describe("EditCollectionForm", () => {
  it("renders existing collection values", () => {
    render(<EditCollectionForm collection={makeCollection()} />);

    expect(screen.getByRole("heading", { name: "Wanderlust" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Name\*/)).toHaveValue("Wanderlust");
    expect(longTextPreview("Collection summary")).toHaveTextContent("A summer story.");
  });

  it("keeps Site state with the collection fields and Delete help next to Delete", () => {
    render(<EditCollectionForm collection={makeCollection()} />);

    const siteState = document.querySelector("[data-component='WorkflowStateField']");
    expect(siteState).not.toBeNull();
    expect(siteState).toHaveAttribute("id", "field-workflowState");
    expect(screen.getByRole("button", { name: /Draft\. Hidden from the site/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Published\. Visible on collection listings/i })).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: /Publishing guidance/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Delete guidance/i })).toBeInTheDocument();
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
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
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

    expect(screen.getByLabelText(/^Name\*/)).toHaveValue("Wanderlust");
    await user.click(screen.getByRole("tab", { name: "Português" }));

    // Same field, no longer required outside EN, now showing the PT value.
    expect(screen.getByLabelText("Name")).toHaveValue("Rituais de Verão");

    await user.click(screen.getByRole("tab", { name: "English" }));
    expect(screen.getByLabelText(/^Name\*/)).toHaveValue("Wanderlust");

    // Both locales' real values are always in the hidden fields the server reads.
    expect(container.querySelector<HTMLInputElement>('input[type="hidden"][name="name"]')?.value).toBe("Wanderlust");
    expect(container.querySelector<HTMLInputElement>('input[type="hidden"][name="ptName"]')?.value).toBe("Rituais de Verão");
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

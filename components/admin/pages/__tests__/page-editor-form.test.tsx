import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  savePageAction: vi.fn(),
}));

vi.mock("@/app/admin/actions/pages", () => ({
  savePageAction: mocks.savePageAction,
}));

import { PageEditor } from "@/components/admin/pages/page-editor-form";
import type { SavedPagePayload } from "@/app/admin/actions/pages";

function makePage(overrides: Partial<SavedPagePayload> = {}): SavedPagePayload {
  return {
    id: "page-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02"),
    slug: "journal",
    title: "Journal",
    excerpt: "A short excerpt.",
    content: { body: "Body copy." },
    status: "DRAFT",
    visibility: "PRIVATE",
    ...overrides,
  };
}

function hiddenFieldValue(container: HTMLElement, name: string) {
  return container.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`)?.value;
}

// Fields with an AdminHelp tooltip share their <label> with the tooltip's own
// labelable trigger button, so getByLabelText can resolve to that button
// instead of the field. Query these shared fields by name instead.
function fieldByName(container: HTMLElement, name: string) {
  return container.querySelector<HTMLInputElement>(`[name="${name}"]`);
}

beforeEach(() => {
  vi.clearAllMocks();
  // The active-locale tab is remembered in sessionStorage per page slug, so
  // tests sharing a slug (e.g. "home") would otherwise leak their tab state.
  sessionStorage.clear();
});

describe("PageEditor", () => {
  it("renders the page's current title, slug, and body", () => {
    render(<PageEditor page={makePage()} />);

    expect(screen.getByRole("heading", { name: "Journal" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Journal");
    expect(screen.getByLabelText("Body")).toHaveValue("Body copy.");
  });

  it("switches the same Title field's value with the locale tab, keeping shared CTA href untouched", async () => {
    const user = userEvent.setup();
    const { container } = render(<PageEditor page={makePage({
      content: { body: "Body copy.", ctaHref: "/shop", translations: { pt: { title: "Diário", body: "Corpo." } } },
    })} />);

    expect(screen.getByLabelText("Title")).toHaveValue("Journal");
    expect(fieldByName(container, "ctaHref")).toHaveValue("/shop");

    await user.click(screen.getByRole("tab", { name: "Português" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Diário");
    expect(screen.getByLabelText("Body")).toHaveValue("Corpo.");
    expect(fieldByName(container, "ctaHref")).toHaveValue("/shop");

    await user.click(screen.getByRole("tab", { name: "English" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Journal");

    // Both locales' real values are always in the hidden fields the server reads, regardless of the active tab.
    expect(hiddenFieldValue(container, "title")).toBe("Journal");
    expect(hiddenFieldValue(container, "ptTitle")).toBe("Diário");
  });

  it("keeps each locale's edits independent when typing, switching, and switching back", async () => {
    const user = userEvent.setup();
    const { container } = render(<PageEditor page={makePage()} />);

    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Updated EN Title");

    await user.click(screen.getByRole("tab", { name: "Português" }));
    expect(screen.getByLabelText("Title")).toHaveValue("");
    await user.type(screen.getByLabelText("Title"), "Título PT");

    await user.click(screen.getByRole("tab", { name: "English" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Updated EN Title");

    expect(hiddenFieldValue(container, "title")).toBe("Updated EN Title");
    expect(hiddenFieldValue(container, "ptTitle")).toBe("Título PT");
  });

  it("uses the home-page-specific labels for the protected home slug", async () => {
    const user = userEvent.setup();
    const { container } = render(<PageEditor page={makePage({
      slug: "home",
      title: "Home",
      content: {
        departmentSectionEnabled: true,
        departmentSectionTitle: "Choose where to begin.",
        departmentSectionBody: "A considered way into the collection.",
        departmentSectionImageCaption: "One point of view.",
        departmentSectionCtaLabel: "Explore the shop",
        editSectionTitle: "The Edit",
        editSectionCtaLabel: "View piece",
        materialSectionNoteLabel: "Material notes",
        translations: {
          pt: {
            departmentSectionTitle: "Escolha por onde começar.",
            departmentSectionBody: "Uma entrada cuidada na coleção.",
            editSectionTitle: "A Seleção",
            editSectionCtaLabel: "Ver peça",
            materialSectionNoteLabel: "Notas de materiais",
          },
        },
      },
    })} />);

    expect(screen.getByLabelText("Hero headline")).toBeInTheDocument();
    expect(screen.getByLabelText("Search summary")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Show department pathway" })).toBeChecked();
    expect(screen.getByLabelText("Department headline")).toHaveValue("Choose where to begin.");
    expect(screen.getByLabelText("Department description")).toHaveValue("A considered way into the collection.");
    expect(screen.getByLabelText("Department image caption")).toHaveValue("One point of view.");
    expect(screen.getByLabelText("Department CTA label")).toHaveValue("Explore the shop");
    expect(screen.getByRole("checkbox", { name: "Show hero" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Show featured collections" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Show material lexicon" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Show manifesto" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Show final call to action" })).toBeChecked();
    expect(screen.getByLabelText("Archive background label")).toBeInTheDocument();
    expect(screen.getByLabelText("The Edit title")).toHaveValue("The Edit");
    expect(screen.getByLabelText("The Edit product CTA")).toHaveValue("View piece");
    expect(screen.getByLabelText("Material section title")).toBeInTheDocument();
    expect(screen.getByLabelText("Material note label")).toHaveValue("Material notes");
    expect(screen.getByLabelText("Manifesto attribution")).toBeInTheDocument();
    expect(screen.getByLabelText("Final CTA label")).toBeInTheDocument();
    expect(fieldByName(container, "finalContactEmail")).toBeInTheDocument();

    // The Portuguese values exist too, just under the PT tab, not a second copy of every field.
    expect(hiddenFieldValue(container, "ptDepartmentSectionTitle")).toBe("Escolha por onde começar.");
    expect(hiddenFieldValue(container, "ptEditSectionTitle")).toBe("A Seleção");
    expect(hiddenFieldValue(container, "ptMaterialSectionNoteLabel")).toBe("Notas de materiais");
    await user.click(screen.getByRole("tab", { name: "Português" }));
    expect(screen.getByLabelText("Department headline")).toHaveValue("Escolha por onde começar.");
    expect(screen.getByLabelText("The Edit title")).toHaveValue("A Seleção");
    expect(screen.getByLabelText("The Edit product CTA")).toHaveValue("Ver peça");
    expect(screen.getByLabelText("Material note label")).toHaveValue("Notas de materiais");
  });

  it("does not show home-only department controls for a regular page", () => {
    render(<PageEditor page={makePage()} />);

    expect(screen.queryByRole("checkbox", { name: "Show department pathway" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Department headline")).not.toBeInTheDocument();
  });

  it("submits the bilingual department pathway settings", async () => {
    mocks.savePageAction.mockImplementation(async (formData: FormData) => {
      expect(formData.get("departmentSectionEnabled")).toBe("1");
      expect(formData.get("departmentSectionTitle")).toBe("Choose where to begin.");
      expect(formData.get("departmentSectionBody")).toBe("A considered way into the collection.");
      expect(formData.get("ptDepartmentSectionTitle")).toBe("Escolha por onde começar.");
      expect(formData.get("ptDepartmentSectionBody")).toBe("Uma entrada cuidada na coleção.");
      return { success: "Page saved." };
    });
    const user = userEvent.setup();
    render(<PageEditor page={makePage({ slug: "home", title: "Home" })} />);

    await user.click(screen.getByRole("checkbox", { name: "Show department pathway" }));
    await user.type(screen.getByLabelText("Department headline"), "Choose where to begin.");
    await user.type(screen.getByLabelText("Department description"), "A considered way into the collection.");
    await user.click(screen.getByRole("tab", { name: "Português" }));
    await user.type(screen.getByLabelText("Department headline"), "Escolha por onde começar.");
    await user.type(screen.getByLabelText("Department description"), "Uma entrada cuidada na coleção.");
    await user.click(screen.getAllByRole("button", { name: "Save page" })[0]);
    await user.click((await screen.findAllByRole("button", { name: "Save page" })).at(-1)!);

    expect(mocks.savePageAction).toHaveBeenCalledTimes(1);
  });

  it("submits visibility settings for every home section", async () => {
    mocks.savePageAction.mockImplementation(async (formData: FormData) => {
      expect(formData.get("heroSectionEnabled")).toBe("1");
      expect(formData.get("departmentSectionEnabled")).toBeNull();
      expect(formData.get("archiveSectionEnabled")).toBe("1");
      expect(formData.get("editSectionEnabled")).toBeNull();
      expect(formData.get("materialSectionEnabled")).toBeNull();
      expect(formData.get("manifestoSectionEnabled")).toBe("1");
      expect(formData.get("finalCtaSectionEnabled")).toBe("1");
      return { success: "Page saved." };
    });
    const user = userEvent.setup();
    render(<PageEditor page={makePage({ slug: "home", title: "Home" })} />);

    await user.click(screen.getByRole("checkbox", { name: "Show material lexicon" }));
    await user.click(screen.getByRole("checkbox", { name: "Show The Edit" }));
    await user.click(screen.getAllByRole("button", { name: "Save page" })[0]);
    await user.click((await screen.findAllByRole("button", { name: "Save page" })).at(-1)!);

    expect(mocks.savePageAction).toHaveBeenCalledTimes(1);
  });

  it("saves through savePageAction on confirm", async () => {
    const updatedPage = makePage({ title: "Journal Updated" });
    mocks.savePageAction.mockResolvedValue({ success: "Page saved.", page: updatedPage });
    const onUpdated = vi.fn();
    const user = userEvent.setup();
    render(<PageEditor page={makePage()} onUpdated={onUpdated} />);

    await user.click(screen.getAllByRole("button", { name: "Save page" })[0]);
    const modalConfirmButton = (await screen.findAllByRole("button", { name: "Save page" })).at(-1)!;
    await user.click(modalConfirmButton);

    expect(mocks.savePageAction).toHaveBeenCalledTimes(1);
    expect(onUpdated).toHaveBeenCalledWith(updatedPage);
  });
});

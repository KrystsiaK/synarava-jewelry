import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  savePageAction: vi.fn(),
  searchStorefrontHrefsAction: vi.fn(),
}));

vi.mock("@/app/admin/actions/pages", () => ({
  savePageAction: mocks.savePageAction,
}));

vi.mock("@/app/admin/actions/storefront-href", () => ({
  searchStorefrontHrefsAction: mocks.searchStorefrontHrefsAction,
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

function longTextPreview(label: string | RegExp) {
  const button = screen.getByRole("button", {
    name: typeof label === "string" ? `Edit ${label}` : new RegExp(`Edit ${label.source}`, label.flags),
  });
  return button.closest("[data-component='AdminLongTextField']")?.querySelector(".adm-long-text-preview__copy");
}

async function fillLongText(user: ReturnType<typeof userEvent.setup>, label: string, text: string) {
  await user.click(screen.getByRole("button", { name: `Edit ${label}` }));
  const editor = screen.getByRole("textbox", { name: label });
  await user.clear(editor);
  await user.type(editor, text);
  await user.click(screen.getByRole("button", { name: "Apply changes" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchStorefrontHrefsAction.mockResolvedValue({ segments: [] });
  // The active-locale tab is remembered in sessionStorage per page slug, so
  // tests sharing a slug (e.g. "home") would otherwise leak their tab state.
  sessionStorage.clear();
});

describe("PageEditor", () => {
  it("edits the four ordered product slots used by the product showcase", async () => {
    mocks.savePageAction.mockImplementation(async (formData: FormData) => {
      expect(formData.get("editProductId1")).toBe("bird");
      expect(formData.get("editProductId2")).toBe("moon");
      expect(formData.get("editProductId3")).toBe("dog");
      expect(formData.get("editProductId4")).toBe("pearl");
      return { success: "Page saved." };
    });
    const user = userEvent.setup();
    render(<PageEditor
      page={makePage({
        slug: "home",
        title: "Home",
        content: { editProductIds: ["bird", "moon", "dog", "pearl"] },
      })}
      productOptions={[
        { id: "bird", title: "Golden Bird Brooch", slug: "golden-bird-brooch" },
        { id: "moon", title: "Hammered Half Moon Necklace", slug: "hammered-half-moon-necklace" },
        { id: "dog", title: "Clementine Dachshund Bag Charm", slug: "clementine-dachshund-bag-charm" },
        { id: "pearl", title: "AAA Freshwater Pearl Necklace", slug: "aaa-freshwater-pearl-necklace" },
      ]}
    />);

    expect(screen.getByLabelText("Product 1")).toHaveValue("bird");
    expect(screen.getByLabelText("Product 4")).toHaveValue("pearl");

    await user.click(screen.getAllByRole("button", { name: "Save page" })[0]);
    await user.click((await screen.findAllByRole("button", { name: "Save page" })).at(-1)!);

    expect(mocks.savePageAction).toHaveBeenCalledTimes(1);
  });

  it("renders the page's current title, slug, and body", () => {
    render(<PageEditor page={makePage()} />);

    expect(screen.getByRole("heading", { name: "Journal" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Journal");
    expect(longTextPreview("Body")).toHaveTextContent("Body copy.");
  });

  it("keeps Save page in the shared AdminListWorkspace sticky header", () => {
    const { container } = render(<PageEditor page={makePage()} />);
    const root = container.querySelector('[data-component="AdminListWorkspace"]');
    const header = container.querySelector('[data-component="AdminPanel.Header"]');

    expect(root).not.toBeNull();
    expect(header).toHaveAttribute("data-sticky", "true");
    expect(header).toHaveClass("adm-panel__header--ruled");
    expect(header?.querySelector(".adm-btn-primary")).toHaveTextContent("Save page");
    expect(header?.querySelector(".adm-locale-workspace-header--embedded")).not.toBeNull();
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
    expect(longTextPreview("Body")).toHaveTextContent("Corpo.");
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
        editSectionTitle: "The Edit",
        editSectionViewAllLabel: "View all products",
        materialSectionNoteLabel: "Material notes",
        translations: {
          pt: {
            editSectionTitle: "A Seleção",
            editSectionViewAllLabel: "Ver todos os produtos",
            materialSectionNoteLabel: "Notas de materiais",
          },
        },
      },
    })} />);

    expect(screen.getByLabelText("Hero headline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Search summary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /01 \/ Hero/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /02 \/ Featured collections/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /03 \/ Product showcase/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /04 \/ Material lexicon/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /05 \/ Manifesto/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /06 \/ Final call to action/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Collection-led sections" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Show hero" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Show featured collections" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Show material lexicon" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Show manifesto" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Show final call to action" })).toBeChecked();
    expect(screen.getByRole("textbox", { name: "Archive background label" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Collection 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add collection" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Showcase title" })).toHaveValue("The Edit");
    expect(screen.getByRole("textbox", { name: "View all label" })).toHaveValue("View all products");
    expect(screen.getByRole("textbox", { name: "Material section title" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Material note label" })).toHaveValue("Material notes");
    expect(screen.getByRole("button", { name: "Add material" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Material 01/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Manifesto attribution" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Final CTA label" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Secondary CTA label" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Secondary CTA href" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Closing statement" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Include contact email" })).not.toBeChecked();
    expect(screen.queryByRole("textbox", { name: "Contact email" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Photo 1" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Photo 4" })).toBeInTheDocument();
    expect(container.querySelector('[data-component="PageEditor"]')).toHaveAttribute("novalidate");

    // The Portuguese values exist too, just under the PT tab, not a second copy of every field.
    expect(hiddenFieldValue(container, "ptEditSectionTitle")).toBe("A Seleção");
    expect(hiddenFieldValue(container, "ptMaterialSectionNoteLabel")).toBe("Notas de materiais");
    await user.click(screen.getByRole("tab", { name: "Português" }));
    expect(screen.getByRole("textbox", { name: "Showcase title" })).toHaveValue("A Seleção");
    expect(screen.getByRole("textbox", { name: "View all label" })).toHaveValue("Ver todos os produtos");
    expect(screen.getByRole("textbox", { name: "Material note label" })).toHaveValue("Notas de materiais");
  });

  it("submits bilingual edit-section copy for the home page", async () => {
    mocks.savePageAction.mockImplementation(async (formData: FormData) => {
      expect(formData.get("editSectionTitle")).toBe("The Edit");
      expect(formData.get("editSectionBody")).toBe("Four pieces to begin.");
      expect(formData.get("ptEditSectionTitle")).toBe("A Seleção");
      expect(formData.get("ptEditSectionBody")).toBe("Quatro peças para começar.");
      return { success: "Page saved." };
    });
    const user = userEvent.setup();
    render(<PageEditor page={makePage({ slug: "home", title: "Home" })} />);

    await user.type(screen.getByRole("textbox", { name: "Showcase title" }), "The Edit");
    await fillLongText(user, "Showcase description", "Four pieces to begin.");
    await user.click(screen.getByRole("tab", { name: "Português" }));
    // Paste accented copy — user.type splits combining characters and truncates.
    const ptTitle = screen.getByRole("textbox", { name: "Showcase title" });
    await user.clear(ptTitle);
    await user.click(ptTitle);
    await user.paste("A Seleção");
    await user.click(screen.getByRole("button", { name: "Edit Showcase description" }));
    const editor = screen.getByRole("textbox", { name: "Showcase description" });
    await user.clear(editor);
    await user.click(editor);
    await user.paste("Quatro peças para começar.");
    await user.click(screen.getByRole("button", { name: "Apply changes" }));
    await user.click(screen.getAllByRole("button", { name: "Save page" })[0]);
    await user.click((await screen.findAllByRole("button", { name: "Save page" })).at(-1)!);

    expect(mocks.savePageAction).toHaveBeenCalledTimes(1);
  });

  it("submits visibility settings for every home section", async () => {
    mocks.savePageAction.mockImplementation(async (formData: FormData) => {
      expect(formData.get("heroSectionEnabled")).toBe("1");
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
    await user.click(screen.getByRole("checkbox", { name: "Show product showcase" }));
    await user.click(screen.getAllByRole("button", { name: "Save page" })[0]);
    await user.click((await screen.findAllByRole("button", { name: "Save page" })).at(-1)!);

    expect(mocks.savePageAction).toHaveBeenCalledTimes(1);
  });

  it("blocks save when Final CTA contact is enabled without label and email", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    render(<PageEditor page={makePage({ slug: "home", title: "Home" })} />);

    await user.click(screen.getByRole("checkbox", { name: "Include contact email" }));
    await user.click(screen.getAllByRole("button", { name: "Save page" })[0]);

    expect(await screen.findByText("Enter a contact link label.")).toBeInTheDocument();
    expect(screen.getByText("Enter a contact email.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.savePageAction).not.toHaveBeenCalled();
  });

  it("blocks save when Final CTA contact email is invalid", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    render(<PageEditor page={makePage({ slug: "home", title: "Home" })} />);

    await user.click(screen.getByRole("checkbox", { name: "Include contact email" }));
    await user.type(screen.getByRole("textbox", { name: /Contact link label/i }), "Write us");
    const email = screen.getByRole("textbox", { name: /Contact email/i });
    await user.clear(email);
    await user.type(email, "not-an-email");
    await user.click(screen.getAllByRole("button", { name: "Save page" })[0]);

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.savePageAction).not.toHaveBeenCalled();
  });

  it("keeps product showcase selections after the first save from empty slots", async () => {
    const productOptions = [
      { id: "tortoise", title: "Tortoise Leaf & Sun Bag Charm", slug: "tortoise-leaf-sun-bag-charm" },
      { id: "half-moon", title: "Hammered Half-Moon Necklace", slug: "hammered-half-moon-necklace" },
      { id: "bird-alt", title: "Golden Bird Brooch Alt", slug: "golden-bird-brooch-alt" },
      { id: "oak-ring", title: "Oak Ring", slug: "oak-ring" },
    ];
    const initial = makePage({
      slug: "home",
      title: "Home",
      content: {},
    });
    const saved = makePage({
      ...initial,
      updatedAt: new Date("2026-01-03"),
      content: { editProductIds: ["tortoise", "half-moon", "bird-alt", "oak-ring"] },
    });
    mocks.savePageAction.mockImplementation(async (formData: FormData) => {
      expect(formData.get("editProductId1")).toBe("tortoise");
      expect(formData.get("editProductId2")).toBe("half-moon");
      expect(formData.get("editProductId3")).toBe("bird-alt");
      expect(formData.get("editProductId4")).toBe("oak-ring");
      return { success: "Page updated.", page: saved };
    });

    const user = userEvent.setup();
    let currentPage = initial;
    const onUpdated = vi.fn((page: SavedPagePayload) => {
      currentPage = page;
    });
    const view = render(
      <PageEditor page={currentPage} productOptions={productOptions} onUpdated={onUpdated} />,
    );

    expect(screen.getByLabelText("Product 1")).toHaveValue("");

    await user.selectOptions(screen.getByLabelText("Product 1"), "tortoise");
    await user.selectOptions(screen.getByLabelText("Product 2"), "half-moon");
    await user.selectOptions(screen.getByLabelText("Product 3"), "bird-alt");
    await user.selectOptions(screen.getByLabelText("Product 4"), "oak-ring");

    await user.click(screen.getAllByRole("button", { name: "Save page" })[0]);
    await user.click((await screen.findAllByRole("button", { name: "Save page" })).at(-1)!);

    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(saved));

    // Parent route applies the save payload (and soft refresh may follow).
    view.rerender(
      <PageEditor page={currentPage} productOptions={productOptions} onUpdated={onUpdated} />,
    );

    expect(screen.getByLabelText("Product 1")).toHaveValue("tortoise");
    expect(screen.getByLabelText("Product 2")).toHaveValue("half-moon");
    expect(screen.getByLabelText("Product 3")).toHaveValue("bird-alt");
    expect(screen.getByLabelText("Product 4")).toHaveValue("oak-ring");
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

  it("replaces material Current image URLs from the saved page after save", async () => {
    const user = userEvent.setup();
    const initial = makePage({
      slug: "home",
      title: "Home",
      content: {
        materialLexicon: [
          { name: "Pearl", category: "Organic", description: "Irregular.", properties: "Natural", image: "/pearl-old.webp" },
          { name: "Oak", category: "Wood", description: "Ancient.", properties: "Warm", image: "/oak.webp" },
        ],
      },
    });
    const updated = makePage({
      ...initial,
      updatedAt: new Date("2026-01-03"),
      content: {
        materialLexicon: [
          { name: "Pearl", category: "Organic", description: "Irregular.", properties: "Natural", image: "/pearl-new.webp" },
          { name: "Oak", category: "Wood", description: "Ancient.", properties: "Warm", image: "/oak.webp" },
        ],
      },
    });
    mocks.savePageAction.mockResolvedValue({ success: "Page updated.", page: updated });

    const { container } = render(<PageEditor page={initial} />);
    expect(hiddenFieldValue(container, "material1Image")).toBe("/pearl-old.webp");

    await user.click(screen.getAllByRole("button", { name: "Save page" })[0]);
    await user.click((await screen.findAllByRole("button", { name: "Save page" })).at(-1)!);

    await waitFor(() => {
      expect(hiddenFieldValue(container, "material1Image")).toBe("/pearl-new.webp");
    });
    expect(hiddenFieldValue(container, "material2Image")).toBe("/oak.webp");
  });
});

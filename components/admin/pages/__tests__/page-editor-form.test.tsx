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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PageEditor", () => {
  it("renders the page's current title, slug, and body", () => {
    render(<PageEditor page={makePage()} />);

    expect(screen.getByRole("heading", { name: "Journal" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Journal");
    expect(screen.getByLabelText("Body")).toHaveValue("Body copy.");
  });

  it("uses the home-page-specific labels for the protected home slug", () => {
    render(<PageEditor page={makePage({
      slug: "home",
      title: "Home",
      content: {
        departmentSectionEnabled: true,
        departmentSectionTitle: "Choose where to begin.",
        departmentSectionBody: "A considered way into the collection.",
        departmentSectionImageCaption: "One point of view.",
        departmentSectionCtaLabel: "Explore the shop",
        translations: {
          pt: {
            departmentSectionTitle: "Escolha por onde começar.",
            departmentSectionBody: "Uma entrada cuidada na coleção.",
          },
        },
      },
    })} />);

    expect(screen.getByLabelText("Hero headline")).toBeInTheDocument();
    expect(screen.getByLabelText("Search summary")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Show department pathway" })).toBeChecked();
    expect(screen.getByLabelText("Department headline (EN)")).toHaveValue("Choose where to begin.");
    expect(screen.getByLabelText("Department description (EN)")).toHaveValue("A considered way into the collection.");
    expect(screen.getByLabelText("Department image caption (EN)")).toHaveValue("One point of view.");
    expect(screen.getByLabelText("Department CTA label (EN)")).toHaveValue("Explore the shop");
    expect(screen.getByLabelText("Department headline (PT)")).toHaveValue("Escolha por onde começar.");
    expect(screen.getByLabelText("Department description (PT)")).toHaveValue("Uma entrada cuidada na coleção.");
  });

  it("does not show home-only department controls for a regular page", () => {
    render(<PageEditor page={makePage()} />);

    expect(screen.queryByRole("checkbox", { name: "Show department pathway" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Department headline (EN)")).not.toBeInTheDocument();
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
    await user.type(screen.getByLabelText("Department headline (EN)"), "Choose where to begin.");
    await user.type(screen.getByLabelText("Department description (EN)"), "A considered way into the collection.");
    await user.type(screen.getByLabelText("Department headline (PT)"), "Escolha por onde começar.");
    await user.type(screen.getByLabelText("Department description (PT)"), "Uma entrada cuidada na coleção.");
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

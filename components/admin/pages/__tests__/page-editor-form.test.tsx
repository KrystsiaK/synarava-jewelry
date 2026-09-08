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
    render(<PageEditor page={makePage({ slug: "home", title: "Home" })} />);

    expect(screen.getByLabelText("Hero headline")).toBeInTheDocument();
    expect(screen.getByLabelText("Search summary")).toBeInTheDocument();
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

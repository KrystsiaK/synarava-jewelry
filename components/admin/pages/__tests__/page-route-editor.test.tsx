import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  savePageAction: vi.fn(),
  searchStorefrontHrefsAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }),
}));

vi.mock("@/app/admin/actions/pages", () => ({
  savePageAction: mocks.savePageAction,
}));

vi.mock("@/app/admin/actions/storefront-href", () => ({
  searchStorefrontHrefsAction: mocks.searchStorefrontHrefsAction,
}));

import { PageEditRoute } from "@/components/admin/pages/page-route-editor";
import type { SavedPagePayload } from "@/app/admin/actions/pages";

function makePage(overrides: Partial<SavedPagePayload> = {}): SavedPagePayload {
  return {
    id: "page-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02"),
    slug: "home",
    title: "Home",
    excerpt: null,
    content: {},
    status: "PUBLISHED",
    visibility: "PUBLIC",
    shopifyPageId: null,
    shopifyHandle: null,
    translations: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchStorefrontHrefsAction.mockResolvedValue({ segments: [] });
  sessionStorage.clear();
});

describe("PageEditRoute", () => {
  it("applies the saved page so product showcase slots stay filled after save", async () => {
    const productOptions = [
      { id: "tortoise", title: "Tortoise Leaf & Sun Bag Charm", slug: "tortoise-leaf-sun-bag-charm" },
      { id: "half-moon", title: "Hammered Half-Moon Necklace", slug: "hammered-half-moon-necklace" },
      { id: "bird-alt", title: "Golden Bird Brooch Alt", slug: "golden-bird-brooch-alt" },
      { id: "oak-ring", title: "Oak Ring", slug: "oak-ring" },
    ];
    const initial = makePage();
    const saved = makePage({
      updatedAt: new Date("2026-01-03"),
      content: { editProductIds: ["tortoise", "half-moon", "bird-alt", "oak-ring"] },
    });
    mocks.savePageAction.mockResolvedValue({ success: "Page updated.", page: saved });

    const user = userEvent.setup();
    const { rerender } = render(
      <PageEditRoute page={initial} productOptions={productOptions} translationLocales={[]} />,
    );

    expect(screen.getByLabelText("Product 1")).toHaveValue("");

    await user.selectOptions(screen.getByLabelText("Product 1"), "tortoise");
    await user.selectOptions(screen.getByLabelText("Product 2"), "half-moon");
    await user.selectOptions(screen.getByLabelText("Product 3"), "bird-alt");
    await user.selectOptions(screen.getByLabelText("Product 4"), "oak-ring");

    await user.click(screen.getAllByRole("button", { name: "Save page" })[0]);
    await user.click((await screen.findAllByRole("button", { name: "Save page" })).at(-1)!);

    await waitFor(() => expect(mocks.savePageAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());

    // Soft refresh may still pass the pre-save server page; local save payload must win.
    rerender(
      <PageEditRoute page={initial} productOptions={productOptions} translationLocales={[]} />,
    );

    expect(screen.getByLabelText("Product 1")).toHaveValue("tortoise");
    expect(screen.getByLabelText("Product 2")).toHaveValue("half-moon");
    expect(screen.getByLabelText("Product 3")).toHaveValue("bird-alt");
    expect(screen.getByLabelText("Product 4")).toHaveValue("oak-ring");
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminProductListItem, AdminProductListPage } from "@/lib/admin/list-products-shared";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";
import { adminSyncActionMocks } from "@/test/mocks/admin-sync-actions";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  pushToast: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/products",
  useRouter: () => ({
    refresh: mocks.refresh,
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={typeof href === "string" ? href : "#"}>{children}</a>
  ),
}));

vi.mock("@/components/admin/shared/admin-toast", () => ({
  useAdminToast: () => ({ pushToast: mocks.pushToast }),
}));

vi.mock("@/app/admin/actions/sync", async () => {
  const { adminSyncActionMocks } = await import("@/test/mocks/admin-sync-actions");
  return { ...adminSyncActionMocks };
});

vi.mock("@/app/admin/actions/products", () => ({
  deleteProductAction: vi.fn(),
  updateProductStatusAction: vi.fn(),
}));

vi.mock("@/app/admin/actions/catalog-order", () => ({
  reorderCollectionProductAction: vi.fn(),
}));

vi.mock("@/components/admin/products/product-conflict-adapter", () => ({
  CatalogConflictWorkspace: ({
    open,
    onApplied,
  }: {
    open: boolean;
    onApplied?: (info: { productIds: string[]; appliedCount: number }) => void;
  }) => (
    open ? (
      <button
        type="button"
        onClick={() => onApplied?.({ productIds: ["shopify:99"], appliedCount: 1 })}
      >
        Simulate pull applied
      </button>
    ) : null
  ),
}));

import { ProductsCms } from "@/components/admin/products/products-cms";
import { parseAdminProductsListState } from "@/lib/admin/products-list-state";

function listItem(overrides: Partial<AdminProductListItem> = {}): AdminProductListItem {
  return {
    id: "p-bracelet",
    name: "Bracelet",
    slug: "bracelet",
    sku: "B-1",
    status: "DRAFT",
    visibility: "PRIVATE",
    priceCents: 1200,
    shopifyCategoryId: null,
    shopifyCategoryName: null,
    shopifyProductId: null,
    syncStatus: "UNLINKED",
    lastSyncedAt: null,
    publishedAt: null,
    createdAt: "2026-10-13T00:00:00.000Z",
    updatedAt: "2026-10-13T00:00:00.000Z",
    conflictScore: 0,
    locales: [],
    collections: [],
    ...overrides,
  };
}

const emptySignals: CatalogConflictSignals = {
  state: "ready",
  totalCount: 0,
  checkedAt: null,
  products: {},
  recentlyUpdatedProducts: {},
};

const initialPage: AdminProductListPage = {
  nodes: [listItem()],
  hasNextPage: false,
  endCursor: null,
  totalCount: 1,
};

describe("ProductsCms pull refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminSyncActionMocks.loadCatalogConflictSignalsAction.mockResolvedValue({ signals: emptySignals });
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        nodes: [
          listItem(),
          listItem({
            id: "p-pulled",
            name: "Pulled ring",
            slug: "pulled-ring",
            sku: "R-99",
            shopifyProductId: "gid://shopify/Product/99",
            syncStatus: "SYNCED",
          }),
        ],
        hasNextPage: false,
        endCursor: null,
        totalCount: 2,
      } satisfies AdminProductListPage),
    });
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("refetches the product list after a Shopify pull creates a local row", async () => {
    const user = userEvent.setup();
    render(
      <ProductsCms
        initialPage={initialPage}
        categories={[]}
        tags={[]}
        collections={[]}
        initialListState={parseAdminProductsListState({})}
        initialConflictSignals={{
          ...emptySignals,
          totalCount: 1,
          products: {
            "shopify:99": {
              shared: true,
              locales: [],
              presence: "SHOPIFY_ONLY",
              localProductId: null,
              shopifyProductId: "gid://shopify/Product/99",
              name: "Pulled ring",
              allowedDirections: ["SHOPIFY_TO_SYNARAVA"],
            },
          },
        }}
      />,
    );

    expect(screen.getByText("Bracelet")).toBeInTheDocument();
    expect(screen.queryByText("Pulled ring")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show conflicts" }));
    await user.click(screen.getByRole("button", { name: "Simulate pull applied" }));

    await waitFor(() => expect(adminSyncActionMocks.loadCatalogConflictSignalsAction).toHaveBeenCalled());
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/admin/api/products?"),
      expect.objectContaining({ cache: "no-store" }),
    ));
    expect(await screen.findByText("Pulled ring")).toBeInTheDocument();
    expect(screen.getByText("Bracelet")).toBeInTheDocument();
  });
});

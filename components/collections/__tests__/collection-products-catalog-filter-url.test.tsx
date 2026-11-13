import { render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetListStateUrlPendingForTests } from "@/components/shared/list-state/use-list-state";
import type { ShopFilters } from "@/components/shop/types";

const routerPush = vi.fn();
const routerReplace = vi.fn();

vi.mock("@/lib/i18n/context", () => ({
  useTranslations: () => ({
    locale: "en",
    t: (key: string) => key,
    plural: (key: string) => key,
  }),
}));

vi.mock("@/components/ui/display-heading", () => ({
  DisplayHeading: ({ text }: { text: string }) => <h2>{text}</h2>,
}));

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>,
  },
  useInView: () => true,
  useReducedMotion: () => true,
}));

vi.mock("@/components/shop/filter-bar", () => ({
  FilterBar: ({ initialFilters }: { initialFilters: ShopFilters }) => (
    <div data-testid="filter-bar-filters">{JSON.stringify({
      productType: initialFilters.productType ?? null,
      collection: initialFilters.collection ?? null,
      sort: initialFilters.sort ?? null,
    })}</div>
  ),
}));

vi.mock("@/components/shop/shop-catalog-client", () => ({
  ShopCatalogClient: ({
    filters,
    onSelectFilters,
  }: {
    filters: ShopFilters;
    onSelectFilters: (filters: ShopFilters) => void;
  }) => (
    <div>
      <div data-testid="catalog-filters">{JSON.stringify({
        productType: filters.productType ?? null,
        collection: filters.collection ?? null,
        sort: filters.sort ?? null,
      })}</div>
      <button
        type="button"
        onClick={() => onSelectFilters({ productType: "Ring", sort: "newest" })}
      >
        apply-catalog-filter
      </button>
    </div>
  ),
}));

import { CollectionProductsCatalog } from "../collection-products-catalog";

function setCollectionUrl(search = "") {
  resetListStateUrlPendingForTests();
  const href = search ? `/en/collections/ci-filter?${search}` : "/en/collections/ci-filter";
  window.history.replaceState(window.history.state, "", href);
  routerPush.mockClear();
  routerReplace.mockClear();
}

const emptyPage = {
  nodes: [],
  hasNextPage: false,
  endCursor: null,
  totalCount: 0,
};

function renderCatalog(initialFilters: ShopFilters = { collection: "ci-filter", sort: "featured" }) {
  return render(
    <CollectionProductsCatalog
      collectionName="CI Filter"
      collectionPath="/collections/ci-filter"
      collectionSourceSlug="ci-filter"
      initialPage={emptyPage}
      filterProps={{
        categories: [],
        productTypes: [{ value: "Ring", label: "Ring" }],
        collections: [],
        tags: [],
        initialFilters,
      }}
    />,
  );
}

describe("CollectionProductsCatalog filter URL ownership (Back restore)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetListStateUrlPendingForTests();
    routerPush.mockReset();
    routerReplace.mockReset();
    vi.mocked(useRouter).mockReturnValue({
      push: routerPush,
      replace: routerReplace,
      prefetch: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    } as ReturnType<typeof useRouter>);
    setCollectionUrl();
  });

  it("derives catalog filters from the URL after a remount with stale SSR props (Back)", async () => {
    setCollectionUrl("productType=Ring&sort=newest");
    renderCatalog({ collection: "ci-filter", sort: "featured" });

    await waitFor(() => {
      expect(screen.getByTestId("catalog-filters")).toHaveTextContent(
        JSON.stringify({ productType: "Ring", collection: "ci-filter", sort: "newest" }),
      );
    });
  });

  it("writes filter choices through the Next router (not bare history.pushState)", async () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    const pushStateCallsBefore = pushStateSpy.mock.calls.length;
    renderCatalog();

    screen.getByRole("button", { name: "apply-catalog-filter" }).click();

    await waitFor(() => {
      const wrote =
        routerPush.mock.calls.some((call) => String(call[0]).includes("productType=Ring"))
        || routerReplace.mock.calls.some((call) => String(call[0]).includes("productType=Ring"));
      expect(wrote).toBe(true);
    });
    expect(pushStateSpy.mock.calls.length).toBe(pushStateCallsBefore);
    pushStateSpy.mockRestore();
  });
});

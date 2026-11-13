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

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

vi.mock("@/components/ui", () => ({
  DisplayHeading: ({ text }: { text: string }) => <h1>{text}</h1>,
  PrimaryCtaButton: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/components/content/rich-text", () => ({
  RichText: ({ content }: { content: string }) => <p>{content}</p>,
}));

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>,
    p: ({ children, ...props }: { children?: React.ReactNode }) => <p {...props}>{children}</p>,
    create: () =>
      ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>,
  },
  useInView: () => true,
  useReducedMotion: () => true,
  useMotionValue: () => ({ set: () => {}, get: () => 0 }),
  useSpring: (v: unknown) => v,
}));

vi.mock("../shop-discovery", () => ({
  ShopDiscovery: ({
    onSelectFilters,
  }: {
    onSelectFilters?: (filters: ShopFilters) => void;
  }) => (
    <button type="button" onClick={() => onSelectFilters?.({ productType: "Ring" })}>
      apply-discovery-filter
    </button>
  ),
}));

vi.mock("../filter-bar", () => ({
  FilterBar: ({ initialFilters }: { initialFilters: ShopFilters }) => (
    <div data-testid="filter-bar-filters">{JSON.stringify({
      productType: initialFilters.productType ?? null,
      sort: initialFilters.sort ?? null,
    })}</div>
  ),
}));

vi.mock("../shop-catalog-client", () => ({
  ShopCatalogClient: ({ filters }: { filters: ShopFilters }) => (
    <div data-testid="catalog-filters">{JSON.stringify({
      productType: filters.productType ?? null,
      sort: filters.sort ?? null,
    })}</div>
  ),
}));

import { ShopPage } from "../shop-page";

function setShopUrl(search = "") {
  resetListStateUrlPendingForTests();
  const href = search ? `/en/shop?${search}` : "/en/shop";
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

function renderShop(initialFilters: ShopFilters = {}) {
  return render(
    <ShopPage
      initialPage={emptyPage}
      newestProducts={[]}
      popularProducts={[]}
      showPopular={false}
      heroTitle="Shop"
      heroDescription="Desc"
      archiveCount={0}
      productTypeTiles={[]}
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

describe("ShopPage filter URL ownership (Back restore)", () => {
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
    setShopUrl();
  });

  it("derives catalog filters from the URL after a remount with stale SSR props (Back)", async () => {
    // Simulate App Router Back: RSC remounts with empty initialFilters while the
    // address bar still has the filtered query string from the prior visit.
    setShopUrl("productType=Ring&sort=newest");
    renderShop({});

    await waitFor(() => {
      expect(screen.getByTestId("catalog-filters")).toHaveTextContent(
        JSON.stringify({ productType: "Ring", sort: "newest" }),
      );
    });
    expect(screen.getByTestId("filter-bar-filters")).toHaveTextContent(
      JSON.stringify({ productType: "Ring", sort: "newest" }),
    );
  });

  it("writes discovery filter choices through the Next router (not bare history.pushState)", async () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    const pushStateCallsBefore = pushStateSpy.mock.calls.length;
    renderShop({});

    screen.getByRole("button", { name: "apply-discovery-filter" }).click();

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

import { act, render, screen, waitFor } from "@testing-library/react";
import {
  buildCatalogViewKey,
  CATALOG_VIEW_SCHEMA_VERSION,
  clearCatalogViewCacheForTests,
  getMemoryView,
  saveView,
} from "@/lib/catalog/catalog-view-cache";
import { ShopCatalogClient, type InitialCatalogPage } from "../shop-catalog-client";

function product(id: string) {
  return {
    id,
    shopifyProductId: null,
    slug: id,
    sourceTitle: id,
    series: "",
    title: id,
    shortDescription: "",
    price: "€10",
    priceAmount: 10,
    compareAtPrice: "",
    compareAtAmount: null,
    image: "/x.webp",
    inStock: true,
    searchText: id,
    categorySlug: null,
    categoryName: "",
    productType: "",
    productTypeLabel: "",
    materialLabel: "",
    collectionSlugs: [],
    tagSlugs: [],
    tagNames: [],
    characteristics: [],
    createdAt: new Date("2026-01-01"),
  };
}

function initialPage(overrides: Partial<InitialCatalogPage> = {}): InitialCatalogPage {
  return {
    nodes: [product("a"), product("b")],
    hasNextPage: true,
    endCursor: "cursor-1",
    totalCount: 3,
    ...overrides,
  };
}

function triggerSentinel() {
  const ctor = global.IntersectionObserver as unknown as { mock: { calls: unknown[][]; results: { value: { _cb: (entries: { isIntersecting: boolean }[]) => void } }[] } };
  const lastResult = ctor.mock.results.at(-1)?.value;
  act(() => lastResult?._cb([{ isIntersecting: true }]));
}

function ownedSnapshot(
  fingerprint: string,
  overrides: Partial<Parameters<typeof saveView>[0]> = {},
) {
  return {
    viewKey: buildCatalogViewKey("en", fingerprint),
    fingerprint,
    schemaVersion: CATALOG_VIEW_SCHEMA_VERSION,
    savedAt: Date.now(),
    nodes: [product("a"), product("b"), product("c")],
    endCursor: null,
    hasNextPage: false,
    totalCount: 3,
    anchor: null,
    ...overrides,
  };
}

describe("ShopCatalogClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    clearCatalogViewCacheForTests();
  });

  it("renders the SSR-seeded first page without an extra fetch", () => {
    render(
      <ShopCatalogClient
        initialPage={initialPage()}
        filters={{}}
        onSelectFilters={vi.fn()}
        categories={[]}
        collections={[]}
        tags={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: "a" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "b" })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("appends the next page when the sentinel intersects, without duplicating already-loaded cards", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        nodes: [product("b"), product("c")],
        hasNextPage: false,
        endCursor: null,
        totalCount: 3,
        popularAvailable: true,
      }),
    });

    render(
      <ShopCatalogClient
        initialPage={initialPage()}
        filters={{}}
        onSelectFilters={vi.fn()}
        categories={[]}
        collections={[]}
        tags={[]}
      />,
    );

    triggerSentinel();

    await waitFor(() => expect(screen.getByRole("heading", { name: "c" })).toBeInTheDocument());
    expect(screen.getAllByRole("heading", { name: "b" })).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain("cursor=cursor-1");
  });

  it("remounts for a new filter view and fetches a fresh page (no SSR seed)", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        nodes: [product("z")],
        hasNextPage: false,
        endCursor: null,
        totalCount: 1,
        popularAvailable: true,
      }),
    });

    const first = render(
      <ShopCatalogClient
        key="en|"
        initialPage={initialPage()}
        filters={{}}
        onSelectFilters={vi.fn()}
        categories={[]}
        collections={[]}
        tags={[]}
      />,
    );

    // Parent remounts with a new viewKey and null SSR seed.
    first.unmount();
    render(
      <ShopCatalogClient
        key="en|q=ring"
        initialPage={null}
        filters={{ q: "ring" }}
        onSelectFilters={vi.fn()}
        categories={[]}
        collections={[]}
        tags={[]}
      />,
    );

    await waitFor(() => expect(screen.getByRole("heading", { name: "z" })).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "a" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "b" })).not.toBeInTheDocument();
  });

  it("aborts an in-flight fetch when the view remounts for another filter", async () => {
    let resolveFirst: ((value: unknown) => void) | null = null;
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((_url: string, init?: { signal?: AbortSignal }) => {
      return new Promise((resolve, reject) => {
        resolveFirst = resolve;
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    const { unmount } = render(
      <ShopCatalogClient
        key="en|q=slow"
        initialPage={null}
        filters={{ q: "slow" }}
        onSelectFilters={vi.fn()}
        categories={[]}
        collections={[]}
        tags={[]}
      />,
    );

    await waitFor(() => expect(fetch).toHaveBeenCalled());

    unmount();

    // Completing the aborted request must not poison the next view's cache.
    resolveFirst?.({
      ok: true,
      json: () => Promise.resolve({
        nodes: [product("stale")],
        hasNextPage: false,
        endCursor: null,
        totalCount: 1,
        popularAvailable: true,
      }),
    });

    expect(getMemoryView(buildCatalogViewKey("en", "q=slow"), "q=slow")).toBeNull();
  });

  it("shows a retry control and keeps existing cards when a next-page fetch fails", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500 });

    render(
      <ShopCatalogClient
        initialPage={initialPage()}
        filters={{}}
        onSelectFilters={vi.fn()}
        categories={[]}
        collections={[]}
        tags={[]}
      />,
    );

    triggerSentinel();

    expect(await screen.findByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "a" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "b" })).toBeInTheDocument();
  });

  it("shows the empty state instead of a grid when there are no results", () => {
    render(
      <ShopCatalogClient
        initialPage={initialPage({ nodes: [], hasNextPage: false, endCursor: null, totalCount: 0 })}
        filters={{ q: "no-such-product" }}
        onSelectFilters={vi.fn()}
        categories={[]}
        collections={[]}
        tags={[]}
      />,
    );

    expect(screen.getByText(/no products matched/i)).toBeInTheDocument();
  });

  describe("same-tab restore", () => {
    it("restores a deeper previously-loaded view from the memory cache instead of SSR's first page, with zero fetches", async () => {
      saveView(ownedSnapshot(""));

      render(
        <ShopCatalogClient
          initialPage={initialPage()}
          filters={{}}
          onSelectFilters={vi.fn()}
          categories={[]}
          collections={[]}
          tags={[]}
        />,
      );

      expect(screen.getByRole("heading", { name: "c" })).toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
    });

    it("scrolls the restored anchor card back into view once the cached page has rendered", async () => {
      const scrollTo = vi.fn();
      vi.stubGlobal("scrollTo", scrollTo);
      saveView(
        ownedSnapshot("", {
          nodes: [product("a"), product("b")],
          endCursor: "cursor-1",
          hasNextPage: true,
          totalCount: 3,
          anchor: { productId: "b", offsetPx: 40 },
        }),
      );

      render(
        <ShopCatalogClient
          initialPage={initialPage()}
          filters={{}}
          onSelectFilters={vi.fn()}
          categories={[]}
          collections={[]}
          tags={[]}
        />,
      );

      await waitFor(() => expect(scrollTo).toHaveBeenCalled());
    });

    it("does not let the sentinel fire a page load while an anchor restore is pending", async () => {
      saveView(
        ownedSnapshot("", {
          nodes: [product("a")],
          endCursor: "cursor-1",
          hasNextPage: true,
          totalCount: 3,
          anchor: { productId: "a", offsetPx: 0 },
        }),
      );

      render(
        <ShopCatalogClient
          initialPage={initialPage()}
          filters={{}}
          onSelectFilters={vi.fn()}
          categories={[]}
          collections={[]}
          tags={[]}
        />,
      );

      triggerSentinel();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fetch).not.toHaveBeenCalled();
    });

    it("scroll during a filter remount cannot write unfiltered nodes under the new key", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {}), // never resolves — list not applied yet
      );

      const { unmount } = render(
        <ShopCatalogClient
          key="en|"
          initialPage={initialPage()}
          filters={{}}
          onSelectFilters={vi.fn()}
          categories={[]}
          collections={[]}
          tags={[]}
        />,
      );

      // Unmount flushes persist for the OLD view (owned). Then mount Ring with no seed.
      unmount();
      render(
        <ShopCatalogClient
          key="en|productType=Ring"
          initialPage={null}
          filters={{ productType: "Ring" }}
          onSelectFilters={vi.fn()}
          categories={[]}
          collections={[]}
          tags={[]}
        />,
      );

      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });
      await act(async () => {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      });

      // Ring key must stay empty until a legitimate owned save lands.
      expect(getMemoryView(buildCatalogViewKey("en", "productType=Ring"), "productType=Ring")).toBeNull();
      // Unfiltered view may still be cached from the previous mount's flush.
      expect(getMemoryView(buildCatalogViewKey("en", ""), "")?.nodes.map((n) => n.id)).toEqual(["a", "b"]);
    });
  });
});

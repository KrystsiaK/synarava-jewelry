import { act, render, screen, waitFor } from "@testing-library/react";
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
    departmentSlug: null,
    departmentName: "",
    categorySlug: null,
    categoryName: "",
    productType: "",
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

describe("ShopCatalogClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
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
        nodes: [product("b"), product("c")], // "b" overlaps the first page on purpose
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

  it("resets to a fresh first page when filters change, discarding stale pages", async () => {
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

    const { rerender } = render(
      <ShopCatalogClient
        initialPage={initialPage()}
        filters={{}}
        onSelectFilters={vi.fn()}
        categories={[]}
        collections={[]}
        tags={[]}
      />,
    );

    rerender(
      <ShopCatalogClient
        initialPage={initialPage()}
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
});

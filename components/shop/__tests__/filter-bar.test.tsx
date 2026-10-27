import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterBar } from "../filter-bar";
import { buildSearchParams, FILTERS_STORAGE_KEY, type ShopFilters } from "../types";

const historyReplace = vi.spyOn(window.history, "replaceState");

const categories = [{ value: "bracelets", label: "Bracelets" }];
const collections = [{ value: "heritage", label: "Heritage" }];
const tags = [{ value: "oak", label: "Oak Wood" }];
const defaultProps = {
  categories,
  collections,
  tags,
  initialFilters: {} as ShopFilters,
  totalCount: 12,
};

function setShopUrl(basePath: string, filters: ShopFilters = {}) {
  const qs = buildSearchParams({ ...filters, sort: filters.sort ?? "featured" });
  const href = qs ? `/en${basePath}?${qs}` : `/en${basePath}`;
  window.history.replaceState(window.history.state, "", href);
  historyReplace.mockClear();
}

function expectHref(href: string) {
  expect(historyReplace.mock.calls.some((call) => call[2] === href)).toBe(true);
}

beforeEach(() => {
  sessionStorage.clear();
  setShopUrl("/shop");
  vi.useRealTimers();
});

describe("FilterBar", () => {
  it("updates filters without asking Next.js for a new server render", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(<FilterBar {...defaultProps} onFiltersChange={onFiltersChange} />);

    await user.click(screen.getByRole("button", { name: /^category$/i }));
    await user.click(screen.getByRole("option", { name: "Bracelets" }));

    await waitFor(() =>
      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ category: "bracelets", sort: "featured" }),
      ),
    );
    expectHref("/en/shop?category=bracelets");
  });

  it("keeps primary filters visible and progressively reveals contextual filters", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByRole("button", { name: /^category$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^availability$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^collection$/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /more filters/i }));
    expect(screen.getByRole("button", { name: /^collection$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^tag$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^compliance$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^material$/i })).toBeInTheDocument();
  });

  it("renders result count", () => {
    render(<FilterBar {...defaultProps} totalCount={7} />);
    expect(screen.getAllByText(/7 products/i).length).toBeGreaterThan(0);
  });

  it("shows '1 product' for count of 1", () => {
    render(<FilterBar {...defaultProps} totalCount={1} />);
    expect(screen.getAllByText(/1 product/i).length).toBeGreaterThan(0);
  });

  it("renders search input", () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.getAllByPlaceholderText(/search/i).length).toBeGreaterThan(0);
  });

  it("updates the URL when a category is selected", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /^category$/i }));
    await user.click(screen.getByRole("option", { name: "Bracelets" }));
    await waitFor(() => expectHref("/en/shop?category=bracelets"));
  });

  it("does not write filters to sessionStorage (site adapter is URL-only)", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /^category$/i }));
    await user.click(screen.getByRole("option", { name: "Bracelets" }));
    await waitFor(() => expectHref("/en/shop?category=bracelets"));
    expect(sessionStorage.getItem(FILTERS_STORAGE_KEY)).toBeNull();
  });

  it("shows active filter chip when initialFilters has values", () => {
    setShopUrl("/shop", { category: "bracelets" });
    render(<FilterBar {...defaultProps} initialFilters={{ category: "bracelets" }} />);
    expect(screen.getByTestId("filter-chips")).toBeInTheDocument();
    expect(screen.getAllByText("Bracelets").length).toBeGreaterThanOrEqual(1);
  });

  it("removes a filter when chip X is clicked", async () => {
    const user = userEvent.setup();
    setShopUrl("/shop", { category: "bracelets" });
    render(<FilterBar {...defaultProps} initialFilters={{ category: "bracelets" }} />);
    await user.click(screen.getByRole("button", { name: /remove filter bracelets/i }));
    await waitFor(() => expectHref("/en/shop"));
  });

  it("shows Clear all chip when multiple filters are active", () => {
    setShopUrl("/shop", { category: "bracelets", tag: "oak" });
    render(<FilterBar {...defaultProps} initialFilters={{ category: "bracelets", tag: "oak" }} />);
    expect(screen.getByRole("button", { name: /^clear all$/i })).toBeInTheDocument();
  });

  it("does not show Clear all when only one filter active", () => {
    setShopUrl("/shop", { category: "bracelets" });
    render(<FilterBar {...defaultProps} initialFilters={{ category: "bracelets" }} />);
    expect(screen.queryByRole("button", { name: /^clear all$/i })).not.toBeInTheDocument();
  });

  it("clears legacy sessionStorage when Clear all is clicked", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({ category: "bracelets" }));
    setShopUrl("/shop", { category: "bracelets", tag: "oak" });
    render(<FilterBar {...defaultProps} initialFilters={{ category: "bracelets", tag: "oak" }} />);
    await user.click(screen.getByRole("button", { name: /^clear all$/i }));
    await waitFor(() => expect(sessionStorage.getItem(FILTERS_STORAGE_KEY)).toBeNull());
  });

  it("updates the URL to /shop when Clear all is clicked", async () => {
    const user = userEvent.setup();
    setShopUrl("/shop", { category: "bracelets", tag: "oak" });
    render(<FilterBar {...defaultProps} initialFilters={{ category: "bracelets", tag: "oak" }} />);
    await user.click(screen.getByRole("button", { name: /^clear all$/i }));
    await waitFor(() => expectHref("/en/shop"));
  });

  it("updates the URL with the search query after debounce", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} />);
    const inputs = screen.getAllByPlaceholderText(/search/i);
    await user.type(inputs[0], "oak");
    await waitFor(() => expectHref("/en/shop?q=oak"), { timeout: 1000 });
  });

  it("clears search and navigates on X button click", async () => {
    const user = userEvent.setup();
    setShopUrl("/shop", { q: "oak" });
    render(<FilterBar {...defaultProps} initialFilters={{ q: "oak" }} />);
    const clearBtns = screen.getAllByRole("button", { name: /clear search/i });
    await user.click(clearBtns[0]);
    await waitFor(() => expectHref("/en/shop"));
  });

  it("hides the WebKit native search cancel so only the custom clear control shows", () => {
    setShopUrl("/shop", { q: "ажурный полумесяц" });
    render(<FilterBar {...defaultProps} initialFilters={{ q: "ажурный полумесяц" }} />);
    const inputs = screen.getAllByDisplayValue(/ажурный полумесяц/i);
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) {
      expect(input).toHaveAttribute("type", "search");
      expect(input.className).toContain("webkit-search-cancel-button");
      expect(input.className).toContain("appearance-none");
    }
    expect(screen.getAllByRole("button", { name: /clear search/i })).toHaveLength(2);
  });

  it("styles desktop search as a boxed control, not an underline stacked on the band edge", () => {
    setShopUrl("/shop", { q: "ыва" });
    render(<FilterBar {...defaultProps} initialFilters={{ q: "ыва" }} />);
    const wrap = screen.getAllByDisplayValue(/ыва/i)[0]?.parentElement;
    expect(wrap).toBeTruthy();
    expect(wrap!.className.split(/\s+/)).toContain("border");
    expect(wrap!.className.split(/\s+/)).not.toContain("border-b");
    expect(wrap!.className).toContain("bg-surface");
  });

  it("does not show a session restore banner (site adapter is URL-only)", async () => {
    sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({ category: "bracelets" }));
    render(<FilterBar {...defaultProps} initialFilters={{}} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("button", { name: /apply filters/i })).not.toBeInTheDocument();
  });

  it("opens mobile filter sheet when Filters button is clicked", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /^filters/i }));
    const dialog = screen.getByRole("dialog", { name: /refine products/i });
    expect(dialog).toBeInTheDocument();
    await waitFor(() => expect(dialog).toHaveAttribute("data-open", "true"));
  });

  it("closes mobile sheet when X button is clicked", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /^filters/i }));
    await user.click(screen.getByRole("button", { name: /close filters/i }));
    expect(screen.getByRole("dialog")).toHaveAttribute("data-open", "false");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("applies filters from mobile sheet and navigates", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /^filters/i }));
    const sheet = screen.getByRole("dialog");
    const allBtns = Array.from(sheet.querySelectorAll("button"));
    const braceletOpt = allBtns.find((b) => b.textContent?.includes("Bracelets"));
    if (braceletOpt) await user.click(braceletOpt);
    await user.click(screen.getByRole("button", { name: /view products/i }));
    await waitFor(() =>
      expect(historyReplace.mock.calls.some((call) => String(call[2]).includes("bracelets"))).toBe(true),
    );
  });

  it("resets all filters from mobile sheet", async () => {
    const user = userEvent.setup();
    setShopUrl("/shop", { category: "bracelets" });
    render(<FilterBar {...defaultProps} initialFilters={{ category: "bracelets" }} />);
    await user.click(screen.getByRole("button", { name: /^filters/i }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^clear all$/i }));
    await user.click(within(dialog).getByRole("button", { name: /view all products/i }));
    await waitFor(() => expectHref("/en/shop"));
  });

  it("can deselect a filter section via All button in mobile sheet", async () => {
    const user = userEvent.setup();
    setShopUrl("/shop", { category: "bracelets" });
    render(<FilterBar {...defaultProps} initialFilters={{ category: "bracelets" }} />);
    await user.click(screen.getByRole("button", { name: /^filters/i }));
    const dialog = screen.getByRole("dialog");
    const allBtns = within(dialog).getAllByRole("button", { name: "All" });
    await user.click(allBtns[0]);
    await user.click(within(dialog).getByRole("button", { name: /view all products/i }));
    await waitFor(() => expect(historyReplace).toHaveBeenCalled());
  });

  it("includes the active filter count in the mobile Filters button", () => {
    setShopUrl("/shop", { category: "bracelets", tag: "oak" });
    render(
      <FilterBar {...defaultProps} initialFilters={{ category: "bracelets", tag: "oak" }} />,
    );
    expect(screen.getByRole("button", { name: /filters, 2 active/i })).toBeInTheDocument();
    expect(screen.getByText("2 active")).toBeInTheDocument();
  });

  it("pins collection filters to the collection path instead of /shop", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    setShopUrl("/collections/heritage", { collection: "heritage" });
    render(
      <FilterBar
        {...defaultProps}
        basePath="/collections/heritage"
        pinnedFilters={{ collection: "heritage" }}
        initialFilters={{ collection: "heritage" }}
        onFiltersChange={onFiltersChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /more filters/i }));
    expect(screen.queryByRole("button", { name: /^collection$/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^category$/i }));
    await user.click(screen.getByRole("option", { name: "Bracelets" }));

    await waitFor(() =>
      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ category: "bracelets", collection: "heritage" }),
      ),
    );
    expectHref("/en/collections/heritage?category=bracelets");
  });
});

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterBar } from "../filter-bar";
import { FILTERS_STORAGE_KEY } from "../types";

const historyPush = vi.spyOn(window.history, "pushState");

const categories = [{ value: "bracelets", label: "Bracelets" }];
const collections = [{ value: "heritage", label: "Heritage" }];
const tags = [{ value: "oak", label: "Oak Wood" }];
const defaultProps = {
  categories,
  collections,
  tags,
  initialFilters: {},
  totalCount: 12,
};

beforeEach(() => {
  historyPush.mockClear();
  sessionStorage.clear();
  vi.useRealTimers();
});

// ── Rendering ────────────────────────────────────────────────────────────────

describe("FilterBar", () => {
  it("updates filters without asking Next.js for a new server render", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(<FilterBar {...defaultProps} onFiltersChange={onFiltersChange} />);

    await user.click(screen.getByRole("button", { name: /^category$/i }));
    await user.click(screen.getByRole("option", { name: "Bracelets" }));

    expect(onFiltersChange).toHaveBeenCalledWith({ category: "bracelets" });
    expect(historyPush).toHaveBeenCalledWith(null, "", "/en/shop?category=bracelets");
  });

  it("keeps primary filters visible and progressively reveals contextual filters", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByRole("button", { name: /^category$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^availability$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^collection$/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /more filters/i }));
    expect(screen.getByRole("button", { name: /^collection$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^tag$/i })).toBeInTheDocument();
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

  // ── Desktop filter selection ──────────────────────────────────────────────

  it("updates the URL when a category is selected", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /^category$/i }));
    await user.click(screen.getByRole("option", { name: "Bracelets" }));
    await waitFor(() => expect(historyPush).toHaveBeenCalledWith(null, "", "/en/shop?category=bracelets"));
  });

  it("saves filters to sessionStorage on selection", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /^category$/i }));
    await user.click(screen.getByRole("option", { name: "Bracelets" }));
    await waitFor(() => {
      const stored = JSON.parse(sessionStorage.getItem(FILTERS_STORAGE_KEY) ?? "{}");
      expect(stored.category).toBe("bracelets");
    });
  });

  // ── Active filter chips ───────────────────────────────────────────────────

  it("shows active filter chip when initialFilters has values", () => {
    render(<FilterBar {...defaultProps} initialFilters={{ category: "bracelets" }} />);
    expect(screen.getByTestId("filter-chips")).toBeInTheDocument();
    expect(screen.getAllByText("Bracelets").length).toBeGreaterThanOrEqual(1);
  });

  it("removes a filter when chip X is clicked", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} initialFilters={{ category: "bracelets" }} />);
    await user.click(screen.getByRole("button", { name: /remove filter bracelets/i }));
    await waitFor(() => expect(historyPush).toHaveBeenCalledWith(null, "", "/en/shop"));
  });

  // ── Clear all ─────────────────────────────────────────────────────────────

  it("shows Clear all chip when multiple filters are active", () => {
    render(<FilterBar {...defaultProps} initialFilters={{ category: "bracelets", tag: "oak" }} />);
    expect(screen.getByRole("button", { name: /^clear all$/i })).toBeInTheDocument();
  });

  it("does not show Clear all when only one filter active", () => {
    render(<FilterBar {...defaultProps} initialFilters={{ category: "bracelets" }} />);
    expect(screen.queryByRole("button", { name: /^clear all$/i })).not.toBeInTheDocument();
  });

  it("clears sessionStorage when Clear all is clicked", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({ category: "bracelets" }));
    render(<FilterBar {...defaultProps} initialFilters={{ category: "bracelets", tag: "oak" }} />);
    await user.click(screen.getByRole("button", { name: /^clear all$/i }));
    await waitFor(() => expect(sessionStorage.getItem(FILTERS_STORAGE_KEY)).toBeNull());
  });

  it("updates the URL to /shop when Clear all is clicked", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} initialFilters={{ category: "bracelets", tag: "oak" }} />);
    await user.click(screen.getByRole("button", { name: /^clear all$/i }));
    await waitFor(() => expect(historyPush).toHaveBeenCalledWith(null, "", "/en/shop"));
  });

  // ── Search debounce ───────────────────────────────────────────────────────

  it("updates the URL with the search query after debounce", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} />);
    const inputs = screen.getAllByPlaceholderText(/search/i);
    await user.type(inputs[0], "oak");
    // Debounce is 350ms — waitFor polls until it passes or times out at 1s
    await waitFor(() => expect(historyPush).toHaveBeenCalledWith(null, "", "/en/shop?q=oak"), { timeout: 1000 });
  });

  it("clears search and navigates on X button click", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} initialFilters={{ q: "oak" }} />);
    // Both desktop and mobile bars render a clear button; click the first
    const clearBtns = screen.getAllByRole("button", { name: /clear search/i });
    await user.click(clearBtns[0]);
    await waitFor(() => expect(historyPush).toHaveBeenCalledWith(null, "", "/en/shop"));
  });

  // ── Session persistence ───────────────────────────────────────────────────

  it("shows restore banner when saved filters exist and URL has no params", async () => {
    sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({ category: "bracelets" }));
    render(<FilterBar {...defaultProps} initialFilters={{}} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /apply filters/i })).toBeInTheDocument(),
    );
  });

  it("does not restore from session when URL params are present", async () => {
    sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({ category: "bracelets" }));
    render(<FilterBar {...defaultProps} initialFilters={{ collection: "heritage" }} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(historyPush).not.toHaveBeenCalled();
  });

  // ── Mobile sheet ──────────────────────────────────────────────────────────

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
    // Select "Bracelets" inside the sheet
    const sheet = screen.getByRole("dialog");
    // Find the Bracelets option button inside the sheet
    const allBtns = Array.from(sheet.querySelectorAll("button"));
    const braceletOpt = allBtns.find((b) => b.textContent?.includes("Bracelets"));
    if (braceletOpt) await user.click(braceletOpt);
    await user.click(screen.getByRole("button", { name: /view products/i }));
    await waitFor(() =>
      expect(historyPush).toHaveBeenCalledWith(null, "", expect.stringContaining("bracelets")),
    );
  });

  it("resets all filters from mobile sheet", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} initialFilters={{ category: "bracelets" }} />);
    await user.click(screen.getByRole("button", { name: /^filters/i }));
    const dialog = screen.getByRole("dialog");
    // Clear all in the sheet header, then confirm via CTA.
    await user.click(within(dialog).getByRole("button", { name: /^clear all$/i }));
    await user.click(within(dialog).getByRole("button", { name: /view all products/i }));
    await waitFor(() => expect(historyPush).toHaveBeenCalledWith(null, "", "/en/shop"));
  });

  it("can deselect a filter section via All button in mobile sheet", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} initialFilters={{ category: "bracelets" }} />);
    await user.click(screen.getByRole("button", { name: /^filters/i }));
    const dialog = screen.getByRole("dialog");
    // Category is the first section; click its "All" button.
    const allBtns = within(dialog).getAllByRole("button", { name: "All" });
    await user.click(allBtns[0]);
    await user.click(within(dialog).getByRole("button", { name: /view all products/i }));
    await waitFor(() => expect(historyPush).toHaveBeenCalled());
  });

  it("includes the active filter count in the mobile Filters button", () => {
    render(
      <FilterBar {...defaultProps} initialFilters={{ category: "bracelets", tag: "oak" }} />,
    );
    expect(screen.getByRole("button", { name: /filters, 2 active/i })).toBeInTheDocument();
    expect(screen.getByText("2 active")).toBeInTheDocument();
  });

  it("pins collection filters to the collection path instead of /shop", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
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

    expect(onFiltersChange).toHaveBeenCalledWith({ category: "bracelets", collection: "heritage" });
    expect(historyPush).toHaveBeenCalledWith(null, "", "/en/collections/heritage?category=bracelets");
  });
});

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterBar } from "../filter-bar";
import { FILTERS_STORAGE_KEY } from "../types";

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: vi.fn(),
    back: vi.fn(),
  })),
}));

const categories = [{ value: "bracelets", label: "Bracelets" }];
const departments = [{ value: "jewelry", label: "Jewelry" }];
const collections = [{ value: "heritage", label: "Heritage" }];
const tags = [{ value: "oak", label: "Oak Wood" }];
const noScroll = { scroll: false };

const defaultProps = {
  departments,
  categories,
  collections,
  tags,
  initialFilters: {},
  totalCount: 12,
};

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  sessionStorage.clear();
  vi.useRealTimers();
});

// ── Rendering ────────────────────────────────────────────────────────────────

describe("FilterBar", () => {
  it("keeps primary filters visible and progressively reveals contextual filters", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByRole("button", { name: /^department$/i })).toBeInTheDocument();
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

  it("navigates when a category is selected", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /^category$/i }));
    await user.click(screen.getByRole("option", { name: "Bracelets" }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/shop?category=bracelets", noScroll));
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
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/shop", noScroll));
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

  it("navigates to /shop when Clear all is clicked", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} initialFilters={{ category: "bracelets", tag: "oak" }} />);
    await user.click(screen.getByRole("button", { name: /^clear all$/i }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/shop", noScroll));
  });

  // ── Search debounce ───────────────────────────────────────────────────────

  it("navigates with search query after debounce", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} />);
    const inputs = screen.getAllByPlaceholderText(/search/i);
    await user.type(inputs[0], "oak");
    // Debounce is 350ms — waitFor polls until it passes or times out at 1s
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/shop?q=oak", noScroll), { timeout: 1000 });
  });

  it("clears search and navigates on X button click", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} initialFilters={{ q: "oak" }} />);
    // Both desktop and mobile bars render a clear button; click the first
    const clearBtns = screen.getAllByRole("button", { name: /clear search/i });
    await user.click(clearBtns[0]);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/shop", noScroll));
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
    expect(mockReplace).not.toHaveBeenCalled();
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
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("bracelets"), noScroll),
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
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/shop", noScroll));
  });

  it("can deselect a filter section via All button in mobile sheet", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} initialFilters={{ category: "bracelets" }} />);
    await user.click(screen.getByRole("button", { name: /^filters/i }));
    const dialog = screen.getByRole("dialog");
    // Department is the first section; click "All" in the Category section.
    const allBtns = within(dialog).getAllByRole("button", { name: "All" });
    await user.click(allBtns[1]);
    await user.click(within(dialog).getByRole("button", { name: /view all products/i }));
    await waitFor(() => expect(mockPush).toHaveBeenCalled());
  });

  it("shows active filter count badge on mobile Filters button", () => {
    render(
      <FilterBar {...defaultProps} initialFilters={{ category: "bracelets", tag: "oak" }} />,
    );
    // The badge shows the count of active filters
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});

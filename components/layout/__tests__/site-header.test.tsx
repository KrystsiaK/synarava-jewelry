import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { DEFAULT_HEADER_NAV_ITEMS } from "@/lib/content/header-nav-fields";
import { SiteHeader } from "../site-header";

const defaultHeaderNav = { items: DEFAULT_HEADER_NAV_ITEMS, labels: {} };

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider initialPreference="light">{children}</ThemeProvider>;
}

function renderHeader(count: number | null = 0) {
  return render(
    <SiteHeader initialCartCount={count} headerNav={defaultHeaderNav} />,
    { wrapper: Wrapper },
  );
}

const mockUsePathname = usePathname as ReturnType<typeof vi.fn>;

describe("SiteHeader", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/");
  });

  it("renders SYNARAVA wordmark", () => {
    renderHeader();
    expect(screen.getByText("SYNARAVA")).toBeInTheDocument();
  });

  it("wordmark links to home", () => {
    renderHeader();
    expect(screen.getByRole("link", { name: "SYNARAVA" })).toHaveAttribute("href", "/en");
  });

  it("renders desktop nav links", () => {
    renderHeader();
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Shop" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Collections" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "About" })).toBeInTheDocument();
  });

  it("renders custom header nav labels and paths", () => {
    render(
      <SiteHeader
        initialCartCount={0}
        headerNav={{
          items: [
            { id: "home", href: "/" },
            { id: "custom", href: "/care" },
          ],
          labels: { en: { custom: "Care guide" } },
        }}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByRole("link", { name: "Care guide" })).toHaveAttribute("href", "/en/care");
  });

  it("renders Login link", () => {
    renderHeader();
    expect(screen.getAllByRole("link", { name: "Login" }).length).toBeGreaterThan(0);
  });

  it("shows badge 1 after add (server count)", () => {
    renderHeader(1);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows badge 2 after add twice (server count)", () => {
    renderHeader(2);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("increase/decrease follow the server count", async () => {
    const { rerender } = renderHeader(1);
    expect(screen.getByText("1")).toBeInTheDocument();

    rerender(<SiteHeader initialCartCount={2} headerNav={defaultHeaderNav} />);
    await waitFor(() => expect(screen.getByText("2")).toBeInTheDocument());

    rerender(<SiteHeader initialCartCount={1} headerNav={defaultHeaderNav} />);
    await waitFor(() => expect(screen.getByText("1")).toBeInTheDocument());
  });

  it("hides the badge after removing the last item (count 0)", async () => {
    const { rerender } = renderHeader(1);
    expect(screen.getByText("1")).toBeInTheDocument();

    rerender(<SiteHeader initialCartCount={0} headerNav={defaultHeaderNav} />);
    await waitFor(() => {
      expect(screen.queryByText("1")).not.toBeInTheDocument();
      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });
  });

  it("shows badge 1 after removing one of two items", async () => {
    const { rerender } = renderHeader(2);
    expect(screen.getByText("2")).toBeInTheDocument();

    rerender(<SiteHeader initialCartCount={1} headerNav={defaultHeaderNav} />);
    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.queryByText("2")).not.toBeInTheDocument();
    });
  });

  it("hides the badge when Shopify is unavailable (null)", () => {
    renderHeader(null);
    expect(screen.getByRole("link", { name: "Cart" })).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("opens mobile menu on hamburger click", async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole("button", { name: "Open navigation menu" }));
    expect(screen.getByRole("button", { name: "Close navigation menu" })).toBeInTheDocument();
  });

  it("closes mobile menu on second click", async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole("button", { name: "Open navigation menu" }));
    await user.click(screen.getByRole("button", { name: "Close navigation menu" }));
    expect(screen.getByRole("button", { name: "Open navigation menu" })).toBeInTheDocument();
  });

  it("marks active Home nav link when on /", () => {
    mockUsePathname.mockReturnValue("/");
    renderHeader();
    expect(screen.getByRole("link", { name: "Home" }).className).toContain("text-foreground");
  });

  it("overlays the shop cover instead of reserving a row above it", () => {
    mockUsePathname.mockReturnValue("/pt/shop");
    renderHeader();
    expect(screen.getByRole("banner")).toHaveAttribute("data-overlay", "true");
  });
});

import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { SiteHeader } from "../site-header";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider initialPreference="light">{children}</ThemeProvider>;
}

function renderHeader(count = 0) {
  return render(<SiteHeader initialCartCount={count} />, { wrapper: Wrapper });
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
    expect(screen.getByRole("link", { name: "SYNARAVA" })).toHaveAttribute("href", "/");
  });

  it("renders desktop nav links", () => {
    renderHeader();
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Shop" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Collections" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "About" })).toBeInTheDocument();
  });

  it("renders Login link", () => {
    renderHeader();
    expect(screen.getAllByRole("link", { name: "Login" }).length).toBeGreaterThan(0);
  });

  it("shows cart count badge when cart has items", () => {
    renderHeader(3);
    expect(screen.getByText("3")).toBeInTheDocument();
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

  it("updates cart count on synarava:cart-updated event", async () => {
    renderHeader(0);
    act(() => {
      window.dispatchEvent(new CustomEvent("synarava:cart-updated", { detail: { count: 5 } }));
    });
    expect(await screen.findByText("5")).toBeInTheDocument();
  });

  it("marks active Home nav link when on /", () => {
    mockUsePathname.mockReturnValue("/");
    renderHeader();
    expect(screen.getByRole("link", { name: "Home" }).className).toContain("text-foreground");
  });
});

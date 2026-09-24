import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { DEFAULT_HEADER_NAV_ITEMS } from "@/lib/content/header-nav-fields";
import { SiteFooter } from "../site-footer";

const defaultHeaderNav = { items: DEFAULT_HEADER_NAV_ITEMS, labels: {} };
const defaultEmail = "synarava.shop@gmail.com";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider initialPreference="light">{children}</ThemeProvider>;
}

function renderFooter(
  props: { headerNav?: typeof defaultHeaderNav; contactEmail?: string } = {},
) {
  return render(
    <SiteFooter
      headerNav={props.headerNav ?? defaultHeaderNav}
      contactEmail={props.contactEmail ?? defaultEmail}
    />,
    { wrapper: Wrapper },
  );
}

describe("SiteFooter", () => {
  it("renders brand name", () => {
    renderFooter();
    expect(screen.getByText(/© 2026 Synarava/)).toBeInTheDocument();
  });

  it("renders Navigation section header", () => {
    renderFooter();
    expect(screen.getByText("Navigation")).toBeInTheDocument();
  });

  it("renders Service section header", () => {
    renderFooter();
    expect(screen.getByText("Service")).toBeInTheDocument();
  });

  it("renders Shop link from header nav (skips home)", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/en/shop");
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
  });

  it("renders Collections link", () => {
    renderFooter();
    const links = screen.getAllByRole("link", { name: "Collections" });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/en/collections");
  });

  it("mirrors custom header nav labels and paths in the navigation column", () => {
    renderFooter({
      headerNav: {
        items: [
          { id: "home", href: "/" },
          { id: "care", href: "/care" },
          { id: "shop", href: "/shop" },
        ],
        labels: { en: { care: "Care desk" } },
      },
    });
    expect(screen.getByRole("link", { name: "Care desk" })).toHaveAttribute("href", "/en/care");
    expect(screen.getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/en/shop");
  });

  it("does not render a separate Manifesto navigation link", () => {
    renderFooter();
    expect(screen.queryByRole("link", { name: "Manifesto" })).not.toBeInTheDocument();
  });

  it("renders contact email link from props", () => {
    renderFooter({ contactEmail: "hello@synarava.com" });
    expect(screen.getByRole("link", { name: "Contact: hello@synarava.com" })).toHaveAttribute(
      "href",
      "mailto:hello@synarava.com",
    );
  });

  it("always exposes cookie settings", () => {
    renderFooter();
    expect(screen.getByRole("button", { name: "Cookie settings" })).toBeInTheDocument();
  });
});

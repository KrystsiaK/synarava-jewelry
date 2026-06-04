import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { SiteFooter } from "../site-footer";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider initialPreference="light">{children}</ThemeProvider>;
}

function renderFooter() {
  return render(<SiteFooter />, { wrapper: Wrapper });
}

describe("SiteFooter", () => {
  it("renders brand name", () => {
    renderFooter();
    expect(screen.getByText(/Synarava Jewelry/)).toBeInTheDocument();
  });

  it("renders Navigation section header", () => {
    renderFooter();
    expect(screen.getByText("Navigation")).toBeInTheDocument();
  });

  it("renders Service section header", () => {
    renderFooter();
    expect(screen.getByText("Service")).toBeInTheDocument();
  });

  it("renders Shop link", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/shop");
  });

  it("renders Collections link", () => {
    renderFooter();
    const links = screen.getAllByRole("link", { name: "Collections" });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/collections");
  });

  it("renders Manifesto link", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "Manifesto" })).toHaveAttribute("href", "/about/manifesto");
  });

  it("renders contact email link", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "mailto:studio@synarava.com");
  });
});

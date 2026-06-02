import { render, screen } from "@testing-library/react";
import { SiteFooter } from "../site-footer";

describe("SiteFooter", () => {
  it("renders brand name", () => {
    render(<SiteFooter />);
    expect(screen.getByText(/Synarava Jewelry/)).toBeInTheDocument();
  });

  it("renders Navigation section header", () => {
    render(<SiteFooter />);
    expect(screen.getByText("Navigation")).toBeInTheDocument();
  });

  it("renders Service section header", () => {
    render(<SiteFooter />);
    expect(screen.getByText("Service")).toBeInTheDocument();
  });

  it("renders Shop link", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/shop");
  });

  it("renders Collections link", () => {
    render(<SiteFooter />);
    const links = screen.getAllByRole("link", { name: "Collections" });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/collections");
  });

  it("renders Manifesto link", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "Manifesto" })).toHaveAttribute("href", "/about/manifesto");
  });

  it("renders contact email link", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "mailto:studio@synarava.com");
  });
});

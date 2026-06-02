import { render, screen } from "@testing-library/react";
import { EditorialHeading } from "../editorial-heading";

describe("EditorialHeading", () => {
  it("renders children", () => {
    render(<EditorialHeading>Hands of the Artisan</EditorialHeading>);
    expect(screen.getByText("Hands of the Artisan")).toBeInTheDocument();
  });

  it("renders as h2", () => {
    render(<EditorialHeading>Hands of the Artisan</EditorialHeading>);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  it("applies serif font class", () => {
    render(<EditorialHeading>Hands of the Artisan</EditorialHeading>);
    expect(screen.getByText("Hands of the Artisan")).toHaveClass("font-serif");
  });

  it("merges custom className", () => {
    render(<EditorialHeading className="mb-8">Hands of the Artisan</EditorialHeading>);
    expect(screen.getByText("Hands of the Artisan")).toHaveClass("mb-8");
  });
});

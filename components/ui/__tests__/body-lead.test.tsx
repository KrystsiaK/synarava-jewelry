import { render, screen } from "@testing-library/react";
import { BodyLead } from "../body-lead";

describe("BodyLead", () => {
  it("renders children", () => {
    render(<BodyLead>Handcrafted jewelry</BodyLead>);
    expect(screen.getByText("Handcrafted jewelry")).toBeInTheDocument();
  });

  it("renders as paragraph", () => {
    render(<BodyLead>Handcrafted jewelry</BodyLead>);
    expect(screen.getByText("Handcrafted jewelry").tagName).toBe("P");
  });

  it("includes base typography classes", () => {
    render(<BodyLead>Handcrafted jewelry</BodyLead>);
    const el = screen.getByText("Handcrafted jewelry");
    expect(el.className).toContain("text-lg");
  });

  it("merges custom className", () => {
    render(<BodyLead className="mt-8">Handcrafted jewelry</BodyLead>);
    expect(screen.getByText("Handcrafted jewelry")).toHaveClass("mt-8");
  });
});

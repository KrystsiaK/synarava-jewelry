import { render, screen } from "@testing-library/react";
import { CapsLabel } from "../caps-label";

describe("CapsLabel", () => {
  it("renders children", () => {
    render(<CapsLabel>Material</CapsLabel>);
    expect(screen.getByText("Material")).toBeInTheDocument();
  });

  it("applies label-caps class", () => {
    render(<CapsLabel>Material</CapsLabel>);
    expect(screen.getByText("Material")).toHaveClass("label-caps");
  });

  it("merges custom className", () => {
    render(<CapsLabel className="text-accent">Material</CapsLabel>);
    const el = screen.getByText("Material");
    expect(el).toHaveClass("label-caps");
    expect(el).toHaveClass("text-accent");
  });

  it("renders as span", () => {
    render(<CapsLabel>Material</CapsLabel>);
    expect(screen.getByText("Material").tagName).toBe("SPAN");
  });
});

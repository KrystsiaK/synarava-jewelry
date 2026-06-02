import { render } from "@testing-library/react";
import { DividerOrnament } from "../divider-ornament";

describe("DividerOrnament", () => {
  it("renders without crashing", () => {
    const { container: c } = render(<DividerOrnament />);
    expect(c.firstChild).toBeInTheDocument();
  });

  it("applies embroidery-separator class", () => {
    const { container: c } = render(<DividerOrnament />);
    expect(c.firstChild).toHaveClass("embroidery-separator");
  });

  it("is marked aria-hidden", () => {
    const { container: c } = render(<DividerOrnament />);
    expect(c.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});

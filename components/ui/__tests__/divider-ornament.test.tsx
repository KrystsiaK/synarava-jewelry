import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

  it("pauses the hairline for one accent diamond and does not paint a plaque", () => {
    const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
    const start = css.indexOf(".embroidery-separator {");
    const end = css.indexOf(".legal-markdown {");
    const block = css.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(block).toContain("var(--color-accent)");
    expect(block).not.toContain("var(--color-linen)");
    expect(block).not.toContain("⬥");
    expect(block).not.toContain("❖");
  });
});

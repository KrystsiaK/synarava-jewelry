import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LegalSectionBody } from "@/components/legal/legal-section-body";

describe("legal list markers", () => {
  it("renders policy lists inside the diamond treatment and suppresses the rich-text marker", () => {
    const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
    const discAt = css.indexOf(".rich-text ul {\n  list-style: disc;");
    const decimalAt = css.indexOf(".rich-text ol {\n  list-style: decimal;");
    const overrideAt = css.indexOf(".legal-markdown.rich-text ul,\n.legal-markdown.rich-text ol {\n  list-style: none;");
    const diamondAt = css.indexOf(".legal-markdown li::before {");

    expect(discAt).toBeGreaterThan(-1);
    expect(decimalAt).toBeGreaterThan(discAt);
    expect(overrideAt).toBeGreaterThan(decimalAt);
    expect(diamondAt).toBeGreaterThan(-1);
    expect(diamondAt).toBeLessThan(overrideAt);

    render(<LegalSectionBody content={"<ul><li>Diamond only</li></ul><ol><li>Numbered</li></ol>"} />);

    for (const list of screen.getAllByRole("list")) {
      expect(list.closest(".legal-markdown.rich-text")).not.toBeNull();
    }
    expect(screen.getByText("Diamond only").closest("li")).not.toBeNull();
  });
});

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RichText } from "@/components/content/rich-text";

describe("RichText orphan punctuation glue", () => {
  it("glues middot in plain CMS copy", () => {
    const { container } = render(
      <RichText content="Жемчужный браслет · 8 мм" />,
    );
    expect(container.querySelector("p")?.textContent).toBe(
      "Жемчужный браслет\u00A0· 8 мм",
    );
  });

  it("glues middot inside sanitized HTML text nodes", () => {
    const { container } = render(
      <RichText content="<p>Pearl Bracelet · 8 mm</p>" />,
    );
    // Browsers serialize U+00A0 as &nbsp; in innerHTML.
    expect(container.querySelector(".rich-text")?.innerHTML).toBe(
      "<p>Pearl Bracelet&nbsp;· 8 mm</p>",
    );
  });

  it("preserves newlines while gluing on each line", () => {
    const { container } = render(
      <RichText content={"Line one · A\nLine two – B"} />,
    );
    expect(container.querySelector("p")?.textContent).toBe(
      "Line one\u00A0· A\nLine two\u00A0– B",
    );
  });
});

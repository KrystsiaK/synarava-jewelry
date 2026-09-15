import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ProductHeroDescription } from "../product-hero-description";

describe("ProductHeroDescription", () => {
  it("reveals the complete product story from a truncated hero summary", async () => {
    const user = userEvent.setup();
    const summary = "Swarovski Crystal Pearl Necklace combines luminous white pearls with refined gold-tone details…";
    const description = `${summary.slice(0, -1)} while remaining light and balanced enough for everyday wear.`;

    render(
      <ProductHeroDescription
        summary={summary}
        description={description}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Read full story" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(summary)).toBeInTheDocument();
    expect(screen.queryByText(description)).not.toBeInTheDocument();

    await user.click(toggle);

    expect(screen.getByText(description)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("keeps a complete short description free of disclosure controls", () => {
    const description = "A concise product description.";

    render(
      <ProductHeroDescription
        summary={description}
        description={description}
      />,
    );

    expect(screen.getByText(description)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

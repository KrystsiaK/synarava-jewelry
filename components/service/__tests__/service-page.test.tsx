import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ServicePage } from "@/components/service/service-page";

const props = {
  eyebrow: "Service",
  title: "Care guide",
  intro: "Keep every object at its best.",
  sections: [{ title: "Jewelry", body: "Care instructions." }],
};

describe("ServicePage", () => {
  it("shows the hero image configured for the page", () => {
    render(<ServicePage {...props} heroImage="/care-hero.jpg" />);

    expect(screen.getByTestId("page-hero-image")).toHaveAttribute(
      "src",
      expect.stringContaining("care-hero.jpg"),
    );
  });

  it("does not invent hero media when the page has none", () => {
    render(<ServicePage {...props} />);
    expect(screen.queryByTestId("page-hero-image")).not.toBeInTheDocument();
  });
});

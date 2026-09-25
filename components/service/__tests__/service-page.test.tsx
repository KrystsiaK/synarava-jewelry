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

  it("renders the shared contact CTA with the given mailto", () => {
    render(<ServicePage {...props} contactEmail="hello@synarava.com" />);
    expect(screen.getByTestId("contact-cta")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /contact/i })).toHaveAttribute(
      "href",
      "mailto:hello@synarava.com",
    );
  });

  it("renders safe links inside section bodies", () => {
    render(
      <ServicePage
        {...props}
        sections={[
          {
            title: "RAL",
            body: '<p>Contact <a href="https://www.centroarbitragemlisboa.pt">CACCL</a>.</p>',
          },
        ]}
      />,
    );

    const link = screen.getByRole("link", { name: "CACCL" });
    expect(link).toHaveAttribute("href", "https://www.centroarbitragemlisboa.pt");
  });
});

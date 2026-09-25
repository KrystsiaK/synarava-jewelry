import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ContactCta } from "@/components/shared/contact-cta";

describe("ContactCta", () => {
  it("renders title, body, and mailto CTA", () => {
    render(
      <ContactCta
        title="Need a specific answer?"
        body="Have a question that isn't covered here?"
        ctaLabel="Contact us"
        href="mailto:synarava.shop@gmail.com"
      />,
    );

    expect(screen.getByText("Need a specific answer?")).toBeInTheDocument();
    expect(screen.getByText("Have a question that isn't covered here?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact us" })).toHaveAttribute(
      "href",
      "mailto:synarava.shop@gmail.com",
    );
  });
});

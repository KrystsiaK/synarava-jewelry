import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnnouncementBar } from "@/components/layout/announcement-bar";

describe("AnnouncementBar", () => {
  it("renders nothing when disabled", () => {
    const { container } = render(
      <AnnouncementBar
        enabled={false}
        threshold={{ amount: "45.0", currencyCode: "EUR" }}
        template="Free shipping from {amount}"
        locale="en"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing without a threshold", () => {
    const { container } = render(
      <AnnouncementBar
        enabled
        threshold={null}
        template="Free shipping from {amount}"
        locale="en"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("exposes one real string for SR and duplicates marquee cycle as aria-hidden", () => {
    render(
      <AnnouncementBar
        enabled
        threshold={{ amount: "45.0", currencyCode: "EUR" }}
        template="Free shipping in Portugal from {amount}"
        locale="en"
      />,
    );

    const region = screen.getByRole("region", {
      name: "Free shipping in Portugal from €45.00",
    });
    expect(region).toBeInTheDocument();
    expect(region.querySelector(".announcement-bar__marquee")).toHaveAttribute("aria-hidden", "true");
    expect(region.querySelectorAll(".announcement-bar__cycle span")).toHaveLength(2);
  });
});

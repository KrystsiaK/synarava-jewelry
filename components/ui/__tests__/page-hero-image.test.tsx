import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeroImage } from "@/components/ui/page-hero-image";

describe("PageHeroImage", () => {
  it("renders configured page media as a decorative responsive image", () => {
    render(<PageHeroImage src="/configured.jpg" />);

    const image = screen.getByTestId("page-hero-image");
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("sizes", "100vw");
    expect(image).toHaveAttribute("src", expect.stringContaining("configured.jpg"));
    expect(image.parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("announces configured alt text and drops decorative aria-hidden", () => {
    render(<PageHeroImage src="/configured.jpg" alt="Soft daylight still" />);

    const image = screen.getByTestId("page-hero-image");
    expect(image).toHaveAttribute("alt", "Soft daylight still");
    expect(image.parentElement).not.toHaveAttribute("aria-hidden");
  });

  it("renders nothing without an explicitly configured source", () => {
    const { container } = render(<PageHeroImage />);
    expect(container).toBeEmptyDOMElement();
  });
});

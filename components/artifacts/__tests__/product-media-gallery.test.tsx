import { fireEvent, render, screen, within } from "@testing-library/react";

import { ProductMediaGallery } from "@/components/artifacts/product-media-gallery";

const product = {
  title: "Midnight Duck Bag Charm",
  image: "/duck-primary.jpg",
  commerceMedia: [
    { src: "/duck-primary.jpg", alt: "Duck charm on a black bag", width: 1200, height: 1500 },
    { src: "/duck-detail.jpg", alt: "Pearl and bead detail", width: 1200, height: 1500 },
    { src: "/duck-clasp.jpg", alt: "Gold clasp detail", width: 1200, height: 1500 },
  ],
};

describe("ProductMediaGallery", () => {
  it("shows three directly selectable product images without duplicating the primary image", () => {
    render(<ProductMediaGallery product={product} />);

    const selectors = screen.getAllByRole("button", { name: /Show image/ });
    expect(selectors).toHaveLength(3);
    expect(selectors[0]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Enlarge image 1 of 3/ })).toBeInTheDocument();

    fireEvent.click(selectors[1]);

    expect(selectors[1]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Enlarge image 2 of 3/ })).toBeInTheDocument();
    expect(screen.getByAltText("Pearl and bead detail")).toBeInTheDocument();
  });

  it("opens a focused lightbox and supports next-image navigation", () => {
    render(<ProductMediaGallery product={product} />);

    fireEvent.click(screen.getByRole("button", { name: /Enlarge image 1 of 3/ }));

    const dialog = screen.getByRole("dialog", { name: "Expanded product image" });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next image" }));
    expect(within(dialog).getByText("02 / 03")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close expanded image" }));
    expect(screen.getByRole("dialog", { name: "Expanded product image" })).toHaveClass("is-closing");
  });
});

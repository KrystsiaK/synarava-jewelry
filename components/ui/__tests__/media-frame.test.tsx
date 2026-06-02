import { render, screen } from "@testing-library/react";
import { MediaFrame } from "../media-frame";

describe("MediaFrame", () => {
  const baseProps = { src: "/image.jpg", alt: "Bracelet" };

  it("renders the image with alt text", () => {
    render(<MediaFrame {...baseProps} />);
    expect(screen.getByAltText("Bracelet")).toBeInTheDocument();
    expect(screen.getByAltText("Bracelet")).toHaveAttribute("src", "/image.jpg");
  });

  it("renders as figure element", () => {
    const { container } = render(<MediaFrame {...baseProps} />);
    expect(container.querySelector("figure")).toBeInTheDocument();
  });

  it("renders caption when provided", () => {
    render(<MediaFrame {...baseProps} caption="Oak wood detail" />);
    expect(screen.getByText("Oak wood detail")).toBeInTheDocument();
  });

  it("does not render figcaption when caption is omitted", () => {
    const { container } = render(<MediaFrame {...baseProps} />);
    expect(container.querySelector("figcaption")).not.toBeInTheDocument();
  });

  it("renders mirror overlay when mirror=true", () => {
    const { container } = render(<MediaFrame {...baseProps} mirror />);
    expect(container.querySelector(".mirror-fragment")).toBeInTheDocument();
  });

  it("does not render mirror overlay by default", () => {
    const { container } = render(<MediaFrame {...baseProps} />);
    expect(container.querySelector(".mirror-fragment")).not.toBeInTheDocument();
  });

  it("merges custom className on figure", () => {
    const { container } = render(<MediaFrame {...baseProps} className="aspect-square" />);
    expect(container.querySelector("figure")).toHaveClass("aspect-square");
  });

  it("applies imageClassName to the image", () => {
    render(<MediaFrame {...baseProps} imageClassName="grayscale" />);
    expect(screen.getByAltText("Bracelet")).toHaveClass("grayscale");
  });
});

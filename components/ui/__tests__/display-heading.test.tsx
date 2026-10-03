import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DisplayHeading } from "@/components/ui/display-heading";

describe("DisplayHeading", () => {
  it("keeps Cyrillic words in a mask tall enough for descenders", () => {
    render(<DisplayHeading reveal text="Аксессуары для сумок" />);

    const heading = screen.getByRole("heading", { level: 1, name: "Аксессуары для сумок" });
    expect(heading).toHaveClass("type-display");
    expect(heading.className).not.toMatch(/overflow-hidden/);

    const masks = heading.querySelectorAll(".type-reveal");
    expect(masks).toHaveLength(3);
    for (const mask of masks) {
      expect(mask.className).not.toMatch(/overflow-hidden/);
      expect(mask).toHaveClass("type-reveal");
    }
    expect(screen.getByText("Аксессуары")).toBeInTheDocument();
    expect(screen.getByText("сумок")).toBeInTheDocument();
  });

  it("accents only the last word", () => {
    render(
      <DisplayHeading
        text="Аксессуары для сумок"
        accentClassName="italic text-couture-red"
      />,
    );

    expect(screen.getByText("сумок")).toHaveClass("italic", "text-couture-red");
    expect(screen.getByRole("heading")).not.toHaveClass("italic");
  });

  it("renders custom children inside the same ink box", () => {
    render(
      <DisplayHeading as="h2">
        Hands of the Artisan
      </DisplayHeading>,
    );

    expect(screen.getByRole("heading", { level: 2 })).toHaveClass("type-display", "font-serif");
  });

  it("keeps Latin descenders when callers avoid leading-none", () => {
    render(
      <DisplayHeading
        as="h2"
        text="You may also like"
        className="text-[clamp(2rem,4vw,3.5rem)] leading-[1.12]"
      />,
    );

    const heading = screen.getByRole("heading", { level: 2, name: "You may also like" });
    expect(heading).toHaveClass("type-display", "leading-[1.12]");
    expect(heading.className).not.toMatch(/leading-none/);
  });
});
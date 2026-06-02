import { render, screen } from "@testing-library/react";
import { MonoMeta } from "../mono-meta";

describe("MonoMeta", () => {
  it("renders children", () => {
    render(<MonoMeta>01 / Intro</MonoMeta>);
    expect(screen.getByText("01 / Intro")).toBeInTheDocument();
  });

  it("applies label-mono class", () => {
    render(<MonoMeta>01 / Intro</MonoMeta>);
    expect(screen.getByText("01 / Intro")).toHaveClass("label-mono");
  });

  it("merges custom className", () => {
    render(<MonoMeta className="text-accent">01 / Intro</MonoMeta>);
    const el = screen.getByText("01 / Intro");
    expect(el).toHaveClass("label-mono");
    expect(el).toHaveClass("text-accent");
  });

  it("renders as span", () => {
    render(<MonoMeta>01 / Intro</MonoMeta>);
    expect(screen.getByText("01 / Intro").tagName).toBe("SPAN");
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArtifactButton, ArtifactLink } from "../artifact-button";

describe("ArtifactButton", () => {
  it("renders children", () => {
    render(<ArtifactButton>Explore Archive</ArtifactButton>);
    expect(screen.getByRole("button", { name: "Explore Archive" })).toBeInTheDocument();
  });

  it("applies primary variant by default", () => {
    render(<ArtifactButton>Explore</ArtifactButton>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("bg-[#7f1424]");
    expect(btn).toHaveClass("text-[#fff2f3]");
  });

  it("applies secondary variant classes", () => {
    render(<ArtifactButton variant="secondary">Explore</ArtifactButton>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("border-foreground/28");
  });

  it("applies ghost variant classes", () => {
    render(<ArtifactButton variant="ghost">Explore</ArtifactButton>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("border-b");
    expect(btn.className).not.toContain("bg-foreground");
  });

  it("fires onClick handler", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ArtifactButton onClick={onClick}>Click me</ArtifactButton>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("forwards disabled prop", () => {
    render(<ArtifactButton disabled>Disabled</ArtifactButton>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("merges custom className", () => {
    render(<ArtifactButton className="w-full">Full</ArtifactButton>);
    expect(screen.getByRole("button")).toHaveClass("w-full");
  });
});

describe("ArtifactLink", () => {
  it("renders as anchor with href", () => {
    render(<ArtifactLink href="/shop">Shop</ArtifactLink>);
    const link = screen.getByRole("link", { name: "Shop" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/shop");
  });

  it("applies primary variant by default", () => {
    render(<ArtifactLink href="/shop">Shop</ArtifactLink>);
    expect(screen.getByRole("link")).toHaveClass("bg-[#7f1424]");
  });

  it("applies secondary variant", () => {
    render(<ArtifactLink href="/shop" variant="secondary">Shop</ArtifactLink>);
    expect(screen.getByRole("link")).toHaveClass("border-foreground/28");
  });
});

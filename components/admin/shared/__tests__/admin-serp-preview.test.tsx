import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminSerpPreview } from "@/components/admin/shared/admin-serp-preview";

describe("AdminSerpPreview", () => {
  it("renders title, URL crumbs, description, and soft meters", () => {
    render(
      <AdminSerpPreview
        title="Lava ring"
        description="Handcrafted couture."
        path="/en/products/lava-ring"
        siteHost="synarava.com"
      />,
    );

    expect(screen.getByText("Search preview")).toBeInTheDocument();
    expect(screen.getByText("synarava.com › en › products › lava-ring")).toBeInTheDocument();
    expect(screen.getByText("Lava ring | Synarava")).toBeInTheDocument();
    expect(screen.getByText("Handcrafted couture.")).toBeInTheDocument();
    expect(screen.getByLabelText("Character counts")).toHaveTextContent("Title");
    expect(screen.getByLabelText("Character counts")).toHaveTextContent("20/60");
  });

  it("does not double the brand when the SEO title already ends with Synarava", () => {
    render(
      <AdminSerpPreview
        title="Golden Bird Brooch | Synarava"
        description="Brooch."
        path="/en/products/golden-bird-brooch"
        siteHost="synarava.com"
      />,
    );

    expect(screen.getByText("Golden Bird Brooch | Synarava")).toBeInTheDocument();
    expect(screen.queryByText(/Synarava \| Synarava/)).not.toBeInTheDocument();
  });

  it("marks meters over soft limits", () => {
    render(
      <AdminSerpPreview
        title={"T".repeat(61)}
        description={"D".repeat(161)}
        path="/en"
        siteHost="synarava.com"
      />,
    );

    const meters = screen.getByLabelText("Character counts").querySelectorAll("[data-over]");
    expect([...meters].every((node) => node.getAttribute("data-over") === "true")).toBe(true);
  });
});

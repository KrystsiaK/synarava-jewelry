import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminPanel } from "@/components/synarava-cms";

describe("AdminPanel", () => {
  it("renders a rounded shell with optional sticky header flush to the top radius", () => {
    render(
      <AdminPanel.Root stickyAbove="5.5rem" data-component="TestPanel">
        <AdminPanel.Header sticky stickyBand="locale">
          Locale band
        </AdminPanel.Header>
        <AdminPanel.Body>Body content</AdminPanel.Body>
      </AdminPanel.Root>,
    );

    const root = screen.getByText("Locale band").closest("[data-component='TestPanel']");
    expect(root).toHaveClass("adm-panel");
    expect(root).toHaveStyle({
      "--adm-panel-radius": "0.75rem",
      "--adm-panel-sticky-above": "5.5rem",
    });

    const header = screen.getByText("Locale band").closest("[data-component='AdminPanel.Header']");
    expect(header).toHaveAttribute("data-sticky", "true");
    expect(header).toHaveAttribute("data-sticky-band", "locale");
    expect(header).toHaveClass("adm-panel__header--sticky");
    expect(header).toHaveClass("adm-band");
    expect(header).toHaveClass("adm-band--sticky-radius");
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });
});

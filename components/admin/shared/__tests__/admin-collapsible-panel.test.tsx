import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AdminCollapsiblePanel } from "@/components/synarava-cms";

describe("AdminCollapsiblePanel", () => {
  it("starts collapsed with a single chevron control", () => {
    render(
      <AdminCollapsiblePanel title="Dimensions & fit">
        <p>Body fields</p>
      </AdminCollapsiblePanel>,
    );

    const trigger = screen.getByRole("button", { name: "Dimensions & fit" });
    const panel = trigger.closest("[data-component='AdminCollapsiblePanel']");

    expect(panel).toHaveAttribute("data-open", "false");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/Open fields/i)).not.toBeInTheDocument();
    expect(panel?.querySelectorAll(".adm-collapse__chevron")).toHaveLength(1);
    expect(panel?.querySelector("details")).toBeNull();
  });

  it("expands smoothly and exposes the body region", async () => {
    const user = userEvent.setup();
    render(
      <AdminCollapsiblePanel title="Care">
        <p>Washable field</p>
      </AdminCollapsiblePanel>,
    );

    const trigger = screen.getByRole("button", { name: "Care" });
    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger.closest("[data-component='AdminCollapsiblePanel']")).toHaveAttribute("data-open", "true");
    expect(screen.getByRole("region", { name: "Care" })).toBeInTheDocument();
    expect(screen.getByText("Washable field")).toBeVisible();
  });

  it("honors defaultOpen", () => {
    render(
      <AdminCollapsiblePanel title="Already open" defaultOpen>
        <p>Visible</p>
      </AdminCollapsiblePanel>,
    );

    expect(screen.getByRole("button", { name: "Already open" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Visible")).toBeVisible();
  });
});

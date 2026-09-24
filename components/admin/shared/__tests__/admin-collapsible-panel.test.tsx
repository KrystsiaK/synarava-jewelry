import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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

  it("shows caption via shared AdminFieldWarning under the panel while collapsed", () => {
    render(
      <AdminCollapsiblePanel
        title="Material 02 Untitled"
        tone="warning"
        caption="This specimen won't appear on the site."
      >
        <p>Body</p>
      </AdminCollapsiblePanel>,
    );

    const root = screen.getByRole("button", { name: "Material 02 Untitled" })
      .closest("[data-component='AdminCollapsiblePanel']");
    const card = root?.querySelector(".adm-collapse");
    const warning = screen.getByRole("status");
    expect(root).toHaveAttribute("data-tone", "warning");
    expect(root).toHaveClass("adm-field-unit");
    expect(card).toHaveClass("adm-collapse--warning");
    expect(root).toHaveAttribute("data-open", "false");
    expect(warning).toHaveAttribute("data-component", "AdminFieldWarning");
    expect(warning).toHaveClass("adm-field-warning");
    expect(warning).toHaveTextContent("This specimen won't appear on the site.");
    expect(warning.closest(".adm-collapse")).toBeNull();
    expect(warning.compareDocumentPosition(card!)).toBe(Node.DOCUMENT_POSITION_PRECEDING);
  });

  it("honors controlled open without resetting on parent remount", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <AdminCollapsiblePanel title="Stable" open onOpenChange={onOpenChange}>
        <p>Visible</p>
      </AdminCollapsiblePanel>,
    );

    expect(screen.getByRole("button", { name: "Stable" })).toHaveAttribute("aria-expanded", "true");
    rerender(
      <AdminCollapsiblePanel title="Stable" open onOpenChange={onOpenChange}>
        <p>Visible</p>
      </AdminCollapsiblePanel>,
    );
    expect(screen.getByRole("button", { name: "Stable" })).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps trailing actions outside the toggle button", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <AdminCollapsiblePanel
        title="Row"
        trailing={
          <button type="button" onClick={onRemove}>
            Remove
          </button>
        }
      >
        <p>Body</p>
      </AdminCollapsiblePanel>,
    );

    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Row" })).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps collapsed panel fields in FormData", async () => {
    const user = userEvent.setup();
    let submitted: FormData | null = null;
    render(
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submitted = new FormData(event.currentTarget);
        }}
      >
        <AdminCollapsiblePanel title="Closed section">
          <input name="collapsedField" defaultValue="kept" />
          <input name="collapsedEmail" type="email" defaultValue="not-an-email" />
        </AdminCollapsiblePanel>
        <button type="submit">Go</button>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(submitted?.get("collapsedField")).toBe("kept");
    expect(submitted?.get("collapsedEmail")).toBe("not-an-email");
  });
});

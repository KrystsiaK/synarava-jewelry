import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AdminListWorkspace } from "@/components/synarava-cms";

describe("AdminListWorkspace", () => {
  it("renders a sticky AdminPanel header with full-width ruled edge", () => {
    const { container } = render(
      <AdminListWorkspace.Root>
        <AdminListWorkspace.Header
          tag="[ CURRENT CATALOG ]"
          title="Products list"
          meta="30 of 35"
          actions={<button type="button">New product</button>}
        >
          <AdminListWorkspace.Filters summary="Draft · Rings">
            <label>
              Search
              <input aria-label="Search" />
            </label>
          </AdminListWorkspace.Filters>
        </AdminListWorkspace.Header>
        <AdminListWorkspace.Body>
          <p>Rows</p>
        </AdminListWorkspace.Body>
      </AdminListWorkspace.Root>,
    );

    const root = container.querySelector('[data-component="AdminListWorkspace"]');
    const header = container.querySelector('[data-component="AdminPanel.Header"]');

    expect(root).not.toBeNull();
    expect(header).toHaveAttribute("data-sticky", "true");
    expect(header).toHaveAttribute("data-sticky-band", "list-workspace");
    expect(header).toHaveClass("adm-panel__header--ruled");
    expect(screen.getByRole("heading", { name: "Products list" })).toBeInTheDocument();
    expect(screen.getByText("30 of 35")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New product" })).toBeInTheDocument();
    expect(screen.getByText("Draft · Rings")).toBeInTheDocument();
  });

  it("lets editors collapse the filter chain while keeping the sticky title", async () => {
    const user = userEvent.setup();
    render(
      <AdminListWorkspace.Root>
        <AdminListWorkspace.Header tag="[ LIST ]" title="Items">
          <AdminListWorkspace.Filters defaultOpen>
            <p>Filter fields</p>
            <p>Sort chips</p>
          </AdminListWorkspace.Filters>
        </AdminListWorkspace.Header>
        <AdminListWorkspace.Body>Body</AdminListWorkspace.Body>
      </AdminListWorkspace.Root>,
    );

    const trigger = screen.getByRole("button", { name: /Filters & sort/i });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Filter fields")).toBeVisible();
    expect(screen.getByText("Sort chips")).toBeVisible();

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger.closest("[data-component='AdminCollapsiblePanel']")).toHaveAttribute(
      "data-open",
      "false",
    );
  });
});

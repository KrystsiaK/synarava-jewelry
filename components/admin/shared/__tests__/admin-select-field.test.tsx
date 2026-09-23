import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AdminSelectField } from "@/components/synarava-cms";

describe("AdminSelectField", () => {
  it("shares OwnershipLabel shell and field-group chrome with text fields", async () => {
    const user = userEvent.setup();
    render(
      <AdminSelectField
        id="dept"
        name="department"
        label="Department"
        owner="Synarava"
        error="Pick a department."
        errorId="dept-error"
        defaultValue=""
      >
        <option value="">No department</option>
        <option value="rings">Rings</option>
      </AdminSelectField>,
    );

    const select = screen.getByRole("combobox", { name: /Department/i });
    expect(select).toHaveAttribute("id", "dept");
    expect(select).toHaveClass("adm-field", "adm-field--in-group", "adm-field--select");
    expect(select.closest("[data-slot='control-group']")).toHaveClass(
      "adm-field-group",
      "adm-field-group--error",
    );
    expect(select).toHaveAccessibleErrorMessage("Pick a department.");
    expect(screen.getByText("Synarava")).toBeInTheDocument();

    await user.selectOptions(select, "rings");
    expect(select).toHaveValue("rings");
  });

  it("matches Site state product dropdown contract", () => {
    const { container } = render(
      <AdminSelectField label="Site state" owner="Shopify" name="workflowState" defaultValue="PUBLISHED">
        <option value="DRAFT">Draft — hidden</option>
        <option value="PUBLISHED">Published — visible</option>
        <option value="UNLISTED">Unlisted — direct link only</option>
      </AdminSelectField>,
    );

    const group = container.querySelector("[data-slot='control-group']");
    expect(group).toHaveAttribute("data-control", "select");
    expect(group).toHaveClass("adm-field-group");
    expect(screen.getByRole("combobox", { name: /Site state/i })).toHaveValue("PUBLISHED");
  });
});

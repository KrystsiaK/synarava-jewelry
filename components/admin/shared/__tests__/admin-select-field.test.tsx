import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AdminSelectField } from "@/components/admin/shared/admin-select-field";

describe("AdminSelectField", () => {
  it("shares OwnershipLabel shell and absolute error with text fields", async () => {
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
    expect(select).toHaveClass("adm-field", "adm-field--error");
    expect(select).toHaveAccessibleErrorMessage("Pick a department.");
    expect(screen.getByText("Synarava")).toBeInTheDocument();

    await user.selectOptions(select, "rings");
    expect(select).toHaveValue("rings");
  });
});

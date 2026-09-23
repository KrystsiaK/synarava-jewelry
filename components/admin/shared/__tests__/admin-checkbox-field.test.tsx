import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  AdminCheckboxControl,
  AdminCheckboxField,
} from "@/components/admin/shared/admin-checkbox-field";

describe("AdminCheckboxField", () => {
  it("renders a bordered field with an accessible checkbox", async () => {
    const user = userEvent.setup();
    render(
      <AdminCheckboxField name="washable" label="Washable" defaultChecked={false} />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Washable" });
    expect(checkbox).not.toBeChecked();
    expect(checkbox.closest("[data-component='AdminCheckboxField']")).toHaveClass("adm-check-field");

    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it("keeps inline acknowledgements on AdminCheckboxControl without the card", () => {
    render(
      <AdminCheckboxControl
        label="I understand these values will be cleared."
        checked
        onChange={() => undefined}
      />,
    );

    expect(screen.getByRole("checkbox", { name: /cleared/i })).toBeChecked();
    expect(document.querySelector("[data-component='AdminCheckboxField']")).toBeNull();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  AdminCheckboxControl,
  AdminCheckboxField,
} from "@/components/synarava-cms";

describe("AdminCheckboxField", () => {
  it("renders a bare checkbox row without a field wrapper when there is no follow-on", async () => {
    const user = userEvent.setup();
    render(
      <AdminCheckboxField name="washable" label="Washable" defaultChecked={false} />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Washable" });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveClass("adm-check__input");
    expect(checkbox.closest("[data-component='AdminCheckboxField']")).toBeNull();
    expect(checkbox.closest("[data-component='AdminCheckboxControl']")).toHaveClass("adm-check");

    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it("stacks optional follow-on content under the checkbox row", () => {
    render(
      <AdminCheckboxField name="certified" label="Certified" defaultChecked>
        <span>Certificate URL</span>
      </AdminCheckboxField>,
    );

    expect(screen.getByRole("checkbox", { name: "Certified" })).toBeChecked();
    expect(screen.getByText("Certificate URL")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Certified" }).closest("[data-component='AdminCheckboxField']"),
    ).toHaveClass("adm-check-stack");
  });

  it("keeps inline acknowledgements on AdminCheckboxControl", () => {
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

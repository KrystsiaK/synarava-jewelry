import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AdminHelp } from "@/components/admin/shared/admin-help";
import { AdminTextField, fieldClass } from "@/components/admin/shared/admin-text-field";

describe("fieldClass", () => {
  it("reuses adm-field / adm-field--error tokens", () => {
    expect(fieldClass()).toBe("adm-field");
    expect(fieldClass("Required")).toBe("adm-field adm-field--error");
  });
});

describe("AdminTextField", () => {
  it("composes OwnershipLabel, adm-field-unit, and AdminFieldError", async () => {
    const user = userEvent.setup();
    render(
      <AdminTextField
        id="sku-field"
        name="sku"
        label="SKU"
        owner="Shopify"
        required
        error="Enter a SKU."
        errorId="sku-error"
        help={<AdminHelp label="SKU guidance">Stock keeping unit.</AdminHelp>}
      />,
    );

    const input = screen.getByRole("textbox", { name: /SKU/i });
    expect(input).toHaveAttribute("id", "sku-field");
    expect(input).toHaveAttribute("required");
    expect(input).toHaveClass("adm-field", "adm-field--error");
    expect(input).toHaveAccessibleErrorMessage("Enter a SKU.");
    expect(screen.getByText("Shopify")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SKU guidance" })).toBeInTheDocument();

    await user.type(input, "AX-1");
    expect(input).toHaveValue("AX-1");
  });

  it("uses FieldLabel when owner is omitted", () => {
    render(<AdminTextField label="Subtitle" help="Shown under the name." defaultValue="" />);
    expect(screen.getByRole("textbox", { name: /Subtitle/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Field guidance" })).toBeInTheDocument();
  });

  it("keeps end adornment inside one shared field border", () => {
    const { container } = render(
      <AdminTextField label="Length" name="length" endAdornment="mm" defaultValue="12" />,
    );
    const group = container.querySelector("[data-slot='control-group']");
    expect(group).toHaveClass("adm-field-group");
    expect(group?.querySelector("[data-slot='end-adornment']")).toHaveTextContent("mm");
    expect(screen.getByRole("textbox", { name: /Length/i })).toHaveClass("adm-field--in-group");
  });

  it("shows a clear control inside the field when clearable and focused", async () => {
    const user = userEvent.setup();
    render(<AdminTextField label="Tags" name="tags" clearable defaultValue="lava" />);

    const input = screen.getByRole("textbox", { name: /Tags/i });
    const clear = screen.getByRole("button", { name: "Clear field" });
    expect(clear).toHaveAttribute("data-visible", "true");

    await user.click(input);
    await user.click(clear);
    expect(input).toHaveValue("");
    expect(clear).toHaveAttribute("data-visible", "false");
  });
});

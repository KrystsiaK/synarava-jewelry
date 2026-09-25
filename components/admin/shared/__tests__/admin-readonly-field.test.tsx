import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminHelp, AdminReadonlyField } from "@/components/synarava-cms";

describe("AdminReadonlyField", () => {
  it("renders label, owner, help, and value without an input control", () => {
    render(
      <AdminReadonlyField
        label="Compare-at price"
        owner="Shopify"
        value="€148.00"
        help={<AdminHelp label="Compare-at guidance">Edit in Shopify.</AdminHelp>}
      />,
    );

    expect(screen.getByText("Compare-at price")).toBeInTheDocument();
    expect(screen.getByText("Shopify")).toBeInTheDocument();
    expect(screen.getByText("€148.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compare-at guidance" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(document.querySelector("[data-component='AdminReadonlyField']")).toHaveAttribute("data-empty", "false");
  });

  it("shows emptyLabel when value is missing", () => {
    render(
      <AdminReadonlyField label="Compare-at price" owner="Shopify" value={null} emptyLabel="Not set" />,
    );

    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(document.querySelector("[data-component='AdminReadonlyField']")).toHaveAttribute("data-empty", "true");
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductPassportFields } from "../product-passport-fields";

describe("ProductPassportFields", () => {
  it("opens groups that already have values and keeps empty groups closed", () => {
    render(
      <ProductPassportFields
        characteristics={{
          material: { value: "Freshwater pearl", certificateUrl: "" },
          care_instructions: { value: "Keep dry", certificateUrl: "" },
        }}
      />,
    );

    expect(screen.getByText("Product parameters")).toBeInTheDocument();
    expect(screen.getByLabelText("Primary material")).toHaveValue("Freshwater pearl");

    const materials = screen.getByRole("button", { name: "Materials & construction" })
      .closest("[data-component='AdminCollapsiblePanel']");
    const pet = screen.getByRole("button", { name: "Pet sizing & use" })
      .closest("[data-component='AdminCollapsiblePanel']");

    expect(materials).toHaveAttribute("data-open", "true");
    expect(pet).toHaveAttribute("data-open", "false");
  });
});

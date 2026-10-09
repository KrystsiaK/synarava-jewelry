import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  HiddenPassportTextOverlayFields,
  ProductPassportFields,
} from "../product-passport-fields";

describe("ProductPassportFields", () => {
  it("opens groups that already have values and keeps empty groups closed", () => {
    render(
      <ProductPassportFields
        characteristics={{
          chain_length: { value: "18", certificateUrl: "" },
          reach_certified: { value: true, certificateUrl: "" },
        }}
      />,
    );

    expect(screen.getByText("Product parameters")).toBeInTheDocument();
    expect(screen.getByLabelText("Chain length")).toHaveValue(18);

    const dimensions = screen.getByRole("button", { name: "Dimensions & fit" })
      .closest("[data-component='AdminCollapsiblePanel']");
    const compliance = screen.getByRole("button", { name: "Compliance" })
      .closest("[data-component='AdminCollapsiblePanel']");

    expect(dimensions).toHaveAttribute("data-open", "true");
    expect(compliance).toHaveAttribute("data-open", "true");
    expect(screen.queryByRole("button", { name: "Materials & construction" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Care" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Primary material")).not.toBeInTheDocument();
  });

  it("shows localized labels for Portuguese on Passport-only fields", () => {
    render(
      <ProductPassportFields
        characteristics={{
          chain_length: { value: "18", certificateUrl: "" },
        }}
        activeLocale="pt"
        textOverlay={{}}
        onTextOverlayChange={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Dimensões e ajuste" })).toBeInTheDocument();
    expect(screen.getByLabelText("Comprimento da corrente")).toHaveTextContent("18 cm");
  });

  it("keeps EN named passport fields HTML-hidden on RU without display:contents", () => {
    const { container } = render(
      <ProductPassportFields
        characteristics={{
          chain_length: { value: "18", certificateUrl: "" },
          reach_certified: { value: true, certificateUrl: "" },
        }}
        activeLocale="ru"
        textOverlay={{}}
        onTextOverlayChange={() => undefined}
      />,
    );

    expect(container.querySelector(".contents")).toBeNull();

    const enChain = container.querySelector<HTMLInputElement>(
      'input[name="characteristic_chain_length"]',
    );
    expect(enChain).not.toBeNull();
    expect(enChain).toHaveValue(18);
    expect(enChain?.closest("[hidden]")).not.toBeNull();

    expect(screen.getByLabelText("Длина цепочки")).toHaveTextContent("18 см");
  });
});

describe("HiddenPassportTextOverlayFields", () => {
  it("submits only Synarava-only TEXT overlays (no Shopify-owned material/care)", () => {
    const { container } = render(
      <HiddenPassportTextOverlayFields
        overlaysByLocale={{
          en: { material: "ignored" },
          pt: { material: "Pérola", care_instructions: "Manter seco." },
          ru: { material: "Жемчуг", care_instructions: "Хранить сухим." },
        }}
      />,
    );

    expect(container.querySelector('input[name="ptCharacteristic_material"]')).toBeNull();
    expect(container.querySelector('input[name="ruCharacteristic_care_instructions"]')).toBeNull();
  });
});

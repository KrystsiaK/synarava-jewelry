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
          material: { value: "Freshwater pearl", certificateUrl: "" },
          care_instructions: { value: "Keep dry", certificateUrl: "" },
        }}
      />,
    );

    expect(screen.getByText("Product parameters")).toBeInTheDocument();
    expect(screen.getByLabelText("Primary material")).toHaveValue("Freshwater pearl");

    const materials = screen.getByRole("button", { name: "Materials & construction" })
      .closest("[data-component='AdminCollapsiblePanel']");
    const compliance = screen.getByRole("button", { name: "Compliance" })
      .closest("[data-component='AdminCollapsiblePanel']");

    expect(materials).toHaveAttribute("data-open", "true");
    expect(compliance).toHaveAttribute("data-open", "false");
    expect(screen.queryByRole("button", { name: "Pet sizing & use" })).not.toBeInTheDocument();
  });

  it("shows localized labels and TEXT overlays for Portuguese", () => {
    render(
      <ProductPassportFields
        characteristics={{
          material: { value: "Freshwater pearl", certificateUrl: "" },
        }}
        activeLocale="pt"
        textOverlay={{ material: "Pérola de água doce" }}
        onTextOverlayChange={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Materiais e construção" })).toBeInTheDocument();
    expect(screen.getByLabelText("Material principal")).toHaveValue("Pérola de água doce");
  });

  it("keeps EN named passport fields HTML-hidden on RU without display:contents", () => {
    const { container } = render(
      <ProductPassportFields
        characteristics={{
          material: { value: "Crystal pearl", certificateUrl: "" },
          care_instructions: { value: "Avoid prolonged contact with water.", certificateUrl: "" },
        }}
        activeLocale="ru"
        textOverlay={{
          material: "Хрустальный жемчуг",
          care_instructions: "Избегайте длительного контакта с водой.",
        }}
        onTextOverlayChange={() => undefined}
      />,
    );

    expect(container.querySelector(".contents")).toBeNull();

    const enMaterial = container.querySelector<HTMLInputElement>(
      'input[name="characteristic_material"]',
    );
    expect(enMaterial).not.toBeNull();
    expect(enMaterial).toHaveValue("Crystal pearl");
    expect(enMaterial?.closest("[hidden]")).not.toBeNull();

    const enCare = container.querySelector<HTMLTextAreaElement>(
      'textarea[name="characteristic_care_instructions"]',
    );
    expect(enCare).not.toBeNull();
    expect(enCare?.closest("[hidden]")).not.toBeNull();

    expect(screen.getByLabelText("Основной материал")).toHaveValue("Хрустальный жемчуг");
    expect(screen.getByLabelText("Основной материал")).not.toHaveAttribute("name");
  });
});

describe("HiddenPassportTextOverlayFields", () => {
  it("submits prefixed TEXT overlays for every non-EN locale", () => {
    const { container } = render(
      <HiddenPassportTextOverlayFields
        overlaysByLocale={{
          en: { material: "ignored" },
          pt: { material: "Pérola", care_instructions: "Manter seco." },
          ru: { material: "Жемчуг", care_instructions: "Хранить сухим." },
        }}
      />,
    );

    expect(container.querySelector('input[name="characteristic_material"]')).toBeNull();
    expect(container.querySelector('input[name="ptCharacteristic_material"]')).toHaveValue("Pérola");
    expect(container.querySelector('input[name="ruCharacteristic_care_instructions"]'))
      .toHaveValue("Хранить сухим.");
  });
});

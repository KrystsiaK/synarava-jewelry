import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShopifyProductSpecsFields } from "@/components/admin/products/shopify-product-specs-fields";
import { ProductPassportFields } from "@/components/admin/products/product-passport-fields";
import { parseCustomMetafieldTranslationsForm } from "@/lib/shopify/product-metafields-shared";

describe("Shopify product specs ownership UI", () => {
  it("renders editable Shopify product specs from the commerce snapshot", () => {
    render(
      <ShopifyProductSpecsFields
        workingSnapshot={{
          metafields: [
            {
              namespace: "custom",
              key: "material",
              type: "single_line_text_field",
              value: "Freshwater pearl",
            },
            {
              namespace: "custom",
              key: "finish",
              type: "single_line_text_field",
              value: "18K Gold PVD",
            },
          ],
        }}
        activeLocale="en"
        translationLocales={[{ code: "pt" }, { code: "ru" }]}
      />,
    );

    expect(screen.getByText("Shopify product specs")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Freshwater pearl")).toBeInTheDocument();
    expect(screen.getByDisplayValue("18K Gold PVD")).toBeInTheDocument();
    expect(document.querySelector('input[name="customMetafieldValue:custom:material"]')).toBeTruthy();
    expect(document.querySelector('input[name="customMetafieldType:custom:wrist_fit"]')).toBeTruthy();
  });

  it("keeps Shopify-owned material/finish/color out of Passport", () => {
    render(
      <ProductPassportFields
        characteristics={{
          material: { value: "Pearl", certificateUrl: "" },
          finish: { value: "PVD", certificateUrl: "" },
          color: { value: "Gold", certificateUrl: "" },
          plating: { value: "18K", certificateUrl: "" },
          origin: { value: "PT", certificateUrl: "" },
          stone_type: { value: "Pearl", certificateUrl: "" },
          care_instructions: { value: "Keep dry", certificateUrl: "" },
          chain_length: { value: "18", certificateUrl: "" },
          reach_certified: { value: true, certificateUrl: "" },
        }}
        activeLocale="en"
      />,
    );

    expect(screen.queryByLabelText(/^Primary material$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Finish$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Color$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Plating$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/origin/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Stone/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Care instructions/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Chain length/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/REACH certified/i)).toBeInTheDocument();
  });

  it("keeps PT overlay FormData for product specs after edit (single-line)", () => {
    const { container } = render(
      <form>
        <ShopifyProductSpecsFields
          workingSnapshot={{
            metafields: [
              {
                namespace: "custom",
                key: "finish",
                type: "single_line_text_field",
                value: "18K Gold PVD",
              },
            ],
          }}
          activeLocale="pt"
          translationLocales={[{ code: "pt" }, { code: "ru" }]}
        />
      </form>,
    );

    const finish = screen.getByPlaceholderText("18K Gold PVD");
    fireEvent.change(finish, { target: { value: "PVD dourado" } });

    const hidden = container.querySelector(
      'input[name="ptCustomMetafieldValue:custom:finish"]',
    ) as HTMLInputElement | null;
    expect(hidden?.value).toBe("PVD dourado");

    const formData = new FormData(container.querySelector("form")!);
    // Simulate the old Metafields-panel duplicate empty that wiped overlays.
    formData.append("ptCustomMetafieldValue:custom:finish", "");
    expect(parseCustomMetafieldTranslationsForm(formData)).toMatchObject({
      pt: { "custom::finish": "PVD dourado" },
    });
  });
});

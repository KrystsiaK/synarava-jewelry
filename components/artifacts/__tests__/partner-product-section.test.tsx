import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useOptionalProductPairingSelection: vi.fn(),
}));

vi.mock("@/components/commerce/product-pairing-selection", () => ({
  useOptionalProductPairingSelection: mocks.useOptionalProductPairingSelection,
}));

vi.mock("next/image", () => ({
  default: (props: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={props.alt} src={props.src} />
  ),
}));

import { ProductPairingDetails } from "@/components/artifacts/product-detail";
import { TranslationProvider } from "@/lib/i18n/context";
import type { ProductSummary } from "@/lib/content/catalog";

const baseProduct = {
  slug: "necklace",
  title: "Necklace",
  description: "<p>Necklace story</p>",
  shortDescription: "Necklace short",
  image: "/necklace.jpg",
  attributes: [{ label: "Metal", value: "Gold" }],
  characteristics: [{
    key: "metal",
    label: "Metal",
    group: "Materials",
    valueType: "TEXT",
    textValue: "Gold",
    numberValue: null,
    booleanValue: null,
    unit: null,
    certificateUrl: null,
    sortOrder: 0,
  }],
  vendor: "",
  productType: "",
  sku: "N-1",
  categoryName: null,
  publicMetafields: [],
  materialLine: "",
  variantDetails: [],
} as unknown as ProductSummary;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProductPairingDetails", () => {
  it("renders one Details heading plus product and partner columns with characteristics", () => {
    mocks.useOptionalProductPairingSelection.mockReturnValue({
      partners: [{ pairingId: "pair-1" }],
      selectedPartner: {
        pairingId: "pair-1",
        pairImageUrls: [],
        available: true,
        product: {
          slug: "charm",
          title: "Charm Partner",
          description: "<p>Charm long description</p>",
          shortDescription: "",
          image: "/charm.jpg",
          attributes: [{ label: "Stone", value: "Pearl" }],
          characteristics: [{
            key: "stone",
            label: "Stone",
            group: "Materials",
            valueType: "TEXT",
            textValue: "Pearl",
            numberValue: null,
            booleanValue: null,
            unit: null,
            certificateUrl: null,
            sortOrder: 0,
          }],
          vendor: "",
          productType: "",
          sku: "C-1",
          categoryName: null,
          publicMetafields: [],
          materialLine: "",
          variantDetails: [],
        },
      },
    });

    render(
      <TranslationProvider initialLocale="en">
        <ProductPairingDetails product={baseProduct} />
      </TranslationProvider>,
    );

    expect(screen.getByRole("region", { name: /details that matter/i })).toBeInTheDocument();
    expect(screen.queryByText(/product information/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Necklace/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/products/necklace"),
    );
    expect(screen.getByRole("link", { name: /Charm Partner/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/products/charm"),
    );
    expect(screen.getByText("Charm long description")).toBeInTheDocument();
    expect(screen.getByText("Pearl")).toBeInTheDocument();
    expect(screen.getByText("Gold")).toBeInTheDocument();
    expect(document.querySelector('img[src="/charm.jpg"]')).toBeTruthy();
    expect(document.querySelector('img[src="/necklace.jpg"]')).toBeTruthy();
  });
});

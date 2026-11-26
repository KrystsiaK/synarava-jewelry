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

import { PartnerProductSection } from "@/components/artifacts/product-detail";
import { TranslationProvider } from "@/lib/i18n/context";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PartnerProductSection", () => {
  it("renders partner photo, linked heading, description, and characteristics", () => {
    mocks.useOptionalProductPairingSelection.mockReturnValue({
      selectedPartner: {
        pairingId: "pair-1",
        pairImageUrls: [],
        available: true,
        product: {
          slug: "charm",
          title: "Charm Partner",
          description: "<p>Charm long description</p>",
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
        <PartnerProductSection />
      </TranslationProvider>,
    );

    expect(screen.getByRole("region", { name: /wear-together partner/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Charm Partner/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/products/charm"),
    );
    expect(screen.getByText("Charm long description")).toBeInTheDocument();
    expect(screen.getByText("Pearl")).toBeInTheDocument();
    expect(document.querySelector('img[src="/charm.jpg"]')).toBeTruthy();
  });
});

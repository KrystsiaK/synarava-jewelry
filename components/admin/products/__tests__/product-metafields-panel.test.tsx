import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProductMetafieldsPanel } from "@/components/admin/products/product-metafields-panel";
import { adminSyncActionMocks } from "@/test/mocks/admin-sync-actions";

vi.mock("@/app/admin/actions/sync", async () => {
  const { adminSyncActionMocks } = await import("@/test/mocks/admin-sync-actions");
  return { ...adminSyncActionMocks };
});

vi.mock("@/components/admin/shared/admin-toast", () => ({
  useAdminToast: () => ({ pushToast: vi.fn() }),
}));

describe("ProductMetafieldsPanel locale overlays", () => {
  beforeEach(() => {
    adminSyncActionMocks.listCustomProductMetafieldDefinitionsAction.mockResolvedValue({
      definitions: [
        {
          id: "def-care",
          name: "Care instructions",
          namespace: "custom",
          key: "care_instructions",
          type: "multi_line_text_field",
          description: null,
        },
        {
          id: "def-warranty",
          name: "Warranty",
          namespace: "custom",
          key: "warranty",
          type: "single_line_text_field",
          description: null,
        },
      ],
    });
  });

  it("does not submit hidden PT/RU overlays for Product-tab Shopify specs", async () => {
    render(
      <ProductMetafieldsPanel
        productId="p1"
        shopifyProductId="gid://shopify/Product/1"
        shopifySnapshot={{ metafields: [] }}
        workingSnapshot={{
          metafields: [],
          metafieldTranslations: {
            pt: { "custom::warranty": "2 anos" },
          },
        }}
        activeLocale="pt"
        translationLocales={[
          { code: "pt", label: "Português" },
          { code: "ru", label: "Русский" },
        ]}
      />,
    );

    await waitFor(() => {
      expect(
        document.querySelector('input[name="ptCustomMetafieldValue:custom:warranty"]'),
      ).toBeTruthy();
    });

    expect(
      document.querySelector('input[name="ptCustomMetafieldValue:custom:care_instructions"]'),
    ).toBeNull();
    expect(
      document.querySelector('input[name="ruCustomMetafieldValue:custom:care_instructions"]'),
    ).toBeNull();
    expect(
      document.querySelector('input[name="ptCustomMetafieldValue:custom:material"]'),
    ).toBeNull();
  });
});

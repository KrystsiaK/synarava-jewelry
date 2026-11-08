import { beforeEach, describe, expect, it, vi } from "vitest";

const registerTranslations = vi.hoisted(() => vi.fn());
vi.mock("@/lib/shopify/translations", () => ({
  registerTranslations,
  fetchResourceTranslation: vi.fn(),
}));

import { pushCustomMetafieldTranslations } from "@/lib/shopify/product-metafield-translations";

/**
 * Golden Wheat Cuff Bracelet shape: EN jewelry specs live on the Shopify
 * product (remote Metafield GIDs), while OUR extras only holds PT/RU overlays
 * in metafieldTranslations — no extras.metafields rows yet.
 */
const GOLDEN_WHEAT_SPEC_KEYS = [
  "finish",
  "wrist_fit",
  "color",
  "metal",
  "stone",
  "plating",
  "size",
] as const;

const goldenWheatWorkingSnapshot = {
  metafieldTranslations: {
    pt: Object.fromEntries(
      GOLDEN_WHEAT_SPEC_KEYS.map((key) => [`custom::${key}`, `PT ${key}`]),
    ),
    ru: {
      "custom::finish": "RU finish",
      "custom::wrist_fit": "RU wrist_fit",
    },
  },
};

const goldenWheatMetafieldRefs = GOLDEN_WHEAT_SPEC_KEYS.map((key, index) => ({
  id: `gid://shopify/Metafield/${2000 + index}`,
  namespace: "custom",
  key,
  type: "single_line_text_field",
}));

beforeEach(() => {
  vi.clearAllMocks();
  registerTranslations.mockResolvedValue({ registeredKeys: ["value"] });
});

describe("pushCustomMetafieldTranslations — product specs overlays", () => {
  it("registers Golden Wheat PT/RU overlays when EN specs exist only as Metafield GIDs", async () => {
    await pushCustomMetafieldTranslations({
      metafieldRefs: goldenWheatMetafieldRefs,
      workingSnapshot: goldenWheatWorkingSnapshot,
      locales: [
        { code: "pt", shopifyLocale: "pt-PT" },
        { code: "ru", shopifyLocale: "ru" },
      ],
    });

    const finishPt = registerTranslations.mock.calls.find(
      ([args]) =>
        args.resourceId === "gid://shopify/Metafield/2000"
        && args.locale === "pt-PT"
        && args.values.value === "PT finish",
    );
    expect(finishPt).toBeTruthy();

    const wristRu = registerTranslations.mock.calls.find(
      ([args]) =>
        args.resourceId === "gid://shopify/Metafield/2001"
        && args.locale === "ru"
        && args.values.value === "RU wrist_fit",
    );
    expect(wristRu).toBeTruthy();

    expect(registerTranslations).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: "gid://shopify/Metafield/2003",
        locale: "pt-PT",
        values: { value: "PT metal" },
      }),
    );
  });

  it("fails explicitly when overlays exist but Shopify Metafield GIDs are missing", async () => {
    await expect(
      pushCustomMetafieldTranslations({
        metafieldRefs: [],
        workingSnapshot: goldenWheatWorkingSnapshot,
        locales: [{ code: "pt", shopifyLocale: "pt-PT" }],
      }),
    ).rejects.toThrow(/Shopify metafield GID missing/i);

    await expect(
      pushCustomMetafieldTranslations({
        metafieldRefs: [],
        workingSnapshot: goldenWheatWorkingSnapshot,
        locales: [{ code: "pt", shopifyLocale: "pt-PT" }],
      }),
    ).rejects.toThrow(/custom\.finish/);

    expect(registerTranslations).not.toHaveBeenCalled();
  });
});

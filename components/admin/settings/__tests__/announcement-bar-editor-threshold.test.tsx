import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/actions/announcement-bar", () => ({
  saveAnnouncementBarAction: vi.fn(),
}));

vi.mock("@/components/admin/shared/admin-toast", () => ({
  useAdminToast: () => ({ pushToast: vi.fn() }),
}));

vi.mock("@/components/admin/settings/shop-conflict-adapter", () => ({
  ShopThresholdConflictWorkspace: () => null,
}));

import { AnnouncementBarEditor } from "@/components/admin/settings/announcement-bar-editor";
import { DEFAULT_ANNOUNCEMENT_BAR_SETTING } from "@/lib/content/announcement-bar-fields";

const LOCALES = [
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
];

const shopMoney = { amount: "69.0", currencyCode: "EUR" };

function readonlyValue(label: string): string {
  const nodes = document.querySelectorAll("[data-component='AdminReadonlyField']");
  for (const node of nodes) {
    const labelEl = node.querySelector(".adm-readonly__label");
    if (labelEl?.textContent?.includes(label)) {
      const value = node.querySelector(".adm-readonly__value");
      return value?.textContent?.trim() ?? "";
    }
  }
  throw new Error(`AdminReadonlyField not found for label: ${label}`);
}

describe("AnnouncementBarEditor threshold honesty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the Shopify snapshot amount, not the local working threshold, as Shopify threshold", () => {
    render(
      <AnnouncementBarEditor
        initialSetting={{
          ...DEFAULT_ANNOUNCEMENT_BAR_SETTING,
          enabled: true,
          threshold: { amount: "40.0", currencyCode: "EUR" },
          shopifySnapshot: { freeShippingMinSubtotal: shopMoney },
          shopifyObservationSource: {
            profileName: "General",
            zoneName: "Portugal",
            rateName: "Free shipping",
          },
        }}
        copy={{ en: { "announcement.bar": "Free shipping from {amount}" } }}
        defaults={{ en: { "announcement.bar": "Free shipping from {amount}" } }}
        locales={LOCALES}
        thresholdConflictCount={1}
      />,
    );

    const honesty = screen.getByTestId("announcement-threshold-honesty");
    expect(within(honesty).getByText(/Rate: General \/ Portugal \/ Free shipping/)).toBeTruthy();
    expect(readonlyValue("Shopify threshold")).toMatch(/€69/);
    expect(readonlyValue("Local working threshold")).toMatch(/€40/);
    expect(screen.getByTestId("announcement-threshold-status").textContent).toMatch(
      /differs from Shopify/,
    );
  });

  it("shows the observation reason when snapshot is null and an error is persisted", () => {
    render(
      <AnnouncementBarEditor
        initialSetting={{
          ...DEFAULT_ANNOUNCEMENT_BAR_SETTING,
          shopifySnapshot: null,
          shopifyObservationError:
            "Missing Shopify permission: read_shipping (cannot read delivery profiles).",
        }}
        copy={{ en: { "announcement.bar": "Free shipping from {amount}" } }}
        defaults={{ en: { "announcement.bar": "Free shipping from {amount}" } }}
        locales={LOCALES}
        thresholdConflictCount={0}
      />,
    );

    expect(readonlyValue("Shopify threshold")).toBe("—");
    expect(
      screen.getByText("Missing Shopify permission: read_shipping (cannot read delivery profiles)."),
    ).toBeTruthy();
  });
});

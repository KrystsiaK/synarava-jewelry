import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/admin/translations/locale-registry-panel", () => ({
  LocaleRegistryPanel: () => <div>Locale registry</div>,
}));
vi.mock("@/components/admin/translations/translations-cms", () => ({
  TranslationsCms: () => <div>Translation differences</div>,
}));
vi.mock("@/lib/db", () => ({
  db: { page: { findMany: vi.fn().mockResolvedValue([]) } },
}));
vi.mock("@/lib/i18n/storefront-locale-registry", () => ({
  findDuplicateRouteSegments: () => [],
  findEnglishSourceViolation: () => null,
  listStorefrontLocales: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/shopify/reconciliation-run", () => ({
  getLatestReconcileDifferences: vi.fn().mockResolvedValue([]),
  getLatestReconcileRun: vi.fn().mockResolvedValue(null),
}));

import AdminTranslationsPage from "@/app/admin/(admin)/translations/page";

describe("AdminTranslationsPage", () => {
  it("uses the Translations title and explains the ownership decision", async () => {
    render(await AdminTranslationsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { level: 1, name: "Translations" })).toBeVisible();
    expect(screen.getByText(
      "Compare Synarava and Shopify translations, then choose which side wins for each difference.",
    )).toBeVisible();
  });
});

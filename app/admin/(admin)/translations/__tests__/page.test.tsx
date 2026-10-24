import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/admin/translations/languages-panel", () => ({
  LanguagesPanel: () => <div>Languages panel</div>,
}));
vi.mock("@/components/admin/translations/translations-sync-summary", () => ({
  TranslationsSyncSummary: ({ counts }: { counts: { total: number } }) => (
    <div>Sync summary · {counts.total}</div>
  ),
}));
vi.mock("@/lib/auth/admin-session", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ username: "admin" }),
}));
vi.mock("@/lib/i18n/storefront-locale-registry", () => ({
  findDuplicateRouteSegments: () => [],
  findEnglishSourceViolation: () => null,
  listStorefrontLocales: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/shopify/locale-mutations", () => ({
  hasWriteLocalesScope: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/sync", () => ({
  runSyncWaterfall: vi.fn().mockResolvedValue({
    result: {
      checkedAt: "2026-10-23T10:00:00.000Z",
      state: "ready",
      leaves: [],
      recentlyUpdatedProducts: {},
    },
  }),
  selectAdminNavSyncCounts: vi.fn().mockReturnValue({
    total: 0,
    products: 0,
    collections: 0,
    pages: 0,
    settings: 0,
  }),
}));

import AdminTranslationsPage from "@/app/admin/(admin)/translations/page";

describe("AdminTranslationsPage", () => {
  it("shows languages plus a selector summary — not a field merge list", async () => {
    render(await AdminTranslationsPage());

    expect(screen.getByRole("heading", { level: 1, name: "Translations" })).toBeVisible();
    expect(screen.getByText(/Manage languages and see where Synarava and Shopify differ/)).toBeVisible();
    expect(screen.getByText("Languages panel")).toBeVisible();
    expect(screen.getByText("Sync summary · 0")).toBeVisible();
    expect(screen.queryByText("Translation differences")).not.toBeInTheDocument();
  });
});

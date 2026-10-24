import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/admin/translations/languages-panel", () => ({
  LanguagesPanel: () => <div>Languages panel</div>,
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

import AdminTranslationsPage from "@/app/admin/(admin)/translations/page";

describe("AdminTranslationsPage", () => {
  it("shows the languages panel only — no sync summary hub", async () => {
    render(await AdminTranslationsPage());

    expect(screen.getByRole("heading", { level: 1, name: "Translations" })).toBeVisible();
    expect(screen.getByText(/Manage languages: add, hide, restore, export, or import/)).toBeVisible();
    expect(screen.getByText("Languages panel")).toBeVisible();
    expect(screen.queryByText(/What differs/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sync summary/)).not.toBeInTheDocument();
    expect(screen.queryByText("Translation differences")).not.toBeInTheDocument();
  });
});

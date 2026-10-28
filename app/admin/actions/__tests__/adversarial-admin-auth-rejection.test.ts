/**
 * Phase 2 — unauthenticated admin actions must reject (redirect).
 * Findings: docs/audits/2026-10-28-server-auth.md
 * Staging follow-up: AUTH-ADV-001/002 fixed — gated actions redirect.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  getCurrentAdminSession: vi.fn(),
}));

vi.mock("@/lib/auth/admin-session", () => ({
  requireAdminSession: mocks.requireAdminSession,
  getCurrentAdminSession: mocks.getCurrentAdminSession,
}));

// Keep heavy deps out of the rejection path.
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/sku/client", () => ({ tryCreateSkuClient: vi.fn(() => null) }));
vi.mock("@/lib/sku/config", () => ({
  getSkuServiceConfig: vi.fn(() => ({ configured: false, reason: "test" })),
}));

beforeEach(() => {
  mocks.requireAdminSession.mockReset();
  mocks.getCurrentAdminSession.mockReset();
  mocks.requireAdminSession.mockImplementation(async () => {
    const err = new Error("NEXT_REDIRECT");
    (err as { digest?: string }).digest = "NEXT_REDIRECT;replace;/admin/login";
    throw err;
  });
  mocks.getCurrentAdminSession.mockResolvedValue(null);
});

describe("adversarial: authenticated actions reject without session", () => {
  it("deleteProductAction invokes requireAdminSession before work", async () => {
    const { deleteProductAction } = await import("@/app/admin/actions/products");
    await expect(deleteProductAction({ productId: "p1" } as never)).rejects.toThrow(/NEXT_REDIRECT/);
    expect(mocks.requireAdminSession).toHaveBeenCalled();
  });

  it("applyCatalogConflictResolutionAction invokes requireAdminSession", async () => {
    const { applyCatalogConflictResolutionAction } = await import("@/app/admin/actions/sync");
    await expect(
      applyCatalogConflictResolutionAction({} as never),
    ).rejects.toThrow(/NEXT_REDIRECT/);
    expect(mocks.requireAdminSession).toHaveBeenCalled();
  });

  it("assignProductSkuAction invokes requireAdminSession", async () => {
    const { assignProductSkuAction } = await import("@/app/admin/actions/sku-assign");
    await expect(assignProductSkuAction({} as never)).rejects.toThrow(/NEXT_REDIRECT/);
    expect(mocks.requireAdminSession).toHaveBeenCalled();
  });
});

describe("adversarial: unauthenticated actions reject (AUTH-ADV-001/002)", () => {
  it("saveSkuPolicyDraftAction", async () => {
    const { saveSkuPolicyDraftAction } = await import("@/app/admin/actions/sku-policy");
    await expect(
      saveSkuPolicyDraftAction({
        version: 1,
        separator: "-",
        suffixWidth: 3,
        allowedCharacters: "A-Z0-9",
        familiesJson: "{}",
      }),
    ).rejects.toThrow(/NEXT_REDIRECT/);
    expect(mocks.requireAdminSession).toHaveBeenCalled();
  });

  it("publishSkuPolicyAction", async () => {
    const { publishSkuPolicyAction } = await import("@/app/admin/actions/sku-policy");
    await expect(publishSkuPolicyAction(1)).rejects.toThrow(/NEXT_REDIRECT/);
    expect(mocks.requireAdminSession).toHaveBeenCalled();
  });

  it("loadSkuPolicyEditorPayload", async () => {
    const { loadSkuPolicyEditorPayload } = await import("@/app/admin/actions/sku-policy");
    await expect(loadSkuPolicyEditorPayload()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(mocks.requireAdminSession).toHaveBeenCalled();
  });

  it("getSavedProductPayload", async () => {
    const { getSavedProductPayload } = await import("@/app/admin/actions/products");
    await expect(getSavedProductPayload("p1")).rejects.toThrow(/NEXT_REDIRECT/);
    expect(mocks.requireAdminSession).toHaveBeenCalled();
  });

  it("getSavedCollectionPayload", async () => {
    const { getSavedCollectionPayload } = await import("@/app/admin/actions/collections");
    await expect(getSavedCollectionPayload("c1")).rejects.toThrow(/NEXT_REDIRECT/);
    expect(mocks.requireAdminSession).toHaveBeenCalled();
  });

  it("getSavedPagePayload", async () => {
    const { getSavedPagePayload } = await import("@/app/admin/actions/pages");
    await expect(getSavedPagePayload("about")).rejects.toThrow(/NEXT_REDIRECT/);
    expect(mocks.requireAdminSession).toHaveBeenCalled();
  });

  it("getSavedTagPayload", async () => {
    const { getSavedTagPayload } = await import("@/app/admin/actions/tags");
    await expect(getSavedTagPayload("t1")).rejects.toThrow(/NEXT_REDIRECT/);
    expect(mocks.requireAdminSession).toHaveBeenCalled();
  });

  it("getSavedCategoryPayload", async () => {
    const { getSavedCategoryPayload } = await import("@/app/admin/actions/categories");
    await expect(getSavedCategoryPayload("cat1")).rejects.toThrow(/NEXT_REDIRECT/);
    expect(mocks.requireAdminSession).toHaveBeenCalled();
  });
});

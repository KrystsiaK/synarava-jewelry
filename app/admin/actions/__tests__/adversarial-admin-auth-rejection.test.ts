/**
 * Phase 2 — unauthenticated admin actions must reject (redirect).
 * Findings: docs/audits/2026-10-28-server-auth.md
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

describe("adversarial: missing-auth actions (documented findings)", () => {
  /**
   * AUTH-ADV-001 — saveSkuPolicyDraftAction does not call requireAdminSession.
   * Unauthenticated call reaches SKU client gate instead of login redirect.
   */
  it("saveSkuPolicyDraftAction does not call requireAdminSession today (AUTH-ADV-001 evidence)", async () => {
    const { saveSkuPolicyDraftAction } = await import("@/app/admin/actions/sku-policy");
    const result = await saveSkuPolicyDraftAction({
      version: 1,
      separator: "-",
      suffixWidth: 3,
      allowedCharacters: "A-Z0-9",
      familiesJson: "{}",
    });
    expect(mocks.requireAdminSession).not.toHaveBeenCalled();
    // Without SKU client configured, returns config error — not an auth redirect.
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/SKU/i);
  });

  it("publishSkuPolicyAction does not call requireAdminSession today (AUTH-ADV-001 evidence)", async () => {
    const { publishSkuPolicyAction } = await import("@/app/admin/actions/sku-policy");
    const result = await publishSkuPolicyAction(1);
    expect(mocks.requireAdminSession).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });
});

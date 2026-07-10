const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
);
const checkRateLimitMock = vi.hoisted(() => vi.fn(() => ({ ok: true as const })));
const clearRateLimitMock = vi.hoisted(() => vi.fn());
const createAdminSessionMock = vi.hoisted(() => vi.fn());
const clearAdminSessionMock = vi.hoisted(() => vi.fn());
const isAdminAuthConfiguredMock = vi.hoisted(() => vi.fn(() => true));
const verifyAdminCredentialsMock = vi.hoisted(() => vi.fn(() => true));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: vi.fn(() => "127.0.0.1"),
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth/guard", () => ({
  checkRateLimit: checkRateLimitMock,
  clearRateLimit: clearRateLimitMock,
}));

vi.mock("@/lib/auth/admin-session", () => ({
  clearAdminSession: clearAdminSessionMock,
  createAdminSession: createAdminSessionMock,
  isAdminAuthConfigured: isAdminAuthConfiguredMock,
  verifyAdminCredentials: verifyAdminCredentialsMock,
}));

import { adminLoginAction, adminLogoutAction } from "@/app/admin/login/actions";

function makeFormData(input: {
  username?: string;
  password?: string;
  redirectTo?: string;
}) {
  const formData = new FormData();
  formData.set("username", input.username ?? "studio");
  formData.set("password", input.password ?? "password");
  formData.set("redirectTo", input.redirectTo ?? "");
  return formData;
}

async function captureRedirect(action: Promise<unknown>) {
  try {
    await action;
    throw new Error("Expected redirect");
  } catch (error) {
    if (error instanceof Error && error.message === "Expected redirect") {
      throw error;
    }
    return error as Error & { url?: string };
  }
}

describe("admin login actions", () => {
  beforeEach(() => {
    checkRateLimitMock.mockReturnValue({ ok: true });
    isAdminAuthConfiguredMock.mockReturnValue(true);
    verifyAdminCredentialsMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns a configuration error when admin auth is missing", async () => {
    isAdminAuthConfiguredMock.mockReturnValue(false);

    const result = await adminLoginAction({}, makeFormData({}));

    expect(result.error).toMatch(/Admin auth is not configured/);
    expect(verifyAdminCredentialsMock).not.toHaveBeenCalled();
    expect(createAdminSessionMock).not.toHaveBeenCalled();
  });

  it("returns an invalid credentials error for failed verification", async () => {
    verifyAdminCredentialsMock.mockReturnValue(false);

    const result = await adminLoginAction(
      {},
      makeFormData({ username: "studio", password: "wrong" }),
    );

    expect(result).toEqual({ error: "Incorrect admin credentials." });
    expect(createAdminSessionMock).not.toHaveBeenCalled();
  });

  it("returns retry metadata when rate limited", async () => {
    checkRateLimitMock.mockReturnValue({
      ok: false,
      error: "Too many attempts. Try again in 42s.",
      retryAfterSeconds: 42,
    });

    const result = await adminLoginAction({}, makeFormData({}));

    expect(result).toEqual({
      error: "Too many attempts. Try again in 42s.",
      retryAfterSeconds: 42,
    });
    expect(createAdminSessionMock).not.toHaveBeenCalled();
  });


  it("creates an admin session and redirects to a safe admin path", async () => {
    const error = await captureRedirect(
      adminLoginAction({}, makeFormData({ redirectTo: "/admin/products" })),
    );

    expect(createAdminSessionMock).toHaveBeenCalledOnce();
    expect(clearRateLimitMock).toHaveBeenCalledWith("admin-login-ip", "127.0.0.1");
    expect(clearRateLimitMock).toHaveBeenCalledWith("admin-login-username", "studio");
    expect(redirectMock).toHaveBeenCalledWith("/admin/products");
    expect(error.url).toBe("/admin/products");
  });

  it("sanitizes external redirect targets", async () => {
    const error = await captureRedirect(
      adminLoginAction({}, makeFormData({ redirectTo: "https://example.com/admin" })),
    );

    expect(createAdminSessionMock).toHaveBeenCalledOnce();
    expect(redirectMock).toHaveBeenCalledWith("/admin");
    expect(error.url).toBe("/admin");
  });

  it("clears the admin session on logout", async () => {
    const error = await captureRedirect(adminLogoutAction());

    expect(clearAdminSessionMock).toHaveBeenCalledOnce();
    expect(redirectMock).toHaveBeenCalledWith("/admin/login");
    expect(error.url).toBe("/admin/login");
  });
});

import { hashPassword } from "@/lib/auth/password";

type AdminEnv = {
  ADMIN_USERNAME?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_PASSWORD_HASH?: string;
  ADMIN_SESSION_SECRET?: string;
};

function createCookieStoreMock() {
  return {
    get: vi.fn(),
    set: vi.fn(),
  };
}

async function loadAdminSession(
  env: AdminEnv,
  nodeEnv = "test",
  cookieStore = createCookieStoreMock(),
) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.doMock("next/headers", () => ({
    cookies: vi.fn(async () => cookieStore),
  }));
  vi.doMock("next/navigation", () => ({
    redirect: vi.fn(),
  }));
  vi.doMock("@/lib/env", () => ({
    env,
  }));

  return {
    adminSession: await import("@/lib/auth/admin-session"),
    cookieStore,
  };
}

describe("admin session credentials", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock("next/headers");
    vi.doUnmock("next/navigation");
    vi.doUnmock("@/lib/env");
  });

  it("accepts ADMIN_USERNAME with ADMIN_PASSWORD_HASH", async () => {
    const { adminSession } = await loadAdminSession({
      ADMIN_USERNAME: "studio",
      ADMIN_PASSWORD_HASH: hashPassword("correct-password"),
      ADMIN_SESSION_SECRET: "test-admin-secret",
    });

    expect(adminSession.isAdminAuthConfigured()).toBe(true);
    expect(adminSession.verifyAdminCredentials("studio", "correct-password")).toBe(true);
  });

  it("rejects incorrect username or password", async () => {
    const { adminSession } = await loadAdminSession({
      ADMIN_USERNAME: "studio",
      ADMIN_PASSWORD_HASH: hashPassword("correct-password"),
      ADMIN_SESSION_SECRET: "test-admin-secret",
    });

    expect(adminSession.verifyAdminCredentials("other", "correct-password")).toBe(false);
    expect(adminSession.verifyAdminCredentials("studio", "wrong-password")).toBe(false);
  });

  it("uses legacy ADMIN_EMAIL and ADMIN_PASSWORD only outside production", async () => {
    const { adminSession } = await loadAdminSession({
      ADMIN_EMAIL: "admin@example.com",
      ADMIN_PASSWORD: "dev-password",
      ADMIN_SESSION_SECRET: "test-admin-secret",
    });

    expect(adminSession.isAdminAuthConfigured()).toBe(true);
    expect(adminSession.verifyAdminCredentials("admin@example.com", "dev-password")).toBe(true);
  });

  it("does not accept legacy ADMIN_PASSWORD in production", async () => {
    const { adminSession } = await loadAdminSession(
      {
        ADMIN_EMAIL: "admin@example.com",
        ADMIN_PASSWORD: "dev-password",
        ADMIN_SESSION_SECRET: "test-admin-secret",
      },
      "production",
    );

    expect(adminSession.isAdminAuthConfigured()).toBe(false);
    expect(adminSession.verifyAdminCredentials("admin@example.com", "dev-password")).toBe(false);
  });

  it("reports missing credentials as not configured", async () => {
    const { adminSession } = await loadAdminSession({
      ADMIN_SESSION_SECRET: "test-admin-secret",
    });

    expect(adminSession.isAdminAuthConfigured()).toBe(false);
  });

  it("expires the admin cookie using the same /admin path used at sign-in", async () => {
    const { adminSession, cookieStore } = await loadAdminSession({
      ADMIN_USERNAME: "studio",
      ADMIN_PASSWORD_HASH: hashPassword("correct-password"),
      ADMIN_SESSION_SECRET: "test-admin-secret",
    });

    await adminSession.clearAdminSession();

    expect(cookieStore.set).toHaveBeenCalledWith(
      "synarava-admin-session",
      "",
      expect.objectContaining({
        path: "/admin",
        maxAge: 0,
        expires: new Date(0),
      }),
    );
  });
});

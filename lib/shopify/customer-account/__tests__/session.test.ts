import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  findStoredCustomerSession: vi.fn(),
  deleteStoredCustomerSession: vi.fn().mockResolvedValue(undefined),
  touchStoredCustomerSession: vi.fn().mockResolvedValue(undefined),
  updateStoredCustomerSessionTokens: vi.fn().mockResolvedValue(undefined),
  decryptCustomerSecret: vi.fn((value: string) => `decrypted:${value}`),
  encryptCustomerSecret: vi.fn((value: string) => `encrypted:${value}`),
  requestCustomerTokens: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: mocks.cookieGet })),
}));

vi.mock("../config", () => ({
  CUSTOMER_SESSION_IDLE_TIMEOUT_MS: 14 * 24 * 60 * 60 * 1000,
  getShopifyCustomerAccountConfig: vi.fn(() => ({ clientId: "client-id" })),
  SHOPIFY_CUSTOMER_SESSION_COOKIE: "synarava-shopify-customer-session",
}));

vi.mock("../crypto", () => ({
  decryptCustomerSecret: mocks.decryptCustomerSecret,
  encryptCustomerSecret: mocks.encryptCustomerSecret,
}));

vi.mock("../discovery", () => ({
  getCustomerAuthorizationDiscovery: vi.fn(async () => ({
    token_endpoint: "https://accounts.example/token",
  })),
}));

vi.mock("../tokens", () => ({
  requestCustomerTokens: mocks.requestCustomerTokens,
}));

vi.mock("../session-store", () => ({
  findStoredCustomerSession: mocks.findStoredCustomerSession,
  deleteStoredCustomerSession: mocks.deleteStoredCustomerSession,
  touchStoredCustomerSession: mocks.touchStoredCustomerSession,
  updateStoredCustomerSessionTokens: mocks.updateStoredCustomerSessionTokens,
}));

import { getShopifyCustomerSession } from "../session";

const SESSION_ID = "session-1";
const NOW = Date.parse("2026-09-15T12:00:00.000Z");

function baseSession(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: SESSION_ID,
    accessToken: "enc-access",
    refreshToken: "enc-refresh",
    idToken: "enc-id",
    accessTokenExpiresAt: new Date(NOW + 60 * 60 * 1000),
    sessionExpiresAt: new Date(NOW + 10 * 24 * 60 * 60 * 1000),
    lastSeenAt: new Date(NOW - 60 * 1000),
    createdAt: new Date(NOW - 20 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(NOW - 60 * 1000),
    ...overrides,
  };
}

describe("getShopifyCustomerSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.cookieGet.mockReturnValue({ value: SESSION_ID });
    mocks.decryptCustomerSecret.mockImplementation((value: string) => `decrypted:${value}`);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns an active session without refreshing when the access token is still valid", async () => {
    mocks.findStoredCustomerSession.mockResolvedValue(baseSession());

    const result = await getShopifyCustomerSession();

    expect(result).not.toBeNull();
    expect(result?.accessToken).toBe("decrypted:enc-access");
    expect(mocks.requestCustomerTokens).not.toHaveBeenCalled();
    expect(mocks.deleteStoredCustomerSession).not.toHaveBeenCalled();
  });

  it("refreshes the access token once it is close to expiry, without touching the absolute session TTL", async () => {
    const session = baseSession({ accessTokenExpiresAt: new Date(NOW + 10_000) });
    mocks.findStoredCustomerSession.mockResolvedValue(session);
    mocks.requestCustomerTokens.mockResolvedValue({
      access_token: "new-access",
      refresh_token: "new-refresh",
      id_token: "new-id",
      expires_in: 3600,
    });

    const result = await getShopifyCustomerSession();

    expect(mocks.requestCustomerTokens).toHaveBeenCalledTimes(1);
    expect(mocks.updateStoredCustomerSessionTokens).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({
        accessToken: "encrypted:new-access",
        refreshToken: "encrypted:new-refresh",
        idToken: "encrypted:new-id",
      }),
    );
    const [, updatePayload] = mocks.updateStoredCustomerSessionTokens.mock.calls[0];
    expect(updatePayload).not.toHaveProperty("sessionExpiresAt");
    expect(result?.sessionExpiresAt).toEqual(session.sessionExpiresAt);
  });

  it("deletes an expired session record and returns null without requesting a refresh", async () => {
    const session = baseSession({ sessionExpiresAt: new Date(NOW - 1000) });
    mocks.findStoredCustomerSession.mockResolvedValue(session);

    const result = await getShopifyCustomerSession();

    expect(result).toBeNull();
    expect(mocks.requestCustomerTokens).not.toHaveBeenCalled();
    expect(mocks.deleteStoredCustomerSession).toHaveBeenCalledWith(SESSION_ID);
  });

  it("deletes a session that has been idle past the idle timeout", async () => {
    const session = baseSession({ lastSeenAt: new Date(NOW - 15 * 24 * 60 * 60 * 1000) });
    mocks.findStoredCustomerSession.mockResolvedValue(session);

    const result = await getShopifyCustomerSession();

    expect(result).toBeNull();
    expect(mocks.deleteStoredCustomerSession).toHaveBeenCalledWith(SESSION_ID);
  });

  it("deletes a session record it cannot decrypt", async () => {
    mocks.findStoredCustomerSession.mockResolvedValue(baseSession());
    mocks.decryptCustomerSecret.mockImplementation(() => {
      throw new Error("bad ciphertext");
    });

    const result = await getShopifyCustomerSession();

    expect(result).toBeNull();
    expect(mocks.deleteStoredCustomerSession).toHaveBeenCalledWith(SESSION_ID);
  });

  it("deletes the session when a refresh attempt fails", async () => {
    const session = baseSession({ accessTokenExpiresAt: new Date(NOW + 10_000) });
    mocks.findStoredCustomerSession.mockResolvedValue(session);
    mocks.requestCustomerTokens.mockRejectedValue(new Error("refresh failed"));

    const result = await getShopifyCustomerSession();

    expect(result).toBeNull();
    expect(mocks.deleteStoredCustomerSession).toHaveBeenCalledWith(SESSION_ID);
  });
});

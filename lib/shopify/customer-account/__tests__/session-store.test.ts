import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executeRaw: vi.fn().mockResolvedValue(undefined),
  queryRaw: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $executeRaw: mocks.executeRaw,
    $queryRaw: mocks.queryRaw,
  },
}));

import {
  cleanupExpiredCustomerSessions,
  createStoredCustomerSession,
} from "../session-store";

describe("Shopify customer session store cleanup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes only rows whose sessionExpiresAt has elapsed", async () => {
    await cleanupExpiredCustomerSessions();

    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
    const [sql] = mocks.executeRaw.mock.calls[0] as [TemplateStringsArray];
    expect(sql.join("")).toContain('"sessionExpiresAt" <= NOW()');
  });

  it("is safe to run repeatedly", async () => {
    await cleanupExpiredCustomerSessions();
    await cleanupExpiredCustomerSessions();

    expect(mocks.executeRaw).toHaveBeenCalledTimes(2);
  });

  it("cleans up abandoned sessions before inserting a new one", async () => {
    await createStoredCustomerSession({
      id: "session-1",
      accessToken: "enc-access",
      refreshToken: "enc-refresh",
      idToken: "enc-id",
      accessTokenExpiresAt: new Date(),
      sessionExpiresAt: new Date(),
    });

    expect(mocks.executeRaw).toHaveBeenCalledTimes(2);
    const [cleanupSql] = mocks.executeRaw.mock.calls[0] as [TemplateStringsArray];
    const [insertSql] = mocks.executeRaw.mock.calls[1] as [TemplateStringsArray];
    expect(cleanupSql.join("")).toContain("DELETE FROM");
    expect(insertSql.join("")).toContain("INSERT INTO");
  });
});

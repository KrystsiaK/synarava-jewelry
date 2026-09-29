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

import { createHash } from "node:crypto";

import {
  cleanupExpiredCustomerSessions,
  createStoredCustomerSession,
  findStoredCustomerSession,
  hashCustomerSessionId,
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

  it("stores sha256(sessionId) and cleans up before insert", async () => {
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
    const [insertSql, ...insertValues] = mocks.executeRaw.mock.calls[1] as unknown[];
    expect((cleanupSql as TemplateStringsArray).join("")).toContain("DELETE FROM");
    expect((insertSql as TemplateStringsArray).join("")).toContain("INSERT INTO");
    const expectedHash = createHash("sha256").update("session-1", "utf8").digest("hex");
    expect(hashCustomerSessionId("session-1")).toBe(expectedHash);
    expect(insertValues).toContain(expectedHash);
    expect(insertValues).not.toContain("session-1");
  });

  it("dual-reads legacy plaintext ids and promotes them to the hash", async () => {
    const cookieId = "legacy-cookie";
    const idHash = hashCustomerSessionId(cookieId);
    const legacyRow = {
      id: cookieId,
      accessToken: "enc-a",
      refreshToken: "enc-r",
      idToken: "enc-i",
      accessTokenExpiresAt: new Date(),
      sessionExpiresAt: new Date(),
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mocks.queryRaw
      .mockResolvedValueOnce([]) // hash miss
      .mockResolvedValueOnce([legacyRow]); // plaintext hit

    const found = await findStoredCustomerSession(cookieId);

    expect(found?.id).toBe(cookieId);
    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
    const [promoteSql, ...promoteValues] = mocks.executeRaw.mock.calls[0] as unknown[];
    expect((promoteSql as TemplateStringsArray).join("")).toContain("UPDATE");
    expect(promoteValues).toContain(idHash);
    expect(promoteValues).toContain(cookieId);
  });
});

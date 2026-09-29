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
  deleteStoredCustomerSession,
  findStoredCustomerSession,
  hashCustomerSessionId,
  touchStoredCustomerSession,
} from "../session-store";

function storedRow(id: string) {
  return {
    id,
    accessToken: "enc-a",
    refreshToken: "enc-r",
    idToken: "enc-i",
    accessTokenExpiresAt: new Date(),
    sessionExpiresAt: new Date(),
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

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

  // Hashing the primary key is pointless if the stored hash is itself usable
  // as a cookie: the legacy dual-read must never match a row by its own pk.
  it("refuses a stored pk replayed as a cookie", async () => {
    const storedPk = hashCustomerSessionId("real-cookie");
    mocks.queryRaw.mockImplementation((...args: unknown[]) =>
      Promise.resolve(args[1] === storedPk ? [storedRow(storedPk)] : []),
    );

    expect(await findStoredCustomerSession(storedPk)).toBeNull();
    // ...and does not re-key the victim's row to sha256(storedPk).
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });

  it("never binds a hash-shaped cookie as a legacy pk in write statements", async () => {
    const storedPk = hashCustomerSessionId("real-cookie");

    await touchStoredCustomerSession(storedPk);
    await deleteStoredCustomerSession(storedPk);

    const bound = mocks.executeRaw.mock.calls.flatMap((call) => call.slice(1));
    expect(bound).not.toContain(storedPk);
    expect(bound).toContain(hashCustomerSessionId(storedPk));
  });

  it("still resolves a genuine cookie against its hashed row", async () => {
    const cookieId = "jT3kQ9wZ1aB7cD2eF5gH8iJ0kL3mN6oP9qR2sT5uV8w";
    const storedPk = hashCustomerSessionId(cookieId);
    mocks.queryRaw.mockImplementation((...args: unknown[]) =>
      Promise.resolve(args[1] === storedPk ? [storedRow(storedPk)] : []),
    );

    const found = await findStoredCustomerSession(cookieId);
    expect(found?.id).toBe(cookieId);
  });
});

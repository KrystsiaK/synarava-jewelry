import { describe, expect, it, vi } from "vitest";
import { Prisma } from "../generated/prisma/index.js";
import {
  RetryableTransactionConflict,
  isRetryablePrismaError,
  withSerializableRetry,
} from "./retry.js";

describe("withSerializableRetry", () => {
  it("retries P2034 then succeeds", async () => {
    let calls = 0;
    const result = await withSerializableRetry(async () => {
      calls += 1;
      if (calls < 3) {
        throw new Prisma.PrismaClientKnownRequestError("serialization", {
          code: "P2034",
          clientVersion: "test",
        });
      }
      return "ok";
    });
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("retries raw-query SQLSTATE 40001 (P2010)", async () => {
    let calls = 0;
    const result = await withSerializableRetry(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Prisma.PrismaClientKnownRequestError(
          "Raw query failed. Code: `40001`. Message: `could not serialize access due to concurrent update`",
          {
            code: "P2010",
            clientVersion: "test",
            meta: { code: "40001", message: "could not serialize access" },
          },
        );
      }
      return "recovered";
    });
    expect(result).toBe("recovered");
    expect(calls).toBe(2);
  });

  it("retries P2002 (idempotency / SKU unique race)", async () => {
    let calls = 0;
    const result = await withSerializableRetry(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Prisma.PrismaClientKnownRequestError("unique", {
          code: "P2002",
          clientVersion: "test",
          meta: { target: ["workspaceId", "idempotencyKey"] },
        });
      }
      return "existing";
    });
    expect(result).toBe("existing");
    expect(calls).toBe(2);
  });

  it("retries RetryableTransactionConflict", async () => {
    let calls = 0;
    await withSerializableRetry(async () => {
      calls += 1;
      if (calls === 1) throw new RetryableTransactionConflict();
      return true;
    });
    expect(calls).toBe(2);
  });

  it("gives up after max attempts", async () => {
    const boom = new Prisma.PrismaClientKnownRequestError("serialization", {
      code: "P2034",
      clientVersion: "test",
    });
    await expect(
      withSerializableRetry(
        async () => {
          throw boom;
        },
        { maxAttempts: 3 },
      ),
    ).rejects.toBe(boom);
  });

  it("does not retry domain-like errors", async () => {
    expect(isRetryablePrismaError(new Error("nope"))).toBe(false);
    const spy = vi.fn(async () => {
      throw new Error("permanent");
    });
    await expect(withSerializableRetry(spy, { maxAttempts: 5 })).rejects.toThrow(
      "permanent",
    );
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { createSkuClient, DEFAULT_SKU_CLIENT_TIMEOUT_MS } from "./client";

const CLIENT_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "client.ts"),
  "utf8",
);

describe("sku-contract client timeout (REL-009)", () => {
  it("uses AbortSignal.timeout and surfaces TIMEOUT errors", () => {
    expect(DEFAULT_SKU_CLIENT_TIMEOUT_MS).toBeGreaterThan(0);
    expect(CLIENT_SRC).toMatch(/AbortSignal\.timeout/);
    expect(CLIENT_SRC).toMatch(/code:\s*"TIMEOUT"/);
  });

  it("returns ok:false TIMEOUT when fetch aborts, never ok:true", async () => {
    const fetchImpl = vi.fn(async () => {
      const err = new Error("The operation was aborted due to timeout");
      err.name = "TimeoutError";
      throw err;
    });

    const client = createSkuClient({
      baseUrl: "http://sku.test",
      serviceToken: "tok",
      workspaceKey: "ws",
      fetch: fetchImpl as unknown as typeof fetch,
      timeoutMs: 50,
    });

    const result = await client.listProfiles();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected timeout failure");
    expect(result.status).toBe(408);
    expect(result.error.code).toBe("TIMEOUT");
    expect(result.error.message).toMatch(/timed out/i);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});

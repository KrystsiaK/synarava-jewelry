/**
 * REL-009 — sku-contract client must AbortSignal.timeout and never treat timeout as success.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("sku-contract client timeout (REL-009)", () => {
  it("client fetch uses AbortSignal.timeout and TIMEOUT error code", () => {
    const client = read("packages/sku-contract/src/client.ts");
    const errors = read("packages/sku-contract/src/errors.ts");
    expect(client).toMatch(/AbortSignal\.timeout/);
    expect(client).toMatch(/code:\s*"TIMEOUT"/);
    expect(errors).toMatch(/"TIMEOUT"/);
    // Timeout path must return ok:false, not invent a success envelope.
    expect(client).toMatch(/isAbortOrTimeout[\s\S]*ok:\s*false[\s\S]*code:\s*"TIMEOUT"/);
  });
});

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Admin pages are refreshed by the client (router.refresh) right after a server action returns.
 * A revalidatePath("/admin/...") deferred into after() runs AFTER the response, so the client
 * refetches a still-cached page (stale until the next navigation). Invalidate admin paths before
 * returning; only storefront / heavy work belongs in after().
 */
describe("admin actions invalidate admin pages before the response", () => {
  // Server actions AND the conflict service that finishes Apply for them.
  const dirs = [
    path.resolve(__dirname, ".."),
    path.resolve(__dirname, "../../../../lib/sync/conflicts"),
  ];
  const files = dirs.flatMap((dir) =>
    readdirSync(dir).filter((name) => name.endsWith(".ts")).map((name) => path.join(dir, name)),
  );

  it("finds the action files", () => {
    expect(files.length).toBeGreaterThan(3);
    expect(files.some((file) => file.endsWith(path.join("conflicts", "service.ts")))).toBe(true);
  });

  it("no revalidatePath('/admin…') inside an after(() => …) block", () => {
    const offenders: string[] = [];
    for (const name of files) {
      const source = readFileSync(name, "utf8");
      let cursor = 0;
      while (true) {
        const start = source.indexOf("after(() =>", cursor);
        if (start === -1) break;
        // Block = from `after(` to its matching closing brace (brace counting).
        let depth = 0;
        let end = start;
        for (let i = source.indexOf("{", start); i < source.length; i += 1) {
          if (source[i] === "{") depth += 1;
          if (source[i] === "}") {
            depth -= 1;
            if (depth === 0) { end = i; break; }
          }
        }
        const block = source.slice(start, end);
        if (/revalidatePath\(\s*[`"']\/admin/.test(block)) offenders.push(name);
        cursor = end + 1;
      }
    }
    expect(offenders).toEqual([]);
  });
});

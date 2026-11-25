import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard: ProductPairing is Synarava-only (ADR-0013).
 * Shopify sync / Storefront client layers must never import or name it.
 */

const ROOT = process.cwd();
const FORBIDDEN = /ProductPairing/;

function walkTsFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__") continue;
      files.push(...walkTsFiles(full));
      continue;
    }
    if (/\.(ts|tsx|js|mjs)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      files.push(full);
    }
  }
  return files;
}

describe("ProductPairing sync isolation guard", () => {
  it("never references ProductPairing under lib/shopify or lib/sync", () => {
    const roots = [join(ROOT, "lib/shopify"), join(ROOT, "lib/sync")].filter((path) => {
      try {
        return statSync(path).isDirectory();
      } catch {
        return false;
      }
    });

    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of walkTsFiles(root)) {
        const source = readFileSync(file, "utf8");
        if (FORBIDDEN.test(source)) {
          offenders.push(file.replace(`${ROOT}/`, ""));
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

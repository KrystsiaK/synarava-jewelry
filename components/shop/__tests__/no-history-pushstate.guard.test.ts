import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard: storefront shop/collections must not write filters via bare
 * `window.history.pushState`. URL ownership belongs to `useListState`
 * (site → Next router).
 */

const root = process.cwd();
const SCAN_DIRS = ["components/shop", "components/collections"];
const FORBIDDEN = /history\.pushState\s*\(/;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === "__tests__" || name.endsWith(".test.tsx") || name.endsWith(".test.ts")) {
      continue;
    }
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(full);
  }
  return out;
}

describe("storefront catalog: no bare history.pushState", () => {
  it("components/shop and components/collections never call history.pushState", () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const full of walk(join(root, dir))) {
        const rel = relative(root, full).replaceAll("\\", "/");
        const source = readFileSync(full, "utf8");
        if (FORBIDDEN.test(source)) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * One SoT: conflict / sync signals under components/admin must follow server
 * props via useSyncedState — never `useState(initial…Signals)` which freezes
 * after the first render and ignores router.refresh().
 */

const root = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "dist" || name === ".next") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const FORBIDDEN = /useState\s*\(\s*initial\w*Signals\b/;

describe("admin conflict signals follow server data", () => {
  it("components/admin never use useState(initial…Signals)", () => {
    const violations: string[] = [];
    for (const file of walk(join(root, "components/admin"))) {
      const rel = relative(root, file);
      if (rel.includes("/__tests__/") || rel.includes(".test.") || rel.includes(".stories.")) {
        continue;
      }
      const code = stripComments(readFileSync(file, "utf8"));
      if (FORBIDDEN.test(code)) violations.push(rel);
    }
    expect(violations).toEqual([]);
  });
});

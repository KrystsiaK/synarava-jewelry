import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard: ONE admin date/time display path — lib/format/admin-date.ts.
 * Raw toLocale*String / Intl.DateTimeFormat for dates in admin UI must fail CI.
 * Number formatting (.toLocaleString on counts/amounts) is out of scope.
 */

const root = process.cwd();
const ALLOWED = new Set([
  "lib/format/admin-date.ts",
  "lib/format/__tests__/admin-date.test.ts",
  "lib/format/__tests__/admin-date-display.guard.test.ts",
]);

const SCAN_DIRS = [
  "app/admin",
  "components/admin",
  "components/synarava-cms",
  "lib/admin",
];

/** Date-display patterns — number `.toLocaleString()` on counts/amounts is out of scope. */
const FORBIDDEN = [
  /new\s+Intl\.DateTimeFormat\s*\(/,
  /Intl\.DateTimeFormat\s*\(/,
  /\.toLocaleDateString\s*\(/,
  /\.toLocaleTimeString\s*\(/,
  // `new Date(...).toLocaleString(...)` — date display (any args)
  /new\s+Date\s*\([^)]*\)\s*\.toLocaleString\s*\(/,
];

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".git" || name === "graphify-out" || name === "dist") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(full);
  }
  return out;
}

function stripCommentsAndStrings(source: string): string {
  // Cheap strip so string literals mentioning the APIs don't trip the guard.
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/(['"`])(?:\\.|(?!\1)[\s\S])*\1/g, "\"\"");
}

describe("ONE admin date display guard", () => {
  const files = SCAN_DIRS.flatMap((dir) => walk(join(root, dir))).map((full) => ({
    full,
    rel: relative(root, full).replaceAll("\\", "/"),
  }));

  it("no raw toLocale* / Intl.DateTimeFormat for dates outside lib/format/admin-date.ts", () => {
    const offenders: string[] = [];
    for (const { full, rel } of files) {
      if (ALLOWED.has(rel)) continue;
      if (rel.includes("/__tests__/") || rel.includes(".test.") || rel.includes(".stories.")) continue;
      const source = stripCommentsAndStrings(readFileSync(full, "utf8"));
      for (const pattern of FORBIDDEN) {
        if (pattern.test(source)) offenders.push(`${rel} matches ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const ALLOWED = new Set([
  "lib/products/gallery.ts",
  // Tests may assert on media writes / fixtures.
]);

const WRITE_PATTERNS = [
  /extras\s*:\s*\{[^}]*media\s*:/s,
  /nextExtras\.media\s*=/,
  /extrasRecord,\s*media/,
  /\{\s*\.\.\.extrasRecord,\s*media/,
  /"media"\s*:\s*mediaPatch/,
  /extrasWithMedia\(/,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "graphify-out" || name === "dist") {
      continue;
    }
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    if (name.includes(".test.") || name.includes(".stories.")) continue;
    out.push(full);
  }
  return out;
}

describe("gallery write guard", () => {
  it("nothing outside lib/products/gallery.ts writes extras.media", () => {
    const offenders: string[] = [];
    for (const file of walk(ROOT)) {
      const rel = relative(ROOT, file).replaceAll("\\", "/");
      if (ALLOWED.has(rel)) continue;
      if (rel.startsWith("scripts/")) continue;
      const source = readFileSync(file, "utf8");
      // Ignore comments that mention the rule.
      const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
      const code = withoutBlockComments
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("//"))
        .join("\n");
      if (WRITE_PATTERNS.some((pattern) => pattern.test(code))) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});

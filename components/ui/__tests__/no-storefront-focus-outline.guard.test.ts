/**
 * Guard: storefront buttons/links must not declare per-component focus rings.
 * Visible focus chrome for a/button is owned by one rule in app/globals.css.
 * Allowlist: admin + synarava-cms (keep their indicators), plus explicit input/skip paths.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "components");

const ALLOW_PREFIXES = [
  "admin/",
  "synarava-cms/",
] as const;

/** Paths that may keep focus outline/ring utilities (inputs, skip-link helpers). */
const ALLOW_FILES = new Set<string>([
  // none today — skip-link lives in CSS; storefront inputs use .storefront-field
]);

const FORBIDDEN = /(?:^|[\s"'`])(?:(?:group-|peer-)?focus-visible:outline|(?:group-|peer-)?focus-visible:ring|focus:ring)/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path, out);
      continue;
    }
    if (!/\.(tsx|ts|jsx|js)$/.test(name)) continue;
    if (name.includes(".guard.test.")) continue;
    out.push(path);
  }
  return out;
}

function isAllowlisted(rel: string): boolean {
  if (ALLOW_FILES.has(rel)) return true;
  return ALLOW_PREFIXES.some((prefix) => rel === prefix.slice(0, -1) || rel.startsWith(prefix));
}

describe("storefront focus outline guard", () => {
  it("keeps one shared kill in app/globals.css for storefront buttons/links", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    expect(css).toMatch(
      /body:not\(:has\(\.admin-terminal\)\)\s*:is\([\s\S]*?\[role="button"\][\s\S]*?\):not\(\.skip-link\):focus-visible\s*\{[\s\S]*?outline:\s*none;[\s\S]*?box-shadow:\s*none;/,
    );
    expect(css).toMatch(/:where\(input,\s*select,\s*textarea,\s*\.skip-link\):focus-visible/);
    // Regression: do not restore the old catch-all that painted frames on a/button
    expect(css).not.toMatch(
      /:where\(a,\s*button,\s*input,\s*select,\s*textarea,\s*\[tabindex\]\):focus-visible/,
    );
  });

  it("bans focus-visible:outline / focus-visible:ring / focus:ring under components/ outside allowlist", () => {
    const hits: string[] = [];
    for (const file of walk(ROOT)) {
      const rel = relative(ROOT, file).replaceAll("\\", "/");
      if (isAllowlisted(rel)) continue;
      const source = readFileSync(file, "utf8");
      const lines = source.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (!FORBIDDEN.test(line)) continue;
        hits.push(`${rel}:${i + 1}:${line.trim()}`);
      }
    }
    expect(hits).toEqual([]);
  });
});

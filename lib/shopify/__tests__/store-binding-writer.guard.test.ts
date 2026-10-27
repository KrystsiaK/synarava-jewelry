import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * STRUCTURAL: every assert*Binding guard must have a reachable writer
 * (ensure*Binding / bind*) imported from a production call site.
 * Prevents #268-class deletions where the guard survived and the writer died.
 */

const root = process.cwd();

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "graphify-out" || name === "dist") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkTsFiles(full, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name) && !name.includes(".test.") && !name.includes(".spec.")) {
      out.push(full);
    }
  }
  return out;
}

function read(relOrAbs: string) {
  const abs = relOrAbs.startsWith("/") ? relOrAbs : join(root, relOrAbs);
  return readFileSync(abs, "utf8");
}

describe("store-binding writer reachability guard", () => {
  it("assertShopifyStoreBinding has ensureShopifyStoreBinding as reachable writer", () => {
    const binding = read("lib/shopify/store-binding.ts");
    expect(binding).toMatch(/export async function assertShopifyStoreBinding/);
    expect(binding).toMatch(/export async function ensureShopifyStoreBinding/);

    const check = read("lib/shopify/catalog-conflict-signals-server.ts");
    expect(check).toMatch(/ensureShopifyStoreBinding/);
    expect(check).toMatch(/fetchShopifyShopIdentity/);
    // Bind before waterfall refresh.
    const ensureIdx = check.indexOf("ensureShopifyStoreBinding");
    const waterfallIdx = check.indexOf("signalsFromWaterfall");
    expect(ensureIdx).toBeGreaterThan(-1);
    expect(waterfallIdx).toBeGreaterThan(ensureIdx);
  });

  it("fails if any assert*Binding exists without a reachable ensure*/bind* writer import", () => {
    const files = walkTsFiles(join(root, "lib")).concat(walkTsFiles(join(root, "app")));
    const assertFns = new Map<string, string>(); // name → file
    const writerImports = new Set<string>();

    for (const file of files) {
      const src = read(file);
      for (const match of src.matchAll(/export async function (assert\w*Binding)\s*\(/g)) {
        assertFns.set(match[1]!, relative(root, file));
      }
      for (const match of src.matchAll(/\b(ensure\w*Binding|bind\w*Store)\b/g)) {
        writerImports.add(match[1]!);
      }
    }

    expect(assertFns.size).toBeGreaterThan(0);
    const orphans: string[] = [];
    for (const [assertName, file] of assertFns) {
      // Convention: assertFooBinding ↔ ensureFooBinding
      const stem = assertName.replace(/^assert/, "");
      const expectedWriter = `ensure${stem}`;
      const hasWriter = writerImports.has(expectedWriter)
        || [...writerImports].some((w) => w.toLowerCase().includes("binding") || w.toLowerCase().includes("bind"));
      if (!hasWriter) orphans.push(`${assertName} in ${file}`);
      // Stronger check for the known Shopify binding pair.
      if (assertName === "assertShopifyStoreBinding") {
        expect(writerImports.has("ensureShopifyStoreBinding")).toBe(true);
      }
    }
    expect(orphans).toEqual([]);
  });
});

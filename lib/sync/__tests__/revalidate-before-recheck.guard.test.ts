import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cache invalidation must happen at the write, before any post-action recheck.
 * If the request is cut during recheck, DB already changed — caches must not stay stale.
 */

const root = join(process.cwd());
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

/** Extract the implementation body (skips TypeScript overload signatures). */
function extractFunction(source: string, name: string): string {
  const re = new RegExp(`(?:export\\s+)?async function ${name}\\s*\\(`, "g");
  let match: RegExpExecArray | null;
  let lastImpl: string | null = null;
  while ((match = re.exec(source))) {
    const start = match.index;
    const paramOpen = source.indexOf("(", start);
    let depth = 0;
    let paramClose = -1;
    for (let i = paramOpen; i < source.length; i += 1) {
      if (source[i] === "(") depth += 1;
      else if (source[i] === ")") {
        depth -= 1;
        if (depth === 0) { paramClose = i; break; }
      }
    }
    if (paramClose < 0) continue;
    // Overloads end with `;` after the return type; implementations open `{`.
    let i = paramClose + 1;
    while (i < source.length && /\s/.test(source[i]!)) i += 1;
    if (source[i] === ":") {
      // Skip return type until `;` (overload) or `{` (implementation).
      let typeDepth = 0;
      for (i += 1; i < source.length; i += 1) {
        const ch = source[i]!;
        if (ch === "<" || ch === "(") typeDepth += 1;
        else if (ch === ">" || ch === ")") typeDepth = Math.max(0, typeDepth - 1);
        else if (typeDepth === 0 && (ch === ";" || ch === "{")) break;
      }
      if (source[i] === ";") continue;
    }
    if (source[i] !== "{") continue;
    const braceStart = i;
    depth = 0;
    for (let j = braceStart; j < source.length; j += 1) {
      if (source[j] === "{") depth += 1;
      else if (source[j] === "}") {
        depth -= 1;
        if (depth === 0) {
          lastImpl = source.slice(start, j + 1);
          break;
        }
      }
    }
  }
  if (!lastImpl) throw new Error(`Function ${name} implementation not found`);
  return lastImpl;
}

/** First index of revalidate (path or storefront) vs first recheck call. */
function assertRevalidateBeforeRecheck(
  body: string,
  label: string,
  recheckPattern = /runAfterSaveCatalogConflictCheck\s*\(/,
) {
  const revalidateIdx = Math.min(
    ...["revalidatePath", "revalidateStorefront", "invalidateAfterWrite"]
      .map((token) => {
        const idx = body.search(new RegExp(`\\b${token}\\s*\\(`));
        return idx < 0 ? Number.POSITIVE_INFINITY : idx;
      }),
  );
  const recheckIdx = body.search(recheckPattern);
  expect(revalidateIdx, `${label}: must invalidate caches`).toBeLessThan(Number.POSITIVE_INFINITY);
  expect(recheckIdx, `${label}: must call scoped recheck`).toBeGreaterThanOrEqual(0);
  expect(revalidateIdx, `${label}: revalidate must precede recheck`).toBeLessThan(recheckIdx);
}

describe("revalidate-before-recheck guard", () => {
  it("applyResolution invalidates before scoped recheck; storefront not deferred to after()", () => {
    const service = read("lib/sync/conflicts/service.ts");
    expect(service).toMatch(/function\s+invalidateAfterWrite\s*\(/);
    expect(service).toMatch(/function\s+recheckAppliedEntities\s*\(/);
    expect(service).toMatch(/revalidateStorefront\s*\(\s*\)/);
    // Storefront invalidation must not be deferred (safe-to-lose only).
    expect(service).not.toMatch(/after\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?revalidateStorefront/);
    expect(service).not.toMatch(/from\s+"next\/server"/);

    const body = extractFunction(service, "applyResolution");
    assertRevalidateBeforeRecheck(body, "applyResolution", /recheckAppliedEntities\s*\(/);
    const recheckHelper = extractFunction(service, "recheckAppliedEntities");
    expect(recheckHelper).toMatch(/runAfterSaveCatalogConflictCheck\s*\(/);
  });

  it("push / pull / save / SKU actions invalidate before scoped recheck", () => {
    const sites: Array<{ file: string; fn: string }> = [
      { file: "app/admin/actions/sync.ts", fn: "pushSingleProductToShopifyAction" },
      { file: "app/admin/actions/sync.ts", fn: "pullSingleProductFromShopifyAction" },
      { file: "app/admin/actions/products.ts", fn: "saveProductAction" },
      { file: "app/admin/actions/collections.ts", fn: "saveCollectionAction" },
      { file: "app/admin/actions/sku-assign.ts", fn: "assignProductSkuAction" },
      { file: "app/admin/actions/sku-assign.ts", fn: "resumePendingSkuAction" },
    ];
    for (const site of sites) {
      const body = extractFunction(read(site.file), site.fn);
      assertRevalidateBeforeRecheck(body, `${site.fn} in ${site.file}`);
    }
  });

  it("deleteLocalCollection is reached only via Apply write phase that invalidates before recheck", () => {
    const presence = read("lib/shopify/collection-presence-server.ts");
    expect(presence).toMatch(/async function deleteLocalCollection\s*\(/);
    expect(presence).toMatch(/await\s+deleteLocalCollection\s*\(/);
    // Apply orchestration owns invalidation (not a second mechanism here).
    const service = read("lib/sync/conflicts/service.ts");
    const body = extractFunction(service, "applyResolution");
    expect(body).toMatch(/invalidateAfterWrite\s*\(/);
    assertRevalidateBeforeRecheck(
      body,
      "applyResolution covers Take-Shopify delete",
      /recheckAppliedEntities\s*\(/,
    );
  });
});

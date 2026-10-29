#!/usr/bin/env node
/**
 * Post-release storefront smoke checks (read-only GET / navigation).
 *
 * Usage:
 *   node scripts/release/post-release-check.mjs --base-url <url> [--expect-sha <8chars>]
 *
 * Does not buy, login, or mutate commerce data. Owner/architect runs this
 * against prod or staging after a release — not CI.
 *
 * @see docs/runbooks/release-prod.md
 */
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const PRODUCT_COUNT_RE = /(\d+)\s+products?/i;
const EXPECT_SHA_RE = /^[0-9a-f]{8}$/i;

/**
 * @param {string[]} argv
 * @returns {{ baseUrl: string, expectSha: string | null }}
 */
export function parseArgs(argv) {
  let baseUrl = null;
  let expectSha = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--base-url") {
      baseUrl = argv[++i];
      continue;
    }
    if (arg.startsWith("--base-url=")) {
      baseUrl = arg.slice("--base-url=".length);
      continue;
    }
    if (arg === "--expect-sha") {
      expectSha = argv[++i];
      continue;
    }
    if (arg.startsWith("--expect-sha=")) {
      expectSha = arg.slice("--expect-sha=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!baseUrl || !String(baseUrl).trim()) {
    throw new Error("--base-url is required (no default)");
  }

  let origin;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    throw new Error(`--base-url is not a valid URL: ${baseUrl}`);
  }

  if (expectSha != null && expectSha !== "") {
    const sha = String(expectSha).trim();
    if (!EXPECT_SHA_RE.test(sha)) {
      throw new Error("--expect-sha must be exactly 8 hex characters when provided");
    }
    expectSha = sha.toLowerCase();
  } else {
    expectSha = null;
  }

  return { baseUrl: origin, expectSha };
}

/**
 * @param {string | null | undefined} text
 * @returns {number | null}
 */
function parseProductCount(text) {
  if (!text) return null;
  const match = text.match(PRODUCT_COUNT_RE);
  if (!match) return null;
  const count = Number(match[1]);
  return Number.isFinite(count) ? count : null;
}

/**
 * @param {string} color
 * @returns {number | null}
 */
export function alphaFromComputedColor(color) {
  const v = String(color ?? "").trim().toLowerCase();
  if (!v || v === "transparent") return 0;

  const rgba = v.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/,
  );
  if (rgba) {
    if (rgba[4] === undefined) return 1;
    const raw = rgba[4];
    return raw.endsWith("%") ? Number(raw.slice(0, -1)) / 100 : Number(raw);
  }

  // Modern: rgb(r g b / a) or color(srgb … / a)
  const slash = v.match(/\/\s*([\d.]+%?)\s*\)\s*$/);
  if (slash) {
    const raw = slash[1];
    return raw.endsWith("%") ? Number(raw.slice(0, -1)) / 100 : Number(raw);
  }

  const hex8 = v.match(/^#([0-9a-f]{8})$/i);
  if (hex8) return Number.parseInt(hex8[1].slice(6, 8), 16) / 255;

  const hex4 = v.match(/^#([0-9a-f]{4})$/i);
  if (hex4) {
    const a = hex4[1][3];
    return Number.parseInt(a + a, 16) / 255;
  }

  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return 1;

  return null;
}

/**
 * @typedef {{ name: string, ok: boolean, detail: string }} CheckResult
 */

/**
 * @param {string} baseUrl
 * @returns {Promise<CheckResult>}
 */
async function checkHealth(baseUrl) {
  const name = "GET /api/health → 200";
  try {
    const res = await fetch(new URL("/api/health", baseUrl), {
      method: "GET",
      redirect: "manual",
      headers: { Accept: "application/json" },
    });
    if (res.status !== 200) {
      return { name, ok: false, detail: `status ${res.status}` };
    }
    return { name, ok: true, detail: "200" };
  } catch (err) {
    return { name, ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * @param {string} baseUrl
 * @param {string} path
 * @param {string | null} expectSha
 * @returns {Promise<CheckResult>}
 */
async function checkLocaleHome(baseUrl, path, expectSha) {
  const shaHint = expectSha ? ` + dpl=${expectSha}` : "";
  const name = `GET ${path} → 200${shaHint}`;
  try {
    const res = await fetch(new URL(path, baseUrl), {
      method: "GET",
      redirect: "follow",
      headers: { Accept: "text/html" },
    });
    if (res.status !== 200) {
      return { name, ok: false, detail: `status ${res.status}` };
    }
    const html = await res.text();
    if (expectSha) {
      const needle = `dpl=${expectSha}`;
      if (!html.includes(needle)) {
        return { name, ok: false, detail: `HTML missing ${needle}` };
      }
      return { name, ok: true, detail: `200, found ${needle}` };
    }
    return { name, ok: true, detail: "200" };
  } catch (err) {
    return { name, ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * @param {import('@playwright/test').Page} page
 */
async function clearCatalogViewIndexedDb(page) {
  await page.evaluate(async () => {
    const dbName = "synarava-catalog-view";
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(dbName);
      req.onsuccess = () => resolve(undefined);
      req.onerror = () => reject(req.error ?? new Error("indexedDB.deleteDatabase failed"));
      req.onblocked = () => resolve(undefined);
    });
  });
}

/**
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number>}
 */
async function readShowingCount(page) {
  const counter = page.locator('[aria-live="polite"]').filter({ hasText: PRODUCT_COUNT_RE }).first();
  await counter.waitFor({ state: "visible", timeout: 15_000 });
  const count = parseProductCount(await counter.innerText());
  if (count === null) throw new Error("could not parse Showing N products counter");
  return count;
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} expected
 */
async function expectFilteredEqualsTile(page, expected) {
  const grid = page.locator("#shop-product-grid");
  await grid.waitFor({ state: "visible", timeout: 15_000 });

  const cards = page.locator("#shop-product-grid [data-product-id]");
  await cards.first().waitFor({ state: "visible", timeout: 15_000 });

  const cardCount = await cards.count();
  if (cardCount !== expected) {
    throw new Error(`card count ${cardCount} !== tile ${expected}`);
  }

  const label = new RegExp(`\\b${expected}\\s+product${expected === 1 ? "" : "s"}\\b`, "i");
  const counter = page.locator('[aria-live="polite"]').filter({ hasText: PRODUCT_COUNT_RE }).first();
  await counter.waitFor({ state: "visible", timeout: 15_000 });
  // Retry briefly while the filtered catalog remounts.
  const deadline = Date.now() + 15_000;
  let last = "";
  while (Date.now() < deadline) {
    last = await counter.innerText();
    if (label.test(last)) return;
    await page.waitForTimeout(200);
  }
  throw new Error(`counter text "${last}" does not match tile count ${expected}`);
}

/**
 * @param {string} baseUrl
 * @returns {Promise<CheckResult>}
 */
async function checkShopFilter(baseUrl) {
  const name = "Shop /en/shop product-type filter + reload + back";
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();

    // Open origin first so IndexedDB clear applies to the shop origin.
    await page.goto(new URL("/en/shop", baseUrl).href, { waitUntil: "domcontentloaded" });
    await clearCatalogViewIndexedDb(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    await page.locator("#shop-products").waitFor({ state: "visible", timeout: 15_000 });
    const unfilteredCount = await readShowingCount(page);
    if (unfilteredCount <= 0) {
      throw new Error(`unfiltered Showing count must be > 0, got ${unfilteredCount}`);
    }

    const tiles = page
      .locator("#shop-product-type-title")
      .locator("xpath=ancestor::section[1]")
      .locator('a[href*="productType="]');
    await tiles.first().waitFor({ state: "visible", timeout: 15_000 });
    const tileCount = await tiles.count();

    /** @type {{ index: number, count: number, href: string } | null} */
    let best = null;
    for (let i = 0; i < tileCount; i += 1) {
      const tile = tiles.nth(i);
      const count = parseProductCount(await tile.innerText());
      if (count === null || count <= 0) continue;
      if (!best || count < best.count) {
        const href = (await tile.getAttribute("href")) ?? "";
        best = { index: i, count, href };
      }
    }

    if (!best || best.count >= unfilteredCount) {
      throw new Error(
        "no product-type tile with positive count strictly below unfiltered total",
      );
    }
    if (!/productType=/.test(best.href)) {
      throw new Error(`tile href missing productType=: ${best.href}`);
    }

    await tiles.nth(best.index).click();
    await page.waitForURL(/productType=/, { timeout: 15_000 });
    await page.locator("#shop-products").waitFor({ state: "visible", timeout: 15_000 });
    await expectFilteredEqualsTile(page, best.count);
    if (!(best.count < unfilteredCount)) {
      throw new Error(`filtered ${best.count} is not < unfiltered ${unfilteredCount}`);
    }

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForURL(/productType=/, { timeout: 15_000 });
    await expectFilteredEqualsTile(page, best.count);

    await page.goBack();
    await page.waitForURL((url) => !url.searchParams.has("productType"), { timeout: 15_000 });
    const restored = await readShowingCount(page);
    if (restored !== unfilteredCount) {
      throw new Error(`back restored Showing ${restored}, expected ${unfilteredCount}`);
    }

    return {
      name,
      ok: true,
      detail: `total=${unfilteredCount}, tile=${best.count}, reload+back ok`,
    };
  } catch (err) {
    return { name, ok: false, detail: err instanceof Error ? err.message : String(err) };
  } finally {
    await browser.close();
  }
}

/**
 * @param {string} baseUrl
 * @returns {Promise<CheckResult>}
 */
async function checkFooterWordmark(baseUrl) {
  const name = "Footer wordmark color alpha < 0.1";
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(new URL("/en", baseUrl).href, { waitUntil: "domcontentloaded" });
    const wordmark = page.locator(".artifact-footer__wordmark").first();
    await wordmark.waitFor({ state: "attached", timeout: 15_000 });

    const color = await wordmark.evaluate((el) => getComputedStyle(el).color);
    const alpha = alphaFromComputedColor(color);
    if (alpha === null || !Number.isFinite(alpha)) {
      throw new Error(`could not parse computed color: ${color}`);
    }
    if (!(alpha < 0.1)) {
      throw new Error(`alpha ${alpha} is not < 0.1 (color=${color})`);
    }
    return { name, ok: true, detail: `alpha=${alpha.toFixed(4)} color=${color}` };
  } catch (err) {
    return { name, ok: false, detail: err instanceof Error ? err.message : String(err) };
  } finally {
    await browser.close();
  }
}

/**
 * @param {CheckResult[]} results
 */
export function printTable(results) {
  const rows = results.map((r) => ({
    STATUS: r.ok ? "PASS" : "FAIL",
    CHECK: r.name,
    DETAIL: r.detail,
  }));
  const widths = {
    STATUS: Math.max(6, ...rows.map((r) => r.STATUS.length)),
    CHECK: Math.max(5, ...rows.map((r) => r.CHECK.length)),
    DETAIL: Math.max(6, ...rows.map((r) => r.DETAIL.length)),
  };
  const pad = (s, w) => s + " ".repeat(Math.max(0, w - s.length));
  const line = (r) =>
    `${pad(r.STATUS, widths.STATUS)}  ${pad(r.CHECK, widths.CHECK)}  ${pad(r.DETAIL, widths.DETAIL)}`;
  const header = line({ STATUS: "STATUS", CHECK: "CHECK", DETAIL: "DETAIL" });
  const rule = "-".repeat(header.length);
  console.log(rule);
  console.log(header);
  console.log(rule);
  for (const r of rows) console.log(line(r));
  console.log(rule);
  const failed = results.filter((r) => !r.ok).length;
  const passed = results.length - failed;
  console.log(`${passed} passed, ${failed} failed`);
}

/**
 * @param {{ baseUrl: string, expectSha: string | null }} opts
 * @returns {Promise<CheckResult[]>}
 */
export async function runChecks(opts) {
  const { baseUrl, expectSha } = opts;
  /** @type {CheckResult[]} */
  const results = [];

  results.push(await checkHealth(baseUrl));
  results.push(await checkLocaleHome(baseUrl, "/en", expectSha));
  results.push(await checkLocaleHome(baseUrl, "/pt", expectSha));
  results.push(await checkShopFilter(baseUrl));
  results.push(await checkFooterWordmark(baseUrl));

  return results;
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error(
      "Usage: node scripts/release/post-release-check.mjs --base-url <url> [--expect-sha <8chars>]",
    );
    process.exit(1);
  }

  console.log(`post-release-check base-url=${opts.baseUrl}` +
    (opts.expectSha ? ` expect-sha=${opts.expectSha}` : ""));

  const results = await runChecks(opts);
  printTable(results);
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

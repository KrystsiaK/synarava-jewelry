import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural guard: after Option A, no application code may target
 * ProductTranslation / CollectionTranslation / PageTranslation rows with
 * locale = 'en'. English lives on base columns only.
 *
 * Allowed: prisma migration SQL, scripts/db check/rollback SQL, this test.
 */

const root = process.cwd();

const ALLOW_PATH_PREFIXES = [
  "prisma/migrations/",
  "scripts/db/",
];

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mjs", ".js"]);

function isTestPath(rel: string): boolean {
  return (
    rel.includes("/__tests__/")
    || rel.endsWith(".test.ts")
    || rel.endsWith(".test.tsx")
    || rel.endsWith(".test.mjs")
    || rel.endsWith(".spec.ts")
    || rel.endsWith(".spec.tsx")
  );
}

/** Prisma accessors that would load or mutate a locale='en' translation row. */
const TRANSLATION_ACCESS =
  "(?:upsert|create|update|updateMany|findMany|findUnique|findFirst|deleteMany|delete)";

const FORBIDDEN = [
  {
    name: "productTranslation accessor + locale en",
    re: new RegExp(
      String.raw`productTranslation\.${TRANSLATION_ACCESS}[\s\S]{0,320}locale\s*:\s*["']en["']|locale\s*:\s*["']en["'][\s\S]{0,320}productTranslation\.${TRANSLATION_ACCESS}`,
      "i",
    ),
  },
  {
    name: "collectionTranslation accessor + locale en",
    re: new RegExp(
      String.raw`collectionTranslation\.${TRANSLATION_ACCESS}[\s\S]{0,320}locale\s*:\s*["']en["']|locale\s*:\s*["']en["'][\s\S]{0,320}collectionTranslation\.${TRANSLATION_ACCESS}`,
      "i",
    ),
  },
  {
    name: "pageTranslation accessor + locale en",
    re: new RegExp(
      String.raw`pageTranslation\.${TRANSLATION_ACCESS}[\s\S]{0,320}locale\s*:\s*["']en["']|locale\s*:\s*["']en["'][\s\S]{0,320}pageTranslation\.${TRANSLATION_ACCESS}`,
      "i",
    ),
  },
  {
    name: "translations.find locale === en",
    re: /translations\.find\([^)]*locale\s*===\s*["']en["']/,
  },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === "graphify-out" || entry === "coverage" || entry === ".next") {
      continue;
    }
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else {
      const rel = relative(root, full).replaceAll("\\", "/");
      const ext = rel.slice(rel.lastIndexOf("."));
      if (SOURCE_EXTENSIONS.has(ext)) out.push(rel);
    }
  }
  return out;
}

function isAllowed(rel: string): boolean {
  return ALLOW_PATH_PREFIXES.some((prefix) => rel === prefix || rel.startsWith(prefix));
}

describe("no en translation rows (structural guard)", () => {
  it("application code never references Product/Collection/PageTranslation locale=en", () => {
    const files = walk(root).filter((rel) => !isAllowed(rel) && !isTestPath(rel));
    const violations: string[] = [];

    for (const rel of files) {
      const source = readFileSync(join(root, rel), "utf8");
      for (const rule of FORBIDDEN) {
        if (rule.re.test(source)) {
          violations.push(`${rel}: ${rule.name}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

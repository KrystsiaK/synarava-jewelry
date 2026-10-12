import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, ".");

const FORBIDDEN = [
  /from\s+['"]@?prisma/,
  /from\s+['"]next/,
  /from\s+['"]react/,
  /from\s+['"]@\/,/,
  /from\s+['"].*shopify/i,
  /from\s+['"]hono/,
  /from\s+['"]express/,
  /from\s+['"]fastify/,
];

function listTsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listTsFiles(path);
    if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      return [path];
    }
    return [];
  });
}

describe("sku-core import boundary", () => {
  it("has no Shopify / Next / Prisma / HTTP framework imports", () => {
    const files = listTsFiles(SRC);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN) {
        expect(source, `${file} matched ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});

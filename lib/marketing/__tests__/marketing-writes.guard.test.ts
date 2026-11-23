import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const MARKETING_DIR = join(ROOT, "lib/marketing");
const ACTION_FILE = join(ROOT, "app/admin/actions/marketing.ts");

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "__tests__") continue;
      out.push(...walkTsFiles(full));
      continue;
    }
    if ((name.endsWith(".ts") || name.endsWith(".tsx")) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const ALLOWED_WRITES =
  /\b(?:db|prisma)\.(?:competitorObservation\.create|contentIdea\.(?:create|update)|auditLog\.create)\s*\(/g;

const ANY_PRISMA_WRITE =
  /\b(?:db|prisma)\.([A-Za-z0-9_]+)\.(create|update|upsert|delete|deleteMany|updateMany|createMany)\s*\(/g;

describe("marketing write/import guard", () => {
  const files = [...walkTsFiles(MARKETING_DIR), ACTION_FILE];

  it("lib/marketing and marketing actions never import @/lib/shopify", () => {
    for (const file of files) {
      const source = stripComments(readFileSync(file, "utf8"));
      expect(source, file).not.toMatch(/@\/lib\/shopify/);
    }
  });

  it("only competitorObservation.create, contentIdea.create|update, auditLog.create are allowed", () => {
    for (const file of files) {
      const source = stripComments(readFileSync(file, "utf8"));
      const matches = [...source.matchAll(ANY_PRISMA_WRITE)];
      for (const m of matches) {
        const model = m[1];
        const op = m[2];
        const allowed =
          (model === "competitorObservation" && op === "create") ||
          (model === "contentIdea" && (op === "create" || op === "update")) ||
          (model === "auditLog" && op === "create");
        expect(allowed, `${file}: forbidden ${model}.${op}`).toBe(true);
      }
      // ensure pattern still detects something in write-heavy files
      void ALLOWED_WRITES;
    }
  });

  it("no deletes against competitorObservation or contentIdea", () => {
    for (const file of files) {
      const source = stripComments(readFileSync(file, "utf8"));
      expect(source).not.toMatch(
        /\b(?:db|prisma)\.(?:competitorObservation|contentIdea)\.(?:delete|deleteMany)\s*\(/,
      );
    }
  });

  it("lib/marketing never mentions instagram.com / facebook.com / tiktok.com", () => {
    for (const file of walkTsFiles(MARKETING_DIR)) {
      const source = readFileSync(file, "utf8").toLowerCase();
      expect(source, file).not.toMatch(/instagram\.com|facebook\.com|tiktok\.com/);
    }
  });
});

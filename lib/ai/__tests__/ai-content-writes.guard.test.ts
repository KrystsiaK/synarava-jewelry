import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const AI_DIR = join(ROOT, "lib/ai");
const ACTION_FILE = join(ROOT, "app/admin/actions/ai-content.ts");

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
    if (name.endsWith(".ts") && !name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const FORBIDDEN_PRISMA_WRITES =
  /\b(?:db|prisma)\.(?!auditLog\b)[A-Za-z0-9_]+\.(?:create|update|upsert|delete|deleteMany|updateMany|createMany)\s*\(/g;

const AUDIT_CREATE = /\b(?:db|prisma)\.auditLog\.create\s*\(/g;

describe("AI content write/import guard", () => {
  const files = [...walkTsFiles(AI_DIR), ACTION_FILE];

  it("lib/ai and ai-content.ts never import @/lib/shopify", () => {
    for (const file of files) {
      const source = stripComments(readFileSync(file, "utf8"));
      expect(source, file).not.toMatch(/@\/lib\/shopify/);
    }
  });

  it("only auditLog.create is allowed as a Prisma write", () => {
    for (const file of files) {
      const source = stripComments(readFileSync(file, "utf8"));
      const forbidden = source.match(FORBIDDEN_PRISMA_WRITES) ?? [];
      expect(forbidden, `${file} forbidden writes: ${forbidden.join(", ")}`).toEqual([]);
    }
  });

  it("budget path uses auditLog.create for usage telemetry", () => {
    const budget = readFileSync(join(AI_DIR, "product-content/budget.ts"), "utf8");
    expect(stripComments(budget).match(AUDIT_CREATE)?.length ?? 0).toBeGreaterThanOrEqual(1);
  });
});

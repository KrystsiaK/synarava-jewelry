import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-0009: workingSnapshot column is gone. Production code under lib/ and
 * app/admin must not write `workingSnapshot:` in Prisma create/update data.
 * Mentions in comments, docs, archive helpers, function params, and debug
 * payloads that expose the *derived* OUR window are OK.
 */

const root = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "dist" || name === ".next" || name === "graphify-out") {
      continue;
    }
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** Extract brace-balanced `{...}` starting at `openBrace`. */
function braceBlock(source: string, openBrace: number): string | null {
  if (source[openBrace] !== "{") return null;
  let depth = 0;
  for (let i = openBrace; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(openBrace, i + 1);
    }
  }
  return null;
}

/** True when any Prisma mutation `data: { ... }` block writes workingSnapshot. */
function hasWorkingSnapshotPrismaWrite(source: string): boolean {
  const callRe = /(?:db\.\w+|tx\.\w+)\.(?:update|create|upsert|createMany|updateMany)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = callRe.exec(source)) !== null) {
    const callStart = match.index;
    // Limit search to the call's argument list (next 2k chars is enough for our code).
    const window = source.slice(callStart, callStart + 2500);
    const dataIdx = window.search(/\bdata\s*:/);
    if (dataIdx < 0) continue;
    const braceStart = window.indexOf("{", dataIdx);
    if (braceStart < 0) continue;
    const block = braceBlock(window, braceStart);
    if (block && /\bworkingSnapshot\s*:/.test(block)) return true;
  }
  return false;
}

describe("no workingSnapshot Prisma writes (ADR-0009)", () => {
  it("lib/ and app/admin never write workingSnapshot in Prisma data", () => {
    const violations: string[] = [];
    for (const base of ["lib", "app/admin"]) {
      const dir = join(root, base);
      for (const file of walk(dir)) {
        const rel = relative(root, file);
        if (rel.includes("/__tests__/") || rel.includes(".test.") || rel.includes(".stories.")) {
          continue;
        }
        const code = stripComments(readFileSync(file, "utf8"));
        if (hasWorkingSnapshotPrismaWrite(code)) violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });

  it("auto-sync forbidden refresh keys still include workingSnapshot", () => {
    const source = readFileSync(
      join(root, "lib/shopify/__tests__/auto-sync-no-synarava-writers.guard.test.ts"),
      "utf8",
    );
    expect(source).toMatch(/FORBIDDEN_REFRESH_DATA_KEYS[\s\S]*?"workingSnapshot"/);
  });
});

/**
 * REL-010 — owner must have a documented Railway cron for sync-history drain.
 * Docs-only fix: no new infra in code; runbook is the deliverable.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const RUNBOOK = join(root, "docs/runbooks/sync-history-cleanup-railway.md");
const SCRIPT = "scripts/db/cleanup-sync-history.mjs";

describe("REL-010 sync-history cleanup runbook", () => {
  it("documents the Railway cron + cleanup script for the owner", () => {
    expect(existsSync(RUNBOOK), "missing sync-history-cleanup-railway.md").toBe(true);
    const text = readFileSync(RUNBOOK, "utf8");
    expect(text).toMatch(/REL-010/);
    expect(text).toContain(SCRIPT);
    expect(text).toMatch(/Cron schedule/i);
    expect(text).toMatch(/0 4 \* \* 0/);
    expect(text).toMatch(/DATABASE_URL/);
    expect(text).toMatch(/staging first/i);
    expect(existsSync(join(root, SCRIPT)), "cleanup script must exist").toBe(true);
  });
});

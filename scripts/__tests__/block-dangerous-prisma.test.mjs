import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isDangerousPrisma } from "../../.codex/hooks/block-dangerous-prisma.mjs";

// vitest runs from the repository root; import.meta.url is rewritten in its jsdom environment.
const HOOK = resolve(process.cwd(), ".codex/hooks/block-dangerous-prisma.mjs");

describe("block-dangerous-prisma", () => {
  it.each([
    "npx prisma migrate dev",
    "pnpm exec prisma db push",
    "pnpm prisma migrate reset --force",
    "npx prisma@6.19.3 db push",
    "./node_modules/.bin/prisma migrate dev --name x",
    'bash -c "npx prisma db execute --file x.sql"',
    "cd app && npx prisma migrate dev",
    "prisma migrate diff --from-empty --to-schema-datamodel p.prisma --shadow-database-url x",
  ])("blocks: %s", (command) => {
    expect(isDangerousPrisma(command)).toBe(true);
  });

  it.each([
    "pnpm prisma:migrate",
    "pnpm prisma:push",
    "pnpm prisma:deploy",
    "npx prisma migrate deploy",
    "npx prisma migrate status",
    "npx prisma generate",
    "node scripts/db-guard.mjs db push",
    'git commit -m "docs: never run prisma migrate dev on prod"',
    'gh pr create --body "avoid prisma db push"',
    "",
  ])("allows: %s", (command) => {
    expect(isDangerousPrisma(command)).toBe(false);
  });

  it("denies through stdin in the PreToolUse format", () => {
    const run = (command) =>
      spawnSync("node", [HOOK], {
        input: JSON.stringify({ tool_input: { command } }),
        encoding: "utf8",
      });

    const denied = JSON.parse(run("npx prisma db push").stdout);
    expect(denied.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(run("pnpm prisma:deploy").stdout).toBe("");
    expect(spawnSync("node", [HOOK], { input: "not json", encoding: "utf8" }).status).toBe(0);
  });

  it("blocks through the Cursor adapter with exit code 2", () => {
    const adapter = resolve(
      process.cwd(),
      ".cursor/hooks/before-shell-execution-block-dangerous-prisma.js",
    );
    const run = (command) =>
      spawnSync("node", [adapter], { input: JSON.stringify({ command }), encoding: "utf8" });

    const denied = run("npx prisma migrate dev");
    expect(denied.status).toBe(2);
    expect(denied.stderr).toContain("BLOCKED");

    const allowed = run("pnpm prisma:deploy");
    expect(allowed.status).toBe(0);
    expect(allowed.stdout).toContain("pnpm prisma:deploy");
  });
});

#!/usr/bin/env node
/**
 * PreToolUse hook (Claude Code and Codex): blocks Bash commands that run Prisma
 * subcommands able to wipe a database.
 *
 *   prisma migrate dev | migrate reset | db push | db execute
 *   any command carrying --shadow-database-url (Prisma always wipes a shadow DB)
 *
 * Allowed on purpose: migrate deploy/status, generate, the guarded wrappers
 * `pnpm prisma:migrate` / `pnpm prisma:push` (scripts/db-guard.mjs refuses a
 * non-local database), and git/gh commands whose text only mentions these words.
 * The database role is the hard wall; this hook catches mistakes before they run.
 */
import { pathToFileURL } from "node:url";

export const REASON =
  "BLOCKED: this Prisma command can wipe a database (migrate dev/reset, db push/execute, " +
  "--shadow-database-url). Use `pnpm prisma:migrate` or `pnpm prisma:push` against a local " +
  "database, or `prisma migrate deploy` for existing migrations. Nothing was executed.";

const DANGEROUS_SUBCOMMAND =
  /(?:^|[\s;&|"'`(])(?:[\w.@/-]*\/)?prisma(?:@[\w.-]+)?\s+(?:migrate\s+(?:dev|reset)|db\s+(?:push|execute))\b/i;
const SHADOW_FLAG = /--shadow-database-url\b/i;

export function isDangerousPrisma(command) {
  const text = String(command ?? "").normalize("NFKC").trim();
  if (/^(git|gh)\s/.test(text)) return false;
  return DANGEROUS_SUBCOMMAND.test(text) || SHADOW_FLAG.test(text);
}

async function readStdin() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input;
}

async function main() {
  let command = "";
  try {
    const payload = JSON.parse(await readStdin());
    command = payload?.tool_input?.command ?? "";
  } catch {
    return; // unreadable input is not a Prisma command; never block unrelated tools
  }

  if (isDangerousPrisma(command)) {
    process.stdout.write(
      JSON.stringify({
        systemMessage: REASON,
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: REASON,
        },
      }),
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();

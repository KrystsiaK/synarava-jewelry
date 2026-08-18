#!/usr/bin/env node

const BLOCK_REASON =
  "BLOCKED: access to .env* files is prohibited by the Synarava repository hook. " +
  "The tool was stopped before it could run; no environment secret was read or changed.";

async function readStdin() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input;
}

function collectStrings(value, output = []) {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output);
    return output;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, output);
  }

  return output;
}

function referencesProtectedEnvironmentFile(value) {
  const normalized = value
    .normalize("NFKC")
    .replaceAll("\\\\", "/")
    .toLowerCase();

  // Protect every path whose basename starts with `.env`, including shell
  // globs and environment-specific files such as `.env.production`.
  return /(^|[\s/"'=:(])\.env/.test(normalized);
}

function deny() {
  process.stdout.write(
    JSON.stringify({
      systemMessage: BLOCK_REASON,
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: BLOCK_REASON,
      },
    }),
  );
}

try {
  const payload = JSON.parse(await readStdin());
  const toolInput = payload?.tool_input ?? {};
  const attemptedAccess = collectStrings(toolInput).some(
    referencesProtectedEnvironmentFile,
  );

  if (attemptedAccess) deny();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Environment protection hook failed closed: ${message}\n`);
  process.exitCode = 2;
}

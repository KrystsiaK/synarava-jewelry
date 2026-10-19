#!/usr/bin/env node
/**
 * Cursor adapter for .codex/hooks/block-dangerous-prisma.mjs.
 *
 * Cursor sends `{ command }` on stdin for beforeShellExecution; exit code 2
 * blocks the command (same contract as before-shell-execution-block-no-verify).
 * The matching logic lives in the shared .codex hook so Claude Code, Codex and
 * Cursor stay on one implementation.
 *
 * A broken import must not silently disable the guard, so failures are written
 * to stderr (visible in the Cursor hook log) before falling through.
 */

'use strict';

const { readStdin } = require('./adapter');

readStdin()
  .then(async raw => {
    let command = '';
    try {
      const parsed = JSON.parse(raw || '{}');
      command = String(parsed.command || parsed.args?.command || '');
    } catch {
      command = String(raw || '');
    }

    const { isDangerousPrisma, REASON } = await import('../../.codex/hooks/block-dangerous-prisma.mjs');
    if (isDangerousPrisma(command)) {
      process.stderr.write(REASON + '\n');
      process.exit(2);
    }

    process.stdout.write(raw);
  })
  .catch(error => {
    process.stderr.write(`block-dangerous-prisma adapter failed (guard NOT applied): ${error?.message || error}\n`);
    process.exit(0);
  });

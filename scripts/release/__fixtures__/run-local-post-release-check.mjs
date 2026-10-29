#!/usr/bin/env node
/**
 * Localhost-only harness: start mock storefront, run post-release-check, exit.
 * Refuses non-loopback base URLs. Never points at prod/staging.
 */
import { pathToFileURL } from "node:url";
import { startMockServer } from "./post-release-mock-server.mjs";
import { parseArgs, printTable, runChecks } from "../post-release-check.mjs";

function isLoopback(urlString) {
  try {
    const host = new URL(urlString).hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  } catch {
    return false;
  }
}

async function main() {
  const mock = await startMockServer({ expectSha: "abcdef12" });
  if (!isLoopback(mock.baseUrl)) {
    await mock.close();
    throw new Error(`refusing non-loopback mock URL: ${mock.baseUrl}`);
  }

  console.log(`local harness mock=${mock.baseUrl}`);

  const opts = parseArgs(["--base-url", mock.baseUrl, "--expect-sha", mock.expectSha]);
  if (!isLoopback(opts.baseUrl)) {
    await mock.close();
    throw new Error(`refusing non-loopback --base-url: ${opts.baseUrl}`);
  }

  try {
    const results = await runChecks(opts);
    printTable(results);
    const ok = results.every((r) => r.ok);
    await mock.close();
    process.exit(ok ? 0 : 1);
  } catch (err) {
    await mock.close();
    throw err;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

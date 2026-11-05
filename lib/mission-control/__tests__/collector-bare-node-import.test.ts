import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

/**
 * Guard: collector cron runs bare Node 22 with register.mjs / loader.mjs
 * (no Next bundler, no vitest `server-only` alias). Import graph must resolve.
 */
describe("mission-control collector bare-Node import graph", () => {
  it("resolves run-once via loader.mjs without ERR_MODULE_NOT_FOUND", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--import",
        "./services/mission-control-collector/register.mjs",
        "./services/mission-control-collector/check-import.ts",
      ],
      {
        cwd: ROOT,
        encoding: "utf8",
        env: {
          ...process.env,
          // Prisma may construct a client at import; never hit a real DB.
          DATABASE_URL:
            process.env.DATABASE_URL ??
            "postgresql://mc_check_import:unused@127.0.0.1:1/mc_check_import",
        },
        timeout: 60_000,
      },
    );

    const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    expect(
      combined,
      "bare-Node collector import must not miss modules",
    ).not.toMatch(/ERR_MODULE_NOT_FOUND/);
    expect(
      result.status,
      `check-import exit ${result.status}\n${combined}`,
    ).toBe(0);
    expect(combined).toContain("mission-control-collector check-import: ok");
  });
});

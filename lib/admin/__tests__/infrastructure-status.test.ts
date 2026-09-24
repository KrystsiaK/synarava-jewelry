import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();
const headBucketSend = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { $queryRaw: (...args: unknown[]) => queryRaw(...args) },
}));

vi.mock("@/lib/s3", () => ({
  getS3Config: () => ({
    region: "auto",
    bucket: "synarava-media",
    endpoint: "https://example.storage.test",
    publicUrl: null,
    accessKeyId: "key",
    secretAccessKey: "secret", // pragma: allowlist secret
    forcePathStyle: true,
    useProxy: false,
  }),
  getS3: () => ({ send: headBucketSend }),
}));

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

import {
  collectPostgresStatus,
  collectS3Status,
  getInfrastructureStatusFresh,
} from "@/lib/admin/infrastructure-status";

function sqlText(args: unknown[]): string {
  const head = args[0];
  if (Array.isArray(head)) {
    return (head as TemplateStringsArray).join("?");
  }
  if (head && typeof head === "object" && "strings" in head) {
    return (head as { strings: TemplateStringsArray }).strings.join("?");
  }
  return String(head ?? "");
}

describe("infrastructure-status", () => {
  beforeEach(() => {
    queryRaw.mockReset();
    headBucketSend.mockReset();
    delete process.env.RAILWAY_TOKEN;
    delete process.env.RAILWAY_PROJECT_ID;
    delete process.env.RAILWAY_ENVIRONMENT_ID;
    delete process.env.RAILWAY_BUCKET_ID;
  });

  it("keeps postgres and s3 failures independent", async () => {
    queryRaw.mockRejectedValue(new Error("db down"));
    headBucketSend.mockResolvedValue({});

    const status = await getInfrastructureStatusFresh();

    expect(status.postgres.ok).toBe(false);
    expect(status.postgres.error).toMatch(/db down/);
    expect(status.s3.ok).toBe(true);
    expect(status.s3.sizeSource).toBe("unavailable");
    expect(status.s3.sizeUnavailableReason).toMatch(/RAILWAY_TOKEN/);
  });

  it("surfaces permission errors for table sizes without failing the probe", async () => {
    queryRaw.mockImplementation(async (...args: unknown[]) => {
      const text = sqlText(args);
      if (text.includes("SELECT 1")) return [{ "?column?": 1 }];
      if (text.includes("version()")) return [{ version: "PostgreSQL 16.4" }];
      if (text.includes("pg_database_size")) return [{ size: 2048 }];
      if (text.includes("pg_stat_user_tables")) {
        throw new Error("permission denied for relation pg_stat_user_tables");
      }
      if (text.includes("pg_stat_activity")) {
        return [{ active: 1n, idle: 2n, max: 100 }];
      }
      throw new Error(`unexpected query: ${text}`);
    });

    const postgres = await collectPostgresStatus();
    expect(postgres.ok).toBe(true);
    expect(postgres.tables).toEqual([]);
    expect(postgres.tablesUnavailableReason).toMatch(/unavailable for this role/i);
    expect(postgres.connections.active).toBe(1);
    expect(postgres.connections.max).toBe(100);
  });

  it("marks bucket size unavailable without railway token", async () => {
    headBucketSend.mockResolvedValue({});
    const s3 = await collectS3Status();
    expect(s3.ok).toBe(true);
    expect(s3.bucket).toBe("synarava-media");
    expect(s3.endpointHost).toBe("example.storage.test");
    expect(s3.forcePathStyle).toBe(true);
    expect(s3.sizeSource).toBe("unavailable");
  });
});

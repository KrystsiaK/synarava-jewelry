import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";

import { db } from "@/lib/db";
import { getS3, getS3Config } from "@/lib/s3";

const CACHE_SECONDS = 45;
const RAILWAY_GRAPHQL = "https://backboard.railway.com/graphql/v2";

export type InfrastructureProbeOk = true;
export type InfrastructureProbeFail = false;

export type PostgresTableSize = {
  schema: string;
  name: string;
  sizeBytes: number;
};

export type PostgresConnections = {
  active: number | null;
  idle: number | null;
  max: number | null;
  unavailableReason?: string;
};

export type PostgresStatus = {
  ok: boolean;
  latencyMs: number | null;
  version: string | null;
  databaseSizeBytes: number | null;
  tables: PostgresTableSize[];
  tablesUnavailableReason?: string;
  connections: PostgresConnections;
  lastSuccessfulReadAt: string | null;
  error: string | null;
};

export type S3BucketStatus = {
  ok: boolean;
  latencyMs: number | null;
  bucket: string | null;
  region: string | null;
  endpointHost: string | null;
  forcePathStyle: boolean | null;
  sizeBytes: number | null;
  objectCount: number | null;
  sizeSource: "railway" | "unavailable";
  sizeUnavailableReason?: string;
  error: string | null;
};

export type InfrastructureStatus = {
  checkedAt: string;
  cacheTtlSeconds: number;
  postgres: PostgresStatus;
  s3: S3BucketStatus;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isPermissionError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("permission denied") ||
    lower.includes("must be owner") ||
    lower.includes("insufficient privilege") ||
    lower.includes("not allowed")
  );
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; latencyMs: number }> {
  const started = performance.now();
  const value = await fn();
  return { value, latencyMs: Math.round(performance.now() - started) };
}

async function probeSelectOne(): Promise<{
  ok: boolean;
  latencyMs: number | null;
  error: string | null;
}> {
  try {
    const { latencyMs } = await timed(() => db.$queryRaw`SELECT 1`);
    return { ok: true, latencyMs, error: null };
  } catch (error) {
    return { ok: false, latencyMs: null, error: errorMessage(error) };
  }
}

async function probePostgresVersion(): Promise<string | null> {
  try {
    const rows = await db.$queryRaw<Array<{ version: string }>>`SELECT version()`;
    return rows[0]?.version ?? null;
  } catch {
    return null;
  }
}

async function probeDatabaseSize(): Promise<number | null> {
  try {
    const rows = await db.$queryRaw<Array<{ size: bigint | number }>>`
      SELECT pg_database_size(current_database()) AS size
    `;
    const size = rows[0]?.size;
    return size == null ? null : Number(size);
  } catch {
    return null;
  }
}

async function probeTopTables(): Promise<{
  tables: PostgresTableSize[];
  unavailableReason?: string;
}> {
  try {
    const rows = await db.$queryRaw<
      Array<{ schemaname: string; relname: string; size: bigint | number }>
    >(Prisma.sql`
      SELECT
        schemaname,
        relname,
        pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname)) AS size
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname)) DESC
      LIMIT 10
    `);
    return {
      tables: rows.map((row) => ({
        schema: row.schemaname,
        name: row.relname,
        sizeBytes: Number(row.size),
      })),
    };
  } catch (error) {
    const message = errorMessage(error);
    return {
      tables: [],
      unavailableReason: isPermissionError(message)
        ? `pg_stat_user_tables / relation size unavailable for this role: ${message}`
        : message,
    };
  }
}

async function probeConnections(): Promise<PostgresConnections> {
  try {
    const rows = await db.$queryRaw<
      Array<{ active: bigint | number; idle: bigint | number; max: number | null }>
    >(Prisma.sql`
      SELECT
        count(*) FILTER (WHERE state = 'active')::bigint AS active,
        count(*) FILTER (WHERE state = 'idle')::bigint AS idle,
        (
          SELECT setting::int
          FROM pg_settings
          WHERE name = 'max_connections'
        ) AS max
      FROM pg_stat_activity
    `);
    const row = rows[0];
    return {
      active: row ? Number(row.active) : null,
      idle: row ? Number(row.idle) : null,
      max: row?.max ?? null,
    };
  } catch (error) {
    const message = errorMessage(error);
    return {
      active: null,
      idle: null,
      max: null,
      unavailableReason: isPermissionError(message)
        ? `pg_stat_activity unavailable for this role: ${message}`
        : message,
    };
  }
}

export async function collectPostgresStatus(): Promise<PostgresStatus> {
  const ping = await probeSelectOne();
  if (!ping.ok) {
    return {
      ok: false,
      latencyMs: null,
      version: null,
      databaseSizeBytes: null,
      tables: [],
      connections: { active: null, idle: null, max: null },
      lastSuccessfulReadAt: null,
      error: ping.error,
    };
  }

  const [version, databaseSizeBytes, tableProbe, connections] = await Promise.all([
    probePostgresVersion(),
    probeDatabaseSize(),
    probeTopTables(),
    probeConnections(),
  ]);

  return {
    ok: true,
    latencyMs: ping.latencyMs,
    version,
    databaseSizeBytes,
    tables: tableProbe.tables,
    tablesUnavailableReason: tableProbe.unavailableReason,
    connections,
    lastSuccessfulReadAt: new Date().toISOString(),
    error: null,
  };
}

type RailwayBucketDetails = {
  sizeBytes: number | null;
  objectCount: number | null;
  source: "railway" | "unavailable";
  unavailableReason?: string;
};

function readRailwayBucketConfig() {
  const token = process.env.RAILWAY_TOKEN?.trim() || "";
  const projectId = process.env.RAILWAY_PROJECT_ID?.trim() || "";
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID?.trim() || "";
  const bucketId = process.env.RAILWAY_BUCKET_ID?.trim() || "";
  return { token, projectId, environmentId, bucketId };
}

async function fetchRailwayBucketDetails(): Promise<RailwayBucketDetails> {
  const { token, projectId, environmentId, bucketId } = readRailwayBucketConfig();
  if (!token || !projectId || !environmentId || !bucketId) {
    return {
      sizeBytes: null,
      objectCount: null,
      source: "unavailable",
      unavailableReason:
        "Bucket size and object count need RAILWAY_TOKEN, RAILWAY_PROJECT_ID, RAILWAY_ENVIRONMENT_ID, and RAILWAY_BUCKET_ID.",
    };
  }

  try {
    const response = await fetch(RAILWAY_GRAPHQL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `query BucketInstanceDetails($bucketId: String!, $environmentId: String!) {
          bucketInstanceDetails(bucketId: $bucketId, environmentId: $environmentId) {
            sizeBytes
            objectCount
          }
        }`,
        variables: { bucketId, environmentId },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        sizeBytes: null,
        objectCount: null,
        source: "unavailable",
        unavailableReason: `Railway GraphQL HTTP ${response.status}`,
      };
    }

    const payload = (await response.json()) as {
      data?: { bucketInstanceDetails?: { sizeBytes?: string | number; objectCount?: string | number } };
      errors?: Array<{ message?: string }>;
    };

    if (payload.errors?.length) {
      return {
        sizeBytes: null,
        objectCount: null,
        source: "unavailable",
        unavailableReason: payload.errors.map((item) => item.message).filter(Boolean).join("; ") ||
          "Railway GraphQL error",
      };
    }

    const details = payload.data?.bucketInstanceDetails;
    if (!details) {
      return {
        sizeBytes: null,
        objectCount: null,
        source: "unavailable",
        unavailableReason: "Railway GraphQL returned no bucketInstanceDetails.",
      };
    }

    return {
      sizeBytes: details.sizeBytes == null ? null : Number(details.sizeBytes),
      objectCount: details.objectCount == null ? null : Number(details.objectCount),
      source: "railway",
    };
  } catch (error) {
    return {
      sizeBytes: null,
      objectCount: null,
      source: "unavailable",
      unavailableReason: errorMessage(error),
    };
  }
}

function endpointHost(endpoint: string | null): string | null {
  if (!endpoint) return null;
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint.replace(/^https?:\/\//, "").split("/")[0] || null;
  }
}

export async function collectS3Status(): Promise<S3BucketStatus> {
  let config;
  try {
    config = getS3Config();
  } catch (error) {
    return {
      ok: false,
      latencyMs: null,
      bucket: null,
      region: null,
      endpointHost: null,
      forcePathStyle: null,
      sizeBytes: null,
      objectCount: null,
      sizeSource: "unavailable",
      sizeUnavailableReason: "S3 is not configured.",
      error: errorMessage(error),
    };
  }

  const meta = {
    bucket: config.bucket,
    region: config.region,
    endpointHost: endpointHost(config.endpoint),
    forcePathStyle: config.forcePathStyle,
  };

  let headOk = false;
  let latencyMs: number | null = null;
  let error: string | null = null;

  try {
    const result = await timed(() =>
      getS3().send(new HeadBucketCommand({ Bucket: config.bucket })),
    );
    headOk = true;
    latencyMs = result.latencyMs;
  } catch (headError) {
    error = errorMessage(headError);
  }

  const railway = await fetchRailwayBucketDetails();

  return {
    ok: headOk,
    latencyMs,
    ...meta,
    sizeBytes: railway.sizeBytes,
    objectCount: railway.objectCount,
    sizeSource: railway.source,
    sizeUnavailableReason: railway.unavailableReason,
    error,
  };
}

async function collectInfrastructureStatusUncached(): Promise<InfrastructureStatus> {
  const [postgres, s3] = await Promise.all([collectPostgresStatus(), collectS3Status()]);
  return {
    checkedAt: new Date().toISOString(),
    cacheTtlSeconds: CACHE_SECONDS,
    postgres,
    s3,
  };
}

/**
 * Cached infrastructure snapshot. Cache key has no secrets — only a stable label.
 * @see https://nextjs.org/docs/app/api-reference/functions/unstable_cache
 */
export const getInfrastructureStatus = unstable_cache(
  collectInfrastructureStatusUncached,
  ["admin-infrastructure-status"],
  { revalidate: CACHE_SECONDS },
);

/** Test seam — same work without Next cache. */
export const getInfrastructureStatusFresh = collectInfrastructureStatusUncached;

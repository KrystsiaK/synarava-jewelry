import { Prisma, type ServiceStatusLevel as PrismaServiceStatusLevel } from "@prisma/client";
import { db } from "@/lib/db";

/** Node/flow health levels — matches Prisma `ServiceStatusLevel` and Stage 2 plan. */
export type ServiceStatusLevel = "ok" | "warn" | "down" | "unknown";

const LEVELS: ReadonlySet<string> = new Set(["ok", "warn", "down", "unknown"]);

export function isServiceStatusLevel(value: unknown): value is ServiceStatusLevel {
  return typeof value === "string" && LEVELS.has(value);
}

export type ServiceNodeStatusRecord = {
  nodeKey: string;
  level: ServiceStatusLevel;
  message: string | null;
  counters: Prisma.JsonValue | null;
  href: string | null;
  checkedAt: Date;
  updatedAt: Date;
};

export type ServiceFlowStatusRecord = {
  busKey: string;
  lastFlowAt: Date | null;
  level: ServiceStatusLevel;
  updatedAt: Date;
};

export type WriteServiceNodeStatusInput = {
  nodeKey: string;
  level: ServiceStatusLevel;
  message?: string | null;
  counters?: Prisma.InputJsonValue | null;
  href?: string | null;
  checkedAt: Date;
};

export type WriteServiceFlowStatusInput = {
  busKey: string;
  level: ServiceStatusLevel;
  lastFlowAt?: Date | null;
};

function assertLevel(level: ServiceStatusLevel): PrismaServiceStatusLevel {
  if (!isServiceStatusLevel(level)) {
    throw new Error(`Invalid ServiceStatusLevel: ${String(level)}`);
  }
  return level;
}

/** Read a node status row by `nodeKey` (= WidgetDefinition.key). */
export async function readServiceNodeStatus(
  nodeKey: string,
): Promise<ServiceNodeStatusRecord | null> {
  const row = await db.serviceNodeStatus.findUnique({ where: { nodeKey } });
  if (!row) return null;
  return {
    nodeKey: row.nodeKey,
    level: row.level,
    message: row.message,
    counters: row.counters,
    href: row.href,
    checkedAt: row.checkedAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Latest collector write time from persisted rows (not request-time probes).
 * Null = collector has never written — treat as stale.
 */
export async function readLatestCollectorCheckedAt(
  nodeKeys: readonly string[],
): Promise<Date | null> {
  if (nodeKeys.length === 0) return null;
  const row = await db.serviceNodeStatus.findFirst({
    where: { nodeKey: { in: [...nodeKeys] } },
    orderBy: { checkedAt: "desc" },
    select: { checkedAt: true },
  });
  return row?.checkedAt ?? null;
}

/** Upsert a node status row (collector write path). */
export async function writeServiceNodeStatus(
  input: WriteServiceNodeStatusInput,
): Promise<ServiceNodeStatusRecord> {
  const level = assertLevel(input.level);
  const message = input.message ?? null;
  const href = input.href ?? null;
  const countersJson =
    input.counters === undefined || input.counters === null
      ? Prisma.JsonNull
      : input.counters;

  const row = await db.serviceNodeStatus.upsert({
    where: { nodeKey: input.nodeKey },
    create: {
      nodeKey: input.nodeKey,
      level,
      message,
      href,
      counters: countersJson,
      checkedAt: input.checkedAt,
    },
    update: {
      level,
      message,
      href,
      counters: countersJson,
      checkedAt: input.checkedAt,
    },
  });

  return {
    nodeKey: row.nodeKey,
    level: row.level,
    message: row.message,
    counters: row.counters,
    href: row.href,
    checkedAt: row.checkedAt,
    updatedAt: row.updatedAt,
  };
}

/** Read a flow status row by `busKey` (= SystemBinding.busKey). */
export async function readServiceFlowStatus(
  busKey: string,
): Promise<ServiceFlowStatusRecord | null> {
  const row = await db.serviceFlowStatus.findUnique({ where: { busKey } });
  if (!row) return null;
  return {
    busKey: row.busKey,
    lastFlowAt: row.lastFlowAt,
    level: row.level,
    updatedAt: row.updatedAt,
  };
}

/** Upsert a flow status row (collector write path). */
export async function writeServiceFlowStatus(
  input: WriteServiceFlowStatusInput,
): Promise<ServiceFlowStatusRecord> {
  const level = assertLevel(input.level);
  const lastFlowAt = input.lastFlowAt ?? null;

  const row = await db.serviceFlowStatus.upsert({
    where: { busKey: input.busKey },
    create: {
      busKey: input.busKey,
      level,
      lastFlowAt,
    },
    update: {
      level,
      lastFlowAt,
    },
  });

  return {
    busKey: row.busKey,
    lastFlowAt: row.lastFlowAt,
    level: row.level,
    updatedAt: row.updatedAt,
  };
}

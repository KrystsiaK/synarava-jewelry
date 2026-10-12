import {
  fail,
  formatSku,
  normalizeFamilyKey,
  nextSequence,
  parseSku,
  resolveStem,
  type PolicyProfileConfig,
  type SkuResult,
} from "@synarava/sku-core";
import { createHash, randomUUID } from "node:crypto";
import type {
  AssignmentRecord,
  AuditEventRecord,
  LegacyImportRow,
  ProfileRecord,
  ReservationRecord,
  ReserveParams,
  SkuRegistryStore,
  WorkspaceRecord,
} from "./types.js";

type MutableWorkspace = {
  id: string;
  key: string;
  status: "ACTIVE" | "DISABLED";
};

type MutableProfile = ProfileRecord;

type MutableCursor = { lastAllocated: number };

/**
 * Serializable in-memory registry used for unit/concurrency tests without Postgres.
 * Production uses Prisma + SKU_DATABASE_URL (see prisma/schema.prisma).
 */
export function createMemorySkuRegistryStore(): SkuRegistryStore {
  const workspaces = new Map<string, MutableWorkspace>();
  const profiles = new Map<string, MutableProfile[]>();
  const cursors = new Map<string, MutableCursor>();
  const reservationsBySku = new Map<string, ReservationRecord>();
  const reservationsById = new Map<string, ReservationRecord>();
  const reservationsByIdempotency = new Map<string, string>();
  const assignments = new Map<string, AssignmentRecord>();
  const audit: AuditEventRecord[] = [];
  let queue: Promise<unknown> = Promise.resolve();

  const runExclusive = <T>(fn: () => T | Promise<T>): Promise<T> => {
    const next = queue.then(fn, fn);
    queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  const cursorKey = (workspaceId: string, stem: string) =>
    `${workspaceId}::${stem}`;

  const assignmentKey = (workspaceId: string, sku: string) =>
    `${workspaceId}::${sku}`;

  const appendAudit = (
    workspaceId: string,
    actor: string,
    action: string,
    correlationId: string,
    after: unknown,
  ) => {
    audit.push({
      id: randomUUID(),
      workspaceId,
      actor,
      action,
      correlationId,
      after,
      createdAt: new Date(),
    });
  };

  const getWorkspace = (key: string): MutableWorkspace | null =>
    workspaces.get(key) ?? null;

  const getPublished = (workspaceKey: string): MutableProfile | null => {
    const list = profiles.get(workspaceKey) ?? [];
    const published = list
      .filter((p) => p.status === "PUBLISHED")
      .toSorted((a, b) => b.version - a.version);
    return published[0] ?? null;
  };

  return {
    async ensureWorkspace(key) {
      return runExclusive(() => {
        const existing = getWorkspace(key);
        if (existing) return { ...existing };
        const created: MutableWorkspace = {
          id: randomUUID(),
          key,
          status: "ACTIVE",
        };
        workspaces.set(key, created);
        profiles.set(key, []);
        return { ...created };
      });
    },

    async publishProfile(workspaceKey, config) {
      return runExclusive(async () => {
        const workspace = getWorkspace(workspaceKey);
        if (!workspace) {
          throw domainError(fail("WORKSPACE_NOT_FOUND", `workspace ${workspaceKey}`));
        }
        if (config.workspace !== workspaceKey) {
          throw domainError(
            fail("INVALID_INPUT", "profile.workspace must match workspace key"),
          );
        }
        if (config.suffix.reuse !== false) {
          throw domainError(fail("INVALID_INPUT", "suffix.reuse must be false"));
        }

        const list = profiles.get(workspaceKey) ?? [];
        const retired = list.map((p) =>
          p.status === "PUBLISHED" ? { ...p, status: "RETIRED" as const } : p,
        );
        const record: MutableProfile = {
          id: randomUUID(),
          workspaceId: workspace.id,
          version: config.version,
          status: "PUBLISHED",
          config,
        };
        profiles.set(workspaceKey, [...retired, record]);
        appendAudit(
          workspace.id,
          "system",
          "profile.publish",
          `profile-${config.version}`,
          { version: config.version },
        );
        return record;
      });
    },

    async getPublishedProfile(workspaceKey) {
      return runExclusive(() => getPublished(workspaceKey));
    },

    async getLastAllocatedSequence(workspaceId, stem) {
      return runExclusive(() => {
        const cursor = cursors.get(cursorKey(workspaceId, stem));
        return cursor ? cursor.lastAllocated : null;
      });
    },

    async reserve(params) {
      return runExclusive(() => {
        const workspace = getWorkspace(params.workspaceKey);
        if (!workspace || workspace.status !== "ACTIVE") {
          throw domainError(
            fail("WORKSPACE_NOT_FOUND", `workspace ${params.workspaceKey}`),
          );
        }

        const idemKey = `${workspace.id}::${params.idempotencyKey}`;
        const existingId = reservationsByIdempotency.get(idemKey);
        if (existingId) {
          const existing = reservationsById.get(existingId);
          if (!existing) {
            throw new Error("idempotency index corruption");
          }
          return existing;
        }

        const profile = getPublished(params.workspaceKey);
        if (!profile) {
          throw domainError(
            fail("PROFILE_NOT_PUBLISHED", "no published profile"),
          );
        }

        const familyKey = normalizeFamilyKey(params.familyKey);
        if (!familyKey.ok) {
          throw domainError(familyKey);
        }

        const stem = resolveStem(profile.config, familyKey.value);
        if (!stem.ok) {
          throw domainError(stem);
        }

        const cKey = cursorKey(workspace.id, stem.value);
        const cursor = cursors.get(cKey) ?? null;
        const sequence = nextSequence(
          cursor ? cursor.lastAllocated : null,
          profile.config,
        );
        if (!sequence.ok) {
          throw domainError(sequence);
        }

        const formatted = formatSku(stem.value, sequence.value, profile.config);
        if (!formatted.ok) {
          throw domainError(formatted);
        }

        if (reservationsBySku.has(assignmentKey(workspace.id, formatted.value.sku))) {
          throw domainError(
            fail("ASSIGNMENT_CONFLICT", `sku ${formatted.value.sku} already held`),
          );
        }

        const record: ReservationRecord = {
          id: randomUUID(),
          workspaceId: workspace.id,
          sku: formatted.value.sku,
          stem: stem.value,
          sequence: sequence.value,
          familyKey: familyKey.value,
          policyVersion: profile.version,
          status: "PENDING",
          idempotencyKey: params.idempotencyKey,
          correlationId: params.correlationId,
          createdAt: new Date(),
        };

        const skuKey = assignmentKey(workspace.id, record.sku);
        reservationsBySku.set(skuKey, record);
        reservationsById.set(record.id, record);
        reservationsByIdempotency.set(idemKey, record.id);
        cursors.set(cKey, { lastAllocated: sequence.value });
        appendAudit(
          workspace.id,
          params.actor,
          "reservation.create",
          params.correlationId,
          {
            reservationId: record.id,
            sku: record.sku,
            sequence: record.sequence,
          },
        );
        return record;
      });
    },

    async cancelReservationAsTombstone(
      workspaceKey,
      reservationId,
      correlationId,
      actor,
    ) {
      return runExclusive(() => {
        const workspace = getWorkspace(workspaceKey);
        if (!workspace) {
          throw domainError(fail("WORKSPACE_NOT_FOUND", workspaceKey));
        }
        const found = reservationsById.get(reservationId);
        if (!found || found.workspaceId !== workspace.id) {
          throw domainError(fail("RESERVATION_NOT_FOUND", reservationId));
        }
        const tombstoned: ReservationRecord = {
          ...found,
          status: "TOMBSTONE",
        };
        const skuKey = assignmentKey(workspace.id, found.sku);
        reservationsBySku.set(skuKey, tombstoned);
        reservationsById.set(tombstoned.id, tombstoned);
        appendAudit(workspace.id, actor, "reservation.tombstone", correlationId, {
          reservationId,
          sku: found.sku,
        });
        return tombstoned;
      });
    },

    async importLegacyAssignments(
      workspaceKey,
      rows,
      correlationId,
      actor,
    ) {
      return runExclusive(() => {
        const workspace = getWorkspace(workspaceKey);
        if (!workspace) {
          throw domainError(fail("WORKSPACE_NOT_FOUND", workspaceKey));
        }
        const profile = getPublished(workspaceKey);
        if (!profile) {
          throw domainError(
            fail("PROFILE_NOT_PUBLISHED", "publish a profile before legacy import"),
          );
        }

        let created = 0;
        let skipped = 0;
        const result: AssignmentRecord[] = [];

        for (const row of rows) {
          const parsed = parseSku(row.sku, profile.config);
          if (!parsed.ok) {
            throw domainError(parsed);
          }

          const aKey = assignmentKey(workspace.id, parsed.value.sku);
          const existing = assignments.get(aKey);
          if (existing) {
            skipped += 1;
            result.push(existing);
            continue;
          }

          if (reservationsBySku.has(aKey)) {
            throw domainError(
              fail(
                "ASSIGNMENT_CONFLICT",
                `sku ${parsed.value.sku} already reserved`,
              ),
            );
          }

          const assignment: AssignmentRecord = {
            id: randomUUID(),
            workspaceId: workspace.id,
            sku: parsed.value.sku,
            policyVersion: profile.version,
            source: "LEGACY_V0",
            status: "ACTIVE",
            lockState: "NONE",
            externalSystem: row.externalSystem,
            externalShop: row.externalShop ?? null,
            externalProductId: row.externalProductId ?? null,
            externalVariantId: row.externalVariantId ?? null,
            reservationId: null,
            correlationId,
            createdAt: new Date(),
          };

          // Tombstone reservation so sequence cannot be re-issued.
          const tombstone: ReservationRecord = {
            id: randomUUID(),
            workspaceId: workspace.id,
            sku: parsed.value.sku,
            stem: parsed.value.stem,
            sequence: parsed.value.sequence,
            familyKey: "legacy.import",
            policyVersion: profile.version,
            status: "TOMBSTONE",
            idempotencyKey: `legacy:${parsed.value.sku}`,
            correlationId,
            createdAt: new Date(),
          };
          reservationsBySku.set(aKey, tombstone);
          reservationsById.set(tombstone.id, tombstone);
          reservationsByIdempotency.set(
            `${workspace.id}::${tombstone.idempotencyKey}`,
            tombstone.id,
          );

          const cKey = cursorKey(workspace.id, parsed.value.stem);
          const cursor = cursors.get(cKey);
          if (!cursor || cursor.lastAllocated < parsed.value.sequence) {
            cursors.set(cKey, { lastAllocated: parsed.value.sequence });
          }

          assignments.set(aKey, assignment);
          created += 1;
          result.push(assignment);
        }

        appendAudit(workspace.id, actor, "legacy.import", correlationId, {
          created,
          skipped,
          digest: hashRows(rows),
        });

        return { created, skipped, assignments: result };
      });
    },

    async listAssignments(workspaceKey) {
      return runExclusive(() => {
        const workspace = getWorkspace(workspaceKey);
        if (!workspace) return [];
        return [...assignments.values()].filter(
          (a) => a.workspaceId === workspace.id,
        );
      });
    },

    async listAuditEvents(workspaceKey) {
      return runExclusive(() => {
        const workspace = getWorkspace(workspaceKey);
        if (!workspace) return [];
        return audit.filter((e) => e.workspaceId === workspace.id);
      });
    },
  };
}

function hashRows(rows: readonly LegacyImportRow[]): string {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex").slice(0, 16);
}

class DomainError extends Error {
  readonly code: string;

  constructor(result: Extract<SkuResult<never>, { ok: false }>) {
    super(result.message);
    this.name = "DomainError";
    this.code = result.code;
  }
}

function domainError(result: Extract<SkuResult<never>, { ok: false }>): DomainError {
  return new DomainError(result);
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

export function publishExampleProfile(
  store: SkuRegistryStore,
  config: PolicyProfileConfig,
): Promise<ProfileRecord> {
  return store.publishProfile(config.workspace, config);
}

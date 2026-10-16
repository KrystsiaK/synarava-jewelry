import {
  fail,
  formatSku,
  normalizeFamilyKey,
  nextSequence,
  parseSku,
  resolveStem,
  type PolicyProfileConfig,
} from "@synarava/sku-core";
import { createHash } from "node:crypto";
import { type Prisma, type PrismaClient } from "../generated/prisma/index.js";
import { assertProfileConfig, domainError } from "./errors.js";
import {
  mapAssignment,
  mapAudit,
  mapProfile,
  mapReservation,
  mapWorkspace,
} from "./mappers.js";
import {
  RetryableTransactionConflict,
  withSerializableRetry,
} from "./retry.js";
import type {
  LegacyImportRow,
  ProfileRecord,
  SkuRegistryStore,
} from "./types.js";

type Db = PrismaClient | Prisma.TransactionClient;

async function requireWorkspace(db: Db, key: string) {
  const workspace = await db.workspace.findUnique({ where: { key } });
  if (!workspace) {
    throw domainError(fail("WORKSPACE_NOT_FOUND", `workspace ${key}`));
  }
  return workspace;
}

async function getPublishedProfileRow(db: Db, workspaceId: string) {
  return db.policyProfile.findFirst({
    where: { workspaceId, status: "PUBLISHED" },
    orderBy: { version: "desc" },
  });
}

async function appendAudit(
  db: Db,
  workspaceId: string,
  actor: string,
  action: string,
  correlationId: string,
  after: unknown,
) {
  await db.auditEvent.create({
    data: {
      workspaceId,
      actor,
      action,
      correlationId,
      after: after as Prisma.InputJsonValue,
    },
  });
}

function hashRows(rows: readonly LegacyImportRow[]): string {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex").slice(0, 16);
}

/**
 * PostgreSQL-backed SkuRegistryStore via Prisma.
 * Used whenever SKU_DATABASE_URL is set (staging/production).
 */
export function createPrismaSkuRegistryStore(
  prisma: PrismaClient,
): SkuRegistryStore {
  return {
    async ensureWorkspace(key) {
      const row = await prisma.workspace.upsert({
        where: { key },
        create: { key, status: "ACTIVE" },
        update: {},
      });
      return mapWorkspace(row);
    },

    async saveDraftProfile(workspaceKey, config) {
      return prisma.$transaction(async (tx) => {
        const workspace = await requireWorkspace(tx, workspaceKey);
        assertProfileConfig(workspaceKey, config);
        const existing = await tx.policyProfile.findUnique({
          where: {
            workspaceId_version: {
              workspaceId: workspace.id,
              version: config.version,
            },
          },
        });
        if (existing?.status === "PUBLISHED") {
          throw domainError(
            fail("INVALID_INPUT", "published profile versions are immutable"),
          );
        }
        const row = await tx.policyProfile.upsert({
          where: {
            workspaceId_version: {
              workspaceId: workspace.id,
              version: config.version,
            },
          },
          create: {
            workspaceId: workspace.id,
            version: config.version,
            status: "DRAFT",
            separator: config.separator,
            suffixWidth: config.suffix.width,
            suffixStart: config.suffix.start,
            suffixReuse: false,
            allowedCharacters: config.allowedCharacters,
            families: config.families,
          },
          update: {
            status: "DRAFT",
            separator: config.separator,
            suffixWidth: config.suffix.width,
            suffixStart: config.suffix.start,
            suffixReuse: false,
            allowedCharacters: config.allowedCharacters,
            families: config.families,
            publishedAt: null,
          },
        });
        await appendAudit(
          tx,
          workspace.id,
          "system",
          "profile.draft",
          `profile-${config.version}`,
          { version: config.version },
        );
        return mapProfile(row, workspaceKey);
      });
    },

    async publishProfile(workspaceKey, config) {
      return prisma.$transaction(async (tx) => {
        const workspace = await requireWorkspace(tx, workspaceKey);
        assertProfileConfig(workspaceKey, config);
        await tx.policyProfile.updateMany({
          where: { workspaceId: workspace.id, status: "PUBLISHED" },
          data: { status: "RETIRED" },
        });
        const row = await tx.policyProfile.upsert({
          where: {
            workspaceId_version: {
              workspaceId: workspace.id,
              version: config.version,
            },
          },
          create: {
            workspaceId: workspace.id,
            version: config.version,
            status: "PUBLISHED",
            separator: config.separator,
            suffixWidth: config.suffix.width,
            suffixStart: config.suffix.start,
            suffixReuse: false,
            allowedCharacters: config.allowedCharacters,
            families: config.families,
            publishedAt: new Date(),
          },
          update: {
            status: "PUBLISHED",
            separator: config.separator,
            suffixWidth: config.suffix.width,
            suffixStart: config.suffix.start,
            suffixReuse: false,
            allowedCharacters: config.allowedCharacters,
            families: config.families,
            publishedAt: new Date(),
          },
        });
        await appendAudit(
          tx,
          workspace.id,
          "system",
          "profile.publish",
          `profile-${config.version}`,
          { version: config.version },
        );
        return mapProfile(row, workspaceKey);
      });
    },

    async publishProfileVersion(workspaceKey, version) {
      return prisma.$transaction(async (tx) => {
        const workspace = await requireWorkspace(tx, workspaceKey);
        const draft = await tx.policyProfile.findUnique({
          where: {
            workspaceId_version: { workspaceId: workspace.id, version },
          },
        });
        if (!draft) {
          throw domainError(fail("INVALID_INPUT", `profile v${version} not found`));
        }
        if (draft.status === "PUBLISHED") {
          return mapProfile(draft, workspaceKey);
        }
        await tx.policyProfile.updateMany({
          where: { workspaceId: workspace.id, status: "PUBLISHED" },
          data: { status: "RETIRED" },
        });
        const row = await tx.policyProfile.update({
          where: { id: draft.id },
          data: { status: "PUBLISHED", publishedAt: new Date() },
        });
        await appendAudit(
          tx,
          workspace.id,
          "system",
          "profile.publish",
          `profile-${version}`,
          { version },
        );
        return mapProfile(row, workspaceKey);
      });
    },

    async listProfiles(workspaceKey) {
      const workspace = await requireWorkspace(prisma, workspaceKey);
      const rows = await prisma.policyProfile.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { version: "desc" },
      });
      return rows.map((row) => mapProfile(row, workspaceKey));
    },

    async getPublishedProfile(workspaceKey) {
      const workspace = await prisma.workspace.findUnique({
        where: { key: workspaceKey },
      });
      if (!workspace) return null;
      const row = await getPublishedProfileRow(prisma, workspace.id);
      return row ? mapProfile(row, workspaceKey) : null;
    },

    async getLastAllocatedSequence(workspaceId, stem) {
      const cursor = await prisma.sequenceCursor.findUnique({
        where: { workspaceId_stem: { workspaceId, stem } },
      });
      return cursor ? cursor.lastAllocated : null;
    },

    async reserve(params) {
      return withSerializableRetry(async () => {
        try {
          return await prisma.$transaction(
            async (tx) => {
              const workspace = await tx.workspace.findUnique({
                where: { key: params.workspaceKey },
              });
              if (!workspace || workspace.status !== "ACTIVE") {
                throw domainError(
                  fail("WORKSPACE_NOT_FOUND", `workspace ${params.workspaceKey}`),
                );
              }

              const existing = await tx.reservation.findUnique({
                where: {
                  workspaceId_idempotencyKey: {
                    workspaceId: workspace.id,
                    idempotencyKey: params.idempotencyKey,
                  },
                },
              });
              if (existing) {
                return mapReservation(existing);
              }

              const profileRow = await getPublishedProfileRow(tx, workspace.id);
              if (!profileRow) {
                throw domainError(
                  fail("PROFILE_NOT_PUBLISHED", "no published profile"),
                );
              }
              const profile = mapProfile(profileRow, params.workspaceKey);

              const familyKey = normalizeFamilyKey(params.familyKey);
              if (!familyKey.ok) throw domainError(familyKey);

              const stem = resolveStem(profile.config, familyKey.value);
              if (!stem.ok) throw domainError(stem);

              // Insert-if-missing then row-lock so same-stem reserves serialize.
              // lastAllocated=0 means "none issued yet" (nextSequence treats as null).
              await tx.$executeRaw`
                INSERT INTO "SequenceCursor" (id, "workspaceId", stem, "lastAllocated", "updatedAt")
                VALUES (
                  concat('c_', substr(md5(random()::text), 1, 24)),
                  ${workspace.id},
                  ${stem.value},
                  0,
                  CURRENT_TIMESTAMP
                )
                ON CONFLICT ("workspaceId", stem) DO NOTHING
              `;

              const locked = await tx.$queryRaw<
                Array<{ lastAllocated: number }>
              >`
                SELECT "lastAllocated" FROM "SequenceCursor"
                WHERE "workspaceId" = ${workspace.id} AND stem = ${stem.value}
                FOR UPDATE
              `;
              const lastAllocated = locked[0]?.lastAllocated ?? 0;
              const sequence = nextSequence(
                lastAllocated > 0 ? lastAllocated : null,
                profile.config,
              );
              if (!sequence.ok) throw domainError(sequence);

              const formatted = formatSku(
                stem.value,
                sequence.value,
                profile.config,
              );
              if (!formatted.ok) throw domainError(formatted);

              const conflict = await tx.reservation.findUnique({
                where: {
                  workspaceId_sku: {
                    workspaceId: workspace.id,
                    sku: formatted.value.sku,
                  },
                },
              });
              if (conflict) {
                // Same-stem race under contention — outer retry re-reads cursor.
                throw new RetryableTransactionConflict(
                  `sku ${formatted.value.sku} contended`,
                );
              }

              const row = await tx.reservation.create({
                data: {
                  workspaceId: workspace.id,
                  sku: formatted.value.sku,
                  stem: stem.value,
                  sequence: sequence.value,
                  familyKey: familyKey.value,
                  policyVersion: profile.version,
                  status: "PENDING",
                  idempotencyKey: params.idempotencyKey,
                  correlationId: params.correlationId,
                },
              });

              await tx.sequenceCursor.update({
                where: {
                  workspaceId_stem: {
                    workspaceId: workspace.id,
                    stem: stem.value,
                  },
                },
                data: { lastAllocated: sequence.value },
              });

              await appendAudit(
                tx,
                workspace.id,
                params.actor,
                "reservation.create",
                params.correlationId,
                {
                  reservationId: row.id,
                  sku: row.sku,
                  sequence: row.sequence,
                },
              );
              return mapReservation(row);
            },
            { isolationLevel: "Serializable" },
          );
        } catch (error) {
          // Idempotency race: loser of unique insert reloads winner's row.
          const code =
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            typeof (error as { code: unknown }).code === "string"
              ? (error as { code: string }).code
              : null;
          if (code === "P2002") {
            const workspace = await prisma.workspace.findUnique({
              where: { key: params.workspaceKey },
            });
            if (workspace) {
              const byIdempotency = await prisma.reservation.findUnique({
                where: {
                  workspaceId_idempotencyKey: {
                    workspaceId: workspace.id,
                    idempotencyKey: params.idempotencyKey,
                  },
                },
              });
              if (byIdempotency) {
                return mapReservation(byIdempotency);
              }
            }
          }
          throw error;
        }
      });
    },

    async getReservation(workspaceKey, reservationId) {
      const workspace = await requireWorkspace(prisma, workspaceKey);
      const row = await prisma.reservation.findFirst({
        where: { id: reservationId, workspaceId: workspace.id },
      });
      return row ? mapReservation(row) : null;
    },

    async cancelReservationAsTombstone(
      workspaceKey,
      reservationId,
      correlationId,
      actor,
    ) {
      return prisma.$transaction(async (tx) => {
        const workspace = await requireWorkspace(tx, workspaceKey);
        const found = await tx.reservation.findFirst({
          where: { id: reservationId, workspaceId: workspace.id },
        });
        if (!found) {
          throw domainError(fail("RESERVATION_NOT_FOUND", reservationId));
        }
        const row = await tx.reservation.update({
          where: { id: found.id },
          data: { status: "TOMBSTONE" },
        });
        await appendAudit(
          tx,
          workspace.id,
          actor,
          "reservation.tombstone",
          correlationId,
          { reservationId, sku: found.sku },
        );
        return mapReservation(row);
      });
    },

    async confirmAssignment(params) {
      return prisma.$transaction(async (tx) => {
        const workspace = await requireWorkspace(tx, params.workspaceKey);
        const reservation = await tx.reservation.findFirst({
          where: { id: params.reservationId, workspaceId: workspace.id },
        });
        if (!reservation) {
          throw domainError(fail("RESERVATION_NOT_FOUND", params.reservationId));
        }
        if (reservation.sku !== params.sku) {
          throw domainError(
            fail("ASSIGNMENT_CONFLICT", "sku does not match reservation"),
          );
        }
        if (
          params.shopifyReadBackSku.trim().toUpperCase() !== reservation.sku
        ) {
          throw domainError(
            fail(
              "ASSIGNMENT_CONFLICT",
              "Shopify read-back SKU does not match reservation",
            ),
          );
        }
        if (
          reservation.status !== "PENDING" &&
          reservation.status !== "CONFIRMED"
        ) {
          throw domainError(
            fail("ASSIGNMENT_CONFLICT", `reservation is ${reservation.status}`),
          );
        }

        const existing = await tx.assignment.findUnique({
          where: {
            workspaceId_sku: {
              workspaceId: workspace.id,
              sku: reservation.sku,
            },
          },
        });
        if (existing) {
          return mapAssignment(existing);
        }

        await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: "CONFIRMED" },
        });

        const row = await tx.assignment.create({
          data: {
            workspaceId: workspace.id,
            sku: reservation.sku,
            policyVersion: reservation.policyVersion,
            source: "RESERVED",
            status: "ACTIVE",
            lockState: "NONE",
            externalSystem: params.externalSystem,
            externalShop: params.externalShop,
            externalProductId: params.externalProductId,
            externalVariantId: params.externalVariantId,
            reservationId: reservation.id,
            correlationId: params.correlationId,
          },
        });
        await appendAudit(
          tx,
          workspace.id,
          params.actor,
          "assignment.confirm",
          params.correlationId,
          { assignmentId: row.id, sku: row.sku },
        );
        return mapAssignment(row);
      });
    },

    async lockAssignment(
      workspaceKey,
      assignmentId,
      lockState,
      correlationId,
      actor,
    ) {
      return prisma.$transaction(async (tx) => {
        const workspace = await requireWorkspace(tx, workspaceKey);
        const found = await tx.assignment.findFirst({
          where: { id: assignmentId, workspaceId: workspace.id },
        });
        if (!found) {
          throw domainError(fail("ASSIGNMENT_CONFLICT", "assignment not found"));
        }
        const rank = { NONE: 0, PUBLICATION_LOCKED: 1, ORDER_LOCKED: 2 } as const;
        const nextLock =
          rank[lockState] >= rank[found.lockState] ? lockState : found.lockState;
        const row = await tx.assignment.update({
          where: { id: found.id },
          data: { lockState: nextLock },
        });
        await appendAudit(tx, workspace.id, actor, "assignment.lock", correlationId, {
          assignmentId,
          lockState: nextLock,
        });
        return mapAssignment(row);
      });
    },

    async validateSku(workspaceKey, skuRaw) {
      const workspace = await requireWorkspace(prisma, workspaceKey);
      const profileRow = await getPublishedProfileRow(prisma, workspace.id);
      if (!profileRow) {
        throw domainError(fail("PROFILE_NOT_PUBLISHED", "no published profile"));
      }
      const profile = mapProfile(profileRow, workspaceKey);
      const parsed = parseSku(skuRaw, profile.config);
      const sku = parsed.ok ? parsed.value.sku : skuRaw.trim().toUpperCase();
      const [assignment, reservation] = await Promise.all([
        prisma.assignment.findUnique({
          where: { workspaceId_sku: { workspaceId: workspace.id, sku } },
        }),
        prisma.reservation.findUnique({
          where: { workspaceId_sku: { workspaceId: workspace.id, sku } },
        }),
      ]);
      return {
        sku,
        validFormat: parsed.ok,
        assigned: Boolean(assignment),
        reservationStatus: reservation?.status ?? null,
        policyVersion: profile.version,
      };
    },

    async importLegacyAssignments(workspaceKey, rows, correlationId, actor) {
      return prisma.$transaction(async (tx) => {
        const workspace = await requireWorkspace(tx, workspaceKey);
        const profileRow = await getPublishedProfileRow(tx, workspace.id);
        if (!profileRow) {
          throw domainError(
            fail(
              "PROFILE_NOT_PUBLISHED",
              "publish a profile before legacy import",
            ),
          );
        }
        const profile = mapProfile(profileRow, workspaceKey);
        let created = 0;
        let skipped = 0;
        const result = [];

        for (const row of rows) {
          const parsed = parseSku(row.sku, profile.config);
          const existing = await tx.assignment.findUnique({
            where: {
              workspaceId_sku: {
                workspaceId: workspace.id,
                sku: row.sku,
              },
            },
          });
          if (existing) {
            skipped += 1;
            result.push(mapAssignment(existing));
            continue;
          }

          const collisionSku = parsed.ok ? parsed.value.sku : row.sku;
          const held = await tx.reservation.findUnique({
            where: {
              workspaceId_sku: {
                workspaceId: workspace.id,
                sku: collisionSku,
              },
            },
          });
          if (held && held.status !== "TOMBSTONE") {
            throw domainError(
              fail(
                "ASSIGNMENT_CONFLICT",
                `sku ${row.sku} already reserved`,
              ),
            );
          }

          if (parsed.ok && !held) {
            await tx.reservation.create({
              data: {
                workspaceId: workspace.id,
                sku: parsed.value.sku,
                stem: parsed.value.stem,
                sequence: parsed.value.sequence,
                familyKey: "legacy.import",
                policyVersion: profile.version,
                status: "TOMBSTONE",
                idempotencyKey: `legacy:${parsed.value.sku}`,
                correlationId,
              },
            });
          }

          const assignment = await tx.assignment.create({
            data: {
              workspaceId: workspace.id,
              sku: row.sku,
              policyVersion: profile.version,
              source: "LEGACY_V0",
              status: "ACTIVE",
              lockState: "NONE",
              externalSystem: row.externalSystem,
              externalShop: row.externalShop ?? null,
              externalProductId: row.externalProductId ?? null,
              externalVariantId: row.externalVariantId ?? null,
              correlationId,
            },
          });

          if (parsed.ok) {
            const cursor = await tx.sequenceCursor.findUnique({
              where: {
                workspaceId_stem: {
                  workspaceId: workspace.id,
                  stem: parsed.value.stem,
                },
              },
            });
            if (!cursor || cursor.lastAllocated < parsed.value.sequence) {
              await tx.sequenceCursor.upsert({
                where: {
                  workspaceId_stem: {
                    workspaceId: workspace.id,
                    stem: parsed.value.stem,
                  },
                },
                create: {
                  workspaceId: workspace.id,
                  stem: parsed.value.stem,
                  lastAllocated: parsed.value.sequence,
                },
                update: { lastAllocated: parsed.value.sequence },
              });
            }
          }

          created += 1;
          result.push(mapAssignment(assignment));
        }

        await appendAudit(tx, workspace.id, actor, "legacy.import", correlationId, {
          created,
          skipped,
          digest: hashRows(rows),
        });
        return { created, skipped, assignments: result };
      });
    },

    async listAssignments(workspaceKey) {
      const workspace = await prisma.workspace.findUnique({
        where: { key: workspaceKey },
      });
      if (!workspace) return [];
      const rows = await prisma.assignment.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(mapAssignment);
    },

    async listAuditEvents(workspaceKey) {
      const workspace = await prisma.workspace.findUnique({
        where: { key: workspaceKey },
      });
      if (!workspace) return [];
      const rows = await prisma.auditEvent.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: "asc" },
      });
      return rows.map(mapAudit);
    },
  };
}

export type { ProfileRecord, PolicyProfileConfig };

import type { PolicyProfileConfig } from "@synarava/sku-core";

export type WorkspaceRecord = {
  readonly id: string;
  readonly key: string;
  readonly status: "ACTIVE" | "DISABLED";
};

export type ProfileRecord = {
  readonly id: string;
  readonly workspaceId: string;
  readonly version: number;
  readonly status: "DRAFT" | "PUBLISHED" | "RETIRED";
  readonly config: PolicyProfileConfig;
};

export type ReservationRecord = {
  readonly id: string;
  readonly workspaceId: string;
  readonly sku: string;
  readonly stem: string;
  readonly sequence: number;
  readonly familyKey: string;
  readonly policyVersion: number;
  readonly status: "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED" | "TOMBSTONE";
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly createdAt: Date;
};

export type AssignmentRecord = {
  readonly id: string;
  readonly workspaceId: string;
  readonly sku: string;
  readonly policyVersion: number;
  readonly source: "RESERVED" | "LEGACY_V0";
  readonly status: "ACTIVE" | "EXTERNAL_CHANGE_DETECTED" | "SUPERSEDED";
  readonly lockState: "NONE" | "PUBLICATION_LOCKED" | "ORDER_LOCKED";
  readonly externalSystem: string;
  readonly externalShop: string | null;
  readonly externalProductId: string | null;
  readonly externalVariantId: string | null;
  readonly reservationId: string | null;
  readonly correlationId: string;
  readonly createdAt: Date;
};

export type AuditEventRecord = {
  readonly id: string;
  readonly workspaceId: string;
  readonly actor: string;
  readonly action: string;
  readonly correlationId: string;
  readonly after: unknown;
  readonly createdAt: Date;
};

export type ReserveParams = {
  readonly workspaceKey: string;
  readonly familyKey: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly actor: string;
};

export type LegacyImportRow = {
  readonly sku: string;
  readonly externalSystem: string;
  readonly externalShop?: string | null;
  readonly externalProductId?: string | null;
  readonly externalVariantId?: string | null;
};

/**
 * Persistence boundary for the SKU registry.
 * Prisma Postgres is the production adapter; tests use an in-memory serializable store.
 */
export type SkuRegistryStore = {
  ensureWorkspace(key: string): Promise<WorkspaceRecord>;
  publishProfile(
    workspaceKey: string,
    config: PolicyProfileConfig,
  ): Promise<ProfileRecord>;
  getPublishedProfile(workspaceKey: string): Promise<ProfileRecord | null>;
  getLastAllocatedSequence(
    workspaceId: string,
    stem: string,
  ): Promise<number | null>;
  reserve(params: ReserveParams): Promise<ReservationRecord>;
  cancelReservationAsTombstone(
    workspaceKey: string,
    reservationId: string,
    correlationId: string,
    actor: string,
  ): Promise<ReservationRecord>;
  importLegacyAssignments(
    workspaceKey: string,
    rows: readonly LegacyImportRow[],
    correlationId: string,
    actor: string,
  ): Promise<{
    readonly created: number;
    readonly skipped: number;
    readonly assignments: readonly AssignmentRecord[];
  }>;
  listAssignments(workspaceKey: string): Promise<readonly AssignmentRecord[]>;
  listAuditEvents(workspaceKey: string): Promise<readonly AuditEventRecord[]>;
};

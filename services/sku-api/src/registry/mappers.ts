import type { PolicyProfileConfig } from "@synarava/sku-core";
import type {
  AssignmentRecord,
  AuditEventRecord,
  ProfileRecord,
  ReservationRecord,
  WorkspaceRecord,
} from "./types.js";

type WorkspaceRow = {
  id: string;
  key: string;
  status: "ACTIVE" | "DISABLED";
};

type ProfileRow = {
  id: string;
  workspaceId: string;
  version: number;
  status: "DRAFT" | "PUBLISHED" | "RETIRED";
  separator: string;
  suffixWidth: number;
  suffixStart: number;
  suffixReuse: boolean;
  allowedCharacters: string;
  families: unknown;
};

type ReservationRow = {
  id: string;
  workspaceId: string;
  sku: string;
  stem: string;
  sequence: number;
  familyKey: string;
  policyVersion: number;
  status: ReservationRecord["status"];
  idempotencyKey: string;
  correlationId: string;
  createdAt: Date;
};

type AssignmentRow = {
  id: string;
  workspaceId: string;
  sku: string;
  policyVersion: number;
  source: AssignmentRecord["source"];
  status: AssignmentRecord["status"];
  lockState: AssignmentRecord["lockState"];
  externalSystem: string;
  externalShop: string | null;
  externalProductId: string | null;
  externalVariantId: string | null;
  reservationId: string | null;
  correlationId: string;
  createdAt: Date;
};

type AuditRow = {
  id: string;
  workspaceId: string;
  actor: string;
  action: string;
  correlationId: string;
  after: unknown;
  createdAt: Date;
};

export function mapWorkspace(row: WorkspaceRow): WorkspaceRecord {
  return { id: row.id, key: row.key, status: row.status };
}

export function profileConfigFromRow(
  row: ProfileRow,
  workspaceKey: string,
): PolicyProfileConfig {
  return {
    workspace: workspaceKey,
    version: row.version,
    separator: row.separator,
    suffix: {
      width: row.suffixWidth,
      start: row.suffixStart,
      reuse: false,
    },
    families: (row.families ?? {}) as Record<string, string>,
    allowedCharacters: row.allowedCharacters,
  };
}

export function mapProfile(row: ProfileRow, workspaceKey: string): ProfileRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    version: row.version,
    status: row.status,
    config: profileConfigFromRow(row, workspaceKey),
  };
}

export function mapReservation(row: ReservationRow): ReservationRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    sku: row.sku,
    stem: row.stem,
    sequence: row.sequence,
    familyKey: row.familyKey,
    policyVersion: row.policyVersion,
    status: row.status,
    idempotencyKey: row.idempotencyKey,
    correlationId: row.correlationId,
    createdAt: row.createdAt,
  };
}

export function mapAssignment(row: AssignmentRow): AssignmentRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    sku: row.sku,
    policyVersion: row.policyVersion,
    source: row.source,
    status: row.status,
    lockState: row.lockState,
    externalSystem: row.externalSystem,
    externalShop: row.externalShop,
    externalProductId: row.externalProductId,
    externalVariantId: row.externalVariantId,
    reservationId: row.reservationId,
    correlationId: row.correlationId,
    createdAt: row.createdAt,
  };
}

export function mapAudit(row: AuditRow): AuditEventRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    actor: row.actor,
    action: row.action,
    correlationId: row.correlationId,
    after: row.after,
    createdAt: row.createdAt,
  };
}

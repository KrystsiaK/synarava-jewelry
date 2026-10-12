-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "ProfileStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'TOMBSTONE');
CREATE TYPE "AssignmentSource" AS ENUM ('RESERVED', 'LEGACY_V0');
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'EXTERNAL_CHANGE_DETECTED', 'SUPERSEDED');
CREATE TYPE "AssignmentLockState" AS ENUM ('NONE', 'PUBLICATION_LOCKED', 'ORDER_LOCKED');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" "WorkspaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PolicyProfile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "separator" TEXT NOT NULL,
    "suffixWidth" INTEGER NOT NULL,
    "suffixStart" INTEGER NOT NULL DEFAULT 1,
    "suffixReuse" BOOLEAN NOT NULL DEFAULT false,
    "allowedCharacters" TEXT NOT NULL,
    "families" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PolicyProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SequenceCursor" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "stem" TEXT NOT NULL,
    "lastAllocated" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SequenceCursor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "stem" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "familyKey" TEXT NOT NULL,
    "policyVersion" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "policyVersion" INTEGER NOT NULL,
    "source" "AssignmentSource" NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "lockState" "AssignmentLockState" NOT NULL DEFAULT 'NONE',
    "externalSystem" TEXT NOT NULL,
    "externalShop" TEXT,
    "externalProductId" TEXT,
    "externalVariantId" TEXT,
    "reservationId" TEXT,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "payloadDigest" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- Indexes / uniques
CREATE UNIQUE INDEX "Workspace_key_key" ON "Workspace"("key");
CREATE UNIQUE INDEX "PolicyProfile_workspaceId_version_key" ON "PolicyProfile"("workspaceId", "version");
CREATE INDEX "PolicyProfile_workspaceId_status_idx" ON "PolicyProfile"("workspaceId", "status");
CREATE UNIQUE INDEX "SequenceCursor_workspaceId_stem_key" ON "SequenceCursor"("workspaceId", "stem");
CREATE UNIQUE INDEX "Reservation_workspaceId_sku_key" ON "Reservation"("workspaceId", "sku");
CREATE UNIQUE INDEX "Reservation_workspaceId_idempotencyKey_key" ON "Reservation"("workspaceId", "idempotencyKey");
CREATE INDEX "Reservation_workspaceId_stem_status_idx" ON "Reservation"("workspaceId", "stem", "status");
CREATE UNIQUE INDEX "Assignment_reservationId_key" ON "Assignment"("reservationId");
CREATE UNIQUE INDEX "Assignment_workspaceId_sku_key" ON "Assignment"("workspaceId", "sku");
CREATE INDEX "Assignment_workspaceId_externalVariantId_idx" ON "Assignment"("workspaceId", "externalVariantId");
CREATE INDEX "AuditEvent_workspaceId_createdAt_idx" ON "AuditEvent"("workspaceId", "createdAt");
CREATE INDEX "AuditEvent_correlationId_idx" ON "AuditEvent"("correlationId");

-- FKs
ALTER TABLE "PolicyProfile" ADD CONSTRAINT "PolicyProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SequenceCursor" ADD CONSTRAINT "SequenceCursor_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

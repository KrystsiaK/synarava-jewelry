-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "workingSnapshot" JSONB;

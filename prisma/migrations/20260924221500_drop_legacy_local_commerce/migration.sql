-- Drop leftover columns / FKs that still point at the removed User model
-- (current prisma/schema.prisma uses adminUsername / uploadedByUsername / authoredByUsername).

ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_actorId_fkey";
DROP INDEX IF EXISTS "AuditLog_actorId_createdAt_idx";
ALTER TABLE "AuditLog" DROP COLUMN IF EXISTS "actorId";

ALTER TABLE "MediaAsset" DROP CONSTRAINT IF EXISTS "MediaAsset_uploadedById_fkey";
ALTER TABLE "MediaAsset" DROP COLUMN IF EXISTS "uploadedById";

ALTER TABLE "Page" DROP CONSTRAINT IF EXISTS "Page_authoredById_fkey";
ALTER TABLE "Page" DROP COLUMN IF EXISTS "authoredById";

-- Legacy local commerce / auth tables removed from Prisma schema after Shopify
-- became the catalog/cart/account source of truth. Test-mode hygiene drop.
DROP TABLE IF EXISTS "OrderItem" CASCADE;
DROP TABLE IF EXISTS "Order" CASCADE;
DROP TABLE IF EXISTS "CartItem" CASCADE;
DROP TABLE IF EXISTS "Cart" CASCADE;
DROP TABLE IF EXISTS "Address" CASCADE;
DROP TABLE IF EXISTS "CustomerProfile" CASCADE;
DROP TABLE IF EXISTS "AuthAccount" CASCADE;
DROP TABLE IF EXISTS "UserSession" CASCADE;
DROP TABLE IF EXISTS "UserRole" CASCADE;
DROP TABLE IF EXISTS "RolePermission" CASCADE;
DROP TABLE IF EXISTS "VerificationToken" CASCADE;
DROP TABLE IF EXISTS "Permission" CASCADE;
DROP TABLE IF EXISTS "Role" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;

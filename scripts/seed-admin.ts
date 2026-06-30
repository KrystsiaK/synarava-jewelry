import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "crypto";

const prisma = new PrismaClient();

const email = process.env.ADMIN_EMAIL ?? "kirylkrystsia@gmail.com";
const password = process.env.ADMIN_PASSWORD;

if (!password) {
  console.error("Error: set ADMIN_PASSWORD env var before running this script.");
  console.error("  ADMIN_PASSWORD=yourpassword npx tsx scripts/seed-admin.ts");
  process.exit(1);
}

function hashPassword(raw: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(raw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  // 1. Permission
  const permission = await prisma.permission.upsert({
    where: { key: "admin.access" },
    update: {},
    create: { key: "admin.access", name: "Admin access" },
  });

  // 2. Role
  const role = await prisma.role.upsert({
    where: { key: "admin" },
    update: {},
    create: {
      key: "admin",
      name: "Administrator",
      isSystem: true,
      permissions: {
        create: { permissionId: permission.id },
      },
    },
  });

  // Ensure permission is linked to role
  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
    update: {},
    create: { roleId: role.id, permissionId: permission.id },
  });

  // 3. User
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: hashPassword(password),
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
    create: {
      email,
      name: "Kiryl",
      passwordHash: hashPassword(password),
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
  });

  // 4. Role assignment
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  console.log(`✓ Admin user ready: ${email}`);
  console.log(`  User ID: ${user.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

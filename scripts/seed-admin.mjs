import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!email) {
  console.error("Error: set ADMIN_EMAIL env var before running this script.");
  process.exit(1);
}

if (!password) {
  console.error("Error: set ADMIN_PASSWORD env var before running this script.");
  process.exit(1);
}

function hashPassword(raw) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(raw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const permissions = [
    { key: "admin.access", name: "Access admin" },
    { key: "pages.manage", name: "Manage pages" },
    { key: "products.manage", name: "Manage products" },
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { name: permission.name },
      create: permission,
    });
  }

  const role = await prisma.role.upsert({
    where: { key: "admin" },
    update: {
      name: "Administrator",
      description: "Full CMS and commerce admin access.",
      isSystem: true,
    },
    create: {
      key: "admin",
      name: "Administrator",
      description: "Full CMS and commerce admin access.",
      isSystem: true,
    },
  });

  const savedPermissions = await prisma.permission.findMany({
    where: { key: { in: permissions.map((permission) => permission.key) } },
    select: { id: true },
  });

  for (const permission of savedPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: role.id,
        permissionId: permission.id,
      },
    });
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: hashPassword(password),
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
    create: {
      email,
      name: "Admin",
      passwordHash: hashPassword(password),
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: role.id,
    },
  });

  console.log(`Admin user ready: ${email}`);
  console.log(`User ID: ${user.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

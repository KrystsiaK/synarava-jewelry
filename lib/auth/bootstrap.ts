import { db } from "@/lib/db";

const permissions = [
  {
    key: "admin.access",
    name: "Access admin",
    description: "Can open the admin area.",
  },
  {
    key: "pages.manage",
    name: "Manage pages",
    description: "Can edit storefront pages.",
  },
  {
    key: "products.manage",
    name: "Manage products",
    description: "Can edit products, categories, and tags.",
  },
  {
    key: "users.manage",
    name: "Manage users",
    description: "Can manage staff and customer credentials.",
  },
];

const roles = [
  {
    key: "admin",
    name: "Administrator",
    description: "Full access to internal tools.",
    permissionKeys: permissions.map((permission) => permission.key),
  },
  {
    key: "editor",
    name: "Editor",
    description: "Can edit content and catalog, but not user access.",
    permissionKeys: ["admin.access", "pages.manage", "products.manage"],
  },
  {
    key: "customer",
    name: "Customer",
    description: "Basic storefront account.",
    permissionKeys: [],
  },
];

let authSeedPromise: Promise<void> | null = null;

export async function ensureAuthSeed() {
  if (authSeedPromise) {
    return authSeedPromise;
  }

  authSeedPromise = (async () => {
    for (const permission of permissions) {
      await db.permission.upsert({
        where: { key: permission.key },
        update: {
          name: permission.name,
          description: permission.description,
        },
        create: permission,
      });
    }

    for (const roleConfig of roles) {
      const role = await db.role.upsert({
        where: { key: roleConfig.key },
        update: {
          name: roleConfig.name,
          description: roleConfig.description,
          isSystem: true,
        },
        create: {
          key: roleConfig.key,
          name: roleConfig.name,
          description: roleConfig.description,
          isSystem: true,
        },
      });

      for (const permissionKey of roleConfig.permissionKeys) {
        const permission = await db.permission.findUnique({
          where: { key: permissionKey },
          select: { id: true },
        });

        if (!permission) {
          continue;
        }

        await db.rolePermission.upsert({
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
    }
  })();

  return authSeedPromise;
}

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serviceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(serviceRoot, "src/generated/prisma");
const destination = resolve(serviceRoot, "dist/generated/prisma");

if (!existsSync(source)) {
  throw new Error(
    "Prisma Client is missing. Run `pnpm --filter @synarava/sku-api prisma:generate` before build.",
  );
}

rmSync(destination, { force: true, recursive: true });
mkdirSync(dirname(destination), { recursive: true });
cpSync(source, destination, { recursive: true });

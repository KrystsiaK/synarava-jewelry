import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { LegacyImportRow, SkuRegistryStore } from "./registry/types.js";

const legacyRowSchema = z.object({
  sku: z.string().min(1),
  externalSystem: z.string().min(1).default("shopify"),
  externalShop: z.string().nullable().optional(),
  externalProductId: z.string().nullable().optional(),
  externalVariantId: z.string().nullable().optional(),
});

const legacyFileSchema = z.object({
  workspaceKey: z.string().min(1),
  rows: z.array(legacyRowSchema).max(10_000),
});

export type LegacyImportFile = z.infer<typeof legacyFileSchema>;

export async function loadLegacyFixture(
  filePath: string,
): Promise<LegacyImportFile> {
  const raw = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  return legacyFileSchema.parse(raw);
}

/**
 * Idempotent legacy importer. Does not call Shopify.
 * Safe fixtures live under fixtures/; canonical 49-row export is an ops input.
 */
export async function importLegacyFixture(
  store: SkuRegistryStore,
  file: LegacyImportFile,
  options: {
    readonly correlationId: string;
    readonly actor: string;
  },
) {
  await store.ensureWorkspace(file.workspaceKey);
  const rows: LegacyImportRow[] = file.rows.map((row) => ({
    sku: row.sku,
    externalSystem: row.externalSystem,
    externalShop: row.externalShop ?? null,
    externalProductId: row.externalProductId ?? null,
    externalVariantId: row.externalVariantId ?? null,
  }));

  return store.importLegacyAssignments(
    file.workspaceKey,
    rows,
    options.correlationId,
    options.actor,
  );
}

import { z } from "zod";

export const workspaceKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const correlationIdSchema = z.string().min(8).max(128);
export const idempotencyKeySchema = z.string().min(8).max(128);

export const previewRequestSchema = z.object({
  familyKey: z.string().min(1).max(128),
  correlationId: correlationIdSchema,
});

export const previewResponseSchema = z.object({
  ok: z.literal(true),
  sku: z.string().min(1),
  stem: z.string().min(1),
  sequence: z.number().int().positive(),
  policyVersion: z.number().int().positive(),
  familyKey: z.string().min(1),
  provisional: z.literal(true),
  correlationId: correlationIdSchema,
});

export const reserveRequestSchema = z.object({
  familyKey: z.string().min(1).max(128),
  correlationId: correlationIdSchema,
});

export const reserveResponseSchema = z.object({
  ok: z.literal(true),
  reservationId: z.string().min(1),
  sku: z.string().min(1),
  stem: z.string().min(1),
  sequence: z.number().int().positive(),
  policyVersion: z.number().int().positive(),
  familyKey: z.string().min(1),
  status: z.literal("pending"),
  correlationId: correlationIdSchema,
});

export const validateRequestSchema = z.object({
  sku: z.string().min(1).max(128),
  correlationId: correlationIdSchema,
});

export const validateResponseSchema = z.object({
  ok: z.literal(true),
  sku: z.string().min(1),
  validFormat: z.boolean(),
  assigned: z.boolean(),
  reservationStatus: z
    .enum(["pending", "confirmed", "cancelled", "expired", "tombstone"])
    .nullable(),
  policyVersion: z.number().int().positive().nullable(),
  correlationId: correlationIdSchema,
});

export const confirmAssignmentRequestSchema = z.object({
  reservationId: z.string().min(1),
  sku: z.string().min(1),
  externalSystem: z.literal("shopify"),
  externalShop: z.string().min(1),
  externalProductId: z.string().min(1),
  externalVariantId: z.string().min(1),
  shopifyReadBackSku: z.string().min(1),
  correlationId: correlationIdSchema,
});

export const confirmAssignmentResponseSchema = z.object({
  ok: z.literal(true),
  assignmentId: z.string().min(1),
  sku: z.string().min(1),
  policyVersion: z.number().int().positive(),
  status: z.literal("active"),
  correlationId: correlationIdSchema,
});

/** A bounded full-catalog audit payload. Shopify is fetched with pagination. */
export const CATALOG_AUDIT_MAX_BATCH = 5_000;

export const catalogAuditItemSchema = z.object({
  externalVariantId: z.string().min(1).max(256),
  sku: z.string().max(128),
});

export const shopifyCatalogSnapshotResponseSchema = z.object({
  ok: z.literal(true),
  source: z.literal("shopify"),
  complete: z.literal(true),
  itemCount: z.number().int().nonnegative().max(CATALOG_AUDIT_MAX_BATCH),
  items: z.array(catalogAuditItemSchema).max(CATALOG_AUDIT_MAX_BATCH),
}).refine((snapshot) => snapshot.itemCount === snapshot.items.length, {
  message: "itemCount must match items length",
  path: ["itemCount"],
});

export const catalogAuditRequestSchema = z.object({
  items: z.array(catalogAuditItemSchema).max(CATALOG_AUDIT_MAX_BATCH),
  previousDigest: z.string().min(1).max(128).nullable().optional(),
  correlationId: correlationIdSchema,
});

export const legacyBackfillRequestSchema = z
  .object({
    items: z.array(catalogAuditItemSchema).max(CATALOG_AUDIT_MAX_BATCH),
    mode: z.enum(["dry-run", "apply"]),
    expectedDigest: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    correlationId: correlationIdSchema,
  })
  .superRefine((request, context) => {
    if (request.mode === "apply" && !request.expectedDigest) {
      context.addIssue({
        code: "custom",
        path: ["expectedDigest"],
        message: "expectedDigest is required in apply mode",
      });
    }
  });

export const catalogAuditDeviationCodeSchema = z.enum([
  "MISSING_ASSIGNMENT",
  "SKU_MISMATCH",
  "EXTERNAL_EMPTY",
  "INVALID_FORMAT",
]);

export const catalogAuditDeviationSchema = z.object({
  externalVariantId: z.string().min(1),
  codes: z.array(catalogAuditDeviationCodeSchema).min(1),
  observedSku: z.string(),
  ledgerSku: z.string().nullable(),
  assignmentId: z.string().nullable(),
});

export const catalogAuditResponseSchema = z.object({
  ok: z.literal(true),
  itemCount: z.number().int().nonnegative(),
  deviationCount: z.number().int().nonnegative(),
  deviations: z.array(catalogAuditDeviationSchema),
  digest: z.string().min(1),
  shouldNotify: z.boolean(),
  durationMs: z.number().int().nonnegative(),
  llmEnabled: z.literal(false),
  correlationId: correlationIdSchema,
});

export type PreviewRequest = z.infer<typeof previewRequestSchema>;
export type PreviewResponse = z.infer<typeof previewResponseSchema>;
export type ReserveRequest = z.infer<typeof reserveRequestSchema>;
export type ReserveResponse = z.infer<typeof reserveResponseSchema>;
export type ValidateRequest = z.infer<typeof validateRequestSchema>;
export type ValidateResponse = z.infer<typeof validateResponseSchema>;
export type ConfirmAssignmentRequest = z.infer<
  typeof confirmAssignmentRequestSchema
>;
export type ConfirmAssignmentResponse = z.infer<
  typeof confirmAssignmentResponseSchema
>;
export type CatalogAuditRequest = z.infer<typeof catalogAuditRequestSchema>;
export type CatalogAuditResponse = z.infer<typeof catalogAuditResponseSchema>;
export type LegacyBackfillRequest = z.infer<typeof legacyBackfillRequestSchema>;
export type ShopifyCatalogSnapshotResponse = z.infer<
  typeof shopifyCatalogSnapshotResponseSchema
>;

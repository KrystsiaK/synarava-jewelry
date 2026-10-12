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

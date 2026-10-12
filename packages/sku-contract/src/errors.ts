import { z } from "zod";

export const skuErrorCodeSchema = z.enum([
  "INVALID_INPUT",
  "UNKNOWN_FAMILY",
  "INVALID_SKU_FORMAT",
  "SEQUENCE_EXHAUSTED",
  "PROFILE_NOT_PUBLISHED",
  "IDEMPOTENCY_CONFLICT",
  "RESERVATION_NOT_FOUND",
  "ASSIGNMENT_CONFLICT",
  "WORKSPACE_NOT_FOUND",
  "UNAUTHORIZED",
  "RATE_LIMITED",
]);

export type SkuApiErrorCode = z.infer<typeof skuErrorCodeSchema>;

export const skuErrorBodySchema = z.object({
  ok: z.literal(false),
  code: skuErrorCodeSchema,
  message: z.string(),
  correlationId: z.string().min(1),
  policyVersion: z.number().int().positive().optional(),
});

export type SkuErrorBody = z.infer<typeof skuErrorBodySchema>;

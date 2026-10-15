export const SkuErrorCode = {
  INVALID_INPUT: "INVALID_INPUT",
  UNKNOWN_FAMILY: "UNKNOWN_FAMILY",
  INVALID_SKU_FORMAT: "INVALID_SKU_FORMAT",
  SEQUENCE_EXHAUSTED: "SEQUENCE_EXHAUSTED",
  PROFILE_NOT_PUBLISHED: "PROFILE_NOT_PUBLISHED",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  RESERVATION_NOT_FOUND: "RESERVATION_NOT_FOUND",
  ASSIGNMENT_CONFLICT: "ASSIGNMENT_CONFLICT",
  WORKSPACE_NOT_FOUND: "WORKSPACE_NOT_FOUND",
} as const;

export type SkuErrorCode = (typeof SkuErrorCode)[keyof typeof SkuErrorCode];

export type SkuFailure = {
  readonly ok: false;
  readonly code: SkuErrorCode;
  readonly message: string;
};

export type SkuSuccess<T> = {
  readonly ok: true;
  readonly value: T;
};

export type SkuResult<T> = SkuSuccess<T> | SkuFailure;

export function ok<T>(value: T): SkuSuccess<T> {
  return { ok: true, value };
}

export function fail(code: SkuErrorCode, message: string): SkuFailure {
  return { ok: false, code, message };
}

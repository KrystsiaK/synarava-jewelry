import { Prisma } from "../generated/prisma/index.js";

export const SERIALIZABLE_RETRY_ATTEMPTS = 12;

/** Thrown inside a transaction to force a bounded outer retry (race, not domain error). */
export class RetryableTransactionConflict extends Error {
  constructor(message = "retryable transaction conflict") {
    super(message);
    this.name = "RetryableTransactionConflict";
  }
}

type PrismaLikeError = {
  readonly code?: string;
  readonly message?: string;
  readonly meta?: unknown;
};

function asPrismaLikeError(error: unknown): PrismaLikeError | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error;
  }
  // Duck-type: generated client copies can break instanceof across bundles.
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return error as PrismaLikeError;
  }
  return null;
}

function isPostgresSerializationFailure(error: PrismaLikeError): boolean {
  // Interactive transactions usually surface as P2034; raw SQL often as P2010 + SQLSTATE 40001.
  if (error.code === "P2034") return true;
  const haystack = `${error.message ?? ""}\n${JSON.stringify(error.meta ?? {})}`;
  return (
    haystack.includes("40001") ||
    /could not serialize access/i.test(haystack) ||
    /serialization failure/i.test(haystack) ||
    /deadlock detected/i.test(haystack)
  );
}

export function isRetryablePrismaError(error: unknown): boolean {
  if (error instanceof RetryableTransactionConflict) {
    return true;
  }
  const prismaError = asPrismaLikeError(error);
  if (!prismaError) return false;
  // P2002: unique violation (idempotency key or SKU race under concurrent reserve)
  if (prismaError.code === "P2002") return true;
  return isPostgresSerializationFailure(prismaError);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Bounded retry for Serializable transactions and unique-constraint races.
 * Backoff grows gently with jitter; default 12 attempts for parallel stem load.
 */
export async function withSerializableRetry<T>(
  operation: () => Promise<T>,
  options?: { readonly maxAttempts?: number },
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? SERIALIZABLE_RETRY_ATTEMPTS;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryablePrismaError(error) || attempt >= maxAttempts) {
        throw error;
      }
      const base = Math.min(100, 4 * 2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * 12);
      await sleep(base + jitter);
    }
  }

  throw lastError;
}

/**
 * Safe failure labels for GA/Clarity probe errors.
 * Never include tokens, Authorization headers, or response bodies.
 */

export type SafeHttpFailureInput = {
  status?: number;
  body?: string;
  name?: string;
  message?: string;
  code?: string;
};

function isTimeoutLike(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as SafeHttpFailureInput & { cause?: unknown };
  const name = String(record.name ?? "");
  const message = String(record.message ?? "").toLowerCase();
  const code = String(record.code ?? "");
  if (name === "TimeoutError" || name === "AbortError") return true;
  if (code === "ETIMEDOUT" || code === "ABORT_ERR") return true;
  if (message.includes("timeout") || message.includes("aborted")) return true;
  return false;
}

function statusClass(status: number): string {
  if (status === 401) return "http_401";
  if (status === 403) return "http_403";
  if (status === 429) return "http_429";
  if (status >= 500 && status <= 599) return "http_5xx";
  if (status >= 400 && status <= 499) return `http_${status}`;
  return `http_${status}`;
}

/**
 * Classify a fetch/HTTP failure for admin display.
 * Output is only status + short class (401/403/429/5xx/timeout).
 */
export function safeHttpFailureReason(error: unknown): string {
  if (isTimeoutLike(error)) {
    return "timeout";
  }

  const status =
    error && typeof error === "object" && "status" in error
      ? Number((error as SafeHttpFailureInput).status)
      : NaN;

  if (Number.isFinite(status) && status > 0) {
    const klass = statusClass(status);
    return `${klass} (${status})`;
  }

  if (error instanceof Error) {
    const message = error.message;
    const statusMatch = message.match(/\((\d{3})\)/);
    if (statusMatch) {
      const code = Number(statusMatch[1]);
      return `${statusClass(code)} (${code})`;
    }
    if (/timeout|aborted/i.test(message)) return "timeout";
  }

  return "http_unknown";
}

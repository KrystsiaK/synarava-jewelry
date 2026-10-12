import { fail, ok, type SkuResult } from "./errors.js";

/**
 * Normalize a semantic family key: trim, lowercase, collapse whitespace to dots.
 * Does not invent Synarava-specific tokens — callers supply structured keys.
 */
export function normalizeFamilyKey(raw: string): SkuResult<string> {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) {
    return fail("INVALID_INPUT", "family key is required");
  }

  const collapsed = trimmed
    .replace(/[\s_/]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  if (!/^[a-z0-9]+(?:\.[a-z0-9]+)*$/.test(collapsed)) {
    return fail(
      "INVALID_INPUT",
      `family key must be dotted lowercase segments, got "${raw}"`,
    );
  }

  return ok(collapsed);
}

/** Uppercase stem tokens; keep separator characters. */
export function normalizeStem(raw: string, separator: string): SkuResult<string> {
  const trimmed = raw.trim().toUpperCase();
  if (trimmed.length === 0) {
    return fail("INVALID_INPUT", "stem is required");
  }

  const escaped = escapeRegExp(separator);
  const token = "[A-Z0-9.]+";
  const pattern = new RegExp(`^${token}(?:${escaped}${token})*$`);
  if (!pattern.test(trimmed)) {
    return fail("INVALID_INPUT", `stem "${raw}" is not a valid token sequence`);
  }

  return ok(trimmed);
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

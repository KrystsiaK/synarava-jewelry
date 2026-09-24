import { z } from "zod";

export const OPTIONAL_EMAIL_ERROR = "Enter a valid email address.";

/** Empty is allowed; non-empty must be a valid email. */
export function isValidOptionalEmail(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return z.string().email().safeParse(trimmed).success;
}

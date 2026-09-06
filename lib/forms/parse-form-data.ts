import type { z, ZodType } from "zod";

/**
 * Validates a `FormData` submission against a zod schema, rather than the
 * `String(formData.get("field") ?? "").trim()` done by hand at each call
 * site. Every entry is read as a string (a `File` value becomes `""` — no
 * action in this app expects a file through a validated text field); the
 * schema is the single place each field's shape, trimming, and defaults
 * are declared, instead of scattered across ad hoc parsing.
 */
export function parseFormData<Schema extends ZodType>(
  formData: FormData,
  schema: Schema,
): z.ZodSafeParseResult<z.output<Schema>> {
  const raw: Record<string, string> = {};
  for (const key of new Set(formData.keys())) {
    const value = formData.get(key);
    raw[key] = typeof value === "string" ? value : "";
  }
  return schema.safeParse(raw);
}

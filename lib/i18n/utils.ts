/** Later layers win per key. Used to stack local override maps (shared chrome, then cart/account). */
export function mergeLocaleOverrides(
  ...layers: Array<Record<string, Record<string, string>> | undefined>
): Record<string, Record<string, string>> {
  const merged: Record<string, Record<string, string>> = {};
  for (const layer of layers) {
    if (!layer) continue;
    for (const [locale, fields] of Object.entries(layer)) {
      merged[locale] = { ...merged[locale], ...fields };
    }
  }
  return merged;
}

export function flattenMessages(
  obj: Record<string, unknown>,
  prefix = "",
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") {
      result[fullKey] = v;
    } else if (typeof v === "object" && v !== null) {
      Object.assign(result, flattenMessages(v as Record<string, unknown>, fullKey));
    }
  }
  return result;
}

/** Public storefront name: first word + last initial (e.g. "Ana S."). */
export function publicAuthorName(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Customer";
  if (parts.length === 1) return parts[0]!;
  const last = parts.at(-1) ?? "";
  const initial = Array.from(last)[0] ?? "";
  return initial ? `${parts[0]} ${initial}.` : parts[0]!;
}

/** Normalize email for unique (productId, authorEmail) storage. */
export function normalizeReviewEmail(email: string): string {
  return email.trim().toLowerCase();
}

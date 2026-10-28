/**
 * Opaque list-pagination cursor: JSON `{ fp, id }` ↔ base64url.
 * Shared by admin product list + storefront catalog (DEAD-005).
 */

export type Base64UrlJsonCursorPayload = {
  /** Fingerprint of the query that minted the cursor. */
  fp: string;
  /** Last-seen entity id. */
  id: string;
};

export function encodeBase64UrlJsonCursor(payload: Base64UrlJsonCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/**
 * Returns the last-seen id, or null if missing, malformed, or minted for a
 * different fingerprint.
 */
export function decodeBase64UrlJsonCursor(
  raw: string | null | undefined,
  expectedFp: string,
): string | null {
  if (!raw) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as Partial<Base64UrlJsonCursorPayload>;
    if (typeof payload.id !== "string" || payload.fp !== expectedFp) return null;
    return payload.id;
  } catch {
    return null;
  }
}

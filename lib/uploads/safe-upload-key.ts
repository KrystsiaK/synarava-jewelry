/**
 * Upload object keys must stay under `uploads/` with safe path segments.
 * Check the joined key (not only per-segment `.` / `..`) so encoded `/` or
 * nested `../` cannot slip through after decode.
 */
const SAFE_SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function isSafeUploadKey(keyOrParts: string | string[]): boolean {
  const key = Array.isArray(keyOrParts) ? keyOrParts.join("/") : keyOrParts;
  if (!key || key.includes("\\") || key.includes("\0") || key.includes("//")) return false;
  const parts = key.split("/");
  if (parts[0] !== "uploads" || parts.length < 2) return false;
  return parts.slice(1).every(
    (part) => part.length > 0 && part !== "." && part !== ".." && SAFE_SEGMENT_RE.test(part),
  );
}

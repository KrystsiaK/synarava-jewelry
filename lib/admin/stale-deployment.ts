/**
 * Next.js throws UnrecognizedActionError when the browser's Server Action ID
 * is missing from the running deployment (version skew after a Railway
 * rollout, or a truncated multipart body that corrupts the action id).
 * Admin recovery UI treats that as "reload the latest version".
 */
export function isStaleDeploymentError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  return (
    name === "UnrecognizedActionError" ||
    /server action.+not found|failed to find server action/i.test(message)
  );
}

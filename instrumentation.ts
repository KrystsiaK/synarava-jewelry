import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const digest = typeof error === "object" && error !== null && "digest" in error
    ? String(error.digest)
    : null;

  const entry = {
    event: "synarava_server_error",
    schemaVersion: 1,
    errorType: error instanceof Error ? error.name : typeof error,
    digest,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    revalidateReason: context.revalidateReason,
  };

  // Structured output is collected by the deployment platform. Deliberately
  // omit request URLs, headers, error messages, and stacks to avoid leaking PII.
  console.error(JSON.stringify(entry));
};

"use client";

import { AdminErrorState } from "@/components/admin/shared/admin-error-state";

function isStaleDeploymentError(error: Error) {
  return error.name === "UnrecognizedActionError" ||
    /server action.+not found|failed to find server action/i.test(error.message);
}

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AdminErrorState
      staleDeployment={isStaleDeploymentError(error)}
      onRetry={reset}
      onReload={() => window.location.reload()}
    />
  );
}

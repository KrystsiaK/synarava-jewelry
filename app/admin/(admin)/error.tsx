"use client";

import { AdminErrorState } from "@/components/admin/shared/admin-error-state";
import { isStaleDeploymentError } from "@/lib/admin/stale-deployment";

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

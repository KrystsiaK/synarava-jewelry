"use client";

import { AlertTriangle } from "lucide-react";

export function AdminErrorState({
  staleDeployment,
  onRetry,
  onReload,
}: {
  staleDeployment: boolean;
  onRetry: () => void;
  onReload: () => void;
}) {
  return (
    <div className="mx-auto grid min-h-[70vh] max-w-2xl place-items-center px-4 py-12">
      <section className="adm-panel w-full p-6 sm:p-8" role="alert" aria-labelledby="admin-error-title">
        <AlertTriangle aria-hidden="true" className="size-7" style={{ color: "var(--adm-accent)" }} />
        <p className="adm-section-tag mt-6">[ RECOVERY ]</p>
        <h1 id="admin-error-title" className="adm-page-title mt-3">
          {staleDeployment ? "Admin was updated" : "This page could not load"}
        </h1>
        <p className="adm-page-subtitle mt-3 max-w-xl">
          {staleDeployment
            ? "This tab is using an older application version. Reload before continuing so actions run against the current deployment."
            : "Try the page again. If the problem remains, reload the admin to start from a clean application state."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {!staleDeployment ? (
            <button type="button" className="adm-btn" onClick={onRetry}>
              Try again
            </button>
          ) : null}
          <button type="button" className={staleDeployment ? "adm-btn" : "adm-btn-ghost"} onClick={onReload}>
            Reload latest version
          </button>
        </div>
        <p className="mt-4 text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
          Unsaved fields in this tab may need to be entered again after reloading.
        </p>
      </section>
    </div>
  );
}

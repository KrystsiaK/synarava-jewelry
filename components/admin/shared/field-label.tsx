import type { ReactNode } from "react";

import { AdminHelp } from "@/components/admin/shared/admin-help";

/** Plain field label with optional required mark and help tooltip. */
export function FieldLabel({
  children,
  help,
  required,
}: {
  children: ReactNode;
  help?: ReactNode;
  required?: boolean;
}) {
  return (
    <span data-component="FieldLabel" className="adm-label-row min-h-6">
      <span className="adm-label">
        {children}
        {required ? <span style={{ color: "var(--adm-accent)", marginLeft: "0.25rem" }}>*</span> : null}
      </span>
      {help ? (
        typeof help === "string" || typeof help === "number"
          ? <AdminHelp>{help}</AdminHelp>
          : help
      ) : null}
    </span>
  );
}

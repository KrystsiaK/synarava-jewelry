import type { ReactNode } from "react";

export function AdminHelp({
  children,
  label = "Field guidance",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <span className="adm-help">
      <button type="button" className="adm-help__trigger" aria-label={label}>
        i
      </button>
      <span className="adm-help__popover" role="tooltip">
        {children}
      </span>
    </span>
  );
}

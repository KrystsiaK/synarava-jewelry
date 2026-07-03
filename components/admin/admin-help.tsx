import type { ReactNode } from "react";

export function AdminHelp({
  children,
  label = "Field guidance",
  align = "center",
}: {
  children: ReactNode;
  label?: string;
  align?: "start" | "center" | "end";
}) {
  return (
    <span className="adm-help" data-align={align}>
      <button type="button" className="adm-help__trigger" aria-label={label}>
        i
      </button>
      <span className="adm-help__popover" role="tooltip">
        {children}
      </span>
    </span>
  );
}

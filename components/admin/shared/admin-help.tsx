import type { ReactNode } from "react";

import { Tooltip } from "@/components/ui/tooltip";

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
    <span data-component="AdminHelp" className="adm-help" data-align={align}>
      <Tooltip content={children} align={align} side="auto">
        <button type="button" className="adm-help__trigger" aria-label={label}>
          <span className="adm-help__mark" aria-hidden="true">
            i
          </span>
        </button>
      </Tooltip>
    </span>
  );
}

import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";

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
          <CircleHelp aria-hidden="true" size={14} strokeWidth={1.8} />
        </button>
      </Tooltip>
    </span>
  );
}

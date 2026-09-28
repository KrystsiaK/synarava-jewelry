import type { ReactNode } from "react";

import { Tooltip } from "@/components/ui/tooltip";

export function AdminHelp({
  children,
  label = "Field guidance",
  align = "center",
  detached = false,
}: {
  children: ReactNode;
  label?: string;
  align?: "start" | "center" | "end";
  /** Circle button for help that sits between sections, not beside a label. */
  detached?: boolean;
}) {
  return (
    <span data-component="AdminHelp" className="adm-help" data-align={align} data-detached={detached ? "true" : undefined}>
      <Tooltip content={children} align={align} side="auto">
        <button type="button" className="adm-help__trigger" aria-label={label}>
          <span className="adm-help__mark" aria-hidden="true">
            <span className="adm-help__glyph">i</span>
          </span>
        </button>
      </Tooltip>
    </span>
  );
}

import type { ReactNode } from "react";

import { Tooltip } from "@/components/ui/tooltip";

/** Hover/focus open delay for the field «i» mark. Other Tooltip callers keep their own delay. */
export const ADMIN_HELP_TOOLTIP_DELAY_MS = 550;

/** Visible gap between the «i» trigger and the floating tip (px). */
export const ADMIN_HELP_TOOLTIP_OFFSET_PX = 18;

export function AdminHelp({
  children,
  label = "Field guidance",
  align = "start",
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
      <Tooltip
        content={children}
        align={align}
        side="top"
        delay={ADMIN_HELP_TOOLTIP_DELAY_MS}
        offset={ADMIN_HELP_TOOLTIP_OFFSET_PX}
        openOnClick
      >
        <button type="button" className="adm-help__trigger" aria-label={label}>
          <span className="adm-help__mark" aria-hidden="true">
            <span className="adm-help__glyph">i</span>
          </span>
        </button>
      </Tooltip>
    </span>
  );
}

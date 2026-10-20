"use client";

import { MissionControlCopyPromptButton } from "@/components/admin/mission-control/mission-control-copy-prompt-button";
import { shouldShowFixGuidance } from "@/lib/mission-control/wiring";
import type { ServiceStatusLevel } from "@/lib/mission-control/status";

type MissionControlFixGuidanceProps = {
  widgetKey: string;
  level: ServiceStatusLevel;
  fixHint: string | null;
  fixPrompt: string | null;
};

/**
 * Static fix hint + optional Copy prompt for warn/down/unknown nodes.
 */
export function MissionControlFixGuidance({
  widgetKey,
  level,
  fixHint,
  fixPrompt,
}: MissionControlFixGuidanceProps) {
  if (!shouldShowFixGuidance(level) || !fixHint) {
    return null;
  }

  return (
    <div className="mt-2 space-y-1" data-testid={`mc-fix-guidance-${widgetKey}`}>
      <p
        className="text-[11px] leading-snug text-muted-ink"
        data-testid={`mc-fix-hint-${widgetKey}`}
      >
        {fixHint}
      </p>
      {fixPrompt ? (
        <MissionControlCopyPromptButton prompt={fixPrompt} widgetKey={widgetKey} />
      ) : null}
    </div>
  );
}

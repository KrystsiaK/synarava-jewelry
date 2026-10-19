import type { ServiceStatusLevel } from "@/lib/mission-control/status";

const ALERT_LEVELS: ReadonlySet<ServiceStatusLevel> = new Set(["warn", "down"]);

/**
 * Alert only when level changes into warn/down (destination is alertable and
 * different from the previous level). Same-level repeats do not alert.
 */
export function shouldAlertOnLevelChange(
  previous: ServiceStatusLevel | null,
  next: ServiceStatusLevel,
): boolean {
  if (!ALERT_LEVELS.has(next)) return false;
  return previous !== next;
}

export type AlertMessageInput = {
  nodeName: string;
  level: ServiceStatusLevel;
  /** Short static instruction — Stage 6 will add per-node fixHint. */
  hint?: string;
  hubUrl: string;
};

const DEFAULT_HINT =
  "Open Mission Control, inspect the node, then follow the linked runbook.";

/** Build a plain-text Telegram body (no secrets). */
export function buildAlertMessage(input: AlertMessageInput): string {
  const hint = input.hint?.trim() || DEFAULT_HINT;
  return [
    `Mission Control: ${input.nodeName} → ${input.level}`,
    hint,
    input.hubUrl,
  ].join("\n");
}

import type { WiringConfig } from "@synarava/wiring-engine";
import wiringConfigJson from "@/lib/mission-control/wiring-config.json";
import type { ServiceStatusLevel } from "@/lib/mission-control/status";

/**
 * Required start of every live-node fixPrompt (Stage 6).
 * Keep in sync with the strings in wiring-config.json.
 */
export const FIX_PROMPT_SAFETY_PREAMBLE =
  "Investigate read-only first; never run prisma migrate dev/reset/diff, db push, db execute or any shadow database; never use or request production write credentials; propose changes as a pull request and wait for the owner.";

/** Static “how to fix” metadata next to each WiringConfig node. */
export type MissionControlNodeFixConfig = {
  widgetKey: string;
  /** 1–2 sentences for the owner: what this node means and where to look first. */
  fixHint: string;
  /** Ready prompt for an AI coding agent. Absent for placeholders. */
  fixPrompt?: string;
};

/** WiringConfig plus Stage 6 static fix guidance (still one JSON file). */
export type MissionControlWiringConfig = WiringConfig & {
  nodes: MissionControlNodeFixConfig[];
};

/** Single repo WiringConfig — source of truth for Mission Control edges + fix copy. */
export const missionControlWiringConfig =
  wiringConfigJson as MissionControlWiringConfig;

export function getMissionControlWiringConfig(): MissionControlWiringConfig {
  return missionControlWiringConfig;
}

export function getNodeFixConfig(
  widgetKey: string,
  config: MissionControlWiringConfig = missionControlWiringConfig,
): MissionControlNodeFixConfig | undefined {
  return config.nodes.find((node) => node.widgetKey === widgetKey);
}

/** Show static fix hint / copy-prompt only when the node is not healthy. */
export function shouldShowFixGuidance(level: ServiceStatusLevel): boolean {
  return level === "warn" || level === "down" || level === "unknown";
}

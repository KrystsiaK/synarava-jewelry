import type { WiringConfig } from "@synarava/wiring-engine";
import wiringConfigJson from "@/lib/mission-control/wiring-config.json";
import type { ServiceStatusLevel } from "@/lib/mission-control/status";

export const FIX_PROMPT_SAFETY_PREAMBLE =
  "Investigate read-only first; never run prisma migrate dev/reset/diff, db push, db execute or any shadow database; never use or request production write credentials; propose changes as a pull request and wait for the owner.";

export type MissionControlEnvironment = "production" | "staging";
export type MissionControlNodeKind = "live" | "info" | "placeholder";
export type MissionControlNodeType = "service" | "database" | "storage" | "automation" | "package" | "platform" | "agent" | "future";
export type MissionControlFlow = "continuous" | "event";
export type MissionControlDocLink = { label: string; href: string };
export type MissionControlEnvironmentConfig = { label: string; href: string; settings?: Record<string, string> };
export type MissionControlGroupConfig = { key: string; label: string; position: { x: number; y: number }; size: { width: number; height: number } };
export type MissionControlNodeConfig = {
  widgetKey: string;
  label: string;
  kind: MissionControlNodeKind;
  type: MissionControlNodeType;
  group: string;
  position: { x: number; y: number };
  provider?: string;
  docs: MissionControlDocLink[];
  env: Record<MissionControlEnvironment, MissionControlEnvironmentConfig>;
  fixHint?: string;
  fixPrompt?: string;
  engine?: string;
  usedBy?: string[];
};
export type MissionControlBinding = WiringConfig["systemBindings"][number] & { flow: MissionControlFlow };
export type MissionControlWiringConfig = WiringConfig & {
  version: string;
  groups: MissionControlGroupConfig[];
  nodes: MissionControlNodeConfig[];
  architectureBindings: MissionControlBinding[];
};

export const missionControlWiringConfig = wiringConfigJson as MissionControlWiringConfig;
export function getMissionControlWiringConfig(): MissionControlWiringConfig { return missionControlWiringConfig; }
export function getNodeFixConfig(widgetKey: string, config: MissionControlWiringConfig = missionControlWiringConfig): MissionControlNodeConfig | undefined {
  return config.nodes.find((node) => node.widgetKey === widgetKey);
}
export function shouldShowFixGuidance(level: ServiceStatusLevel): boolean {
  return level === "warn" || level === "down" || level === "unknown";
}

import type { WiringConfig } from "@synarava/wiring-engine";
import wiringConfigJson from "@/lib/mission-control/wiring-config.json";

/** Single repo WiringConfig — source of truth for Mission Control edges. */
export const missionControlWiringConfig = wiringConfigJson as WiringConfig;

export function getMissionControlWiringConfig(): WiringConfig {
  return missionControlWiringConfig;
}

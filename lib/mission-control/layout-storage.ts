import type { MissionControlEnvironment } from "@/lib/mission-control/wiring";

export type MissionControlPositions = Record<string, { x: number; y: number }>;
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function missionControlLayoutKey(version: string, environment: MissionControlEnvironment): string {
  return `synarava:mission-control-layout:${version}:${environment}`;
}

export function loadMissionControlLayout(storage: StorageLike | null, version: string, environment: MissionControlEnvironment): MissionControlPositions {
  if (!storage) return {};
  try {
    const parsed: unknown = JSON.parse(storage.getItem(missionControlLayoutKey(version, environment)) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, { x: number; y: number }] => {
      const value = entry[1] as { x?: unknown; y?: unknown };
      return Boolean(value && Number.isFinite(value.x) && Number.isFinite(value.y));
    }));
  } catch { return {}; }
}

export function saveMissionControlLayout(storage: StorageLike | null, version: string, environment: MissionControlEnvironment, positions: MissionControlPositions): boolean {
  if (!storage) return false;
  try { storage.setItem(missionControlLayoutKey(version, environment), JSON.stringify(positions)); return true; }
  catch { return false; }
}

export function resetMissionControlLayout(storage: StorageLike | null, version: string, environment: MissionControlEnvironment): boolean {
  if (!storage) return false;
  try { storage.removeItem(missionControlLayoutKey(version, environment)); return true; }
  catch { return false; }
}

import { describe, expect, it, vi } from "vitest";
import { loadMissionControlLayout, missionControlLayoutKey, resetMissionControlLayout, saveMissionControlLayout } from "@/lib/mission-control/layout-storage";

describe("Mission Control local layout", () => {
  it("keys positions by environment and config version", () => {
    expect(missionControlLayoutKey("1.1.0", "production")).not.toBe(missionControlLayoutKey("1.1.0", "staging"));
    expect(missionControlLayoutKey("1.1.0", "production")).not.toBe(missionControlLayoutKey("1.2.0", "production"));
  });

  it("round-trips positions and resets without affecting services", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
    expect(saveMissionControlLayout(storage, "1.1.0", "staging", { api: { x: 12, y: 24 } })).toBe(true);
    expect(loadMissionControlLayout(storage, "1.1.0", "staging")).toEqual({ api: { x: 12, y: 24 } });
    expect(resetMissionControlLayout(storage, "1.1.0", "staging")).toBe(true);
    expect(loadMissionControlLayout(storage, "1.1.0", "staging")).toEqual({});
  });

  it("fails closed when storage is unavailable or corrupt", () => {
    const storage = { getItem: vi.fn(() => "{"), setItem: vi.fn(() => { throw new Error("blocked"); }), removeItem: vi.fn(() => { throw new Error("blocked"); }) };
    expect(loadMissionControlLayout(storage, "1.1.0", "production")).toEqual({});
    expect(saveMissionControlLayout(storage, "1.1.0", "production", {})).toBe(false);
    expect(resetMissionControlLayout(storage, "1.1.0", "production")).toBe(false);
  });
});

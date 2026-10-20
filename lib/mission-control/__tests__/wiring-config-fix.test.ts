import { describe, expect, it } from "vitest";
import { LIVE_NODE_KEYS, PLACEHOLDER_NODE_KEYS } from "@/lib/mission-control/live-snapshot";
import {
  FIX_PROMPT_SAFETY_PREAMBLE,
  getMissionControlWiringConfig,
  getNodeFixConfig,
} from "@/lib/mission-control/wiring";

describe("wiring-config fixHint / fixPrompt", () => {
  const config = getMissionControlWiringConfig();

  it("gives every live node a non-empty fixHint and a fixPrompt with the safety preamble", () => {
    for (const key of LIVE_NODE_KEYS) {
      const fix = getNodeFixConfig(key, config);
      expect(fix, `missing nodes entry for ${key}`).toBeDefined();
      expect(fix!.fixHint.trim().length).toBeGreaterThan(0);
      expect(fix!.fixPrompt, `${key} must have fixPrompt`).toBeTruthy();
      expect(fix!.fixPrompt!.startsWith(FIX_PROMPT_SAFETY_PREAMBLE)).toBe(
        true,
      );
    }
  });

  it("gives placeholders a generic not-connected hint and no fixPrompt", () => {
    for (const key of PLACEHOLDER_NODE_KEYS) {
      const fix = getNodeFixConfig(key, config);
      expect(fix, `missing nodes entry for ${key}`).toBeDefined();
      expect(fix!.fixHint.toLowerCase()).toContain("not connected yet");
      expect(fix!.fixPrompt).toBeUndefined();
    }
  });
});

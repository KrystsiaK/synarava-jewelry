import { describe, expect, it } from "vitest";
import { LIVE_NODE_KEYS } from "@/lib/mission-control/live-snapshot";
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

  it("keeps placeholders visibly not wired and without executable guidance", () => {
    for (const node of config.nodes.filter((entry) => entry.kind === "placeholder")) {
      expect(node.fixPrompt).toBeUndefined();
      expect(node.provider).toBeUndefined();
    }
  });
});

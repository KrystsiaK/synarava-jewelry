import { describe, expect, it } from "vitest";
import { getMissionControlWiringConfig } from "@/lib/mission-control/wiring";

describe("Mission Control architecture config", () => {
  const config = getMissionControlWiringConfig();

  it("keeps every node in a declared group and every binding endpoint declared", () => {
    const groups = new Set(config.groups.map((group) => group.key));
    const nodes = new Set(config.nodes.map((node) => node.widgetKey));
    expect(nodes.size).toBe(config.nodes.length);
    for (const node of config.nodes) {
      expect(groups.has(node.group), `${node.widgetKey} group`).toBe(true);
      expect(Number.isFinite(node.position.x) && Number.isFinite(node.position.y)).toBe(true);
      expect(node.docs.every((doc) => Boolean(doc.href.trim()))).toBe(true);
    }
    for (const binding of config.architectureBindings) {
      expect(binding.label).toBe("");
      expect(binding.source && nodes.has(binding.source.widgetKey)).toBe(true);
      expect(binding.sinks.every((sink) => nodes.has(sink.widgetKey))).toBe(true);
    }
  });

  it("models live, reference, placeholder, and database extension nodes", () => {
    expect(new Set(config.nodes.map((node) => node.kind))).toEqual(new Set(["live", "info", "placeholder"]));
    expect(config.nodes.some((node) => node.type === "database" && node.engine)).toBe(true);
  });
});

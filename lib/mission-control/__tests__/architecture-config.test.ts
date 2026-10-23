import { describe, expect, it } from "vitest";
import { MISSION_CONTROL_NODE_SIZE } from "@/lib/mission-control/canvas-model";
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

  it("keeps the deterministic grid collision-free and inside every group", () => {
    const dimensions = (kind: "live" | "info" | "placeholder") => MISSION_CONTROL_NODE_SIZE[kind];

    for (const group of config.groups) {
      const nodes = config.nodes.filter((node) => node.group === group.key);
      for (const node of nodes) {
        const size = dimensions(node.kind);
        expect(node.position.x, `${node.widgetKey} left bound`).toBeGreaterThanOrEqual(0);
        expect(node.position.y, `${node.widgetKey} header clearance`).toBeGreaterThanOrEqual(54);
        expect(node.position.x + size.width, `${node.widgetKey} right bound`).toBeLessThanOrEqual(group.size.width);
        expect(node.position.y + size.height, `${node.widgetKey} bottom bound`).toBeLessThanOrEqual(group.size.height);
      }
      for (let left = 0; left < nodes.length; left += 1) {
        for (let right = left + 1; right < nodes.length; right += 1) {
          const a = nodes[left];
          const b = nodes[right];
          const aSize = dimensions(a.kind);
          const bSize = dimensions(b.kind);
          const overlaps = a.position.x < b.position.x + bSize.width
            && a.position.x + aSize.width > b.position.x
            && a.position.y < b.position.y + bSize.height
            && a.position.y + aSize.height > b.position.y;
          expect(overlaps, `${a.widgetKey} overlaps ${b.widgetKey}`).toBe(false);
        }
      }
    }
  });
});

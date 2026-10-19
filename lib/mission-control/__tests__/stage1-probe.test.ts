import { describe, expect, it } from "vitest";
import { defineWidget } from "@synarava/wiring-engine";
import {
  MISSION_CONTROL_PROBE_KEY,
  buildMissionControlProbePorts,
  createMissionControlProbeDefinition,
} from "@/lib/mission-control/stage1-probe";

function DummyComponent() {
  return null;
}

describe("Mission Control Stage 1 probe contract", () => {
  it("exposes a single status_out json output port", () => {
    const ports = buildMissionControlProbePorts();

    expect(ports).toHaveLength(1);
    expect(ports[0]).toMatchObject({
      portKey: "status_out",
      direction: "output",
      valueType: "json",
      label: "Status",
    });
  });

  it("registers through defineWidget with a stable key and the status port", () => {
    const definition = createMissionControlProbeDefinition(DummyComponent);

    expect(definition.key).toBe(MISSION_CONTROL_PROBE_KEY);
    expect(definition.name).toBe("Stage 1 Probe");
    expect(definition.Component).toBe(DummyComponent);
    expect(definition.ports).toEqual(buildMissionControlProbePorts());
    expect(definition.ui?.color).toBe("#2f6f5e");
  });

  it("rejects an invalid port direction via wiring-engine defineWidget", () => {
    expect(() =>
      defineWidget({
        key: "bad_probe",
        name: "Bad",
        Component: DummyComponent,
        ports: [
          {
            portKey: "status_out",
            // Intentional contract break — defineWidget must throw.
            direction: "sideways" as "output",
            valueType: "json",
            label: "Status",
          },
        ],
      }),
    ).toThrow(/direction must be "input" or "output"/);
  });
});

import { defineWidget, type PortDefinition, type WidgetDefinition } from "@synarava/wiring-engine";
import type { ComponentType } from "react";

/** Stable widget key for the Stage 1 connectivity probe (WiringConfig nodeKey later). */
export const MISSION_CONTROL_PROBE_KEY = "mc_stage1_probe";

/**
 * Stage 1 status port — same shape Mission Control nodes will use
 * (`status_out` / json). Pure so unit tests can lock the contract without UI.
 */
export function buildMissionControlProbePorts(): PortDefinition[] {
  return [
    {
      portKey: "status_out",
      direction: "output",
      valueType: "json",
      label: "Status",
      description: "Node health payload (level, message, checkedAt)",
    },
  ];
}

export type MissionControlProbeDefinition = WidgetDefinition;

/**
 * Register the Stage 1 probe through `defineWidget` so runtime contract checks
 * run (key/name/Component/ports). No fork of package logic — validation stays
 * in `@synarava/wiring-engine`.
 */
export function createMissionControlProbeDefinition(
  Component: ComponentType,
): MissionControlProbeDefinition {
  return defineWidget({
    key: MISSION_CONTROL_PROBE_KEY,
    name: "Stage 1 Probe",
    description: "Mission Control Stage 1 — wiring-engine + shell-kit connectivity probe",
    ports: buildMissionControlProbePorts(),
    Component,
    ui: { color: "#2f6f5e", icon: "activity" },
  });
}

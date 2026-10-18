"use client";

import { useMemo } from "react";
import {
  BaseShell,
  BaseWidget,
  ColorSchemeProvider,
} from "@synarava/shell-kit";
import "@synarava/shell-kit/styles.css";
import { createMissionControlProbeDefinition } from "@/lib/mission-control/stage1-probe";

function MissionControlProbeBody() {
  return (
    <BaseWidget
      title="Stage 1 Probe"
      eyebrow="Mission Control"
      subtitle="@synarava/wiring-engine + @synarava/shell-kit"
      dataTestId="mc-stage1-probe"
      backgroundStyle="mist"
    >
      <p className="text-sm text-muted-ink">
        Published packages loaded from GitHub Packages. Widget registered via{" "}
        <code className="text-xs">defineWidget</code>, rendered inside{" "}
        <code className="text-xs">BaseShell</code>.
      </p>
    </BaseWidget>
  );
}

/**
 * Minimal Stage 1 surface: one defineWidget instance hosted in shell-kit chrome.
 * Not the future patch-bay page — only proves package wiring.
 */
export function MissionControlStage1Demo() {
  const probe = useMemo(
    () => createMissionControlProbeDefinition(MissionControlProbeBody),
    [],
  );
  const ProbeWidget = probe.Component;

  return (
    <ColorSchemeProvider scheme="light">
      <div
        className="relative min-h-[28rem] w-full max-w-xl"
        data-testid="mc-stage1-shell-host"
      >
        <BaseShell
          isOpen
          onClose={() => undefined}
          title="Mission Control"
          subtitle="Stage 1 — package connectivity"
          closeLabel="Close"
          showBackdrop={false}
          showCloseButton={false}
          mobileHandle={false}
          placement="center"
          glassRefractive={false}
          shellClassName="relative h-full w-full"
          surfaceClassName="relative isolate h-full overflow-hidden rounded-2xl border border-border-subtle bg-panel pointer-events-auto"
          contentContainerClassName="flex h-full flex-col gap-3 overflow-hidden px-4 py-4"
          scrollContentClassName="flex w-full flex-col gap-4 pb-4"
        >
          <ProbeWidget />
        </BaseShell>
      </div>
    </ColorSchemeProvider>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Clock3, Expand, Focus, Maximize2, Minimize2, RadioTower, RotateCcw, ShieldAlert } from "lucide-react";
import type { WidgetPortManifest } from "@synarava/wiring-engine";
import { MissionControlCanvas } from "@/components/admin/mission-control/mission-control-canvas";
import { MissionControlCopyPromptButton } from "@/components/admin/mission-control/mission-control-copy-prompt-button";
import { MissionControlStatusMark } from "@/components/admin/mission-control/mission-control-status-mark";
import { MissionControlNodeModal } from "@/components/admin/mission-control/mission-control-node-modal";
import { AdminPanel } from "@/components/admin/shared/admin-panel";
import { MISSION_CONTROL_NODE_CATALOG } from "@/lib/mission-control/node-catalog";
import type {
  ServiceFlowStatusRecord,
  ServiceNodeStatusRecord,
} from "@/lib/mission-control/status";
import { getMissionControlWiringConfig } from "@/lib/mission-control/wiring";
import type { MissionControlWiringConfig } from "@/lib/mission-control/wiring";
import type { MissionControlEnvironment } from "@/lib/mission-control/wiring";
import { formatAdminDateTime } from "@/lib/format/admin-date";

/**
 * Shown while any catalog node still uses fixture/placeholder data.
 * Live Stage 4 nodes (site-health, shopify-sync, orders) never trigger this alone.
 */
export const MISSION_CONTROL_PLACEHOLDER_NOTICE =
  "Placeholder nodes still use demo data. Live: site-health, shopify-sync, orders.";

/** @deprecated Use MISSION_CONTROL_PLACEHOLDER_NOTICE */
export const MISSION_CONTROL_FIXTURE_NOTICE = MISSION_CONTROL_PLACEHOLDER_NOTICE;

export const COLLECTOR_STALE_MS = 15 * 60 * 1000;

export type MissionControlHubProps = {
  nodeStatuses: readonly ServiceNodeStatusRecord[];
  flowStatuses: readonly ServiceFlowStatusRecord[];
  nowMs: number;
  /** When false, live-only snapshot — no demo notice. */
  showPlaceholderNotice?: boolean;
  placeholderNodeKeys?: readonly string[];
  config?: MissionControlWiringConfig;
  catalog?: readonly WidgetPortManifest[];
  liveEnvironment?: MissionControlEnvironment;
};

const LEVEL_ORDER = { down: 0, warn: 1, unknown: 2, ok: 3 } as const;

function checkedAtLabel(value: Date | null): string {
  if (!value) return "No check recorded";
  return formatAdminDateTime(value);
}

/**
 * Stage 4 hub: WiringConfig + request-time statuses → patch-bay canvas.
 * Live nodes come from providers; placeholders remain fixtures until wired.
 */
export function MissionControlHub({
  nodeStatuses,
  flowStatuses,
  nowMs,
  showPlaceholderNotice = false,
  placeholderNodeKeys = [],
  config = getMissionControlWiringConfig(),
  catalog = MISSION_CONTROL_NODE_CATALOG,
  liveEnvironment = "staging",
}: MissionControlHubProps) {
  const [environment, setEnvironment] = useState<MissionControlEnvironment>(liveEnvironment);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [resetNonce, setResetNonce] = useState(0);
  const [fitNonce, setFitNonce] = useState(0);
  const [focusNodeKey, setFocusNodeKey] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const workspaceRef = useRef<HTMLElement>(null);
  const liveKeys = new Set(config.nodes.filter((node) => node.kind === "live").map((node) => node.widgetKey));
  const liveStatuses = nodeStatuses.filter((status) => liveKeys.has(status.nodeKey));
  const counts = liveStatuses.reduce(
    (result, status) => ({ ...result, [status.level]: result[status.level] + 1 }),
    { ok: 0, warn: 0, down: 0, unknown: 0 },
  );
  const lastCheckedAt = liveStatuses.reduce<Date | null>(
    (latest, status) => (!latest || status.checkedAt > latest ? status.checkedAt : latest),
    null,
  );
  const collectorStale = !lastCheckedAt || nowMs - lastCheckedAt.getTime() > COLLECTOR_STALE_MS;
  const catalogLabels = new Map(catalog.map((node) => [node.widgetKey, node.label]));
  const attention = liveStatuses
    .filter((status) => status.level !== "ok")
    .map((status) => ({
      status,
      fix: config.nodes.find((node) => node.widgetKey === status.nodeKey),
    }))
    .filter((entry) => Boolean(entry.fix?.fixHint))
    .sort((a, b) => LEVEL_ORDER[a.status.level] - LEVEL_ORDER[b.status.level]);
  const selectedNode = config.nodes.find((node) => node.widgetKey === selectedNodeKey) ?? null;
  const allClear = attention.length === 0 && !collectorStale;
  const [overviewOpen, setOverviewOpen] = useState(!allClear);

  useEffect(() => {
    const handleFullscreen = () => setIsFullscreen(document.fullscreenElement === workspaceRef.current);
    document.addEventListener("fullscreenchange", handleFullscreen);
    return () => document.removeEventListener("fullscreenchange", handleFullscreen);
  }, []);

  function changeEnvironment(next: MissionControlEnvironment) {
    setEnvironment(next);
    setFitNonce((value) => value + 1);
  }

  function focusNode() {
    if (!focusNodeKey) return;
    setSelectedNodeKey(focusNodeKey);
  }

  async function toggleFullscreen() {
    if (!workspaceRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await workspaceRef.current.requestFullscreen();
  }

  function toggleOverview() {
    setOverviewOpen((value) => !value);
  }

  return (
    <main className="mc-hub" ref={workspaceRef}>
      <header className="mc-toolbar">
        <div className="mc-toolbar__identity">
          <RadioTower aria-hidden="true" />
          <div><h1>Mission Control</h1><p>Read-only architecture · health from {liveEnvironment}</p></div>
        </div>
        <div className="mc-toolbar__actions">
          <div className="mc-environment-switch" role="group" aria-label="Architecture environment">
            {(["production", "staging"] as const).map((option) => <button key={option} type="button" aria-pressed={environment === option} onClick={() => changeEnvironment(option)}>{option === "production" ? "Prod" : "Staging"}</button>)}
          </div>
          <label className="mc-node-search"><span className="sr-only">Focus node</span><Focus aria-hidden="true" /><select value={focusNodeKey} onChange={(event) => setFocusNodeKey(event.target.value)}><option value="">Find node…</option>{config.nodes.map((node) => <option key={node.widgetKey} value={node.widgetKey}>{node.label}</option>)}</select></label>
          <button className="mc-tool-button" type="button" onClick={focusNode} disabled={!focusNodeKey}>Focus</button>
          <button className="mc-tool-button" type="button" onClick={() => setResetNonce((value) => value + 1)}><RotateCcw aria-hidden="true" />Reset layout</button>
          <button className="mc-tool-button" type="button" onClick={() => setFitNonce((value) => value + 1)}><Expand aria-hidden="true" />Fit view</button>
          <span className="mc-toolbar__counts">{config.nodes.length} nodes · {config.architectureBindings.length} flows</span>
          <button className="mc-icon-tool" type="button" onClick={toggleFullscreen} aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>{isFullscreen ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}</button>
        </div>
      </header>

      <div className="mc-workspace" data-overview-open={overviewOpen ? "true" : "false"}>
        <aside className="mc-overview" data-open={overviewOpen ? "true" : "false"} aria-label="System overview">
          <div className="mc-overview__header">
            <strong>Overview</strong>
            <button className="mc-overview__toggle" type="button" onClick={toggleOverview} aria-expanded={overviewOpen} aria-label={overviewOpen ? "Hide overview" : "Show overview"}>
              {overviewOpen ? <ChevronLeft aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
              <span>{overviewOpen ? "Hide" : allClear ? "Healthy" : `${attention.length}`}</span>
            </button>
          </div>
          <div className="mc-overview__body" hidden={!overviewOpen}>
          <section className="mc-summary" aria-label="System status summary">
            <div className="mc-summary__states">
              {(["ok", "warn", "down", "unknown"] as const).map((level) => <div className="mc-summary__state" key={level} data-level={level}><MissionControlStatusMark level={level} compact /><strong>{counts[level]}</strong></div>)}
            </div>
            <div className="mc-collector" data-stale={collectorStale ? "true" : "false"}>{collectorStale ? <ShieldAlert aria-hidden="true" /> : <Clock3 aria-hidden="true" />}<div><span>{collectorStale ? "Collector looks stale" : "Collector checked"}</span><time dateTime={lastCheckedAt?.toISOString()}>{checkedAtLabel(lastCheckedAt)}</time></div></div>
          </section>
          {showPlaceholderNotice ? <div className="mc-fixture-notice" role="status" data-testid="mc-fixture-notice"><span aria-hidden="true">Demo</span><p>{MISSION_CONTROL_PLACEHOLDER_NOTICE}</p></div> : null}
      <AdminPanel.Root className="mc-attention" data-component="MissionControlAttention">
        <AdminPanel.Header className="mc-attention__header">
          <div>
            <h2>Needs attention</h2>
            <p>{attention.length === 0 ? "No live service needs intervention." : "Start with the highest-severity live service."}</p>
          </div>
          <span className="mc-attention__count">
            {attention.length} {attention.length === 1 ? "service" : "services"}
          </span>
        </AdminPanel.Header>
        <AdminPanel.Body className="mc-attention__body">
          {attention.length === 0 ? (
            <div className="mc-attention__empty" data-testid="mc-attention-empty">
              <MissionControlStatusMark level="ok" />
              <p>Everything currently reporting is operational.</p>
            </div>
          ) : (
            <ol className="mc-attention__list" data-testid="mc-attention-list">
              {attention.map(({ status, fix }) => (
                <li key={status.nodeKey} data-testid={`mc-attention-${status.nodeKey}`} data-level={status.level}>
                  <div className="mc-attention__identity">
                    <MissionControlStatusMark level={status.level} />
                    <div>
                      <h3>{catalogLabels.get(status.nodeKey) ?? status.nodeKey}</h3>
                      <p>{status.message || "No status message"}</p>
                    </div>
                  </div>
                  <p className="mc-attention__hint">{fix?.fixHint}</p>
                  <div className="mc-attention__actions">
                    {status.href ? <a href={status.href}>Open service</a> : null}
                    {fix?.fixPrompt ? <MissionControlCopyPromptButton prompt={fix.fixPrompt} widgetKey={status.nodeKey} /> : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </AdminPanel.Body>
      </AdminPanel.Root>
          </div>
        </aside>
        <section className="mc-map" aria-label="Service map">
          <MissionControlCanvas
            config={config}
            catalog={catalog}
            nodeStatuses={nodeStatuses}
            flowStatuses={flowStatuses}
            nowMs={nowMs}
            placeholderNodeKeys={placeholderNodeKeys}
            layout="auto"
            environment={environment}
            resetNonce={resetNonce}
            fitNonce={fitNonce}
            focusNodeKey={focusNodeKey}
            selectedNodeKey={selectedNodeKey}
            onSelectNode={setSelectedNodeKey}
          />
        </section>
      </div>
      <MissionControlNodeModal node={selectedNode} status={nodeStatuses.find((status) => status.nodeKey === selectedNodeKey)} config={config} environment={environment} liveEnvironment={liveEnvironment} onClose={() => setSelectedNodeKey(null)} onSelectNode={setSelectedNodeKey} />
    </main>
  );
}

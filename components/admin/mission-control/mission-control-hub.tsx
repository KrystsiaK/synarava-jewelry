"use client";

import { Clock3, RadioTower, ShieldAlert } from "lucide-react";
import type { WidgetPortManifest } from "@synarava/wiring-engine";
import { MissionControlCanvas } from "@/components/admin/mission-control/mission-control-canvas";
import { MissionControlCopyPromptButton } from "@/components/admin/mission-control/mission-control-copy-prompt-button";
import { MissionControlStatusMark } from "@/components/admin/mission-control/mission-control-status-mark";
import { AdminPanel } from "@/components/admin/shared/admin-panel";
import { MISSION_CONTROL_NODE_CATALOG } from "@/lib/mission-control/node-catalog";
import type {
  ServiceFlowStatusRecord,
  ServiceNodeStatusRecord,
} from "@/lib/mission-control/status";
import { getMissionControlWiringConfig } from "@/lib/mission-control/wiring";
import type { MissionControlWiringConfig } from "@/lib/mission-control/wiring";

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
};

const LEVEL_ORDER = { down: 0, warn: 1, unknown: 2, ok: 3 } as const;

function checkedAtLabel(value: Date | null): string {
  if (!value) return "No check recorded";
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(value);
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
}: MissionControlHubProps) {
  const placeholderKeys = new Set(placeholderNodeKeys);
  const liveStatuses = nodeStatuses.filter((status) => !placeholderKeys.has(status.nodeKey));
  const counts = nodeStatuses.reduce(
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

  return (
    <main className="mc-hub">
      <header className="mc-hero">
        <div>
          <p className="mc-hero__context">Synarava operations</p>
          <h1>Mission Control</h1>
          <p className="mc-hero__lede">A read-only view of service health and the flows between them.</p>
        </div>
        <div className="mc-hero__mode" aria-label="Read-only monitoring">
          <RadioTower aria-hidden="true" />
          <span>Observe only</span>
        </div>
      </header>

      <section className="mc-summary" aria-label="System status summary">
        <div className="mc-summary__states">
          {(["ok", "warn", "down", "unknown"] as const).map((level) => (
            <div className="mc-summary__state" key={level} data-level={level}>
              <MissionControlStatusMark level={level} compact />
              <strong>{counts[level]}</strong>
            </div>
          ))}
        </div>
        <div className="mc-collector" data-stale={collectorStale ? "true" : "false"}>
          {collectorStale ? <ShieldAlert aria-hidden="true" /> : <Clock3 aria-hidden="true" />}
          <div>
            <span>{collectorStale ? "Collector looks stale" : "Collector checked"}</span>
            <time dateTime={lastCheckedAt?.toISOString()}>{checkedAtLabel(lastCheckedAt)}</time>
          </div>
        </div>
      </section>

      {showPlaceholderNotice ? (
        <div
          className="mc-fixture-notice"
          role="status"
          data-testid="mc-fixture-notice"
        >
          <span aria-hidden="true">Demo</span>
          <p>{MISSION_CONTROL_PLACEHOLDER_NOTICE}</p>
        </div>
      ) : null}

      <section className="mc-map" aria-labelledby="mc-map-title">
        <div className="mc-section-heading">
          <div>
            <h2 id="mc-map-title">Service map</h2>
            <p>Fresh flows carry a moving signal. Quiet lines have no recent activity.</p>
          </div>
          <span>{nodeStatuses.length} nodes · {flowStatuses.length} flows</span>
        </div>
        <MissionControlCanvas
          config={config}
          catalog={catalog}
          nodeStatuses={nodeStatuses}
          flowStatuses={flowStatuses}
          nowMs={nowMs}
          placeholderNodeKeys={placeholderNodeKeys}
          layout="auto"
        />
      </section>

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
    </main>
  );
}

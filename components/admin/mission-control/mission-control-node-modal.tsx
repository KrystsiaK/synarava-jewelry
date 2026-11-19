"use client";

import { ChevronRight, ExternalLink, X } from "lucide-react";
import { MissionControlCopyPromptButton } from "@/components/admin/mission-control/mission-control-copy-prompt-button";
import { MissionControlCopyReportButton } from "@/components/admin/mission-control/mission-control-copy-report-button";
import { MissionControlNodeWidget } from "@/components/admin/mission-control/mission-control-node-widgets";
import { MissionControlStatusMark } from "@/components/admin/mission-control/mission-control-status-mark";
import { formatRevenue } from "@/lib/mission-control/analytics/ga-weekly-summary";
import {
  ANALYTICS_NODE_KEY,
  ANALYTICS_NOT_CONNECTED_MESSAGE,
  type AnalyticsIssue,
  type AnalyticsSnapshotPayload,
} from "@/lib/mission-control/analytics/types";
import {
  readAnalyticsPayloadFromCounters,
  readAnalyticsReportMarkdown,
} from "@/lib/mission-control/analytics/payload";
import type { ServiceNodeStatusRecord } from "@/lib/mission-control/status";
import type {
  MissionControlEnvironment,
  MissionControlNodeConfig,
  MissionControlWiringConfig,
} from "@/lib/mission-control/wiring";

type Props = {
  node: MissionControlNodeConfig | null;
  status?: ServiceNodeStatusRecord;
  config: MissionControlWiringConfig;
  environment: MissionControlEnvironment;
  liveEnvironment: MissionControlEnvironment;
  onClose: () => void;
  onSelectNode: (widgetKey: string) => void;
};

function counterEntries(
  value: ServiceNodeStatusRecord["counters"] | undefined,
): [string, string][] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value)
    .filter(([key]) => key !== "analytics" && key !== "reportMarkdown")
    .map(([key, item]) => [
      key,
      typeof item === "string" ? item : JSON.stringify(item),
    ]);
}

function statusLabel(
  node: MissionControlNodeConfig,
  status: ServiceNodeStatusRecord | undefined,
): string {
  if (
    node.widgetKey === ANALYTICS_NODE_KEY &&
    status?.message === ANALYTICS_NOT_CONNECTED_MESSAGE
  ) {
    return "Not connected";
  }
  if (node.kind === "live") return "";
  return node.kind === "info" ? "Reference" : "Not wired";
}

function GaOpenLink({ href }: { href: string }) {
  return (
    <a
      className="mc-analytics-ga-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      Open in Google Analytics
      <ExternalLink aria-hidden="true" />
    </a>
  );
}

function IssueCard({
  issue,
  gaOpenUrl,
}: {
  issue: AnalyticsIssue;
  gaOpenUrl: string | null;
}) {
  const numbers = Object.entries(issue.numbers)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
  return (
    <article className="mc-analytics-issue" data-severity={issue.severity}>
      <header>
        <span className="mc-analytics-issue__severity">{issue.severity}</span>
        <h4>{issue.title}</h4>
      </header>
      <dl>
        <div>
          <dt>Since</dt>
          <dd>{issue.since}</dd>
        </div>
        {numbers ? (
          <div>
            <dt>Numbers</dt>
            <dd>{numbers}</dd>
          </div>
        ) : null}
        <div>
          <dt>Where to look</dt>
          <dd>{issue.whereToLook}</dd>
        </div>
        <div>
          <dt>How to fix</dt>
          <dd>{issue.fixHint}</dd>
        </div>
        <div>
          <dt>Period / source</dt>
          <dd>
            {issue.period} · {issue.source}
          </dd>
        </div>
      </dl>
      {gaOpenUrl && issue.source === "ga" ? <GaOpenLink href={gaOpenUrl} /> : null}
    </article>
  );
}

function formatDelta(current: number, previous: number): string {
  if (previous <= 0) return current > 0 ? "▲ new" : "—";
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return `▲ ${pct}%`;
  if (pct < 0) return `▼ ${Math.abs(pct)}%`;
  return "0%";
}

function WeeklySummaryPanel({
  payload,
  gaOpenUrl,
}: {
  payload: AnalyticsSnapshotPayload;
  gaOpenUrl: string | null;
}) {
  const summary = payload.weeklySummary;
  if (!summary) return null;
  const period =
    payload.figures.find((figure) => figure.label.startsWith("GA users"))
      ?.period ?? "last 7 days vs prior 7 (GA, consented)";
  const rows: Array<{ label: string; current: string; delta: string }> = [
    {
      label: "Users",
      current: String(summary.current.users),
      delta: formatDelta(summary.current.users, summary.previous.users),
    },
    {
      label: "Sessions",
      current: String(summary.current.sessions),
      delta: formatDelta(summary.current.sessions, summary.previous.sessions),
    },
    {
      label: "Orders",
      current: String(summary.current.purchases),
      delta: formatDelta(summary.current.purchases, summary.previous.purchases),
    },
    {
      label: "Revenue",
      current: formatRevenue(summary.current.revenue),
      delta: formatDelta(summary.current.revenue, summary.previous.revenue),
    },
    {
      label: "Conversion",
      current: `${(summary.current.conversionRate * 100).toFixed(2)}%`,
      delta: formatDelta(
        summary.current.conversionRate,
        summary.previous.conversionRate,
      ),
    },
  ];

  return (
    <section className="mc-analytics-summary" aria-label="GA weekly summary">
      <header className="mc-analytics-summary__header">
        <div>
          <h3>GA weekly summary</h3>
          <p>{period}</p>
        </div>
        {gaOpenUrl ? <GaOpenLink href={gaOpenUrl} /> : null}
      </header>
      <ul className="mc-analytics-summary__metrics">
        {rows.map((row) => (
          <li key={row.label}>
            <span>{row.label}</span>
            <strong>{row.current}</strong>
            <em>{row.delta}</em>
          </li>
        ))}
      </ul>
      <div className="mc-analytics-summary__lists">
        <div>
          <h4>Top sources</h4>
          {summary.sources.length === 0 ? (
            <p>No sources in this window.</p>
          ) : (
            <ol>
              {summary.sources.map((source) => (
                <li key={source.name}>
                  {source.name} · {source.sessions} · {source.sharePct}%
                </li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <h4>Top pages</h4>
          {summary.pages.length === 0 ? (
            <p>No pages in this window.</p>
          ) : (
            <ol>
              {summary.pages.map((page) => (
                <li key={page.name}>
                  {page.name} · {page.sessions} · {page.sharePct}%
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}

function AnalyticsDetails({
  payload,
  report,
  widgetKey,
  gaOpenUrl,
}: {
  payload: AnalyticsSnapshotPayload;
  report: string | null;
  widgetKey: string;
  gaOpenUrl: string | null;
}) {
  return (
    <section className="mc-analytics-panel" aria-label="Analytics issues">
      <WeeklySummaryPanel payload={payload} gaOpenUrl={gaOpenUrl} />
      <div className="mc-analytics-panel__notes">
        <p>{payload.gaConsentNote}</p>
        <p>{payload.clarityBotNote}</p>
        <p>
          Clarity API {payload.limits.clarityCallsUsedToday}/
          {payload.limits.clarityBudgetPerDay} today (hard{" "}
          {payload.limits.clarityHardLimitPerDay}/day).
        </p>
        {payload.clarityDataAsOf ? (
          <p>Clarity data as of {payload.clarityDataAsOf}</p>
        ) : null}
        {payload.notices?.map((notice) => (
          <p key={notice.id} data-tone={notice.tone}>
            {notice.title}
            {notice.detail ? ` — ${notice.detail}` : ""}
          </p>
        ))}
      </div>
      {report ? (
        <div className="mc-node-detail__fix">
          <h3>Copy report</h3>
          <p>
            One markdown block for Claude/bot paste. Read-only — copy changes
            nothing.
          </p>
          <MissionControlCopyReportButton report={report} widgetKey={widgetKey} />
        </div>
      ) : null}
      <div className="mc-analytics-issues">
        <h3>All issues ({payload.issues.length})</h3>
        {payload.issues.length === 0 ? (
          <p>
            {payload.connection === "not_connected"
              ? "Not connected — set CLARITY_API_TOKEN, GA_PROPERTY_ID, and GA_SERVICE_ACCOUNT_JSON on the collector."
              : "No issues above threshold."}
          </p>
        ) : (
          payload.issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} gaOpenUrl={gaOpenUrl} />
          ))
        )}
      </div>
    </section>
  );
}

export function MissionControlNodeModal({
  node,
  status,
  config,
  environment,
  liveEnvironment,
  onClose,
  onSelectNode,
}: Props) {
  if (!node) return null;
  const upstream = config.architectureBindings
    .filter((binding) =>
      binding.sinks.some((sink) => sink.widgetKey === node.widgetKey),
    )
    .flatMap((binding) => (binding.source ? [binding.source.widgetKey] : []));
  const downstream = config.architectureBindings
    .filter((binding) => binding.source?.widgetKey === node.widgetKey)
    .flatMap((binding) => binding.sinks.map((sink) => sink.widgetKey));
  const related = (keys: string[]) =>
    [...new Set(keys)].flatMap((key) => {
      const found = config.nodes.find((candidate) => candidate.widgetKey === key);
      return found ? [found] : [];
    });
  const counters = counterEntries(status?.counters);
  const env = node.env[environment];
  const showFix =
    node.kind === "live" &&
    status?.level !== "ok" &&
    Boolean(node.fixHint) &&
    node.widgetKey !== ANALYTICS_NODE_KEY;
  const analyticsPayload =
    node.widgetKey === ANALYTICS_NODE_KEY
      ? readAnalyticsPayloadFromCounters(status?.counters)
      : null;
  const analyticsReport =
    node.widgetKey === ANALYTICS_NODE_KEY
      ? readAnalyticsReportMarkdown(status?.counters)
      : null;
  const nonLiveLabel = statusLabel(node, status);
  const openHref =
    analyticsPayload?.gaOpenUrl?.trim() ||
    status?.href?.trim() ||
    env.href;
  const openLabel =
    env.label.startsWith("Открыть") || env.label.startsWith("Open")
      ? env.label
      : `Open ${env.label}`;
  const gaOpenUrl =
    openHref && openHref.includes("analytics.google.com") ? openHref : null;

  return (
    <aside
      className="mc-node-detail"
      role="dialog"
      aria-modal="false"
      aria-labelledby="mc-node-detail-title"
    >
      <header className="mc-node-detail__header">
        <div>
          <p className="mc-node-detail__eyebrow">
            {node.kind === "live"
              ? "Live service"
              : node.kind === "info"
                ? "Architecture reference"
                : "Planned · not wired"}
          </p>
          <h2 id="mc-node-detail-title">{node.label}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close service details">
          <X aria-hidden="true" />
        </button>
      </header>
      <div className="mc-node-detail__body">
        <section className="mc-node-detail__primary">
          <div className="mc-node-detail__status">
            {node.kind === "live" ? (
              <MissionControlStatusMark
                level={status?.level ?? "unknown"}
                notConnected={
                  status?.message === ANALYTICS_NOT_CONNECTED_MESSAGE
                }
              />
            ) : (
              <span>{nonLiveLabel}</span>
            )}
            <p>
              {status?.message ||
                (node.kind === "placeholder"
                  ? "No live provider is connected."
                  : "Architecture metadata only.")}
            </p>
          </div>
          <p className="mc-node-detail__live-note">
            Viewing <strong>{environment}</strong> metadata. Health is from the
            current <strong>{liveEnvironment}</strong> deployment.
          </p>
          {counters.length ? (
            <dl className="mc-node-detail__counters">
              {counters.map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {analyticsPayload ? (
            <AnalyticsDetails
              payload={analyticsPayload}
              report={analyticsReport}
              widgetKey={node.widgetKey}
              gaOpenUrl={gaOpenUrl}
            />
          ) : null}
          {showFix ? (
            <div className="mc-node-detail__fix">
              <h3>Suggested next step</h3>
              <p>{node.fixHint}</p>
              {node.fixPrompt ? (
                <MissionControlCopyPromptButton
                  prompt={node.fixPrompt}
                  widgetKey={node.widgetKey}
                />
              ) : null}
            </div>
          ) : null}
          <MissionControlNodeWidget node={node} />
        </section>
        <aside className="mc-node-detail__aside">
          {openHref ? (
            <a
              className="mc-node-detail__open"
              href={openHref}
              target={openHref.startsWith("http") ? "_blank" : undefined}
              rel={
                openHref.startsWith("http")
                  ? "noopener noreferrer"
                  : undefined
              }
            >
              {openLabel}
              <ExternalLink aria-hidden="true" />
            </a>
          ) : (
            <p className="mc-node-detail__todo">External link · Owner TODO</p>
          )}
          <nav aria-label="Connected services">
            <h3>Upstream</h3>
            {related(upstream).length ? (
              related(upstream).map((item) => (
                <button
                  key={item.widgetKey}
                  type="button"
                  onClick={() => onSelectNode(item.widgetKey)}
                >
                  {item.label}
                  <ChevronRight aria-hidden="true" />
                </button>
              ))
            ) : (
              <p>None mapped</p>
            )}
            <h3>Downstream</h3>
            {related(downstream).length ? (
              related(downstream).map((item) => (
                <button
                  key={item.widgetKey}
                  type="button"
                  onClick={() => onSelectNode(item.widgetKey)}
                >
                  {item.label}
                  <ChevronRight aria-hidden="true" />
                </button>
              ))
            ) : (
              <p>None mapped</p>
            )}
          </nav>
          <section>
            <h3>Documentation</h3>
            {node.docs.length ? (
              node.docs.map((doc) => (
                <a
                  key={doc.href}
                  href={doc.href}
                  target={doc.href.startsWith("http") ? "_blank" : undefined}
                  rel={doc.href.startsWith("http") ? "noreferrer" : undefined}
                >
                  {doc.label}
                  <ExternalLink aria-hidden="true" />
                </a>
              ))
            ) : (
              <p className="mc-node-detail__todo">Owner TODO</p>
            )}
          </section>
        </aside>
      </div>
    </aside>
  );
}

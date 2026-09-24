import {
  AdminPanelBody,
  AdminPanelHeader,
  AdminPanelRoot,
  AdminStatusBadge,
} from "@/components/synarava-cms";

import {
  ConnectionsGauge,
  TableSizeBarChart,
} from "@/components/admin/infrastructure/infrastructure-charts";
import { formatBytes } from "@/lib/admin/format-bytes";
import type { InfrastructureStatus } from "@/lib/admin/infrastructure-status";

function formatLatency(ms: number | null): string {
  if (ms == null) return "—";
  return `${ms} ms`;
}

function shortPostgresVersion(version: string | null): string {
  if (!version) return "—";
  const match = version.match(/PostgreSQL\s+([\d.]+)/i);
  return match?.[1] ? `PostgreSQL ${match[1]}` : version.slice(0, 48);
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "published" | "error" | "pending" | "draft";
}) {
  return (
    <AdminPanelRoot>
      <AdminPanelBody className="space-y-2 p-4">
        <p className="adm-section-tag">{label}</p>
        <div className="flex items-center gap-2">
          {tone ? <AdminStatusBadge tone={tone}>{value}</AdminStatusBadge> : null}
          {!tone ? (
            <p className="adm-title-sm truncate" title={value}>
              {value}
            </p>
          ) : null}
        </div>
      </AdminPanelBody>
    </AdminPanelRoot>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-baseline justify-between gap-4 py-2 text-sm"
      style={{ borderBottom: "1px solid var(--adm-border)" }}
    >
      <span style={{ color: "var(--adm-muted)" }}>{label}</span>
      <span className="text-right font-medium" style={{ color: "var(--adm-text)" }}>
        {value}
      </span>
    </div>
  );
}

export function InfrastructureDashboard({ status }: { status: InfrastructureStatus }) {
  const { postgres, s3 } = status;

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Postgres"
          value={postgres.ok ? "OK" : "Down"}
          tone={postgres.ok ? "published" : "error"}
        />
        <KpiCard
          label="S3 bucket"
          value={s3.ok ? "OK" : "Down"}
          tone={s3.ok ? "published" : "error"}
        />
        <KpiCard label="Postgres version" value={shortPostgresVersion(postgres.version)} />
        <KpiCard
          label="DB latency"
          value={formatLatency(postgres.latencyMs)}
          tone={postgres.ok ? "published" : "pending"}
        />
      </div>

      <p className="text-xs" style={{ color: "var(--adm-muted)" }}>
        Snapshot {new Date(status.checkedAt).toLocaleString()} · cache {status.cacheTtlSeconds}s ·
        read-only probes
      </p>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminPanelRoot>
          <AdminPanelHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="adm-section-tag">Postgres</p>
                <h2 className="adm-title-sm mt-1">Railway database</h2>
              </div>
              <AdminStatusBadge tone={postgres.ok ? "published" : "error"}>
                {postgres.ok ? "Reachable" : "Unreachable"}
              </AdminStatusBadge>
            </div>
          </AdminPanelHeader>
          <AdminPanelBody className="space-y-5 p-5 md:p-6">
            {postgres.error ? (
              <p className="text-sm" style={{ color: "var(--adm-danger, #a6192e)" }}>
                {postgres.error}
              </p>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div>
                <MetricRow label="SELECT 1 latency" value={formatLatency(postgres.latencyMs)} />
                <MetricRow label="Version" value={shortPostgresVersion(postgres.version)} />
                <MetricRow label="Database size" value={formatBytes(postgres.databaseSizeBytes)} />
                <MetricRow
                  label="Last successful read"
                  value={
                    postgres.lastSuccessfulReadAt
                      ? new Date(postgres.lastSuccessfulReadAt).toLocaleString()
                      : "—"
                  }
                />
                <MetricRow
                  label="Connections"
                  value={
                    postgres.connections.unavailableReason
                      ? "Unavailable"
                      : `${postgres.connections.active ?? "—"} active / ${postgres.connections.idle ?? "—"} idle / ${postgres.connections.max ?? "—"} max`
                  }
                />
                {postgres.connections.unavailableReason ? (
                  <p className="mt-2 text-xs" style={{ color: "var(--adm-muted)" }}>
                    {postgres.connections.unavailableReason}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="adm-section-tag mb-3">Connections vs max</p>
                <ConnectionsGauge
                  active={postgres.connections.active}
                  idle={postgres.connections.idle}
                  max={postgres.connections.max}
                />
              </div>
            </div>

            <div>
              <p className="adm-section-tag mb-3">Top tables by size</p>
              {postgres.tablesUnavailableReason ? (
                <p className="text-sm" style={{ color: "var(--adm-muted)" }}>
                  {postgres.tablesUnavailableReason}
                </p>
              ) : (
                <TableSizeBarChart tables={postgres.tables} />
              )}
            </div>
          </AdminPanelBody>
        </AdminPanelRoot>

        <AdminPanelRoot>
          <AdminPanelHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="adm-section-tag">Object storage</p>
                <h2 className="adm-title-sm mt-1">S3 bucket</h2>
              </div>
              <AdminStatusBadge tone={s3.ok ? "published" : "error"}>
                {s3.ok ? "HeadBucket OK" : "HeadBucket fail"}
              </AdminStatusBadge>
            </div>
          </AdminPanelHeader>
          <AdminPanelBody className="space-y-4 p-5 md:p-6">
            {s3.error ? (
              <p className="text-sm" style={{ color: "var(--adm-danger, #a6192e)" }}>
                {s3.error}
              </p>
            ) : null}

            <MetricRow label="HeadBucket latency" value={formatLatency(s3.latencyMs)} />
            <MetricRow label="Bucket" value={s3.bucket ?? "—"} />
            <MetricRow label="Region" value={s3.region ?? "—"} />
            <MetricRow label="Endpoint host" value={s3.endpointHost ?? "—"} />
            <MetricRow
              label="forcePathStyle"
              value={s3.forcePathStyle == null ? "—" : String(s3.forcePathStyle)}
            />
            <MetricRow
              label="Total size"
              value={
                s3.sizeSource === "railway" ? formatBytes(s3.sizeBytes) : "Unavailable"
              }
            />
            <MetricRow
              label="Object count"
              value={
                s3.sizeSource === "railway" && s3.objectCount != null
                  ? s3.objectCount.toLocaleString()
                  : "Unavailable"
              }
            />
            {s3.sizeUnavailableReason ? (
              <p className="text-xs" style={{ color: "var(--adm-muted)" }}>
                {s3.sizeUnavailableReason}
              </p>
            ) : (
              <p className="text-xs" style={{ color: "var(--adm-muted)" }}>
                Size and object count from Railway GraphQL `bucketInstanceDetails` (not a full
                ListObjectsV2 scan).
              </p>
            )}
          </AdminPanelBody>
        </AdminPanelRoot>
      </div>
    </div>
  );
}

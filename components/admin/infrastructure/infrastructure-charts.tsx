"use client";

import {
  Bar,
  BarChart,
  BarYAxis,
  ChartTooltip,
  Gauge,
  Grid,
  chartCssVars,
} from "@/components/charts/client";

import type { PostgresTableSize } from "@/lib/admin/infrastructure-status";
import { formatBytes } from "@/lib/admin/format-bytes";

type ConnectionsGaugeProps = {
  active: number | null;
  idle: number | null;
  max: number | null;
};

export function ConnectionsGauge({ active, idle, max }: ConnectionsGaugeProps) {
  if (max == null || max <= 0) {
    return (
      <p className="text-sm" style={{ color: "var(--adm-muted)" }}>
        Connection limits unavailable for this role.
      </p>
    );
  }

  const used = (active ?? 0) + (idle ?? 0);
  const pct = Math.max(0, Math.min(100, Math.round((used / max) * 100)));

  return (
    <div className="mx-auto max-w-sm">
      <Gauge
        value={pct}
        centerValue={used}
        defaultLabel={`of ${max} max`}
        activeFill={chartCssVars.linePrimary}
        inactiveFillOpacity={0.35}
        minWidth={220}
        spacing={18}
      />
      <p className="mt-2 text-center text-xs" style={{ color: "var(--adm-muted)" }}>
        Active {active ?? "—"} · Idle {idle ?? "—"}
      </p>
    </div>
  );
}

type TableSizeBarChartProps = {
  tables: PostgresTableSize[];
};

export function TableSizeBarChart({ tables }: TableSizeBarChartProps) {
  if (tables.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--adm-muted)" }}>
        No table size data.
      </p>
    );
  }

  const data = tables.map((table) => ({
    name: table.name,
    sizeMb: Math.round((table.sizeBytes / (1024 * 1024)) * 100) / 100,
    sizeLabel: formatBytes(table.sizeBytes),
  }));

  return (
    <BarChart data={data} xDataKey="name" orientation="horizontal" aspectRatio="16 / 10" margin={{ top: 16, right: 24, bottom: 16, left: 16 }}>
      <Grid vertical fadeVertical />
      <Bar dataKey="sizeMb" fill={chartCssVars.linePrimary} lineCap={4} />
      <BarYAxis showAllLabels maxLabels={10} />
      <ChartTooltip />
    </BarChart>
  );
}

"use client";

import { LinearGradient } from "@visx/gradient";

import {
  Bar,
  BarChart,
  BarYAxis,
  ChartTooltip,
  Gauge,
  Grid,
} from "@/components/charts/client";

import type { PostgresTableSize } from "@/lib/admin/infrastructure-status";
import { formatBytes } from "@/lib/admin/format-bytes";

/** Admin chrome hues — gold → teal → violet (matches --adm-* tokens). */
const GAUGE_GRADIENT = ["#d8b66a", "#6fa89a"] as const;
const BAR_GRADIENT_FROM = "#6fa89a";
const BAR_GRADIENT_TO = "#9a87b8";
const BAR_TOOLTIP_COLOR = "#6fa89a";

const TABLE_SIZE_GRADIENT_ID = "infra-table-size-grad";

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
    <div className="mx-auto w-full max-w-md">
      <Gauge
        value={pct}
        centerValue={used}
        defaultLabel={`of ${max} max`}
        useGradient
        activeGradient={GAUGE_GRADIENT}
        inactiveFill="var(--adm-border)"
        inactiveFillOpacity={0.55}
        minWidth={240}
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
    <BarChart
      data={data}
      xDataKey="name"
      orientation="horizontal"
      aspectRatio="16 / 9"
      margin={{ top: 12, right: 20, bottom: 12, left: 132 }}
    >
      <LinearGradient
        id={TABLE_SIZE_GRADIENT_ID}
        from={BAR_GRADIENT_FROM}
        to={BAR_GRADIENT_TO}
        vertical={false}
      />
      <Grid vertical fadeVertical />
      <Bar
        dataKey="sizeMb"
        fill={`url(#${TABLE_SIZE_GRADIENT_ID})`}
        stroke={BAR_TOOLTIP_COLOR}
        lineCap={4}
      />
      <BarYAxis showAllLabels maxLabels={10} />
      <ChartTooltip />
    </BarChart>
  );
}

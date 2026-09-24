"use client";

/**
 * Client entry for Bklit charts installed via `@bklit` shadcn registry.
 * Prefer this over deep imports so call sites stay stable.
 *
 * @see https://ui.bklit.com/docs/installation
 */
export { Gauge } from "@/components/charts/gauge";
export { BarChart } from "@/components/charts/bar-chart";
export { Bar } from "@/components/charts/bar";
export { BarXAxis } from "@/components/charts/bar-x-axis";
export { BarYAxis } from "@/components/charts/bar-y-axis";
export { Grid } from "@/components/charts/grid";
export { ChartTooltip } from "@/components/charts/tooltip";
export { chartCssVars } from "@/components/charts/chart-context";

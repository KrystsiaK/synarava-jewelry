"use client";

import { useReportWebVitals } from "next/web-vitals";

import { publishClientTelemetry } from "@/lib/telemetry/client";

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    publishClientTelemetry("web_vital", {
      id: metric.id,
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      navigationType: metric.navigationType,
    });
  });

  return null;
}

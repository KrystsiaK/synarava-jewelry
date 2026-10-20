import type { WidgetPortManifest } from "@synarava/wiring-engine";
import { getMissionControlWiringConfig } from "@/lib/mission-control/wiring";

const LIVE_STATUS_LABELS: Record<string, string> = {
  "site-health": "Site health",
  "shopify-sync": "Shopify sync",
  orders: "Orders",
};

export const MISSION_CONTROL_NODE_CATALOG: readonly WidgetPortManifest[] = getMissionControlWiringConfig().nodes.map((node) => ({
  widgetKey: node.widgetKey,
  label: LIVE_STATUS_LABELS[node.widgetKey] ?? node.label,
  color: node.kind === "live" ? "#7b5b1c" : "#6b7280",
  ports: [
    { portKey: "status_in", direction: "input", valueType: "json", label: "Input" },
    { portKey: "status_out", direction: "output", valueType: "json", label: "Output" },
    { portKey: "events_in", direction: "input", valueType: "json", label: "Events" },
  ],
}));

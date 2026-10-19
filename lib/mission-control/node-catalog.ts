import type { WidgetPortManifest } from "@synarava/wiring-engine";

/**
 * Stage 3 display manifests for patch-bay nodes.
 * Stage 4 will replace stubs with real `defineWidget` registrations;
 * until then the canvas reads labels/colors from this catalog + WiringConfig.
 */
export const MISSION_CONTROL_NODE_CATALOG: readonly WidgetPortManifest[] = [
  {
    widgetKey: "site-health",
    label: "Site health",
    color: "#2f6f5e",
    ports: [
      {
        portKey: "status_out",
        direction: "output",
        valueType: "json",
        label: "Status",
      },
    ],
  },
  {
    widgetKey: "db",
    label: "Database",
    color: "#4a6fa5",
    ports: [
      {
        portKey: "status_in",
        direction: "input",
        valueType: "json",
        label: "Status",
      },
    ],
  },
  {
    widgetKey: "shopify-sync",
    label: "Shopify sync",
    color: "#96bf48",
    ports: [
      {
        portKey: "status_out",
        direction: "output",
        valueType: "json",
        label: "Status",
      },
    ],
  },
  {
    widgetKey: "products",
    label: "Products",
    color: "#6b5b4a",
    ports: [
      {
        portKey: "status_in",
        direction: "input",
        valueType: "json",
        label: "Status",
      },
    ],
  },
  {
    widgetKey: "orders",
    label: "Orders",
    color: "#8b5e3c",
    ports: [
      {
        portKey: "status_out",
        direction: "output",
        valueType: "json",
        label: "Status",
      },
    ],
  },
  {
    widgetKey: "sentry",
    label: "Sentry",
    color: "#362d59",
    ports: [
      {
        portKey: "events_in",
        direction: "input",
        valueType: "json",
        label: "Events",
      },
    ],
  },
] as const;

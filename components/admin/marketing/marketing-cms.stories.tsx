import type { CSSProperties, ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { AdminToastProvider } from "@/components/admin/shared/admin-toast";

import {
  MarketingCms,
  type MarketingIdeaRow,
  type MarketingObservationRow,
} from "./marketing-cms";

const lightVars = {
  "--adm-panel": "#ffffff",
  "--adm-panel-elevated": "#ece9e3",
  "--adm-ink": "#211d19",
  "--adm-muted": "#675e55",
  "--adm-subtle": "#746a61",
  "--adm-border": "#ddd4c8",
  "--adm-accent": "#8a661f",
  "--adm-accent-soft": "rgba(138, 102, 31, 0.1)",
  "--adm-danger-ink": "#9b2c2c",
  background: "#f7f4ef",
  color: "#211d19",
} as CSSProperties;

function ThemeFrame({ children }: { children: ReactNode }) {
  return (
    <AdminToastProvider>
      <div className="admin-modal-root min-h-screen p-6" style={lightVars}>
        {children}
      </div>
    </AdminToastProvider>
  );
}

const products = [
  { id: "p1", name: "Beaded Bracelet" },
  { id: "p2", name: "Pearl Studs" },
];

const observations: MarketingObservationRow[] = [
  {
    id: "o1",
    brand: "Aurora Joalharia",
    domain: "aurorajoalharia.com",
    url: "https://aurorajoalharia.com/products/pulseira",
    fetchedAt: "2026-11-23T12:00:00.000Z",
    kind: "changed",
    price: "22.90",
    currency: "EUR",
    source: "website",
  },
];

const draftIdea: MarketingIdeaRow = {
  id: "idea-draft",
  status: "draft",
  productIds: ["p1"],
  signalIds: [],
  whyRu: "Бусины из фактов продукта — мягкий утренний свет.",
  hook: { en: "Soft stack", pt: "Stack suave" },
  script: "Локация: кафе у окна\nКрупный план запястья",
  shotList: ["запястье", "деталь бусин"],
  caption: { en: "Synarava beads", pt: "Contas Synarava" },
  plannedFor: "2026-12-01T12:00:00.000Z",
  calendarEventId: null,
  calendarSyncedAt: null,
  calendarSyncError: null,
};

const approvedIdea: MarketingIdeaRow = {
  ...draftIdea,
  id: "idea-approved",
  status: "approved",
  calendarEventId: "evt-1",
  calendarSyncedAt: "2026-11-23T12:30:00.000Z",
};

const lastScan = {
  createdAt: "2026-11-23T11:00:00.000Z",
  writtenTotal: 12,
  unparsedTotal: 1,
  durationMs: 4200,
  truncated: false,
  domains: [
    {
      domain: "aurorajoalharia.com",
      fetched: 40,
      written: 8,
      unparsed: 0,
      skippedRobots: 0,
      sitemapComplete: true,
      firstError: null,
    },
    {
      domain: "parfois.com",
      fetched: 10,
      written: 4,
      unparsed: 1,
      skippedRobots: 2,
      sitemapComplete: false,
      firstError: "sitemap incomplete",
    },
  ],
};

const meta = {
  title: "Admin/MarketingCms",
  component: MarketingCms,
  decorators: [
    (Story) => (
      <ThemeFrame>
        <Story />
      </ThemeFrame>
    ),
  ],
} satisfies Meta<typeof MarketingCms>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Observations: Story = {
  args: {
    initialObservations: observations,
    initialIdeas: [draftIdea],
    products,
    lastScan,
    monthlyAiSpendUsd: 1.25,
    initialKind: "all",
    calendarSyncEnabled: true,
    sheetsExportEnabled: true,
  },
};

export const Ideas: Story = {
  args: {
    ...Observations.args,
    initialIdeas: [draftIdea, approvedIdea],
    initialTab: "ideas",
  },
};

export const Calendar: Story = {
  args: {
    ...Observations.args,
    initialIdeas: [approvedIdea],
    initialTab: "calendar",
  },
};

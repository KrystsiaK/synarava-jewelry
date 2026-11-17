import type { CSSProperties, ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { AdminToastProvider } from "@/components/admin/shared/admin-toast";

import { ReviewsCms } from "./reviews-cms";
import { ReviewsSettingsEditor } from "./reviews-settings-editor";

const lightVars = {
  "--adm-panel": "#ffffff",
  "--adm-panel-elevated": "#ece9e3",
  "--adm-ink": "#211d19",
  "--adm-muted": "#675e55",
  "--adm-subtle": "#746a61",
  "--adm-accent-soft": "rgba(138, 102, 31, 0.1)",
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

const samplePage = {
  items: [
    {
      id: "r1",
      productId: "p1",
      productSlug: "lava-ring",
      productName: "Lava Ring",
      locale: "en",
      rating: 5,
      title: "Quietly beautiful",
      body: "The finish is even better in person.",
      authorName: "Marta A.",
      authorEmail: "marta@example.com",
      status: "PENDING" as const,
      verifiedPurchase: false,
      createdAt: "2026-11-15T12:00:00.000Z",
      moderatedAt: null,
      moderatedBy: null,
    },
    {
      id: "r2",
      productId: "p1",
      productSlug: "lava-ring",
      productName: "Lava Ring",
      locale: "pt",
      rating: 4,
      title: "Uma peça considerada",
      body: "Embalagem cuidada e confortável no dia a dia.",
      authorName: "Inês S.",
      authorEmail: "ines@example.com",
      status: "PUBLISHED" as const,
      verifiedPurchase: false,
      createdAt: "2026-11-10T09:30:00.000Z",
      moderatedAt: "2026-11-11T10:00:00.000Z",
      moderatedBy: "admin@synarava.com",
    },
  ],
  total: 2,
  page: 1,
  pageSize: 25,
};

const initialListState = {
  q: "",
  status: "ALL" as const,
  product: "ALL",
  rating: "ALL" as const,
  locale: "ALL" as const,
  from: "",
  to: "",
  sort: "newest" as const,
  page: "1",
};

const meta = {
  title: "Admin/Reviews",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

export const ModerationTable: StoryObj = {
  render: () => (
    <ThemeFrame>
      <ReviewsCms
        initialPage={samplePage}
        initialListState={initialListState}
        products={[{ id: "p1", slug: "lava-ring", name: "Lava Ring" }]}
      />
    </ThemeFrame>
  ),
};

export const Settings: StoryObj = {
  render: () => (
    <ThemeFrame>
      <ReviewsSettingsEditor
        settings={{
          moderationBeforePublish: true,
        }}
      />
    </ThemeFrame>
  ),
};

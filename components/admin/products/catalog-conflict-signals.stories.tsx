import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";

import { CatalogConflictStatus } from "@/components/admin/products/catalog-conflict-signals";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

const panelVars = {
  "--adm-panel": "#ffffff",
  "--adm-ink": "#211d19",
  "--adm-border": "#e4ddd2",
  "--adm-muted": "#7a7168",
  "--adm-conflict": "#a16207",
  background: "#f7f3ec",
  color: "#211d19",
} as CSSProperties;

const signals: CatalogConflictSignals = {
  state: "stale",
  totalCount: 5,
  checkedAt: "2026-10-24T12:00:00.000Z",
  recentlyUpdatedProducts: {},
  products: {
    a: { shared: true, locales: [{ code: "en", name: "English", nativeName: "English", count: 1 }] },
  },
};

const meta = {
  title: "synarava-cms/CatalogConflictStatus",
  component: CatalogConflictStatus,
  decorators: [
    (Story) => (
      <div className="admin-terminal p-6" style={panelVars}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const ProductsAndCollections: Story = {
  name: "Products vs collections wording",
  render: () => (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--adm-muted)]">Products page</p>
        <CatalogConflictStatus
          signals={signals}
          onShow={() => undefined}
          onCheck={() => undefined}
          entityNoun={{ singular: "product", plural: "products" }}
        />
      </div>
      <div className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--adm-muted)]">Collections page</p>
        <CatalogConflictStatus
          signals={signals}
          onShow={() => undefined}
          onCheck={() => undefined}
          entityNoun={{ singular: "collection", plural: "collections" }}
        />
      </div>
    </div>
  ),
};

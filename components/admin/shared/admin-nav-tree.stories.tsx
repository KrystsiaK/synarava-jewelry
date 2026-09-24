import type { Meta, StoryObj } from "@storybook/react";

import { buildAdminNavItems } from "@/components/admin/shared/admin-nav-config";
import { AdminNavTree } from "@/components/admin/shared/admin-nav-tree";

const meta = {
  title: "synarava-cms/AdminNavTree",
  component: AdminNavTree,
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/admin/pages/care",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="admin-terminal admin-modal-root min-h-screen bg-[var(--adm-bg)] p-6 text-[var(--adm-ink)]">
        <aside className="admin-sidebar-shell border-r p-5" style={{ display: "flex", height: "28rem" }}>
          <div className="admin-sidebar-scroll">
            <Story />
          </div>
        </aside>
      </div>
    ),
  ],
} satisfies Meta<typeof AdminNavTree>;

export default meta;
type Story = StoryObj<typeof meta>;

const demoPages = [
  { slug: "home", title: "Home" },
  { slug: "about", title: "About Synarava" },
  { slug: "shop", title: "Shop" },
  { slug: "care", title: "Care guide with a very long editorial title" },
  { slug: "shipping", title: "Shipping" },
  { slug: "returns", title: "Returns" },
  { slug: "faq", title: "FAQ" },
  { slug: "offer", title: "Offer" },
  { slug: "terms-and-conditions", title: "Terms and Conditions" },
  { slug: "privacy", title: "Privacy Policy" },
];

/** Red problems + amber conflicts on Catalog; split marker on Pages (both). */
export const TreeWithSignals: Story = {
  args: {
    items: buildAdminNavItems({
      pages: demoPages,
      issueCount: 23,
      syncCounts: {
        products: 12,
        collections: 2,
        pages: 3,
        settings: 1,
        total: 18,
      },
    }),
    issueNavHrefs: ["/admin/pages/care", "/admin/products", "/admin/issues"],
    syncNavHrefs: [
      "/admin/products",
      "/admin/collections",
      "/admin/pages/care",
      "/admin/settings",
      "/admin/translations",
    ],
  },
};

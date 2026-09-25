import type { Meta, StoryObj } from "@storybook/react";
import { FileText, Gem, Images, PackageSearch, Shapes, Store } from "lucide-react";
import { useState } from "react";

import {
  AdminSectionTabs,
  type AdminSectionTabGroup,
  type AdminSectionTabItem,
} from "@/components/synarava-cms";

const GROUPS: AdminSectionTabGroup[] = [
  { id: "shopify", label: "Shopify" },
  { id: "synarava", label: "Synarava" },
];

const ALL_ITEMS: AdminSectionTabItem[] = [
  { id: "essentials", label: "Essentials", detail: "Sellable product", icon: PackageSearch, group: "shopify" },
  { id: "catalog", label: "Catalog", detail: "Placement & filters", icon: Shapes, tone: "issue", dirty: true, group: "shopify" },
  { id: "content", label: "Content", detail: "Copy & search", icon: FileText, group: "shopify" },
  { id: "media", label: "Media", detail: "Gallery & cover", icon: Images, tone: "conflict", group: "shopify" },
  { id: "shopify", label: "Sync", detail: "Push, pull & snapshot", icon: Store, group: "shopify" },
  { id: "details", label: "Product page", detail: "Materials & craft", icon: Gem, group: "synarava" },
];

const meta = {
  title: "synarava-cms/AdminSectionTabs",
  component: AdminSectionTabs,
  decorators: [
    (Story) => (
      <div className="admin-terminal admin-modal-root min-h-screen bg-[var(--adm-bg)] p-6 text-[var(--adm-ink)]">
        <div className="mx-auto max-w-5xl rounded-xl border border-[var(--adm-border)] bg-[var(--adm-panel)] p-0 overflow-hidden">
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof AdminSectionTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

function TabsPlayground({
  items,
  groups,
}: {
  items: AdminSectionTabItem[];
  groups?: AdminSectionTabGroup[];
}) {
  const [active, setActive] = useState(items[0]?.id ?? "essentials");
  return (
    <AdminSectionTabs
      items={items}
      groups={groups}
      active={active}
      onChange={setActive}
      columns={groups ? undefined : items.length}
    >
      <div className="adm-inset-x space-y-3 py-5">
        <h2 className="text-xl font-semibold">Open section: {active}</h2>
        <p className="max-w-[60ch] text-sm text-[var(--adm-muted)]">
          Cool well background marks that you are inside this tab. Idle tabs stay warm/white; selected
          tabs share the well color. Catalog shows issue tone; Media shows conflict tone.
          Product editor splits the strip into Shopify vs Synarava groups.
        </p>
      </div>
    </AdminSectionTabs>
  );
}

export const StateMatrix: Story = {
  args: {
    items: ALL_ITEMS,
    active: "content",
    onChange: () => {},
  },
  render: () => <TabsPlayground items={ALL_ITEMS} groups={GROUPS} />,
};

export const FlatUngrouped: Story = {
  args: {
    items: ALL_ITEMS.slice(0, 4),
    active: "content",
    onChange: () => {},
  },
  render: () => <TabsPlayground items={ALL_ITEMS.slice(0, 4)} />,
};

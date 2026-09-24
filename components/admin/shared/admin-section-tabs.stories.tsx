import type { Meta, StoryObj } from "@storybook/react";
import { FileText, Images, PackageSearch, Shapes } from "lucide-react";
import { useState } from "react";

import { AdminSectionTabs, type AdminSectionTabItem } from "@/components/synarava-cms";

const ALL_ITEMS: AdminSectionTabItem[] = [
  { id: "essentials", label: "Essentials", detail: "Sellable product", icon: PackageSearch },
  { id: "catalog", label: "Catalog", detail: "Placement & filters", icon: Shapes, tone: "issue", dirty: true },
  { id: "content", label: "Content", detail: "Copy & search", icon: FileText },
  { id: "media", label: "Media", detail: "Gallery & cover", icon: Images, tone: "conflict" },
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

function TabsPlayground({ items }: { items: AdminSectionTabItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "essentials");
  return (
    <AdminSectionTabs items={items} active={active} onChange={setActive} columns={items.length}>
      <div className="adm-inset-x space-y-3 py-5">
        <h2 className="text-xl font-semibold">Open section: {active}</h2>
        <p className="max-w-[60ch] text-sm text-[var(--adm-muted)]">
          Cool well background marks that you are inside this tab. Idle tabs stay warm/white; selected
          tabs share the well color. Catalog shows issue tone; Media shows conflict tone.
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
  render: () => <TabsPlayground items={ALL_ITEMS} />,
};

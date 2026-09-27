import type { Meta, StoryObj } from "@storybook/react";
import { CircleDollarSign, FileText, Gem, Images, PackageSearch, Shapes, Store } from "lucide-react";
import { useState } from "react";

const LOCALES = ["en", "pt", "ru"] as const;

import {
  AdminSectionTabs,
  type AdminSectionTabGroup,
  type AdminSectionTabItem,
} from "@/components/admin/shared/admin-section-tabs";

const GROUPS: AdminSectionTabGroup[] = [
  { id: "shopify", label: "Shopify", compactLabel: "Shop" },
  { id: "synarava", label: "Synarava", compactLabel: "Syn" },
];

const ALL_ITEMS: AdminSectionTabItem[] = [
  { id: "essentials", label: "Essentials", stripLabel: "Product", detail: "Sellable product", icon: PackageSearch, group: "shopify" },
  { id: "price", label: "Price", stripLabel: "Price", detail: "Sell & tax", icon: CircleDollarSign, group: "shopify" },
  { id: "catalog", label: "Catalog", stripLabel: "Catalog", detail: "Placement & filters", icon: Shapes, tone: "issue", dirty: true, group: "shopify" },
  { id: "content", label: "Content", stripLabel: "Content", detail: "Copy & search", icon: FileText, group: "shopify" },
  { id: "media", label: "Media", stripLabel: "Media", detail: "Gallery & cover", icon: Images, tone: "conflict", group: "shopify" },
  { id: "shopify", label: "Sync", stripLabel: "Sync", detail: "Push, pull & snapshot", icon: Store, group: "shopify" },
  { id: "details", label: "Product page", stripLabel: "Page", detail: "Materials & craft", icon: Gem, group: "synarava" },
];

const meta = {
  title: "synarava-cms/AdminSectionTabs",
  component: AdminSectionTabs,
  decorators: [
    (Story) => (
      <div
        className="admin-terminal admin-modal-root bg-[var(--adm-bg)] p-6 text-[var(--adm-ink)]"
        style={{ display: "block", height: "auto", overflow: "visible" }}
      >
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
          The language color is the container border. Section tabs are filled:
          Shopify cool, Synarava warm. Catalog shows issue tone; Media shows conflict tone.
        </p>
      </div>
    </AdminSectionTabs>
  );
}

function LanguageAndSections() {
  const [locale, setLocale] = useState<(typeof LOCALES)[number]>("en");
  const accent = `var(--adm-locale-${locale})`;
  return (
    <div
      className="adm-locale-frame overflow-hidden rounded-[0.875rem] bg-[var(--adm-panel)]"
      data-locale={locale}
      style={{ ["--locale-tone-accent" as string]: accent }}
    >
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-3">
        <div className="adm-locale-tabs">
        {LOCALES.map((code) => (
          <button
            key={code}
            type="button"
            className="adm-locale-tab"
            data-locale={code}
            data-active={locale === code ? "true" : undefined}
            onClick={() => setLocale(code)}
          >
            {code}
            <span className="adm-locale-tab__marks">
              <span className="adm-locale-tab__pip" data-tone="conflict" />
            </span>
          </button>
        ))}
        </div>
      </div>
      <TabsPlayground items={ALL_ITEMS} groups={GROUPS} />
    </div>
  );
}

export const StateMatrix: Story = {
  args: {
    items: ALL_ITEMS,
    active: "content",
    onChange: () => {},
  },
  render: () => <LanguageAndSections />,
};

export const FlatUngrouped: Story = {
  args: {
    items: ALL_ITEMS.slice(0, 4),
    active: "content",
    onChange: () => {},
  },
  render: () => <TabsPlayground items={ALL_ITEMS.slice(0, 4)} />,
};

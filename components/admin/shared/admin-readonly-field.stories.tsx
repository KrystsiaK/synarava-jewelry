import type { Meta, StoryObj } from "@storybook/react";

import { AdminHelp, AdminReadonlyField } from "@/components/synarava-cms";

const meta = {
  title: "synarava-cms/AdminReadonlyField",
  component: AdminReadonlyField,
  decorators: [
    (Story) => (
      <div className="admin-modal-root min-h-screen bg-[var(--adm-bg)] p-6 text-[var(--adm-ink)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AdminReadonlyField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ShopifySynced: Story = {
  args: {
    label: "Compare-at price",
    owner: "Shopify",
    value: "€148.00",
    help: (
      <AdminHelp label="Compare-at guidance">
        Struck-through original price when higher than Price. Edit in Shopify Admin.
      </AdminHelp>
    ),
  },
};

export const Empty: Story = {
  args: {
    label: "Compare-at price",
    owner: "Shopify",
    value: null,
    emptyLabel: "Not set",
    help: (
      <AdminHelp label="Compare-at guidance">
        No compare-at on the primary variant.
      </AdminHelp>
    ),
  },
};

export const DerivedMetrics: Story = {
  // Required by StoryObj when the component has required props; render owns the UI.
  args: {
    label: "Profit",
    value: "€42.50",
  },
  render: () => (
    <div className="grid max-w-xl gap-5 sm:grid-cols-2">
      <AdminReadonlyField
        label="Profit"
        value="€42.50"
        help={(
          <AdminHelp label="Profit guidance">
            Price minus Cost. Local only.
          </AdminHelp>
        )}
      />
      <AdminReadonlyField
        label="Margin"
        value="28.3%"
        help={(
          <AdminHelp label="Margin guidance">
            Profit as a percent of Price. Local only.
          </AdminHelp>
        )}
      />
    </div>
  ),
};

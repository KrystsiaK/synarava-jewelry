import type { Meta, StoryObj } from "@storybook/react";

import { AdminHelp, AdminTextField } from "@/components/synarava-cms";

const meta = {
  title: "synarava-cms/AdminTextField",
  component: AdminTextField,
  decorators: [
    (Story) => (
      <div className="admin-modal-root min-h-screen bg-[var(--adm-bg)] p-6 text-[var(--adm-ink)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AdminTextField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Product Basics layout — reference for label + owner + help + grid widths. */
export const ProductBasicsGrid: Story = {
  render: () => (
    <div className="mx-auto grid max-w-5xl gap-5">
      <div className="grid items-start gap-x-4 gap-y-5 md:grid-cols-2">
        <AdminTextField
          label="Name"
          owner="Shopify"
          required
          defaultValue="Turquoise Cotton Thread Set – 12 Skeins"
        />
        <AdminTextField
          label="Slug"
          owner="Shopify"
          required
          defaultValue="turquoise-cotton-thread-set-12-skeins"
        />
      </div>

      <div className="grid items-start gap-x-4 gap-y-6 md:grid-cols-2">
        <AdminTextField
          label="SKU"
          owner="Shopify"
          required
          defaultValue="DIY-THREAD-TURQ-12-001"
        />
        <AdminTextField label="Series label" owner="Synarava" defaultValue="" />
        <AdminTextField
          label="Price EUR"
          owner="Shopify"
          required
          type="number"
          step="0.01"
          defaultValue="9.90"
        />
        <AdminTextField
          label="Available quantity"
          owner="Shopify"
          help={(
            <AdminHelp label="Inventory guidance">
              Primary variant inventory synced with Shopify.
            </AdminHelp>
          )}
          type="number"
          defaultValue="1"
        />
      </div>

      <div className="grid items-start gap-x-4 gap-y-5 md:grid-cols-2">
        <AdminTextField label="Vendor / brand" owner="Shopify" defaultValue="Synarava shop" />
        <AdminTextField label="Product type" owner="Shopify" defaultValue="Creative Thread Set" />
      </div>
    </div>
  ),
};

export const WithError: Story = {
  args: {
    label: "SKU",
    owner: "Shopify",
    required: true,
    name: "sku",
    error: "Enter a SKU.",
    defaultValue: "",
  },
};

export const WithEndAdornment: Story = {
  args: {
    label: "Length",
    owner: "Synarava",
    name: "length",
    endAdornment: "mm",
    defaultValue: "12",
  },
};

export const Clearable: Story = {
  args: {
    label: "Tags",
    owner: "Shopify push",
    name: "tags",
    clearable: true,
    defaultValue: "lava, heritage",
  },
};

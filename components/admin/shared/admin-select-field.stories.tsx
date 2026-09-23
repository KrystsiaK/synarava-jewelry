import type { Meta, StoryObj } from "@storybook/react";

import { AdminSelectField } from "@/components/synarava-cms";

const meta = {
  title: "synarava-cms/AdminSelectField",
  component: AdminSelectField,
  decorators: [
    (Story) => (
      <div className="admin-modal-root min-h-screen bg-[var(--adm-bg)] p-6 text-[var(--adm-ink)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AdminSelectField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Product catalog — same field-group chrome as AdminTextField. */
export const SiteState: Story = {
  args: {
    label: "Site state",
    owner: "Shopify",
    name: "workflowState",
    defaultValue: "PUBLISHED",
    className: "md:max-w-xs",
    children: (
      <>
        <option value="DRAFT">Draft — hidden</option>
        <option value="PUBLISHED">Published — visible</option>
        <option value="UNLISTED">Unlisted — direct link only</option>
      </>
    ),
  },
};

export const WithError: Story = {
  args: {
    label: "Collection",
    owner: "Synarava",
    name: "collectionSlug",
    error: "Pick a collection.",
    defaultValue: "",
    children: (
      <>
        <option value="">No collection</option>
        <option value="axis">Axis</option>
      </>
    ),
  },
};

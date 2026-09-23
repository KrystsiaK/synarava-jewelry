import type { Meta, StoryObj } from "@storybook/react";

import { AdminLongTextField } from "@/components/synarava-cms";

const meta = {
  title: "synarava-cms/AdminLongTextField",
  component: AdminLongTextField,
  decorators: [
    (Story) => (
      <div className="admin-modal-root min-h-screen bg-[var(--adm-bg)] p-6 text-[var(--adm-ink)]">
        <div className="mx-auto max-w-5xl">
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof AdminLongTextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyPreview: Story = {
  args: {
    label: "Fit notes",
    name: "fit_notes",
    defaultValue: "",
    placeholder: "No content yet.",
  },
};

export const WithContent: Story = {
  args: {
    label: "Description",
    owner: "Shopify",
    name: "description",
    defaultValue: "Hand-finished turquoise set on a cotton cord. Adjustable fit.",
  },
};

export const WithError: Story = {
  args: {
    label: "Fit notes",
    name: "fit_notes",
    error: "Add fit notes.",
    defaultValue: "",
  },
};

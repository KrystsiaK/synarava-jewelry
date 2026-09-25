import type { Meta, StoryObj } from "@storybook/react";

import { AdminRichTextField } from "@/components/synarava-cms";

const meta = {
  title: "synarava-cms/AdminRichTextField",
  component: AdminRichTextField,
  decorators: [
    (Story) => (
      <div className="admin-modal-root min-h-screen bg-[var(--adm-bg)] p-6 text-[var(--adm-ink)]">
        <div className="mx-auto max-w-5xl">
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof AdminRichTextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyPreview: Story = {
  args: {
    label: "Body",
    name: "body",
    defaultValue: "",
    placeholder: "No content yet.",
  },
};

export const WithLink: Story = {
  args: {
    label: "Body",
    name: "body",
    defaultValue:
      '<p>Contact <a href="https://www.centroarbitragemlisboa.pt">www.centroarbitragemlisboa.pt</a> for dispute resolution.</p>',
  },
};

export const WithError: Story = {
  args: {
    label: "Body",
    name: "body",
    error: "Add section body.",
    defaultValue: "",
  },
};

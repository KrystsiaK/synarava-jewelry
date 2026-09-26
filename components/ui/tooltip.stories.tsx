import type { Meta, StoryObj } from "@storybook/react";

import { Tooltip } from "@/components/ui/tooltip";

const meta = {
  title: "synarava-cms/Tooltip",
  component: Tooltip,
  decorators: [
    (Story) => (
      <div className="admin-terminal admin-modal-root min-h-screen bg-[var(--adm-bg)] p-10 text-[var(--adm-ink)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Tooltip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const HelpTags: Story = {
  args: {
    content: "Hint",
    children: <button type="button">Hint</button>,
  },
  render: () => (
    <div className="flex max-w-xl flex-col gap-10">
      <div className="flex gap-2">
        {["Pull", "Push", "Compare"].map((label) => (
          <Tooltip key={label} content={`${label} the conflicting fields`} delay={180}>
            <button type="button" className="adm-btn-secondary adm-icon-btn" aria-label={label}>
              {label.slice(0, 1)}
            </button>
          </Tooltip>
        ))}
      </div>
      <Tooltip
        content="Price, compare-at, tax, and cost mirror Shopify’s Price card. Profit is calculated locally."
        maxWidth={260}
      >
        <button type="button" className="adm-help__trigger" aria-label="Field guidance">
          i
        </button>
      </Tooltip>
    </div>
  ),
};

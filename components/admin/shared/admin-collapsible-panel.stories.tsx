import type { Meta, StoryObj } from "@storybook/react";

import { AdminCollapsiblePanel, AdminTextField } from "@/components/synarava-cms";

const meta = {
  title: "synarava-cms/AdminCollapsiblePanel",
  component: AdminCollapsiblePanel,
  decorators: [
    (Story) => (
      <div className="admin-modal-root min-h-screen bg-[var(--adm-bg)] p-6 text-[var(--adm-ink)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AdminCollapsiblePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CharacteristicGroups: Story = {
  // Required by StoryObj when the component has required props; render owns the UI.
  args: {
    title: "Dimensions & fit",
    children: null,
  },
  render: () => (
    <div className="mx-auto grid max-w-3xl gap-3">
      <AdminCollapsiblePanel title="Dimensions & fit">
        <div className="grid gap-3 md:grid-cols-2">
          <AdminTextField label="Length" endAdornment="mm" name="length" />
          <AdminTextField label="Width" endAdornment="mm" name="width" />
        </div>
      </AdminCollapsiblePanel>
      <AdminCollapsiblePanel title="Care" defaultOpen>
        <p className="text-sm text-[var(--adm-muted)]">Open body with a clear header divider.</p>
      </AdminCollapsiblePanel>
    </div>
  ),
};

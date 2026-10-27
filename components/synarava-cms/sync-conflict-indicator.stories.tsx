import type { Meta, StoryObj } from "@storybook/react-vite";

import { SyncConflictIndicator } from "@/components/admin/shared/sync-conflict-indicator";

const meta = {
  title: "synarava-cms/SyncConflictIndicator",
  component: SyncConflictIndicator,
  args: {
    label: "this product",
    count: 2,
    onOpen: () => {},
  },
} satisfies Meta<typeof SyncConflictIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextButton: Story = {};

export const IconWithBadge: Story = {
  args: {
    checkIconOnly: true,
    label: "English",
    count: 3,
  },
};

export const CleanIcon: Story = {
  args: {
    checkIconOnly: true,
    label: "Portuguese",
    count: 0,
  },
};

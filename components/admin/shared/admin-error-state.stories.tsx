import type { Meta, StoryObj } from "@storybook/react";

import { AdminErrorState } from "@/components/admin/shared/admin-error-state";

const meta = {
  title: "Admin/Feedback/Error recovery",
  component: AdminErrorState,
  decorators: [
    (Story) => (
      <div className="admin-modal-root min-h-screen bg-[var(--adm-bg)]">
        <Story />
      </div>
    ),
  ],
  args: {
    staleDeployment: true,
    onRetry: () => undefined,
    onReload: () => undefined,
  },
} satisfies Meta<typeof AdminErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StaleDeployment: Story = {};

export const GenericError: Story = {
  args: { staleDeployment: false },
};

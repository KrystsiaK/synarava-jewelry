import type { Meta, StoryObj } from "@storybook/react";

import { HomeSectionVisibilityEditor } from "@/components/admin/pages/home-section-visibility-editor";

const meta = {
  title: "Admin/Home/Section visibility",
  component: HomeSectionVisibilityEditor,
  decorators: [
    (Story) => (
      <div className="admin-modal-root min-h-screen bg-[var(--adm-bg)] p-5 md:p-10">
        <div className="adm-panel mx-auto w-full max-w-5xl p-5 md:p-6">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    content: { departmentSectionEnabled: true },
  },
} satisfies Meta<typeof HomeSectionVisibilityEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

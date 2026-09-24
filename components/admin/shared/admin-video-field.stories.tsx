import type { Meta, StoryObj } from "@storybook/react";

import { AdminHelp, AdminVideoField } from "@/components/synarava-cms";

const meta = {
  title: "synarava-cms/AdminVideoField",
  component: AdminVideoField,
  decorators: [
    (Story) => (
      <div className="admin-modal-root min-h-screen bg-[var(--adm-bg)] p-6 text-[var(--adm-ink)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AdminVideoField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptySlot: Story = {
  args: {
    name: "homeBeads",
    label: "Home — beads",
    help: <AdminHelp>First video in the home-page hero rotation. Replaces the page hero image when set.</AdminHelp>,
  },
};

export const WithCurrentVideo: Story = {
  args: {
    name: "braceletFilm",
    label: "Bracelet film",
    help: <AdminHelp>Used on Home, About hero, and product fit-film sections.</AdminHelp>,
    currentVideoUrl: "/media/uploads/videos/braceletFilm/example.mp4",
  },
};

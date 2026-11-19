import type { Meta, StoryObj } from "@storybook/react-vite";

import { AnnouncementMarquee } from "./announcement-marquee";

const meta = {
  title: "UI/AnnouncementMarquee",
  component: AnnouncementMarquee,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof AnnouncementMarquee>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    message: "Free shipping in Portugal from €45.00",
  },
};

export const SlowWideGap: Story = {
  args: {
    message: "Free shipping in Portugal from €45.00",
    speed: 25,
    gap: 8,
  },
};

export const EmptyRendersNothing: Story = {
  args: {
    message: "   ",
  },
};

import type { Meta, StoryObj } from "@storybook/react";
import { MediaFrame } from "./media-frame";

const meta = {
  title: "UI/MediaFrame",
  component: MediaFrame,
  tags: ["autodocs"],
  args: {
    src: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600",
    alt: "Jewelry artifact",
  },
} satisfies Meta<typeof MediaFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithCaption: Story = {
  args: { caption: "Birch × Silver — 2024 Archive" },
};

export const WithMirror: Story = {
  args: { mirror: true },
};

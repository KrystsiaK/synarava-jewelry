import type { Meta, StoryObj } from "@storybook/react";
import { BodyLead } from "./body-lead";

const meta = {
  title: "UI/BodyLead",
  component: BodyLead,
  tags: ["autodocs"],
} satisfies Meta<typeof BodyLead>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children:
      "Handcrafted jewelry that bridges the gap between ancient Slavic mysticism and the contemporary architectural avant-garde.",
  },
};

import type { Meta, StoryObj } from "@storybook/react";
import { ScrollReveal } from "./scroll-reveal";

const meta = {
  title: "UI/ScrollReveal",
  component: ScrollReveal,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  argTypes: {
    direction: { control: "select", options: ["up", "left", "right", "none"] },
  },
} satisfies Meta<typeof ScrollReveal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Up: Story = {
  args: { direction: "up", children: <p className="text-lg">Revealed from below</p> },
};

export const Left: Story = {
  args: { direction: "left", children: <p className="text-lg">Revealed from right</p> },
};

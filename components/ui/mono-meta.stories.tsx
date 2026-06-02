import type { Meta, StoryObj } from "@storybook/react";
import { MonoMeta } from "./mono-meta";

const meta = {
  title: "UI/MonoMeta",
  component: MonoMeta,
  tags: ["autodocs"],
} satisfies Meta<typeof MonoMeta>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: "01 / Manifesto" },
};

export const Accent: Story = {
  args: { children: "Couture Collection №01", className: "text-accent" },
};

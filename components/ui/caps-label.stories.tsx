import type { Meta, StoryObj } from "@storybook/react";
import { CapsLabel } from "./caps-label";

const meta = {
  title: "UI/CapsLabel",
  component: CapsLabel,
  tags: ["autodocs"],
} satisfies Meta<typeof CapsLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: "Material" },
};

export const Accent: Story = {
  args: { children: "01 / Manifesto", className: "text-accent" },
};

export const Muted: Story = {
  args: { children: "Archive 2024", className: "text-muted" },
};

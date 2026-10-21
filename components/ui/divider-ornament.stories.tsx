import type { Meta, StoryObj } from "@storybook/react-vite";
import { DividerOrnament } from "./divider-ornament";

const meta = {
  title: "UI/DividerOrnament",
  component: DividerOrnament,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof DividerOrnament>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

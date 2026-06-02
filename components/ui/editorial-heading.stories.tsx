import type { Meta, StoryObj } from "@storybook/react";
import { EditorialHeading } from "./editorial-heading";

const meta = {
  title: "UI/EditorialHeading",
  component: EditorialHeading,
  tags: ["autodocs"],
} satisfies Meta<typeof EditorialHeading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: "Hands of the Artisan" },
};

export const Smaller: Story = {
  args: { children: "From Ornament to Architecture", className: "text-[2.6rem] md:text-[3.2rem]" },
};

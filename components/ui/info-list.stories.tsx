import type { Meta, StoryObj } from "@storybook/react";
import { InfoList } from "./info-list";

const meta = {
  title: "UI/InfoList",
  component: InfoList,
  tags: ["autodocs"],
} satisfies Meta<typeof InfoList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: [
      { label: "Material", value: "Oak Wood + Silver 925" },
      { label: "Finish", value: "Matte, hand-sanded" },
      { label: "Dimensions", value: "18 × 4 × 3 mm" },
      { label: "Origin", value: "Minsk, Belarus" },
    ],
  },
};

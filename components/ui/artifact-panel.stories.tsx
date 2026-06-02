import type { Meta, StoryObj } from "@storybook/react";
import { ArtifactPanel } from "./artifact-panel";

const meta = {
  title: "UI/ArtifactPanel",
  component: ArtifactPanel,
  tags: ["autodocs"],
} satisfies Meta<typeof ArtifactPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    className: "p-8 max-w-sm",
    children: (
      <p className="text-sm leading-7">
        A glass-backed panel with backdrop blur and subtle border. Used for floating UI surfaces.
      </p>
    ),
  },
};

import type { Meta, StoryObj } from "@storybook/react";
import { ArtifactButton, ArtifactLink } from "./artifact-button";

const meta = {
  title: "UI/ArtifactButton",
  component: ArtifactButton,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "ghost"] },
  },
} satisfies Meta<typeof ArtifactButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { children: "Explore Archive" },
};

export const Secondary: Story = {
  args: { children: "View Series", variant: "secondary" },
};

export const Ghost: Story = {
  args: { children: "View All", variant: "ghost" },
};

export const LinkVariant: StoryObj = {
  render: () => <ArtifactLink href="#">Explore Archive</ArtifactLink>,
};

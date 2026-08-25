import type { Meta, StoryObj } from "@storybook/react";
import { ArtifactButton, ArtifactLink } from "./artifact-button";

const meta = {
  title: "UI/ArtifactButton",
  component: ArtifactButton,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "ghost", "inverse", "choice"] },
  },
} satisfies Meta<typeof ArtifactButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { children: "Explore Archive" },
  parameters: {
    docs: {
      description: {
        story: "Primary CTAs are always couture red; hover only deepens the red shade.",
      },
    },
  },
};

export const Secondary: Story = {
  args: { children: "View Series", variant: "secondary" },
};

export const Ghost: Story = {
  args: { children: "View All", variant: "ghost" },
};

export const Inverse: Story = {
  args: { children: "Jewelry", variant: "inverse" },
  parameters: {
    docs: {
      description: {
        story: "Theme-aware surface inversion. Background and text always switch as one state pair.",
      },
    },
  },
};

export const Choice: StoryObj = {
  render: () => <ArtifactButton variant="choice" data-selected="true">Large</ArtifactButton>,
};

export const LinkVariant: StoryObj = {
  render: () => <ArtifactLink href="#">Explore Archive</ArtifactLink>,
  parameters: {
    docs: {
      description: {
        story: "Matches the hero Explore Archive link styling.",
      },
    },
  },
};

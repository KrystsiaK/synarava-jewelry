import type { Meta, StoryObj } from "@storybook/react";

import { ProductHeroDescription } from "./product-hero-description";

const description = "Swarovski Crystal Pearl Necklace – 10 mm combines luminous white Swarovski Crystal Pearls with refined gold-tone details for a classic, polished look. The 10 mm pearls create a substantial silhouette while appearing beautifully balanced, making the necklace an elegant choice for both evening dressing and everyday ceremony.";

const meta = {
  title: "Artifacts/Product hero description",
  component: ProductHeroDescription,
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-background p-8 text-foreground md:p-16">
        <div className="max-w-[32rem]">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    summary: "Swarovski Crystal Pearl Necklace – 10 mm combines luminous white Swarovski Crystal Pearls with refined gold-tone details for a classic, polished look. The 10 mm pearls create a substantial silhouette while appearing…",
    description,
  },
} satisfies Meta<typeof ProductHeroDescription>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

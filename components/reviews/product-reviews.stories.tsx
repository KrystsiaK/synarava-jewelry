import type { Meta, StoryObj } from "@storybook/react";

import { ProductReviews } from "./product-reviews";

const meta = {
  title: "Shop/ProductReviews",
  component: ProductReviews,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <main className="min-h-screen bg-background text-foreground">
        <Story />
      </main>
    ),
  ],
  args: {
    productSlug: "lava-ring",
    locale: "en",
    isSignedIn: false,
    submitAction: async () => ({}),
    data: {
      average: 4.7,
      count: 3,
      reviews: [
        {
          id: "review-1",
          handle: "review-1",
          rating: 5,
          title: "Quietly beautiful",
          body: "The finish is even better in person and the proportions feel considered.",
          authorDisplayName: "Marta A.",
          submittedAt: "2026-09-10T12:00:00Z",
          verificationStatus: "verified_buyer",
          merchantReply: "Thank you, Marta. We are glad the details found their way to you.",
          merchantRepliedAt: "2026-09-11T12:00:00Z",
        },
        {
          id: "review-2",
          handle: "review-2",
          rating: 4,
          title: "A considered piece",
          body: "Beautifully packed and comfortable to wear throughout the day.",
          authorDisplayName: "Inês",
          submittedAt: "2026-08-28T09:30:00Z",
          verificationStatus: "unverified",
          merchantReply: "",
          merchantRepliedAt: null,
        },
      ],
    },
  },
} satisfies Meta<typeof ProductReviews>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithReviews: Story = {};

export const EmptySignedIn: Story = {
  args: {
    isSignedIn: true,
    data: { reviews: [], average: null, count: 0 },
  },
};

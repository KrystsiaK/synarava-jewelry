import type { Meta, StoryObj } from "@storybook/react";

import { ProductMediaGallery } from "./product-media-gallery";

const meta = {
  title: "Artifacts/ProductMediaGallery",
  component: ProductMediaGallery,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <main className="min-h-screen bg-background p-4 text-foreground md:p-10">
        <div className="mx-auto max-w-4xl"><Story /></div>
      </main>
    ),
  ],
  args: {
    product: {
      title: "Midnight Duck Bag Charm",
      image: "https://cdn.shopify.com/s/files/1/1101/4176/8029/files/DSC_5851.jpg?v=1788631059",
      commerceMedia: [
        {
          src: "https://cdn.shopify.com/s/files/1/1101/4176/8029/files/DSC_5851.jpg?v=1788631059",
          alt: "Midnight Duck charm styled on a black bag",
          width: 1600,
          height: 2000,
        },
        {
          src: "https://cdn.shopify.com/s/files/1/1101/4176/8029/files/DSC_5859_c155399f-5853-4a99-875c-1faa9339df22.jpg?v=1788625756",
          alt: "Midnight Duck charm detail",
          width: 1600,
          height: 2000,
        },
        {
          src: "https://cdn.shopify.com/s/files/1/1101/4176/8029/files/DSC_5861_293ec9f8-6f5c-499d-af5a-2e95ee172d5e.jpg?v=1788631065",
          alt: "Midnight Duck clasp and bead detail",
          width: 1600,
          height: 2000,
        },
      ],
    },
  },
} satisfies Meta<typeof ProductMediaGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

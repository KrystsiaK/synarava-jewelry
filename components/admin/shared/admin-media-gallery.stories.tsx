import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import {
  AdminMediaGallery,
  type AdminMediaGalleryItem,
} from "./admin-media-gallery";

const INITIAL: AdminMediaGalleryItem[] = [
  {
    id: "gid://shopify/MediaImage/1",
    url: "https://placehold.co/640x640/png?text=Cover",
    alt: "Lava ring, front on linen",
  },
  {
    id: "gid://shopify/MediaImage/2",
    url: "https://placehold.co/640x640/png?text=Side",
    alt: "",
  },
  {
    id: "local:pending-asset",
    url: "https://placehold.co/640x640/png?text=Pending",
    alt: "",
    pendingUpload: true,
  },
];

function InteractiveGallery() {
  const [items, setItems] = useState(INITIAL);
  return (
    <AdminMediaGallery
      items={items}
      description="Shared synarava-cms gallery control — ops by frame id."
      onMove={(frameId, toIndex) => {
        setItems((current) => {
          const from = current.findIndex((item) => item.id === frameId);
          if (from < 0 || toIndex < 0 || toIndex >= current.length) return current;
          const next = [...current];
          const [row] = next.splice(from, 1);
          next.splice(toIndex, 0, row);
          return next;
        });
      }}
      onRemove={(frameId) => setItems((current) => current.filter((item) => item.id !== frameId))}
      onSetCover={(frameId) => {
        setItems((current) => {
          const from = current.findIndex((item) => item.id === frameId);
          if (from <= 0) return current;
          const next = [...current];
          const [row] = next.splice(from, 1);
          next.unshift(row);
          return next;
        });
      }}
      onAlt={(frameId, alt) => {
        setItems((current) =>
          current.map((item) => (item.id === frameId ? { ...item, alt } : item)),
        );
      }}
      onAdd={() => {
        /* storybook: upload wiring lives in ProductMediaManager */
      }}
    />
  );
}

const meta = {
  title: "synarava-cms/AdminMediaGallery",
  component: AdminMediaGallery,
} satisfies Meta<typeof AdminMediaGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: INITIAL,
  },
  render: () => <InteractiveGallery />,
};

export const Empty: Story = {
  args: {
    items: [],
  },
};

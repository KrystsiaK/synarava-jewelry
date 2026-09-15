import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { WishlistHeartButton } from "./wishlist-heart-button";

function WishlistDemo({ outcome }: { outcome: "success" | "error" }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (_input, init) => {
      if (init?.method === "POST") {
        return outcome === "success"
          ? new Response(JSON.stringify({ ok: true, isSaved: true }))
          : new Response(
              JSON.stringify({ ok: false, error: "Wishlist access is unavailable." }),
              { status: 400 },
            );
      }
      return new Response(JSON.stringify({ ok: true, isSaved: false }));
    };
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => {
      window.cancelAnimationFrame(frame);
      window.fetch = originalFetch;
    };
  }, [outcome]);

  return ready ? <WishlistHeartButton productSlug="pearl-necklace" isSignedIn /> : null;
}

const meta = {
  title: "Commerce/Wishlist heart button",
  component: WishlistDemo,
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-background p-16 text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WishlistDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SuccessfulSave: Story = {
  args: { outcome: "success" },
};

export const FailedSave: Story = {
  args: { outcome: "error" },
};

import type { Meta, StoryObj } from "@storybook/react";

import { EphemeralToastProvider, useEphemeralToast } from "./ephemeral-toast";

function ToastDemo() {
  const { pushToast } = useEphemeralToast();
  return (
    <div className="flex flex-wrap gap-3 p-8">
      <button
        type="button"
        className="rounded-full border border-foreground/20 px-4 py-2 text-sm"
        onClick={() => pushToast({ message: "Could not save the wishlist item.", tone: "error" })}
      >
        Push error
      </button>
      <button
        type="button"
        className="rounded-full border border-foreground/20 px-4 py-2 text-sm"
        onClick={() => pushToast({ message: "Saved.", tone: "success" })}
      >
        Push success
      </button>
      <button
        type="button"
        className="rounded-full border border-foreground/20 px-4 py-2 text-sm"
        onClick={() => pushToast({ message: "Conflict check finished.", tone: "info" })}
      >
        Push info
      </button>
      <button
        type="button"
        className="rounded-full border border-foreground/20 px-4 py-2 text-sm"
        onClick={() => {
          pushToast({ message: "First status.", tone: "info" });
          pushToast({ message: "Second status.", tone: "info" });
          pushToast({ message: "Third status is dropped by the cap.", tone: "info" });
        }}
      >
        Burst three (cap 2)
      </button>
    </div>
  );
}

const meta = {
  title: "ui/EphemeralToast",
  component: EphemeralToastProvider,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof EphemeralToastProvider>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Storefront: Story = {
  args: {
    children: <ToastDemo />,
  },
  render: () => (
    <div className="min-h-screen bg-[var(--color-background,#f2f1ee)] text-[var(--color-foreground,#211d19)]">
      <EphemeralToastProvider surface="storefront">
        <ToastDemo />
      </EphemeralToastProvider>
    </div>
  ),
};

export const AdminSurface: Story = {
  args: {
    children: <ToastDemo />,
  },
  render: () => (
    <div className="admin-terminal min-h-screen bg-[var(--adm-bg,#090807)] p-6 text-[var(--adm-ink,#f4efe7)]">
      <p className="mb-4 text-sm text-[var(--adm-muted,#b8aea1)]">
        Admin toasts anchor top-center (near Save). Push success after focusing a Save tip.
      </p>
      <EphemeralToastProvider surface="admin">
        <ToastDemo />
      </EphemeralToastProvider>
    </div>
  ),
};

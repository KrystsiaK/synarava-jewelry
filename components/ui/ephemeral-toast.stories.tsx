import { useState } from "react";
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
        Same provider tree as production admin: root host + nested admin adapter (host=false).
      </p>
      <EphemeralToastProvider surface="storefront">
        <EphemeralToastProvider surface="admin" host={false}>
          <ToastDemo />
        </EphemeralToastProvider>
      </EphemeralToastProvider>
    </div>
  ),
};

/**
 * Production Save path: root host stays mounted; nested admin adapter
 * (host=false) remounts on router.refresh — same as AdminToastProvider under
 * the async RSC layout. Module store must keep the toast visible.
 */
export const SurvivesRemount: Story = {
  args: {
    children: <ToastDemo />,
  },
  render: function SurvivesRemountStory() {
    const [adminTick, setAdminTick] = useState(0);
    return (
      <div className="admin-terminal min-h-screen bg-[var(--adm-bg,#090807)] p-6 text-[var(--adm-ink,#f4efe7)]">
        <p className="mb-4 text-sm text-[var(--adm-muted,#b8aea1)]">
          Mimics Save → pushToast → refreshPreservingScroll: root host stays;
          only the nested admin adapter remounts. Toast must stay visible.
        </p>
        <EphemeralToastProvider surface="storefront">
          <EphemeralToastProvider key={`admin-${adminTick}`} surface="admin" host={false}>
            <SaveThenRefreshProbe onRemountAdmin={() => setAdminTick((value) => value + 1)} />
          </EphemeralToastProvider>
        </EphemeralToastProvider>
      </div>
    );
  },
};

/** Same wiring as product/page Save: toast first, then remount admin adapter. */
function SaveThenRefreshProbe({ onRemountAdmin }: { onRemountAdmin: () => void }) {
  const { pushToast } = useEphemeralToast();
  return (
    <div className="flex flex-wrap gap-3 p-8">
      <button
        type="button"
        data-testid="simulate-save-refresh"
        className="rounded-full border border-foreground/20 px-4 py-2 text-sm"
        onClick={() => {
          pushToast({ message: "Page updated.", tone: "success" });
          // Soft refresh remounts AdminToastProvider after pushToast — same turn.
          onRemountAdmin();
        }}
      >
        Simulate Save → refresh
      </button>
      <button
        type="button"
        className="rounded-full border border-foreground/20 px-4 py-2 text-sm"
        onClick={() => onRemountAdmin()}
      >
        Remount admin adapter only
      </button>
    </div>
  );
}

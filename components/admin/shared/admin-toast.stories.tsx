import type { Meta, StoryObj } from "@storybook/react-vite";

import { AdminButton } from "./admin-button";
import { AdminToastProvider, useAdminToast } from "@/components/admin/shared/admin-toast";
import { EphemeralToastProvider } from "@/components/ui/ephemeral-toast";

function ToastDemo() {
  const { pushToast } = useAdminToast();
  return (
    <div className="flex flex-wrap gap-2">
      <AdminButton
        variant="primary"
        onClick={() => pushToast({ message: "Product saved.", tone: "success" })}
      >
        Success
      </AdminButton>
      <AdminButton
        variant="danger"
        onClick={() => pushToast({ message: "Could not save the product.", tone: "error" })}
      >
        Error
      </AdminButton>
      <AdminButton
        variant="ghost"
        onClick={() => pushToast({ message: "Conflict check finished.", tone: "info" })}
      >
        Info
      </AdminButton>
    </div>
  );
}

const meta = {
  title: "synarava-cms/AdminToast",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  render: () => (
    <div className="admin-terminal min-h-screen bg-[var(--adm-bg,#f2f1ee)] p-6 text-[var(--adm-ink,#211d19)]" data-theme="light">
      <p className="mb-4 text-sm text-[var(--adm-muted)]">Admin toast adapter (top-center) over the shared ephemeral host.</p>
      <EphemeralToastProvider surface="storefront">
        <AdminToastProvider>
          <ToastDemo />
        </AdminToastProvider>
      </EphemeralToastProvider>
    </div>
  ),
};

export const Dark: Story = {
  render: () => (
    <div className="admin-terminal min-h-screen bg-[var(--adm-bg,#090807)] p-6 text-[var(--adm-ink,#f4efe7)]">
      <p className="mb-4 text-sm text-[var(--adm-muted,#b8aea1)]">Admin toast adapter (top-center) over the shared ephemeral host.</p>
      <EphemeralToastProvider surface="storefront">
        <AdminToastProvider>
          <ToastDemo />
        </AdminToastProvider>
      </EphemeralToastProvider>
    </div>
  ),
};

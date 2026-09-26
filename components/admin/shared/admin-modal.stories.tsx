import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";

import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";

const meta = {
  title: "synarava-cms/AdminModal",
  component: AdminConfirmModal,
} satisfies Meta<typeof AdminConfirmModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Confirm: Story = {
  args: {
    open: true,
    title: "Delete this product?",
    description: "This removes the product from the catalog. You can’t undo it.",
    confirmLabel: "Delete",
    tone: "danger",
    onCancel: () => undefined,
    onConfirm: () => undefined,
  },
  render: function ConfirmStory() {
    const [open, setOpen] = useState(true);
    useEffect(() => {
      document.documentElement.dataset.theme = "light";
    }, []);
    return (
      <div className="min-h-screen bg-[#f2f1ee] p-10">
        <button type="button" className="adm-btn-primary" onClick={() => setOpen(true)}>
          Delete product
        </button>
        <AdminConfirmModal
          open={open}
          title="Delete this product?"
          description="This removes the product from the catalog. You can’t undo it."
          confirmLabel="Delete"
          tone="danger"
          onCancel={() => setOpen(false)}
          onConfirm={() => setOpen(false)}
        />
      </div>
    );
  },
};

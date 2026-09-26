import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";
import { AdminModal } from "@/components/admin/shared/admin-modal";

describe("AdminModal", () => {
  it("renders an admin sheet and closes from Escape", () => {
    const onClose = vi.fn();
    render(
      <AdminModal open onClose={onClose} ariaLabel="Edit description">
        <button type="button">Apply</button>
      </AdminModal>,
    );

    const dialog = screen.getByRole("dialog", { name: "Edit description" });
    expect(dialog).toHaveClass("adm-modal");
    expect(dialog.className).not.toContain("t-modal");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("confirms with sentence-case actions and no shouty kicker", () => {
    render(
      <AdminConfirmModal
        open
        title="Delete this product?"
        description="This removes the product from the catalog."
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    expect(screen.getByRole("heading", { name: "Delete this product?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("adm-btn-ghost");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("adm-btn-danger");
    expect(screen.queryByText(/confirm action/i)).not.toBeInTheDocument();
  });
});

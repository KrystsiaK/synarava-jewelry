"use client";

import { useId } from "react";

import { AdminModal } from "@/components/admin/shared/admin-modal";

type AdminConfirmModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  tone?: "default" | "danger";
  onCancel: () => void;
  onConfirm: () => void;
};

export function AdminConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  pending = false,
  tone = "default",
  onCancel,
  onConfirm,
}: AdminConfirmModalProps) {
  const titleId = useId();

  return (
    <AdminModal
      open={open}
      onClose={onCancel}
      ariaLabelledBy={titleId}
      className="grid w-full max-w-md gap-2 p-6"
    >
      <h2 id={titleId} className="adm-title-sm">
        {title}
      </h2>
      <p className="adm-copy">{description}</p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className="adm-btn-ghost">
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className={tone === "danger" ? "adm-btn-danger" : "adm-btn-primary"}
        >
          {pending ? "Processing..." : confirmLabel}
        </button>
      </div>
    </AdminModal>
  );
}

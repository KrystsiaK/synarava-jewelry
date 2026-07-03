"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { deletePageAction } from "@/app/admin/actions";
import { useAdminToast } from "@/components/admin/admin-toast";
import { AuthMessage } from "@/components/auth/auth-form-primitives";

function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
  pending,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-6"
      style={{ background: "rgba(5,4,3,0.82)", backdropFilter: "blur(10px)" }}
    >
      <div className="adm-panel w-full max-w-md p-6">
        <p className="adm-section-tag mb-3">[ CONFIRM OPERATION ]</p>
        <h3 className="adm-title-sm">{title}</h3>
        <p className="adm-copy mt-4">{description}</p>
        <div
          className="mt-6 flex flex-wrap justify-end gap-3 pt-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button type="button" onClick={onCancel} className="adm-btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="adm-btn-danger"
          >
            {pending ? "Deleting..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PageDeleteButton({
  slug,
  title,
}: {
  slug: string;
  title: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<{ error?: string; success?: string }>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useAdminToast();

  function handleDelete() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("slug", slug);
      const result = await deletePageAction(formData);
      setState(result);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (!result?.error) {
        setConfirmOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={isPending}
          className="adm-btn-danger"
        >
          {isPending ? "Deleting..." : "Delete page"}
        </button>
        <AuthMessage error={state.error} />
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={`Delete ${title}`}
        description="Вы точно хотите удалить страницу? Это защитит от случайного нажатия. Страница будет удалена из админки и перестанет открываться по своему URL."
        confirmLabel="Да, удалить страницу"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        pending={isPending}
      />
    </>
  );
}

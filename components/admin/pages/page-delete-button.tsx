"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { deletePageAction } from "@/app/admin/actions/pages";
import { AdminIconButton } from "@/components/synarava-cms";
import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { AuthMessage } from "@/components/auth/auth-form-primitives";

export function PageDeleteButton({
  slug,
  title,
  onDeleted,
  compact = false,
}: {
  slug: string;
  title: string;
  onDeleted?: () => void;
  /** Icon + tooltip for entity list rows. */
  compact?: boolean;
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
        onDeleted?.();
        router.refresh();
      }
    });
  }

  return (
    <>
      {compact ? (
        <AdminIconButton
          label="Delete page"
          tooltip="Permanently delete this page"
          tone="danger"
          onClick={() => setConfirmOpen(true)}
          disabled={isPending}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </AdminIconButton>
      ) : (
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
      )}

      {compact && state.error ? <AuthMessage error={state.error} /> : null}

      <AdminConfirmModal
        open={confirmOpen}
        title={`Delete ${title}`}
        description="Вы точно хотите удалить страницу? Это защитит от случайного нажатия. Страница будет удалена из админки и перестанет открываться по своему URL."
        confirmLabel="Да, удалить страницу"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        pending={isPending}
        tone="danger"
      />
    </>
  );
}

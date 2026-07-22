"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { deletePageAction } from "@/app/admin/actions";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { useAdminToast } from "@/components/admin/admin-toast";
import { AuthMessage } from "@/components/auth/auth-form-primitives";

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

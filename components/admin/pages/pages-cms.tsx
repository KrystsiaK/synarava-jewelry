"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import {
  updatePageStatusAction,
  type PageActionState,
  type SavedPagePayload,
} from "@/app/admin/actions/pages";
import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";
import { AdminHelp } from "@/components/admin/shared/admin-help";
import { AdminRecordDates, AdminRecordMetaModal } from "@/components/admin/shared/admin-record-meta";
import { PageDeleteButton } from "@/components/admin/pages/page-delete-button";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import { isProtectedPage, pageActionCopy, pageStatusLabel } from "@/components/admin/pages/page-helpers";
import type { PageRowAction } from "@/components/admin/pages/page-types";

export function PagesCms({ pages: initialPages }: { pages: SavedPagePayload[] }) {
  const [pages, setPages] = useState(initialPages);
  const [rowAction, setRowAction] = useState<PageRowAction | null>(null);
  const [editingPage, setEditingPage] = useState<SavedPagePayload | null>(null);
  const [rowState, setRowState] = useState<PageActionState>({});
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useAdminToast();

  const modalCopy = rowAction ? pageActionCopy(rowAction) : null;

  function handleUpdated(page: SavedPagePayload) {
    setPages((current) => current.map((item) => (item.slug === page.slug ? page : item)));
  }

  function runRowAction() {
    if (!rowAction) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.set("slug", rowAction.page.slug);
      formData.set("action", rowAction.action);
      const result = await updatePageStatusAction(formData);
      setRowState(result);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.page) handleUpdated(result.page);
      setRowAction(null);
    });
  }

  return (
    <div className="grid gap-6">
      <div className="adm-panel flex items-start gap-3 p-4">
        <span style={{ color: "var(--adm-accent)", fontSize: "0.8rem" }}>◆</span>
        <div className="adm-label-row">
          <span className="adm-title-sm">Locale status: EN only</span>
          <AdminHelp>
            Edits here affect the EN locale only. BE and RU translation support is planned and will be wired in a future release.
          </AdminHelp>
        </div>
      </div>

      <section className="adm-panel p-5">
        <div
          className="flex flex-col gap-3 pb-4 md:flex-row md:items-end md:justify-between"
          style={{ borderBottom: "1px solid var(--adm-border)" }}
        >
          <div>
            <p className="adm-section-tag">[ PAGES TABLE ]</p>
            <div className="adm-label-row mt-2">
              <h2 className="adm-title-sm">Pages table</h2>
              <AdminHelp label="Page actions" align="end">
                New page opens the create route. Details opens the page edit route. Publish, Draft, and Archive change public visibility after confirmation.
              </AdminHelp>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/pages/new" className="adm-btn-primary">
              New page
            </Link>
          </div>
        </div>
        <AuthMessage error={rowState.error} />
        <div className="mt-4 grid gap-2">
          {pages.map((page) => {
            const status = pageStatusLabel(page);

            return (
              <div
                key={page.id}
                className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_7rem_minmax(16rem,auto)] lg:items-center"
                style={{
                  border: "1px solid var(--adm-border)",
                }}
              >
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--adm-ink)" }}>
                    {page.title}
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--adm-muted)" }}>
                    /{page.slug}
                  </p>
                  <AdminRecordDates record={page} />
                </div>
                <span className={status === "PUBLISHED" ? "adm-badge-published" : "adm-badge-draft"}>
                  {status}
                </span>
                <div className="flex flex-wrap justify-start gap-2 md:justify-end">
                  <button
                    type="button"
                    className="adm-btn-primary py-1 px-2 text-[0.58rem]"
                    onClick={() => setEditingPage(page)}
                  >
                    Details
                  </button>
                  {status === "PUBLISHED" ? (
                    <button
                      type="button"
                      className="adm-btn-ghost py-1 px-2 text-[0.58rem]"
                      onClick={() => setRowAction({ page, action: "draft" })}
                    >
                      Draft
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="adm-btn-ghost py-1 px-2 text-[0.58rem]"
                      onClick={() => setRowAction({ page, action: "publish" })}
                      disabled={status === "ARCHIVED"}
                    >
                      Publish
                    </button>
                  )}
                  {status === "ARCHIVED" ? (
                    <button
                      type="button"
                      className="adm-btn-ghost py-1 px-2 text-[0.58rem]"
                      onClick={() => setRowAction({ page, action: "draft" })}
                    >
                      Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="adm-btn-danger py-1 px-2 text-[0.58rem]"
                      onClick={() => setRowAction({ page, action: "archive" })}
                    >
                      Archive
                    </button>
                  )}
                  {!isProtectedPage(page.slug) ? (
                    <PageDeleteButton slug={page.slug} title={page.title} />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {modalCopy ? (
        <AdminConfirmModal
          open={Boolean(rowAction)}
          title={modalCopy.title}
          description={modalCopy.description}
          confirmLabel={modalCopy.confirmLabel}
          tone={modalCopy.tone}
          pending={isPending}
          onCancel={() => setRowAction(null)}
          onConfirm={runRowAction}
        />
      ) : null}

      <AdminRecordMetaModal
        open={Boolean(editingPage)}
        title={editingPage?.title ?? "Page"}
        subtitle={editingPage ? `/${editingPage.slug}` : undefined}
        href={editingPage ? `/admin/pages/${editingPage.slug}` : "/admin/pages"}
        entityType="PAGE"
        entityId={editingPage?.id ?? ""}
        record={editingPage}
        onClose={() => setEditingPage(null)}
      />
    </div>
  );
}

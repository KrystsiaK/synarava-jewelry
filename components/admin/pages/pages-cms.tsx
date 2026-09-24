"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Archive,
  FilePenLine,
  Info,
  RotateCcw,
  Upload,
} from "lucide-react";

import {
  updatePageStatusAction,
  type PageActionState,
  type SavedPagePayload,
} from "@/app/admin/actions/pages";
import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";
import { AdminRecordDates, AdminRecordMetaModal } from "@/components/admin/shared/admin-record-meta";
import { PageDeleteButton } from "@/components/admin/pages/page-delete-button";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import { isProtectedPage, pageActionCopy, pageStatusLabel } from "@/components/admin/pages/page-helpers";
import type { PageRowAction } from "@/components/admin/pages/page-types";
import {
  AdminEntityList,
  AdminHelp,
  AdminIconButton,
  AdminStatusBadge,
} from "@/components/synarava-cms";

const PAGE_GRID = "xl:grid-cols-[minmax(0,1.6fr)_5.5rem_9rem]";

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

  function handleDeleted(slug: string) {
    setPages((current) => current.filter((item) => item.slug !== slug));
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
    <div data-component="PagesCms" className="grid gap-6">
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
                New page opens the create route. Details opens record history. Publish, Draft, and Archive change public visibility after confirmation.
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
        <AdminEntityList.Root>
          <AdminEntityList.Header
            gridClassName={PAGE_GRID}
            columns={[
              { key: "page", label: "Page" },
              { key: "status", label: "Status" },
              { key: "actions", label: "Actions", align: "end" },
            ]}
          />
          {pages.map((page) => {
            const status = pageStatusLabel(page);

            return (
              <AdminEntityList.Row key={page.id} gridClassName={PAGE_GRID}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold" style={{ color: "var(--adm-ink)" }}>
                    {page.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs" style={{ color: "var(--adm-muted)" }}>
                    /{page.slug}
                  </p>
                  <AdminRecordDates record={page} />
                </div>
                <AdminStatusBadge status={status} />
                <div className="flex shrink-0 flex-nowrap items-center justify-start gap-1 xl:justify-end">
                  <AdminIconButton
                    label="Details"
                    tooltip="Record details and version history"
                    tone="primary"
                    onClick={() => setEditingPage(page)}
                  >
                    <Info className="size-3.5" aria-hidden="true" />
                  </AdminIconButton>
                  {status === "PUBLISHED" ? (
                    <AdminIconButton
                      label="Draft"
                      tooltip="Move to draft — hide from the public site"
                      onClick={() => setRowAction({ page, action: "draft" })}
                    >
                      <FilePenLine className="size-3.5" aria-hidden="true" />
                    </AdminIconButton>
                  ) : (
                    <AdminIconButton
                      label="Publish"
                      tooltip="Publish to the public site"
                      onClick={() => setRowAction({ page, action: "publish" })}
                      disabled={status === "ARCHIVED"}
                    >
                      <Upload className="size-3.5" aria-hidden="true" />
                    </AdminIconButton>
                  )}
                  {status === "ARCHIVED" ? (
                    <AdminIconButton
                      label="Restore"
                      tooltip="Restore from archive to draft"
                      onClick={() => setRowAction({ page, action: "draft" })}
                    >
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                    </AdminIconButton>
                  ) : (
                    <AdminIconButton
                      label="Archive"
                      tooltip="Archive — hide from the site but keep the record"
                      onClick={() => setRowAction({ page, action: "archive" })}
                    >
                      <Archive className="size-3.5" aria-hidden="true" />
                    </AdminIconButton>
                  )}
                  {!isProtectedPage(page.slug) ? (
                    <PageDeleteButton
                      slug={page.slug}
                      title={page.title}
                      compact
                      onDeleted={() => handleDeleted(page.slug)}
                    />
                  ) : null}
                </div>
              </AdminEntityList.Row>
            );
          })}
        </AdminEntityList.Root>
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

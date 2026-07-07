"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";

import {
  autosavePageDraftAction,
  savePageAction,
  updatePageStatusAction,
  type PageActionState,
  type SavedPagePayload,
} from "@/app/admin/actions";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { AdminHelp } from "@/components/admin/admin-help";
import { AdminRecordDates, AdminRecordMetaModal } from "@/components/admin/admin-record-meta";
import { LocaleTabStrip } from "@/components/admin/admin-primitives";
import { PageDeleteButton } from "@/components/admin/page-delete-button";
import { useAdminToast } from "@/components/admin/admin-toast";
import { useDraftAutosave } from "@/components/admin/use-draft-autosave";
import { AuthMessage } from "@/components/auth/auth-form-primitives";

type PageRowAction = {
  page: SavedPagePayload;
  action: "publish" | "draft" | "archive";
};

function pageStatusLabel(page: SavedPagePayload) {
  if (page.status === "ARCHIVED") return "ARCHIVED";
  return page.status === "PUBLISHED" && page.visibility === "PUBLIC" ? "PUBLISHED" : "DRAFT";
}

function isProtectedPage(slug: string) {
  return slug === "home" || slug === "about" || slug === "manifesto";
}

function pageActionCopy(target: PageRowAction) {
  if (target.action === "publish") {
    return {
      title: `Publish ${target.page.title}`,
      description:
        "This makes the page public. Storefront visitors may see the updated page immediately after cache revalidation.",
      confirmLabel: "Publish page",
      tone: "default" as const,
    };
  }
  if (target.action === "draft") {
    return {
      title: `Move ${target.page.title} to draft`,
      description:
        "This hides the page from public access where the storefront checks publishing state. The content remains editable in admin.",
      confirmLabel: "Move to draft",
      tone: "default" as const,
    };
  }
  return {
    title: `Archive ${target.page.title}`,
    description:
      "This hides the page and keeps the record in admin. Use archive when content should disappear from the storefront but may be restored later.",
    confirmLabel: "Archive page",
    tone: "danger" as const,
  };
}

export function PageEditor({
  page,
  onUpdated,
}: {
  page: SavedPagePayload;
  onUpdated?: (page: SavedPagePayload) => void;
}) {
  const [state, setState] = useState<PageActionState>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const content = (page.content ?? {}) as Record<string, string | undefined>;
  const { pushToast } = useAdminToast();

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await savePageAction(formData);
      setState(result);
      setConfirmOpen(false);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.page) onUpdated?.(result.page);
    });
  }

  return (
    <div className="adm-panel grid gap-5 p-5 md:p-6">
      <form ref={formRef} action={formAction} className="grid gap-5">
        <input type="hidden" name="slug" value={page.slug} />

        <div
          className="flex flex-wrap items-start justify-between gap-4 pb-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <p className="adm-section-tag">[ EDIT PAGE ]</p>
            <h2 className="adm-title-sm mt-2">{page.title}</h2>
            <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>
              /{page.slug}
            </p>
          </div>
          <button
            type="button"
            className="adm-btn-primary"
            disabled={isPending}
            onClick={() => setConfirmOpen(true)}
          >
            {isPending ? "Saving..." : "Save page"}
          </button>
        </div>

        <LocaleTabStrip />
        <AuthMessage error={state.error} />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="adm-label">Title</span>
            <input name="title" defaultValue={page.title} className="adm-field" />
          </label>
          <label className="grid gap-2">
            <span className="adm-label">Eyebrow</span>
            <input name="eyebrow" defaultValue={content.eyebrow ?? ""} className="adm-field" />
          </label>
        </div>

        <label className="grid gap-2">
          <span className="adm-label">Excerpt</span>
          <textarea name="excerpt" defaultValue={page.excerpt ?? ""} rows={3} className="adm-field" />
        </label>

        <label className="grid gap-2">
          <span className="adm-label">Body</span>
          <textarea name="body" defaultValue={content.body ?? ""} rows={5} className="adm-field" />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="adm-label">CTA label</span>
            <input name="ctaLabel" defaultValue={content.ctaLabel ?? ""} className="adm-field" />
          </label>
          <label className="grid gap-2">
            <span className="adm-label">CTA href</span>
            <input name="ctaHref" defaultValue={content.ctaHref ?? ""} className="adm-field" />
          </label>
        </div>

        <label className="grid gap-2">
          <span className="adm-label">Quote</span>
          <textarea name="quote" defaultValue={content.quote ?? ""} rows={4} className="adm-field" />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="adm-label">Secondary title</span>
            <input
              name="secondaryTitle"
              defaultValue={content.secondaryTitle ?? ""}
              className="adm-field"
            />
          </label>
          <label className="grid gap-2">
            <span className="adm-label">Secondary body</span>
            <textarea
              name="secondaryBody"
              defaultValue={content.secondaryBody ?? ""}
              rows={3}
              className="adm-field"
            />
          </label>
        </div>

        <label className="grid gap-2 md:max-w-xs">
          <span className="adm-label">Publishing state after save</span>
          <select
            name="workflowState"
            defaultValue={pageStatusLabel(page) === "PUBLISHED" ? "PUBLISHED" : "DRAFT"}
            className="adm-field"
          >
            <option value="DRAFT">Draft - hidden</option>
            <option value="PUBLISHED">Published - visible</option>
          </select>
        </label>

        <div
          className="flex justify-end pt-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button
            type="button"
            className="adm-btn-primary"
            disabled={isPending}
            onClick={() => setConfirmOpen(true)}
          >
            {isPending ? "Saving..." : "Save page"}
          </button>
        </div>
      </form>

      <AdminConfirmModal
        open={confirmOpen}
        title={`Save ${page.title}`}
        description="This writes page copy and publishing state to the database. Published pages may change the storefront immediately after revalidation."
        confirmLabel="Save page"
        pending={isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </div>
  );
}

export function CreatePageForm({ onCreated }: { onCreated: (page: SavedPagePayload) => void }) {
  const [state, setState] = useState<PageActionState>({});
  const [isPending, startTransition] = useTransition();
  const [draftId, setDraftId] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const { pushToast } = useAdminToast();

  useDraftAutosave({
    formRef,
    saveDraft: autosavePageDraftAction,
    onSaved: (result) => {
      if (result.recordId) setDraftId(result.recordId);
    },
  });

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await savePageAction(formData);
      setState(result);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.page) {
        onCreated(result.page);
        formRef.current?.reset();
      }
    });
  }

  return (
    <form ref={formRef} action={formAction} className="adm-panel grid gap-5 p-5 md:p-6">
      <input type="hidden" name="pageId" value={draftId} />
      <div
        className="flex flex-wrap items-start justify-between gap-4 pb-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div>
          <p className="adm-section-tag">[ PAGE // NEW ]</p>
          <h2 className="adm-title-sm mt-2">Untitled page</h2>
          <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--adm-muted)" }}>
            New custom pages are published at <code>/{`slug`}</code>. Built-in routes stay
            protected from deletion.
          </p>
        </div>
        <button type="submit" disabled={isPending} className="adm-btn-primary">
          {isPending ? "Creating..." : "Create page"}
        </button>
      </div>

      <LocaleTabStrip />
      <AuthMessage error={state.error} />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="adm-label">Title</span>
          <input name="title" placeholder="Journal" className="adm-field" />
        </label>
        <label className="grid gap-2">
          <span className="adm-label">Slug</span>
          <input name="slug" placeholder="journal" className="adm-field" />
        </label>
        <label className="grid gap-2">
          <span className="adm-label">Eyebrow</span>
          <input name="eyebrow" placeholder="Editorial note" className="adm-field" />
        </label>
        <label className="grid gap-2">
          <span className="adm-label">Publishing state</span>
          <select name="workflowState" defaultValue="PUBLISHED" className="adm-field">
            <option value="DRAFT">Draft - hidden</option>
            <option value="PUBLISHED">Published - visible</option>
          </select>
        </label>
      </div>

      <label className="grid gap-2">
        <span className="adm-label">Excerpt</span>
        <textarea
          name="excerpt"
          rows={3}
          className="adm-field"
          placeholder="Short summary for the page intro and metadata."
        />
      </label>

      <label className="grid gap-2">
        <span className="adm-label">Body</span>
        <textarea name="body" rows={5} className="adm-field" placeholder="Main editorial body copy." />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="adm-label">CTA label</span>
          <input name="ctaLabel" placeholder="Shop all products" className="adm-field" />
        </label>
        <label className="grid gap-2">
          <span className="adm-label">CTA href</span>
          <input name="ctaHref" placeholder="/shop" className="adm-field" />
        </label>
      </div>

      <label className="grid gap-2">
        <span className="adm-label">Quote</span>
        <textarea
          name="quote"
          rows={4}
          className="adm-field"
          placeholder="Optional quote or highlighted statement."
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="adm-label">Secondary title</span>
          <input name="secondaryTitle" placeholder="Further reading" className="adm-field" />
        </label>
        <label className="grid gap-2">
          <span className="adm-label">Secondary body</span>
          <textarea
            name="secondaryBody"
            rows={3}
            className="adm-field"
            placeholder="Optional follow-up copy block."
          />
        </label>
      </div>
    </form>
  );
}

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
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
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
                  border: "1px solid rgba(255,255,255,0.06)",
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

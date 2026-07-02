"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  deleteTagAction,
  saveTagAction,
  type SavedTagPayload,
  type TagActionState,
} from "@/app/admin/actions";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { AdminRecordDates, AdminRecordMetaModal } from "@/components/admin/admin-record-meta";
import { slugifyForAdmin } from "@/components/admin/slug-utils";
import { AuthMessage } from "@/components/auth/auth-form-primitives";

export function TagsTable({ tags }: { tags: SavedTagPayload[] }) {
  const [query, setQuery] = useState("");
  const [editingTag, setEditingTag] = useState<SavedTagPayload | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      tags.filter((tag) =>
        [tag.name, tag.slug].join(" ").toLowerCase().includes(normalizedQuery),
      ),
    [tags, normalizedQuery],
  );

  return (
    <section className="adm-panel p-5">
      <div
        className="flex flex-col gap-3 pb-4 md:flex-row md:items-end md:justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div>
          <p className="adm-section-tag">[ TAXONOMY // TAGS ]</p>
          <h2 className="adm-title-sm mt-2">Tags table</h2>
        </div>
        <Link href="/admin/tags/new" className="adm-btn-primary">
          New tag
        </Link>
      </div>

      <label className="mt-4 grid gap-2 md:max-w-md">
        <span className="adm-label">Search</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name or slug"
          className="adm-field"
        />
      </label>

      <div className="mt-4 grid gap-2">
        {filtered.length > 0 ? (
          filtered.map((tag) => (
            <div
              key={tag.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--adm-ink)" }}>
                  {tag.name}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--adm-muted)" }}>
                  /{tag.slug}
                </p>
                <AdminRecordDates record={tag} />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="adm-btn-primary py-1 px-2 text-[0.58rem]"
                  onClick={() => setEditingTag(tag)}
                >
                  Details
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="adm-copy py-6">No tags match the current search.</p>
        )}
      </div>

      <AdminRecordMetaModal
        open={Boolean(editingTag)}
        title={editingTag?.name ?? "Tag"}
        subtitle={editingTag ? `/${editingTag.slug}` : undefined}
        href={editingTag ? `/admin/tags/${editingTag.id}` : "/admin/tags"}
        entityType="TAG"
        entityId={editingTag?.id ?? ""}
        record={editingTag}
        onClose={() => setEditingTag(null)}
      />
    </section>
  );
}

export function TagEditor({ tag }: { tag?: SavedTagPayload }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<TagActionState>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nameValue, setNameValue] = useState(tag?.name ?? "");
  const [slugValue, setSlugValue] = useState(tag?.slug ?? "");
  const [slugLocked, setSlugLocked] = useState(Boolean(tag?.slug));
  const [isPending, startTransition] = useTransition();

  function updateName(value: string) {
    setNameValue(value);
    if (!slugLocked) {
      setSlugValue(slugifyForAdmin(value));
    }
  }

  function updateSlug(value: string) {
    if (!value.trim()) {
      setSlugValue(slugifyForAdmin(nameValue));
      setSlugLocked(false);
      return;
    }

    setSlugValue(value);
    setSlugLocked(true);
  }

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await saveTagAction(formData);
      setState(result);
      setConfirmOpen(false);
      if (result.tag) {
        router.push(`/admin/tags/${result.tag.id}`);
        router.refresh();
      }
    });
  }

  function deleteAction() {
    if (!tag) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("tagId", tag.id);
      const result = await deleteTagAction(formData);
      setState(result);
      setDeleteOpen(false);
      if (result.deletedTagId) {
        router.push("/admin/tags");
        router.refresh();
      }
    });
  }

  return (
    <>
      <form ref={formRef} action={formAction} className="adm-panel grid gap-4 p-5">
        {tag ? <input type="hidden" name="tagId" value={tag.id} /> : null}
        <div
          className="flex flex-wrap items-start justify-between gap-4 pb-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <p className="adm-section-tag">{tag ? "[ EDIT TAG ]" : "[ NEW TAG ]"}</p>
            <h2 className="adm-title-sm mt-2">{tag?.name ?? "Create tag"}</h2>
          </div>
          <button
            type="button"
            className="adm-btn-primary"
            disabled={isPending}
            onClick={() => setConfirmOpen(true)}
          >
            {isPending ? "Saving..." : "Save tag"}
          </button>
        </div>

        <AuthMessage error={state.error} success={state.success} />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="adm-label">Name</span>
            <input
              name="name"
              value={nameValue}
              onChange={(event) => updateName(event.target.value)}
              className="adm-field"
            />
          </label>
          <label className="grid gap-2">
            <span className="adm-label">Slug</span>
            <input
              name="slug"
              value={slugValue}
              onChange={(event) => updateSlug(event.target.value)}
              className="adm-field"
            />
          </label>
        </div>

        <div
          className="flex flex-wrap items-center justify-between gap-3 pt-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          {tag ? (
            <button type="button" className="adm-btn-danger" onClick={() => setDeleteOpen(true)}>
              Delete tag
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="adm-btn-primary"
            disabled={isPending}
            onClick={() => setConfirmOpen(true)}
          >
            {isPending ? "Saving..." : "Save tag"}
          </button>
        </div>
      </form>

      <AdminConfirmModal
        open={confirmOpen}
        title={tag ? `Save tag ${tag.name}` : "Create tag"}
        description="This changes tag data used by product assignment and storefront filtering. Slug changes can affect tag URLs and active filters."
        confirmLabel={tag ? "Save tag" : "Create tag"}
        pending={isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => formRef.current?.requestSubmit()}
      />

      <AdminConfirmModal
        open={deleteOpen}
        title={`Delete tag ${tag?.name ?? ""}`}
        description="This removes the tag permanently and detaches it from every product that currently uses it. Product records stay intact, but tag-based filtering changes immediately."
        confirmLabel="Delete tag"
        tone="danger"
        pending={isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={deleteAction}
      />
    </>
  );
}

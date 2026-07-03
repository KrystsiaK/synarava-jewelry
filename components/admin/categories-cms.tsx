"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  deleteCategoryAction,
  saveCategoryAction,
  type CategoryActionState,
  type SavedCategoryPayload,
} from "@/app/admin/actions";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { AdminRecordDates, AdminRecordMetaModal } from "@/components/admin/admin-record-meta";
import { slugifyForAdmin } from "@/components/admin/slug-utils";
import { useAdminToast } from "@/components/admin/admin-toast";
import { AuthMessage } from "@/components/auth/auth-form-primitives";

export function CategoriesTable({
  categories,
}: {
  categories: SavedCategoryPayload[];
}) {
  const [query, setQuery] = useState("");
  const [editingCategory, setEditingCategory] = useState<SavedCategoryPayload | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      categories.filter((category) =>
        [category.name, category.slug, category.description ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      ),
    [categories, normalizedQuery],
  );

  return (
    <section className="adm-panel p-5">
      <div
        className="flex flex-col gap-3 pb-4 md:flex-row md:items-end md:justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div>
          <p className="adm-section-tag">[ TAXONOMY // CATEGORIES ]</p>
          <h2 className="adm-title-sm mt-2">Categories table</h2>
        </div>
        <Link href="/admin/categories/new" className="adm-btn-primary">
          New category
        </Link>
      </div>

      <label className="mt-4 grid gap-2 md:max-w-md">
        <span className="adm-label">Search</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, slug, description"
          className="adm-field"
        />
      </label>

      <div className="mt-4 grid gap-2">
        {filtered.length > 0 ? (
          filtered.map((category) => (
            <div
              key={category.id}
              className="grid grid-cols-[minmax(0,1fr)_4rem_auto] items-center gap-3 p-3"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--adm-ink)" }}>
                  {category.name}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--adm-muted)" }}>
                  /{category.slug}
                </p>
                <AdminRecordDates record={category} />
              </div>
              <span className="text-xs font-semibold" style={{ color: "var(--adm-muted)" }}>
                {category.sortOrder}
              </span>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="adm-btn-primary py-1 px-2 text-[0.58rem]"
                  onClick={() => setEditingCategory(category)}
                >
                  Details
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="adm-copy py-6">No categories match the current search.</p>
        )}
      </div>

      <AdminRecordMetaModal
        open={Boolean(editingCategory)}
        title={editingCategory?.name ?? "Category"}
        subtitle={editingCategory ? `/${editingCategory.slug}` : undefined}
        href={editingCategory ? `/admin/categories/${editingCategory.id}` : "/admin/categories"}
        entityType="CATEGORY"
        entityId={editingCategory?.id ?? ""}
        record={editingCategory}
        onClose={() => setEditingCategory(null)}
      />
    </section>
  );
}

export function CategoryEditor({ category }: { category?: SavedCategoryPayload }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<CategoryActionState>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nameValue, setNameValue] = useState(category?.name ?? "");
  const [slugValue, setSlugValue] = useState(category?.slug ?? "");
  const [slugLocked, setSlugLocked] = useState(Boolean(category?.slug));
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useAdminToast();

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
      const result = await saveCategoryAction(formData);
      setState(result);
      setConfirmOpen(false);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.category) {
        router.push(`/admin/categories/${result.category.id}`);
        router.refresh();
      }
    });
  }

  function deleteAction() {
    if (!category) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("categoryId", category.id);
      const result = await deleteCategoryAction(formData);
      setState(result);
      setDeleteOpen(false);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.deletedCategoryId) {
        router.push("/admin/categories");
        router.refresh();
      }
    });
  }

  return (
    <>
      <form ref={formRef} action={formAction} className="adm-panel grid gap-4 p-5">
        {category ? <input type="hidden" name="categoryId" value={category.id} /> : null}
        <div
          className="flex flex-wrap items-start justify-between gap-4 pb-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <p className="adm-section-tag">
              {category ? "[ EDIT CATEGORY ]" : "[ NEW CATEGORY ]"}
            </p>
            <h2 className="adm-title-sm mt-2">{category?.name ?? "Create category"}</h2>
          </div>
          <button
            type="button"
            className="adm-btn-primary"
            disabled={isPending}
            onClick={() => setConfirmOpen(true)}
          >
            {isPending ? "Saving..." : "Save category"}
          </button>
        </div>

        <AuthMessage error={state.error} />

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

        <label className="grid gap-2 md:max-w-xs">
          <span className="adm-label">Sort order</span>
          <input
            name="sortOrder"
            type="number"
            defaultValue={category?.sortOrder ?? 0}
            className="adm-field"
          />
        </label>

        <label className="grid gap-2">
          <span className="adm-label">Description</span>
          <textarea
            name="description"
            rows={4}
            defaultValue={category?.description ?? ""}
            className="adm-field"
          />
        </label>

        <div
          className="flex flex-wrap items-center justify-between gap-3 pt-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          {category ? (
            <button type="button" className="adm-btn-danger" onClick={() => setDeleteOpen(true)}>
              Delete category
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
            {isPending ? "Saving..." : "Save category"}
          </button>
        </div>
      </form>

      <AdminConfirmModal
        open={confirmOpen}
        title={category ? `Save category ${category.name}` : "Create category"}
        description="This changes category data used by product assignment and storefront filtering. Slug changes can affect category URLs and active filters."
        confirmLabel={category ? "Save category" : "Create category"}
        pending={isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => formRef.current?.requestSubmit()}
      />

      <AdminConfirmModal
        open={deleteOpen}
        title={`Delete category ${category?.name ?? ""}`}
        description="This removes the category permanently. Products using it will stay in the catalog but become uncategorized, which can affect filters and storefront navigation."
        confirmLabel="Delete category"
        tone="danger"
        pending={isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={deleteAction}
      />
    </>
  );
}

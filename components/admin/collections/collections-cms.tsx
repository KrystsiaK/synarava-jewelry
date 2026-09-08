"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import {
  deleteCollectionAction,
  moveCollectionOrderAction,
  updateCollectionStatusAction,
  type CollectionActionState,
} from "@/app/admin/actions/collections";
import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import { AdminHelp } from "@/components/admin/shared/admin-help";
import { AdminRecordDates, AdminRecordMetaModal } from "@/components/admin/shared/admin-record-meta";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import {
  collectionActionCopy,
  collectionStatusLabel,
  normalizeCollections,
} from "@/components/admin/collections/collection-helpers";
import type { AdminCollection, CollectionRowAction } from "@/components/admin/collections/collection-types";

const initialState: CollectionActionState = {};

export function CollectionsCms({ collections }: { collections: AdminCollection[] }) {
  const [items, setItems] = useState(() => normalizeCollections(collections));
  const [rowAction, setRowAction] = useState<CollectionRowAction | null>(null);
  const [editingCollection, setEditingCollection] = useState<AdminCollection | null>(null);
  const [rowState, setRowState] = useState<CollectionActionState>(initialState);
  const [isPending, startTransition] = useTransition();
  const modalCopy = rowAction ? collectionActionCopy(rowAction) : null;
  const { pushToast } = useAdminToast();

  function handleUpdated(collection: AdminCollection) {
    setItems((current) =>
      normalizeCollections(
        current.map((item) => (item.id === collection.id ? collection : item)),
      ),
    );
  }

  function handleDeleted(collectionId: string) {
    setItems((current) => current.filter((item) => item.id !== collectionId));
  }

  function runRowAction() {
    if (!rowAction) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.set("collectionId", rowAction.collection.id);

      if (rowAction.action === "delete") {
        formData.set("collectionSlug", rowAction.collection.slug);
        const result = await deleteCollectionAction(initialState, formData);
        setRowState(result);
        if (result.error) pushToast({ message: result.error, tone: "error" });
        if (result.success) pushToast({ message: result.success, tone: "success" });
        if (result.deletedCollectionId) {
          handleDeleted(result.deletedCollectionId);
        }
      } else {
        formData.set("action", rowAction.action);
        const result = await updateCollectionStatusAction(initialState, formData);
        setRowState(result);
        if (result.error) pushToast({ message: result.error, tone: "error" });
        if (result.success) pushToast({ message: result.success, tone: "success" });
        if (result.collection) {
          handleUpdated(result.collection);
        }
      }

      setRowAction(null);
    });
  }

  function moveCollection(collection: AdminCollection, direction: "up" | "down") {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("collectionId", collection.id);
      formData.set("direction", direction);

      const result = await moveCollectionOrderAction(initialState, formData);
      setRowState(result);
      if (result.collections) {
        setItems(normalizeCollections(result.collections));
      }
    });
  }

  return (
    <div className="space-y-8">
      <section className="adm-panel p-5">
        <div
          className="flex flex-col gap-3 pb-4 mb-1 md:flex-row md:items-end md:justify-between"
          style={{ borderBottom: "1px solid var(--adm-border)" }}
        >
          <div>
            <p className="adm-section-tag">[ CURRENT COLLECTIONS ]</p>
            <h2 className="adm-title-sm mt-2">Collections table</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/collections/new" className="adm-btn-primary">
              New collection
            </Link>
            <AdminHelp label="Collection editing guidance" align="end">
              New collection opens the create route. Details opens the collection edit route. Draft, Publish, and Archive change storefront visibility. Delete removes the record.
            </AdminHelp>
          </div>
        </div>
        <AuthMessage error={rowState.error} />

        <div className="mt-5 grid gap-2">
          {items.length > 0 ? (
            items.map((collection, index) => {
              const status = collectionStatusLabel(collection);

              return (
                <div
                  key={collection.id}
                  className="grid gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_auto_auto_minmax(19rem,auto)] xl:items-center"
                  style={{
                    border: "1px solid var(--adm-border)",
                  }}
                >
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--adm-ink)" }}>
                      {collection.name}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--adm-muted)" }}>
                      /{collection.slug}
                    </p>
                    <AdminRecordDates record={collection} />
                  </div>
                  <span className={status === "PUBLISHED" ? "adm-badge-published" : "adm-badge-draft"}>
                    {status}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="adm-btn-ghost py-1 px-2 text-[0.7rem]"
                      aria-label={`Move ${collection.name} up`}
                      disabled={isPending || index === 0}
                      onClick={() => moveCollection(collection, "up")}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="adm-btn-ghost py-1 px-2 text-[0.7rem]"
                      aria-label={`Move ${collection.name} down`}
                      disabled={isPending || index === items.length - 1}
                      onClick={() => moveCollection(collection, "down")}
                    >
                      ↓
                    </button>
                  </div>
                  <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                    <button
                      type="button"
                      className="adm-btn-primary py-1 px-2 text-[0.58rem]"
                      onClick={() => setEditingCollection(collection)}
                    >
                      Details
                    </button>
                    {status === "PUBLISHED" ? (
                      <button
                        type="button"
                        className="adm-btn-ghost py-1 px-2 text-[0.58rem]"
                        onClick={() => setRowAction({ collection, action: "draft" })}
                      >
                        Draft
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="adm-btn-ghost py-1 px-2 text-[0.58rem]"
                        onClick={() => setRowAction({ collection, action: "publish" })}
                        disabled={status === "ARCHIVED"}
                      >
                        Publish
                      </button>
                    )}
                    {status === "ARCHIVED" ? (
                      <button
                        type="button"
                        className="adm-btn-ghost py-1 px-2 text-[0.58rem]"
                        onClick={() => setRowAction({ collection, action: "draft" })}
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="adm-btn-ghost py-1 px-2 text-[0.58rem]"
                        onClick={() => setRowAction({ collection, action: "archive" })}
                      >
                        Archive
                      </button>
                    )}
                    <button
                      type="button"
                      className="adm-btn-danger py-1 px-2 text-[0.58rem]"
                      onClick={() => setRowAction({ collection, action: "delete" })}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm leading-6" style={{ color: "var(--adm-muted)" }}>
              No collections yet. Create your first collection using New collection.
            </p>
          )}
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
        open={Boolean(editingCollection)}
        title={editingCollection?.name ?? "Collection"}
        subtitle={editingCollection ? `/${editingCollection.slug}` : undefined}
        href={
          editingCollection
            ? `/admin/collections/${editingCollection.id}`
            : "/admin/collections"
        }
        entityType="COLLECTION"
        entityId={editingCollection?.id ?? ""}
        record={editingCollection}
        onClose={() => setEditingCollection(null)}
      />
    </div>
  );
}

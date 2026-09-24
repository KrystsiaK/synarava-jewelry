"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Archive,
  ChevronDown,
  ChevronUp,
  FilePenLine,
  Info,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";

import {
  deleteCollectionAction,
  moveCollectionOrderAction,
  updateCollectionStatusAction,
  type CollectionActionState,
} from "@/app/admin/actions/collections";
import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";
import { AdminRecordDates, AdminRecordMetaModal } from "@/components/admin/shared/admin-record-meta";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import {
  collectionActionCopy,
  collectionStatusLabel,
  normalizeCollections,
} from "@/components/admin/collections/collection-helpers";
import type { AdminCollection, CollectionRowAction } from "@/components/admin/collections/collection-types";
import {
  AdminEntityList,
  AdminHelp,
  AdminIconButton,
  AdminListWorkspace,
  AdminStatusBadge,
} from "@/components/synarava-cms";

const initialState: CollectionActionState = {};
const COLLECTION_GRID = "xl:grid-cols-[minmax(0,1.6fr)_5.5rem_5rem_9rem]";

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
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.collections) {
        setItems(normalizeCollections(result.collections));
      }
    });
  }

  return (
    <div data-component="CollectionsCms" className="grid gap-6">
      <AdminListWorkspace.Root>
        <AdminListWorkspace.Header
          tag="[ CURRENT COLLECTIONS ]"
          title="Collections table"
          actions={
            <>
              <Link href="/admin/collections/new" className="adm-btn-primary">
                New collection
              </Link>
              <AdminHelp label="Collection editing guidance" align="end">
                New collection opens the create route. Details opens record history. Draft, Publish, and Archive change site visibility. Delete removes the record.
              </AdminHelp>
            </>
          }
        />
        <AdminListWorkspace.Body>
        <AuthMessage error={rowState.error} />

        <AdminEntityList.Root>
          <AdminEntityList.Header
            gridClassName={COLLECTION_GRID}
            columns={[
              { key: "collection", label: "Collection" },
              { key: "status", label: "Status" },
              { key: "order", label: "Order" },
              { key: "actions", label: "Actions", align: "end" },
            ]}
          />
          {items.length > 0 ? (
            items.map((collection, index) => {
              const status = collectionStatusLabel(collection);

              return (
                <AdminEntityList.Row key={collection.id} gridClassName={COLLECTION_GRID}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: "var(--adm-ink)" }}>
                      {collection.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs" style={{ color: "var(--adm-muted)" }}>
                      /{collection.slug}
                    </p>
                    <AdminRecordDates record={collection} />
                  </div>
                  <AdminStatusBadge status={status} />
                  <div className="flex shrink-0 flex-nowrap items-center gap-1">
                    <AdminIconButton
                      label={`Move ${collection.name} up`}
                      disabled={isPending || index === 0}
                      onClick={() => moveCollection(collection, "up")}
                    >
                      <ChevronUp className="size-3.5" aria-hidden="true" />
                    </AdminIconButton>
                    <AdminIconButton
                      label={`Move ${collection.name} down`}
                      disabled={isPending || index === items.length - 1}
                      onClick={() => moveCollection(collection, "down")}
                    >
                      <ChevronDown className="size-3.5" aria-hidden="true" />
                    </AdminIconButton>
                  </div>
                  <div className="flex shrink-0 flex-nowrap items-center justify-start gap-1 xl:justify-end">
                    <AdminIconButton
                      label="Details"
                      tooltip="Record details and version history"
                      tone="primary"
                      onClick={() => setEditingCollection(collection)}
                    >
                      <Info className="size-3.5" aria-hidden="true" />
                    </AdminIconButton>
                    {status === "PUBLISHED" ? (
                      <AdminIconButton
                        label="Draft"
                        tooltip="Move to draft — hide from the public site"
                        onClick={() => setRowAction({ collection, action: "draft" })}
                      >
                        <FilePenLine className="size-3.5" aria-hidden="true" />
                      </AdminIconButton>
                    ) : (
                      <AdminIconButton
                        label="Publish"
                        tooltip="Publish to the public site"
                        onClick={() => setRowAction({ collection, action: "publish" })}
                        disabled={status === "ARCHIVED"}
                      >
                        <Upload className="size-3.5" aria-hidden="true" />
                      </AdminIconButton>
                    )}
                    {status === "ARCHIVED" ? (
                      <AdminIconButton
                        label="Restore"
                        tooltip="Restore from archive to draft"
                        onClick={() => setRowAction({ collection, action: "draft" })}
                      >
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                      </AdminIconButton>
                    ) : (
                      <AdminIconButton
                        label="Archive"
                        tooltip="Archive — hide from the site but keep the record"
                        onClick={() => setRowAction({ collection, action: "archive" })}
                      >
                        <Archive className="size-3.5" aria-hidden="true" />
                      </AdminIconButton>
                    )}
                    <AdminIconButton
                      label="Delete"
                      tooltip="Permanently delete this collection"
                      tone="danger"
                      onClick={() => setRowAction({ collection, action: "delete" })}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </AdminIconButton>
                  </div>
                </AdminEntityList.Row>
              );
            })
          ) : (
            <AdminEntityList.Empty>
              No collections yet. Create your first collection using New collection.
            </AdminEntityList.Empty>
          )}
        </AdminEntityList.Root>
        </AdminListWorkspace.Body>
      </AdminListWorkspace.Root>

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

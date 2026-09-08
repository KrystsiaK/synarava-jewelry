"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";

import {
  deleteCollectionAction,
  saveCollectionAction,
  type CollectionActionState,
} from "@/app/admin/actions/collections";
import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import { AdminHelp } from "@/components/admin/shared/admin-help";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { CollectionFields } from "@/components/admin/collections/collection-fields";
import {
  collectionToDraft,
  generateCollectionCode,
  submitLabel,
} from "@/components/admin/collections/collection-helpers";
import type { AdminCollection, CollectionDraft } from "@/components/admin/collections/collection-types";

const initialState: CollectionActionState = {};

function DeleteCollectionForm({
  collectionId,
  collectionSlug,
  onDeleted,
}: {
  collectionId: string;
  collectionSlug: string;
  onDeleted?: (collectionId: string) => void;
}) {
  const [state, setState] = useState<CollectionActionState>(initialState);
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { pushToast } = useAdminToast();

  async function handleDelete(formData: FormData) {
    startTransition(async () => {
      const nextState = await deleteCollectionAction(initialState, formData);
      setState(nextState);
      setConfirmOpen(false);
      if (nextState.error) pushToast({ message: nextState.error, tone: "error" });
      if (nextState.success) pushToast({ message: nextState.success, tone: "success" });
      if (nextState.deletedCollectionId) {
        onDeleted?.(nextState.deletedCollectionId);
      }
    });
  }

  return (
    <>
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={isPending}
          className="adm-btn-danger"
        >
          {submitLabel("Delete collection", isPending, "Deleting...")}
        </button>
        <AuthMessage error={state.error} />
      </div>
      <AdminConfirmModal
        open={confirmOpen}
        title={`Permanently delete ${collectionSlug}`}
        description="This permanently removes the collection and its sections. Products are not deleted, but they lose this collection assignment, which affects collection pages and storefront filters. Prefer Archive unless you are certain."
        confirmLabel="Delete permanently"
        tone="danger"
        pending={isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          const formData = new FormData();
          formData.set("collectionId", collectionId);
          formData.set("collectionSlug", collectionSlug);
          void handleDelete(formData);
        }}
      />
    </>
  );
}

export function EditCollectionForm({
  collection,
  onUpdated,
  onDeleted,
}: {
  collection: AdminCollection;
  onUpdated?: (collection: AdminCollection) => void;
  onDeleted?: (collectionId: string) => void;
}) {
  const [state, setState] = useState<CollectionActionState>(initialState);
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draft, setDraft] = useState<CollectionDraft>(() => collectionToDraft(collection));
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputKey = collection.heroImageUrl ?? collection.id;
  const { pushToast } = useAdminToast();
  const [codeLocked, setCodeLocked] = useState(Boolean(collection.code?.trim()));

  async function formAction(formData: FormData) {
    startTransition(async () => {
      const nextState = await saveCollectionAction(initialState, formData);
      setState(nextState);
      setConfirmOpen(false);
      if (nextState.error) pushToast({ message: nextState.error, tone: "error" });
      if (nextState.success) pushToast({ message: nextState.success, tone: "success" });
      if (nextState.collection) {
        onUpdated?.(nextState.collection);
      }
    });
  }

  function updateDraft<K extends keyof CollectionDraft>(key: K, value: CollectionDraft[K]) {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "name" && !codeLocked) {
        next.code = generateCollectionCode(String(value));
      }
      if (key === "code") {
        const normalizedValue = String(value).trim();
        if (!normalizedValue) {
          next.code = generateCollectionCode(current.name);
        }
      }
      return next;
    });
  }

  return (
    <>
      <div className="adm-panel grid gap-4 p-5">
        <div
          className="flex flex-wrap items-start justify-between gap-4 pb-4"
          style={{ borderBottom: "1px solid var(--adm-border)" }}
        >
          <div>
            <p className="adm-section-tag">[ EDIT COLLECTION ]</p>
            <h2 className="adm-title-sm mt-2">{collection.name}</h2>
            <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>
              /{collection.slug}
            </p>
          </div>
          <Link href={`/collections/${collection.slug}`} className="adm-btn-ghost">
            Open page
          </Link>
        </div>
        <AuthMessage error={state.error} />
        <div>
          <AdminHelp label="Save guidance">
            Fields marked with * are required. Drafts stay in the form until a save succeeds.
          </AdminHelp>
        </div>

        <form ref={formRef} action={formAction} className="grid gap-4">
          <input type="hidden" name="collectionId" value={collection.id} />
          <input
            type="hidden"
            name="existingHeroImageUrl"
            value={collection.heroImageUrl ?? ""}
          />

          <CollectionFields
            draft={draft}
            onChange={(key, value) => {
              if (key === "code") setCodeLocked(Boolean(String(value).trim()));
              updateDraft(key, value);
            }}
            fieldErrors={state.fieldErrors}
            currentHeroImageUrl={collection.heroImageUrl}
            currentHeroImageLabel={collection.name}
            fileInputKey={fileInputKey}
          />

          <div>
            <AdminHelp label="Publishing guidance">
              Draft collections stay private. Published collections become public on the collections index and their own detail page.
            </AdminHelp>
          </div>

          <div
            className="flex flex-wrap items-center justify-between gap-4 py-5"
            style={{
              borderTop: "1px solid var(--adm-border)",
              borderBottom: "1px solid var(--adm-border)",
            }}
          >
            <div className="flex items-center">
              <DeleteCollectionForm
                collectionId={collection.id}
                collectionSlug={collection.slug}
                onDeleted={onDeleted}
              />
            </div>
            <button
              type="button"
              disabled={isPending}
              className="adm-btn-primary"
              onClick={() => setConfirmOpen(true)}
            >
              {submitLabel("Update collection", isPending, "Saving...")}
            </button>
          </div>
        </form>
      </div>
      <AdminConfirmModal
        open={confirmOpen}
        title={`Save ${collection.name}`}
        description="This writes collection content and publishing state to the database. If the collection is Published, the public collection page and filters can update immediately."
        confirmLabel="Save collection"
        pending={isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </>
  );
}

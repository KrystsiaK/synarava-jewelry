"use client";

import { useRef, useState, useTransition } from "react";

import {
  autosaveCollectionDraftAction,
  saveCollectionAction,
  type CollectionActionState,
} from "@/app/admin/actions/collections";
import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import { AdminHelp } from "@/components/admin/shared/admin-help";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { useDraftAutosave } from "@/components/admin/shared/use-draft-autosave";
import { slugify } from "@/lib/text/slug";
import { CollectionFields } from "@/components/admin/collections/collection-fields";
import {
  emptyCollectionDraft,
  generateCollectionCode,
  submitLabel,
} from "@/components/admin/collections/collection-helpers";
import type { AdminCollection, CollectionDraft } from "@/components/admin/collections/collection-types";

const initialState: CollectionActionState = {};

export function CreateCollectionForm({ onCreated }: { onCreated?: (collection: AdminCollection) => void }) {
  const [state, setState] = useState<CollectionActionState>(initialState);
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draftId, setDraftId] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [slugLocked, setSlugLocked] = useState(false);
  const [codeLocked, setCodeLocked] = useState(false);
  const [draft, setDraft] = useState<CollectionDraft>(emptyCollectionDraft);
  const { pushToast } = useAdminToast();

  useDraftAutosave({
    formRef,
    saveDraft: autosaveCollectionDraftAction,
    recordIdField: "collectionId",
    onSaved: (result) => {
      if (result.recordId) setDraftId(result.recordId);
    },
  });

  async function formAction(formData: FormData) {
    startTransition(async () => {
      const nextState = await saveCollectionAction(initialState, formData);
      setState(nextState);
      setConfirmOpen(false);
      if (nextState.error) pushToast({ message: nextState.error, tone: "error" });
      if (nextState.success) pushToast({ message: nextState.success, tone: "success" });

      if (nextState.collection) {
        onCreated?.(nextState.collection);
      }

      if (nextState.success && nextState.collection) {
        setDraft(emptyCollectionDraft());
        setSlugLocked(false);
        setCodeLocked(false);
        setFileInputKey((current) => current + 1);
        formRef.current?.reset();
      }
    });
  }

  function updateDraft<K extends keyof CollectionDraft>(key: K, value: CollectionDraft[K]) {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "name" && !slugLocked) {
        next.slug = slugify(String(value));
      }
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
      <form ref={formRef} action={formAction} className="adm-panel grid gap-4 p-5">
        <input type="hidden" name="collectionId" value={draftId} />
        <div
          className="flex items-center justify-between gap-4 pb-4"
          style={{ borderBottom: "1px solid var(--adm-border)" }}
        >
          <div>
            <p className="adm-section-tag">[ NEW COLLECTION ]</p>
            <div className="adm-label-row mt-2">
              <h2 className="adm-title-sm">
                Create collection
              </h2>
              <AdminHelp label="Collection fields guidance">
                Name and summary feed the collection card and hero. The collection eyebrow and numbering are generated automatically from sort order. Hero image replaces current media only when a file is selected. Manifesto and symbolism defaults shape the public collection story. State controls draft versus published visibility.
              </AdminHelp>
            </div>
          </div>
          <button
            type="button"
            disabled={isPending}
            className="adm-btn-primary"
            onClick={() => setConfirmOpen(true)}
          >
            {submitLabel("Save collection", isPending, "Saving...")}
          </button>
        </div>

        <AuthMessage error={state.error} />
        <div>
          <AdminHelp label="Save guidance">
            Fields marked with * are required. Drafts stay in the form until a save succeeds.
          </AdminHelp>
        </div>

        <CollectionFields
          draft={draft}
          onChange={(key, value) => {
            if (key === "slug") setSlugLocked(Boolean(String(value).trim()));
            if (key === "code") setCodeLocked(Boolean(String(value).trim()));
            updateDraft(key, value);
          }}
          fieldErrors={state.fieldErrors}
          fileInputKey={fileInputKey}
        />
      </form>
      <AdminConfirmModal
        open={confirmOpen}
        title="Create collection"
        description="This creates a new collection record. If its state is Published, it may appear on the public collections index and become available for product grouping immediately."
        confirmLabel="Create collection"
        pending={isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </>
  );
}

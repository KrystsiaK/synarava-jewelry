"use client";

import { useRef, useState, useTransition } from "react";
import { HardDriveUpload, RefreshCw } from "lucide-react";

import {
  autosaveCollectionDraftAction,
  saveCollectionAction,
  type CollectionActionState,
} from "@/app/admin/actions/collections";
import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";
import { AdminAlert, AdminHelp, AdminIconButton, AdminListWorkspace } from "@/components/synarava-cms";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { submitFormAfterConfirmClose } from "@/components/admin/shared/submit-after-confirm";
import { useCollectionFormValidation } from "@/components/admin/collections/use-collection-form-validation";
import { useDraftAutosave } from "@/components/admin/shared/use-draft-autosave";
import { slugify } from "@/lib/text/slug";
import { CollectionFields, CollectionLocaleProvider, CollectionLocaleTabs } from "@/components/admin/collections/collection-fields";
import {
  emptyCollectionDraft,
  generateCollectionCode,
} from "@/components/admin/collections/collection-helpers";
import type { AdminCollection, CollectionDraft } from "@/components/admin/collections/collection-types";
import type { AdminTranslationLocale } from "@/lib/i18n/admin-translation-locales";

const initialState: CollectionActionState = {};

export function CreateCollectionForm({
  translationLocales = [{ code: "pt", label: "Português" }],
  onCreated,
}: {
  translationLocales?: AdminTranslationLocale[];
  onCreated?: (collection: AdminCollection) => void;
}) {
  const [state, setState] = useState<CollectionActionState>(initialState);
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draftId, setDraftId] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const validation = useCollectionFormValidation(formRef);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [slugLocked, setSlugLocked] = useState(false);
  const [codeLocked, setCodeLocked] = useState(false);
  const translationLocaleCodes = translationLocales.map((locale) => locale.code);
  const [draft, setDraft] = useState<CollectionDraft>(() => emptyCollectionDraft(translationLocaleCodes));
  const { pushToast } = useAdminToast();

  useDraftAutosave({
    formRef,
    saveDraft: autosaveCollectionDraftAction,
    onError: () => pushToast({ message: "Draft could not be saved. Please try again.", tone: "error" }),
    recordIdField: "collectionId",
    onSaved: (result) => {
      if (result.recordId) setDraftId(result.recordId);
      if (result.error) pushToast({ message: result.error, tone: "error" });
    },
  });

  async function formAction(formData: FormData) {
    startTransition(async () => {
      const nextState = await saveCollectionAction(initialState, formData);
      setState(nextState);
      setConfirmOpen(false);
      validation.showFieldErrors(nextState.fieldErrors ?? {});
      if (nextState.error) pushToast({ message: nextState.error, tone: "error" });
      if (nextState.success) pushToast({ message: nextState.success, tone: "success" });

      if (nextState.collection) {
        onCreated?.(nextState.collection);
      }

      if (nextState.success && nextState.collection) {
        setDraft(emptyCollectionDraft(translationLocaleCodes));
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
      <CollectionLocaleProvider
        draft={draft}
        translationLocales={translationLocales}
        fieldErrors={validation.fieldErrors}
      >
        <form ref={formRef} action={formAction} noValidate>
          <input type="hidden" name="collectionId" value={draftId} />
          <AdminListWorkspace.Root>
            <AdminListWorkspace.Header
              tag="[ NEW COLLECTION ]"
              title={
                <span className="adm-label-row">
                  Create collection
                  <AdminHelp label="Collection fields guidance">
                    Name and summary feed the collection card and hero. The collection eyebrow and numbering are generated automatically from sort order. Hero image replaces current media only when a file is selected. Manifesto and symbolism defaults shape the public collection story. State controls draft versus published visibility.
                  </AdminHelp>
                </span>
              }
              actions={
                <AdminIconButton
                  label={isPending ? "Saving collection" : "Save collection"}
                  tooltip={
                    isPending
                      ? "Saving collection…"
                      : "Save collection locally. Fields marked with * are required."
                  }
                  disabled={isPending}
                  onClick={() => validation.requestConfirm(() => setConfirmOpen(true))}
                >
                  {isPending ? (
                    <RefreshCw className="size-3.5 animate-spin" strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <HardDriveUpload className="size-3.5" strokeWidth={2} aria-hidden="true" />
                  )}
                </AdminIconButton>
              }
            >
              <CollectionLocaleTabs embedded />
            </AdminListWorkspace.Header>
            <AdminListWorkspace.Body className="grid gap-4">
              <AdminAlert message={state.error} />
              <CollectionFields
                draft={draft}
                onChange={(key, value) => {
                  if (key === "slug") setSlugLocked(Boolean(String(value).trim()));
                  if (key === "code") setCodeLocked(Boolean(String(value).trim()));
                  updateDraft(key, value);
                }}
                onChangeTranslation={(locale, key, value) => setDraft((current) => ({
                  ...current,
                  translations: { ...current.translations, [locale]: { ...current.translations[locale], [key]: value } },
                }))}
                fieldErrors={validation.fieldErrors}
                onFieldEdit={validation.clearFieldError}
                fileInputKey={fileInputKey}
                translationLocales={translationLocales}
              />
            </AdminListWorkspace.Body>
          </AdminListWorkspace.Root>
        </form>
      </CollectionLocaleProvider>
      <AdminConfirmModal
        open={confirmOpen}
        title="Create collection"
        description="This creates a new collection record. If its state is Published, it may appear on the public collections index and become available for product grouping immediately."
        confirmLabel="Create collection"
        pending={isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => submitFormAfterConfirmClose(formRef.current, () => setConfirmOpen(false))}
      />
    </>
  );
}

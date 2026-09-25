"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";

import {
  deleteCollectionAction,
  saveCollectionAction,
  type CollectionActionState,
} from "@/app/admin/actions/collections";
import {
  checkOneCollectionConflictsAction,
} from "@/app/admin/actions/sync";
import { AdminIssueInlineWarning } from "@/components/admin/issues/admin-issues-cms";
import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";
import type { AdminIssueSummary } from "@/components/admin/shared/admin-issue-types";
import { scrollAdminFieldIntoView } from "@/components/admin/shared/scroll-admin-field";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import { AdminHelp } from "@/components/admin/shared/admin-help";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { CatalogConflictStatus } from "@/components/admin/products/catalog-conflict-signals";
import { CollectionConflictWorkspace, type CollectionConflictViewScope } from "@/components/admin/collections/collection-conflict-workspace";
import { CollectionFields } from "@/components/admin/collections/collection-fields";
import {
  collectionToDraft,
  generateCollectionCode,
  submitLabel,
} from "@/components/admin/collections/collection-helpers";
import type { AdminCollection, CollectionDraft, CollectionLocaleDraft } from "@/components/admin/collections/collection-types";
import type { AdminTranslationLocale } from "@/lib/i18n/admin-translation-locales";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

const initialState: CollectionActionState = {};
const EMPTY_SIGNALS: CatalogConflictSignals = {
  state: "stale",
  totalCount: 0,
  checkedAt: null,
  products: {},
  recentlyUpdatedProducts: {},
};
const ENTITY_NOUN = { singular: "collection", plural: "collections" } as const;

function openIssues(issues: AdminIssueSummary[]) {
  return issues.filter((issue) => issue.status === "OPEN");
}

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
        description="This permanently removes the collection and its sections. Products are not deleted, but they lose this collection assignment, which affects collection pages and site filters. Prefer Archive unless you are certain."
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
  translationLocales = [{ code: "pt", label: "Português" }],
  issues = [],
  initialConflictSignals = EMPTY_SIGNALS,
  onUpdated,
  onDeleted,
}: {
  collection: AdminCollection;
  translationLocales?: AdminTranslationLocale[];
  issues?: AdminIssueSummary[];
  initialConflictSignals?: CatalogConflictSignals;
  onUpdated?: (collection: AdminCollection) => void;
  onDeleted?: (collectionId: string) => void;
}) {
  const [state, setState] = useState<CollectionActionState>(initialState);
  const [isPending, startTransition] = useTransition();
  const [isConflictCheckPending, startConflictCheckTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [conflictListOpen, setConflictListOpen] = useState(false);
  const [conflictViewScope, setConflictViewScope] = useState<CollectionConflictViewScope>({
    kind: "collection",
    collectionId: collection.id,
  });
  const [conflictSignals, setConflictSignals] = useState(initialConflictSignals);
  const [draft, setDraft] = useState<CollectionDraft>(() => collectionToDraft(collection, translationLocales.map((l) => l.code)));
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputKey = collection.heroImageUrl ?? collection.id;
  const { pushToast } = useAdminToast();
  const [codeLocked, setCodeLocked] = useState(Boolean(collection.code?.trim()));
  const visibleIssues = openIssues(issues);
  const collectionConflict = conflictSignals.products[collection.id];

  useEffect(() => {
    setConflictSignals(initialConflictSignals);
  }, [initialConflictSignals]);

  useEffect(() => {
    setConflictViewScope({ kind: "collection", collectionId: collection.id });
  }, [collection.id]);

  useEffect(() => {
    function openFieldForHash() {
      const fieldId = window.location.hash.slice(1);
      if (!fieldId) return;
      window.requestAnimationFrame(() => scrollAdminFieldIntoView(fieldId));
    }

    openFieldForHash();
    window.addEventListener("hashchange", openFieldForHash);
    return () => window.removeEventListener("hashchange", openFieldForHash);
  }, []);

  function activateIssue(issue: AdminIssueSummary) {
    const nextHash = `#${issue.fieldPath}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
    window.requestAnimationFrame(() => scrollAdminFieldIntoView(issue.fieldPath));
  }

  function handleConflictCheck() {
    startConflictCheckTransition(async () => {
      const result = await checkOneCollectionConflictsAction({ collectionId: collection.id });
      if (!("signals" in result)) {
        pushToast({ message: result.error, tone: "error" });
        return;
      }
      setConflictSignals(result.signals);
      if (result.warning) pushToast({ message: result.warning, tone: "info" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if ((result.signals.products[collection.id])) {
        setConflictViewScope({ kind: "collection", collectionId: collection.id });
        setConflictListOpen(true);
      }
    });
  }

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

  function updateDraftTranslation<K extends keyof CollectionLocaleDraft>(locale: string, key: K, value: CollectionLocaleDraft[K]) {
    setDraft((current) => ({
      ...current,
      translations: { ...current.translations, [locale]: { ...current.translations[locale], [key]: value } },
    }));
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
          <div className="flex flex-wrap items-center gap-2">
            <CatalogConflictStatus
              signals={conflictSignals}
              onShow={() => {
                setConflictViewScope({ kind: "collection", collectionId: collection.id });
                setConflictListOpen(true);
              }}
              onCheck={handleConflictCheck}
              checking={isConflictCheckPending}
              compact={Boolean(collectionConflict)}
              entityNoun={ENTITY_NOUN}
            />
            <Link href={`/collections/${collection.slug}`} className="adm-btn-ghost">
              Open page
            </Link>
          </div>
        </div>
        <AuthMessage error={state.error} />
        {visibleIssues.length > 0 ? (
          <AdminIssueInlineWarning issues={visibleIssues} onIssueActivate={activateIssue} />
        ) : null}
        <div>
          <AdminHelp label="Save guidance">
            Fields marked with * are required. Drafts stay in the form until a save succeeds. After save, a scoped Shopify conflict check refreshes the conflict signal for this collection.
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
            onChangeTranslation={updateDraftTranslation}
            fieldErrors={state.fieldErrors}
            currentHeroImageUrl={collection.heroImageUrl}
            currentHeroImageLabel={collection.name}
            fileInputKey={fileInputKey}
            entityId={collection.id}
            translationLocales={translationLocales}
            issues={visibleIssues}
          />

          <div
            className="flex flex-wrap items-center justify-between gap-4 py-5"
            style={{
              borderTop: "1px solid var(--adm-border)",
              borderBottom: "1px solid var(--adm-border)",
            }}
          >
            <div className="flex items-center gap-2">
              <DeleteCollectionForm
                collectionId={collection.id}
                collectionSlug={collection.slug}
                onDeleted={onDeleted}
              />
              <AdminHelp label="Delete guidance">
                Delete permanently removes this collection record and its sections. It does not change Draft or Published site state — use Site state above for that. Products stay in the catalog but lose this collection assignment.
              </AdminHelp>
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
        description={
          draft.workflowState === "DRAFT"
            ? "This writes collection content and publishing state. Saving as Draft hides the collection and moves its live member products to Draft locally (Shopify commerce status unchanged)."
            : "This writes collection content and publishing state to the database. If the collection is Published, the public collection page and filters can update immediately. Publishing the collection does not auto-publish its products."
        }
        confirmLabel="Save collection"
        pending={isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => formRef.current?.requestSubmit()}
      />
      <CollectionConflictWorkspace
        open={conflictListOpen}
        onClose={() => setConflictListOpen(false)}
        signals={conflictSignals}
        onSignalsChange={setConflictSignals}
        collections={[{ id: collection.id, name: collection.name, slug: collection.slug }]}
        focusedCollectionId={collection.id}
        viewScope={conflictViewScope}
        onToast={(message, tone) => pushToast({ message, tone })}
      />
    </>
  );
}

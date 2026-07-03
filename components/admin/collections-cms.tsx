"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";

import {
  autosaveCollectionDraftAction,
  deleteCollectionAction,
  moveCollectionOrderAction,
  saveCollectionAction,
  updateCollectionStatusAction,
  type CollectionActionState,
  type CollectionFieldName,
  type SavedCollectionPayload,
} from "@/app/admin/actions";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import { AdminHelp } from "@/components/admin/admin-help";
import { AdminRecordDates, AdminRecordMetaModal } from "@/components/admin/admin-record-meta";
import { useAdminToast } from "@/components/admin/admin-toast";
import { ImageFileField } from "@/components/admin/image-file-field";
import { LocaleTabStrip } from "@/components/admin/admin-primitives";
import { slugifyForAdmin } from "@/components/admin/slug-utils";
import { useDraftAutosave } from "@/components/admin/use-draft-autosave";

type AdminCollection = SavedCollectionPayload;

type CollectionDraft = {
  name: string;
  slug: string;
  code: string;
  description: string;
  manifesto: string;
  searchSummary: string;
  symbolismLabel: string;
  symbolismTitle: string;
  symbolismBody: string;
  symbolismBody2: string;
  workflowState: "DRAFT" | "PUBLISHED";
};

const initialState: CollectionActionState = {};

function emptyCollectionDraft(): CollectionDraft {
  return {
    name: "", slug: "", code: "", description: "",
    manifesto: "", searchSummary: "", symbolismLabel: "", symbolismTitle: "",
    symbolismBody: "", symbolismBody2: "", workflowState: "DRAFT",
  };
}

function generateCollectionCode(value: string) {
  const normalized = value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  const joined = words.join("");

  let prefix = "";
  if (words.length >= 2) {
    prefix = `${words[0]?.slice(0, 2) ?? ""}${words[1]?.slice(0, 2) ?? ""}`;
  } else {
    prefix = joined.slice(0, 4);
  }

  const safePrefix = `${prefix}${joined}`.slice(0, 4).padEnd(3, "X");
  const checksum =
    Array.from(joined).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 100;

  return `${safePrefix}-${String(checksum).padStart(2, "0")}`;
}

function normalizeCollections(items: AdminCollection[]) {
  return [...items].sort((left, right) => {
    const orderDiff = (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return left.name.localeCompare(right.name);
  });
}

function workflowStateFromCollection(
  collection: AdminCollection,
): CollectionDraft["workflowState"] {
  return collection.status === "ACTIVE" && collection.visibility === "PUBLIC"
    ? "PUBLISHED"
    : "DRAFT";
}

function collectionStatusLabel(collection: AdminCollection) {
  if (collection.status === "ARCHIVED") return "ARCHIVED";
  return collection.status === "ACTIVE" && collection.visibility === "PUBLIC" ? "PUBLISHED" : "DRAFT";
}

type CollectionRowAction = {
  collection: AdminCollection;
  action: "publish" | "draft" | "archive" | "delete";
};

function collectionActionCopy(target: CollectionRowAction) {
  if (target.action === "publish") {
    return {
      title: `Publish ${target.collection.name}`,
      description:
        "This makes the collection visible on the collections index and its detail page. Products assigned to it may become reachable through collection filters.",
      confirmLabel: "Publish collection",
      tone: "default" as const,
    };
  }
  if (target.action === "draft") {
    return {
      title: `Move ${target.collection.name} to draft`,
      description:
        "This hides the collection page and removes it from public collection lists. Product records remain unchanged.",
      confirmLabel: "Move to draft",
      tone: "default" as const,
    };
  }
  if (target.action === "archive") {
    return {
      title: `Archive ${target.collection.name}`,
      description:
        "This hides the collection and keeps the record available in admin. Products remain in the catalog, but this collection will no longer appear publicly.",
      confirmLabel: "Archive collection",
      tone: "danger" as const,
    };
  }
  return {
    title: `Permanently delete ${target.collection.name}`,
    description:
      "This permanently removes the collection and its collection sections. Products are not deleted, but their link to this collection is removed, which affects collection pages and filters. Prefer Archive unless you are certain.",
    confirmLabel: "Delete permanently",
    tone: "danger" as const,
  };
}

function collectionToDraft(collection: AdminCollection): CollectionDraft {
  return {
    name: collection.name,
    slug: collection.slug,
    code: collection.code ?? "",
    description: collection.description ?? "",
    manifesto: collection.manifesto ?? "",
    searchSummary: collection.searchSummary ?? "",
    symbolismLabel: collection.symbolismLabel ?? "",
    symbolismTitle: collection.symbolismTitle ?? "",
    symbolismBody: collection.symbolismBody ?? "",
    symbolismBody2: collection.symbolismBody2 ?? "",
    workflowState: workflowStateFromCollection(collection),
  };
}

function FieldLabel({
  children,
  help,
  required,
}: {
  children: React.ReactNode;
  help?: React.ReactNode;
  required?: boolean;
}) {
  return (
    <span className="adm-label-row">
      <span className="adm-label">
        {children}
        {required ? <span style={{ color: "var(--adm-accent)", marginLeft: "0.25rem" }}>*</span> : null}
      </span>
      {help ? <AdminHelp>{help}</AdminHelp> : null}
    </span>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="adm-field-error">{message}</p>;
}

function fieldClass(error?: string) {
  return error ? "adm-field adm-field--error" : "adm-field";
}

function submitLabel(base: string, pending: boolean, pendingLabel: string) {
  return pending ? pendingLabel : base;
}

function WorkflowStateField({
  value,
  onChange,
  error,
}: {
  value: CollectionDraft["workflowState"];
  onChange: (value: CollectionDraft["workflowState"]) => void;
  error?: string;
}) {
  const options: Array<{
    value: CollectionDraft["workflowState"];
    title: string;
    description: string;
  }> = [
    {
      value: "DRAFT",
      title: "Draft",
      description: "Hidden from the storefront while you prepare content.",
    },
    {
      value: "PUBLISHED",
      title: "Published",
      description: "Visible on collection listings and the public collection page.",
    },
  ];

  return (
    <div className="grid gap-2">
      <FieldLabel required help="Draft collections stay private. Published collections appear on the collections index and their public detail page.">
        Storefront state
      </FieldLabel>
      <input type="hidden" name="workflowState" value={value} />
      <div className="grid gap-3 md:grid-cols-2">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={selected ? "adm-workflow-btn adm-workflow-btn--on" : "adm-workflow-btn adm-workflow-btn--off"}
              aria-pressed={selected}
              aria-label={`${option.title}. ${option.description}`}
            >
              <span className="adm-label-row">
                <span
                  className="text-left text-[0.72rem] font-bold uppercase tracking-[0.08em]"
                  style={{ color: selected ? "var(--adm-accent)" : "var(--adm-muted)" }}
                >
                  {option.title}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <FieldError message={error} />
    </div>
  );
}

function CollectionFields({
  draft,
  onChange,
  fieldErrors,
  currentHeroImageUrl,
  currentHeroImageLabel,
  fileInputKey,
}: {
  draft: CollectionDraft;
  onChange: <K extends keyof CollectionDraft>(key: K, value: CollectionDraft[K]) => void;
  fieldErrors?: Partial<Record<CollectionFieldName, string>>;
  currentHeroImageUrl?: string | null;
  currentHeroImageLabel?: string;
  fileInputKey?: string | number;
}) {
  return (
    <>
      {/* i18n groundwork */}
      <LocaleTabStrip />

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2">
          <FieldLabel required>Name</FieldLabel>
          <input
            name="name"
            required
            value={draft.name}
            onChange={(e) => onChange("name", e.target.value)}
            className={fieldClass(fieldErrors?.name)}
            aria-invalid={Boolean(fieldErrors?.name)}
            placeholder="Belarus Heritage"
          />
          <FieldError message={fieldErrors?.name} />
        </label>

        <label className="grid gap-2">
          <FieldLabel required help="Auto-generated from the collection name until you edit it manually. Keep it short, lowercase, and URL-friendly.">
            Slug
          </FieldLabel>
          <input
            name="slug"
            required
            value={draft.slug}
            onChange={(e) => onChange("slug", e.target.value)}
            className={fieldClass(fieldErrors?.slug)}
            aria-invalid={Boolean(fieldErrors?.slug)}
            placeholder="belarus-heritage"
          />
          <FieldError message={fieldErrors?.slug} />
        </label>

        <label className="grid gap-2">
          <FieldLabel required help="Short collection code used in storefront views and admin references.">
            Accent code
          </FieldLabel>
          <input
            name="code"
            required
            value={draft.code}
            onChange={(e) => onChange("code", e.target.value)}
            className={fieldClass(fieldErrors?.code)}
            aria-invalid={Boolean(fieldErrors?.code)}
            placeholder="COL-01"
          />
          <FieldError message={fieldErrors?.code} />
        </label>

      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <FieldLabel
            required
            help="Upload a hero image for new collections. When editing, leave the field empty to keep the current media."
          >
            Hero image
          </FieldLabel>
          <ImageFileField
            key={fileInputKey}
            name="heroImageFile"
            required={!currentHeroImageUrl}
            className={fieldClass(fieldErrors?.heroImageFile)}
            aria-invalid={Boolean(fieldErrors?.heroImageFile)}
            currentImageUrl={currentHeroImageUrl}
            currentImageAlt={currentHeroImageLabel ?? "Collection hero image"}
            currentImageLabel="Current hero image"
            previewAspect="video"
            removeFieldName="removeHeroImage"
            removeLabel="Remove"
          />
          <FieldError message={fieldErrors?.heroImageFile} />
        </label>
      </div>

      <label className="grid gap-2">
        <FieldLabel required>Collection summary</FieldLabel>
        <textarea
          name="description"
          rows={3}
          required
          value={draft.description}
          onChange={(e) => onChange("description", e.target.value)}
          className={fieldClass(fieldErrors?.description)}
          aria-invalid={Boolean(fieldErrors?.description)}
          placeholder="This text appears on the collection card and collection hero."
        />
        <FieldError message={fieldErrors?.description} />
      </label>

      <label className="grid gap-2">
        <FieldLabel required>Manifesto</FieldLabel>
        <textarea
          name="manifesto"
          rows={4}
          required
          value={draft.manifesto}
          onChange={(e) => onChange("manifesto", e.target.value)}
          className={fieldClass(fieldErrors?.manifesto)}
          aria-invalid={Boolean(fieldErrors?.manifesto)}
          placeholder="This text powers the manifesto strip on the collection page."
        />
        <FieldError message={fieldErrors?.manifesto} />
      </label>

      <label className="grid gap-2">
        <FieldLabel required>Search summary</FieldLabel>
        <textarea
          name="searchSummary"
          rows={2}
          required
          value={draft.searchSummary}
          onChange={(e) => onChange("searchSummary", e.target.value)}
          className={fieldClass(fieldErrors?.searchSummary)}
          aria-invalid={Boolean(fieldErrors?.searchSummary)}
          placeholder="Short search/discovery helper text."
        />
        <FieldError message={fieldErrors?.searchSummary} />
      </label>

      <div
        className="grid gap-4 pt-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <WorkflowStateField
          value={draft.workflowState}
          onChange={(value) => onChange("workflowState", value)}
          error={fieldErrors?.workflowState}
        />
      </div>

      {/* Default symbolism */}
      <div
        className="grid gap-4 pt-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div>
          <p className="adm-label-row">
            <span className="adm-section-tag">[ DEFAULT PRODUCT SYMBOLISM ]</span>
            <AdminHelp>
              Products in this collection inherit these values when their own symbolism override is empty.
            </AdminHelp>
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <FieldLabel>Symbolism label</FieldLabel>
            <input
              name="symbolismLabel"
              value={draft.symbolismLabel}
              onChange={(e) => onChange("symbolismLabel", e.target.value)}
              className="adm-field"
              placeholder="Symbolic Language"
            />
          </label>
          <label className="grid gap-2">
            <FieldLabel>Symbolism title</FieldLabel>
            <input
              name="symbolismTitle"
              value={draft.symbolismTitle}
              onChange={(e) => onChange("symbolismTitle", e.target.value)}
              className="adm-field"
              placeholder="Wood, Lava, Embroidery"
            />
          </label>
        </div>

        <label className="grid gap-2">
          <FieldLabel>Symbolism body</FieldLabel>
          <textarea
            name="symbolismBody"
            rows={4}
            value={draft.symbolismBody}
            onChange={(e) => onChange("symbolismBody", e.target.value)}
            className="adm-field"
          />
        </label>

        <label className="grid gap-2">
          <FieldLabel>Symbolism secondary body</FieldLabel>
          <textarea
            name="symbolismBody2"
            rows={3}
            value={draft.symbolismBody2}
            onChange={(e) => onChange("symbolismBody2", e.target.value)}
            className="adm-field"
          />
        </label>
      </div>
    </>
  );
}

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
        next.slug = slugifyForAdmin(String(value));
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
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
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
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
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
              borderTop: "1px solid rgba(255,255,255,0.06)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
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
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
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
                    border: "1px solid rgba(255,255,255,0.06)",
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

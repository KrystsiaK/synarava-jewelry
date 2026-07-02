"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";

import {
  deleteCollectionAction,
  saveCollectionAction,
  type CollectionActionState,
  type CollectionFieldName,
  type SavedCollectionPayload,
} from "@/app/admin/actions";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import { AdminHelp } from "@/components/admin/admin-help";
import { LocaleTabStrip } from "@/components/admin/admin-primitives";

type AdminCollection = SavedCollectionPayload;

type CollectionDraft = {
  name: string;
  slug: string;
  code: string;
  subtitle: string;
  description: string;
  manifesto: string;
  searchSummary: string;
  symbolismLabel: string;
  symbolismTitle: string;
  symbolismBody: string;
  symbolismBody2: string;
  workflowState: "DRAFT" | "PUBLISHED";
  sortOrder: string;
};

const initialState: CollectionActionState = {};

function emptyCollectionDraft(): CollectionDraft {
  return {
    name: "", slug: "", code: "", subtitle: "", description: "",
    manifesto: "", searchSummary: "", symbolismLabel: "", symbolismTitle: "",
    symbolismBody: "", symbolismBody2: "", workflowState: "DRAFT", sortOrder: "0",
  };
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

function collectionToDraft(collection: AdminCollection): CollectionDraft {
  return {
    name: collection.name,
    slug: collection.slug,
    code: collection.code ?? "",
    subtitle: collection.subtitle ?? "",
    description: collection.description ?? "",
    manifesto: collection.manifesto ?? "",
    searchSummary: collection.searchSummary ?? "",
    symbolismLabel: collection.symbolismLabel ?? "",
    symbolismTitle: collection.symbolismTitle ?? "",
    symbolismBody: collection.symbolismBody ?? "",
    symbolismBody2: collection.symbolismBody2 ?? "",
    workflowState: workflowStateFromCollection(collection),
    sortOrder: String(collection.sortOrder ?? 0),
  };
}

function smartSlugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
  pending,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-6"
      style={{ background: "rgba(5,4,3,0.82)", backdropFilter: "blur(10px)" }}
    >
      <div className="adm-panel w-full max-w-md p-6">
        <p className="adm-section-tag mb-3">[ CONFIRM OPERATION ]</p>
        <h3 className="adm-title-sm">{title}</h3>
        <p className="adm-copy mt-4">{description}</p>
        <div
          className="mt-6 flex flex-wrap justify-end gap-3 pt-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button type="button" onClick={onCancel} className="adm-btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="adm-btn-danger"
          >
            {pending ? "Deleting..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
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
          <FieldLabel>Accent code</FieldLabel>
          <input
            name="code"
            value={draft.code}
            onChange={(e) => onChange("code", e.target.value)}
            className="adm-field"
            placeholder="COL-01"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <FieldLabel>Eyebrow / subtitle</FieldLabel>
          <input
            name="subtitle"
            value={draft.subtitle}
            onChange={(e) => onChange("subtitle", e.target.value)}
            className="adm-field"
            placeholder="Collection 01"
          />
        </label>

        <label className="grid gap-2">
          <FieldLabel help="Upload a new image only when you want to replace the current hero. Leave the field empty to keep the existing media.">
            Hero image
          </FieldLabel>
          <input
            key={fileInputKey}
            name="heroImageFile"
            type="file"
            accept="image/*"
            className={fieldClass(fieldErrors?.heroImageFile)}
          />
          <FieldError message={fieldErrors?.heroImageFile} />
        </label>
      </div>

      {currentHeroImageUrl ? (
        <div
          className="flex items-center gap-3 p-3"
          style={{ border: "1px solid var(--adm-border)", borderRadius: "10px" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentHeroImageUrl}
            alt={currentHeroImageLabel ?? "Collection hero image"}
            className="h-14 w-14 object-cover"
            style={{ opacity: 0.7 }}
          />
          <div className="space-y-1">
            <p className="adm-label">Current hero image</p>
            <p
              className="break-all text-xs leading-5"
              style={{ color: "var(--adm-muted)" }}
            >
              {currentHeroImageUrl}
            </p>
          </div>
        </div>
      ) : null}

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
        <FieldLabel>Manifesto</FieldLabel>
        <textarea
          name="manifesto"
          rows={4}
          value={draft.manifesto}
          onChange={(e) => onChange("manifesto", e.target.value)}
          className="adm-field"
          placeholder="This text powers the manifesto strip on the collection page."
        />
      </label>

      <label className="grid gap-2">
        <FieldLabel>Search summary</FieldLabel>
        <textarea
          name="searchSummary"
          rows={2}
          value={draft.searchSummary}
          onChange={(e) => onChange("searchSummary", e.target.value)}
          className="adm-field"
          placeholder="Optional short search/discovery helper text."
        />
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

        <label className="grid gap-2 md:max-w-xs">
          <FieldLabel>Sort order</FieldLabel>
          <input
            name="sortOrder"
            type="number"
            value={draft.sortOrder}
            onChange={(e) => onChange("sortOrder", e.target.value)}
            className="adm-field"
          />
        </label>
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

function CreateCollectionForm({ onCreated }: { onCreated: (collection: AdminCollection) => void }) {
  const [state, setState] = useState<CollectionActionState>(initialState);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [slugLocked, setSlugLocked] = useState(false);
  const [draft, setDraft] = useState<CollectionDraft>(emptyCollectionDraft);

  async function formAction(formData: FormData) {
    startTransition(async () => {
      const nextState = await saveCollectionAction(initialState, formData);
      setState(nextState);

      if (nextState.collection) {
        onCreated(nextState.collection);
      }

      if (nextState.success && nextState.collection) {
        setDraft(emptyCollectionDraft());
        setSlugLocked(false);
        setFileInputKey((current) => current + 1);
        formRef.current?.reset();
      }
    });
  }

  function updateDraft<K extends keyof CollectionDraft>(key: K, value: CollectionDraft[K]) {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "name" && !slugLocked) {
        next.slug = smartSlugify(String(value));
      }
      return next;
    });
  }

  return (
    <form ref={formRef} action={formAction} className="adm-panel grid gap-4 p-5">
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
              Name, subtitle, and summary feed the collection card and hero. Accent code is a short admin label. Hero image replaces current media only when a file is selected. Manifesto and symbolism defaults shape the public collection story. State controls draft versus published visibility.
            </AdminHelp>
          </div>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="adm-btn-primary"
        >
          {submitLabel("Save collection", isPending, "Saving...")}
        </button>
      </div>

      <AuthMessage error={state.error} success={state.success} />
      <div>
        <AdminHelp label="Save guidance">
          Fields marked with * are required. Drafts stay in the form until a save succeeds.
        </AdminHelp>
      </div>

      <CollectionFields
        draft={draft}
        onChange={(key, value) => {
          if (key === "slug") setSlugLocked(Boolean(String(value).trim()));
          updateDraft(key, value);
        }}
        fieldErrors={state.fieldErrors}
        fileInputKey={fileInputKey}
      />

      <div
        className="flex items-center justify-end pt-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button
          type="submit"
          disabled={isPending}
          className="adm-btn-primary"
        >
          {submitLabel("Save collection", isPending, "Saving...")}
        </button>
      </div>
    </form>
  );
}

function DeleteCollectionForm({
  collectionId,
  collectionSlug,
  onDeleted,
}: {
  collectionId: string;
  collectionSlug: string;
  onDeleted: (collectionId: string) => void;
}) {
  const [state, setState] = useState<CollectionActionState>(initialState);
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleDelete(formData: FormData) {
    startTransition(async () => {
      const nextState = await deleteCollectionAction(initialState, formData);
      setState(nextState);
      setConfirmOpen(false);
      if (nextState.deletedCollectionId) {
        onDeleted(nextState.deletedCollectionId);
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
        <AuthMessage error={state.error} success={state.success} />
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={`Delete ${collectionSlug}`}
        description="Вы уверены, что хотите удалить коллекцию? Это защитит от случайного нажатия. После удаления коллекция исчезнет из админки и её публичная страница перестанет открываться."
        confirmLabel="Да, удалить коллекцию"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          const formData = new FormData();
          formData.set("collectionId", collectionId);
          formData.set("collectionSlug", collectionSlug);
          void handleDelete(formData);
        }}
        pending={isPending}
      />
    </>
  );
}

function EditCollectionForm({
  collection,
  onUpdated,
  onDeleted,
}: {
  collection: AdminCollection;
  onUpdated: (collection: AdminCollection) => void;
  onDeleted: (collectionId: string) => void;
}) {
  const [state, setState] = useState<CollectionActionState>(initialState);
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<CollectionDraft>(() => collectionToDraft(collection));
  const fileInputKey = collection.heroImageUrl ?? collection.id;

  async function formAction(formData: FormData) {
    startTransition(async () => {
      const nextState = await saveCollectionAction(initialState, formData);
      setState(nextState);
      if (nextState.collection) {
        onUpdated(nextState.collection);
      }
    });
  }

  function updateDraft<K extends keyof CollectionDraft>(key: K, value: CollectionDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const isPublished =
    collection.status === "ACTIVE" && collection.visibility === "PUBLIC";

  return (
    <details
      style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        paddingTop: "1.25rem",
      }}
    >
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--adm-ink)" }}
            >
              {collection.name}
            </p>
            <p
              className="mt-0.5 text-xs"
              style={{ color: "var(--adm-muted)" }}
            >
              /{collection.slug}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={isPublished ? "adm-badge-published" : "adm-badge-draft"}>
              {draft.workflowState}
            </span>
            <Link
              href={`/collections/${collection.slug}`}
              className="adm-btn-ghost py-1 px-2 text-[0.58rem]"
            >
              Open page
            </Link>
          </div>
        </div>
      </summary>

      <div className="mt-5 grid gap-4">
        <AuthMessage error={state.error} success={state.success} />
        <div>
          <AdminHelp label="Save guidance">
            Fields marked with * are required. Drafts stay in the form until a save succeeds.
          </AdminHelp>
        </div>

        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="collectionId" value={collection.id} />
          <input
            type="hidden"
            name="existingHeroImageUrl"
            value={collection.heroImageUrl ?? ""}
          />

          <CollectionFields
            draft={draft}
            onChange={(key, value) => {
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
              type="submit"
              disabled={isPending}
              className="adm-btn-primary"
            >
              {submitLabel("Update collection", isPending, "Saving...")}
            </button>
          </div>
        </form>
      </div>
    </details>
  );
}

export function CollectionsCms({ collections }: { collections: AdminCollection[] }) {
  const [items, setItems] = useState(() => normalizeCollections(collections));

  function handleCreated(collection: AdminCollection) {
    setItems((current) =>
      normalizeCollections([
        collection,
        ...current.filter((item) => item.id !== collection.id),
      ]),
    );
  }

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

  return (
    <div className="space-y-8">
      {/* Create + info */}
      <section className="grid gap-3">
        <CreateCollectionForm onCreated={handleCreated} />
      </section>

      {/* Existing collections */}
      <section className="adm-panel p-5">
        <div
          className="flex flex-col gap-3 pb-4 mb-1 md:flex-row md:items-end md:justify-between"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <p className="adm-section-tag">[ CURRENT COLLECTIONS ]</p>
            <h2 className="adm-title-sm mt-2">
              Edit existing collections
            </h2>
          </div>
          <AdminHelp label="Collection editing guidance">
            Every save returns an explicit result. Each collection can be draft or published, or deleted.
          </AdminHelp>
        </div>

        <div className="mt-5 space-y-0">
          {items.length > 0 ? (
            items.map((collection) => (
              <EditCollectionForm
                key={[
                  collection.id,
                  collection.slug,
                  collection.name,
                  collection.heroImageUrl ?? "",
                  collection.sortOrder,
                  collection.status,
                  collection.visibility,
                ].join(":")}
                collection={collection}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            ))
          ) : (
            <p className="text-sm leading-6" style={{ color: "var(--adm-muted)" }}>
              No collections yet. Create your first collection using the form above.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

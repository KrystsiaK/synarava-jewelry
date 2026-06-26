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

const adminFieldClass =
  "admin-field w-full min-w-0 border border-stroke bg-transparent px-4 py-3 outline-none focus:border-accent";

const fieldErrorClass = "text-xs leading-6 text-couture-red";

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
    name: "",
    slug: "",
    code: "",
    subtitle: "",
    description: "",
    manifesto: "",
    searchSummary: "",
    symbolismLabel: "",
    symbolismTitle: "",
    symbolismBody: "",
    symbolismBody2: "",
    workflowState: "DRAFT",
    sortOrder: "0",
  };
}

function normalizeCollections(items: AdminCollection[]) {
  return [...items].sort((left, right) => {
    const orderDiff = (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
    if (orderDiff !== 0) {
      return orderDiff;
    }

    return left.name.localeCompare(right.name);
  });
}

function workflowStateFromCollection(collection: AdminCollection): CollectionDraft["workflowState"] {
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
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <span className="label-caps text-muted">
      {children}
      {required ? <span className="ml-1 text-couture-red">*</span> : null}
    </span>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className={fieldErrorClass}>{message}</p>;
}

function collectionFieldClass(error?: string) {
  return `${adminFieldClass}${error ? " border-couture-red text-foreground" : ""}`;
}

function submitActionLabel(base: string, pending: boolean, pendingLabel: string) {
  return pending ? pendingLabel : base;
}

function CollectionStateNote() {
  return (
    <p className="text-sm leading-7 text-foreground/55">
      Fields marked with <span className="text-couture-red">*</span> are required. Drafts stay in the form until a save succeeds.
    </p>
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
      <FieldLabel required>Storefront state</FieldLabel>
      <input type="hidden" name="workflowState" value={value} />
      <div className="grid gap-3 md:grid-cols-2">
        {options.map((option) => {
          const selected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={[
                "grid gap-2 border p-4 text-left transition-colors",
                selected
                  ? "border-accent bg-accent/8"
                  : "border-stroke bg-transparent hover:border-accent/50",
              ].join(" ")}
              aria-pressed={selected}
            >
              <span className="label-caps text-foreground">{option.title}</span>
              <span className="text-sm leading-7 text-foreground/60">{option.description}</span>
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
  slugLocked,
}: {
  draft: CollectionDraft;
  onChange: <K extends keyof CollectionDraft>(key: K, value: CollectionDraft[K]) => void;
  fieldErrors?: Partial<Record<CollectionFieldName, string>>;
  currentHeroImageUrl?: string | null;
  currentHeroImageLabel?: string;
  fileInputKey?: string | number;
  slugLocked?: boolean;
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2">
          <FieldLabel required>Name</FieldLabel>
          <input
            name="name"
            required
            value={draft.name}
            onChange={(event) => onChange("name", event.target.value)}
            className={collectionFieldClass(fieldErrors?.name)}
            aria-invalid={Boolean(fieldErrors?.name)}
            placeholder="Belarus Heritage"
          />
          <FieldError message={fieldErrors?.name} />
        </label>

        <label className="grid gap-2">
          <FieldLabel required>Slug</FieldLabel>
          <input
            name="slug"
            required
            value={draft.slug}
            onChange={(event) => onChange("slug", event.target.value)}
            className={collectionFieldClass(fieldErrors?.slug)}
            aria-invalid={Boolean(fieldErrors?.slug)}
            placeholder="belarus-heritage"
          />
          <FieldError message={fieldErrors?.slug} />
          {!slugLocked ? (
            <p className="text-xs leading-6 text-foreground/45">Auto-generated from the collection name until you edit it manually.</p>
          ) : null}
        </label>

        <label className="grid gap-2">
          <FieldLabel>Accent code</FieldLabel>
          <input
            name="code"
            value={draft.code}
            onChange={(event) => onChange("code", event.target.value)}
            className={adminFieldClass}
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
            onChange={(event) => onChange("subtitle", event.target.value)}
            className={adminFieldClass}
            placeholder="Collection 01"
          />
        </label>

        <label className="grid gap-2">
          <FieldLabel>Hero image</FieldLabel>
          <input
            key={fileInputKey}
            name="heroImageFile"
            type="file"
            accept="image/*"
            className={collectionFieldClass(fieldErrors?.heroImageFile)}
          />
          <FieldError message={fieldErrors?.heroImageFile} />
          <p className="text-xs leading-6 text-foreground/45">Upload a new image only when you want to replace the current hero.</p>
        </label>
      </div>

      {currentHeroImageUrl ? (
        <div className="flex items-center gap-3 border border-stroke p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentHeroImageUrl}
            alt={currentHeroImageLabel ?? "Collection hero image"}
            className="h-16 w-16 object-cover"
          />
          <div className="space-y-1">
            <p className="label-caps text-muted">Current hero image</p>
            <p className="text-sm text-foreground/60">{currentHeroImageUrl}</p>
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
          onChange={(event) => onChange("description", event.target.value)}
          className={collectionFieldClass(fieldErrors?.description)}
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
          onChange={(event) => onChange("manifesto", event.target.value)}
          className={adminFieldClass}
          placeholder="This text powers the manifesto strip on the collection page."
        />
      </label>

      <label className="grid gap-2">
        <FieldLabel>Search summary</FieldLabel>
        <textarea
          name="searchSummary"
          rows={2}
          value={draft.searchSummary}
          onChange={(event) => onChange("searchSummary", event.target.value)}
          className={adminFieldClass}
          placeholder="Optional short search/discovery helper text."
        />
      </label>

      <div className="grid gap-4 border-t border-stroke pt-4">
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
            onChange={(event) => onChange("sortOrder", event.target.value)}
            className={adminFieldClass}
          />
        </label>
      </div>

      <div className="grid gap-4 border-t border-stroke pt-4">
        <div>
          <p className="label-caps text-accent">Default product symbolism</p>
          <p className="mt-2 text-sm leading-7 text-foreground/60">
            Products in this collection inherit these values when their own symbolism override is empty.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <FieldLabel>Symbolism label</FieldLabel>
            <input
              name="symbolismLabel"
              value={draft.symbolismLabel}
              onChange={(event) => onChange("symbolismLabel", event.target.value)}
              className={adminFieldClass}
              placeholder="Symbolic Language"
            />
          </label>

          <label className="grid gap-2">
            <FieldLabel>Symbolism title</FieldLabel>
            <input
              name="symbolismTitle"
              value={draft.symbolismTitle}
              onChange={(event) => onChange("symbolismTitle", event.target.value)}
              className={adminFieldClass}
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
            onChange={(event) => onChange("symbolismBody", event.target.value)}
            className={adminFieldClass}
          />
        </label>

        <label className="grid gap-2">
          <FieldLabel>Symbolism secondary body</FieldLabel>
          <textarea
            name="symbolismBody2"
            rows={3}
            value={draft.symbolismBody2}
            onChange={(event) => onChange("symbolismBody2", event.target.value)}
            className={adminFieldClass}
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
    <form ref={formRef} action={formAction} className="panel grid gap-4 p-6">
      <div className="flex items-center justify-between gap-4 border-b border-stroke pb-4">
        <div>
          <p className="label-caps text-accent">Create collection</p>
          <h2 className="mt-2 font-serif text-[2rem]">New collection</h2>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="border border-accent bg-accent px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitActionLabel("Save collection", isPending, "Saving...")}
        </button>
      </div>

      <AuthMessage error={state.error} success={state.success} />
      <CollectionStateNote />

      <CollectionFields
        draft={draft}
        onChange={(key, value) => {
          if (key === "slug") {
            setSlugLocked(Boolean(String(value).trim()));
          }

          updateDraft(key, value);
        }}
        fieldErrors={state.fieldErrors}
        fileInputKey={fileInputKey}
        slugLocked={slugLocked}
      />
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

  async function formAction(formData: FormData) {
    startTransition(async () => {
      const nextState = await deleteCollectionAction(initialState, formData);
      setState(nextState);

      if (nextState.deletedCollectionId) {
        onDeleted(nextState.deletedCollectionId);
      }
    });
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <input type="hidden" name="collectionId" value={collectionId} />
      <input type="hidden" name="collectionSlug" value={collectionSlug} />
      <button
        type="submit"
        disabled={isPending}
        className="border border-couture-red/35 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-couture-red transition-colors hover:border-couture-red hover:bg-couture-red hover:text-white"
      >
        {submitActionLabel("Delete", isPending, "Deleting...")}
      </button>
      <AuthMessage error={state.error} success={state.success} />
    </form>
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
  const [slugLocked, setSlugLocked] = useState(true);
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

  return (
    <details className="border-t border-stroke pt-6 first:border-t-0 first:pt-0">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-serif text-[1.6rem]">{collection.name}</p>
            <p className="text-sm text-foreground/55">/{collection.slug}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.14em] text-foreground/45">
              Change this collection to <span className="text-accent">Published</span> inside the form below under <span className="text-foreground">Storefront state</span>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-stroke px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-foreground/60">
              {draft.workflowState}
            </span>
            <Link
              href={`/collections/${collection.slug}`}
              className="border border-stroke px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-foreground/60 transition-colors hover:border-accent hover:text-accent"
            >
              Open page
            </Link>
          </div>
        </div>
      </summary>

      <div className="mt-5 grid gap-4">
        <AuthMessage error={state.error} success={state.success} />
        <CollectionStateNote />

        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="collectionId" value={collection.id} />
          <input type="hidden" name="existingHeroImageUrl" value={collection.heroImageUrl ?? ""} />

          <CollectionFields
            draft={draft}
            onChange={(key, value) => {
              if (key === "slug") {
                setSlugLocked(Boolean(String(value).trim()));
              }

              updateDraft(key, value);
            }}
            fieldErrors={state.fieldErrors}
            currentHeroImageUrl={collection.heroImageUrl}
            currentHeroImageLabel={collection.name}
            fileInputKey={fileInputKey}
            slugLocked={slugLocked}
          />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <p className="max-w-xl text-sm leading-7 text-foreground/55">
              Draft collections stay private and do not appear on the storefront. Published collections become public on
              the collections index and their own detail page.
            </p>

            <button
              type="submit"
              disabled={isPending}
              className="border border-accent bg-accent px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitActionLabel("Update collection", isPending, "Saving...")}
            </button>
          </div>
        </form>

        <div className="flex justify-end">
          <DeleteCollectionForm
            collectionId={collection.id}
            collectionSlug={collection.slug}
            onDeleted={onDeleted}
          />
        </div>
      </div>
    </details>
  );
}

export function CollectionsCms({ collections }: { collections: AdminCollection[] }) {
  const [items, setItems] = useState(() => normalizeCollections(collections));

  function handleCreated(collection: AdminCollection) {
    setItems((current) => normalizeCollections([collection, ...current.filter((item) => item.id !== collection.id)]));
  }

  function handleUpdated(collection: AdminCollection) {
    setItems((current) => normalizeCollections(current.map((item) => (item.id === collection.id ? collection : item))));
  }

  function handleDeleted(collectionId: string) {
    setItems((current) => current.filter((item) => item.id !== collectionId));
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <CreateCollectionForm onCreated={handleCreated} />

        <aside className="panel p-6">
          <p className="label-caps text-muted">What this config affects</p>
          <div className="mt-5 space-y-4 text-sm leading-7 text-foreground/65">
            <p><strong className="text-foreground">Name, subtitle, summary:</strong> collection card on <code>/collections</code> and the hero on the collection page.</p>
            <p><strong className="text-foreground">Accent code:</strong> small mono accent details on collection UI.</p>
            <p><strong className="text-foreground">Hero image:</strong> image used in collection list and collection detail story/hero areas.</p>
            <p><strong className="text-foreground">Manifesto:</strong> the large manifesto strip on the collection page.</p>
            <p><strong className="text-foreground">Symbolism defaults:</strong> fallback content for product symbolism blocks.</p>
            <p><strong className="text-foreground">State:</strong> only two storefront states exist here now — <strong>Draft</strong> and <strong>Published</strong>.</p>
          </div>
        </aside>
      </section>

      <section className="panel p-6">
        <div className="flex flex-col gap-3 border-b border-stroke pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="label-caps text-muted">Current collections</p>
            <h2 className="mt-2 font-serif text-[2rem]">Edit existing collections</h2>
          </div>
          <p className="text-sm text-foreground/55">
            Every save returns an explicit result. Every collection can be either draft or published, and can also be deleted.
          </p>
        </div>

        <div className="mt-6 space-y-8">
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
            <p className="text-sm leading-7 text-foreground/55">No collections yet. Create your first collection using the form above.</p>
          )}
        </div>
      </section>
    </div>
  );
}

"use client";

import {
  createContext,
  use,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import {
  getShopifyCategoryAttributesAction,
  searchShopifyTaxonomyCategoriesAction,
} from "@/app/admin/actions/taxonomy";
import { AdminTextControl } from "@/components/synarava-cms";
import type { ShopifyCategoryAttributeSelection } from "@/lib/shopify/category-attribute-values";
import type { ShopifyTaxonomyCategory } from "@/lib/shopify/taxonomy-selection";
import type { ShopifyTaxonomyCategoryAttribute } from "@/lib/shopify/taxonomy";

type ShopifyCategoryContextValue = {
  controlId?: string;
  invalid: boolean;
  query: string;
  setQuery: (value: string) => void;
  selectedId: string;
  selectedName: string;
  results: ShopifyTaxonomyCategory[];
  searchError: string;
  pending: boolean;
  attributes: ShopifyTaxonomyCategoryAttribute[];
  attributesError: string;
  attributesPending: boolean;
  selectedAttributeValues: ShopifyCategoryAttributeSelection[];
  resultListId: string;
  searchErrorId: string;
  hiddenInputRef: React.RefObject<HTMLInputElement | null>;
  choose: (category: ShopifyTaxonomyCategory) => void;
  clear: () => void;
  onQueryChange: (value: string) => void;
};

const ShopifyCategoryContext = createContext<ShopifyCategoryContextValue | null>(null);

function useShopifyCategoryContext() {
  const value = use(ShopifyCategoryContext);
  if (!value) {
    throw new Error("Shopify category parts must render inside ShopifyCategoryField.");
  }
  return value;
}

function useShopifyCategoryState({
  initialId,
  initialName,
  invalid = false,
  controlId,
  selectedAttributeValues = [],
  onSelectedIdChange,
}: {
  initialId: string;
  initialName: string;
  invalid?: boolean;
  controlId?: string;
  selectedAttributeValues?: ShopifyCategoryAttributeSelection[];
  onSelectedIdChange?: (id: string) => void;
}): ShopifyCategoryContextValue {
  const [query, setQuery] = useState(initialName);
  const [selectedId, setSelectedId] = useState(initialId);
  const [selectedName, setSelectedName] = useState(initialName);
  const [results, setResults] = useState<ShopifyTaxonomyCategory[]>([]);
  const [searchError, setSearchError] = useState("");
  const [pending, startTransition] = useTransition();
  const [attributes, setAttributes] = useState<ShopifyTaxonomyCategoryAttribute[]>([]);
  const [attributesError, setAttributesError] = useState("");
  const [attributesPending, startAttributesTransition] = useTransition();
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const resultListId = useId();
  const searchErrorId = useId();

  function commitSelectedId(id: string) {
    setSelectedId(id);
    onSelectedIdChange?.(id);
  }

  useEffect(() => {
    let cancelled = false;
    startAttributesTransition(async () => {
      if (!selectedId) {
        if (cancelled) return;
        setAttributes([]);
        setAttributesError("");
        return;
      }

      const result = await getShopifyCategoryAttributesAction(selectedId);
      if (cancelled) return;
      setAttributes(result.attributes);
      setAttributesError(result.error ?? "");
    });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    const search = query.trim();
    if (search.length < 2 || (selectedId && search === selectedName)) {
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      startTransition(async () => {
        const result = await searchShopifyTaxonomyCategoriesAction(search);
        if (cancelled) return;
        setResults(result.categories);
        setSearchError(result.error ?? "");
      });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [query, selectedId, selectedName]);

  function notifyFormChanged() {
    hiddenInputRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function choose(category: ShopifyTaxonomyCategory) {
    setQuery(category.fullName);
    commitSelectedId(category.id);
    setSelectedName(category.fullName);
    setResults([]);
    setSearchError("");
    notifyFormChanged();
  }

  function clear() {
    setQuery("");
    commitSelectedId("");
    setSelectedName("");
    setResults([]);
    setSearchError("");
    notifyFormChanged();
  }

  function onQueryChange(value: string) {
    setQuery(value);
    commitSelectedId("");
    setSelectedName("");
    setResults([]);
    setSearchError("");
  }

  return {
    controlId,
    invalid,
    query,
    setQuery,
    selectedId,
    selectedName,
    results,
    searchError,
    pending,
    attributes,
    attributesError,
    attributesPending,
    selectedAttributeValues,
    resultListId,
    searchErrorId,
    hiddenInputRef,
    choose,
    clear,
    onQueryChange,
  };
}

/** Combobox + hiddens only — keep outside tall attribute panels so absolute field errors stay under the input. */
export function ShopifyCategoryControl() {
  const {
    controlId,
    invalid,
    query,
    results,
    searchError,
    pending,
    resultListId,
    searchErrorId,
    hiddenInputRef,
    selectedId,
    selectedName,
    choose,
    clear,
    onQueryChange,
  } = useShopifyCategoryContext();

  return (
    <div data-slot="category-control" className="relative grid gap-2">
      <AdminTextControl
        controlId={controlId}
        clearable
        invalid={invalid}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onClear={clear}
        placeholder="Search Shopify taxonomy…"
        aria-label="Shopify product category"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={results.length > 0}
        aria-controls={resultListId}
        aria-describedby={searchError ? searchErrorId : undefined}
        data-draft-autosave="ignore"
      />
      <input ref={hiddenInputRef} type="hidden" name="shopifyCategoryId" value={selectedId} />
      <input type="hidden" name="shopifyCategoryName" value={selectedName} />
      {pending ? <p className="text-xs text-[var(--adm-muted)]" aria-live="polite">Searching Shopify…</p> : null}
      {searchError ? (
        <p id={searchErrorId} className="text-xs text-[var(--adm-danger)]" role="alert">
          {searchError}
        </p>
      ) : null}
      {results.length ? (
        <div
          id={resultListId}
          role="listbox"
          className="adm-popover absolute left-0 right-0 top-full max-h-72 overflow-auto border border-[var(--adm-border-strong)] bg-[var(--adm-bg)] shadow-lg"
        >
          {results.map((category) => (
            <button
              key={category.id}
              type="button"
              role="option"
              aria-selected={category.id === selectedId}
              className="block w-full border-b border-[var(--adm-border)] px-3 py-3 text-left text-sm hover:bg-[var(--adm-bg-soft)] focus:bg-[var(--adm-bg-soft)]"
              onClick={() => choose(category)}
            >
              <span className="block font-medium">{category.name}</span>
              <span className="mt-1 block text-xs text-[var(--adm-muted)]">{category.fullName}</span>
            </button>
          ))}
        </div>
      ) : null}
      {!selectedId && query.trim() ? (
        <p className="text-xs text-[var(--adm-muted)]">Select a result to save the Shopify category.</p>
      ) : null}
    </div>
  );
}

/** Product's selected category values + expected-attribute checklist (no vocabulary dump). */
export function ShopifyCategoryAttributes() {
  const {
    selectedId,
    attributes,
    attributesError,
    attributesPending,
    selectedAttributeValues,
  } = useShopifyCategoryContext();

  if (!selectedId) return null;

  const selectedLabels = new Set(
    selectedAttributeValues.map((item) => item.label.trim().toLowerCase()),
  );
  const unsetAttributes = attributes.filter(
    (attribute) => !selectedLabels.has(attribute.name.trim().toLowerCase()),
  );

  return (
    <div data-slot="category-attributes" className="grid gap-2 border-t border-[var(--adm-border)] pt-2">
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--adm-subtle)]">
        Shopify category attributes
      </p>

      {selectedAttributeValues.length > 0 ? (
        <dl className="grid gap-1.5 text-sm">
          {selectedAttributeValues.map((item) => (
            <div key={item.key} className="grid gap-0.5 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-3">
              <dt className="font-medium text-[var(--adm-ink)]">{item.label}</dt>
              <dd className="text-[var(--adm-muted)]">{item.values.join(", ")}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-xs text-[var(--adm-muted)]">
          No category attribute values on the last Shopify pull. Fill Color, Material, Fabric, and
          similar fields in Shopify Admin, then Pull from Shopify.
        </p>
      )}

      {attributesPending ? (
        <p className="text-xs text-[var(--adm-muted)]" aria-live="polite">Looking up Shopify&rsquo;s expected attributes…</p>
      ) : attributesError ? (
        <p className="text-xs text-[var(--adm-danger)]" role="alert">{attributesError}</p>
      ) : unsetAttributes.length > 0 ? (
        <p className="text-xs text-[var(--adm-muted)]">
          Expected by this category but not set on the product:{" "}
          {unsetAttributes.map((attribute) => attribute.name).join(", ")}.
        </p>
      ) : attributes.length === 0 ? (
        <p className="text-xs text-[var(--adm-muted)]">Shopify defines no attributes for this category.</p>
      ) : null}

      <p className="text-xs text-[var(--adm-muted)]">
        Values filled in Shopify under category attributes appear here after Pull. Synarava jewelry
        specs stay under Passport; product-page story under Product page — not a second checklist.
      </p>
    </div>
  );
}

/**
 * Compound category picker. Default children = control + attributes.
 * For form shells, compose Control inside AdminFieldShell and Attributes outside.
 */
export function ShopifyCategoryField({
  initialId,
  initialName,
  invalid = false,
  controlId,
  selectedAttributeValues,
  onSelectedIdChange,
  children,
}: {
  initialId: string;
  initialName: string;
  invalid?: boolean;
  controlId?: string;
  selectedAttributeValues?: ShopifyCategoryAttributeSelection[];
  onSelectedIdChange?: (id: string) => void;
  children?: ReactNode;
}) {
  const state = useShopifyCategoryState({
    initialId,
    initialName,
    invalid,
    controlId,
    selectedAttributeValues,
    onSelectedIdChange,
  });

  return (
    <ShopifyCategoryContext.Provider value={state}>
      <div data-component="ShopifyCategoryField" className="grid gap-2">
        {children ?? (
          <>
            <ShopifyCategoryControl />
            <ShopifyCategoryAttributes />
          </>
        )}
      </div>
    </ShopifyCategoryContext.Provider>
  );
}

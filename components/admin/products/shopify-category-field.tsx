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
}: {
  initialId: string;
  initialName: string;
  invalid?: boolean;
  controlId?: string;
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
    setSelectedId(category.id);
    setSelectedName(category.fullName);
    setResults([]);
    setSearchError("");
    notifyFormChanged();
  }

  function clear() {
    setQuery("");
    setSelectedId("");
    setSelectedName("");
    setResults([]);
    setSearchError("");
    notifyFormChanged();
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setSelectedId("");
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
          className="absolute left-0 right-0 top-full z-20 max-h-72 overflow-auto border border-[var(--adm-border-strong)] bg-[var(--adm-bg)] shadow-lg"
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

/** Reference attributes — render as a sibling below the field shell, never inside it. */
export function ShopifyCategoryAttributes() {
  const {
    selectedId,
    attributes,
    attributesError,
    attributesPending,
  } = useShopifyCategoryContext();

  if (!selectedId) return null;

  return (
    <div data-slot="category-attributes" className="grid gap-1.5 border-t border-[var(--adm-border)] pt-2">
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--adm-subtle)]">
        Shopify category attributes
      </p>
      {attributesPending ? (
        <p className="text-xs text-[var(--adm-muted)]" aria-live="polite">Looking up Shopify&rsquo;s attributes…</p>
      ) : attributesError ? (
        <p className="text-xs text-[var(--adm-danger)]" role="alert">{attributesError}</p>
      ) : attributes.length ? (
        <>
          <ul className="grid gap-1 text-xs text-[var(--adm-muted)]">
            {attributes.map((attribute) => (
              <li key={attribute.id}>
                <span className="font-medium text-[var(--adm-ink)]">{attribute.name}</span>
                {attribute.values.length ? `: ${attribute.values.join(", ")}` : ""}
              </li>
            ))}
          </ul>
          <p className="text-xs text-[var(--adm-muted)]">
            Reference only — characteristics below are not pushed against these attributes.
          </p>
        </>
      ) : (
        <p className="text-xs text-[var(--adm-muted)]">Shopify defines no attributes for this category.</p>
      )}
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
  children,
}: {
  initialId: string;
  initialName: string;
  invalid?: boolean;
  controlId?: string;
  children?: ReactNode;
}) {
  const state = useShopifyCategoryState({ initialId, initialName, invalid, controlId });

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

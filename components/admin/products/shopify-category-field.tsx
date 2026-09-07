"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

import { searchShopifyTaxonomyCategoriesAction } from "@/app/admin/actions/taxonomy";
import type { ShopifyTaxonomyCategory } from "@/lib/shopify/taxonomy-selection";

export function ShopifyCategoryField({
  initialId,
  initialName,
}: {
  initialId: string;
  initialName: string;
}) {
  const [query, setQuery] = useState(initialName);
  const [selectedId, setSelectedId] = useState(initialId);
  const [selectedName, setSelectedName] = useState(initialName);
  const [results, setResults] = useState<ShopifyTaxonomyCategory[]>([]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const resultListId = useId();
  const errorId = useId();

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
        setError(result.error ?? "");
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
    setError("");
    notifyFormChanged();
  }

  function clear() {
    setQuery("");
    setSelectedId("");
    setSelectedName("");
    setResults([]);
    setError("");
    notifyFormChanged();
  }

  return (
    <div className="relative grid gap-2">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedId("");
            setSelectedName("");
            setResults([]);
            setError("");
          }}
          className="adm-field min-w-0 flex-1"
          placeholder="Search Shopify taxonomy…"
          aria-label="Shopify product category"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={results.length > 0}
          aria-controls={resultListId}
          aria-describedby={error ? errorId : undefined}
          data-draft-autosave="ignore"
        />
        {query ? (
          <button type="button" className="adm-btn-ghost px-3" onClick={clear}>
            Clear
          </button>
        ) : null}
      </div>
      <input ref={hiddenInputRef} type="hidden" name="shopifyCategoryId" value={selectedId} />
      <input type="hidden" name="shopifyCategoryName" value={selectedName} />
      {pending ? <p className="text-xs text-[var(--adm-muted)]" aria-live="polite">Searching Shopify…</p> : null}
      {error ? <p id={errorId} className="text-xs text-[var(--adm-danger)]" role="alert">{error}</p> : null}
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

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRouter } from "next/navigation";

import {
  defineListStateSchema,
  enumField,
  parseListState,
  stringField,
} from "@/lib/list-state";

import { createAdminListStateAdapter, createSiteListStateAdapter } from "../adapters";
import { useListState } from "../use-list-state";

const schema = defineListStateSchema({
  q: stringField({ key: "q" }),
  sort: enumField({
    key: "sort",
    defaultValue: "published" as const,
    allowed: ["published", "updated", "name-asc"] as const,
  }),
});

function mockLocation(search: string) {
  window.history.replaceState(window.history.state, "", `/${search ? `?${search}` : ""}`);
}

describe("useListState", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockLocation("");
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    } as ReturnType<typeof useRouter>);
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("SSR initialState matches client parse of the same params", () => {
    const params = new URLSearchParams("q=pearl&sort=updated");
    const serverState = parseListState(schema, params);
    mockLocation("q=pearl&sort=updated");
    const adapter = createSiteListStateAdapter<typeof serverState>();
    const { result } = renderHook(() =>
      useListState(schema, adapter, { initialState: serverState }),
    );
    expect(result.current.state).toEqual(serverState);
  });

  it("restores admin storage when the URL has no list params", async () => {
    const adapter = createAdminListStateAdapter({ listId: "admin-products", schema });
    adapter.storage!.save({ q: "silver", sort: "name-asc" });
    mockLocation("");

    const { result } = renderHook(() => useListState(schema, adapter));

    await waitFor(() => {
      expect(result.current.state).toEqual({ q: "silver", sort: "name-asc" });
    });
    expect(vi.mocked(useRouter)().replace).toHaveBeenCalled();
  });

  it("does not restore storage for the site adapter", async () => {
    // Poison sessionStorage — site must ignore it.
    sessionStorage.setItem(
      "synarava:list-state:v1:shop",
      JSON.stringify({ q: "should-not-apply", sort: "updated" }),
    );
    mockLocation("");
    const adapter = createSiteListStateAdapter<{ q: string; sort: "published" | "updated" | "name-asc" }>();
    const { result } = renderHook(() => useListState(schema, adapter));

    await waitFor(() => {
      expect(result.current.state).toEqual({ q: "", sort: "published" });
    });
  });

  it("prefers URL params over storage", async () => {
    const adapter = createAdminListStateAdapter({ listId: "admin-products", schema });
    adapter.storage!.save({ q: "from-storage", sort: "name-asc" });
    mockLocation("q=from-url&sort=updated");

    const { result } = renderHook(() => useListState(schema, adapter));

    await waitFor(() => {
      expect(result.current.state).toEqual({ q: "from-url", sort: "updated" });
    });
  });

  it("clear resets state, URL, and storage", async () => {
    const adapter = createAdminListStateAdapter({ listId: "admin-products", schema });
    mockLocation("q=x&sort=updated");
    const { result } = renderHook(() => useListState(schema, adapter));

    await waitFor(() => expect(result.current.state.q).toBe("x"));

    act(() => {
      result.current.clear();
    });

    expect(result.current.state).toEqual({ q: "", sort: "published" });
    expect(adapter.storage!.load()).toBeNull();
    expect(window.location.search).toBe("");
  });

  it("debounces text search commits", async () => {
    vi.useFakeTimers();
    const adapter = createSiteListStateAdapter<{ q: string; sort: "published" | "updated" | "name-asc" }>();
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      replace,
      prefetch: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    } as ReturnType<typeof useRouter>);

    const { result } = renderHook(() =>
      useListState(schema, adapter, { debounceKeys: ["q"], debounceMs: 280 }),
    );

    act(() => {
      result.current.setFieldDebounced("q", "g");
      result.current.setFieldDebounced("q", "go");
      result.current.setFieldDebounced("q", "gold");
    });

    expect(result.current.draft.q).toBe("gold");
    expect(result.current.state.q).toBe("");

    await act(async () => {
      vi.advanceTimersByTime(280);
    });

    expect(result.current.state.q).toBe("gold");
    expect(replace).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("keeps state on popstate (back/forward)", async () => {
    const adapter = createSiteListStateAdapter<{ q: string; sort: "published" | "updated" | "name-asc" }>();
    mockLocation("q=one&sort=updated");
    const { result } = renderHook(() => useListState(schema, adapter));

    await waitFor(() => expect(result.current.state.q).toBe("one"));

    act(() => {
      mockLocation("q=two&sort=name-asc");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await waitFor(() => {
      expect(result.current.state).toEqual({ q: "two", sort: "name-asc" });
    });
  });

  it("survives storage unavailable on restore", async () => {
    const adapter = createAdminListStateAdapter({ listId: "admin-products", schema });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    mockLocation("");
    const { result } = renderHook(() => useListState(schema, adapter));
    await waitFor(() => {
      expect(result.current.state).toEqual({ q: "", sort: "published" });
    });
  });
});

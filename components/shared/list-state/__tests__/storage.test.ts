import { afterEach, describe, expect, it, vi } from "vitest";

import {
  defineListStateSchema,
  enumField,
  optionalStringField,
  stringField,
} from "@/lib/list-state";

import {
  createAdminListStateAdapter,
  createSiteListStateAdapter,
} from "../adapters";
import { createListStateStorage, listStateStorageKey } from "../storage";

const schema = defineListStateSchema({
  q: stringField({ key: "q" }),
  sort: enumField({
    key: "sort",
    defaultValue: "published" as const,
    allowed: ["published", "updated", "name-asc"] as const,
  }),
  category: optionalStringField({ key: "category" }),
});

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("listStateStorageKey", () => {
  it("versions the key per list", () => {
    expect(listStateStorageKey("admin-products", 1)).toBe("synarava:list-state:v1:admin-products");
    expect(listStateStorageKey("admin-products", 2)).toBe("synarava:list-state:v2:admin-products");
  });
});

describe("createListStateStorage", () => {
  it("round-trips non-default state and ignores unknown keys like cursor", () => {
    const storage = createListStateStorage({ listId: "admin-products", schema });
    storage.save({
      q: "gold",
      sort: "updated",
      category: "rings",
      // @ts-expect-error — cursor must never be persisted
      cursor: "abc",
    });

    const raw = JSON.parse(sessionStorage.getItem(storage.key)!);
    expect(raw).toEqual({ q: "gold", sort: "updated", category: "rings" });
    expect(raw.cursor).toBeUndefined();

    expect(storage.load()).toEqual({
      q: "gold",
      sort: "updated",
      category: "rings",
    });
  });

  it("returns null for default / empty state and clears the key", () => {
    const storage = createListStateStorage({ listId: "admin-products", schema });
    sessionStorage.setItem(storage.key, JSON.stringify({ q: "x" }));
    storage.save({ q: "", sort: "published", category: undefined });
    expect(sessionStorage.getItem(storage.key)).toBeNull();
    expect(storage.load()).toBeNull();
  });

  it("drops invalid stored values to defaults (then null if all default)", () => {
    const storage = createListStateStorage({ listId: "admin-products", schema });
    sessionStorage.setItem(storage.key, JSON.stringify({ sort: "hacked", q: "" }));
    expect(storage.load()).toBeNull();
  });

  it("survives unavailable sessionStorage", () => {
    const storage = createListStateStorage({ listId: "admin-products", schema });
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const removeItem = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(storage.load()).toBeNull();
    expect(() => storage.save({ q: "x", sort: "updated", category: undefined })).not.toThrow();
    expect(() => storage.clear()).not.toThrow();
    expect(storage.getSnapshot()).toBeNull();

    getItem.mockRestore();
    setItem.mockRestore();
    removeItem.mockRestore();
  });

  it("notifies subscribers on save/clear", () => {
    const storage = createListStateStorage({ listId: "admin-products", schema });
    const spy = vi.fn();
    const unsubscribe = storage.subscribe(spy);
    storage.save({ q: "a", sort: "published", category: undefined });
    storage.clear();
    expect(spy).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});

describe("adapters", () => {
  it("admin adapter exposes storage; site adapter does not", () => {
    const admin = createAdminListStateAdapter({ listId: "admin-products", schema });
    const site = createSiteListStateAdapter<{ q: string }>();
    expect(admin.kind).toBe("admin");
    expect(admin.storage).toBeDefined();
    expect(site.kind).toBe("site");
    expect(site.storage).toBeUndefined();
  });
});

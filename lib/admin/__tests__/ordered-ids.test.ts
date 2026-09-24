import { describe, expect, it } from "vitest";

import {
  appendOrderedItem,
  moveOrderedItem,
  moveOrderedItemDown,
  moveOrderedItemUp,
  removeOrderedItem,
} from "@/lib/admin/ordered-ids";

describe("ordered-ids", () => {
  it("moves an item to an arbitrary index", () => {
    expect(moveOrderedItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveOrderedItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("moves up and down one step", () => {
    expect(moveOrderedItemUp(["a", "b", "c"], 2)).toEqual(["a", "c", "b"]);
    expect(moveOrderedItemDown(["a", "b", "c"], 0)).toEqual(["b", "a", "c"]);
    expect(moveOrderedItemUp(["a", "b"], 0)).toEqual(["a", "b"]);
    expect(moveOrderedItemDown(["a", "b"], 1)).toEqual(["a", "b"]);
  });

  it("respects minItems on remove and maxItems on append", () => {
    expect(removeOrderedItem(["a", "b"], 0, 1)).toEqual(["b"]);
    expect(removeOrderedItem(["a"], 0, 1)).toEqual(["a"]);
    expect(appendOrderedItem(["a"], "b", 2)).toEqual(["a", "b"]);
    expect(appendOrderedItem(["a", "b"], "c", 2)).toEqual(["a", "b"]);
  });
});

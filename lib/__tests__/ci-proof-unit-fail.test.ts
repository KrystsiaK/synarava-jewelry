import { describe, expect, it } from "vitest";

describe("ci proof unit fail", () => {
  it("fails intentionally for Quality Gates proof", () => {
    expect(true).toBe(false);
  });
});

import { truncateText } from "../truncate";

describe("truncateText", () => {
  it("returns short text unchanged", () => {
    expect(truncateText("A short teaser.", 220)).toBe("A short teaser.");
  });

  it("cuts long text on a word boundary and appends an ellipsis", () => {
    const text = "Midnight Duck turns an everyday bag into something unmistakably individual and expressive.";
    const result = truncateText(text, 40);
    expect(result.length).toBeLessThanOrEqual(41);
    expect(result.endsWith("…")).toBe(true);
    expect(result.endsWith(" …")).toBe(false);
  });

  it("trims surrounding whitespace before measuring length", () => {
    expect(truncateText("  padded  ", 20)).toBe("padded");
  });
});

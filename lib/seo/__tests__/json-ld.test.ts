import { safeJsonLd } from "../json-ld";

describe("safeJsonLd", () => {
  it("serializes a plain object", () => {
    expect(safeJsonLd({ a: 1, b: "two" })).toBe('{"a":1,"b":"two"}');
  });

  it("escapes '<' and '>' so a value can't close the surrounding <script> tag", () => {
    const result = safeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(result).not.toContain("</script>");
    expect(result).toContain("\\u003c/script\\u003e");
  });

  it("escapes '&' to avoid HTML entity reinterpretation", () => {
    expect(safeJsonLd({ name: "Fish & Chips" })).toContain("\\u0026");
  });
});
